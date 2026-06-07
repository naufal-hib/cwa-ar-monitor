# PRD — CWA AR Monitor (TA Semarang)
**Product Requirements Document**  
**Versi:** 1.0  
**Tanggal:** Juni 2026  
**Author:** Admin QC — PT Citra Warna Abadi  
**Target Eksekusi:** Claude Code  

---

## 1. Overview & Tujuan

Website berbasis **GitHub Pages + Supabase** untuk memantau:
1. **Data Penjualan** per bulan (multi-bulan, bisa update per bulan)
2. **List Piutang (AR)** aktif — invoice yang belum lunas
3. **Dashboard AR** — monitoring aging piutang per toko, per sales, dengan flag bad debt

**Scope awal:** TA Semarang Non Group (KODE AREA: TA-03)  
**User:** 1 user (Admin QC) — single user, no auth layer untuk tahap awal  
**Deployment:** GitHub Pages (static frontend) + Supabase (PostgreSQL backend)

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | HTML + Vanilla JS + TailwindCSS (CDN) |
| Excel Parser | SheetJS (xlsx library, CDN) |
| Database | Supabase (PostgreSQL, free tier) |
| Charts | Chart.js (CDN) |
| Hosting | GitHub Pages |
| Supabase Client | @supabase/supabase-js (CDN) |

> **Catatan:** Semua library via CDN — tidak perlu npm/build step. Deploy cukup push ke GitHub repo dengan GitHub Pages enabled.

---

## 3. Struktur File Project

```
/
├── index.html              ← Dashboard utama
├── penjualan.html          ← Halaman data penjualan
├── ar.html                 ← Halaman AR Monitor (piutang)
├── upload.html             ← Halaman upload Excel
├── js/
│   ├── supabase-client.js  ← Inisialisasi Supabase + config
│   ├── parser.js           ← Logic parse Excel (SheetJS)
│   ├── dashboard.js        ← Logic halaman dashboard
│   ├── penjualan.js        ← Logic halaman penjualan
│   ├── ar.js               ← Logic halaman AR monitor
│   ├── upload.js           ← Logic halaman upload
│   └── utils.js            ← Helper functions (format rupiah, tanggal, aging, dll)
├── css/
│   └── custom.css          ← Override style tambahan jika perlu
└── README.md               ← Panduan setup Supabase & deploy
```

---

## 4. Database Schema (Supabase / PostgreSQL)

### Tabel 1: `penjualan`

```sql
CREATE TABLE penjualan (
  id              BIGSERIAL PRIMARY KEY,
  bulan_tahun     VARCHAR(7) NOT NULL,        -- format: "2026-02" (YYYY-MM)
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
  status_ppn      VARCHAR(20),               -- "PPN" atau "NON PPN"
  no_po           VARCHAR(100),
  tanggal_po      VARCHAR(50),
  brand           VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_penjualan_bulan ON penjualan(bulan_tahun);
CREATE INDEX idx_penjualan_pelanggan ON penjualan(kode_pelanggan);
CREATE INDEX idx_penjualan_sales ON penjualan(sales);
CREATE INDEX idx_penjualan_invoice ON penjualan(no_invoice);
```

### Tabel 2: `piutang`

```sql
CREATE TABLE piutang (
  id                    BIGSERIAL PRIMARY KEY,
  snapshot_date         DATE NOT NULL,            -- tanggal snapshot piutang diupload
  kode_pelanggan        VARCHAR(50) NOT NULL,
  nama_pelanggan        VARCHAR(200) NOT NULL,
  nama_sales            VARCHAR(100) NOT NULL,
  nomor_invoice         VARCHAR(100) NOT NULL,
  tgl_invoice           DATE,
  tgl_jatuh_tempo       DATE,
  nominal_invoice       NUMERIC,
  saldo_piutang_bulan   NUMERIC,                  -- kolom "SALDO PIUTANG MEI 2026"
  sisa_piutang          NUMERIC NOT NULL,         -- patokan utama, 0 = lunas
  usia_piutang          INTEGER,                  -- dalam hari
  brand_produk          VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_piutang_snapshot ON piutang(snapshot_date);
CREATE INDEX idx_piutang_pelanggan ON piutang(kode_pelanggan);
CREATE INDEX idx_piutang_sales ON piutang(nama_sales);
CREATE INDEX idx_piutang_invoice ON piutang(nomor_invoice);
```

### Tabel 3: `upload_log`

