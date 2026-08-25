# 🐄 مزرعتي — نظام إدارة مزرعة الأبقار

نظام إلكتروني بسيط لإدارة **منصرفات وإيرادات** مزرعة الأبقار، مع **تقارير تفصيلية إبداعية**.
الإدخال سهل عبر قوائم خيارات جاهزة، والتقارير تحليلية بالرسوم البيانية.

مبني بـ **React + Vite + Supabase**، يعمل كموقع ويب و **PWA** قابل للتثبيت على الجوال،
ومهيّأ لإطلاق تطبيق أندرويد مستقبلاً باستخدام نفس قاعدة بيانات Supabase.

---

## ✨ المزايا

- **ثلاثة أدوار:** مالك المزرعة · مدير المزرعة · بائع — لكل دور صلاحياته.
- **المنصرفات:** أعلاف، أدوية بيطرية، عمالة، كهرباء وماء، صيانة، شراء أبقار… (فئات جاهزة).
- **الإيرادات:** بيع الحليب، الأبقار، العجول، السماد، منتجات الألبان… مع اسم المشتري.
- **إنتاج الحليب اليومي** مع منحنى بياني.
- **لوحة تحكم** بمؤشرات الشهر ورسم الإيرادات مقابل المنصرفات.
- **تقارير تفصيلية:** الأرباح والخسائر شهرياً، توزيع الفئات، هامش الربح، تكلفة اللتر،
  تصدير **CSV** وطباعة **PDF**.
- واجهة عربية **RTL** كاملة، متجاوبة مع الجوال.

## 👥 صلاحيات الأدوار

| الميزة | مالك | مدير | بائع |
|--------|:----:|:----:|:----:|
| لوحة التحكم والتقارير | ✅ | ✅ | — |
| المنصرفات | ✅ | ✅ | — |
| الإيرادات | ✅ | ✅ | ✅ (مبيعاته فقط) |
| إنتاج الحليب | ✅ | ✅ | 👁️ قراءة |
| إدارة المستخدمين | ✅ | — | — |

---

## 🚀 التشغيل محلياً

### 1) إنشاء مشروع Supabase (مجاني)
1. أنشئ حساباً ومشروعاً جديداً على [supabase.com](https://supabase.com).
2. افتح **SQL Editor → New query** والصق محتوى [`supabase/schema.sql`](supabase/schema.sql) ثم شغّله.
   (ينشئ الجداول، الأمان RLS، والفئات الافتراضية.)
3. من **Project Settings → API** انسخ:
   - `Project URL`
   - `anon public` key
4. (موصى به) من **Authentication → Providers → Email** أوقف **Confirm email**
   لتفعيل الحسابات فوراً بدون بريد تأكيد.

### 2) ربط المشروع
```bash
cp .env.example .env
```
ثم ضع القيم في `.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3) التشغيل
```bash
npm install
npm run dev
```
افتح `http://localhost:5173`.

### 4) إنشاء أول مالك
1. أنشئ حساباً (سجّل مستخدماً واحداً — سيكون دوره الافتراضي «بائع»).
2. في **SQL Editor** بـ Supabase نفّذ لترقيته إلى مالك:
```sql
update public.profiles set role = 'owner'
where id = (select id from auth.users order by created_at limit 1);
```
3. سجّل الدخول — الآن يمكنك إضافة بقية المستخدمين من صفحة **المستخدمون**.

---

## 📦 النشر على GitHub + الاستضافة

```bash
git init
git add .
git commit -m "أول إصدار: نظام إدارة مزرعة الأبقار"
git branch -M main
git remote add origin https://github.com/<username>/cattle-farm.git
git push -u origin main
```

للاستضافة المجانية (Vercel / Netlify / Cloudflare Pages):
- Build command: `npm run build`
- Output directory: `dist`
- أضف متغيّري البيئة `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` في إعدادات المنصّة.

> ⚠️ لا تُرفع قيم `.env` إلى GitHub (مستثناة في `.gitignore`). مفتاح `anon` عام وآمن
> للاستخدام في المتصفح لأن الحماية الفعلية عبر سياسات RLS في قاعدة البيانات.

---

## 📱 تطبيق الأندرويد مستقبلاً

قاعدة البيانات على Supabase تخدم الويب والجوال معاً. للتطبيق لاحقاً أحد خيارين:
- **PWA:** النظام قابل للتثبيت من المتصفح مباشرة (أضيف manifest).
- **Flutter / React Native:** يتصل بنفس مشروع Supabase عبر مكتبة `supabase_flutter`
  أو `@supabase/supabase-js`، مع إعادة استخدام نفس الجداول والسياسات.

## 🗂️ بنية المشروع
```
supabase/schema.sql      مخطط قاعدة البيانات + RLS + الفئات
src/
  lib/         supabase.js · format.js · adminClient.js
  contexts/    AuthContext.jsx
  components/  Layout · ui · SetupNotice
  pages/       Login · Dashboard · Expenses · Revenues · Milk · Reports · Users
```
