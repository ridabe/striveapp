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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { plan_slug } = await req.json();
    if (!plan_slug || plan_slug === 'free') throw new Error('Invalid plan');

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('slug, name, price_brl, abacatepay_product_id')
      .eq('slug', plan_slug)
      .eq('is_active', true)
      .single();

    if (planError || !plan) throw new Error('Plan not found');
    if (!plan.abacatepay_product_id) throw new Error('Plan has no payment product');

    // Get tenant info
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) throw new Error('Tenant not found');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, contact_email')
      .eq('id', profile.tenant_id)
      .single();

    // Create AbacatePay billing
    const apiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!apiKey) throw new Error('Payment service not configured');

    const billingRes = await fetch('https://api.abacatepay.com/v1/billing/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frequency: 'MONTHLY',
        methods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
        products: [{ externalId: plan.abacatepay_product_id, quantity: 1 }],
        customer: {
          name: tenant?.business_name ?? user.email,
          email: tenant?.contact_email ?? user.email,
          taxId: { type: 'CPF', number: '00000000000' },
        },
        returnUrl: 'https://app.strivepersonal.com.br',
        completionUrl: 'https://app.strivepersonal.com.br',
      }),
    });

    const billing = await billingRes.json();
    if (!billingRes.ok || !billing.data?.url) {
      throw new Error(billing.error ?? 'Failed to create billing');
    }

    // Insert pending subscription
    await supabase.from('subscriptions').insert({
      tenant_id: profile.tenant_id,
      plan_slug: plan_slug,
      status: 'pending',
      abacatepay_checkout_id: billing.data.id,
    });

    return new Response(
      JSON.stringify({ checkout_url: billing.data.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
