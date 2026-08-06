# DuitKu — Personal Money Management

Aplikasi **Personal Money Management** production-ready yang dibangun dengan **Next.js 15 App Router**, **TypeScript**, **TailwindCSS**, **shadcn/ui**, **Drizzle ORM**, **Cloudflare D1**, dan **Telegram Bot**.

---

## 🚀 Fitur Utama

- 💰 **Pencatatan Keuangan Lengkap**: Pemasukan, Pengeluaran, dan Transfer.
- 🛡️ **Kalkulator Dana Darurat**: Hitung target dana darurat ideal 3, 6, 9, hingga 12 bulan berdasarkan status tanggungan dan pengeluaran rata-rata.
- 🎯 **Target Tabungan (Saving Goals)**: Pantau progres tabungan impianmu.
- 📊 **Dashboard Stripe-Style & Analytics**: Visualisasi Cashflow, Pie Chart Kategori, dan Donut Chart Metode Pembayaran menggunakan Recharts.
- 📅 **Tagihan Rutin & Pengingat**: Catat tagihan bulanan & bayar dengan 1 klik.
- 🤖 **Telegram Bot Integrasi Webhook**:
  - Perintah: `/start`, `/help`, `/saldo`, `/budget`, `/statistik`
  - Input cepat bahasa alami: `+500000 Gaji`, `-25000 Makan`, `-45000 Bensin`
- ⏰ **Auto-Report Cron (Vercel Cron)**:
  - Laporan Excel mingguan setiap Hari Minggu jam 20.00 WIB dikirim ke Telegram.
  - Laporan Excel bulanan setiap tanggal 1 dikirim ke Telegram.
- 📄 **Ekspor & Impor**: Ekspor ke Excel (.xlsx), PDF (.pdf), CSV, dan fitur Cetak langsung.
- 🌙 **Dark Mode & Glassmorphism UI**: Desain modern responsif dengan shadcn/ui & Framer Motion.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: TailwindCSS + shadcn/ui + Framer Motion
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Database Proxy**: Cloudflare Worker (Hono)
- **Auth**: Auth.js (NextAuth v5)
- **State & Form**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Export**: XLSX + jsPDF + autoTable
- **Bot**: grammY Telegram SDK

---

## ⚙️ Panduan Instalasi & Deployment

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Konfigurasi Environment Variables
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel environment sesuai kebutuhan.

### 3. Deploy Cloudflare Worker D1 Proxy
Masuk ke direktori `worker/`:
```bash
cd worker
npm install
npx wrangler d1 create duitku-db
```
Update `database_id` di `wrangler.jsonc`, lalu deploy:
```bash
npx wrangler deploy
```

### 4. Jalankan Migrasi Database
```bash
npm run db:push
```

### 5. Jalankan Local Development
```bash
npm run dev
```
Buka `http://localhost:3000` di browser.

---

## 🤖 Menghubungkan Telegram Bot Webhook

Set webhook ke endpoint Vercel kamu:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{ "url": "https://nama-app-kamu.vercel.app/api/telegram", "secret_token": "<TELEGRAM_WEBHOOK_SECRET>" }'
```

---

## 📜 Lisensi
MIT License - DuitKu Personal Finance Management App.
