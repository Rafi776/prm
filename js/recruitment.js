// Recruitment Page JS (DEPLOYMENT SAFE)

const recruitmentState = {
  allData: [],
  filteredData: [],
  currentTab: 'recruitment',
  searchTerm: '',
  teamFilter: '',
  loading: false
};

// Helper: Status color
function getStatusClass(status) {
  switch (status) {
    case 'Selected':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Waiting':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'In Progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function setActiveTab(tab) {
  ['recruitment','selected','inProgress','failed','waiting'].forEach(t => {
    const btn = document.getElementById(`${t}Tab`);
    if (!btn) return;
    btn.classList.remove('active', 'text-blue-600', 'shadow-sm', 'bg-white');
    btn.classList.add('text-gray-600');
  });

  const activeBtn = document.getElementById(`${tab}Tab`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'text-blue-600');
    activeBtn.classList.remove('text-gray-600');
  }
}


// Escape HTML
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

// Alerts
function showLoading() {
  document.getElementById('loadingIndicator')?.classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingIndicator')?.classList.add('hidden');
}
function showError(msg) {
  const el = document.getElementById('errorAlert');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}
function showSuccess(msg) {
  const el = document.getElementById('successAlert');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Menu (unchanged)
function setupMenuEventListeners() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menuOverlay');

  if (!menuToggle) return;

  menuToggle.onclick = () => {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  };
  overlay.onclick = () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };
}

// Tabs
function setupTabListeners() {
  document.getElementById('recruitmentTab').onclick = () => switchTab('recruitment');
  document.getElementById('selectedTab').onclick = () => switchTab('selected');
  document.getElementById('inProgressTab').onclick = () => switchTab('inProgress');
  document.getElementById('failedTab').onclick = () => switchTab('failed');
  document.getElementById('waitingTab').onclick = () => switchTab('waiting');
}

function switchTab(tab) {
  recruitmentState.currentTab = tab;

  ['recruitment','selected','inProgress','failed','waiting'].forEach(t => {
    document.getElementById(`${t}Content`)?.classList.add('hidden');
  });
  document.getElementById(`${tab}Content`)?.classList.remove('hidden');

  setActiveTab(tab);
  renderFilteredData(tab);
}

// Populate team filter
function populateTeamFilters() {
  const teams = new Set();

  recruitmentState.allData.forEach(row => {
    const key = Object.keys(row).find(k => k.toLowerCase() === 'preferred_team');
    if (key && row[key]) teams.add(String(row[key]).trim());
  });

  const filter = document.getElementById('teamFilter');
  if (!filter) return;

  while (filter.options.length > 1) filter.remove(1);
  [...teams].sort().forEach(team => {
    const opt = document.createElement('option');
    opt.value = team;
    opt.textContent = team;
    filter.appendChild(opt);
  });
}

// Filtering
function renderFilteredData(tab) {
  let data = recruitmentState.allData;

  if (tab !== 'recruitment') {
    const statusMap = {
      'selected': 'Selected',
      'inProgress': 'In Progress',
      'failed': 'Failed',
      'waiting': 'Waiting'
    };
    data = data.filter(r => r.status === statusMap[tab]);
  }

  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const team = document.getElementById('teamFilter')?.value || '';

  if (team) {
    data = data.filter(row => {
      const key = Object.keys(row).find(k => k.toLowerCase() === 'preferred_team');
      return key && String(row[key]).trim() === team;
    });
  }

  if (search) {
    data = data.filter(row =>
      Object.values(row).some(v =>
        v !== null && String(v).toLowerCase().includes(search)
      )
    );
  }

  renderTable(data, tab);
}

