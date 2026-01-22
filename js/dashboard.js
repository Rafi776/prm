// Dashboard JS - Statistics and Organogram

const dashboardState = {
  membersData: [],
  loading: false
};

// Helper functions
// Helper function to escape HTML characters
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

// Helper function to convert Google Drive link/ID to thumbnail image URL
// Accepts: 
//   - Direct FILE IDs: "17EWg2y7RSYB397mzYCMKj2TVBtHdwuDy"
//   - Google Drive URLs: "https://drive.google.com/open?id=17EWg2y7RSYB397mzYCMKj2TVBtHdwuDy"
//   - Google Drive file URLs: "https://drive.google.com/file/d/17EWg2y7RSYB397mzYCMKj2TVBtHdwuDy/view"
function convertGoogleDriveLink(url) {
  if (!url || String(url).trim() === '') return null;
  
  url = String(url).trim();
  let fileId = null;
  
  // If it's just a FILE ID (no URL format)
  if (url.length === 33 && !url.includes('/') && !url.includes('?')) {
    fileId = url;
  }
  // If it's a full URL, extract the FILE ID
  else if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    // Format: https://drive.google.com/open?id=FILE_ID
    if (url.includes('id=')) {
      fileId = url.split('id=')[1].split('&')[0];
    }
    // Format: https://drive.google.com/file/d/FILE_ID/view
    else if (url.includes('/d/')) {
      fileId = url.split('/d/')[1].split('/')[0];
    }
  }
  
  // If we found a FILE ID, return the thumbnail URL
  if (fileId && fileId.length > 0) {
    // Using thumbnail endpoint for better performance and public link compatibility
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
  }
  
  // If it looks like a direct URL (http/https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  return null;
}

