// ─── UPLOAD PENJUALAN ─────────────────────────────────────────────────────────

let parsedPenjualan = null;
let parsedPiutang   = null;

const elPenjFile    = document.getElementById('penjFile');
const elPenjPreview = document.getElementById('penjPreview');
const elPenjInfo    = document.getElementById('penjInfo');
const elPenjBtn     = document.getElementById('btnUploadPenj');

const elPiuFile    = document.getElementById('piuFile');
const elPiuPreview = document.getElementById('piuPreview');
const elPiuInfo    = document.getElementById('piuInfo');
const elPiuBtn     = document.getElementById('btnUploadPiu');

// --- Penjualan File Change ---
elPenjFile.addEventListener('change', async (e) => {
  parsedPenjualan = null;
  elPenjPreview.classList.add('hidden');
  elPenjBtn.disabled = true;

  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('File harus berformat .xlsx atau .xls', 'error');
    return;
  }

  elPenjInfo.innerHTML = `<div class="text-blue-700 text-sm">Membaca file...</div>`;
  elPenjPreview.classList.remove('hidden');

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: false });
    const result = parsePenjualanSheet(workbook);
    parsedPenjualan = result;

    // Check existing months in DB
    const monthList = result.months.map(m => m.bulanTahun);
    const { data: existing } = await supabase
      .from('penjualan')
      .select('bulan_tahun')
      .in('bulan_tahun', monthList)
      .limit(1);

    const existingMonths = existing && existing.length > 0
      ? [...new Set(existing.map(r => r.bulan_tahun))]
      : [];

    let html = `<div class="space-y-2">`;
    for (const m of result.months) {
      const isExisting = existingMonths.includes(m.bulanTahun);
      html += `<div class="flex items-start gap-2 text-sm">
        <span class="font-semibold w-36">${namaBulan(m.bulanTahun)}</span>
        <span class="text-gray-600">${m.count.toLocaleString('id-ID')} baris</span>
        ${isExisting ? `<span class="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">⚠ Data bulan ini sudah ada — akan ditimpa</span>` : '<span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Baru</span>'}
      </div>`;
    }
    html += `</div>`;
    html += `<div class="mt-3 text-xs text-gray-500">Total: ${result.data.length.toLocaleString('id-ID')} baris dari ${result.months.length} sheet</div>`;

    if (existingMonths.length > 0) {
      html += `<div class="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
        ⚠ Upload ini akan <strong>MENGHAPUS dan MENGGANTI</strong> data untuk bulan:
        ${existingMonths.map(m => namaBulan(m)).join(', ')}
      </div>`;
    }

    elPenjInfo.innerHTML = html;
    elPenjBtn.disabled = false;

  } catch (err) {
    elPenjInfo.innerHTML = `<div class="text-red-600 text-sm">Error: ${err.message}</div>`;
    elPenjBtn.disabled = true;
  }
});

// --- Upload Penjualan ---
elPenjBtn.addEventListener('click', async () => {
  if (!parsedPenjualan) return;
  setLoading(elPenjBtn, true, 'Mengupload...');

  try {
    const monthList = parsedPenjualan.months.map(m => m.bulanTahun);

    // Delete existing data for those months
    for (const bulan of monthList) {
      const { error } = await supabase.from('penjualan').delete().eq('bulan_tahun', bulan);
      if (error) throw error;
    }

    // Insert new data
    const inserted = await insertInBatches('penjualan', parsedPenjualan.data);

    // Log upload
    for (const m of parsedPenjualan.months) {
      await supabase.from('upload_log').insert({
        tipe_upload: 'PENJUALAN',
        bulan_tahun: m.bulanTahun,
        nama_file: elPenjFile.files[0]?.name || '-',
        jumlah_baris: m.count,
        keterangan: 'Upload via web'
      });
    }

    showToast(`Berhasil upload ${inserted.toLocaleString('id-ID')} baris penjualan`, 'success');
    elPenjInfo.innerHTML += `<div class="mt-2 text-green-700 text-sm font-medium">✓ Upload berhasil: ${inserted.toLocaleString('id-ID')} baris disimpan</div>`;
    elPenjFile.value = '';
    parsedPenjualan = null;
    elPenjBtn.disabled = true;
    loadUploadLog();

  } catch (err) {
    showToast('Error upload: ' + err.message, 'error');
    elPenjInfo.innerHTML += `<div class="mt-2 text-red-600 text-sm">Error: ${err.message}</div>`;
  } finally {
    setLoading(elPenjBtn, false, 'Upload & Simpan Penjualan');
  }
});

