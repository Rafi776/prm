// Waiting Room JavaScript with Auto-Slide Functionality
const waitingRoomState = {
  inProgressCandidates: [],
  loading: false,
  refreshInterval: null,
  slideInterval: null,
  currentSlide: 0,
  slideCountdown: null,
  countdownValue: 5,
  motivationalQuotes: [
    "Great things never come from comfort zones.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "It is during our darkest moments that we must focus to see the light.",
    "Believe you can and you're halfway there.",
    "The only impossible journey is the one you never begin.",
    "In the middle of difficulty lies opportunity.",
    "Success is walking from failure to failure with no loss of enthusiasm."
  ],
  currentQuoteIndex: 0
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

// Render active interview sessions with carousel
function renderActiveSessions() {
  const container = document.getElementById('activeSessionsContainer');
  const emptyState = document.getElementById('emptyState');
  const slideIndicators = document.getElementById('slideIndicators');
  const slideCountdown = document.getElementById('slideCountdown');
  const candidates = waitingRoomState.inProgressCandidates;
  
  if (candidates.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    slideIndicators.classList.add('hidden');
    slideCountdown.classList.add('hidden');
    stopSlideshow();
    startMotivationalQuotes();
    return;
  }
  
  emptyState.classList.add('hidden');
  stopMotivationalQuotes();
  
  // Show indicators and countdown only if multiple candidates
  if (candidates.length > 1) {
    slideIndicators.classList.remove('hidden');
    slideCountdown.classList.remove('hidden');
    renderSlideIndicators();
    startSlideshow();
  } else {
    slideIndicators.classList.add('hidden');
    slideCountdown.classList.add('hidden');
    stopSlideshow();
  }
  
  // Create carousel structure
  let carouselHtml = '<div class="carousel-track" id="carouselTrack">';
  
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
    
    carouselHtml += `
      <div class="carousel-slide">
        <div class="candidate-display rounded-2xl p-6 mb-4 text-center relative overflow-hidden bounce-in">
          <!-- Animated background -->
          <div class="absolute inset-0 gradient-border opacity-20"></div>
          <div class="absolute inset-1 bg-white rounded-2xl"></div>
          
          <!-- Sparkle effects -->
          <div class="sparkle" style="top: 15%; left: 10%; animation-delay: 0s;"></div>
          <div class="sparkle" style="top: 25%; right: 15%; animation-delay: 0.8s;"></div>
          <div class="sparkle" style="bottom: 30%; left: 20%; animation-delay: 1.2s;"></div>
          <div class="sparkle" style="bottom: 15%; right: 25%; animation-delay: 1.8s;"></div>
          
          <!-- Content -->
          <div class="relative z-10">
            <!-- Live indicator -->
            <div class="flex justify-center mb-4">
              <div class="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-200 rounded-full">
                <div class="w-3 h-3 bg-red-500 rounded-full live-pulse"></div>
                <span class="text-sm font-bold text-red-700">INTERVIEW IN PROGRESS</span>
              </div>
            </div>
            
            <!-- Large photo -->
            <div class="flex justify-center mb-4">
              <div class="relative">
                <div class="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl">
                  <img 
                    src="${photoUrl}" 
                    alt="${escapeHtml(candidateName)}"
                    class="w-full h-full object-cover"
                    onerror="console.error('Image failed to load:', this.src); this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b82f6&color=fff&size=400&font-size=0.4'"
                    onload="console.log('Image loaded successfully:', this.src)"
                  >
                </div>
                <!-- Live indicator on photo -->
                <div class="absolute -bottom-1 -right-1 w-10 h-10 bg-red-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
                  <span class="text-white text-lg">🎥</span>
                </div>
              </div>
            </div>
            
            <!-- Large candidate info -->
            <div class="mb-4">
              <h3 class="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                ${escapeHtml(candidateName)}
              </h3>
              <p class="text-lg md:text-xl text-blue-600 font-semibold mb-4">
                ${escapeHtml(candidateUnit)}
              </p>
              
              <!-- Additional info if available -->
              <div class="flex flex-wrap justify-center gap-2 text-sm text-gray-600">
                ${candidate.email ? `
                  <div class="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full">
                    <span>📧</span>
                    <span>${escapeHtml(candidate.email)}</span>
                  </div>
                ` : ''}
                ${candidate.phone ? `
                  <div class="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full">
                    <span>📱</span>
                    <span>${escapeHtml(candidate.phone)}</span>
                  </div>
                ` : ''}
                ${candidate.university ? `
                  <div class="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full">
                    <span>🎓</span>
                    <span>${escapeHtml(candidate.university)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Action button -->
            <button 
              onclick="viewCandidateDetails(${index})"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              View Full Profile
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  carouselHtml += '</div>';
  container.innerHTML = carouselHtml;
  
  // Reset to first slide
  waitingRoomState.currentSlide = 0;
  updateCarouselPosition();
}

// Carousel and slideshow functions
function renderSlideIndicators() {
  const indicatorsContainer = document.getElementById('slideIndicators');
  const candidates = waitingRoomState.inProgressCandidates;
  
  let indicatorsHtml = '';
  candidates.forEach((_, index) => {
    indicatorsHtml += `
      <div class="slide-indicator ${index === waitingRoomState.currentSlide ? 'active' : ''}" 
           onclick="goToSlide(${index})">
      </div>
    `;
  });
  
  indicatorsContainer.innerHTML = indicatorsHtml;
}

function updateCarouselPosition() {
  const track = document.getElementById('carouselTrack');
  if (track) {
    const translateX = -waitingRoomState.currentSlide * 100;
    track.style.transform = `translateX(${translateX}%)`;
  }
  
  // Update indicators
  const indicators = document.querySelectorAll('.slide-indicator');
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('active', index === waitingRoomState.currentSlide);
  });
}