// ✅ TABLE RENDER (PHOTO SAFE, NO DESIGN BREAK)
function renderTable(data, tab) {
  const containerId = tab === 'recruitment'
    ? 'recruitmentTableContainer'
    : `${tab}TableContainer`;

  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<p class="text-center text-gray-500 py-6">No records found</p>';
    return;
  }

  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(
    c => !['id','created_at','status'].includes(c)
  );

  // Photo first (safe)
  columns.sort((a, b) => (a === 'photo_url' ? -1 : b === 'photo_url' ? 1 : 0));

  let html = `
  <div class="overflow-auto bg-white rounded-lg border border-gray-100">
  <table class="w-full text-sm">
    <thead class="bg-gray-50 border-b">
      <tr>
        <th class="px-4 py-3 text-left">SL</th>`;

  columns.forEach(col => {
    html += `<th class="px-4 py-3 text-left">${escapeHtml(col.replace(/_/g,' ').toUpperCase())}</th>`;
  });

  html += `<th class="px-4 py-3 text-left">STATUS</th></tr></thead><tbody>`;

  data.forEach((row, i) => {
    // We use JSON.stringify to pass the row data and escape quotes to prevent breaking the HTML attribute
html += `<tr onclick='window.showPRMModal(${JSON.stringify(row).replace(/'/g, "&#39;")})' class="hover:bg-blue-50 cursor-pointer transition-colors">`;
    html += `<td class="px-4 py-3 text-gray-500">${i + 1}</td>`;

    columns.forEach(col => {
      let value = '-';

      if (col === 'photo_url' && row[col]) {
        value = `
          <img src="${escapeHtml(row[col])}"
               class="w-10 h-10 rounded-full object-cover border"
               loading="lazy"
               onerror="this.src='https://via.placeholder.com/40?text=NA'">
        `;
      } else if (row[col] !== null) {
        value = escapeHtml(String(row[col])).substring(0, 50);
      }

      html += `<td class="px-4 py-3 text-gray-700">${value}</td>`;
    });

    html += `
      <td class="px-4 py-3">
        <select class="status-dropdown text-xs font-bold px-3 py-1.5 border rounded-full ${getStatusClass(row.status)}"
                data-id="${row.id}">
          <option value="NULL" ${!row.status ? 'selected' : ''}>Not Set</option>
          <option value="Waiting" ${row.status==='Waiting'?'selected':''}>Waiting</option>
          <option value="In Progress" ${row.status==='In Progress'?'selected':''}>In Progress</option>
          <option value="Selected" ${row.status==='Selected'?'selected':''}>Selected</option>
          <option value="Failed" ${row.status==='Failed'?'selected':''}>Failed</option>
        </select>
      </td></tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.onchange = handleStatusChange;
  });

  
}

// Status update (unchanged)
async function handleStatusChange(e) {
  const dropdown = e.target;
  const id = dropdown.dataset.id;
  const value = dropdown.value === 'NULL' ? null : dropdown.value;

  dropdown.disabled = true;

  try {
    const { error } = await supabaseClient
      .from('prm_recruitment')
      .update({ status: value })
      .eq('id', id);

    if (error) throw error;

    const rec = recruitmentState.allData.find(r => r.id == id);
    if (rec) rec.status = value;

    showSuccess('Status updated');
    if (recruitmentState.currentTab !== 'recruitment') {
      renderFilteredData(recruitmentState.currentTab);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    dropdown.disabled = false;
  }
}

// CSV (unchanged)
function downloadCSV(tab) {
  let data = recruitmentState.allData;
  if (tab !== 'recruitment') {
    const statusMap = {
      'selected': 'Selected',
      'inProgress': 'In Progress',
      'failed': 'Failed',
      'waiting': 'Waiting'
    };
    data = data.filter(r => r.status === statusMap[tab]);
  }
  if (!data.length) return alert('No data');

  const cols = Object.keys(data[0]).filter(c => !['id','created_at'].includes(c));
  let csv = cols.join(',') + '\n';

  data.forEach(r => {
    csv += cols.map(c => `"${String(r[c]||'').replace(/"/g,'""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recruitment_${tab}.csv`;
  a.click();
}

// Fetch
async function fetchData() {
  showLoading();
  try {
    const { data, error } = await supabaseClient
      .from('prm_recruitment')
      .select('*');
    if (error) throw error;
    recruitmentState.allData = data || [];
    populateTeamFilters();
    switchTab('recruitment');
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  setupTabListeners();
  document.getElementById('searchInput')?.addEventListener('input', () =>
    renderFilteredData(recruitmentState.currentTab)
  );
  document.getElementById('teamFilter')?.addEventListener('change', () =>
    renderFilteredData(recruitmentState.currentTab)
  );
  fetchData();
});