```sql
CREATE TABLE upload_log (
  id            BIGSERIAL PRIMARY KEY,
  tipe_upload   VARCHAR(20) NOT NULL,     -- "PENJUALAN" atau "PIUTANG"
  bulan_tahun   VARCHAR(7),               -- untuk penjualan: "2026-02", untuk piutang: NULL
  nama_file     VARCHAR(255),
  jumlah_baris  INTEGER,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  keterangan    TEXT
);
```

### Supabase RLS (Row Level Security)
Untuk tahap awal (single user, no auth):
- **Nonaktifkan RLS** di semua tabel
- Gunakan **Supabase Anon Key** di frontend (baca + tulis)
- Batasi akses lewat **API Key** yang disimpan di `js/supabase-client.js`

> ⚠️ Catatan untuk pengembangan selanjutnya: aktifkan RLS + auth jika akan multi-user.

---

## 5. Fitur Per Halaman

---

### 5.1 Halaman: Dashboard (`index.html`)

**Tujuan:** Overview cepat kondisi AR TA Semarang

**Komponen:**

#### KPI Cards (baris atas)
| Card | Nilai |
|---|---|
| Total Sisa Piutang | Sum sisa_piutang dari snapshot terbaru |
| Jumlah Invoice Aktif | Count invoice dengan sisa_piutang > 0 |
| Invoice Bad Debt Risk | Count invoice aging ≥ 90 hari (non KUAS & BAK ROLL) ATAU ≥ 91 hari (KUAS & BAK ROLL) |
| Jumlah Toko Aktif | Count distinct kode_pelanggan di piutang aktif |

#### Aging Summary Chart (Bar/Donut Chart)
- Kategori:
  - 🟢 Lancar: 0–59 hari
  - 🟡 Perhatian: 60–69 hari
  - 🟠 Warning: 70–89 hari
  - 🔴 Bad Debt Risk: ≥ 90 hari (non KUAS & BAK ROLL) / ≥ 91 hari (KUAS & BAK ROLL)
- Tampilkan jumlah invoice dan total Rp per kategori

#### Piutang Per Sales (Bar Chart horizontal)
- Sumbu Y: nama sales
- Sumbu X: total sisa piutang (Rp)

#### Top 10 Toko Piutang Terbesar (Tabel)
- Kolom: Nama Toko, Sales, Total Sisa Piutang, Invoice Terbanyak Aging

#### Info Snapshot
- Tampilkan tanggal snapshot piutang terakhir diupload
- Tampilkan bulan-bulan penjualan yang sudah ada di database

---

### 5.2 Halaman: Upload Data (`upload.html`)

**Tujuan:** Upload file Excel → parse → simpan ke Supabase

#### Section A — Upload Penjualan

**Flow:**
1. User pilih file Excel penjualan (format nama: `PENJUALAN.MM.YY` tapi tidak wajib — sistem baca dari isi sheet)
2. Sistem deteksi otomatis nama sheet yang mengandung "PENJUALAN" (misal: `PENJUALAN.02.26`)
3. Sistem ekstrak bulan/tahun dari nama sheet → format internal `YYYY-MM`
4. Preview data: tampilkan jumlah baris, bulan yang terdeteksi, 5 baris pertama
5. Jika bulan tersebut **sudah ada** di database → tampilkan warning: _"Data penjualan [Februari 2026] sudah ada. Upload ini akan MENGHAPUS dan MENGGANTI data bulan tersebut."_
6. Tombol konfirmasi → sistem:
   - DELETE semua baris `penjualan` dengan `bulan_tahun` = bulan yang dideteksi
   - INSERT data baru
   - Catat ke `upload_log`
7. Tampilkan sukses/error

**Validasi:**
- File harus `.xlsx` atau `.xls`
- Sheet harus mengandung kolom: `NO INVOICE`, `TANGGAL`, `KODE PELANGGAN`, `TOTAL INVOICE`
- Jika kolom tidak ditemukan → error informatif

#### Section B — Upload Piutang (Snapshot)

**Flow:**
1. User pilih file Excel piutang
2. Sistem deteksi sheet yang mengandung "PIUTANG"
3. Preview: jumlah baris, tanggal snapshot (ambil dari nama sheet atau tanggal hari ini)
4. Warning: _"Upload ini akan MENGHAPUS seluruh data piutang lama dan menggantinya dengan snapshot baru."_
5. Konfirmasi → sistem:
   - DELETE seluruh tabel `piutang`
   - INSERT data baru dengan `snapshot_date` = hari ini
   - Filter: hanya simpan baris yang `sisa_piutang > 0` (yang 0 tidak perlu disimpan)
   - Catat ke `upload_log`

