// Recruitment Page JS

const recruitmentState = {
  allData: [],
  filteredData: [],
  currentTab: 'recruitment',
  searchTerm: '',
  teamFilter: '',
  loading: false
};

// Helper functions
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
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

  // Hide all content
  document.getElementById('recruitmentContent').classList.add('hidden');
  document.getElementById('selectedContent').classList.add('hidden');
  document.getElementById('failedContent').classList.add('hidden');
  document.getElementById('waitingContent').classList.add('hidden');

  // Remove active styling
  const tabs = ['recruitmentTab', 'selectedTab', 'failedTab', 'waitingTab'];
  tabs.forEach(tabId => {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.classList.remove('border-b-2', 'border-blue-500', 'text-blue-600');
      tabEl.classList.add('text-gray-600');
    }
  });

  // Show selected tab
  const contentMap = {
    'recruitment': 'recruitmentContent',
    'selected': 'selectedContent',
    'failed': 'failedContent',
    'waiting': 'waitingContent'
  };

  const tabMap = {
    'recruitment': 'recruitmentTab',
    'selected': 'selectedTab',
    'failed': 'failedTab',
    'waiting': 'waitingTab'
  };

  const contentId = contentMap[tab];
  const tabId = tabMap[tab];

  if (contentId) document.getElementById(contentId).classList.remove('hidden');
  if (tabId) {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.classList.add('border-b-2', 'border-blue-500', 'text-blue-600');
      tabEl.classList.remove('text-gray-600');
    }
  }

  setupTabEventListeners(tab);
  renderFilteredData(tab);
}

// Setup event listeners for tabs
function setupTabEventListeners(tab) {
  const searchInputId = tab === 'recruitment' ? 'searchInput' : `searchInput${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
  const teamFilterId = tab === 'recruitment' ? 'teamFilter' : `teamFilter${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

  const searchInput = document.getElementById(searchInputId);
  const teamFilter = document.getElementById(teamFilterId);

  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      renderFilteredData(tab, e.target.value.toLowerCase(), teamFilter ? teamFilter.value : '');
    });
  }

  if (teamFilter) {
    teamFilter.addEventListener('change', function(e) {
      renderFilteredData(tab, searchInput ? searchInput.value.toLowerCase() : '', e.target.value);
    });
  }
}

