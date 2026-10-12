# Discord Autopost Hub (Node.js + Express + SQLite + node-cron)

Aplikasi backend Node.js + Express dengan SQLite dan node-cron untuk menjadwalkan dan mengirim pesan otomatis ke banyak channel Discord secara berkala menggunakan **USER TOKEN** Discord (multi-akun). Dilengkapi dengan enkripsi militer **AES-256-GCM**, database SQLite relasional, scheduler background berbasis `node-cron`, random jitter anti-deteksi spam, sistem placeholder dinamis, dan penanganan rate limit cerdas.

---

## 1. Struktur Folder Project

```text
├── .env.example              # Template variabel lingkungan (Secret key enkripsi, port)
├── index.html                # Entry point HTML dengan meta title & description
├── metadata.json             # AI Studio Applet metadata
├── package.json              # Dependency & scripts (dev: tsx server.ts, start: node server.js)
├── server.ts                 # Full-stack backend entry point (Express + API + Vite middlewares)
├── tsconfig.json             # Konfigurasi TypeScript
├── vite.config.ts            # Vite & Tailwind CSS bundler configuration
│
├── data/
│   └── autopost.sqlite       # Database SQLite persisten (auto-generated)
│
├── src/
│   ├── main.tsx              # React mounting root
│   ├── App.tsx               # Main container, routing tabs, polling state & layout
│   ├── index.css             # Tailwind dark mode & custom scrollbar styles
│   │
│   ├── types/
│   │   └── index.ts          # Interface TypeScript (DiscordAccount, Channel, Log, Settings, Stats)
│   │
│   ├── server/
│   │   ├── crypto.ts         # AES-256-GCM token encryption & decryption utility
│   │   ├── db.ts             # SQLite Database Manager (accounts, channels, logs, settings tables)
│   │   ├── discord.ts        # Discord API client (token validation, messaging, rate limits)
│   │   └── scheduler.ts      # Scheduler background berbasis node-cron & isolasi error
│   │
│   ├── components/
│   │   ├── Sidebar.tsx       # Sidebar navigasi (Dashboard, Accounts, Channels, Logs, Settings)
│   │   ├── Header.tsx        # Top bar kontrol (Start All, Stop All, Refresh status)
│   │   ├── Toast.tsx         # Sistem toast notification (Success, Error, Warning, Info)
│   │   ├── ConfirmModal.tsx  # Modal dialog konfirmasi hapus data
│   │   └── ToSWarning.tsx    # Banner edukasi kepatuhan ToS Discord & tips keamanan
│   │
│   └── pages/
│       ├── DashboardPage.tsx # Ringkasan metrik, countdown real-time, aktivitas terkini
│       ├── AccountsPage.tsx  # Manajemen multi-akun, tester validasi token Discord
│       ├── ChannelsPage.tsx  # Tabel channel, editor delay (Jam/Menit/Detik), jitter & placeholder
│       ├── LogsPage.tsx      # Histori pengiriman, audit status Discord, filter, export CSV/JSON
│       └── SettingsPage.tsx  # Master kill-switch, panduan anti-banned & placeholder cheat sheet
```

---

## 2. Fitur Utama

1. **Multi-Akun User Token Terenkripsi**:
   - Tambahkan beberapa akun Discord sekaligus.
   - Token divalidasi langsung ke endpoint `https://discord.com/api/v10/users/@me`.
   - Token disimpan terenkripsi dengan **AES-256-GCM** di database server, tidak pernah diekspos ke frontend.
2. **Multi-Channel & Delay Independen**:
   - Setiap channel memiliki interval tersendiri dalam kombinasi **Jam**, **Menit**, dan **Detik**.
   - Opsi **Random Delay Range** (Jitter acak) agar interval tidak statis dan tidak mudah terdeteksi sebagai automasi bot.
3. **Pesan Kustom & Template Placeholders**:
   - Textarea multi-line mendukung markdown Discord.
   - Variabel dinamis otomatis:
     - `{time}` : Jam pengiriman (misal: `14:30:15`)
     - `{date}` : Tanggal (misal: `2026-10-12`)
     - `{datetime}` : Tanggal & waktu lengkap
     - `{channel}` : Nama channel target
     - `{account}` : Username pengirim
     - `{random_1-100}` atau `{random_MIN-MAX}` : Angka unik acak
     - `{uuid}` : Kode alfanumerik unik pendek pencegah duplikasi
     - `{greeting}` : Salam bervariasi otomatis
     - `{random_choice:A|B|C}` : Pilihan kata acak
