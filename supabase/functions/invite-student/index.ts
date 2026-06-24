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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verifica autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) throw new Error('Unauthorized');

    // Verifica que o solicitante é um personal
    const { data: callerProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) throw new Error('Profile not found');
    if (callerProfile.role !== 'personal') throw new Error('Forbidden');

    const tenantId = callerProfile.tenant_id!;

    const { full_name, email, phone, birth_date, goal, notes } = await req.json();
    if (!full_name?.trim()) throw new Error('Nome é obrigatório');
    if (!email?.trim())     throw new Error('Email é obrigatório');

    // Verifica se já existe aluno com esse email no tenant
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existing) throw new Error('Já existe um aluno com esse email');

    const tempPassword = generateTempPassword();

    // Cria usuário no Supabase Auth
    const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });
    if (createErr) throw new Error(createErr.message);

    const userId = authUser.user.id;

    // Cria perfil
    const { error: profInsertErr } = await supabase.from('profiles').insert({
      id: userId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role: 'student',
      tenant_id: tenantId,
      must_change_password: true,
    });

    if (profInsertErr) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(profInsertErr.message);
    }

    // Cria registro na tabela students
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .insert({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
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
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(studentErr.message);
    }

    // Envia email de boas-vindas via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'Strive Personal <noreply@strivepersonal.com.br>';

    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: email.trim().toLowerCase(),
          subject: '🏋️ Bem-vindo ao Strive Personal!',
          html: `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Arial,sans-serif;background:#f4f4f8;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;color:#fff;">
    <h1 style="color:#E8FF47;font-size:24px;margin:0 0 8px;">Strive Personal</h1>
    <h2 style="font-size:18px;margin:0 0 24px;color:#fff;">Olá, ${full_name.trim()}! 👋</h2>
    <p style="color:#b0b0c3;line-height:1.6;margin:0 0 24px;">
      Sua conta foi criada com sucesso pelo seu personal trainer.<br>
      Use os dados abaixo para fazer seu primeiro acesso no app.
    </p>
    <div style="background:#0e0e1a;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#b0b0c3;">EMAIL</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:bold;color:#E8FF47;">${email.trim().toLowerCase()}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#b0b0c3;">SENHA TEMPORÁRIA</p>
      <p style="margin:0;font-size:20px;font-weight:bold;color:#E8FF47;letter-spacing:2px;">${tempPassword}</p>
    </div>
    <p style="color:#b0b0c3;font-size:13px;line-height:1.6;margin:0 0 24px;">
      ⚠️ Por segurança, você será solicitado a criar uma nova senha no primeiro acesso.
    </p>
    <p style="color:#b0b0c3;font-size:13px;margin:0;">
      Baixe o app Strive Personal e comece sua jornada! 💪
    </p>
  </div>
</body>
</html>`,
        }),
      }).catch(() => {});
    }

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
