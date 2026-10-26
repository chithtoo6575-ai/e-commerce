import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  const authorization = request.headers.get('Authorization') || ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } },
  )
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })
  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items.map((item: { productId?: string; quantity?: number }) => ({ product_id: item.productId, quantity: item.quantity })) : null
    if (!items || items.length === 0 || items.length > 50 || !body.shippingAddress || typeof body.shippingAddress !== 'object') throw new Error('Invalid checkout details')
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_items: items,
      p_shipping_address: body.shippingAddress,
      p_recipient_name: String(body.recipientName || '').slice(0, 120),
      p_recipient_phone: String(body.recipientPhone || '').slice(0, 40),
      // Do not trust browser-supplied prices, discount, delivery fees or totals.
      p_delivery_fee: 0,
      p_discount: 0,
      p_idempotency_key: body.idempotencyKey || null,
    })
    if (error) throw error
    return Response.json({ orderId }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to create order' }, { status: 400, headers: corsHeaders })
  }
})
