import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword(): string {
  const lower  = 'abcdefghijkmnpqrstuvwxyz';
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = Array.from({ length: 6 }, () => pick(lower + upper + digits)).join('');
  return base + pick(upper) + pick(digits) + pick(special);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verifica autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) throw new Error('Unauthorized');

    // Verifica que o solicitante é um personal e busca seus dados
    const { data: callerProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, tenant_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) throw new Error('Profile not found');
    if (callerProfile.role !== 'personal') throw new Error('Forbidden');

    const tenantId = callerProfile.tenant_id!;

    // Busca dados do tenant (branding)
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('business_name, logo_url, primary_color')
      .eq('id', tenantId)
      .single();

    if (tenantErr || !tenant) throw new Error('Studio não encontrado');

    const { full_name, email, phone, birth_date, goal, notes } = await req.json();
    if (!full_name?.trim()) throw new Error('Nome é obrigatório');
    if (!email?.trim())     throw new Error('Email é obrigatório');

    const normalizedEmail = email.trim().toLowerCase();

    async function sendWelcomeEmail(opts: { tempPassword?: string; reusingAccount?: boolean }) {
      await fetch(`${supabaseUrl}/functions/v1/send-student-welcome`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          studentName: full_name.trim(),
          personalName: callerProfile.full_name ?? tenant.business_name,
          businessName: tenant.business_name,
          logoUrl: tenant.logo_url,
          primaryColor: tenant.primary_color,
          ...opts,
        }),
      }).catch(() => {});
    }

    // Já existe aluno com esse email NESTE tenant?
    const { data: sameTenantStudent } = await supabase
      .from('students')
      .select('id, user_id, status')
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (sameTenantStudent) {
      if (sameTenantStudent.status === 'active') {
        throw new Error('Já existe um aluno com esse email');
      }

      // Aluno já existiu neste tenant e foi excluído — reativa em vez de duplicar.
      const { error: reactivateErr } = await supabase
        .from('students')
        .update({
          full_name: full_name.trim(),
          phone: phone?.trim() || null,
          birth_date: birth_date?.trim() || null,
          goal: goal?.trim() || null,
          notes: notes?.trim() || null,
          status: 'active',
        })
        .eq('id', sameTenantStudent.id);
      if (reactivateErr) throw new Error(reactivateErr.message);

      if (sameTenantStudent.user_id) await sendWelcomeEmail({ reusingAccount: true });

      return new Response(
        JSON.stringify({ ok: true, studentId: sameTenantStudent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Já existe conta com esse email em OUTRO tenant? Reaproveita em vez de
    // tentar criar um auth.users duplicado — mantém a senha atual do aluno.
    const { data: existingElsewhere } = await supabase
      .from('students')
      .select('user_id')
      .eq('email', normalizedEmail)
      .neq('tenant_id', tenantId)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let userId: string;
    let tempPassword: string | undefined;
    const reusingAccount = !!existingElsewhere?.user_id;

    if (existingElsewhere?.user_id) {
      userId = existingElsewhere.user_id;

      const { error: profUpdateErr } = await supabase
        .from('profiles')
        .update({ tenant_id: tenantId })
        .eq('id', userId);
      if (profUpdateErr) throw new Error(profUpdateErr.message);
    } else {
      tempPassword = generateTempPassword();

      // Cria usuário no Supabase Auth passando role nos metadados
      // O trigger handle_new_user lê raw_user_meta_data->>'role' e cria o perfil corretamente
      const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: 'student',
        },
      });
      if (createErr) throw new Error(createErr.message);

      userId = authUser.user.id;

      // Atualiza o perfil criado pelo trigger: vincula tenant e força troca de senha
      const { error: profUpdateErr } = await supabase
        .from('profiles')
        .update({
          tenant_id: tenantId,
          must_change_password: true,
        })
        .eq('id', userId);

      if (profUpdateErr) {
        await supabase.auth.admin.deleteUser(userId);
        throw new Error(profUpdateErr.message);
      }
    }

    // Cria registro na tabela students
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .insert({
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        birth_date: birth_date?.trim() || null,
        goal: goal?.trim() || null,
        notes: notes?.trim() || null,
        tenant_id: tenantId,
        user_id: userId,
        status: 'active',
      })
      .select('id')
      .single();

    if (studentErr) {
      if (!reusingAccount) await supabase.auth.admin.deleteUser(userId);
      throw new Error(studentErr.message);
    }

    await sendWelcomeEmail(tempPassword ? { tempPassword } : { reusingAccount: true });

    return new Response(
      JSON.stringify({ ok: true, studentId: student.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
