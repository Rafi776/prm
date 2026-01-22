// Recruitment Page JS

const recruitmentState = {
  allData: [],
  filteredData: [],
  currentTab: 'recruitment',
  searchTerm: '',
  teamFilter: '',
  loading: false
};

// Helper: Get Tailwind classes for status colors
function getStatusClass(status) {
  switch (status) {
    case 'Selected':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Waiting':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

// Helper functions
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showLoading() {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) indicator.classList.remove('hidden');
}

function hideLoading() {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) indicator.classList.add('hidden');
}

function showError(message) {
  const alert = document.getElementById('errorAlert');
  if (alert) {
    alert.textContent = message;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 5000);
  }
}

function showSuccess(message) {
  const alert = document.getElementById('successAlert');
  if (alert) {
    alert.textContent = message;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 5000);
  }
}

// Setup menu
function setupMenuEventListeners() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (!menuToggle) return;

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    menuOverlay.classList.toggle('hidden');
  });

  menuOverlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    menuOverlay.classList.add('hidden');
  });
}

// Setup tab listeners
function setupTabListeners() {
  document.getElementById('recruitmentTab').addEventListener('click', () => switchTab('recruitment'));
  document.getElementById('selectedTab').addEventListener('click', () => switchTab('selected'));
  document.getElementById('failedTab').addEventListener('click', () => switchTab('failed'));
  document.getElementById('waitingTab').addEventListener('click', () => switchTab('waiting'));
}

// Switch tab
function switchTab(tab) {
  recruitmentState.currentTab = tab;

  document.getElementById('recruitmentContent').classList.add('hidden');
  document.getElementById('selectedContent').classList.add('hidden');
  document.getElementById('failedContent').classList.add('hidden');
  document.getElementById('waitingContent').classList.add('hidden');

  const tabs = ['recruitmentTab', 'selectedTab', 'failedTab', 'waitingTab'];
  tabs.forEach(tabId => {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.classList.remove('border-b-2', 'border-blue-500', 'text-blue-600');
      tabEl.classList.add('text-gray-600');
    }
  });

  const contentMap = { 'recruitment': 'recruitmentContent', 'selected': 'selectedContent', 'failed': 'failedContent', 'waiting': 'waitingContent' };
  const tabMap = { 'recruitment': 'recruitmentTab', 'selected': 'selectedTab', 'failed': 'failedTab', 'waiting': 'waitingTab' };

  if (contentMap[tab]) document.getElementById(contentMap[tab]).classList.remove('hidden');
  if (tabMap[tab]) {
    const tabEl = document.getElementById(tabMap[tab]);
    tabEl.classList.add('border-b-2', 'border-blue-500', 'text-blue-600');
    tabEl.classList.remove('text-gray-600');
  }

  setupTabEventListeners(tab);
  renderFilteredData(tab);
}

function setupTabEventListeners(tab) {
  const searchInputId = tab === 'recruitment' ? 'searchInput' : `searchInput${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
  const teamFilterId = tab === 'recruitment' ? 'teamFilter' : `teamFilter${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

  const searchInput = document.getElementById(searchInputId);
  const teamFilter = document.getElementById(teamFilterId);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => renderFilteredData(tab, e.target.value.toLowerCase(), teamFilter ? teamFilter.value : ''));
  }

  if (teamFilter) {
    teamFilter.addEventListener('change', (e) => renderFilteredData(tab, searchInput ? searchInput.value.toLowerCase() : '', e.target.value));
  }
}