// Helper function to get SVG placeholder image (no external dependencies)
function getPlaceholderImage() {
  // Returns a base64-encoded SVG with a user icon
  return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlNWU3ZWIiLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJNIDMwIDEzMCBRIDMwIDEwMCA3MCAxMDAgUSAxMDAgMTAwIDEwMCAxMzAgTCAxMDAgMjAwIEwgMzAgMjAwIFoiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJNIDEwMCAxMzAgUSAxMDAgMTAwIDEzMCAxMDAgUSAxNzAgMTAwIDE3MCAxMzAgTCAxNzAgMjAwIEwgMTAwIDIwMCBaIiBmaWxsPSIjOWNhM2FmIi8+PC9zdmc+';
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

// Fetch all data
async function fetchDashboardData() {
  dashboardState.loading = true;
  showLoading();

  try {
    // Fetch members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('prm_members')
      .select('*');

    if (membersError) throw membersError;
    dashboardState.membersData = membersData || [];

    updateStatistics();
    renderOrganogram();

    showSuccess('Dashboard data loaded successfully');
  } catch (error) {
    console.error('Error fetching data:', error);
    showError('Failed to load dashboard data: ' + error.message);
  } finally {
    dashboardState.loading = false;
    hideLoading();
  }
}

// Update statistics
function updateStatistics() {
  const totalMembers = dashboardState.membersData.length;

  document.getElementById('totalMembers').textContent = totalMembers;
}
// Render organogram
function renderOrganogram() {
  const organogramContainer = document.getElementById('organogramContainer');
  
  // Filter out Core Team members
  const filteredMembers = dashboardState.membersData.filter(member => {
    const teamCol = Object.keys(member).find(key => key.toLowerCase() === 'team' || key.toLowerCase() === 'preferred_team');
    const team = teamCol ? String(member[teamCol] || '').trim() : '';
    return team.toLowerCase() !== 'core team';
  });
  
  // Group members by position
  const positions = {
    'Convener': [],
    'Joint Convener': [],
    'Member Secretary': [],
    'Chief Coordinator': [],
    'Deputy Chief Coordinator': [],
    'Coordinator': [],
    'Member': []
  };

  filteredMembers.forEach(member => {
    const posCol = Object.keys(member).find(key => key.toLowerCase() === 'position');
    let position = posCol ? String(member[posCol] || '').trim() : 'Member';
    
    // Categorize position
    if (position.toLowerCase().includes('convener')) {
      if (position.toLowerCase().includes('joint')) {
        positions['Joint Convener'].push(member);
      } else {
        positions['Convener'].push(member);
      }
    } else if (position.toLowerCase().includes('member secretary')) {
      positions['Member Secretary'].push(member);
    } else if (position.toLowerCase().includes('chief coordinator')) {
      if (position.toLowerCase().includes('deputy')) {
        positions['Deputy Chief Coordinator'].push(member);
      } else {
        positions['Chief Coordinator'].push(member);
      }
    } else if (position.toLowerCase().includes('coordinator')) {
      positions['Coordinator'].push(member);
    } else {
      positions['Member'].push(member);
    }
  });

  let organogramHtml = '';

  // Convener (top level)
  organogramHtml += renderPositionRow('Convener', positions['Convener'], 'bg-red-100 border-red-300');

  // Joint Conveners
  if (positions['Joint Convener'].length > 0) {
    organogramHtml += renderPositionRow('Joint Convener', positions['Joint Convener'], 'bg-orange-100 border-orange-300');
  }

  // Member Secretary
  if (positions['Member Secretary'].length > 0) {
    organogramHtml += renderPositionRow('Member Secretary', positions['Member Secretary'], 'bg-yellow-100 border-yellow-300');
  }

  // Chief Coordinator
  if (positions['Chief Coordinator'].length > 0) {
    organogramHtml += renderPositionRow('Chief Coordinator', positions['Chief Coordinator'], 'bg-green-100 border-green-300');
  }

  // Deputy Chief Coordinator
  if (positions['Deputy Chief Coordinator'].length > 0) {
    organogramHtml += renderPositionRow('Deputy Chief Coordinator', positions['Deputy Chief Coordinator'], 'bg-blue-100 border-blue-300');
  }

  // Coordinators
  if (positions['Coordinator'].length > 0) {
    organogramHtml += renderPositionRow('Coordinator', positions['Coordinator'], 'bg-indigo-100 border-indigo-300');
  }

  // Members (if any with explicit position)
  if (positions['Member'].length > 0 && positions['Member'].length <= 10) {
    organogramHtml += renderPositionRow('Member', positions['Member'], 'bg-gray-100 border-gray-300');
  }

  organogramContainer.innerHTML = organogramHtml || '<p class="text-gray-500">No organogram data available</p>';
}

// Render position row with member cards
function renderPositionRow(positionTitle, members, bgClass) {
  if (members.length === 0) return '';

  let html = `
    <div class="w-full">
      <h3 class="text-center font-bold text-lg text-gray-900 mb-6 pb-4 border-b-2 border-gray-200">${positionTitle}</h3>
      <div class="flex flex-wrap justify-center gap-6">
  `;

  members.forEach((member, index) => {
    const nameCol = Object.keys(member).find(key => key.toLowerCase() === 'name');
    const photoCol = Object.keys(member).find(key => key.toLowerCase() === 'photo');
    const posCol = Object.keys(member).find(key => key.toLowerCase() === 'position');
    
    const name = nameCol ? escapeHtml(String(member[nameCol] || '')) : 'N/A';
    let photoUrl = photoCol ? member[photoCol] : null;
    
    // Convert Google Drive link/ID to thumbnail image URL
    photoUrl = convertGoogleDriveLink(photoUrl);
    const position = posCol ? escapeHtml(String(member[posCol] || '')) : '';
    const uniqueId = `img-${index}-${Date.now()}`;

    html += `
      <div class="flex flex-col items-center w-40">
        <!-- Photo Container -->
        <div class="w-32 h-32 mb-3 rounded-lg overflow-hidden flex items-center justify-center border-4 ${bgClass} bg-gray-50">
          <img 
            id="${uniqueId}"
            src="${photoUrl || getPlaceholderImage()}" 
            alt="${name}" 
            class="w-full h-full object-cover"
            onerror="this.src='${getPlaceholderImage()}'"
            loading="lazy"
          >
        </div>
        <!-- Name -->
        <p class="text-center text-sm font-semibold text-gray-900 line-clamp-2 mb-1">${name}</p>
        <!-- Position -->
        ${position ? `<p class="text-center text-xs text-gray-600 line-clamp-1">${position}</p>` : ''}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupMenuEventListeners();
  fetchDashboardData();
});
