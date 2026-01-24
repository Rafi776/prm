const membersState = {
  allData: [],
  filteredData: [],
  searchTerm: '',
  teamFilter: '',
  loading: false
};

// Authentication state
const authState = {
  isAuthenticated: false,
  sessionStart: null,
  sessionDuration: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
  credentials: {
    username: 'admin',
    password: 'admin123'
  }
};

let currentEditingMember = null;
let currentDeletingMember = null;
let uploadedPhotoFile = null;

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

// Authentication Functions
function checkSession() {
  if (!authState.isAuthenticated || !authState.sessionStart) {
    return false;
  }
  
  const now = new Date().getTime();
  const sessionAge = now - authState.sessionStart;
  
  if (sessionAge > authState.sessionDuration) {
    terminateSession();
    return false;
  }
  
  return true;
}

function showAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('adminUser').focus();
}

function handleLogin() {
  const username = document.getElementById('adminUser').value;
  const password = document.getElementById('adminPass').value;
  
  if (username === authState.credentials.username && password === authState.credentials.password) {
    authState.isAuthenticated = true;
    authState.sessionStart = new Date().getTime();
    document.getElementById('authModal').classList.add('hidden');
    
    const endSessionBtn = document.getElementById('endSessionBtn');
    endSessionBtn.classList.remove('hidden');
    endSessionBtn.classList.add('session-active');
    
    // Show create member button and hide login button
    const createBtn = document.getElementById('createMemberBtn');
    const loginBtn = document.getElementById('adminLoginBtn');
    if (createBtn) createBtn.classList.remove('hidden');
    if (loginBtn) loginBtn.classList.add('hidden');
    
    // Update status indicator
    const statusDiv = document.getElementById('crudStatus');
    if (statusDiv) {
      statusDiv.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm';
      statusDiv.innerHTML = '<span class="font-medium">✅ Admin Mode:</span> CRUD features are now active! You can Create, Edit, and Delete members.';
    }
    
    // Clear form
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    
    // Re-render table to show action buttons
    renderTable();
    
    // Show success message briefly
    showMessage('Authentication successful - CRUD features now available!', 'success');
    
    // If there was a pending edit, open it now
    if (currentEditingMember !== null) {
      openEditModal(currentEditingMember);
    }
  } else {
    showMessage('Invalid credentials', 'error');
  }
}

function terminateSession() {
  authState.isAuthenticated = false;
  authState.sessionStart = null;
  const endSessionBtn = document.getElementById('endSessionBtn');
  endSessionBtn.classList.add('hidden');
  endSessionBtn.classList.remove('session-active');
  
  // Hide create member button and show login button
  const createBtn = document.getElementById('createMemberBtn');
  const loginBtn = document.getElementById('adminLoginBtn');
  if (createBtn) createBtn.classList.add('hidden');
  if (loginBtn) loginBtn.classList.remove('hidden');
  
  // Update status indicator
  const statusDiv = document.getElementById('crudStatus');
  if (statusDiv) {
    statusDiv.className = 'mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm';
    statusDiv.innerHTML = '<span class="font-medium">👀 View Mode:</span> Click any member to view details. <button onclick="showAuthModal()" class="text-yellow-600 hover:text-yellow-800 underline font-medium">Login as admin</button> to enable Create/Edit/Delete features.';
  }
  
  closeEditModal();
  closeCreateModal();
  closeDeleteModal();
  
  // Re-render table to hide action buttons
  renderTable();
  
  showMessage('Session ended - CRUD features disabled', 'info');
}

function showMessage(message, type = 'info') {
  const colors = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200'
  };
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `fixed top-4 right-4 z-[110] px-4 py-2 rounded-lg border ${colors[type]} font-medium`;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}
// Modal Functions - PRESERVE ORIGINAL FUNCTIONALITY
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

