// Standings and Ranking System
class StandingsManager {
    constructor() {
        this.tournamentLogic = new TournamentLogic();
        this.qualificationSpots = 2; // Top 2 from each group qualify
    }
    
    async init() {
        await this.loadStandings();
        await this.loadPlayers();
        await this.loadMatches();
        this.renderStandings();
        this.renderQualificationPredictions();
    }
    
    async loadStandings() {
        try {
            const response = await fetch('/tables/standings');
            const data = await response.json();
            window.tournamentManager.standings = data.data || [];
            return window.tournamentManager.standings;
        } catch (error) {
            console.error('Error loading standings:', error);
            window.tournamentManager.showToast('Error loading standings', 'error');
            return [];
        }
    }
    
    async loadPlayers() {
        try {
            const response = await fetch('/tables/players');
            const data = await response.json();
            window.tournamentManager.players = data.data || [];
            return window.tournamentManager.players;
        } catch (error) {
            console.error('Error loading players:', error);
            return [];
        }
    }
    
    async loadMatches() {
        try {
            const response = await fetch('/tables/matches');
            const data = await response.json();
            window.tournamentManager.matches = data.data || [];
            return window.tournamentManager.matches;
        } catch (error) {
            console.error('Error loading matches:', error);
            return [];
        }
    }
    
