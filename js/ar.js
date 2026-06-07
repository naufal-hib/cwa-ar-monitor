// ─── AR MONITOR ───────────────────────────────────────────────────────────────

let arData = [];
let filteredData = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let sortCol = 'usia_piutang';
let sortDir = 'desc';

const elFilterSales  = document.getElementById('filterSales');
const elFilterBrand  = document.getElementById('filterBrand');
const elFilterAging  = document.getElementById('filterAging');
const elSearch       = document.getElementById('searchAR');
const elBadDebtOnly  = document.getElementById('badDebtOnly');
const elTableBody    = document.getElementById('arTableBody');
const elCardBody     = document.getElementById('arCardBody');
const elPagination   = document.getElementById('arPagination');
const elSnapshotDate = document.getElementById('snapshotDate');

async function initAR() {
  const { data, error } = await supabase
    .from('piutang')
    .select('*')
    .order('usia_piutang', { ascending: false });

  if (error) {
    showToast('Gagal memuat data AR: ' + error.message, 'error');
    return;
  }

  arData = data || [];

  if (arData.length > 0 && arData[0].snapshot_date) {
    if (elSnapshotDate) elSnapshotDate.textContent = formatTanggal(arData[0].snapshot_date);
  }

  populateFilters();
  applyFilters();
}

function populateFilters() {
  const salesSet = [...new Set(arData.map(r => r.nama_sales).filter(Boolean))].sort();
  const brandSet = [...new Set(arData.map(r => r.brand_produk).filter(Boolean))].sort();

  if (elFilterSales) {
    elFilterSales.innerHTML = '<option value="">Semua Sales</option>' +
      salesSet.map(s => `<option value="${s}">${s}</option>`).join('');
  }
  if (elFilterBrand) {
    elFilterBrand.innerHTML = '<option value="">Semua Brand</option>' +
      brandSet.map(b => `<option value="${b}">${b}</option>`).join('');
  }
}

