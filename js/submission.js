// =====================================================
// SUBMISSION SYSTEM
// Public form with admin analytics
// =====================================================

let selectedFile = null;
let districts = [];

class SubmissionSystem {
    constructor() {
        this.init();
    }

    async init() {
        try {
            console.log('Initializing submission system...');
            console.log('DOM ready state:', document.readyState);
            
            // Wait a bit for DOM to be fully ready
            if (document.readyState === 'loading') {
                console.log('DOM still loading, waiting...');
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            console.log('DOM is ready, proceeding with initialization...');
            
            await this.loadDistricts();
            this.setupEventListeners();
            this.setupAuthCallbacks();
            this.updateUIBasedOnAuth();
            
            console.log('Submission system initialized successfully');
        } catch (error) {
            console.error('Error initializing submission system:', error);
            this.showError('Failed to initialize submission system: ' + error.message);
        }
    }

    // Load districts from embedded data instead of text file
    async loadDistricts() {
        try {
            console.log('Starting to load districts...');
            
            // Embedded districts data to avoid CORS issues
            districts = [
                'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura',
                'Brahmanbaria', 'Chandpur', 'Chattogram', 'Chuadanga', 'Cox\'s Bazar',
                'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha',
                'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati',
                'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj',
                'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur',
                'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj',
                'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi',
                'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna',
                'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi',
                'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur',
                'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'
            ];
            
            console.log('Districts array created with', districts.length, 'items');
            
            const districtSelect = document.getElementById('district');
            if (!districtSelect) {
                throw new Error('District select element not found in DOM');
            }
            
            console.log('Found district select element, populating options...');
            
            // Clear existing options except the first one (placeholder)
            while (districtSelect.children.length > 1) {
                districtSelect.removeChild(districtSelect.lastChild);
            }
            
            districts.forEach((district, index) => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
                
                if (index < 5) { // Log first 5 for debugging
                    console.log(`Added district ${index + 1}: ${district}`);
                }
            });
            
            console.log('Successfully loaded and populated', districts.length, 'districts');
            
            // Verify the dropdown was populated
            const totalOptions = districtSelect.children.length;
            console.log('Total options in dropdown:', totalOptions, '(including placeholder)');
            
        } catch (error) {
            console.error('Error loading districts:', error);
            this.showError('Failed to load districts data: ' + error.message);
            
            // Fallback: Add a few major districts manually
            const districtSelect = document.getElementById('district');
            if (districtSelect) {
                const fallbackDistricts = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh'];
                fallbackDistricts.forEach(district => {
                    const option = document.createElement('option');
                    option.value = district;
                    option.textContent = district;
                    districtSelect.appendChild(option);
                });
                console.log('Added fallback districts:', fallbackDistricts.length);
            }
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('-translate-x-full');
            document.getElementById('menuOverlay').classList.remove('hidden');
        });

