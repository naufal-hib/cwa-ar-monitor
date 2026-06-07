// Mapping kolom penjualan — handle typo & double space dari Excel source
const PENJUALAN_COL_MAP = {
  'KODE AREA':        'kode_area',
  'AREA':             'area',
  'TANGGAL':          'tanggal',
  'KODE PELANGGAN':   'kode_pelanggan',
  'NAMA PELANGAN':    'nama_pelanggan',   // typo di source Excel
  'NAMA PELANGGAN':   'nama_pelanggan',
  'NO INVOICE':       'no_invoice',
  'NO SJ':            'no_sj',
  'KODE BARANG':      'kode_barang',
  'NAMA BARANG':      'nama_barang',
  'SATUAN':           'satuan',
  'QTY (PCS)':        'qty',
  'QTY':              'qty',
  'JUMLAH HARGA':     'jumlah_harga',
  'DISKON':           'diskon',
  'DISKON PROMO':     'diskon_promo',
  'TOTAL POTONGAN':   'total_potongan',
  'GRAND TOTAL':      'grand_total',
  'DPP':              'dpp',
  'PPN':              'ppn',
  'TOTAL INVOICE':    'total_invoice',
  'JATUH TEMPO':      'jatuh_tempo',
  'TONASE':           'tonase',
  'SALES':            'sales',
  'STATUS PPN':       'status_ppn',
  'NO PO':            'no_po',
  'TANGGAL PO':       'tanggal_po',
  'BRAND':            'brand',
};

const PENJUALAN_NUMERIC = ['qty','jumlah_harga','diskon','diskon_promo','total_potongan',
                           'grand_total','dpp','total_invoice','tonase'];
const PENJUALAN_DATE    = ['tanggal','jatuh_tempo'];
const PIUTANG_NUMERIC   = ['nominal_invoice','saldo_piutang_bulan','sisa_piutang'];
const PIUTANG_DATE      = ['tgl_invoice','tgl_jatuh_tempo'];

function excelDateToISO(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    // already a string date — normalize
    const d = new Date(serial);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    return serial;
  }
  if (typeof serial === 'number') {
    const utc = (Math.floor(serial) - 25569) * 86400 * 1000;
    return new Date(utc).toISOString().split('T')[0];
  }
  if (serial instanceof Date) return serial.toISOString().split('T')[0];
  return null;
}

function findHeaderRow(rawData, keyword) {
  for (let i = 0; i < Math.min(15, rawData.length); i++) {
    const row = rawData[i];
    if (Array.isArray(row) && row.some(c => c && c.toString().toUpperCase().includes(keyword))) {
      return i;
    }
  }
  return -1;
}

function buildColIndexMap(headers, colMap, extraDetect) {
  const indexMap = {};
  const seen = {};

  headers.forEach((h, idx) => {
    if (!h) return;
    const norm = h.toString().trim().toUpperCase().replace(/\s+/g, ' ');

    // Extra detection (e.g., SALDO PIUTANG dynamic column)
    if (extraDetect && !seen['saldo_piutang_bulan'] && norm.includes('SALDO PIUTANG')) {
      indexMap[idx] = 'saldo_piutang_bulan';
      seen['saldo_piutang_bulan'] = true;
      return;
    }

    for (const [key, field] of Object.entries(colMap)) {
      const normKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
      if (normKey === norm && !seen[field]) {
        indexMap[idx] = field;
        seen[field] = true;
        break;
      }
    }
  });

  return indexMap;
}

// ─── PARSE PENJUALAN ──────────────────────────────────────────────────────────

