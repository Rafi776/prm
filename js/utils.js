/**
 * Global Utilities for PRM Admin
 */

const PRM_Utils = {
  // Convert Drive Link to Direct Image
  getDriveImage: function(url, size = 'w200') {
    if (!url || !url.includes('drive.google.com')) return url;
    try {
      const idMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      if (idMatch && idMatch[1]) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=${size}`;
    } catch (e) { console.error("Image Error:", e); }
    return url;
  },

  // Generic Modal Opener
  showMemberDetails: function(memberData) {
    const modal = document.getElementById('memberModal');
    if (!modal) return;

    // 1. Handle Photo
    const photoContainer = document.getElementById('modalPhotoContainer');
    const photoUrl = this.getDriveImage(memberData.photo, 'w600');
    photoContainer.innerHTML = memberData.photo 
      ? `<img src="${photoUrl}" class="w-full h-full object-cover" alt="Profile">`
      : `<div class="w-full h-full flex items-center justify-center text-gray-300">No Photo</div>`;

    // 2. Handle Title/Subtitle
    document.getElementById('modalMemberName').textContent = memberData.name || memberData.full_name || "Profile Details";
    document.getElementById('modalMemberSubtitle').textContent = memberData.team || memberData.role || "Member";

    // 3. Populate Grid (Excluding specific keys)
    const grid = document.getElementById('modalDetailsGrid');
    grid.innerHTML = '';
    const ignoreKeys = ['id', 'photo', 'created_at', 'password'];
    
    Object.entries(memberData).forEach(([key, value]) => {
      if (ignoreKeys.includes(key.toLowerCase())) return;
      grid.innerHTML += `
        <div class="border-b border-gray-50 pb-2">
          <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest">${key.replace(/_/g, ' ')}</label>
          <p class="text-gray-800 font-medium">${value || '—'}</p>
        </div>`;
    });

    // 4. Show Modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

// Global close function
function closeMemberModal() {
  const modal = document.getElementById('memberModal');
  if(modal) modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// Close on background click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.onclick = closeMemberModal;
});