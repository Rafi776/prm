// Waiting Room JavaScript
const waitingRoomState = {
  inProgressCandidates: [],
  loading: false,
  refreshInterval: null
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

// Fetch candidates with "In Progress" status
async function fetchInProgressCandidates() {
  showLoading();
  try {
    console.log('Fetching candidates with In Progress status...');
    const { data, error } = await supabaseClient
      .from('prm_recruitment')
      .select('*')
      .eq('status', 'In Progress');
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Fetched data:', data);
    console.log('Number of candidates:', data?.length || 0);
    
    // Log photo fields for debugging
    if (data && data.length > 0) {
      data.forEach((candidate, index) => {
        console.log(`Candidate ${index + 1}:`, {
          name: candidate.name || candidate.full_name,
          photo_url: candidate.photo_url,
          photo: candidate.photo,
          image: candidate.image,
          profile_photo: candidate.profile_photo,
          allFields: Object.keys(candidate)
        });
      });
    }
    
    waitingRoomState.inProgressCandidates = data || [];
    renderActiveSessions();
    
  } catch (error) {
    console.error('Error fetching in-progress candidates:', error);
    showError('Failed to load interview sessions: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Render active interview sessions
function renderActiveSessions() {
  const container = document.getElementById('activeSessionsContainer');
  const emptyState = document.getElementById('emptyState');
  const candidates = waitingRoomState.inProgressCandidates;
  
  if (candidates.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Create large, focused display for each candidate
  let html = '';
  
  candidates.forEach((candidate, index) => {
    const candidateName = candidate.name || candidate.full_name || 'Unknown Candidate';
    const candidateUnit = candidate.preferred_team || candidate.unit || candidate.team || 'No Unit Specified';
    
    // Handle photo URL - use photo_url field directly (Tally.so URLs)
    let photoUrl = '';
    if (candidate.photo_url) {
      photoUrl = candidate.photo_url;
    } else if (candidate.photo) {
      photoUrl = getDriveImage(candidate.photo, 'w600');
    } else if (candidate.image) {
      photoUrl = getDriveImage(candidate.image, 'w600');
    } else if (candidate.profile_photo) {
      photoUrl = getDriveImage(candidate.profile_photo, 'w600');
    }
    
    // Fallback to avatar if no photo
    if (!photoUrl) {
      photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b82f6&color=fff&size=600&font-size=0.4`;
    }
    
    console.log(`Candidate ${index + 1} photo URL:`, photoUrl);
    
    html += `
      <div class="candidate-display rounded-3xl p-12 mb-8 text-center relative overflow-hidden">
        <!-- Animated background -->
        <div class="absolute inset-0 gradient-border opacity-20"></div>
        <div class="absolute inset-1 bg-white rounded-3xl"></div>
        
        <!-- Content -->
        <div class="relative z-10">
          <!-- Live indicator -->
          <div class="flex justify-center mb-8">
            <div class="flex items-center gap-3 px-6 py-3 bg-red-50 border-2 border-red-200 rounded-full">
              <div class="w-4 h-4 bg-red-500 rounded-full live-pulse"></div>
              <span class="text-lg font-bold text-red-700">INTERVIEW IN PROGRESS</span>
            </div>
          </div>
          
          <!-- Large photo -->
          <div class="flex justify-center mb-8">
            <div class="relative">
              <div class="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl">
                <img 
                  src="${photoUrl}" 
                  alt="${escapeHtml(candidateName)}"
                  class="w-full h-full object-cover"
                  onerror="console.error('Image failed to load:', this.src); this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b82f6&color=fff&size=600&font-size=0.4'"
                  onload="console.log('Image loaded successfully:', this.src)"
                >
              </div>
              <!-- Live indicator on photo -->
              <div class="absolute -bottom-2 -right-2 w-16 h-16 bg-red-500 border-4 border-white rounded-full flex items-center justify-center shadow-lg">
                <span class="text-white text-2xl">🎥</span>
              </div>
            </div>
          </div>
          
          <!-- Large candidate info -->
          <div class="mb-8">
            <h3 class="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              ${escapeHtml(candidateName)}
            </h3>
            <p class="text-2xl md:text-3xl text-blue-600 font-semibold mb-6">
              ${escapeHtml(candidateUnit)}
            </p>
            
            <!-- Additional info if available -->
            <div class="flex flex-wrap justify-center gap-4 text-lg text-gray-600">
              ${candidate.email ? `
                <div class="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                  <span>📧</span>
                  <span>${escapeHtml(candidate.email)}</span>
                </div>
              ` : ''}
              ${candidate.phone ? `
                <div class="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                  <span>📱</span>
                  <span>${escapeHtml(candidate.phone)}</span>
                </div>
              ` : ''}
              ${candidate.university ? `
                <div class="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                  <span>🎓</span>
                  <span>${escapeHtml(candidate.university)}</span>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Action button -->
          <button 
            onclick="viewCandidateDetails(${index})"
            class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-colors shadow-lg"
          >
            View Full Profile
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// View candidate details in modal
function viewCandidateDetails(index) {
  const candidate = waitingRoomState.inProgressCandidates[index];
  const candidateName = candidate.name || candidate.full_name || 'Unknown Candidate';
  const candidateUnit = candidate.preferred_team || candidate.unit || candidate.team || 'No Unit Specified';
  
  // Use photo_url field for Tally.so images
  let photoUrl = '';
  if (candidate.photo_url) {
    photoUrl = candidate.photo_url;
  } else if (candidate.photo) {
    photoUrl = getDriveImage(candidate.photo, 'w300');
  } else {
    photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b82f6&color=fff&size=300&font-size=0.4`;
  }
  
  // Create and show modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
    <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
      <div class="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span class="text-white font-bold">👤</span>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">Candidate Profile</h3>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-red-500 rounded-full live-pulse"></div>
              <span class="text-xs font-bold text-red-700">CURRENTLY IN INTERVIEW</span>
            </div>
          </div>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
      </div>
      <div class="p-6 max-h-[60vh] overflow-y-auto">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-shrink-0 text-center">
            <img 
              src="${photoUrl}" 
              alt="${escapeHtml(candidateName)}"
              class="w-32 h-32 rounded-full object-cover border-4 border-gray-200 mx-auto mb-4"
              onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b82f6&color=fff&size=300&font-size=0.4'"
            >
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
              <div class="w-2 h-2 bg-red-500 rounded-full live-pulse"></div>
              <span class="text-xs font-bold text-red-700">IN PROGRESS</span>
            </div>
          </div>
          <div class="flex-1">
            <h4 class="text-xl font-bold text-gray-900 mb-2">${escapeHtml(candidateName)}</h4>
            <p class="text-lg text-blue-600 font-medium mb-4">${escapeHtml(candidateUnit)}</p>
            <div class="grid grid-cols-1 gap-3">
              ${Object.entries(candidate).map(([key, value]) => {
                if (['id', 'photo', 'photo_url', 'image', 'profile_photo', 'created_at', 'status'].includes(key.toLowerCase()) || !value) return '';
                return `
                  <div class="border-b border-gray-100 pb-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider">${key.replace(/_/g, ' ')}</label>
                    <p class="text-gray-800 font-medium">${escapeHtml(value)}</p>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  // Remove modal when clicking outside or on close
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('bg-gray-900/60')) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  });
}

// UI Helper Functions
function showLoading() {
  document.getElementById('loadingIndicator')?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingIndicator')?.classList.add('hidden');
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'fixed top-4 right-4 z-[110] px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Auto-refresh functionality
function startAutoRefresh() {
  // Refresh every 30 seconds
  waitingRoomState.refreshInterval = setInterval(() => {
    fetchInProgressCandidates();
  }, 30000);
}

function stopAutoRefresh() {
  if (waitingRoomState.refreshInterval) {
    clearInterval(waitingRoomState.refreshInterval);
    waitingRoomState.refreshInterval = null;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Sidebar toggle functionality
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const overlay = document.getElementById('menuOverlay');
  
  let sidebarOpen = false;
  
  if (sidebarToggle) {
    sidebarToggle.onclick = () => {
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        sidebar.classList.remove('-translate-x-full');
        mainContent.classList.add('sidebar-open');
        overlay.classList.remove('hidden');
      } else {
        sidebar.classList.add('-translate-x-full');
        mainContent.classList.remove('sidebar-open');
        overlay.classList.add('hidden');
      }
    };
  }
  
  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.onclick = () => {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    };
  }

  if (overlay) {
    overlay.onclick = () => {
      sidebar.classList.add('-translate-x-full');
      mainContent.classList.remove('sidebar-open');
      overlay.classList.add('hidden');
      sidebarOpen = false;
    };
  }
  
  // Handle page visibility change to pause/resume auto-refresh
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
      fetchInProgressCandidates(); // Immediate refresh when page becomes visible
    }
  });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchInProgressCandidates();
  startAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});