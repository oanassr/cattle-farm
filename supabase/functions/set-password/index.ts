// تغيير كلمة مرور مستخدم — للمالك فقط (لأي مستخدم).
// المستخدم يغيّر كلمة مروره بنفسه عبر supabase.auth.updateUser مباشرةً (لا يحتاج هذه الدالة).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asUser.auth.getUser()
    if (uErr || !user) return json({ error: 'غير مصرّح' }, 401)

    const admin = createClient(url, service)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || prof.role !== 'owner') return json({ error: 'هذه العملية للمالك فقط' }, 403)

    const { user_id, password } = await req.json()
    if (!user_id || !password || String(password).length < 6) return json({ error: 'كلمة المرور 6 أحرف على الأقل' }, 400)

    const { error } = await admin.auth.admin.updateUserById(user_id, { password })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
