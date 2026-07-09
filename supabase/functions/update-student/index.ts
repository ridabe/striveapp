import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) throw new Error('Perfil não encontrado');
    if (callerProfile.role !== 'personal') throw new Error('Acesso negado');

    const tenantId = callerProfile.tenant_id!;

    const { student_id, full_name, email, phone, birth_date, goal, notes } = await req.json();
    if (!student_id) throw new Error('student_id é obrigatório');
    if (!full_name?.trim()) throw new Error('Nome é obrigatório');
    if (!email?.trim())     throw new Error('Email é obrigatório');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) throw new Error('Email inválido');

    // Verifica que o aluno pertence a este tenant
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, user_id, email')
      .eq('id', student_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (studentErr || !student) throw new Error('Aluno não encontrado');

    const emailChanged = normalizedEmail !== student.email;

    if (emailChanged) {
      // Garante que nenhum outro aluno deste tenant já usa esse email
      const { data: conflict } = await supabase
        .from('students')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', normalizedEmail)
        .neq('id', student_id)
        .maybeSingle();

      if (conflict) throw new Error('Já existe um aluno com esse email');

      // Sincroniza o email na conta de autenticação, se houver login vinculado
      if (student.user_id) {
        const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(
          student.user_id,
          { email: normalizedEmail, email_confirm: true },
        );
        if (authUpdateErr) throw new Error(authUpdateErr.message);
      }
    }

    const { error: updateErr } = await supabase
      .from('students')
      .update({
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        birth_date: birth_date?.trim() || null,
        goal: goal?.trim() || null,
        notes: notes?.trim() || null,
      })
      .eq('id', student_id);

    if (updateErr) throw new Error(updateErr.message);

    // Mantém o nome exibido no perfil de login em sincronia
    if (student.user_id) {
      await supabase
        .from('profiles')
        .update({ full_name: full_name.trim() })
        .eq('id', student.user_id);
    }

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
