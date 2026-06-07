function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return 'Rp 0';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

function formatTanggal(date) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return date; }
}

function getAgingStatus(usiaPiutang, brandProduk) {
  const hari = parseInt(usiaPiutang) || 0;
  const isKuasBakRoll = brandProduk &&
    brandProduk.toUpperCase().includes('KUAS') &&
    brandProduk.toUpperCase().includes('BAK ROLL');

  const badDebtThreshold = isKuasBakRoll ? 91 : 90;

  if (hari >= badDebtThreshold) return { label: 'BAD DEBT RISK', color: 'red',    class: 'status-red'    };
  if (hari >= 70)               return { label: 'WARNING',       color: 'orange',  class: 'status-orange' };
  if (hari >= 60)               return { label: 'PERHATIAN',     color: 'yellow',  class: 'status-yellow' };
  return                               { label: 'LANCAR',        color: 'green',   class: 'status-green'  };
}

function extractBulanTahun(sheetName) {
  const match = sheetName.match(/(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const bulan = match[1];
  const tahun = '20' + match[2];
  return `${tahun}-${bulan}`;
}

function namaBulan(bulanTahun) {
  if (!bulanTahun) return '-';
  const [tahun, bulan] = bulanTahun.split('-');
  const arr = ['','Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];
  return `${arr[parseInt(bulan)]} ${tahun}`;
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('id-ID');
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function showToast(message, type = 'info') {
  const colors = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    warning: 'bg-yellow-500',
    info:    'bg-blue-700'
  };
  const toast = document.createElement('div');
  toast.className = `toast-msg px-4 py-3 rounded-xl text-white text-sm shadow-lg max-w-xs ${colors[type] || colors.info} transition-all duration-300`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

function setLoading(el, loading, text = 'Loading...') {
  if (!el) return;
  if (loading) {
    el.disabled = true;
    el._origText = el.textContent;
    el.innerHTML = `<svg class="animate-spin inline w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>${text}`;
  } else {
    el.disabled = false;
    el.textContent = el._origText || text;
  }
}
