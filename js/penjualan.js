// ─── PENJUALAN ────────────────────────────────────────────────────────────────

let penjData = [];
let filteredPenj = [];
let penjPage = 1;
const PENJ_PAGE_SIZE = 50;
let penjSortCol = 'tanggal';
let penjSortDir = 'desc';

const elBulan  = document.getElementById('filterBulan');
const elSales  = document.getElementById('filterSales');
const elBrand  = document.getElementById('filterBrand');
const elSearch = document.getElementById('searchPenj');

async function initPenjualan() {
  const { data: months } = await supabase
    .from('penjualan')
    .select('bulan_tahun')
    .order('bulan_tahun', { ascending: false });

  const uniqueMonths = [...new Set((months || []).map(r => r.bulan_tahun))];

  if (elBulan) {
    elBulan.innerHTML = '<option value="">Semua Bulan</option>' +
      uniqueMonths.map(m => `<option value="${m}">${namaBulan(m)}</option>`).join('');
    if (uniqueMonths.length > 0) elBulan.value = uniqueMonths[0];
  }

  await loadPenjualan();
}

async function loadPenjualan() {
  const bulan  = elBulan?.value  || '';
  const sales  = elSales?.value  || '';
  const brand  = elBrand?.value  || '';
  const search = (elSearch?.value || '').toLowerCase();

  const tbody = document.getElementById('penjTableBody');
  const cards = document.getElementById('penjCardBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-gray-400">Memuat data...</td></tr>`;
  if (cards) cards.innerHTML = `<p class="text-center text-gray-400 py-8 text-sm">Memuat data...</p>`;

  let query = supabase.from('penjualan').select('*', { count: 'exact' });

  if (bulan)  query = query.eq('bulan_tahun', bulan);
  if (sales)  query = query.eq('sales', sales);
  if (brand)  query = query.eq('brand', brand);
  if (search) {
    query = query.or(`nama_pelanggan.ilike.%${search}%,kode_pelanggan.ilike.%${search}%,no_invoice.ilike.%${search}%`);
  }

  query = query.order(penjSortCol, { ascending: penjSortDir === 'asc' })
               .range((penjPage - 1) * PENJ_PAGE_SIZE, penjPage * PENJ_PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) {
    showToast('Gagal memuat penjualan: ' + error.message, 'error');
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    return;
  }

  penjData = data || [];
  renderPenjKPI(bulan);
  renderPenjFilters(bulan);
  renderPenjTable();
  renderPenjMobileCards();
  renderPenjPagination(count || 0);
}

async function renderPenjKPI(bulan) {
  let query = supabase.from('penjualan').select('grand_total,no_invoice,tonase');
  if (bulan) query = query.eq('bulan_tahun', bulan);

  const sales = elSales?.value || '';
  const brand = elBrand?.value || '';
  if (sales) query = query.eq('sales', sales);
  if (brand) query = query.eq('brand', brand);

  const { data } = await query;
  if (!data) return;

  const totalGT      = data.reduce((s, r) => s + (parseFloat(r.grand_total) || 0), 0);
  const totalTonase  = data.reduce((s, r) => s + (parseFloat(r.tonase) || 0), 0);
  const uniqueInvoice = new Set(data.map(r => r.no_invoice)).size;

  setText('kpiGrandTotal',   formatRupiah(totalGT));
  setText('kpiInvoiceCount', uniqueInvoice.toLocaleString('id-ID'));
  setText('kpiTotalTonase',  totalTonase.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' kg');
}

async function renderPenjFilters(bulan) {
  let qS = supabase.from('penjualan').select('sales').not('sales', 'is', null);
  let qB = supabase.from('penjualan').select('brand').not('brand', 'is', null);
  if (bulan) { qS = qS.eq('bulan_tahun', bulan); qB = qB.eq('bulan_tahun', bulan); }

  const [{ data: sd }, { data: bd }] = await Promise.all([qS, qB]);

  const salesSet = [...new Set((sd || []).map(r => r.sales).filter(Boolean))].sort();
  const brandSet = [...new Set((bd || []).map(r => r.brand).filter(Boolean))].sort();

  if (elSales) {
    const cur = elSales.value;
    elSales.innerHTML = '<option value="">Semua Sales</option>' +
      salesSet.map(s => `<option value="${s}" ${s === cur ? 'selected' : ''}>${s}</option>`).join('');
  }
  if (elBrand) {
    const cur = elBrand.value;
    elBrand.innerHTML = '<option value="">Semua Brand</option>' +
      brandSet.map(b => `<option value="${b}" ${b === cur ? 'selected' : ''}>${b}</option>`).join('');
  }
}

// Color groups by invoice no
const invoiceColors = {};
const COLOR_PALETTE = ['', 'bg-blue-50', 'bg-purple-50', 'bg-amber-50', 'bg-cyan-50', 'bg-lime-50', 'bg-pink-50', 'bg-teal-50'];
const CARD_COLOR_PALETTE = ['m-card-blue', 'm-card-purple', 'm-card-teal', 'm-card-pink'];
let colorIndex = 0;

function getInvoiceColor(invoiceNo) {
  if (!invoiceNo) return '';
  if (!invoiceColors[invoiceNo]) {
    invoiceColors[invoiceNo] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    colorIndex++;
  }
  return invoiceColors[invoiceNo];
}

function getInvoiceCardColor(invoiceNo) {
  if (!invoiceNo) return 'm-card-blue';
  const idx = Object.keys(invoiceColors).indexOf(invoiceNo);
  return CARD_COLOR_PALETTE[Math.abs(idx) % CARD_COLOR_PALETTE.length];
}

// ─── DESKTOP TABLE ────────────────────────────────────────────────────────────

function renderPenjTable() {
  const tbody = document.getElementById('penjTableBody');
  if (!tbody) return;

  if (penjData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-gray-400">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = penjData.map(r => `
    <tr class="border-b text-sm ${getInvoiceColor(r.no_invoice)} hover:brightness-95">
      <td class="py-2 px-3 whitespace-nowrap">${formatTanggal(r.tanggal)}</td>
      <td class="py-2 px-3 font-mono text-xs whitespace-nowrap">${r.no_invoice || '-'}</td>
      <td class="py-2 px-3">${r.nama_pelanggan || '-'}</td>
      <td class="py-2 px-3">${r.sales || '-'}</td>
      <td class="py-2 px-3">${r.brand || '-'}</td>
      <td class="py-2 px-3 max-w-xs truncate" title="${r.nama_barang || ''}">${r.nama_barang || '-'}</td>
      <td class="py-2 px-3 text-right">${r.qty?.toLocaleString('id-ID') || '-'}</td>
      <td class="py-2 px-3 text-right">${formatRupiah(r.grand_total)}</td>
      <td class="py-2 px-3 text-right">${formatRupiah(r.total_invoice)}</td>
      <td class="py-2 px-3 whitespace-nowrap">${formatTanggal(r.jatuh_tempo)}</td>
      <td class="py-2 px-3">
        <span class="px-2 py-0.5 text-xs rounded ${r.status_ppn === 'PPN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}">${r.status_ppn || '-'}</span>
      </td>
    </tr>
  `).join('');
}

// ─── MOBILE CARDS ─────────────────────────────────────────────────────────────

function renderPenjMobileCards() {
  const container = document.getElementById('penjCardBody');
  if (!container) return;

  if (penjData.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-400 py-8 text-sm">Tidak ada data.</p>`;
    return;
  }

  container.innerHTML = penjData.map(r => {
    const cardColor = getInvoiceCardColor(r.no_invoice);
    return `
      <div class="m-card ${cardColor}">
        <div class="flex items-start justify-between mb-1.5">
          <span class="text-xs text-gray-500">${formatTanggal(r.tanggal)}</span>
          <span class="font-bold text-blue-800 text-base leading-none">${formatRupiah(r.grand_total)}</span>
        </div>
        <div class="font-semibold text-gray-900 text-base leading-tight mb-0.5">${r.nama_pelanggan || '-'}</div>
        <div class="text-xs text-gray-500 mb-2">
          ${r.sales || '-'} · <span class="font-medium">${r.brand || '-'}</span>
        </div>
        <div class="text-xs text-gray-400 truncate mb-1" title="${r.nama_barang || ''}">${r.nama_barang || '-'}</div>
        <div class="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
          <span class="font-mono">${r.no_invoice || '-'}</span>
          <span>Total inv: <span class="font-semibold text-gray-600">${formatRupiah(r.total_invoice)}</span></span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

function renderPenjPagination(totalRows) {
  const desktopEl = document.getElementById('penjPaginationDesktop');
  const mobileEl  = document.getElementById('penjPaginationMobile');

  const total = Math.ceil(totalRows / PENJ_PAGE_SIZE);
  const countText = `<span class="text-sm text-gray-500">${totalRows.toLocaleString('id-ID')} baris</span>`;

  if (total <= 1) {
    if (desktopEl) desktopEl.innerHTML = countText;
    if (mobileEl)  mobileEl.innerHTML  = countText;
    return;
  }

  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - penjPage) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  const html = `
    <div class="flex items-center gap-1 text-sm flex-wrap">
      ${countText}
      <button onclick="changePenjPage(${penjPage - 1})" ${penjPage === 1 ? 'disabled' : ''}
        class="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-100 touch-manipulation ml-2">‹</button>
      ${pages.map(p => p === '...'
        ? `<span class="px-2">…</span>`
        : `<button onclick="changePenjPage(${p})"
            class="px-3 py-1.5 rounded-lg border touch-manipulation ${p === penjPage ? 'bg-blue-700 text-white border-blue-700' : 'hover:bg-gray-100'}">${p}</button>`
      ).join('')}
      <button onclick="changePenjPage(${penjPage + 1})" ${penjPage === total ? 'disabled' : ''}
        class="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-gray-100 touch-manipulation">›</button>
    </div>
  `;

  if (desktopEl) desktopEl.innerHTML = html;
  if (mobileEl)  mobileEl.innerHTML  = html;
}

function changePenjPage(p) {
  const totalEl = document.querySelector('#penjPaginationDesktop .text-gray-500, #penjPaginationMobile .text-gray-500');
  const totalCount = parseInt((totalEl?.textContent || '').replace(/\D/g, '')) || 0;
  const total = Math.ceil(totalCount / PENJ_PAGE_SIZE);
  if (p < 1 || (total && p > total)) return;
  penjPage = p;
  loadPenjualan();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── SORT ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-sort]').forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (penjSortCol === col) penjSortDir = penjSortDir === 'asc' ? 'desc' : 'asc';
    else { penjSortCol = col; penjSortDir = 'desc'; }
    penjPage = 1;
    loadPenjualan();
  });
});

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

if (elBulan)  elBulan.addEventListener('change',  () => { penjPage = 1; loadPenjualan(); });
if (elSales)  elSales.addEventListener('change',  () => { penjPage = 1; loadPenjualan(); });
if (elBrand)  elBrand.addEventListener('change',  () => { penjPage = 1; loadPenjualan(); });
if (elSearch) elSearch.addEventListener('input', debounce(() => { penjPage = 1; loadPenjualan(); }, 400));

initPenjualan();
