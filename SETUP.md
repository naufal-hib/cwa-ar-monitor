# SETUP GUIDE — CWA AR Monitor
**Panduan lengkap setup Supabase + Deploy ke GitHub Pages**

---

## Daftar Isi
1. [Buat Project Supabase](#1-buat-project-supabase)
2. [Jalankan SQL Schema](#2-jalankan-sql-schema)
3. [Konfigurasi API Key di Code](#3-konfigurasi-api-key-di-code)
4. [Deploy ke GitHub Pages](#4-deploy-ke-github-pages)
5. [Test Upload Data](#5-test-upload-data)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Buat Project Supabase

### Langkah 1.1 — Daftar / Login
1. Buka browser, pergi ke **https://supabase.com**
2. Klik **Start your project** → daftar akun jika belum punya (gratis, pakai email)
3. Login ke dashboard Supabase

### Langkah 1.2 — Buat Project Baru
1. Di dashboard, klik tombol **New Project**
2. Pilih organisasi (biasanya nama email Anda)
3. Isi form:
   - **Name:** `cwa-ar-monitor` (atau nama apapun)
   - **Database Password:** buat password kuat, **simpan di tempat aman**
   - **Region:** pilih **Southeast Asia (Singapore)** — paling dekat
4. Klik **Create new project**
5. Tunggu 1–2 menit hingga project selesai dibuat (ada loading bar)

### Langkah 1.3 — Ambil API Keys
1. Setelah project selesai, klik **Settings** (ikon gear, di sidebar kiri bawah)
2. Pilih menu **API**
3. Catat dua nilai ini:
   - **Project URL** → contoh: `https://abcdefghij.supabase.co`
   - **anon public** key → string panjang dimulai `eyJ...`

> **Simpan kedua nilai ini**, akan dipakai di langkah 3.

---

## 2. Jalankan SQL Schema

### Langkah 2.1 — Buka SQL Editor
1. Di sidebar kiri Supabase, klik **SQL Editor** (ikon terminal)
2. Klik **New query**

### Langkah 2.2 — Jalankan SQL Tabel Penjualan
Copy-paste SQL berikut ke editor, lalu klik **Run** (atau tekan `Ctrl+Enter`):

```sql
CREATE TABLE penjualan (
  id              BIGSERIAL PRIMARY KEY,
  bulan_tahun     VARCHAR(7) NOT NULL,
  kode_area       VARCHAR(20),
  area            VARCHAR(100),
  tanggal         DATE NOT NULL,
  kode_pelanggan  VARCHAR(50) NOT NULL,
  nama_pelanggan  VARCHAR(200) NOT NULL,
  no_invoice      VARCHAR(100) NOT NULL,
  no_sj           VARCHAR(100),
  kode_barang     VARCHAR(50),
  nama_barang     VARCHAR(200),
  satuan          VARCHAR(20),
  qty             NUMERIC,
  jumlah_harga    NUMERIC,
  diskon          NUMERIC,
  diskon_promo    NUMERIC,
  total_potongan  NUMERIC,
  grand_total     NUMERIC,
  dpp             NUMERIC,
  ppn             NUMERIC,
  total_invoice   NUMERIC,
  jatuh_tempo     DATE,
  tonase          NUMERIC,
  sales           VARCHAR(100),
  status_ppn      VARCHAR(20),
  no_po           VARCHAR(100),
  tanggal_po      VARCHAR(50),
  brand           VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_penjualan_bulan     ON penjualan(bulan_tahun);
CREATE INDEX idx_penjualan_pelanggan ON penjualan(kode_pelanggan);
CREATE INDEX idx_penjualan_sales     ON penjualan(sales);
CREATE INDEX idx_penjualan_invoice   ON penjualan(no_invoice);
```

Harus muncul pesan: **Success. No rows returned.**

### Langkah 2.3 — Jalankan SQL Tabel Piutang
Klik **New query** lagi, copy-paste:

```sql
CREATE TABLE piutang (
  id                    BIGSERIAL PRIMARY KEY,
  snapshot_date         DATE NOT NULL,
  kode_pelanggan        VARCHAR(50) NOT NULL,
  nama_pelanggan        VARCHAR(200) NOT NULL,
  nama_sales            VARCHAR(100) NOT NULL,
  nomor_invoice         VARCHAR(100) NOT NULL,
  tgl_invoice           DATE,
  tgl_jatuh_tempo       DATE,
  nominal_invoice       NUMERIC,
  saldo_piutang_bulan   NUMERIC,
  sisa_piutang          NUMERIC NOT NULL,
  usia_piutang          INTEGER,
  brand_produk          VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_piutang_snapshot   ON piutang(snapshot_date);
CREATE INDEX idx_piutang_pelanggan  ON piutang(kode_pelanggan);
CREATE INDEX idx_piutang_sales      ON piutang(nama_sales);
CREATE INDEX idx_piutang_invoice    ON piutang(nomor_invoice);
```

### Langkah 2.4 — Jalankan SQL Tabel Upload Log
Klik **New query** lagi, copy-paste:

```sql
CREATE TABLE upload_log (
  id            BIGSERIAL PRIMARY KEY,
  tipe_upload   VARCHAR(20) NOT NULL,
  bulan_tahun   VARCHAR(7),
  nama_file     VARCHAR(255),
  jumlah_baris  INTEGER,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  keterangan    TEXT
);
```

### Langkah 2.5 — Nonaktifkan RLS (Row Level Security)
Karena aplikasi ini single-user tanpa auth, jalankan SQL ini:

```sql
ALTER TABLE penjualan  DISABLE ROW LEVEL SECURITY;
ALTER TABLE piutang    DISABLE ROW LEVEL SECURITY;
ALTER TABLE upload_log DISABLE ROW LEVEL SECURITY;
```

### Langkah 2.6 — Verifikasi
1. Di sidebar kiri, klik **Table Editor**
2. Pastikan muncul 3 tabel: `penjualan`, `piutang`, `upload_log`
3. Jika ada tabel yang tidak muncul, ulangi langkah SQL yang sesuai

---

## 3. Konfigurasi API Key di Code

### Langkah 3.1 — Edit File supabase-client.js
Buka file `js/supabase-client.js` menggunakan Notepad, VS Code, atau text editor apapun.

Isi saat ini:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Ganti dengan nilai dari Langkah 1.3:
```javascript
const SUPABASE_URL = 'https://abcdefghij.supabase.co';   // ← ganti ini
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5...'; // ← ganti ini
```

> **PENTING:** Jangan tambahkan tanda petik ganda di dalam string. Nilai sudah ada di dalam tanda petik.

### Langkah 3.2 — Simpan File
Tekan `Ctrl+S` untuk menyimpan file.

---

## 4. Deploy ke GitHub Pages

### Langkah 4.1 — Install Git (jika belum)
1. Download dari **https://git-scm.com/download/win**
2. Install dengan pengaturan default
3. Restart komputer jika diminta

### Langkah 4.2 — Buat Akun GitHub (jika belum)
1. Pergi ke **https://github.com**
2. Klik **Sign up** → ikuti proses pendaftaran

### Langkah 4.3 — Buat Repository Baru
1. Login ke GitHub
2. Klik tombol **+** (pojok kanan atas) → **New repository**
3. Isi:
   - **Repository name:** `cwa-ar-monitor`
   - **Visibility:** Public ✓ (harus Public untuk GitHub Pages gratis)
   - Jangan centang "Add README file"
4. Klik **Create repository**
5. Catat URL repository, contoh: `https://github.com/namakamu/cwa-ar-monitor`

### Langkah 4.4 — Upload File ke GitHub

**Cara A: Via Browser (paling mudah)**
1. Di halaman repository yang baru dibuat, klik **uploading an existing file**
2. Drag & drop SEMUA file dan folder proyek ini ke area upload
   - `index.html`
   - `penjualan.html`
   - `ar.html`
   - `upload.html`
   - folder `js/` (beserta semua file di dalamnya)
   - folder `css/` (beserta `custom.css`)
3. Scroll ke bawah, klik **Commit changes**

**Cara B: Via Git Command Line**

Buka PowerShell atau Command Prompt di folder proyek ini, jalankan:

```bash
git init
git add .
git commit -m "Initial commit: CWA AR Monitor"
git branch -M main
git remote add origin https://github.com/NAMAANDA/cwa-ar-monitor.git
git push -u origin main
```

> Ganti `NAMAANDA` dengan username GitHub Anda.
> Pertama kali push akan minta login GitHub — masukkan username & password/token.

### Langkah 4.5 — Aktifkan GitHub Pages
1. Di halaman repository, klik **Settings** (tab di bagian atas)
2. Di sidebar kiri, klik **Pages**
3. Di bagian **Source**, pilih:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Klik **Save**
5. Tunggu 1–3 menit
6. Refresh halaman — akan muncul link: `https://NAMAANDA.github.io/cwa-ar-monitor/`

### Langkah 4.6 — Akses Website
Buka browser, masuk ke URL yang diberikan GitHub Pages.
Contoh: `https://namakamu.github.io/cwa-ar-monitor/`

Jika muncul halaman Dashboard (meski data kosong), setup berhasil!

---

## 5. Test Upload Data

### Langkah 5.1 — Upload Data Penjualan
1. Buka halaman **Upload Data** di website
2. Di **Section A**, klik area upload atau drag file Excel penjualan
3. Pastikan nama sheet Excel mengandung kata `PENJUALAN` dan pola `MM.YY`
   - Contoh valid: `PENJUALAN.02.26`, `PENJUALAN.03.26`
4. Sistem akan preview data yang ditemukan
5. Klik **Upload & Simpan Penjualan**
6. Tunggu proses selesai — akan muncul notifikasi hijau jika sukses

### Langkah 5.2 — Upload Data Piutang
1. Di **Section B**, klik area upload atau drag file Excel piutang
2. Pastikan nama sheet mengandung kata `PIUTANG`
3. Preview akan menampilkan jumlah baris aktif (sisa_piutang > 0)
4. Klik **Upload & Simpan Piutang**
5. Tunggu notifikasi sukses

### Langkah 5.3 — Verifikasi di Dashboard
1. Buka halaman **Dashboard**
2. Pastikan KPI cards menampilkan angka (bukan —)
3. Chart aging dan chart per sales harus tampil
4. Top 10 Toko harus muncul

---

## 6. Troubleshooting

### Problem: Website tidak bisa load data, console error "Failed to fetch"
**Penyebab:** Supabase URL atau Anon Key salah  
**Solusi:**
1. Buka `js/supabase-client.js`
2. Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY benar
3. Tidak ada spasi ekstra, tidak ada karakter tambahan
4. Re-upload file ke GitHub dan tunggu deploy ulang

### Problem: Upload Excel error "Sheet PENJUALAN tidak ditemukan"
**Penyebab:** Nama sheet di Excel tidak mengandung kata "PENJUALAN"  
**Solusi:**
1. Buka file Excel
2. Klik kanan tab sheet → Rename
3. Ganti nama menjadi format `PENJUALAN.MM.YY` (misal: `PENJUALAN.06.26`)
4. Simpan, upload ulang

### Problem: Upload Excel error "Kolom NO INVOICE tidak ditemukan"
**Penyebab:** Header kolom tidak sesuai format  
**Solusi:**
1. Buka file Excel
2. Pastikan baris header ada kolom bernama `NO INVOICE` (persis, huruf kapital)
3. Tidak ada karakter tersembunyi atau spasi ekstra di nama kolom

### Problem: Data terupload tapi tidak muncul di dashboard
**Penyebab:** RLS (Row Level Security) masih aktif  
**Solusi:**
1. Buka Supabase Dashboard → SQL Editor
2. Jalankan SQL berikut:
```sql
ALTER TABLE penjualan  DISABLE ROW LEVEL SECURITY;
ALTER TABLE piutang    DISABLE ROW LEVEL SECURITY;
ALTER TABLE upload_log DISABLE ROW LEVEL SECURITY;
```

### Problem: Supabase project "paused" / tidak bisa connect
**Penyebab:** Supabase free tier otomatis pause jika tidak aktif 7 hari  
**Solusi:**
1. Login ke https://supabase.com
2. Buka project
3. Klik **Restore project** (tombol hijau yang muncul)
4. Tunggu 1–2 menit, coba lagi

### Problem: GitHub Pages menampilkan 404
**Penyebab:** File `index.html` tidak ada di root folder, atau Pages belum aktif  
**Solusi:**
1. Pastikan `index.html` ada di root repository (bukan di subfolder)
2. Cek Settings → Pages → Source sudah diset ke `main / root`
3. Tunggu 5 menit, coba refresh

---

## Catatan Penting

| Hal | Catatan |
|---|---|
| **Keamanan** | Anon Key aman untuk diexpose di frontend — ini memang desain Supabase. Yang JANGAN diexpose adalah Service Role Key |
| **Free Tier Supabase** | 500 MB storage, 2 GB transfer/bulan. Lebih dari cukup untuk penggunaan ini |
| **Update data** | Upload penjualan: data bulan lama akan DIGANTI. Upload piutang: semua data lama DIHAPUS dan diganti snapshot baru |
| **Backup** | Supabase free tier tidak ada point-in-time recovery. Backup manual via: Supabase Dashboard → Settings → Database → Backups |
| **Custom Domain** | Bisa setup custom domain di GitHub Pages Settings → Pages → Custom domain |

---

*Dokumen ini dibuat khusus untuk proyek CWA AR Monitor — TA Semarang Non Group (KODE AREA: TA-03)*
