// Application Logic

// State management
const state = {
  recruitmentData: [],
  recruitmentDataFiltered: [],
  membersData: [],
  currentTab: 'recruitment',
  loading: false,
  searchTerm: '',
  teamFilter: ''
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app');
  setupEventListeners();
  switchTab('recruitment');
});

// Setup event listeners for tab switching
function setupEventListeners() {
  console.log('🔧 Setting up event listeners...');
  
  document.getElementById('recruitmentTab').addEventListener('click', () => switchTab('recruitment'));
  document.getElementById('selectedTab').addEventListener('click', () => switchTab('selected'));
  document.getElementById('failedTab').addEventListener('click', () => switchTab('failed'));
  document.getElementById('waitingTab').addEventListener('click', () => switchTab('waiting'));
  document.getElementById('membersTab').addEventListener('click', () => switchTab('members'));
  
  // Search listener
  const searchInput = document.getElementById('searchInput');
  console.log('🔍 Search input element found:', !!searchInput);
  
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      console.log('📝 Search input event:', e.target.value);
      state.searchTerm = e.target.value.toLowerCase();
      console.log('🔄 Updated search term to:', state.searchTerm);
      applyFiltersAndSearch();
    });
  } else {
    console.error('❌ Search input element NOT found!');
  }
  
  // Team filter listener
  const teamFilter = document.getElementById('teamFilter');
  console.log('🏢 Team filter element found:', !!teamFilter);
  
  if (teamFilter) {
    teamFilter.addEventListener('change', function(e) {
      console.log('📝 Team filter changed:', e.target.value);
      state.teamFilter = e.target.value;
      console.log('🔄 Updated team filter to:', state.teamFilter);
      applyFiltersAndSearch();
    });
  } else {
    console.error('❌ Team filter element NOT found!');
  }
}

// Populate team filter options with unique values from data
function populateTeamFilterOptions() {
  console.log('🏢 Populating team filter options...');
  
  const teams = new Set();
  
  state.recruitmentData.forEach(row => {
    const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
    if (teamCol && row[teamCol]) {
      teams.add(String(row[teamCol]).trim());
    }
  });
  
  const teamFilter = document.getElementById('teamFilter');
  if (teamFilter) {
    // Remove existing options except the first one
    while (teamFilter.options.length > 1) {
      teamFilter.remove(1);
    }
    
    // Add options sorted alphabetically
    Array.from(teams).sort().forEach(team => {
      const option = document.createElement('option');
      option.value = team;
      option.textContent = team;
      teamFilter.appendChild(option);
    });
    
    console.log('✅ Team filter populated with', teams.size, 'teams');
  }
}