// ─── UPLOAD PIUTANG ───────────────────────────────────────────────────────────

elPiuFile.addEventListener('change', async (e) => {
  parsedPiutang = null;
  elPiuPreview.classList.add('hidden');
  elPiuBtn.disabled = true;

  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('File harus berformat .xlsx atau .xls', 'error');
    return;
  }

  elPiuInfo.innerHTML = `<div class="text-blue-700 text-sm">Membaca file...</div>`;
  elPiuPreview.classList.remove('hidden');

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: false });
    const result = parsePiutangSheet(workbook);
    parsedPiutang = result;

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    elPiuInfo.innerHTML = `
      <div class="space-y-1 text-sm">
        <div><span class="font-medium">Sheet:</span> ${result.sheetName}</div>
        <div><span class="font-medium">Baris aktif (sisa_piutang > 0):</span> ${result.count.toLocaleString('id-ID')}</div>
        <div><span class="font-medium">Tanggal snapshot:</span> ${today}</div>
      </div>
      <div class="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
        ⚠ Upload ini akan <strong>MENGHAPUS seluruh data piutang lama</strong> dan menggantinya dengan snapshot baru.
      </div>
    `;
    elPiuBtn.disabled = false;
    elPiuPreview.classList.remove('hidden');

  } catch (err) {
    elPiuInfo.innerHTML = `<div class="text-red-600 text-sm">Error: ${err.message}</div>`;
    elPiuPreview.classList.remove('hidden');
    elPiuBtn.disabled = true;
  }
});

elPiuBtn.addEventListener('click', async () => {
  if (!parsedPiutang) return;
  setLoading(elPiuBtn, true, 'Mengupload...');

  try {
    // Delete ALL existing piutang
    const { error: delErr } = await supabase.from('piutang').delete().gte('id', 0);
    if (delErr) throw delErr;

    // Insert new
    const inserted = await insertInBatches('piutang', parsedPiutang.data);

    // Log
    await supabase.from('upload_log').insert({
      tipe_upload: 'PIUTANG',
      bulan_tahun: null,
      nama_file: elPiuFile.files[0]?.name || '-',
      jumlah_baris: inserted,
      keterangan: `Snapshot ${new Date().toLocaleDateString('id-ID')}`
    });

    showToast(`Berhasil upload ${inserted.toLocaleString('id-ID')} baris piutang`, 'success');
    elPiuInfo.innerHTML += `<div class="mt-2 text-green-700 text-sm font-medium">✓ Upload berhasil: ${inserted.toLocaleString('id-ID')} baris disimpan</div>`;
    elPiuFile.value = '';
    parsedPiutang = null;
    elPiuBtn.disabled = true;
    loadUploadLog();

  } catch (err) {
    showToast('Error upload: ' + err.message, 'error');
    elPiuInfo.innerHTML += `<div class="mt-2 text-red-600 text-sm">Error: ${err.message}</div>`;
  } finally {
    setLoading(elPiuBtn, false, 'Upload & Simpan Piutang');
  }
});

// ─── RIWAYAT UPLOAD ───────────────────────────────────────────────────────────

async function loadUploadLog() {
  const tbody = document.getElementById('logTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400">Memuat...</td></tr>`;

  const { data, error } = await supabase
    .from('upload_log')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400">Belum ada riwayat upload.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2 px-3 whitespace-nowrap">${formatTanggal(r.uploaded_at?.split('T')[0])} ${r.uploaded_at?.split('T')[1]?.slice(0,5) || ''}</td>
      <td class="py-2 px-3">
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${r.tipe_upload === 'PENJUALAN' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
          ${r.tipe_upload}
        </span>
      </td>
      <td class="py-2 px-3">${r.bulan_tahun ? namaBulan(r.bulan_tahun) : 'Snapshot'}</td>
      <td class="py-2 px-3 text-gray-600 truncate max-w-xs">${r.nama_file || '-'}</td>
      <td class="py-2 px-3 text-right">${r.jumlah_baris?.toLocaleString('id-ID') || '-'}</td>
    </tr>
  `).join('');
}

loadUploadLog();
