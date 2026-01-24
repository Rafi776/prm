const membersState = {
  allData: [],
  filteredData: [],
  searchTerm: '',
  teamFilter: '',
  loading: false
};

// Helper: Convert Google Drive link to direct image
function getDriveImage(url, size = 'w200') {
  if (!url || !url.includes('drive.google.com')) return url;
  try {
    const idMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=${size}`;
    }
  } catch (e) { console.error(e); }
  return url;
}

function escapeHtml(text) {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

// Modal Functions
function openMemberModal(index) {
  const member = membersState.filteredData[index];
  const modal = document.getElementById('memberModal');
  
  // Set Photo
  const photoUrl = getDriveImage(member.photo, 'w600');
  document.getElementById('modalPhotoContainer').innerHTML = member.photo 
    ? `<img src="${photoUrl}" class="w-full h-full object-cover" alt="Profile">`
    : `<div class="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">No Photo</div>`;

  // Set Header Info
  document.getElementById('modalMemberName').textContent = member.name || member.full_name || "Member Profile";
  document.getElementById('modalMemberSubtitle').textContent = member.team || member.preferred_team || "Team Member";

  // Build Details List (Skips sensitive or visual columns)
  const grid = document.getElementById('modalDetailsGrid');
  grid.innerHTML = '';
  Object.entries(member).forEach(([key, value]) => {
    if (['id', 'photo', 'created_at'].includes(key.toLowerCase())) return;
    
    grid.innerHTML += `
      <div class="border-b border-gray-100 pb-2">
        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-tighter">${key.replace(/_/g, ' ')}</label>
        <p class="text-gray-800 font-medium">${escapeHtml(value || 'N/A')}</p>
      </div>`;
  });

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('memberModal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// Logic: Filters & Table
function applyFilters() {
  const search = membersState.searchTerm.toLowerCase();
  membersState.filteredData = membersState.allData.filter(row => {
    const matchesTeam = !membersState.teamFilter || 
      String(row.team || row.preferred_team).trim() === membersState.teamFilter;
    
    const matchesSearch = !search || Object.entries(row).some(([key, val]) => 
      key !== 'photo' && String(val).toLowerCase().includes(search)
    );
    
    return matchesTeam && matchesSearch;
  });
  renderTable();
}

function renderTable() {
  const container = document.getElementById('tableContainer');
  if (membersState.filteredData.length === 0) {
    container.innerHTML = '<p class="text-center py-10 text-gray-400">No members found.</p>';
    return;
  }

  const columns = Object.keys(membersState.filteredData[0]).filter(c => !['id', 'created_at'].includes(c));

  let html = `<table class="w-full text-sm text-left">
    <thead class="bg-gray-50 text-gray-600 border-b border-gray-100">
      <tr>
        <th class="px-6 py-4 font-bold">SL.</th>
        ${columns.map(c => `<th class="px-6 py-4 font-bold uppercase tracking-wider">${c}</th>`).join('')}
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">`;

  membersState.filteredData.forEach((row, index) => {
    html += `<tr onclick="openMemberModal(${index})" class="hover:bg-blue-50/40 transition-colors cursor-pointer group">
      <td class="px-6 py-4 text-gray-400">${index + 1}</td>
      ${columns.map(col => {
        let content = row[col];
        if (col === 'photo') {
          content = `<img src="${getDriveImage(row[col])}" class="w-10 h-10 rounded-full object-cover border border-gray-200" onerror="this.src='https://ui-avatars.com/api/?name=${index+1}'">`;
        } else {
          content = escapeHtml(String(content || '-')).substring(0, 40);
        }
        return `<td class="px-6 py-4 text-gray-700">${content}</td>`;
      }).join('')}
    </tr>`;
  });

  container.innerHTML = html + '</tbody></table>';
}

// Standard UI Logic
async function fetchData() {
  showLoading();
  try {
    const { data, error } = await supabaseClient.from('prm_members').select('*');
    if (error) throw error;
    membersState.allData = data || [];
    populateTeamFilter();
    applyFilters();
  } catch (e) { 
    console.error('Error fetching data:', e);
  }
  finally { hideLoading(); }
}

function populateTeamFilter() {
  const teams = [...new Set(membersState.allData.map(r => String(r.team || r.preferred_team || '').trim()))].filter(Boolean);
  const select = document.getElementById('teamFilter');
  teams.sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = t;
    select.appendChild(opt);
  });
}

function setupEventListeners() {
  document.getElementById('searchInput').oninput = (e) => { membersState.searchTerm = e.target.value; applyFilters(); };
  document.getElementById('teamFilter').onchange = (e) => { membersState.teamFilter = e.target.value; applyFilters(); };
  document.getElementById('modalOverlay').onclick = closeModal;
  
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.onclick = () => {
      document.getElementById('sidebar').classList.remove('-translate-x-full');
      document.getElementById('menuOverlay').classList.remove('hidden');
    };
  }
}

function showLoading() { document.getElementById('loadingIndicator').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loadingIndicator').classList.add('hidden'); }

function downloadCSV() {
  if (membersState.filteredData.length === 0) {
    return;
  }
  
  const cols = Object.keys(membersState.filteredData[0]).filter(c => c !== 'photo' && c !== 'id');
  let csv = cols.join(',') + '\n' + membersState.filteredData.map(row => cols.map(c => `"${String(row[c] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'members.csv'; a.click();
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchData();
});