**Validasi:**
- Kolom wajib: `NOMOR INVOICE`, `KODE PELANGGAN`, `SISA PIUTANG`, `USIA PIUTANG`

#### Section C — Riwayat Upload
Tabel dari `upload_log`, kolom: Waktu Upload, Tipe, Bulan/Periode, Nama File, Jumlah Baris

---

### 5.3 Halaman: Penjualan (`penjualan.html`)

**Tujuan:** Lihat dan filter data penjualan per bulan

**Filter Bar:**
- Dropdown: Bulan (tampilkan semua bulan yang ada di DB)
- Dropdown: Sales
- Dropdown: Brand
- Input search: Nama Toko / Kode Pelanggan / No Invoice

**KPI Cards (sesuai filter aktif):**
- Total Grand Total
- Total Invoice (count distinct no_invoice)
- Total Tonase

**Tabel Penjualan:**

| Kolom | Sumber |
|---|---|
| Tanggal | tanggal |
| No Invoice | no_invoice |
| Nama Toko | nama_pelanggan |
| Sales | sales |
| Brand | brand |
| Nama Barang | nama_barang |
| QTY | qty |
| Grand Total | grand_total (format Rp) |
| Total Invoice | total_invoice (format Rp) |
| Jatuh Tempo | jatuh_tempo |
| Status PPN | status_ppn |

- Paginasi: 50 baris per halaman
- Sort: klik header kolom
- Highlight baris: satu warna per invoice (karena 1 invoice bisa banyak baris/barang)

---

### 5.4 Halaman: AR Monitor (`ar.html`)

**Tujuan:** Pemantauan piutang aktif dengan sistem aging

**Filter Bar:**
- Dropdown: Sales
- Dropdown: Brand Produk
- Dropdown: Status Aging (Semua / Lancar / Perhatian / Warning / Bad Debt Risk)
- Input search: Nama Toko / Kode Pelanggan / No Invoice
- Toggle: Tampilkan hanya Bad Debt Risk

**KPI Cards:**
- Total Sisa Piutang (sesuai filter)
- Jumlah Invoice
- Jumlah Toko
- Total Bad Debt Risk (Rp)

---

#### Aturan Aging & Warna (PENTING)

```
Untuk semua brand KECUALI "KUAS & BAK ROLL":
  0  – 59 hari  → 🟢 LANCAR      (hijau)
  60 – 69 hari  → 🟡 PERHATIAN   (kuning)
  70 – 89 hari  → 🟠 WARNING     (oranye)
  ≥ 90 hari     → 🔴 BAD DEBT RISK (merah)

Untuk brand "KUAS & BAK ROLL":
  0  – 59 hari  → 🟢 LANCAR      (hijau)
  60 – 69 hari  → 🟡 PERHATIAN   (kuning)
  70 – 89 hari  → 🟠 WARNING     (oranye)
  ≥ 91 hari     → 🔴 BAD DEBT RISK (merah)
  (Termin 90 hari, jadi 91+ hari baru dianggap telat)
```

> ⚠️ Kolom `usia_piutang` yang dipakai adalah dari data sheet PIUTANG (sudah dihitung). Jika ingin recalculate: `usia_piutang = TODAY() - tgl_invoice` (dalam hari).

---

#### Tabel AR

| Kolom | Sumber | Keterangan |
|---|---|---|
| Status | Computed | Badge warna (LANCAR/PERHATIAN/WARNING/BAD DEBT) |
| Usia (hari) | usia_piutang | Angka, bold jika ≥ 60 |
| No Invoice | nomor_invoice | |
| Tgl Invoice | tgl_invoice | |
| Jatuh Tempo | tgl_jatuh_tempo | |
| Nama Toko | nama_pelanggan | |
| Sales | nama_sales | |
| Brand | brand_produk | |
| Nominal Invoice | nominal_invoice | Format Rp |
| Sisa Piutang | sisa_piutang | Format Rp, bold merah jika bad debt |

- Default sort: `usia_piutang` DESC (terlama di atas)
- Paginasi: 50 baris per halaman
- Row color: sesuai kategori aging (background subtle)

---

#### Ringkasan Per Toko (Accordion/Collapsed Table)

Tampilkan setelah tabel utama, grouped by `kode_pelanggan`:

| Nama Toko | Sales | Jumlah Invoice | Total Sisa Piutang | Status Terparah |
|---|---|---|---|---|

Klik nama toko → expand, tampilkan list invoice toko tersebut

---

#### Ringkasan Per Sales

Tabel summary:

| Sales | Jumlah Invoice | Total Sisa Piutang | Invoice Bad Debt |
|---|---|---|---|

---

## 6. Navigasi & Layout

**Navbar (semua halaman):**
```
[Logo CWA] | Dashboard | Penjualan | AR Monitor | Upload Data
```

**Responsive:** Desktop-first, minimal mobile support (cukup bisa dibaca di tablet)

**Color scheme:** Profesional, clean — putih/abu dengan aksen biru PT CWA
- Primary: `#1E40AF` (biru gelap)
- Success/Lancar: `#16A34A` (hijau)
- Warning-1: `#CA8A04` (kuning)
- Warning-2: `#EA580C` (oranye)
- Danger/Bad Debt: `#DC2626` (merah)

---

## 7. Logic Penting — Parser Excel

File: `js/parser.js`

### Parse Sheet Penjualan

```javascript
// Deteksi sheet penjualan
const sheetNames = workbook.SheetNames.filter(s => s.toUpperCase().includes('PENJUALAN'));

// Mapping kolom (by header name, bukan by index)
const PENJUALAN_COL_MAP = {
  'KODE AREA':        'kode_area',
  'AREA':             'area',
  'TANGGAL':          'tanggal',
  'KODE PELANGGAN':   'kode_pelanggan',   // ambil kolom pertama (col A)
  'NAMA PELANGAN':    'nama_pelanggan',   // typo di source: PELANGAN bukan PELANGGAN
  'NO INVOICE':       'no_invoice',
  'NO SJ':            'no_sj',
  'KODE  BARANG':     'kode_barang',      // ada double space di source
  'NAMA BARANG':      'nama_barang',
  'SATUAN':           'satuan',
  'QTY (PCS)':        'qty',
  'JUMLAH HARGA':     'jumlah_harga',
  'DISKON':           'diskon',
  'DISKON PROMO ':    'diskon_promo',     // ada trailing space di source
  'TOTAL POTONGAN':   'total_potongan',
  'GRAND TOTAL':      'grand_total',
  'DPP':              'dpp',
  'PPN':              'ppn',
  'TOTAL INVOICE':    'total_invoice',
  'JATUH TEMPO':      'jatuh_tempo',
  'TONASE':           'tonase',
  'SALES':            'sales',            // kolom ke-24 (index 24)
  'NO PO':            'no_po',
  'TANGGAL PO':       'tanggal_po',
  'BRAND':            'brand',
};

// Catatan: Ada kolom duplikat KODE PELANGGAN dan TANGGAL (kolom 22 & 23)
// Pakai kolom PERTAMA saja (index 3 dan 2)
// Kolom PPN di index 25 = status_ppn ("PPN" atau "NON PPN") — beda dengan kolom PPN nominal (index 17)
```

### Parse Sheet Piutang

```javascript
const PIUTANG_COL_MAP = {
  'KODE PELANGGAN':         'kode_pelanggan',
  'NAMA PELANGGAN':         'nama_pelanggan',
  'NAMA SALES':             'nama_sales',
  'NOMOR INVOICE':          'nomor_invoice',
  'TGL INVOICE':            'tgl_invoice',
  'TGL JATUH TEMPO':        'tgl_jatuh_tempo',
  'NOMINAL INVOICE':        'nominal_invoice',
  'SALDO PIUTANG MEI 2026': 'saldo_piutang_bulan',  // nama kolom berubah tiap bulan!
  'SISA PIUTANG':           'sisa_piutang',
  'USIA PIUTANG':           'usia_piutang',
  'BRAND PRODUK':           'brand_produk',
};

// PENTING: Kolom "SALDO PIUTANG ..." namanya berubah tiap bulan (MEI 2026, JUNI 2026, dll)
// Deteksi dengan: headers.find(h => h && h.toString().toUpperCase().includes('SALDO PIUTANG'))

// Filter: hanya insert baris yang sisa_piutang > 0
```

---

## 8. Fungsi Utility Penting

File: `js/utils.js`