    renderStandings() {
        const container = document.getElementById('standingsContainer');
        const standings = window.tournamentManager.standings;
        const players = window.tournamentManager.players;
        
        if (standings.length === 0) {
            container.innerHTML = `
                <div class="py-20 text-center bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <i class="fas fa-layer-group text-gray-200 dark:text-gray-800 text-6xl mb-4"></i>
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-sm">No standings data available</p>
                </div>
            `;
            return;
        }
        
        // Group standings by group
        const standingsByGroup = {};
        standings.forEach(standing => {
            if (!standingsByGroup[standing.group_id]) {
                standingsByGroup[standing.group_id] = [];
            }
            standingsByGroup[standing.group_id].push(standing);
        });
        
        container.innerHTML = Object.keys(standingsByGroup).sort().map(groupId => {
            const groupStandings = standingsByGroup[groupId];
            const sortedStandings = this.tournamentLogic.sortStandings(groupStandings);
            const groupColor = this.getGroupColorClass(groupId);
            
            return `
                <div class="card !p-0 overflow-hidden border-none shadow-xl">
                    <div class="bg-gray-50 dark:bg-gray-800/50 px-6 py-5 border-b dark:border-gray-700 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-2 h-8 rounded-full ${groupColor}"></div>
                            <h3 class="text-xl font-black uppercase tracking-tight">GROUP ${groupId} STANDINGS</h3>
                        </div>
                        <span class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Live Updates</span>
                    </div>
                    <div class="overflow-x-auto no-scrollbar">
                        <table class="w-full text-left">
                            <thead class="bg-white dark:bg-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                                <tr>
                                    <th class="px-6 py-4">Rank</th>
                                    <th class="px-6 py-4">Player</th>
                                    <th class="px-4 py-4 text-center">MP</th>
                                    <th class="px-4 py-4 text-center">W</th>
                                    <th class="px-4 py-4 text-center">SW</th>
                                    <th class="px-4 py-4 text-center">SD</th>
                                    <th class="px-4 py-4 text-center">Net Pts</th>
                                    <th class="px-6 py-4 text-center">Pts</th>
                                    <th class="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y dark:divide-gray-700">
                                ${sortedStandings.map((standing, index) => {
                                    const player = players.find(p => p.id === standing.player_id);
                                    const isQualified = index < this.qualificationSpots;
                                    const setDiff = standing.sets_won - standing.sets_lost;
                                    const pointDiff = standing.points_for - standing.points_against;
                                    
                                    return `
                                        <tr class="${isQualified ? 'bg-green-50/30 dark:bg-green-900/5' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all">
                                            <td class="px-6 py-5">
                                                <div class="flex items-center space-x-2">
                                                    <span class="text-lg font-black text-gray-800 dark:text-gray-100">${index + 1}</span>
                                                    ${this.getMovementIndicator(standing, index)}
                                                </div>
                                            </td>
                                            <td class="px-6 py-5">
                                                <div class="flex items-center space-x-3">
                                                    <div class="w-10 h-10 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                                        <img src="${player?.avatar_url || 'assets/images/default_avatar.png'}" 
                                                             class="w-full h-full object-cover" 
                                                             onerror="this.src='assets/images/default_avatar.png'; this.onerror=null;">
                                                    </div>
                                                    <div>
                                                        <div class="font-bold text-sm text-gray-800 dark:text-gray-100">${player?.name || 'Unknown'}</div>
                                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Group ${groupId}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="px-4 py-5 text-center font-bold text-gray-600 dark:text-gray-400 text-sm">${standing.matches_played}</td>
                                            <td class="px-4 py-5 text-center font-black text-green-600 text-sm">${standing.wins}</td>
                                            <td class="px-4 py-5 text-center font-bold text-gray-800 dark:text-gray-200 text-sm">${standing.sets_won}</td>
                                            <td class="px-4 py-5 text-center text-sm font-black ${setDiff >= 0 ? 'text-blue-500' : 'text-red-500'}">
                                                ${setDiff >= 0 ? '+' : ''}${setDiff}
                                            </td>
                                            <td class="px-4 py-5 text-center text-sm font-medium ${pointDiff >= 0 ? 'text-gray-500' : 'text-red-400'}">
                                                ${pointDiff >= 0 ? '+' : ''}${pointDiff}
                                            </td>
                                            <td class="px-6 py-5 text-center">
                                                <span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                                                    ${standing.ranking_points} pts
                                                </span>
                                            </td>
                                            <td class="px-6 py-5 text-center">
                                                ${isQualified ? 
                                                    '<span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 uppercase tracking-widest"><i class="fas fa-check-circle mr-1.5"></i>Qualified</span>' :
                                                    '<span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 uppercase tracking-widest"><i class="fas fa-clock mr-1.5"></i>Pending</span>'
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }

    getGroupColorClass(groupId) {
        const colors = {
            'A': 'bg-blue-600',
            'B': 'bg-green-600',
            'C': 'bg-orange-600',
            'D': 'bg-purple-600'
        };
        return colors[groupId] || 'bg-gray-600';
    }
    
    renderQualificationPredictions() {
        const container = document.getElementById('qualificationPredictions');
        const standings = window.tournamentManager.standings;
        const players = window.tournamentManager.players;
        
        if (standings.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // Group standings by group
        const standingsByGroup = {};
        standings.forEach(standing => {
            if (!standingsByGroup[standing.group_id]) {
                standingsByGroup[standing.group_id] = [];
            }
            standingsByGroup[standing.group_id].push(standing);
        });
        
        const predictions = [];
        Object.keys(standingsByGroup).forEach(groupId => {
            const groupStandings = standingsByGroup[groupId];
            const sortedStandings = this.tournamentLogic.sortStandings(groupStandings);
            const probabilities = this.tournamentLogic.calculateQualificationProbabilities(
                sortedStandings, 
                sortedStandings.length, 
                this.qualificationSpots
            );
            
            sortedStandings.forEach((standing, index) => {
                const player = players.find(p => p.id === standing.player_id);
                const probability = probabilities[standing.id] || 0;
                
                predictions.push({
                    player: player?.name || 'Unknown',
                    group: groupId,
                    rank: index + 1,
                    probability: probability,
                    points: standing.ranking_points,
                    isQualified: index < this.qualificationSpots
                });
            });
        });
        
        // Sort by probability
        predictions.sort((a, b) => b.probability - a.probability);
        
        container.innerHTML = `
            <div class="card !p-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 border-none shadow-2xl relative overflow-hidden">
                <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h3 class="text-2xl font-black text-white uppercase tracking-tight mb-2 flex items-center">
                            <i class="fas fa-magic mr-3"></i>AI QUALIFICATION FORECAST
                        </h3>
                        <p class="text-indigo-100 font-bold text-xs uppercase tracking-[0.2em] opacity-80">Next-round probability analysis</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 relative z-10">
                    ${predictions.slice(0, 6).map(prediction => `
                        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all group/pred">
                            <div class="flex justify-between items-center mb-4">
                                <div>
                                    <span class="text-white font-black text-sm block">${prediction.player}</span>
                                    <span class="text-white/60 font-black text-[9px] uppercase tracking-widest">GROUP ${prediction.group} • RANK ${prediction.rank}</span>
                                </div>
                                <div class="text-right">
                                    <span class="text-2xl font-black text-white">${prediction.probability.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div class="bg-white/20 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-white h-full rounded-full transition-all duration-1000 ease-out group-hover/pred:brightness-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style="width: ${prediction.probability}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    getMovementIndicator(standing, currentIndex) {
        // This is a simplified version - in a real app, you'd track historical positions
        const previousIndex = currentIndex; // For now, assume no movement
        
        if (currentIndex < previousIndex) {
            return '<i class="fas fa-arrow-up text-green-500 ml-2"></i>';
        } else if (currentIndex > previousIndex) {
            return '<i class="fas fa-arrow-down text-red-500 ml-2"></i>';
        } else {
            return '<i class="fas fa-minus text-gray-400 ml-2"></i>';
        }
    }
    
    getGroupColor(groupId) {
        const colors = {
            'A': 'border-blue-500',
            'B': 'border-green-500',
            'C': 'border-yellow-500',
            'D': 'border-red-500'
        };
        return colors[groupId] || 'border-gray-500';
    }
    
    async recalculateStandings() {
        try {
            window.tournamentManager.showLoading(true);
            
            const response = await fetch('/api/recalculate-standings', {
                method: 'POST'
            });
            
            if (response.ok) {
                window.tournamentManager.showToast('Standings recalculated', 'success');
                await this.loadStandings();
                this.renderStandings();
                this.renderQualificationPredictions();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to recalculate standings');
            }
            
        } catch (error) {
            console.error('Error recalculating standings:', error);
            window.tournamentManager.showToast(error.message || 'Error recalculating standings', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }
}

// Initialize standings manager
window.standingsManager = new StandingsManager();

// Extend the main tournament manager
document.addEventListener('DOMContentLoaded', () => {
    if (window.tournamentManager) {
        window.tournamentManager.loadStandings = () => window.standingsManager.init();
    }
});