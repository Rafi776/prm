// Core Team Page JS

const coreTeamState = {
  allData: [],
  filteredData: [],
  searchTerm: '',
  positionFilter: '',
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
  const positionFilter = document.getElementById('positionFilter');

  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      coreTeamState.searchTerm = e.target.value.toLowerCase();
      applyFilters();
    });
  }

  if (positionFilter) {
    positionFilter.addEventListener('change', function(e) {
      coreTeamState.positionFilter = e.target.value;
      applyFilters();
    });
  }
}

// Populate position filter
function populatePositionFilter() {
  const positions = new Set();

  coreTeamState.allData.forEach(row => {
    const posCol = Object.keys(row).find(key => key.toLowerCase() === 'position');
    if (posCol && row[posCol]) {
      positions.add(String(row[posCol]).trim());
    }
  });

  const positionFilter = document.getElementById('positionFilter');
  if (positionFilter) {
    while (positionFilter.options.length > 1) {
      positionFilter.remove(1);
    }

    Array.from(positions).sort().forEach(position => {
      const option = document.createElement('option');
      option.value = position;
      option.textContent = position;
      positionFilter.appendChild(option);
    });
  }
}

// Apply filters
function applyFilters() {
  const search = coreTeamState.searchTerm.toLowerCase().trim();
  const positionFilter = coreTeamState.positionFilter;

  coreTeamState.filteredData = coreTeamState.allData.filter(row => {
    // Apply position filter
    let matchesPosition = true;
    if (positionFilter) {
      const posCol = Object.keys(row).find(key => key.toLowerCase() === 'position');
      if (posCol) {
        matchesPosition = String(row[posCol] || '').trim() === positionFilter;
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

    return matchesPosition && matchesSearch;
  });

  renderTable();
}

// Render table
function renderTable() {
  const container = document.getElementById('tableContainer');

  if (coreTeamState.filteredData.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }

  const allColumns = Object.keys(coreTeamState.filteredData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo' && col !== 'created_at');

  let html = '<div class="overflow-auto bg-gray-50 rounded-lg"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-200 sticky top-0"><tr>';
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">SL. NO</th>';

  columns.forEach(col => {
    html += `<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">${escapeHtml(col)}</th>`;
  });

  html += '</tr></thead><tbody>';

  coreTeamState.filteredData.forEach((row, index) => {
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
  if (coreTeamState.filteredData.length === 0) {
    alert('No data to download');
    return;
  }

  const allColumns = Object.keys(coreTeamState.filteredData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo' && col !== 'created_at');

  let csv = '"SL. NO",' + columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';

  coreTeamState.filteredData.forEach((row, index) => {
    csv += `"${index + 1}",` + columns.map(col => {
      const val = row[col] !== null ? String(row[col]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', 'core-team.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess(`Downloaded core-team.csv (${coreTeamState.filteredData.length} records)`);
}

// Fetch data - Filter for core team positions
async function fetchData() {
  coreTeamState.loading = true;
  showLoading();

  try {
    const { data, error } = await supabaseClient
      .from('prm_members')
      .select('*');

    if (error) throw error;

    // Filter for core team positions
    const corePositions = ['convener', 'joint convener', 'member secretary', 'team coordinator'];
    const filtered = (data || []).filter(row => {
      const posCol = Object.keys(row).find(key => key.toLowerCase() === 'position');
      if (!posCol) return false;
      const position = String(row[posCol] || '').toLowerCase();
      return corePositions.some(pos => position.includes(pos));
    });

    coreTeamState.allData = filtered;
    populatePositionFilter();
    applyFilters();

    showSuccess(`Loaded ${coreTeamState.allData.length} core team members`);
  } catch (error) {
    console.error('Error fetching data:', error);
    showError('Failed to load core team data: ' + error.message);
  } finally {
    coreTeamState.loading = false;
    hideLoading();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  setupEventListeners();
  fetchData();
});
