// ─── DASHBOARD ────────────────────────────────────────────────────────────────

let agingChart = null;
let salesChart = null;

async function initDashboard() {
  await Promise.all([
    loadKPI(),
    loadAgingChart(),
    loadSalesChart(),
    loadTopToko(),
    loadInfoSnapshot(),
  ]);
}

// ─── KPI CARDS ────────────────────────────────────────────────────────────────

async function loadKPI() {
  const { data, error } = await supabase
    .from('piutang')
    .select('sisa_piutang,usia_piutang,brand_produk,kode_pelanggan,nomor_invoice');

  if (error || !data) return;

  const totalSisa   = data.reduce((s, r) => s + (parseFloat(r.sisa_piutang) || 0), 0);
  const tokoSet     = new Set(data.map(r => r.kode_pelanggan).filter(Boolean));
  const invoiceSet  = new Set(data.map(r => r.nomor_invoice).filter(Boolean));
  const badDebt     = data.filter(r => getAgingStatus(r.usia_piutang, r.brand_produk).label === 'BAD DEBT RISK');

  setText('kpiTotalSisa',    formatRupiah(totalSisa));
  setText('kpiInvoiceAktif', invoiceSet.size.toLocaleString('id-ID'));
  setText('kpiBadDebt',      badDebt.length.toLocaleString('id-ID'));
  setText('kpiTokoAktif',    tokoSet.size.toLocaleString('id-ID'));
}

// ─── AGING CHART ──────────────────────────────────────────────────────────────

async function loadAgingChart() {
  const { data } = await supabase
    .from('piutang')
    .select('usia_piutang,brand_produk,sisa_piutang,nomor_invoice');

  if (!data) return;

  const categories = { LANCAR: 0, PERHATIAN: 0, WARNING: 0, 'BAD DEBT RISK': 0 };
  const amounts    = { LANCAR: 0, PERHATIAN: 0, WARNING: 0, 'BAD DEBT RISK': 0 };

  for (const r of data) {
    const st = getAgingStatus(r.usia_piutang, r.brand_produk);
    categories[st.label]++;
    amounts[st.label] += parseFloat(r.sisa_piutang) || 0;
  }

  const labels = ['Lancar (0–59h)', 'Perhatian (60–69h)', 'Warning (70–89h)', 'Bad Debt (≥90h)'];
  const keys   = ['LANCAR', 'PERHATIAN', 'WARNING', 'BAD DEBT RISK'];
  const bgColors = ['#16A34A', '#CA8A04', '#EA580C', '#DC2626'];

  // Summary text
  const summaryEl = document.getElementById('agingSummary');
  if (summaryEl) {
    summaryEl.innerHTML = keys.map((k, i) => `
      <div class="flex items-center gap-2 text-sm">
        <span class="inline-block w-3 h-3 rounded-full" style="background:${bgColors[i]}"></span>
        <span class="flex-1 text-gray-700">${labels[i]}</span>
        <span class="font-semibold text-gray-900">${categories[k]} inv</span>
        <span class="text-gray-500 text-xs">${formatRupiah(amounts[k])}</span>
      </div>
    `).join('');
  }

  const ctx = document.getElementById('agingChart');
  if (!ctx) return;

  if (agingChart) agingChart.destroy();
  agingChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: keys.map(k => categories[k]),
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const k = keys[ctx.dataIndex];
              return ` ${ctx.label}: ${ctx.raw} invoice (${formatRupiah(amounts[k])})`;
            }
          }
        }
      }
    }
  });
}

// ─── SALES CHART ──────────────────────────────────────────────────────────────

async function loadSalesChart() {
  const { data } = await supabase
    .from('piutang')
    .select('nama_sales,sisa_piutang');

  if (!data) return;

  const grouped = {};
  for (const r of data) {
    const k = r.nama_sales || 'Tidak Ada';
    grouped[k] = (grouped[k] || 0) + (parseFloat(r.sisa_piutang) || 0);
  }

  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);

  const ctx = document.getElementById('salesChart');
  if (!ctx) return;

  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Sisa Piutang',
        data: values,
        backgroundColor: '#1E40AF',
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatRupiah(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: v => 'Rp ' + (v / 1e6).toFixed(1) + ' jt'
          }
        }
      }
    }
  });
}

// ─── TOP 10 TOKO ──────────────────────────────────────────────────────────────

async function loadTopToko() {
  const { data } = await supabase
    .from('piutang')
    .select('kode_pelanggan,nama_pelanggan,nama_sales,sisa_piutang,usia_piutang,brand_produk');

  if (!data) return;

  const grouped = {};
  for (const r of data) {
    const k = r.kode_pelanggan || r.nama_pelanggan;
    if (!grouped[k]) {
      grouped[k] = {
        nama: r.nama_pelanggan, sales: r.nama_sales,
        totalSisa: 0, maxAging: 0, worstBrand: r.brand_produk, worstStatus: 'LANCAR'
      };
    }
    grouped[k].totalSisa += parseFloat(r.sisa_piutang) || 0;
    if ((r.usia_piutang || 0) > grouped[k].maxAging) {
      grouped[k].maxAging  = r.usia_piutang;
      grouped[k].worstBrand = r.brand_produk;
    }
  }

  const top10 = Object.values(grouped)
    .sort((a, b) => b.totalSisa - a.totalSisa)
    .slice(0, 10)
    .map(t => {
      t.worstStatus = getAgingStatus(t.maxAging, t.worstBrand).label;
      return t;
    });

  const tbody = document.getElementById('topTokoBody');
  if (!tbody) return;

  tbody.innerHTML = top10.map((t, i) => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2 px-3 text-gray-400 text-center">${i + 1}</td>
      <td class="py-2 px-3 font-medium">${t.nama}</td>
      <td class="py-2 px-3 text-gray-600">${t.sales || '-'}</td>
      <td class="py-2 px-3 text-right font-semibold text-blue-800">${formatRupiah(t.totalSisa)}</td>
      <td class="py-2 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_CLASS[t.worstStatus]}">${t.worstStatus}</span>
      </td>
    </tr>
  `).join('');
}

const BADGE_CLASS = {
  'LANCAR':        'bg-green-100 text-green-800',
  'PERHATIAN':     'bg-yellow-100 text-yellow-800',
  'WARNING':       'bg-orange-100 text-orange-800',
  'BAD DEBT RISK': 'bg-red-100 text-red-800',
};

// ─── INFO SNAPSHOT ────────────────────────────────────────────────────────────

async function loadInfoSnapshot() {
  const { data: snapRows } = await supabase
    .from('piutang')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1);

  const { data: bulanRows } = await supabase
    .from('penjualan')
    .select('bulan_tahun')
    .order('bulan_tahun', { ascending: false });

  if (snapRows && snapRows.length > 0) {
    setText('infoSnapshotDate', formatTanggal(snapRows[0].snapshot_date));
  }

  if (bulanRows && bulanRows.length > 0) {
    const months = [...new Set(bulanRows.map(r => r.bulan_tahun))];
    const el = document.getElementById('infoBulanPenjualan');
    if (el) el.textContent = months.map(m => namaBulan(m)).join(', ');
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

initDashboard();
