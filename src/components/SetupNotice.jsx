export default function SetupNotice() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 20 }}>
      <div className="card card-pad fade-in" style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 46 }}>🐄</div>
        <h1 style={{ fontSize: 24, margin: '10px 0' }}>مرحباً بك في «مزرعتي»</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          لتشغيل النظام، اربطه بمشروع Supabase الخاص بك:
        </p>
        <ol style={{ paddingRight: 20, lineHeight: 2, fontSize: 15 }}>
          <li>أنشئ مشروعاً جديداً على <b>supabase.com</b> (مجاني).</li>
          <li>افتح <b>SQL Editor</b> وشغّل ملف <code>supabase/schema.sql</code>.</li>
          <li>من <b>Project Settings ← API</b> انسخ الـ URL والـ anon key.</li>
          <li>انسخ الملف <code>.env.example</code> إلى <code>.env</code> وضع القيم، ثم أعد التشغيل.</li>
        </ol>
      </div>
    </div>
  )
}