// Logic: Filters & Table - PRESERVE ORIGINAL FUNCTIONALITY
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
  const hasAuthSession = checkSession();

  let html = `<table class="w-full text-sm text-left">
    <thead class="bg-gray-50 text-gray-600 border-b border-gray-100">
      <tr>
        <th class="px-6 py-4 font-bold">SL.</th>
        ${columns.map(c => `<th class="px-6 py-4 font-bold uppercase tracking-wider">${c}</th>`).join('')}
        ${hasAuthSession ? '<th class="px-6 py-4 font-bold text-center">Actions</th>' : ''}
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">`;

  membersState.filteredData.forEach((row, index) => {
    html += `<tr class="hover:bg-blue-50/40 transition-colors group">
      <td class="px-6 py-4 text-gray-400">${index + 1}</td>
      ${columns.map(col => {
        let content = row[col];
        if (col === 'photo') {
          content = `<img src="${getDriveImage(row[col])}" class="w-10 h-10 rounded-full object-cover border border-gray-200" onerror="this.src='https://ui-avatars.com/api/?name=${index+1}'">`;
        } else {
          content = escapeHtml(String(content || '-')).substring(0, 40);
        }
        return `<td class="px-6 py-4 text-gray-700 cursor-pointer" onclick="openMemberModal(${index})">${content}</td>`;
      }).join('')}
      ${hasAuthSession ? `
      <td class="px-6 py-4 text-center">
        <div class="flex justify-center gap-2">
          <button 
            onclick="event.stopPropagation(); requestEdit(${index})" 
            class="edit-btn p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Edit Member"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button 
            onclick="event.stopPropagation(); requestDelete(${index})" 
            class="edit-btn p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
            title="Delete Member"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>` : ''}
    </tr>`;
  });

  container.innerHTML = html + '</tbody></table>';
}
// Edit Modal Functions
function requestEdit(memberIndex) {
  currentEditingMember = memberIndex;
  
  if (!checkSession()) {
    showAuthModal();
    return;
  }
  
  openEditModal(memberIndex);
}

function openEditModal(memberIndex) {
  const member = membersState.filteredData[memberIndex];
  const form = document.getElementById('editForm');
  
  // Clear form
  form.innerHTML = '';
  
  // Create form fields for all member properties except id, created_at, and photo
  Object.entries(member).forEach(([key, value]) => {
    if (['id', 'created_at', 'photo'].includes(key.toLowerCase())) return;
    
    const isEmail = key.toLowerCase().includes('email');
    const fieldClass = isEmail ? 'field-disabled' : 'bg-white border-gray-200 focus:border-blue-500';
    const disabled = isEmail ? 'disabled' : '';
    
    form.innerHTML += `
      <div class="space-y-1">
        <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider">
          ${key.replace(/_/g, ' ')}
          ${isEmail ? '<span class="text-red-500 ml-1">(Read Only)</span>' : ''}
        </label>
        <input 
          type="text" 
          name="${key}" 
          value="${escapeHtml(value || '')}" 
          class="w-full px-3 py-2 border rounded-lg outline-none transition-colors ${fieldClass}"
          ${disabled}
          ${isEmail ? 'title="Email cannot be edited for security reasons"' : ''}
        >
      </div>`;
  });
  
  document.getElementById('editModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
  currentEditingMember = null;
}

async function saveMemberEdit() {
  if (!checkSession()) {
    closeEditModal();
    showAuthModal();
    return;
  }
  
  const form = document.getElementById('editForm');
  const formData = new FormData(form);
  const member = membersState.filteredData[currentEditingMember];
  
  // Build update object
  const updates = {};
  for (let [key, value] of formData.entries()) {
    if (!key.toLowerCase().includes('email')) { // Don't update email
      updates[key] = value;
    }
  }
  
  showLoading();
  
  try {
    const { error } = await supabaseClient
      .from('prm_members')
      .update(updates)
      .eq('id', member.id);
    
    if (error) throw error;
    
    // Update local data
    Object.assign(member, updates);
    renderTable();
    closeEditModal();
    showMessage('Member updated successfully', 'success');
    
  } catch (error) {
    console.error('Update error:', error);
    showMessage('Failed to update member', 'error');
  } finally {
    hideLoading();
  }
}
// Create Member Functions
function requestCreateMember() {
  if (!checkSession()) {
    showAuthModal();
    return;
  }
  
  openCreateModal();
}

function openCreateModal() {
  const form = document.getElementById('createFormFields');
  if (!form) return;
  
  // Get sample member structure from existing data
  if (membersState.allData.length === 0) {
    showMessage('Please wait for data to load', 'info');
    return;
  }
  
  const sampleMember = membersState.allData[0];
  form.innerHTML = '';
  
  // Create form fields for all member properties except id, created_at, and photo
  Object.keys(sampleMember).forEach(key => {
    if (['id', 'created_at', 'photo'].includes(key.toLowerCase())) return;
    
    form.innerHTML += `
      <div class="space-y-1">
        <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider">
          ${key.replace(/_/g, ' ')} <span class="text-red-500">*</span>
        </label>
        <input 
          type="text" 
          name="${key}" 
          required
          class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
          placeholder="Enter ${key.replace(/_/g, ' ')}"
        >
      </div>`;
  });
  
  // Reset photo upload
  uploadedPhotoFile = null;
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  if (photoPreview) photoPreview.classList.add('hidden');
  if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
  
  document.getElementById('createModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCreateModal() {
  const modal = document.getElementById('createModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
  uploadedPhotoFile = null;
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showMessage('Please select a valid image file', 'error');
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showMessage('Image size should be less than 5MB', 'error');
    return;
  }
  
  uploadedPhotoFile = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImage = document.getElementById('previewImage');
    const photoPreview = document.getElementById('photoPreview');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    
    if (previewImage) previewImage.src = e.target.result;
    if (photoPreview) photoPreview.classList.remove('hidden');
    if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

async function uploadPhotoToCloudinary(file) {
  // For demo purposes, we'll simulate photo upload by creating a data URL
  // In production, you would upload to Cloudinary, Google Drive, or similar service
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Simulate upload delay
      setTimeout(() => {
        resolve(e.target.result);
      }, 1000);
    };
    reader.readAsDataURL(file);
  });
}