function populateTeamFilters() {
  const tabs = ['recruitment', 'selected', 'failed', 'waiting'];
  const teams = new Set();

  recruitmentState.allData.forEach(row => {
    const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
    if (teamCol && row[teamCol]) teams.add(String(row[teamCol]).trim());
  });

  tabs.forEach(tab => {
    const filterId = tab === 'recruitment' ? 'teamFilter' : `teamFilter${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    const teamFilter = document.getElementById(filterId);
    if (teamFilter) {
      while (teamFilter.options.length > 1) teamFilter.remove(1);
      Array.from(teams).sort().forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
      });
    }
  });
}

function renderFilteredData(tab, searchTerm = '', teamFilter = '') {
  let filtered = recruitmentState.allData;

  if (tab !== 'recruitment') {
    filtered = filtered.filter(row => row.status === tab.charAt(0).toUpperCase() + tab.slice(1));
  }

  if (teamFilter) {
    filtered = filtered.filter(row => {
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
      return teamCol && String(row[teamCol] || '').trim() === teamFilter;
    });
  }

  if (searchTerm) {
    filtered = filtered.filter(row => Object.values(row).some(val => val != null && String(val).toLowerCase().includes(searchTerm)));
  }

  renderTable(filtered, tab);
}

function renderTable(data, tab) {
  const containerId = tab === 'recruitment' ? 'recruitmentTableContainer' : `${tab}TableContainer`;
  const container = document.getElementById(containerId);

  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }

  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at' && col !== 'status');

  let html = '<div class="overflow-auto bg-white rounded-lg border border-gray-100"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-50 border-b border-gray-200 sticky top-0"><tr>';
  html += '<th class="px-4 py-3 text-left font-bold text-gray-700">SL. NO</th>';

  columns.forEach(col => {
    html += `<th class="px-4 py-3 text-left font-bold text-gray-700 whitespace-nowrap">${escapeHtml(col.replace(/_/g, ' ').toUpperCase())}</th>`;
  });

  html += '<th class="px-4 py-3 text-left font-bold text-gray-700">STATUS</th>';
  html += '</tr></thead><tbody class="divide-y divide-gray-100">';

  data.forEach((row, index) => {
    const statusValue = row.status || '';
    const idValue = row.id || '';
    const colorClasses = getStatusClass(statusValue);

    html += `<tr class="hover:bg-gray-50 transition-colors">`;
    html += `<td class="px-4 py-3 text-gray-500 font-medium">${index + 1}</td>`;

    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-4 py-3 text-gray-700">${value}</td>`;
    });

    html += `<td class="px-4 py-3">
      <select class="status-dropdown text-xs font-bold px-3 py-1.5 border rounded-full transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500 ${colorClasses}" 
              data-id="${idValue}">
        <option value="NULL" ${!statusValue ? 'selected' : ''}>Not Set</option>
        <option value="Waiting" ${statusValue === 'Waiting' ? 'selected' : ''}>Waiting</option>
        <option value="Selected" ${statusValue === 'Selected' ? 'selected' : ''}>Selected</option>
        <option value="Failed" ${statusValue === 'Failed' ? 'selected' : ''}>Failed</option>
      </select>
    </td></tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

async function handleStatusChange(event) {
  const dropdown = event.target;
  const recordId = dropdown.dataset.id;
  let newStatus = dropdown.value;

  // Change UI color immediately for "Modern" feel
  dropdown.className = `status-dropdown text-xs font-bold px-3 py-1.5 border rounded-full transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500 ${getStatusClass(newStatus === 'NULL' ? '' : newStatus)}`;

  dropdown.disabled = true;
  dropdown.style.opacity = '0.6';

  // Logic: "NULL" string from dropdown means we send a real null to the DB
  const updateValue = newStatus === 'NULL' ? null : newStatus;

  try {
    const { error } = await supabaseClient
      .from('prm_recruitment')
      .update({ status: updateValue })
      .eq('id', recordId);

    if (error) throw error;

    const record = recruitmentState.allData.find(r => r.id == recordId);
    if (record) record.status = updateValue;

    showSuccess(`Status updated to ${newStatus === 'NULL' ? 'Not Set' : newStatus}`);
  } catch (error) {
    showError('Error updating status: ' + error.message);
  } finally {
    dropdown.disabled = false;
    dropdown.style.opacity = '1';
    // If we are in a specific tab, re-render to remove the row if it no longer matches the tab
    if (recruitmentState.currentTab !== 'recruitment') {
        renderFilteredData(recruitmentState.currentTab);
    }
  }
}

function downloadCSV(tab) {
  // ... (Existing CSV logic is fine, it will use the updated recruitmentState.allData)
  // Ensure the filtered logic remains robust
  let data = recruitmentState.allData;
  if (tab !== 'recruitment') data = data.filter(row => row.status === tab.charAt(0).toUpperCase() + tab.slice(1));
  
  if (data.length === 0) { alert('No data to download'); return; }

  const columns = Object.keys(data[0]).filter(col => !['id', 'photo_url', 'created_at'].includes(col));
  let csv = columns.join(',') + '\n';
  data.forEach(row => {
    csv += columns.map(col => `"${String(row[col] || '').replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `recruitment_${tab}.csv`);
  a.click();
}

async function fetchData() {
  recruitmentState.loading = true;
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('prm_recruitment').select('*');
    if (error) throw error;
    recruitmentState.allData = data || [];
    populateTeamFilters();
    switchTab('recruitment');
  } catch (error) {
    showError('Failed to load recruitment data: ' + error.message);
  } finally {
    recruitmentState.loading = false;
    hideLoading();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  setupTabListeners();
  fetchData();
});