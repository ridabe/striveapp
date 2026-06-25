import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword(): string {
  const lower   = 'abcdefghijkmnpqrstuvwxyz';
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits  = '23456789';
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
    if (authError || !user) throw new Error('Token inválido');

    // Verifica que o solicitante é um personal
    const { data: callerProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, tenant_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) throw new Error('Perfil não encontrado');
    if (callerProfile.role !== 'personal') throw new Error('Acesso negado');

    const tenantId = callerProfile.tenant_id!;

    // Lê o student_id do body
    const { student_id } = await req.json();
    if (!student_id) throw new Error('student_id é obrigatório');

    // Verifica que o aluno pertence a este tenant
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('user_id, full_name, email')
      .eq('id', student_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (studentErr || !student) throw new Error('Aluno não encontrado');
    if (!student.user_id) throw new Error('Este aluno não possui login vinculado');

    // Busca dados do tenant para o email
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('business_name, logo_url, primary_color')
      .eq('id', tenantId)
      .single();

    if (tenantErr || !tenant) throw new Error('Studio não encontrado');

    // Gera nova senha provisória
    const tempPassword = generateTempPassword();

    // Atualiza a senha do usuário no Supabase Auth
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      student.user_id,
      { password: tempPassword },
    );
    if (updateErr) throw new Error(updateErr.message);

    // Força troca de senha no próximo login
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', student.user_id);

    if (profErr) throw new Error(profErr.message);

    // Reenvia o email de boas-vindas com a nova senha provisória
    await fetch(`${supabaseUrl}/functions/v1/send-student-welcome`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: student.email,
        studentName: student.full_name,
        personalName: callerProfile.full_name ?? tenant.business_name,
        businessName: tenant.business_name,
        tempPassword,
        logoUrl: tenant.logo_url,
        primaryColor: tenant.primary_color,
      }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true }),
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