async function saveNewMember() {
  if (!checkSession()) {
    closeCreateModal();
    showAuthModal();
    return;
  }
  
  const form = document.getElementById('createForm');
  if (!form) return;
  
  const formData = new FormData(form);
  
  // Validate required fields
  let isValid = true;
  const newMember = {};
  
  for (let [key, value] of formData.entries()) {
    if (!value.trim()) {
      showMessage(`${key.replace(/_/g, ' ')} is required`, 'error');
      isValid = false;
      break;
    }
    newMember[key] = value.trim();
  }
  
  if (!uploadedPhotoFile) {
    showMessage('Photo is required', 'error');
    isValid = false;
  }
  
  if (!isValid) return;
  
  showLoading();
  
  try {
    // Upload photo
    const photoUrl = await uploadPhotoToCloudinary(uploadedPhotoFile);
    newMember.photo = photoUrl;
    
    // Save to database
    const { data, error } = await supabaseClient
      .from('prm_members')
      .insert([newMember])
      .select();
    
    if (error) throw error;
    
    // Update local data
    membersState.allData.push(data[0]);
    applyFilters();
    closeCreateModal();
    showMessage('Member created successfully', 'success');
    
  } catch (error) {
    console.error('Create error:', error);
    showMessage('Failed to create member', 'error');
  } finally {
    hideLoading();
  }
}
// Delete Member Functions
function requestDelete(memberIndex) {
  if (!checkSession()) {
    showAuthModal();
    return;
  }
  
  openDeleteModal(memberIndex);
}

function openDeleteModal(memberIndex) {
  const member = membersState.filteredData[memberIndex];
  currentDeletingMember = memberIndex;
  
  // Set preview info
  const deleteMemberPhoto = document.getElementById('deleteMemberPhoto');
  const deleteMemberName = document.getElementById('deleteMemberName');
  const deleteMemberTeam = document.getElementById('deleteMemberTeam');
  
  if (deleteMemberPhoto) deleteMemberPhoto.src = getDriveImage(member.photo);
  if (deleteMemberName) deleteMemberName.textContent = member.name || member.full_name || 'Unknown';
  if (deleteMemberTeam) deleteMemberTeam.textContent = member.team || member.preferred_team || 'No team';
  
  document.getElementById('deleteModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
  currentDeletingMember = null;
}

async function confirmDelete() {
  if (!checkSession()) {
    closeDeleteModal();
    showAuthModal();
    return;
  }
  
  const member = membersState.filteredData[currentDeletingMember];
  
  showLoading();
  
  try {
    const { error } = await supabaseClient
      .from('prm_members')
      .delete()
      .eq('id', member.id);
    
    if (error) throw error;
    
    // Remove from local data
    const originalIndex = membersState.allData.findIndex(m => m.id === member.id);
    if (originalIndex !== -1) {
      membersState.allData.splice(originalIndex, 1);
    }
    
    applyFilters();
    closeDeleteModal();
    showMessage('Member deleted successfully', 'success');
    
  } catch (error) {
    console.error('Delete error:', error);
    showMessage('Failed to delete member', 'error');
  } finally {
    hideLoading();
  }
}
// Standard UI Logic - PRESERVE ORIGINAL FUNCTIONALITY
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
  // Clear existing options except the first one
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }
  
  teams.sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = t;
    select.appendChild(opt);
  });
}

function setupEventListeners() {
  document.getElementById('searchInput').oninput = (e) => { membersState.searchTerm = e.target.value; applyFilters(); };
  document.getElementById('teamFilter').onchange = (e) => { membersState.teamFilter = e.target.value; applyFilters(); };
  
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) modalOverlay.onclick = closeModal;
  
  // Auth modal event listeners
  const adminPass = document.getElementById('adminPass');
  if (adminPass) {
    adminPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
  
  // Auto-check session every minute
  setInterval(() => {
    if (authState.isAuthenticated && !checkSession()) {
      showMessage('Session expired', 'info');
    }
  }, 60000);
  
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.onclick = () => {
      document.getElementById('sidebar').classList.remove('-translate-x-full');
      document.getElementById('menuOverlay').classList.remove('hidden');
    };
  }
}

function showLoading() { 
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) indicator.classList.remove('hidden'); 
}

function hideLoading() { 
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) indicator.classList.add('hidden'); 
}

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