function applyFilters() {
  const sales   = elFilterSales?.value || '';
  const brand   = elFilterBrand?.value || '';
  const aging   = elFilterAging?.value || '';
  const search  = (elSearch?.value || '').toLowerCase();
  const badOnly = elBadDebtOnly?.checked || false;

  filteredData = arData.filter(r => {
    if (sales && r.nama_sales !== sales) return false;
    if (brand && r.brand_produk !== brand) return false;

    const status = getAgingStatus(r.usia_piutang, r.brand_produk);
    if (aging && status.label !== aging) return false;
    if (badOnly && status.label !== 'BAD DEBT RISK') return false;

    if (search) {
      const hay = `${r.nama_pelanggan} ${r.kode_pelanggan} ${r.nomor_invoice}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  sortData();
  currentPage = 1;
  renderKPI();
  renderTable();
  renderMobileCards();
  renderPagination();
  renderSummaryToko();
  renderSummarySales();
}

function sortData() {
  filteredData.sort((a, b) => {
    let va = a[sortCol] ?? '';
    let vb = b[sortCol] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderKPI() {
  const totalSisa    = filteredData.reduce((s, r) => s + (parseFloat(r.sisa_piutang) || 0), 0);
  const badDebtRows  = filteredData.filter(r => getAgingStatus(r.usia_piutang, r.brand_produk).label === 'BAD DEBT RISK');
  const totalBadDebt = badDebtRows.reduce((s, r) => s + (parseFloat(r.sisa_piutang) || 0), 0);
  const tokoSet      = new Set(filteredData.map(r => r.kode_pelanggan).filter(Boolean));

  setText('kpiTotalSisa',    formatRupiah(totalSisa));
  setText('kpiJmlInvoice',   filteredData.length.toLocaleString('id-ID'));
  setText('kpiJmlToko',      tokoSet.size.toLocaleString('id-ID'));
  setText('kpiBadDebt',      formatRupiah(totalBadDebt));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

const AGING_BG = {
  'LANCAR':        'bg-green-50',
  'PERHATIAN':     'bg-yellow-50',
  'WARNING':       'bg-orange-50',
  'BAD DEBT RISK': 'bg-red-50',
};

const BADGE_CLASS = {
  'LANCAR':        'bg-green-100 text-green-800',
  'PERHATIAN':     'bg-yellow-100 text-yellow-800',
  'WARNING':       'bg-orange-100 text-orange-800',
  'BAD DEBT RISK': 'bg-red-100 text-red-800',
};

const CARD_BORDER = {
  'LANCAR':        'm-card-green',
  'PERHATIAN':     'm-card-yellow',
  'WARNING':       'm-card-orange',
  'BAD DEBT RISK': 'm-card-red',
};

// ─── DESKTOP TABLE ────────────────────────────────────────────────────────────

function renderTable() {
  if (!elTableBody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const rows  = filteredData.slice(start, start + PAGE_SIZE);

  if (rows.length === 0) {
    elTableBody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-400">Tidak ada data.</td></tr>`;
    return;
  }

  elTableBody.innerHTML = rows.map(r => {
    const st    = getAgingStatus(r.usia_piutang, r.brand_produk);
    const bg    = AGING_BG[st.label] || '';
    const isBad = st.label === 'BAD DEBT RISK';
    return `
      <tr class="border-b ${bg} hover:brightness-95 text-sm">
        <td class="py-2 px-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_CLASS[st.label]}">${st.label}</span>
        </td>
        <td class="py-2 px-3 text-center font-${r.usia_piutang >= 60 ? 'bold' : 'normal'}">${r.usia_piutang ?? '-'}</td>
        <td class="py-2 px-3 whitespace-nowrap font-mono text-xs">${r.nomor_invoice || '-'}</td>
        <td class="py-2 px-3 whitespace-nowrap">${formatTanggal(r.tgl_invoice)}</td>
        <td class="py-2 px-3 whitespace-nowrap">${formatTanggal(r.tgl_jatuh_tempo)}</td>
        <td class="py-2 px-3">${r.nama_pelanggan || '-'}</td>
        <td class="py-2 px-3">${r.nama_sales || '-'}</td>
        <td class="py-2 px-3">${r.brand_produk || '-'}</td>
        <td class="py-2 px-3 text-right">${formatRupiah(r.nominal_invoice)}</td>
        <td class="py-2 px-3 text-right font-semibold ${isBad ? 'text-red-700' : ''}">${formatRupiah(r.sisa_piutang)}</td>
      </tr>
    `;
  }).join('');
}

// ─── MOBILE CARDS ─────────────────────────────────────────────────────────────

function renderMobileCards() {
  if (!elCardBody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const rows  = filteredData.slice(start, start + PAGE_SIZE);

  if (rows.length === 0) {
    elCardBody.innerHTML = `<p class="text-center text-gray-400 py-8 text-sm">Tidak ada data.</p>`;
    return;
  }

  elCardBody.innerHTML = rows.map(r => {
    const st    = getAgingStatus(r.usia_piutang, r.brand_produk);
    const isBad = st.label === 'BAD DEBT RISK';
    const border = CARD_BORDER[st.label] || '';
    return `
      <div class="m-card ${border}">
        <div class="flex items-start justify-between mb-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${BADGE_CLASS[st.label]}">${st.label}</span>
          <span class="text-xl font-bold ${isBad ? 'text-red-600' : 'text-gray-700'} leading-none">${r.usia_piutang ?? '-'} <span class="text-sm font-normal text-gray-400">hari</span></span>
        </div>
        <div class="font-semibold text-gray-900 text-base leading-tight mb-0.5">${r.nama_pelanggan || '-'}</div>
        <div class="text-xs text-gray-400 mb-2">${r.kode_pelanggan || ''}</div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xs text-gray-500 space-y-0.5">
            <div>${r.nama_sales || '-'} · <span class="font-medium">${r.brand_produk || '-'}</span></div>
            <div class="font-mono text-gray-400">${r.nomor_invoice || '-'}</div>
            <div>Jatuh tempo: ${formatTanggal(r.tgl_jatuh_tempo)}</div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-xs text-gray-400">Sisa Piutang</div>
            <div class="font-bold text-base ${isBad ? 'text-red-700' : 'text-blue-800'}">${formatRupiah(r.sisa_piutang)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

function renderPagination() {
  if (!elPagination) return;
  const total = Math.ceil(filteredData.length / PAGE_SIZE);
  if (total <= 1) {
    elPagination.innerHTML = `<div class="text-sm text-gray-500 px-1">${filteredData.length.toLocaleString('id-ID')} baris</div>`;
    return;
  }

  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - currentPage) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  elPagination.innerHTML = `
    <div class="flex items-center gap-1 text-sm flex-wrap px-1">
      <span class="text-gray-500 mr-2">${filteredData.length.toLocaleString('id-ID')} baris</span>
      <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
        class="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-100 touch-manipulation">‹</button>
      ${pages.map(p => p === '...'
        ? `<span class="px-2">…</span>`
        : `<button onclick="changePage(${p})"
            class="px-3 py-1.5 rounded-lg border touch-manipulation ${p === currentPage ? 'bg-blue-700 text-white border-blue-700' : 'hover:bg-gray-100'}">${p}</button>`
      ).join('')}
      <button onclick="changePage(${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}
        class="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-100 touch-manipulation">›</button>
    </div>
  `;
}

function changePage(p) {
  const total = Math.ceil(filteredData.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderTable();
  renderMobileCards();
  renderPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── SORT ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-sort]').forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'desc'; }
    document.querySelectorAll('[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    sortData();
    currentPage = 1;
    renderTable();
    renderMobileCards();
    renderPagination();
  });
});

// ─── RINGKASAN PER TOKO ───────────────────────────────────────────────────────

function renderSummaryToko() {
  const container = document.getElementById('summaryToko');
  if (!container) return;

  const grouped = {};
  for (const r of filteredData) {
    const key = r.kode_pelanggan || r.nama_pelanggan;
    if (!grouped[key]) {
      grouped[key] = {
        nama: r.nama_pelanggan, kode: r.kode_pelanggan,
        sales: r.nama_sales, invoices: [], totalSisa: 0, worstStatus: 'LANCAR'
      };
    }
    grouped[key].invoices.push(r);
    grouped[key].totalSisa += parseFloat(r.sisa_piutang) || 0;

    const st   = getAgingStatus(r.usia_piutang, r.brand_produk);
    const rank = ['LANCAR', 'PERHATIAN', 'WARNING', 'BAD DEBT RISK'];
    if (rank.indexOf(st.label) > rank.indexOf(grouped[key].worstStatus)) {
      grouped[key].worstStatus = st.label;
    }
  }

  const sorted = Object.values(grouped).sort((a, b) => b.totalSisa - a.totalSisa);

  if (sorted.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm">Tidak ada data.</p>';
    return;
  }

  container.innerHTML = sorted.map((t, i) => `
    <div class="border rounded-xl overflow-hidden mb-2">
      <button onclick="toggleToko('toko-${i}')"
        class="w-full px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-800 text-sm leading-tight truncate">${t.nama}</div>
            <div class="text-xs text-gray-500 mt-0.5">${t.sales || ''} · ${t.invoices.length} invoice</div>
          </div>
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${BADGE_CLASS[t.worstStatus]}">${t.worstStatus}</span>
            <span class="font-bold text-blue-800 text-sm">${formatRupiah(t.totalSisa)}</span>
          </div>
          <svg class="w-4 h-4 text-gray-400 self-center flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>
      <div id="toko-${i}" class="hidden border-t">
        <div class="overflow-x-auto">
          <table class="w-full text-xs" style="min-width:460px">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-2 px-3 text-left">No Invoice</th>
                <th class="py-2 px-3 text-left">Tgl Invoice</th>
                <th class="py-2 px-3 text-left">Brand</th>
                <th class="py-2 px-3 text-center">Usia</th>
                <th class="py-2 px-3 text-left">Status</th>
                <th class="py-2 px-3 text-right">Sisa Piutang</th>
              </tr>
            </thead>
            <tbody>
              ${t.invoices.map(inv => {
                const st = getAgingStatus(inv.usia_piutang, inv.brand_produk);
                return `<tr class="border-t ${AGING_BG[st.label]}">
                  <td class="py-1.5 px-3 font-mono">${inv.nomor_invoice || '-'}</td>
                  <td class="py-1.5 px-3 whitespace-nowrap">${formatTanggal(inv.tgl_invoice)}</td>
                  <td class="py-1.5 px-3">${inv.brand_produk || '-'}</td>
                  <td class="py-1.5 px-3 text-center font-${inv.usia_piutang >= 60 ? 'bold' : 'normal'}">${inv.usia_piutang ?? '-'}</td>
                  <td class="py-1.5 px-3"><span class="px-1.5 py-0.5 rounded text-xs ${BADGE_CLASS[st.label]}">${st.label}</span></td>
                  <td class="py-1.5 px-3 text-right font-semibold ${st.label === 'BAD DEBT RISK' ? 'text-red-700' : ''}">${formatRupiah(inv.sisa_piutang)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleToko(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}

// ─── RINGKASAN PER SALES ──────────────────────────────────────────────────────

function renderSummarySales() {
  const tbody = document.getElementById('summarySalesBody');
  if (!tbody) return;

  const grouped = {};
  for (const r of filteredData) {
    const key = r.nama_sales || 'Tidak Ada';
    if (!grouped[key]) grouped[key] = { invoices: 0, totalSisa: 0, badDebt: 0 };
    grouped[key].invoices++;
    grouped[key].totalSisa += parseFloat(r.sisa_piutang) || 0;
    if (getAgingStatus(r.usia_piutang, r.brand_produk).label === 'BAD DEBT RISK') {
      grouped[key].badDebt++;
    }
  }

  const sorted = Object.entries(grouped).sort((a, b) => b[1].totalSisa - a[1].totalSisa);

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-400">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(([sales, d]) => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2.5 px-3 font-medium">
        <div>${sales}</div>
        <div class="text-xs text-gray-500 sm:hidden">${d.badDebt > 0 ? `<span class="text-red-600 font-semibold">${d.badDebt} Bad Debt</span>` : ''}</div>
      </td>
      <td class="py-2.5 px-3 text-center">${d.invoices.toLocaleString('id-ID')}</td>
      <td class="py-2.5 px-3 text-right font-semibold">${formatRupiah(d.totalSisa)}</td>
      <td class="py-2.5 px-3 text-center hide-mobile ${d.badDebt > 0 ? 'text-red-700 font-bold' : ''}">${d.badDebt || '-'}</td>
    </tr>
  `).join('');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

[elFilterSales, elFilterBrand, elFilterAging, elBadDebtOnly].forEach(el => {
  if (el) el.addEventListener('change', applyFilters);
});
if (elSearch) elSearch.addEventListener('input', debounce(applyFilters, 300));

initAR();
