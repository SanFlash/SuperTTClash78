// Fixtures Management Module
class FixturesManager {
    constructor() {
        this.tournamentLogic = new TournamentLogic();
        this.currentGroup = 'ALL';
    }
    
    async init() {
        await this.loadPlayers();
        await this.loadFixtures();
        this.renderPlayersList();
        this.renderFixtures();
    }
    
    async loadPlayers() {
        try {
            const response = await fetch('/tables/players');
            const data = await response.json();
            window.tournamentManager.players = data.data || [];
            return window.tournamentManager.players;
        } catch (error) {
            console.error('Error loading players:', error);
            window.tournamentManager.showToast('Error loading players', 'error');
            return [];
        }
    }
    
    async loadFixtures() {
        try {
            const response = await fetch('/tables/matches');
            const data = await response.json();
            window.tournamentManager.matches = data.data || [];
            return window.tournamentManager.matches;
        } catch (error) {
            console.error('Error loading fixtures:', error);
            window.tournamentManager.showToast('Error loading fixtures', 'error');
            return [];
        }
    }
    
    async addPlayer() {
        const name = document.getElementById('newPlayerName').value.trim();
        const groupId = document.getElementById('newPlayerGroup').value;
        
        if (!name) {
            window.tournamentManager.showToast('Please enter player name', 'error');
            return;
        }
        
        try {
            window.tournamentManager.showLoading(true);
            
            const avatarUrl = document.getElementById('newPlayerAvatarUrl')?.value || '';
            
            const playerData = {
                name: name,
                group_id: groupId,
                avatar_url: avatarUrl,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            const response = await fetch('/tables/players', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(playerData)
            });
            
            if (response.ok) {
                const newPlayer = await response.json();
                window.tournamentManager.players.push(newPlayer);
                
                // Create initial standing
                await this.createInitialStanding(newPlayer.id, groupId);
                
                document.getElementById('newPlayerName').value = '';
                if (document.getElementById('newPlayerAvatarUrl')) {
                    document.getElementById('newPlayerAvatarUrl').value = '';
                    document.getElementById('newPlayerAvatarPreview').src = 'assets/images/default_avatar.png';
                }
                
                window.tournamentManager.showToast('Player added successfully', 'success');
                
                this.renderPlayersList();
                await this.updateDashboard();
            } else {
                throw new Error('Failed to add player');
            }
        } catch (error) {
            console.error('Error adding player:', error);
            window.tournamentManager.showToast('Error adding player', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }
    
    async createInitialStanding(playerId, groupId) {
        try {
            const standingData = {
                player_id: playerId,
                group_id: groupId,
                matches_played: 0,
                wins: 0,
                losses: 0,
                sets_won: 0,
                sets_lost: 0,
                points_for: 0,
                points_against: 0,
                ranking_points: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            await fetch('/tables/standings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(standingData)
            });
        } catch (error) {
            console.error('Error creating initial standing:', error);
        }
    }
    
    async generateFixtures() {
        try {
            window.tournamentManager.showLoading(true);
            
            const maxSetsEl = document.getElementById('max-sets');
            const maxSets = maxSetsEl ? parseInt(maxSetsEl.value) : 5;
            
            const response = await fetch('/api/generate-fixtures', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    group_id: this.currentGroup,
                    tournament_type: 'league',
                    max_sets: maxSets
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                window.tournamentManager.showToast(data.message || 'Fixtures generated successfully', 'success');
                await this.loadFixtures();
                this.renderFixtures();
                await this.updateDashboard();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate fixtures');
            }
            
        } catch (error) {
            console.error('Error generating fixtures:', error);
            window.tournamentManager.showToast(error.message || 'Error generating fixtures', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }

    async deleteFixtures() {
        if (!confirm(`Are you sure you want to delete all fixtures for ${this.currentGroup === 'ALL' ? 'all groups' : 'Group ' + this.currentGroup}? This cannot be undone.`)) {
            return;
        }

        try {
            window.tournamentManager.showLoading(true);
            
            const response = await fetch('/api/generate-fixtures', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    group_id: this.currentGroup
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                window.tournamentManager.showToast(data.message || 'Fixtures deleted successfully', 'success');
                await this.loadFixtures();
                this.renderFixtures();
                await this.updateDashboard();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete fixtures');
            }
            
        } catch (error) {
            console.error('Error deleting fixtures:', error);
            window.tournamentManager.showToast(error.message || 'Error deleting fixtures', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }

    async deleteMatch(matchId) {
        if (!confirm('Are you sure you want to delete this specific fixture?')) return;
        
        try {
            window.tournamentManager.showLoading(true);
            const response = await fetch(`/api/matches/${matchId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                window.tournamentManager.showToast('Fixture deleted successfully', 'success');
                await this.loadFixtures();
                this.renderFixtures();
                await this.updateDashboard();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete fixture');
            }
        } catch (error) {
            console.error('Error deleting fixture:', error);
            window.tournamentManager.showToast(error.message || 'Error deleting fixture', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }
    
    renderPlayersList() {
        const container = document.getElementById('playersList');
        const players = window.tournamentManager.players;
        
        if (players.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <i class="fas fa-users text-gray-200 dark:text-gray-800 text-6xl mb-4"></i>
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-sm">No players registered</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = players.map(player => {
            const groupColor = this.getGroupColorClass(player.group_id);
            return `
                <div class="card !p-4 !mb-0 group/player hover:ring-2 ring-blue-500/20 transition-all">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                            <img src="${player.avatar_url || 'assets/images/default_avatar.png'}" 
                                 class="w-full h-full object-cover" 
                                 onerror="this.src='assets/images/default_avatar.png'; this.onerror=null;">
                        </div>
                        <div class="flex-grow min-w-0">
                            <h4 class="font-black text-sm text-gray-800 dark:text-gray-100 truncate">${player.name}</h4>
                            <div class="flex items-center space-x-2">
                                <span class="bg-gray-100 dark:bg-gray-800 text-[9px] font-black px-1.5 py-0.5 rounded text-gray-500 uppercase">Group ${player.group_id}</span>
                            </div>
                        </div>
                        <button onclick="window.fixturesManager.deletePlayer('${player.id}')" class="opacity-100 sm:opacity-0 group-hover/player:opacity-100 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
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
    
    renderFixtures() {
        const container = document.getElementById('fixturesContainer');
        let matches = window.tournamentManager.matches;
        
        // Filter by group if not ALL
        if (this.currentGroup !== 'ALL') {
            matches = matches.filter(match => match.group_id === this.currentGroup);
        }
        
        if (matches.length === 0) {
            container.innerHTML = `
                <div class="text-center py-20 grayscale opacity-40">
                    <i class="fas fa-calendar-times text-8xl mb-6"></i>
                    <p class="text-lg font-black uppercase tracking-widest text-gray-400">No Active Fixtures</p>
                </div>
            `;
            return;
        }
        
        // Group matches by group and round
        const matchesByGroup = {};
        matches.forEach(match => {
            if (!matchesByGroup[match.group_id]) {
                matchesByGroup[match.group_id] = {};
            }
            if (!matchesByGroup[match.group_id][match.round_number]) {
                matchesByGroup[match.group_id][match.round_number] = [];
            }
            matchesByGroup[match.group_id][match.round_number].push(match);
        });
        
        container.innerHTML = Object.keys(matchesByGroup).sort().map(groupId => {
            const rounds = matchesByGroup[groupId];
            
            return `
                <div class="mb-12">
                    <div class="flex items-center space-x-4 mb-8">
                        <div class="w-10 h-1 rounded-full ${this.getGroupColorClass(groupId)}"></div>
                        <h4 class="text-xl font-black uppercase tracking-tight">GROUP ${groupId} BRACKET</h4>
                    </div>
                    ${Object.keys(rounds).sort((a, b) => a - b).map(round => `
                        <div class="mb-10">
                            <h5 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 ml-2">ROUND ${round}</h5>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                ${rounds[round].map(match => this.renderMatchCard(match)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    }
    
    renderMatchCard(match) {
        const player1 = window.tournamentManager.players.find(p => p.id === match.player1_id);
        const player2 = window.tournamentManager.players.find(p => p.id === match.player2_id);
        
        const player1Name = player1?.name || 'Unknown';
        const player2Name = player2?.name || 'Unknown';
        
        const isCompleted = match.status === 'completed';
        const statusColor = isCompleted ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600';
        const statusIcon = isCompleted ? 'fa-check' : 'fa-hourglass-start';
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group/match">
                <button onclick="window.fixturesManager.deleteMatch(${match.id})" class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-50 text-red-500 shadow-md hover:bg-red-500 hover:text-white opacity-100 sm:opacity-0 group-hover/match:opacity-100 transition-all flex items-center justify-center z-10">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
                <div class="flex justify-between items-center mb-6">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Match #${match.round_number}</span>
                    <span class="${statusColor} text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider flex items-center">
                        <i class="fas ${statusIcon} mr-1.5"></i> ${match.status}
                    </span>
                </div>
                
                <div class="space-y-4">
                    <div class="flex items-center justify-between p-3 rounded-xl ${isCompleted && match.winner_id === match.player1_id ? 'bg-green-50 dark:bg-green-900/10 ring-1 ring-green-100 dark:ring-green-900/30' : 'bg-gray-50 dark:bg-gray-900/30'}">
                        <div class="flex items-center flex-grow min-w-0">
                            <div class="w-10 h-10 rounded-full overflow-hidden shadow-sm mr-3 flex-shrink-0 border-2 border-white dark:border-gray-700">
                                <img src="${player1?.avatar_url || 'assets/images/default_avatar.png'}" 
                                     class="w-full h-full object-cover" 
                                     onerror="this.src='assets/images/default_avatar.png'; this.onerror=null;">
                            </div>
                            <span class="font-bold text-sm truncate dark:text-gray-200">${player1Name}</span>
                        </div>
                        ${isCompleted && match.winner_id === match.player1_id ? '<i class="fas fa-crown text-yellow-500 ml-2"></i>' : ''}
                    </div>
                    
                    <div class="flex items-center justify-center -my-2 opacity-20">
                        <span class="text-[10px] font-black tracking-widest text-gray-400">VERSUS</span>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-xl ${isCompleted && match.winner_id === match.player2_id ? 'bg-green-50 dark:bg-green-900/10 ring-1 ring-green-100 dark:ring-green-900/30' : 'bg-gray-50 dark:bg-gray-900/30'}">
                        <div class="flex items-center flex-grow min-w-0">
                            <div class="w-10 h-10 rounded-full overflow-hidden shadow-sm mr-3 flex-shrink-0 border-2 border-white dark:border-gray-700">
                                <img src="${player2?.avatar_url || 'assets/images/default_avatar.png'}" 
                                     class="w-full h-full object-cover" 
                                     onerror="this.src='assets/images/default_avatar.png'; this.onerror=null;">
                            </div>
                            <span class="font-bold text-sm truncate dark:text-gray-200">${player2Name}</span>
                        </div>
                        ${isCompleted && match.winner_id === match.player2_id ? '<i class="fas fa-crown text-yellow-500 ml-2"></i>' : ''}
                    </div>
                </div>

                ${!isCompleted ? `
                    <button onclick="window.tournamentManager.showTab('matches')" class="w-full mt-6 py-3 rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 text-gray-400 hover:text-blue-500 font-bold text-xs uppercase tracking-widest transition-all">
                        ENTER SCORE
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    filterGroup(group) {
        this.currentGroup = group;
        
        // Update filter buttons
        document.querySelectorAll('.group-filter').forEach(btn => {
            if (btn.dataset.group === group) {
                btn.className = 'group-filter px-6 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm transition';
            } else {
                btn.className = 'group-filter px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold text-sm transition';
            }
        });
        
        this.renderFixtures();
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
    
    async deletePlayer(playerId) {
        if (!confirm('Are you sure you want to delete this player? This will also delete their matches and standings.')) {
            return;
        }
        
        try {
            window.tournamentManager.showLoading(true);
            
            // Delete player
            await fetch(`/tables/players/${playerId}`, {
                method: 'DELETE'
            });
            
            // Delete related matches
            const playerMatches = window.tournamentManager.matches.filter(m => 
                m.player1_id === playerId || m.player2_id === playerId
            );
            
            for (const match of playerMatches) {
                await fetch(`/tables/matches/${match.id}`, {
                    method: 'DELETE'
                });
            }
            
            // Delete standing
            const playerStanding = window.tournamentManager.standings.find(s => s.player_id === playerId);
            if (playerStanding) {
                await fetch(`/tables/standings/${playerStanding.id}`, {
                    method: 'DELETE'
                });
            }
            
            window.tournamentManager.showToast('Player deleted successfully', 'success');
            await this.loadPlayers();
            await this.loadFixtures();
            this.renderPlayersList();
            this.renderFixtures();
            await this.updateDashboard();
            
        } catch (error) {
            console.error('Error deleting player:', error);
            window.tournamentManager.showToast('Error deleting player', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }
    
    async updateDashboard() {
        if (window.tournamentManager) {
            await window.tournamentManager.updateDashboard();
        }
    }
}

// Initialize fixtures manager
window.fixturesManager = new FixturesManager();

// Extend the main tournament manager
document.addEventListener('DOMContentLoaded', () => {
    if (window.tournamentManager) {
        window.tournamentManager.loadFixtures = () => window.fixturesManager.init();
        window.tournamentManager.addPlayer = () => window.fixturesManager.addPlayer();
        window.tournamentManager.generateFixtures = () => window.fixturesManager.generateFixtures();
        window.tournamentManager.deleteFixtures = () => window.fixturesManager.deleteFixtures();
        window.tournamentManager.deleteMatch = (id) => window.fixturesManager.deleteMatch(id);
        window.tournamentManager.filterGroup = (group) => window.fixturesManager.filterGroup(group);
    }
});