// Populate team filters
function populateTeamFilters() {
  const tabs = ['recruitment', 'selected', 'failed', 'waiting'];
  const teams = new Set();

  recruitmentState.allData.forEach(row => {
    const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
    if (teamCol && row[teamCol]) {
      teams.add(String(row[teamCol]).trim());
    }
  });

  tabs.forEach(tab => {
    const filterId = tab === 'recruitment' ? 'teamFilter' : `teamFilter${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    const teamFilter = document.getElementById(filterId);

    if (teamFilter) {
      while (teamFilter.options.length > 1) {
        teamFilter.remove(1);
      }

      Array.from(teams).sort().forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
      });
    }
  });
}

// Render filtered data
function renderFilteredData(tab, searchTerm = '', teamFilter = '') {
  let filtered = recruitmentState.allData;

  // Filter by status
  if (tab !== 'recruitment') {
    filtered = filtered.filter(row => row.status === tab.charAt(0).toUpperCase() + tab.slice(1));
  }

  // Filter by team
  if (teamFilter) {
    filtered = filtered.filter(row => {
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
      return teamCol && String(row[teamCol] || '').trim() === teamFilter;
    });
  }

  // Filter by search
  if (searchTerm) {
    filtered = filtered.filter(row => {
      for (const key in row) {
        if (row[key] != null && String(row[key]).toLowerCase().includes(searchTerm)) {
          return true;
        }
      }
      return false;
    });
  }

  renderTable(filtered, tab);
}

// Render table
function renderTable(data, tab) {
  const containerId = tab === 'recruitment' ? 'recruitmentTableContainer' : `${tab}TableContainer`;
  const container = document.getElementById(containerId);

  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }

  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');

  let html = '<div class="overflow-auto bg-gray-50 rounded-lg"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-200 sticky top-0"><tr>';
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">SL. NO</th>';

  columns.forEach(col => {
    html += `<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">${escapeHtml(col)}</th>`;
  });

  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">Status</th>';
  html += '</tr></thead><tbody>';

  data.forEach((row, index) => {
    html += '<tr class="border-b border-gray-200 hover:bg-gray-100">';
    html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">${index + 1}</td>`;

    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap">${value}</td>`;
    });

    const statusValue = row.status || '';
    const idField = Object.keys(row).find(key => key === 'id' || key === 'ID' || key.toLowerCase().includes('id'));
    const idValue = idField ? row[idField] : '';

    html += `<td class="px-3 py-2">
      <select class="status-dropdown text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              data-id="${idValue}">
        <option value="">Select</option>
        <option value="Waiting" ${statusValue === 'Waiting' ? 'selected' : ''}>Waiting</option>
        <option value="Selected" ${statusValue === 'Selected' ? 'selected' : ''}>Selected</option>
        <option value="Failed" ${statusValue === 'Failed' ? 'selected' : ''}>Failed</option>
      </select>
    </td>`;

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Attach event listeners to dropdowns
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

// Handle status change
async function handleStatusChange(event) {
  const dropdown = event.target;
  const recordId = dropdown.dataset.id;
  const newStatus = dropdown.value;

  if (!newStatus) return;

  dropdown.disabled = true;
  dropdown.style.opacity = '0.6';

  try {
    const { error } = await supabaseClient
      .from('prm_recruitment')
      .update({ status: newStatus })
      .eq('id', recordId);

    if (error) {
      showError(`Failed to update status: ${error.message}`);
      dropdown.disabled = false;
      dropdown.style.opacity = '1';
      return;
    }

    // Update local state
    const record = recruitmentState.allData.find(r => r.id === recordId);
    if (record) {
      record.status = newStatus;
    }

    dropdown.disabled = false;
    dropdown.style.opacity = '1';
    showSuccess('Status updated successfully');
  } catch (error) {
    showError('Error updating status: ' + error.message);
    dropdown.disabled = false;
    dropdown.style.opacity = '1';
  }
}

// Download CSV
function downloadCSV(tab) {
  const searchInputId = tab === 'recruitment' ? 'searchInput' : `searchInput${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
  const teamFilterId = tab === 'recruitment' ? 'teamFilter' : `teamFilter${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

  const searchTerm = document.getElementById(searchInputId)?.value.toLowerCase() || '';
  const teamFilter = document.getElementById(teamFilterId)?.value || '';

  let data = recruitmentState.allData;

  if (tab !== 'recruitment') {
    data = data.filter(row => row.status === tab.charAt(0).toUpperCase() + tab.slice(1));
  }

  if (teamFilter) {
    data = data.filter(row => {
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
      return teamCol && String(row[teamCol] || '').trim() === teamFilter;
    });
  }

  if (searchTerm) {
    data = data.filter(row => {
      for (const key in row) {
        if (row[key] != null && String(row[key]).toLowerCase().includes(searchTerm)) {
          return true;
        }
      }
      return false;
    });
  }

  if (data.length === 0) {
    alert('No data to download');
    return;
  }

  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');

  let csv = '"SL. NO",' + columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';

  data.forEach((row, index) => {
    csv += `"${index + 1}",` + columns.map(col => {
      const val = row[col] !== null ? String(row[col]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', `recruitment_${tab}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess(`Downloaded recruitment_${tab}.csv (${data.length} records)`);
}

// Fetch data
async function fetchData() {
  recruitmentState.loading = true;
  showLoading();

  try {
    const { data, error } = await supabaseClient
      .from('prm_recruitment')
      .select('*');

    if (error) throw error;

    recruitmentState.allData = data || [];
    populateTeamFilters();
    switchTab('recruitment');

    showSuccess(`Loaded ${recruitmentState.allData.length} recruitment records`);
  } catch (error) {
    console.error('Error fetching data:', error);
    showError('Failed to load recruitment data: ' + error.message);
  } finally {
    recruitmentState.loading = false;
    hideLoading();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  setupTabListeners();
  fetchData();
});