4. **Scheduler Server-Side & Isolasi Kegagalan**:
   - Berjalan di background Node.js, bukan di browser. Menutup tab browser tidak menghentikan jadwal autopost.
   - **Isolasi error**: Jika salah satu channel mengalami kegagalan (misal: channel terhapus, permission 403, atau token invalid), channel lainnya tetap berjalan tanpa terganggu.
   - **Auto-Backoff Rate Limit (HTTP 429)**: Jika terkena rate limit dari Discord, scheduler otomatis membaca parameter `retry_after` dan menunda pengiriman hingga aman.
5. **Kontrol Menyeluruh**:
   - Tombol toggle individual per channel.
   - Tombol global **Start All** dan **Stop All**.
   - Tombol manual **Send Now** (Tes Kirim Sekarang).
   - Log aktivitas lengkap dengan opsi export JSON/CSV dan pembersihan log.

---

## 3. Skema Database (`data/db.json`)

Penyimpanan terstruktur dan tersinkronisasi secara atomik ke filesystem:

### `accounts`
- `id` (string UUID)
- `name` (label kustom akun)
- `discordId` (Discord User Snowflake ID)
- `username` (username Discord)
- `discriminator` (tag nomor jika ada)
- `avatarUrl` (URL avatar pengguna)
- `tokenEncrypted` (AES-256-GCM string: `iv:authTag:ciphertext`)
- `tokenMasked` (token tersensor untuk preview aman di UI)
- `status` (`'valid'` | `'invalid'`)
- `lastValidatedAt` (ISO timestamp)
- `createdAt` (ISO timestamp)

### `channels`
- `id` (string UUID)
- `name` (nama label channel)
- `channelId` (ID channel Discord tujuan)
- `accountId` (ID akun pengirim yang ditugaskan)
- `delayHours`, `delayMinutes`, `delaySeconds` (waktu jeda)
- `delayTotalSeconds` (total durasi delay terhitung)
- `randomDelayEnabled` (boolean)
- `randomDelayMinSeconds`, `randomDelayMaxSeconds` (rentang jitter acak)
- `messageTemplate` (isi pesan dengan placeholder)
- `isActive` (status switch ON/OFF)
- `status` (`'waiting'` | `'sending'` | `'stopped'` | `'error'`)
- `lastSentAt` (ISO timestamp)
- `nextSendAt` (ISO timestamp jadwal posting berikutnya)
- `sentCount`, `failCount` (penghitung metrik performa)

### `logs`
- `id` (string UUID)
- `channelId`, `channelName`, `targetChannelId`
- `accountId`, `accountName`
- `status` (`'success'` | `'failed'` | `'rate_limited'`)
- `messagePreview` (cuplikan isi pesan yang telah dirender)
- `responseCode` (HTTP Status Code: 200, 429, 403, 404, dll)
- `responseDetails` (keterangan respon Discord API)
- `createdAt` (ISO timestamp)

---

## 4. Cara Menjalankan Project

### A. Persiapan Lingkungan (.env)
Salin `.env.example` menjadi `.env` (atau pastikan `ENCRYPTION_SECRET` telah terpasang):
```bash
ENCRYPTION_SECRET="discord_autopost_hub_secure_key_32chars!"
PORT=3000
```

### B. Menjalankan Mode Development
```bash
npm run dev
```
Aplikasi akan aktif di `http://localhost:3000` dengan Express API dan Vite dev-server terintegrasi.

### C. Build & Menjalankan di Production
```bash
npm run build
npm start
```

---

## 5. Cara Mendapatkan Discord User Token dari Browser

1. Buka browser (Chrome, Edge, atau Firefox) dan login ke [Discord Web](https://discord.com/app).
2. Tekan `F12` atau `Ctrl + Shift + I` untuk membuka **Developer Tools**.
3. Buka tab **Network**.
4. Ketik `@me` pada kolom filter atau kirimkan satu pesan tes di salah satu channel.
5. Klik baris request bernama `@me` (atau `messages`), lalu pilih tab **Headers** di panel kanan.
6. Scroll ke bawah pada **Request Headers**, lalu salin nilai pada baris **authorization**.
7. Buka menu **Akun Discord** pada aplikasi ini, klik **Tambah Token Akun**, lalu paste token Anda.