        document.getElementById('menuOverlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('menuOverlay').classList.add('hidden');
        });

        // Form submission
        document.getElementById('submissionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmission();
        });

        // File drag and drop
        const uploadArea = document.querySelector('.file-upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect({ target: { files } });
                }
            });
        }

        // Analytics button
        document.getElementById('viewAnalyticsBtn')?.addEventListener('click', () => {
            this.openAnalyticsModal();
        });
    }

    setupAuthCallbacks() {
        // Listen for universal auth changes
        document.addEventListener('universalAuthChange', (e) => {
            const { isAuthenticated } = e.detail;
            console.log('Submission: Auth change detected:', isAuthenticated);
            this.updateUIBasedOnAuth(isAuthenticated);
        });
    }

    updateUIBasedOnAuth(isAuthenticated = null) {
        if (isAuthenticated === null) {
            isAuthenticated = window.isAuthenticated ? window.isAuthenticated() : false;
        }

        const analyticsBtn = document.getElementById('viewAnalyticsBtn');
        
        if (isAuthenticated) {
            if (analyticsBtn) analyticsBtn.classList.remove('hidden');
        } else {
            if (analyticsBtn) analyticsBtn.classList.add('hidden');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Please select a PDF, PNG, or JPG file');
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showError('File size must be less than 10MB');
            return;
        }

        selectedFile = file;
        this.showFilePreview(file);
    }

    showFilePreview(file) {
        const placeholder = document.getElementById('uploadPlaceholder');
        const preview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);

        placeholder.classList.add('hidden');
        preview.classList.remove('hidden');
    }

    clearFile() {
        selectedFile = null;
        const placeholder = document.getElementById('uploadPlaceholder');
        const preview = document.getElementById('filePreview');
        
        placeholder.classList.remove('hidden');
        preview.classList.add('hidden');
        
        document.getElementById('fileInput').value = '';
    }

    async handleSubmission() {
        try {
            // Validate form
            const formData = this.validateForm();
            if (!formData) return;

            this.setSubmitLoading(true);

            // Simulate file upload (in production, upload to cloud storage)
            const fileUrl = await this.uploadFile(selectedFile);
            
            // Save submission to database
            const submissionData = {
                category: formData.category,
                team_name: formData.teamName,
                full_name: formData.fullName,
                district: formData.district,
                file_url: fileUrl,
                file_name: selectedFile.name,
                file_size: selectedFile.size,
                file_type: selectedFile.type,
                submitted_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('prm_submissions')
                .insert([submissionData])
                .select();

            if (error) throw error;

            this.showSuccess('Document submitted successfully! Your submission ID is: ' + data[0].id);
            this.resetForm();

        } catch (error) {
            console.error('Submission error:', error);
            this.showError('Failed to submit document: ' + error.message);
        } finally {
            this.setSubmitLoading(false);
        }
    }

    validateForm() {
        const category = document.getElementById('category').value;
        const teamName = document.getElementById('teamName').value;
        const fullName = document.getElementById('fullName').value.trim();
        const district = document.getElementById('district').value;

        if (!category) {
            this.showError('Please select a category');
            return null;
        }

        if (!teamName) {
            this.showError('Please select a team name');
            return null;
        }

        if (!fullName) {
            this.showError('Please enter your full name');
            return null;
        }

        if (!district) {
            this.showError('Please select your district');
            return null;
        }

        if (!selectedFile) {
            this.showError('Please upload a document');
            return null;
        }

        return { category, teamName, fullName, district };
    }

    async uploadFile(file) {
        // In production, upload to cloud storage (Cloudinary, AWS S3, etc.)
        // For demo, we'll create a data URL
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

    resetForm() {
        document.getElementById('submissionForm').reset();
        this.clearFile();
    }

    setSubmitLoading(loading) {
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const submitLoader = document.getElementById('submitLoader');

        if (loading) {
            submitBtn.disabled = true;
            submitText.classList.add('hidden');
            submitLoader.classList.remove('hidden');
        } else {
            submitBtn.disabled = false;
            submitText.classList.remove('hidden');
            submitLoader.classList.add('hidden');
        }
    }

    // Analytics functionality (admin only)
    async openAnalyticsModal() {
        if (!window.isAuthenticated || !window.isAuthenticated()) {
            if (window.showAuthModal) {
                window.showAuthModal();
            }
            return;
        }

        document.getElementById('analyticsModal').classList.remove('hidden');
        await this.loadAnalytics();
    }

    closeAnalyticsModal() {
        document.getElementById('analyticsModal').classList.add('hidden');
    }

    async loadAnalytics() {
        const content = document.getElementById('analyticsContent');
        content.innerHTML = '<div class="text-center py-8"><div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div><p>Loading analytics...</p></div>';

        try {
            // Get all submissions
            const { data: submissions, error } = await supabaseClient
                .from('prm_submissions')
                .select('*')
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            this.renderAnalytics(submissions || []);

        } catch (error) {
            console.error('Error loading analytics:', error);
            content.innerHTML = '<div class="text-center py-8 text-red-600">Failed to load analytics</div>';
        }
    }

    renderAnalytics(submissions) {
        const content = document.getElementById('analyticsContent');
        
        if (submissions.length === 0) {
            content.innerHTML = '<div class="text-center py-8 text-gray-500">No submissions found</div>';
            return;
        }

        // Calculate statistics
        const stats = this.calculateStats(submissions);
        
        content.innerHTML = `
            <!-- Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span class="text-blue-600 text-xl">📄</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-blue-900">${stats.total}</p>
                            <p class="text-sm text-blue-600">Total Submissions</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <span class="text-green-600 text-xl">👥</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-green-900">${stats.teams}</p>
                            <p class="text-sm text-green-600">Active Teams</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span class="text-purple-600 text-xl">📊</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-purple-900">${stats.categories}</p>
                            <p class="text-sm text-purple-600">Categories</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span class="text-orange-600 text-xl">🗺️</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-orange-900">${stats.districts}</p>
                            <p class="text-sm text-orange-600">Districts</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Team Statistics -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Submissions by Team</h3>
                    <div class="space-y-3">
                        ${this.renderTeamStats(stats.teamStats)}
                    </div>
                </div>
                
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Submissions by Category</h3>
                    <div class="space-y-3">
                        ${this.renderCategoryStats(stats.categoryStats)}
                    </div>
                </div>
            </div>

            <!-- Recent Submissions -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Recent Submissions</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 border-b">
                            <tr>
                                <th class="px-4 py-3 text-left font-bold">ID</th>
                                <th class="px-4 py-3 text-left font-bold">Name</th>
                                <th class="px-4 py-3 text-left font-bold">Team</th>
                                <th class="px-4 py-3 text-left font-bold">Category</th>
                                <th class="px-4 py-3 text-left font-bold">District</th>
                                <th class="px-4 py-3 text-left font-bold">Date</th>
                                <th class="px-4 py-3 text-left font-bold">File</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${submissions.slice(0, 20).map(submission => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 font-mono text-xs">#${submission.id}</td>
                                    <td class="px-4 py-3 font-medium">${this.escapeHtml(submission.full_name)}</td>
                                    <td class="px-4 py-3">${this.escapeHtml(submission.team_name)}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                            ${this.escapeHtml(submission.category)}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">${this.escapeHtml(submission.district)}</td>
                                    <td class="px-4 py-3">${this.formatDate(submission.submitted_at)}</td>
                                    <td class="px-4 py-3">
                                        <button onclick="submissionSystem.viewFile('${submission.file_url}', '${submission.file_name}', '${submission.file_type}')" 
                                                class="text-blue-600 hover:text-blue-800 font-medium text-sm">
                                            📎 View
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    calculateStats(submissions) {
        const teamStats = {};
        const categoryStats = {};
        const districts = new Set();

        submissions.forEach(submission => {
            // Team stats
            if (!teamStats[submission.team_name]) {
                teamStats[submission.team_name] = 0;
            }
            teamStats[submission.team_name]++;

            // Category stats
            if (!categoryStats[submission.category]) {
                categoryStats[submission.category] = 0;
            }
            categoryStats[submission.category]++;

            // Districts
            districts.add(submission.district);
        });

        return {
            total: submissions.length,
            teams: Object.keys(teamStats).length,
            categories: Object.keys(categoryStats).length,
            districts: districts.size,
            teamStats,
            categoryStats
        };
    }

    renderTeamStats(teamStats) {
        return Object.entries(teamStats)
            .sort(([,a], [,b]) => b - a)
            .map(([team, count]) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span class="font-medium text-gray-900">${this.escapeHtml(team)}</span>
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-bold rounded-full">${count}</span>
                </div>
            `).join('');
    }

    renderCategoryStats(categoryStats) {
        const colors = {
            'Unit NOC': 'bg-green-100 text-green-800',
            'District NOC': 'bg-blue-100 text-blue-800',
            'Resignation': 'bg-red-100 text-red-800',
            'Others': 'bg-gray-100 text-gray-800'
        };

        return Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .map(([category, count]) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span class="font-medium text-gray-900">${this.escapeHtml(category)}</span>
                    <span class="px-3 py-1 ${colors[category] || 'bg-gray-100 text-gray-800'} text-sm font-bold rounded-full">${count}</span>
                </div>
            `).join('');
    }

    viewFile(fileUrl, fileName, fileType) {
        // Create modal to view file
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80';
        
        let content = '';
        if (fileType === 'application/pdf') {
            content = `<iframe src="${fileUrl}" class="w-full h-full max-w-4xl max-h-[90vh] bg-white rounded-lg"></iframe>`;
        } else if (fileType.startsWith('image/')) {
            content = `<img src="${fileUrl}" class="max-w-full max-h-[90vh] rounded-lg shadow-lg" alt="${fileName}">`;
        }

        modal.innerHTML = `
            <div class="relative">
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold z-10">
                    ✕
                </button>
                ${content}
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Utility functions
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }

    showSuccess(message) {
        const alert = document.getElementById('successAlert');
        const messageEl = document.getElementById('successMessage');
        if (alert && messageEl) {
            messageEl.textContent = message;
            alert.classList.remove('hidden');
            alert.classList.add('success-animation');
            setTimeout(() => {
                alert.classList.add('hidden');
                alert.classList.remove('success-animation');
            }, 5000);
        }
    }

    showError(message) {
        const alert = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        if (alert && messageEl) {
            messageEl.textContent = message;
            alert.classList.remove('hidden');
            setTimeout(() => alert.classList.add('hidden'), 5000);
        }
    }
}

// Global functions
function handleFileSelect(event) {
    submissionSystem.handleFileSelect(event);
}

function clearFile() {
    submissionSystem.clearFile();
}

function closeAnalyticsModal() {
    submissionSystem.closeAnalyticsModal();
}

// Initialize submission system
let submissionSystem;

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSubmissionSystem);
} else {
    // DOM is already loaded
    initializeSubmissionSystem();
}

function initializeSubmissionSystem() {
    console.log('DOM loaded, initializing submission system...');
    try {
        submissionSystem = new SubmissionSystem();
    } catch (error) {
        console.error('Failed to initialize submission system:', error);
        
        // Show error message to user
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        if (errorAlert && errorMessage) {
            errorMessage.textContent = 'Failed to initialize submission system. Please refresh the page.';
            errorAlert.classList.remove('hidden');
        }
    }
}