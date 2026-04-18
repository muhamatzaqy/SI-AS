# si-sangar
---

## SI-ASRAMA - Sistem Informasi Asrama

### Setup

1. Clone repo dan install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` menjadi `.env.local` dan isi dengan credentials Supabase:
```bash
cp .env.local.example .env.local
```

3. Jalankan migrasi SQL di Supabase Dashboard dengan file:
   - `supabase/migrations/001_create_tables.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_functions_triggers.sql`

4. Buat 4 Storage Buckets di Supabase Dashboard:
   - `attendance-photos` (public)
   - `permit-photos` (public)
   - `payment-proofs` (public)
   - `violation-photos` (public)

5. Jalankan development server:
```bash
npm run dev
```

### Tech Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL, Auth, Storage)
- Tailwind CSS + Radix UI
- React Hook Form + Zod
