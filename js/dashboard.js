/**
 * PRM Dashboard JS - High Readability Version
 */

const dashboardState = {
  membersData: [],
  loading: false
};

// --- Helpers ---

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function convertGoogleDriveLink(url) {
  if (!url || String(url).trim() === '') return null;
  let fileId = null;
  if (url.length === 33 && !url.includes('/') && !url.includes('?')) fileId = url;
  else if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
  else if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=400` : (url.startsWith('http') ? url : null);
}

const getPlaceholder = () => 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlNWU3ZWIiLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJNIDMwIDEzMCBRIDMwIDEwMCA3MCAxMDAgUSAxMDAgMTAwIDEwMCAxMzAgTCAxMDAgMjAwIEwgMzAgMjAwIFoiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJNIDEwMCAxMzAgUSAxMDAgMTAwIDEzMCAxMDAgUSAxNzAgMTAwIDE3MCAxMzAgTCAxNzAgMjAwIEwgMTAwIDIwMCBaIiBmaWxsPSIjOWNhM2FmIi8+PC9zdmc+';

// --- Data Fetching ---

async function fetchDashboardData() {
  const loading = document.getElementById('loadingIndicator');
  if (loading) loading.classList.remove('hidden');

  try {
    const { data, error } = await supabaseClient.from('prm_members').select('*');
    if (error) throw error;

    dashboardState.membersData = data || [];
    const totalEl = document.getElementById('totalMembers');
    if(totalEl) totalEl.textContent = dashboardState.membersData.length;
    renderOrganogram();
  } catch (error) {
    console.error('Fetch Error:', error);
    const alert = document.getElementById('errorAlert');
    if (alert) {
        alert.textContent = 'Data Fetch Failed: ' + error.message;
        alert.classList.remove('hidden');
    }
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

// --- Hierarchy Logic ---

function renderOrganogram() {
  const container = document.getElementById('organogramContainer');
  if (!container) return;

  const levels = [
    { key: 'Convener', label: 'Convener', border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700' },
    { key: 'Joint Convener', label: 'Joint Convener', border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
    { key: 'Member Secretary', label: 'Member Secretary', border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    { key: 'Chief Coordinator', label: 'Chief Coordinator', border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700' },
    { key: 'Deputy Chief Coordinator', label: 'Deputy Chief Coordinator', border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
    { key: 'Team Coordinator', label: 'Team Coordinator', border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' }
  ];

  let html = '<div class="flex flex-col items-center gap-12">';

  levels.forEach((level, idx) => {
    const members = dashboardState.membersData.filter(m => 
      String(m.position || '').trim().toLowerCase() === level.key.toLowerCase()
    );

    if (members.length > 0) {
      html += `
        <div class="w-full flex flex-col items-center">
          <div class="mb-8 relative">
            <span class="px-6 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border-2 ${level.border} ${level.bg} ${level.text} shadow-sm">
              ${level.label}
            </span>
          </div>
          <div class="flex flex-wrap justify-center gap-6 md:gap-10">
            ${members.map(m => renderMemberCard(m, level.border)).join('')}
          </div>
          ${idx < levels.length - 1 && hasLowerMembers(idx, levels) ? `
            <div class="w-px h-10 bg-gray-300 mt-10"></div>
          ` : ''}
        </div>
      `;
    }
  });

  html += '</div>';
  container.innerHTML = dashboardState.membersData.length > 0 ? html : '<p class="text-center text-gray-400 py-10">No organizational data.</p>';
}

function hasLowerMembers(currentIndex, levels) {
  const lowerKeys = levels.slice(currentIndex + 1).map(l => l.key.toLowerCase());
  return dashboardState.membersData.some(m => lowerKeys.includes(String(m.position || '').trim().toLowerCase()));
}

function renderMemberCard(member, borderColor) {
  const name = escapeHtml(member.name || 'Unknown');
  const photo = convertGoogleDriveLink(member.photo);
  const position = escapeHtml(member.stage || 'Member');
  const team = escapeHtml(member.team || member.scout_group || 'General');

  return `
    <div class="flex flex-col items-center w-36 md:w-48 group">
      <div class="node-card w-24 h-24 md:w-32 md:h-32 mb-3 rounded-full overflow-hidden border-[4px] shadow-md group-hover:scale-105 transition-all duration-300 ${borderColor}">
        <img 
          src="${photo || getPlaceholder()}" 
          alt="${name}" 
          class="w-full h-full object-cover"
          onerror="this.src='${getPlaceholder()}'"
        >
      </div>
      <div class="text-center space-y-0.5">
        <p class="text-[14px] md:text-[16px] font-black text-gray-900 leading-tight uppercase tracking-tight">${name}</p>
        <div class="bg-gray-100 px-2 py-0.5 rounded inline-block">
          <p class="text-[9px] md:text-[10px] font-bold text-gray-600 uppercase tracking-tighter">${position}</p>
        </div>
        <p class="text-[10px] md:text-[11px] font-medium text-blue-600 uppercase tracking-tighter">${team}</p>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', fetchDashboardData);