function parsePenjualanSheet(workbook) {
  const sheetNames = workbook.SheetNames.filter(s =>
    s.toUpperCase().includes('PENJUALAN')
  );

  if (sheetNames.length === 0) {
    throw new Error('Sheet PENJUALAN tidak ditemukan. Pastikan nama sheet mengandung kata "PENJUALAN".');
  }

  const allResults = [];
  const detectedMonths = [];

  for (const sheetName of sheetNames) {
    const bulanTahun = extractBulanTahun(sheetName);
    if (!bulanTahun) continue; // skip sheets without month pattern

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

    if (!rawData || rawData.length < 3) continue; // skip empty sheets

    const headerRowIndex = findHeaderRow(rawData, 'NO INVOICE');
    if (headerRowIndex === -1) continue;

    const headers = rawData[headerRowIndex].map(h => h ? h.toString() : '');
    const colIndexMap = buildColIndexMap(headers, PENJUALAN_COL_MAP, false);

    const sheetResults = [];

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.every(cell => cell === '' || cell === null)) continue;

      const record = { bulan_tahun: bulanTahun };

      for (const [idx, field] of Object.entries(colIndexMap)) {
        let val = row[parseInt(idx)];

        if (PENJUALAN_DATE.includes(field)) {
          val = excelDateToISO(val);
        } else if (PENJUALAN_NUMERIC.includes(field)) {
          val = (val !== '' && val !== null) ? (parseFloat(val) || 0) : null;
        } else if (field === 'ppn') {
          // ppn can be text (status_ppn) — handled separately by column position
          val = (val !== '' && val !== null) ? val : null;
        } else {
          val = (val !== null && val !== '') ? val.toString().trim() : null;
        }

        if (record[field] === undefined) {
          record[field] = val;
        }
      }

      if (record.no_invoice && record.tanggal) {
        sheetResults.push(record);
      }
    }

    if (sheetResults.length > 0) {
      allResults.push(...sheetResults);
      detectedMonths.push({ bulanTahun, sheetName, count: sheetResults.length });
    }
  }

  if (allResults.length === 0) {
    throw new Error('Tidak ada data valid ditemukan di sheet PENJUALAN. Pastikan kolom NO INVOICE dan TANGGAL ada.');
  }

  return { data: allResults, months: detectedMonths };
}

// ─── PARSE PIUTANG ────────────────────────────────────────────────────────────

function parsePiutangSheet(workbook) {
  const sheetNames = workbook.SheetNames.filter(s =>
    s.toUpperCase().includes('PIUTANG')
  );

  if (sheetNames.length === 0) {
    throw new Error('Sheet PIUTANG tidak ditemukan. Pastikan nama sheet mengandung kata "PIUTANG".');
  }

  const sheetName = sheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (!rawData || rawData.length < 3) {
    throw new Error('Sheet PIUTANG kosong atau tidak memiliki cukup baris.');
  }

  const headerRowIndex = findHeaderRow(rawData, 'NOMOR INVOICE');
  if (headerRowIndex === -1) {
    throw new Error('Kolom NOMOR INVOICE tidak ditemukan di sheet PIUTANG.');
  }

  const headers = rawData[headerRowIndex].map(h => h ? h.toString() : '');
  const colIndexMap = buildColIndexMap(headers, {
    'KODE PELANGGAN':   'kode_pelanggan',
    'NAMA PELANGGAN':   'nama_pelanggan',
    'NAMA SALES':       'nama_sales',
    'NOMOR INVOICE':    'nomor_invoice',
    'TGL INVOICE':      'tgl_invoice',
    'TGL JATUH TEMPO':  'tgl_jatuh_tempo',
    'NOMINAL INVOICE':  'nominal_invoice',
    'SISA PIUTANG':     'sisa_piutang',
    'USIA PIUTANG':     'usia_piutang',
    'BRAND PRODUK':     'brand_produk',
  }, true); // true = detect SALDO PIUTANG dynamically

  const results = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every(cell => cell === '' || cell === null)) continue;

    const record = { snapshot_date: today };

    for (const [idx, field] of Object.entries(colIndexMap)) {
      let val = row[parseInt(idx)];

      if (PIUTANG_DATE.includes(field)) {
        val = excelDateToISO(val);
      } else if (PIUTANG_NUMERIC.includes(field)) {
        val = (val !== '' && val !== null) ? (parseFloat(val) || 0) : 0;
      } else if (field === 'usia_piutang') {
        val = (val !== '' && val !== null) ? (parseInt(val) || 0) : 0;
      } else {
        val = (val !== null && val !== '') ? val.toString().trim() : null;
      }

      record[field] = val;
    }

    if (record.nomor_invoice && parseFloat(record.sisa_piutang) > 0) {
      results.push(record);
    }
  }

  if (results.length === 0) {
    throw new Error('Tidak ada baris piutang aktif (sisa_piutang > 0) ditemukan.');
  }

  return { data: results, count: results.length, sheetName };
}

// ─── INSERT KE SUPABASE DALAM BATCH ──────────────────────────────────────────

async function insertInBatches(table, rows, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }
  return inserted;
}
