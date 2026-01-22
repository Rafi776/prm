// All Members Page JS

const membersState = {
  allData: [],
  filteredData: [],
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

// Setup event listeners
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const teamFilter = document.getElementById('teamFilter');

  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      membersState.searchTerm = e.target.value.toLowerCase();
      applyFilters();
    });
  }

  if (teamFilter) {
    teamFilter.addEventListener('change', function(e) {
      membersState.teamFilter = e.target.value;
      applyFilters();
    });
  }
}

// Populate team filter
function populateTeamFilter() {
  const teams = new Set();

  membersState.allData.forEach(row => {
    const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'team' || key.toLowerCase() === 'preferred_team');
    if (teamCol && row[teamCol]) {
      teams.add(String(row[teamCol]).trim());
    }
  });

  const teamFilter = document.getElementById('teamFilter');
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
}

// Apply filters
function applyFilters() {
  const search = membersState.searchTerm.toLowerCase().trim();
  const teamFilter = membersState.teamFilter;

  membersState.filteredData = membersState.allData.filter(row => {
    // Apply team filter
    let matchesTeam = true;
    if (teamFilter) {
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'team' || key.toLowerCase() === 'preferred_team');
      if (teamCol) {
        matchesTeam = String(row[teamCol] || '').trim() === teamFilter;
      }
    }

    // Apply search filter
    let matchesSearch = true;
    if (search) {
      matchesSearch = false;
      for (const key in row) {
        if (row[key] != null) {
          if (String(row[key]).toLowerCase().includes(search)) {
            matchesSearch = true;
            break;
          }
        }
      }
    }

    return matchesTeam && matchesSearch;
  });

  renderTable();
}

// Render table
function renderTable() {
  const container = document.getElementById('tableContainer');

  if (membersState.filteredData.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }

  const allColumns = Object.keys(membersState.filteredData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo' && col !== 'created_at');

  let html = '<div class="overflow-auto bg-gray-50 rounded-lg"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-200 sticky top-0"><tr>';
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">SL. NO</th>';

  columns.forEach(col => {
    html += `<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">${escapeHtml(col)}</th>`;
  });

  html += '</tr></thead><tbody>';

  membersState.filteredData.forEach((row, index) => {
    html += '<tr class="border-b border-gray-200 hover:bg-gray-100">';
    html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">${index + 1}</td>`;

    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap">${value}</td>`;
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Download CSV
function downloadCSV() {
  if (membersState.filteredData.length === 0) {
    alert('No data to download');
    return;
  }

  const allColumns = Object.keys(membersState.filteredData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo' && col !== 'created_at');

  let csv = '"SL. NO",' + columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';

  membersState.filteredData.forEach((row, index) => {
    csv += `"${index + 1}",` + columns.map(col => {
      const val = row[col] !== null ? String(row[col]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', 'members.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess(`Downloaded members.csv (${membersState.filteredData.length} records)`);
}

// Fetch data
async function fetchData() {
  membersState.loading = true;
  showLoading();

  try {
    const { data, error } = await supabaseClient
      .from('prm_members')
      .select('*');

    if (error) throw error;

    membersState.allData = data || [];
    populateTeamFilter();
    applyFilters();

    showSuccess(`Loaded ${membersState.allData.length} members`);
  } catch (error) {
    console.error('Error fetching data:', error);
    showError('Failed to load members data: ' + error.message);
  } finally {
    membersState.loading = false;
    hideLoading();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  setupEventListeners();
  fetchData();
});
