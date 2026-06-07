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
  // Load available months first
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

  // Show loading
  const tbody = document.getElementById('penjTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-gray-400">Memuat data...</td></tr>`;

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
  renderPenjPagination(count || 0);
}

async function renderPenjKPI(bulan) {
  let query = supabase.from('penjualan').select('grand_total,no_invoice,tonase');
  if (bulan) query = query.eq('bulan_tahun', bulan);

  const sales  = elSales?.value || '';
  const brand  = elBrand?.value || '';
  if (sales) query = query.eq('sales', sales);
  if (brand) query = query.eq('brand', brand);

  const { data } = await query;
  if (!data) return;

  const totalGT       = data.reduce((s, r) => s + (parseFloat(r.grand_total) || 0), 0);
  const totalTonase   = data.reduce((s, r) => s + (parseFloat(r.tonase) || 0), 0);
  const uniqueInvoice = new Set(data.map(r => r.no_invoice)).size;

  setText('kpiGrandTotal',    formatRupiah(totalGT));
  setText('kpiInvoiceCount',  uniqueInvoice.toLocaleString('id-ID'));
  setText('kpiTotalTonase',   totalTonase.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' kg');
}

async function renderPenjFilters(bulan) {
  // Load sales & brand options based on selected bulan
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
const COLOR_PALETTE = [
  '', 'bg-blue-50', 'bg-purple-50', 'bg-amber-50',
  'bg-cyan-50', 'bg-lime-50', 'bg-pink-50', 'bg-teal-50'
];
let colorIndex = 0;

function getInvoiceColor(invoiceNo) {
  if (!invoiceNo) return '';
  if (!invoiceColors[invoiceNo]) {
    invoiceColors[invoiceNo] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    colorIndex++;
  }
  return invoiceColors[invoiceNo];
}

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

function renderPenjPagination(totalRows) {
  const container = document.getElementById('penjPagination');
  if (!container) return;
  const total = Math.ceil(totalRows / PENJ_PAGE_SIZE);
  if (total <= 1) { container.innerHTML = `<span class="text-sm text-gray-500">${totalRows.toLocaleString('id-ID')} baris</span>`; return; }

  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - penjPage) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  container.innerHTML = `
    <div class="flex items-center gap-1 text-sm flex-wrap">
      <span class="text-gray-500 mr-2">${totalRows.toLocaleString('id-ID')} baris</span>
      <button onclick="changePenjPage(${penjPage - 1})" ${penjPage === 1 ? 'disabled' : ''}
        class="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">‹</button>
      ${pages.map(p => p === '...'
        ? `<span class="px-2">…</span>`
        : `<button onclick="changePenjPage(${p})"
            class="px-3 py-1 rounded border ${p === penjPage ? 'bg-blue-700 text-white border-blue-700' : 'hover:bg-gray-100'}">${p}</button>`
      ).join('')}
      <button onclick="changePenjPage(${penjPage + 1})" ${penjPage === total ? 'disabled' : ''}
        class="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">›</button>
    </div>
  `;
}

function changePenjPage(p) {
  const totalEstimate = parseInt(document.querySelector('#penjPagination .text-gray-500')?.textContent) || 0;
  const total = Math.ceil(totalEstimate / PENJ_PAGE_SIZE);
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