```javascript
// Format Rupiah
function formatRupiah(angka) {
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

// Format Tanggal Indonesia
function formatTanggal(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Hitung Aging Status
function getAgingStatus(usiaPiutang, brandProduk) {
  const hari = parseInt(usiaPiutang);
  const isKuasBakRoll = brandProduk && 
    brandProduk.toUpperCase().includes('KUAS') && 
    brandProduk.toUpperCase().includes('BAK ROLL');
  
  const badDebtThreshold = isKuasBakRoll ? 91 : 90;
  
  if (hari >= badDebtThreshold) return { label: 'BAD DEBT RISK', color: 'red',    class: 'status-red'    };
  if (hari >= 70)               return { label: 'WARNING',       color: 'orange',  class: 'status-orange' };
  if (hari >= 60)               return { label: 'PERHATIAN',     color: 'yellow',  class: 'status-yellow' };
  return                               { label: 'LANCAR',        color: 'green',   class: 'status-green'  };
}

// Ekstrak bulan-tahun dari nama sheet (misal "PENJUALAN.02.26" → "2026-02")
function extractBulanTahun(sheetName) {
  const match = sheetName.match(/(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const bulan = match[1];
  const tahun = '20' + match[2];
  return `${tahun}-${bulan}`;
}

// Nama bulan Indonesia
function namaBulan(bulanTahun) {
  const [tahun, bulan] = bulanTahun.split('-');
  const namaBulanArr = ['', 'Januari','Februari','Maret','April','Mei','Juni',
                            'Juli','Agustus','September','Oktober','November','Desember'];
  return `${namaBulanArr[parseInt(bulan)]} ${tahun}`;
}
```

---

## 9. Setup & Deployment Instructions (untuk README.md)

### Step 1: Buat Project Supabase
1. Daftar/login di [supabase.com](https://supabase.com)
2. Buat project baru (pilih region: Singapore)
3. Masuk ke **SQL Editor** → jalankan SQL schema dari Section 4 di atas
4. Ambil **Project URL** dan **Anon Public Key** dari Settings → API

### Step 2: Konfigurasi di Code
Edit file `js/supabase-client.js`:
```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJxxxxxxxxxxxx...';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Step 3: Deploy ke GitHub Pages
1. Push seluruh folder ke GitHub repo (misal: `cwa-ar-monitor`)
2. Settings → Pages → Source: **main branch, root folder**
3. Akses via: `https://[username].github.io/cwa-ar-monitor/`

---

## 10. Batasan & Catatan Pengembangan

| Hal | Catatan |
|---|---|
| Auth | Belum ada login — untuk pengembangan selanjutnya tambah Supabase Auth |
| Multi-user | Belum didukung — jika nanti multi-user, aktifkan RLS |
| Hapus data lama | Manual: bisa lewat Supabase dashboard, filter by `bulan_tahun` |
| Sheet PENJUALAN.03.26 | Kosong di sample data — sistem skip sheet kosong otomatis |
| Nama kolom "NAMA PELANGAN" | Typo di Excel source (bukan PELANGGAN) — parser sudah handle |
| Kolom "SALDO PIUTANG" | Nama berubah tiap bulan — parser detect by keyword bukan exact name |
| Kode duplikat di penjualan | Kolom KODE PELANGGAN & TANGGAL muncul 2x — pakai kolom index pertama |
| Data Maret 2026 | Sheet ada tapi kosong — sistem skip, tidak error |
| Supabase free tier pause | Jika project tidak aktif 7 hari → di-pause. Resume manual di dashboard Supabase |

---

## 11. Prioritas Pengembangan (MVP → Full)

### MVP (Phase 1) — Wajib Ada
- [ ] Setup Supabase + schema
- [ ] Halaman Upload (parse & simpan penjualan + piutang)
- [ ] Halaman AR Monitor (tabel + aging + filter)
- [ ] Dashboard (KPI cards + aging chart)
- [ ] Deploy GitHub Pages

### Phase 2 — Nice to Have
- [ ] Halaman Penjualan (tabel + filter bulan)
- [ ] Ringkasan per Toko (accordion)
- [ ] Export tabel AR ke Excel/CSV
- [ ] Notifikasi visual jika ada invoice baru masuk bad debt

### Phase 3 — Pengembangan Lanjutan
- [ ] Login auth (Supabase Auth)
- [ ] Multi-user dengan role
- [ ] Hapus data bulan lama otomatis (misal > 12 bulan)
- [ ] Kirim notifikasi email/WA untuk bad debt

---

*Dokumen ini adalah acuan lengkap untuk eksekusi oleh Claude Code.*  
*Semua keputusan arsitektur, skema database, dan logic sudah dikonfirmasi dengan user.*
