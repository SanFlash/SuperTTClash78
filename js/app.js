// Table Tennis Tournament Manager - Main Application
class TournamentManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.currentGroup = 'ALL';
        this.players = [];
        this.matches = [];
        this.standings = [];
        this.charts = {};
        this.isConnected = false;
        this.darkMode = localStorage.getItem('darkMode') === 'true';
        
        this.init();
    }
    
    async init() {
        this.applyDarkMode();
        this.setupEventListeners();
        this.initializeCharts();
        await this.loadInitialData();
        this.startRealTimeUpdates();
        this.updateConnectionStatus(true);
    }
    
    setupEventListeners() {
        // Tab navigation
        window.showTab = (tabName) => this.showTab(tabName);
        window.toggleDarkMode = () => this.toggleDarkMode();
        window.toggleMobileMenu = () => this.toggleMobileMenu();
        
        // Tournament functions
        window.addPlayer = () => this.addPlayer();
        window.generateFixtures = () => this.generateFixtures();
        window.filterGroup = (group) => this.filterGroup(group);
        window.loadAvailableMatches = () => this.loadAvailableMatches();
        window.loadMatchDetails = () => this.loadMatchDetails();
        window.submitMatchResult = () => this.submitMatchResult();
        window.clearMatchForm = () => this.clearMatchForm();
        window.deleteFixtures = () => this.deleteFixtures();
    }
    
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // Update sidebar navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.id === `nav-${tabName}`) {
                item.classList.add('active');
            }
        });
        
        // Load tab-specific data
        this.loadTabData(tabName);

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'fixtures':
                await this.loadFixtures();
                break;
            case 'standings':
                await this.loadStandings();
                break;
            case 'matches':
                await this.loadMatchEntry();
                break;
            case 'players':
                if (window.fixturesManager) window.fixturesManager.renderPlayersList();
                break;
        }
    }
    
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadPlayers(),
                this.loadMatches(),
                this.loadStandings()
            ]);
            this.updateDashboard();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showToast('Error loading data', 'error');
        }
    }
    
    async loadPlayers() {
        try {
            const response = await fetch('/tables/players');
            const data = await response.json();
            this.players = data.data || [];
            return this.players;
        } catch (error) {
            console.error('Error loading players:', error);
            return [];
        }
    }
    
    async loadMatches() {
        try {
            const response = await fetch('/tables/matches');
            const data = await response.json();
            this.matches = data.data || [];
            return this.matches;
        } catch (error) {
            console.error('Error loading matches:', error);
            return [];
        }
    }
    
    async loadStandings() {
        try {
            const response = await fetch('/tables/standings');
            const data = await response.json();
            this.standings = data.data || [];
            return this.standings;
        } catch (error) {
            console.error('Error loading standings:', error);
            return [];
        }
    }
    
    async updateDashboard() {
        await this.loadPlayers();
        await this.loadMatches();
        
        // Update statistics
        document.getElementById('totalPlayers').textContent = this.players.length;
        document.getElementById('totalMatches').textContent = this.matches.length;
        document.getElementById('completedMatches').textContent = this.matches.filter(m => m.status === 'completed').length;
        
        const activeGroups = new Set(this.players.map(p => p.group_id)).size;
        document.getElementById('activeGroups').textContent = activeGroups;
        
        // Update charts
        this.updateCharts();
        
        // Update recent activity
        this.updateRecentActivity();
    }
    
    initializeCharts() {
        // Group statistics chart
        const groupCtx = document.getElementById('groupChart').getContext('2d');
        this.charts.groupChart = new Chart(groupCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B', '#EF4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        
        // Progress chart
        const progressCtx = document.getElementById('progressChart').getContext('2d');
        this.charts.progressChart = new Chart(progressCtx, {
            type: 'bar',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    label: 'Matches',
                    data: [0, 0],
                    backgroundColor: ['#10B981', '#F59E0B']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    updateCharts() {
        if (!this.charts.groupChart || !this.charts.progressChart) return;
        
        // Update group chart
        const groupCounts = {};
        this.players.forEach(player => {
            groupCounts[player.group_id] = (groupCounts[player.group_id] || 0) + 1;
        });
        
        this.charts.groupChart.data.labels = Object.keys(groupCounts);
        this.charts.groupChart.data.datasets[0].data = Object.values(groupCounts);
        this.charts.groupChart.update();
        
        // Update progress chart
        const completed = this.matches.filter(m => m.status === 'completed').length;
        const pending = this.matches.filter(m => m.status === 'pending').length;
        
        this.charts.progressChart.data.datasets[0].data = [completed, pending];
        this.charts.progressChart.update();
    }
    
    updateRecentActivity() {
        const container = document.getElementById('recentActivity');
        const recentMatches = this.matches
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 5);
        
        if (recentMatches.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No recent tournament activity</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentMatches.map(match => {
            const player1 = this.players.find(p => p.id === match.player1_id);
            const player2 = this.players.find(p => p.id === match.player2_id);
            const winner = this.players.find(p => p.id === match.winner_id);
            
            let setSummary = '';
            if (match.scores && match.scores.length > 0) {
                const s = match.scores;
                const p1Sets = s.filter(x => x.player1_score > x.player2_score).length;
                const p2Sets = s.filter(x => x.player2_score > x.player1_score).length;
                setSummary = `<span class="text-[10px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full ml-2">${p1Sets}-${p2Sets}</span>`;
            }

            return `
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-blue-500/10 transition-all duration-300 shadow-sm relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="flex items-center space-x-4">
                        <div class="flex -space-x-4">
                            <div class="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden shadow-sm">
                                <img src="${player1?.avatar_url || 'assets/images/default_avatar.png'}" class="w-full h-full object-cover">
                            </div>
                            <div class="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden shadow-sm relative z-10">
                                <img src="${player2?.avatar_url || 'assets/images/default_avatar.png'}" class="w-full h-full object-cover">
                            </div>
                        </div>
                        <div>
                            <div class="font-black text-gray-800 dark:text-gray-100 text-xs">${player1?.name || 'P1'} vs ${player2?.name || 'P2'} ${setSummary}</div>
                            <div class="flex items-center space-x-2">
                                <span class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Group ${match.group_id}</span>
                                <span class="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span class="text-[9px] text-green-500 font-black uppercase">${winner?.name || 'TBD'} WON</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] text-gray-400 font-bold">${new Date(match.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        this.applyDarkMode();
    }
    
    applyDarkMode() {
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
    
    toggleMobileMenu() {
        const menu = document.getElementById('mobileMenu');
        menu.classList.toggle('active');
    }
    
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const indicator = document.getElementById('connectionIndicator');
        const text = document.getElementById('connectionText');
        
        if (indicator && text) {
            if (connected) {
                indicator.className = 'w-2.5 h-2.5 rounded-full bg-green-500 scale-110 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
                text.textContent = 'CONNECTED';
                text.className = 'text-xs font-bold text-green-600 dark:text-green-400';
            } else {
                indicator.className = 'w-2.5 h-2.5 rounded-full bg-red-500 scale-110';
                text.textContent = 'DISCONNECTED';
                text.className = 'text-xs font-bold text-gray-600 dark:text-gray-300';
            }
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        
        const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
        const icon = type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        
        toast.className = `transform translate-x-full transition-all duration-500 ease-out bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 flex items-center space-x-4 border-l-4 ${type === 'error' ? 'border-red-600' : type === 'success' ? 'border-green-600' : 'border-blue-600'} pointer-events-auto min-w-[300px]`;
        toast.innerHTML = `
            <div class="w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shadow-lg">
                <i class="fas ${icon} text-white"></i>
            </div>
            <div class="flex-grow">
                <div class="font-black text-xs text-gray-400 uppercase tracking-widest mb-0.5">${type}</div>
                <div class="text-gray-800 dark:text-gray-100 font-bold text-sm">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }
    
    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('hidden', !show);
    }
    
    startRealTimeUpdates() {
        // Periodic data refresh
        setInterval(async () => {
            if (this.isConnected) {
                await this.loadTabData(this.currentTab);
            }
        }, 10000); // Poll every 10 seconds
        
        // Ensure connection status stays true if backend responded
        this.updateConnectionStatus(true);
    }
    
    // Tournament-specific methods to be implemented in other files
    async loadFixtures() {
        // To be implemented in fixtures.js
        console.log('Loading fixtures...');
    }
    
    async loadStandings() {
        // To be implemented in standings.js
        console.log('Loading standings...');
    }
    
    async loadMatchEntry() {
        // To be implemented in matches.js
        console.log('Loading match entry...');
    }
    
    async addPlayer() {
        // To be implemented in fixtures.js
        console.log('Adding player...');
    }
    
    async generateFixtures() {
        // To be implemented in fixtures.js
        console.log('Generating fixtures...');
    }
    
    async deleteFixtures() {
        // To be implemented in fixtures.js
        console.log('Deleting fixtures...');
    }

    async filterGroup(group) {
        // To be implemented in fixtures.js
        console.log('Filtering group:', group);
    }
    
    async loadAvailableMatches() {
        // To be implemented in matches.js
        console.log('Loading available matches...');
    }
    
    async loadMatchDetails() {
        // To be implemented in matches.js
        console.log('Loading match details...');
    }
    
    async submitMatchResult() {
        // To be implemented in matches.js
        console.log('Submitting match result...');
    }
    
    async clearMatchForm() {
        // To be implemented in matches.js
        console.log('Clearing match form...');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tournamentManager = new TournamentManager();
});

// Global functions for HTML onclick handlers
window.showTab = (tabName) => window.tournamentManager?.showTab(tabName);
window.toggleDarkMode = () => window.tournamentManager?.toggleDarkMode();
window.toggleMobileMenu = () => window.tournamentManager?.toggleMobileMenu();