// Render recruitment table - defined early before applyFiltersAndSearch uses it
function renderRecruitmentTable() {
  const container = document.getElementById('recruitmentTableContainer');
  
  console.log('📊 renderRecruitmentTable called');
  console.log('   Container found:', !!container);
  console.log('   Filtered data count:', state.recruitmentDataFiltered ? state.recruitmentDataFiltered.length : 0);
  
  if (!state.recruitmentDataFiltered || state.recruitmentDataFiltered.length === 0) {
    console.log('   ⚠️ No data to display');
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }
  
  // Get all columns from the first row and exclude id, photo_url, and created_at
  const allColumns = Object.keys(state.recruitmentDataFiltered[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');
  
  // Build table with responsive columns
  let html = '<div class="overflow-auto bg-gray-50 rounded-lg"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-200 sticky top-0"><tr>';
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">SL. NO</th>';
  
  columns.forEach(col => {
    html += `<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">${escapeHtml(col)}</th>`;
  });
  
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">Status</th>';
  html += '</tr></thead><tbody>';
  
  // Build table rows
  state.recruitmentDataFiltered.forEach((row, index) => {
    html += '<tr class="border-b border-gray-200 hover:bg-gray-100">';
    
    // Add serial number
    html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">${index + 1}</td>`;
    
    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap">${value}</td>`;
    });
    
    // Add status dropdown
    const statusValue = row.status || '';
    const idField = Object.keys(row).find(key => 
      key === 'id' || key === 'ID' || key.toLowerCase().includes('id')
    );
    const idValue = idField ? row[idField] : '';
    
    html += `<td class="px-3 py-2">
      <select class="status-dropdown text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              data-row-index="${index}" 
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
  
  // Attach event listeners to status dropdowns
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

// Apply search and filters
function applyFiltersAndSearch() {
  const search = state.searchTerm.toLowerCase().trim();
  const teamFilter = state.teamFilter;
  
  console.log('🔎 applyFiltersAndSearch called');
  console.log('   Search term:', search);
  console.log('   Team filter:', teamFilter);
  console.log('   Total data:', state.recruitmentData.length);
  
  if (state.recruitmentData.length === 0) {
    console.log('   ⚠️ No recruitment data available');
    state.recruitmentDataFiltered = [];
    renderRecruitmentTable();
    return;
  }
  
  // Filter records based on search and team filter
  state.recruitmentDataFiltered = state.recruitmentData.filter(row => {
    // Apply team filter
    let matchesTeam = true;
    if (teamFilter) {
      // Find the preferred_team column (case-insensitive)
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
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
  
  console.log('   ✅ Results:', state.recruitmentDataFiltered.length, 'records');
  renderRecruitmentTable();
}

// Switch between tabs
function switchTab(tab) {
  state.currentTab = tab;
  
  // Hide all content
  document.getElementById('recruitmentContent').classList.add('hidden');
  document.getElementById('selectedContent').classList.add('hidden');
  document.getElementById('failedContent').classList.add('hidden');
  document.getElementById('waitingContent').classList.add('hidden');
  document.getElementById('membersContent').classList.add('hidden');
  
  // Remove active styling from all tabs
  const tabs = ['recruitmentTab', 'selectedTab', 'failedTab', 'waitingTab', 'membersTab'];
  tabs.forEach(tabId => {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.classList.remove('border-b-2', 'border-blue-500', 'text-blue-600');
      tabEl.classList.add('text-gray-600');
    }
  });
  
  // Show selected tab and add active styling
  const activeTabEl = document.getElementById(tab + 'Tab') || document.getElementById(tab === 'members' ? 'membersTab' : tab + 'Tab');
  if (activeTabEl) {
    activeTabEl.classList.add('border-b-2', 'border-blue-500', 'text-blue-600');
    activeTabEl.classList.remove('text-gray-600');
  }
  
  // Handle each tab
  if (tab === 'recruitment') {
    document.getElementById('recruitmentContent').classList.remove('hidden');
    if (state.recruitmentData.length === 0) {
      fetchRecruitmentData();
    }
  } else if (tab === 'selected') {
    document.getElementById('selectedContent').classList.remove('hidden');
    setupStatusTabListeners('selected');
    renderStatusTable('Selected', 'selectedTableContainer');
  } else if (tab === 'failed') {
    document.getElementById('failedContent').classList.remove('hidden');
    setupStatusTabListeners('failed');
    renderStatusTable('Failed', 'failedTableContainer');
  } else if (tab === 'waiting') {
    document.getElementById('waitingContent').classList.remove('hidden');
    setupStatusTabListeners('waiting');
    renderStatusTable('Waiting', 'waitingTableContainer');
  } else if (tab === 'members') {
    document.getElementById('membersContent').classList.remove('hidden');
    if (state.membersData.length === 0) {
      fetchMembersData();
    }
  }
}

// Setup event listeners for status tab search and filters
function setupStatusTabListeners(status) {
  const searchId = 'searchInput' + status.charAt(0).toUpperCase() + status.slice(1);
  const filterId = 'teamFilter' + status.charAt(0).toUpperCase() + status.slice(1);
  
  const searchInput = document.getElementById(searchId);
  const teamFilter = document.getElementById(filterId);
  
  // Populate team filter for this status
  const statusData = state.recruitmentData.filter(row => row.status === status);
  const teams = new Set();
  statusData.forEach(row => {
    const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
    if (teamCol && row[teamCol]) {
      teams.add(String(row[teamCol]).trim());
    }
  });
  
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
  
  // Add event listeners
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      renderFilteredStatusTable(status, e.target.value.toLowerCase(), teamFilter ? teamFilter.value : '');
    });
  }
  
  if (teamFilter) {
    teamFilter.addEventListener('change', function(e) {
      renderFilteredStatusTable(status, searchInput ? searchInput.value.toLowerCase() : '', e.target.value);
    });
  }
}

// Render status table with search and filter
function renderFilteredStatusTable(status, search, team) {
  const containerMap = {
    'selected': 'selectedTableContainer',
    'failed': 'failedTableContainer',
    'waiting': 'waitingTableContainer'
  };
  
  const containerId = containerMap[status.toLowerCase()];
  
  // Filter by status
  let filtered = state.recruitmentData.filter(row => row.status === status);
  
  // Filter by team
  if (team) {
    filtered = filtered.filter(row => {
      const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
      return teamCol && String(row[teamCol] || '').trim() === team;
    });
  }
  
  // Filter by search
  if (search) {
    filtered = filtered.filter(row => {
      for (const key in row) {
        if (row[key] != null && String(row[key]).toLowerCase().includes(search)) {
          return true;
        }
      }
      return false;
    });
  }
  
  // Render the filtered data
  renderTableData(filtered, containerId);
}

// Generic table rendering function
function renderTableData(data, containerId) {
  const container = document.getElementById(containerId);
  
  if (data.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No records found</p>';
    return;
  }
  
  // Get all columns and exclude id, photo_url, and created_at
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
    
    // Add serial number
    html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">${index + 1}</td>`;
    
    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap">${value}</td>`;
    });
    
    const statusValue = row.status || '';
    const idField = Object.keys(row).find(key => 
      key === 'id' || key === 'ID' || key.toLowerCase().includes('id')
    );
    const idValue = idField ? row[idField] : '';
    
    html += `<td class="px-3 py-2">
      <select class="status-dropdown text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              data-row-id="${idValue}" 
              data-status="${statusValue}">
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
  
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

// Download CSV function
function downloadCSV(tab) {
  console.log('📥 Downloading CSV for tab:', tab);
  
  let data = [];
  let filename = '';
  
  if (tab === 'recruitment') {
    data = state.recruitmentDataFiltered;
    filename = 'recruitment_records.csv';
  } else if (tab === 'selected') {
    const search = document.getElementById('searchInputSelected')?.value.toLowerCase() || '';
    const team = document.getElementById('teamFilterSelected')?.value || '';
    data = state.recruitmentData.filter(row => {
      let matches = row.status === 'Selected';
      if (team && matches) {
        const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
        matches = teamCol && String(row[teamCol] || '').trim() === team;
      }
      if (search && matches) {
        matches = Object.values(row).some(val => String(val || '').toLowerCase().includes(search));
      }
      return matches;
    });
    filename = 'selected_candidates.csv';
  } else if (tab === 'failed') {
    const search = document.getElementById('searchInputFailed')?.value.toLowerCase() || '';
    const team = document.getElementById('teamFilterFailed')?.value || '';
    data = state.recruitmentData.filter(row => {
      let matches = row.status === 'Failed';
      if (team && matches) {
        const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
        matches = teamCol && String(row[teamCol] || '').trim() === team;
      }
      if (search && matches) {
        matches = Object.values(row).some(val => String(val || '').toLowerCase().includes(search));
      }
      return matches;
    });
    filename = 'failed_candidates.csv';
  } else if (tab === 'waiting') {
    const search = document.getElementById('searchInputWaiting')?.value.toLowerCase() || '';
    const team = document.getElementById('teamFilterWaiting')?.value || '';
    data = state.recruitmentData.filter(row => {
      let matches = row.status === 'Waiting';
      if (team && matches) {
        const teamCol = Object.keys(row).find(key => key.toLowerCase() === 'preferred_team');
        matches = teamCol && String(row[teamCol] || '').trim() === team;
      }
      if (search && matches) {
        matches = Object.values(row).some(val => String(val || '').toLowerCase().includes(search));
      }
      return matches;
    });
    filename = 'waiting_candidates.csv';
  }
  
  if (data.length === 0) {
    alert('No data to download');
    return;
  }
  
  // Convert to CSV - exclude id, photo_url, and created_at columns
  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');
  
  // Add SL. NO as first column
  let csv = '"SL. NO",' + columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';
  
  data.forEach((row, index) => {
    csv += `"${index + 1}",` + columns.map(col => {
      const val = row[col] !== null ? String(row[col]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(',') + '\n';
  });
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('✅ CSV downloaded:', filename);
  showSuccess(`Downloaded ${filename} (${data.length} records)`);
}

// Render table for status-filtered data
function renderStatusTable(status, containerId) {
  console.log(`📊 Rendering ${status} status table...`);
  
  // Filter data by status
  const filteredData = state.recruitmentData.filter(row => {
    return String(row.status || '') === status;
  });
  
  console.log(`   Found ${filteredData.length} records with status: ${status}`);
  
  const container = document.getElementById(containerId);
  
  if (filteredData.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center py-4">No records found with status: ${status}</p>`;
    return;
  }
  
  // Get all columns and exclude id, photo_url, and created_at
  const allColumns = Object.keys(filteredData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');
  
  // Build table
  let html = '<div class="overflow-auto bg-gray-50 rounded-lg"><table class="w-full text-sm">';
  html += '<thead class="bg-gray-200 sticky top-0"><tr>';
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">SL. NO</th>';
  
  columns.forEach(col => {
    html += `<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">${escapeHtml(col)}</th>`;
  });
  
  html += '<th class="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">Status</th>';
  html += '</tr></thead><tbody>';
  
  // Build table rows
  filteredData.forEach((row, index) => {
    html += '<tr class="border-b border-gray-200 hover:bg-gray-100">';
    
    // Add serial number
    html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">${index + 1}</td>`;
    
    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])).substring(0, 50) : '-';
      html += `<td class="px-3 py-2 text-gray-700 whitespace-nowrap">${value}</td>`;
    });
    
    // Add status dropdown
    const statusValue = row.status || '';
    const idField = Object.keys(row).find(key => 
      key === 'id' || key === 'ID' || key.toLowerCase().includes('id')
    );
    const idValue = idField ? row[idField] : '';
    
    html += `<td class="px-3 py-2">
      <select class="status-dropdown text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              data-row-index="${index}" 
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
  
  // Attach event listeners to status dropdowns
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

// Fetch recruitment data from Supabase
async function fetchRecruitmentData() {
  state.loading = true;
  showLoading();
  
  try {
    console.log('🔍 Fetching recruitment data from Supabase...');
    console.log('Supabase client:', supabaseClient);
    
    const { data, error } = await supabaseClient
      .from('prm_recruitment')
      .select('*');
    
    if (error) {
      console.error('❌ Supabase error:', error);
      showError('Failed to fetch data: ' + error.message);
      return;
    }
    
    console.log('✅ Data fetched successfully!');
    console.log('📊 Record count:', data ? data.length : 0);
    console.log('📋 Sample record:', data && data.length > 0 ? data[0] : 'No data');
    
    state.recruitmentData = data || [];
    console.log('📝 State updated. Total records:', state.recruitmentData.length);
    
    // Populate team filter options
    populateTeamFilterOptions();
    
    // Reset search and filters
    state.searchTerm = '';
    state.teamFilter = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    const teamFilter = document.getElementById('teamFilter');
    if (teamFilter) {
      teamFilter.value = '';
    }
    
    // Apply filters (which will show all data since filters are empty)
    applyFiltersAndSearch();
    
    showSuccess(`Loaded ${state.recruitmentData.length} recruitment records`);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    showError('An unexpected error occurred: ' + error.message);
  } finally {
    state.loading = false;
    hideLoading();
  }
}

// Fetch members data from Supabase
async function fetchMembersData() {
  state.loading = true;
  showLoading();
  
  try {
    const { data, error } = await supabaseClient
      .from('prm_members')
      .select('*');
    
    if (error) {
      console.error('Error fetching members data:', error);
      showError('Failed to fetch members data');
      return;
    }
    
    state.membersData = data || [];
    renderMembersTable();
  } catch (error) {
    console.error('Unexpected error:', error);
    showError('An unexpected error occurred');
  } finally {
    state.loading = false;
    hideLoading();
  }
}

// Render members table
function renderMembersTable() {
  const container = document.getElementById('membersTableContainer');
  
  if (state.membersData.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No member records found</p>';
    return;
  }
  
  // Get all columns and exclude id, photo_url, and created_at
  const allColumns = Object.keys(state.membersData[0]);
  const columns = allColumns.filter(col => col !== 'id' && col !== 'photo_url' && col !== 'created_at');
  
  // Build table header
  let html = '<div class="overflow-x-auto"><table class="w-full border-collapse border border-gray-300">';
  html += '<thead class="bg-gray-100"><tr>';
  html += '<th class="border border-gray-300 p-2 text-left font-semibold">SL. NO</th>';
  
  columns.forEach(col => {
    html += `<th class="border border-gray-300 p-2 text-left font-semibold">${escapeHtml(col)}</th>`;
  });
  
  html += '</tr></thead><tbody>';
  
  // Build table rows
  state.membersData.forEach((row, index) => {
    html += '<tr class="hover:bg-gray-50">';
    
    // Add serial number
    html += `<td class="border border-gray-300 p-2 font-medium">${index + 1}</td>`;
    
    columns.forEach(col => {
      const value = row[col] !== null ? escapeHtml(String(row[col])) : '-';
      html += `<td class="border border-gray-300 p-2">${value}</td>`;
    });
    
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
  
  // Attach event listeners to status dropdowns
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', handleStatusChange);
  });
}

// Handle status change
async function handleStatusChange(event) {
  const dropdown = event.target;
  const recordId = dropdown.dataset.id;
  const newStatus = dropdown.value;
  const rowIndex = dropdown.dataset.rowIndex;
  
  if (!newStatus) return;
  
  console.log('Updating status for record:', recordId, 'to:', newStatus);
  
  // Disable dropdown while updating
  dropdown.disabled = true;
  dropdown.style.opacity = '0.6';
  
  try {
    // Get the current record to find the correct ID column
    const record = state.recruitmentData[rowIndex];
    console.log('Record data:', record);
    
    // Find the primary key (usually 'id' or similar)
    const idField = Object.keys(record).find(key => 
      key === 'id' || key === 'ID' || key.toLowerCase().includes('id')
    );
    
    if (!idField || !record[idField]) {
      throw new Error('Could not identify primary key in record');
    }
    
    const idValue = record[idField];
    console.log('Using ID field:', idField, 'with value:', idValue);
    
    const { error } = await supabaseClient
      .from('prm_recruitment')
      .update({ status: newStatus })
      .eq(idField, idValue);
    
    if (error) {
      console.error('Error updating status:', error);
      showError(`Failed to update status: ${error.message}`);
      dropdown.disabled = false;
      dropdown.style.opacity = '1';
      return;
    }
    
    // Update local state
    state.recruitmentData[rowIndex].status = newStatus;
    dropdown.disabled = false;
    dropdown.style.opacity = '1';
    showSuccess(`Status updated to "${newStatus}"`);
  } catch (error) {
    console.error('Unexpected error:', error);
    showError(`Error: ${error.message}`);
    dropdown.disabled = false;
    dropdown.style.opacity = '1';
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Show loading indicator
function showLoading() {
  const loader = document.getElementById('loadingIndicator');
  if (loader) loader.classList.remove('hidden');
}

// Hide loading indicator
function hideLoading() {
  const loader = document.getElementById('loadingIndicator');
  if (loader) loader.classList.add('hidden');
}

// Show error message
function showError(message) {
  const alert = document.getElementById('errorAlert');
  if (alert) {
    alert.textContent = message;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 4000);
  }
}

// Show success message
function showSuccess(message) {
  const alert = document.getElementById('successAlert');
  if (alert) {
    alert.textContent = message;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 3000);
  }
}
