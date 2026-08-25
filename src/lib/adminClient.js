import { createClient } from '@supabase/supabase-js'

// عميل ثانوي لإنشاء حسابات المستخدمين دون التأثير على جلسة المالك الحالية.
// لا يحفظ الجلسة ولا يجدد الرمز، ويستخدم مفتاح تخزين مختلف.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const adminAuthClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'sb-farm-admin-tmp',
  },
})