function goToSlide(slideIndex) {
  waitingRoomState.currentSlide = slideIndex;
  updateCarouselPosition();
  resetSlideCountdown();
}

function nextSlide() {
  const candidates = waitingRoomState.inProgressCandidates;
  if (candidates.length <= 1) return;
  
  waitingRoomState.currentSlide = (waitingRoomState.currentSlide + 1) % candidates.length;
  updateCarouselPosition();
  resetSlideCountdown();
}

function startSlideshow() {
  stopSlideshow(); // Clear any existing interval
  
  const candidates = waitingRoomState.inProgressCandidates;
  if (candidates.length <= 1) return;
  
  // Start the 5-second auto-slide
  waitingRoomState.slideInterval = setInterval(() => {
    nextSlide();
  }, 5000);
  
  // Start countdown
  startSlideCountdown();
}

function stopSlideshow() {
  if (waitingRoomState.slideInterval) {
    clearInterval(waitingRoomState.slideInterval);
    waitingRoomState.slideInterval = null;
  }
  stopSlideCountdown();
}

function startSlideCountdown() {
  stopSlideCountdown(); // Clear any existing countdown
  
  waitingRoomState.countdownValue = 5;
  updateCountdownDisplay();
  
  waitingRoomState.slideCountdown = setInterval(() => {
    waitingRoomState.countdownValue--;
    updateCountdownDisplay();
    
    if (waitingRoomState.countdownValue <= 0) {
      resetSlideCountdown();
    }
  }, 1000);
}

function stopSlideCountdown() {
  if (waitingRoomState.slideCountdown) {
    clearInterval(waitingRoomState.slideCountdown);
    waitingRoomState.slideCountdown = null;
  }
}

function resetSlideCountdown() {
  waitingRoomState.countdownValue = 5;
  updateCountdownDisplay();
}

function updateCountdownDisplay() {
  const countdownText = document.getElementById('countdownText');
  const countdownSeconds = document.getElementById('countdownSeconds');
  const countdownRing = document.querySelector('.countdown-ring');
  
  if (countdownText) countdownText.textContent = waitingRoomState.countdownValue;
  if (countdownSeconds) countdownSeconds.textContent = waitingRoomState.countdownValue;
  
  // Update ring progress
  if (countdownRing) {
    const progress = ((5 - waitingRoomState.countdownValue) / 5) * 360;
    countdownRing.style.background = `conic-gradient(#ef4444 ${progress}deg, rgba(255,255,255,0.2) ${progress}deg)`;
  }
}

// Motivational quotes for engagement
function startMotivationalQuotes() {
  const quoteElement = document.getElementById('motivationalQuote');
  if (!quoteElement) return;
  
  // Show first quote
  showNextQuote();
  
  // Change quote every 8 seconds
  waitingRoomState.quoteInterval = setInterval(() => {
    showNextQuote();
  }, 8000);
}

function stopMotivationalQuotes() {
  if (waitingRoomState.quoteInterval) {
    clearInterval(waitingRoomState.quoteInterval);
    waitingRoomState.quoteInterval = null;
  }
}

function showNextQuote() {
  const quoteElement = document.getElementById('motivationalQuote');
  if (!quoteElement) return;
  
  const quotes = waitingRoomState.motivationalQuotes;
  waitingRoomState.currentQuoteIndex = (waitingRoomState.currentQuoteIndex + 1) % quotes.length;
  
  // Fade out
  quoteElement.style.opacity = '0';
  quoteElement.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    quoteElement.textContent = quotes[waitingRoomState.currentQuoteIndex];
    // Fade in
    quoteElement.style.opacity = '1';
    quoteElement.style.transform = 'translateY(0)';
  }, 400);
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
  
  // Handle page visibility change to pause/resume auto-refresh and slideshow
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
      stopSlideshow();
      stopMotivationalQuotes();
    } else {
      startAutoRefresh();
      fetchInProgressCandidates(); // Immediate refresh when page becomes visible
      // Slideshow will restart when renderActiveSessions is called
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
  stopSlideshow();
  stopMotivationalQuotes();
});