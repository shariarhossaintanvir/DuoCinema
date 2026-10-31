# DuoCinema — সহজ বাংলা সেটআপ গাইড (Setup Guide in Bangla)

এই নির্দেশিকাটি নতুন ব্যবহারকারীদের জন্য তৈরি করা হয়েছে, যাতে খুব সহজেই Supabase Free এবং Vercel Hobby ব্যবহার করে DuoCinema সম্পূর্ণ ফ্রিতে হোস্ট এবং কনফিগার করা যায়।

---

## ১. Supabase ফ্রি অ্যাকাউন্ট ও প্রজেক্ট তৈরি

১. ব্রাউজারে [supabase.com](https://supabase.com) এ যান এবং একটি ফ্রি অ্যাকাউন্ট তৈরি করুন।
২. **New Project** এ ক্লিক করুন:
   - **Name**: `DuoCinema` (বা আপনার পছন্দের নাম দিন)
   - **Database Password**: একটি শক্তিশালী পাসওয়ার্ড দিন এবং এটি নিরাপদে সংরক্ষণ করুন।
   - **Region**: আপনার কাছাকাছি অঞ্চল নির্বাচন করুন (যেমন: `Southeast Asia (Singapore)` বা `South Asia (Mumbai)`).
   - **Pricing Plan**: `Free Plan` (সম্পূর্ণ ফ্রি)
৩. **Create new project** এ ক্লিক করে প্রজেক্ট প্রস্তুত হওয়া পর্যন্ত ১–২ মিনিট অপেক্ষা করুন।

---

## ২. পাবলিক সাইনআপ বন্ধ করা (Disable Public Signup)

DuoCinema শুধুমাত্র ২ জন অনুমোদিত বন্ধুর জন্য তৈরি। কোনো বাইরের ব্যক্তি যাতে সাইনআপ করতে না পারে:
১. বাম পাশের মেনু থেকে **Authentication** এ ক্লিক করুন।
২. **Configuration** -> **Sign In / Up** এ যান।
৩. **Allow new users to sign up** অপশনটি **Disable (বন্ধ)** করে দিন।
৪. নিচে **Save** এ ক্লিক করুন।

---

## ৩. দুইজন অনুমোদিত ইউজার তৈরি করা (Create 2 Approved Users)

১. **Authentication** -> **Users** ট্যাবে যান।
২. উপরে **Add user** -> **Create user** এ ক্লিক করুন:
   - আপনার ইমেইল এবং পাসওয়ার্ড দিন (Auto Confirm User অন রাখুন যাতে কোনো ইমেইল ভেরিফিকেশন না লাগে)।
   - একইভাবে আপনার বন্ধুর জন্য দ্বিতীয় অ্যাকাউন্টটি তৈরি করুন।
৩. ইউজার তালিকায় প্রতিটি ইউজারের পাশের **User UID** (যেমন: `a1b2c3d4-e5f6-7890-abcd-1234567890ab`) কপি করে সংরক্ষণ করুন।

---

## ৪. ডাটাবেজ মাইগ্রেশন রান করা (Run SQL Migrations)

বাম পাশের মেনু থেকে **SQL Editor** এ ক্লিক করুন। এরপর নিচের ৩টি মাইগ্রেশন ফাইল ক্রমানুসারে পেস্ট করে **Run** করুন:

### ধাপ ১: Initial Schema
`supabase/migrations/20260301000001_initial_schema.sql` ফাইলের পুরো কোড কপি করে SQL Editor এ পেস্ট করুন এবং **Run** বাটনে চাপ দিন।

### ধাপ ২: Security Definer RPCs
`supabase/migrations/20260301000002_rpcs.sql` ফাইলের পুরো কোড কপি করে SQL Editor এ পেস্ট করুন এবং **Run** বাটনে চাপ দিন।

### ধাপ ৩: Realtime Publication
`supabase/migrations/20260301000003_realtime_setup.sql` ফাইলের কোড পেস্ট করে **Run** করুন।

### ধাপ ৪: অ্যালাউলিস্টে (Allowlist) দুইজনকে যোগ করা
SQL Editor এ নিচের কুয়েরিটি আপনার সংরক্ষিত দুটি UID দিয়ে চালান:

```sql
INSERT INTO public.allowed_users (user_id, display_name)
VALUES
  ('প্রথম_ইউজারের_UID_এখানে_দিন', 'আপনার নাম'),
  ('দ্বিতীয়_ইউজারের_UID_এখানে_দিন', 'বন্ধুর নাম');
```

---

## ৫. লোকাল পরিবেশ কনফিগারেশন (.env.local)

১. Supabase ড্যাশবোর্ডে **Project Settings** (গিয়ার আইকন) -> **API** এ যান।
২. সেখান থেকে দুটি মান কপি করুন:
   - **Project URL** (যেমন: `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public` কী
৩. প্রজেক্টের রুটে `.env.local` নামে একটি ফাইল তৈরি করুন:
   ```env
   VITE_SUPABASE_URL=https://আপনার-প্রজেক্ট-আইডি.supabase.co
   VITE_SUPABASE_ANON_KEY=আপনার_anon_কী_এখানে_দিন
   ```
৪. কমান্ড লাইনে রান করুন:
   ```bash
   npm run dev
   ```
   এরপর ব্রাউজারে `http://localhost:5173` খুলুন।

---

## ৬. Vercel Hobby তে ফ্রি ডেপ্লয়মেন্ট (Frontend Hosting)

DuoCinema একটি সম্পূর্ণ স্ট্যাটিক SPA (Single Page Application)। মুভি ফাইল কখনোই ইন্টারনেটে আপলোড হয় না, তাই কোনো ব্যান্ডউইথ খরচ বা বিলিংয়ের ভয় নেই।

১. [vercel.com](https://vercel.com) এ ফ্রি অ্যাকাউন্ট খুলুন বা লগইন করুন।
২. আপনার গিট রিপোজিটরি ইমপোর্ট করুন:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
৩. **Environment Variables** সেকশনে দুটি ভেরিয়েবল যোগ করুন:
   - `VITE_SUPABASE_URL`: আপনার Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: আপনার Supabase anon key
৪. **Deploy** বাটনে ক্লিক করুন।
৫. Vercel প্রজেক্টে `vercel.json` ফাইলে আগেই SPA Routing (Rewrites) যুক্ত করা আছে, ফলে পেজ রিফ্রেশ করলেও কোনো ৪০৪ এরর হবে না।

---

## ৭. যেভাবে একসাথে মুভি দেখবেন (Watch Guide)

১. আপনি ও আপনার বন্ধু উভয়েই আগে থেকেই একই মুভি ফাইল নিজেদের কম্পিউটারে বা ফোনে ডাউনলোড করে রাখুন।
২. সাইটে লগইন করে একজন **Create Room** এ ক্লিক করে রুম তৈরি করুন এবং কোডটি বন্ধুকে দিন।
৩. বন্ধু তার ডিভাইসে কোড দিয়ে রুমে যোগ দিন।
৪. উভয়েই **Select Local Movie** বাটনে ক্লিক করে নিজেদের ডিভাইসের মুভি ফাইলটি সিলেক্ট করুন।
   - সিস্টেমটি কয়েক মিলি-সেকেন্ডে ফিংগারপ্রিন্ট যাচাই করে নিশ্চিত করবে ফাইল দুটি সম্পূর্ণ একই কি না।
৫. দুইজনই **I'm Ready** বাটনে ক্লিক করলে প্লেয়ার আনলক হবে।
৬. এরপর যেকোনো একজন প্লে, পজ বা সিক করলে দুইজনের ডিভাইসেই একসাথে ভিডিও নিখুঁতভাবে চলবে!
