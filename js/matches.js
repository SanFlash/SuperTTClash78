// Match Entry and Result Management
class MatchManager {
    constructor() {
        this.currentMatch = null;
        this.setsPerMatch = 5;
        this.setsToWin = 3;
    }
    
    async init() {
        await this.loadAvailableMatches();
        this.renderRecentMatches();
    }
    
    async loadAvailableMatches() {
        const groupId = document.getElementById('matchGroup').value;
        const matchSelect = document.getElementById('matchSelect');
        
        if (!groupId) {
            matchSelect.innerHTML = '<option value="">Select Group First</option>';
            return;
        }
        
        try {
            // Load pending matches for the selected group
            const response = await fetch(`/tables/matches?group_id=${groupId}&status=pending`);
            const data = await response.json();
            const matches = data.data || [];
            
            if (matches.length === 0) {
                matchSelect.innerHTML = '<option value="">No pending matches</option>';
                return;
            }
            
            // Load players to get names
            await window.tournamentManager.loadPlayers();
            const players = window.tournamentManager.players;
            
            matchSelect.innerHTML = '<option value="">Select Match</option>' + 
                matches.map(match => {
                    const player1 = players.find(p => p.id === match.player1_id);
                    const player2 = players.find(p => p.id === match.player2_id);
                    return `<option value="${match.id}">${player1?.name || 'Unknown'} vs ${player2?.name || 'Unknown'}</option>`;
                }).join('');
            
        } catch (error) {
            console.error('Error loading matches:', error);
            window.tournamentManager.showToast('Error loading matches', 'error');
        }
    }
    
    async loadMatchDetails() {
        const matchId = document.getElementById('matchSelect').value;
        const formContainer = document.getElementById('matchEntryForm');
        
        if (!matchId) {
            formContainer.style.display = 'none';
            return;
        }
        
        try {
            // Load match details
            const response = await fetch(`/tables/matches/${matchId}`);
            const match = await response.json();
            
            await window.tournamentManager.loadPlayers();
            const players = window.tournamentManager.players;
            
            const player1 = players.find(p => p.id === match.player1_id);
            const player2 = players.find(p => p.id === match.player2_id);
            
            this.currentMatch = {
                ...match,
                player1_name: player1?.name || 'Unknown',
                player2_name: player2?.name || 'Unknown'
            };
            
            // Set dynamic sets quantity
            this.setsPerMatch = this.currentMatch.max_sets || 5;
            
            // Update form
            document.getElementById('player1Name').textContent = this.currentMatch.player1_name;
            document.getElementById('player2Name').textContent = this.currentMatch.player2_name;
            
            // Generate set inputs
            this.generateSetInputs();
            
            formContainer.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading match details:', error);
            window.tournamentManager.showToast('Error loading match details', 'error');
        }
    }
    
    generateSetInputs() {
        const player1Container = document.getElementById('player1Sets');
        const player2Container = document.getElementById('player2Sets');
        
        player1Container.innerHTML = '';
        player2Container.innerHTML = '';
        
        for (let i = 1; i <= this.setsPerMatch; i++) {
            player1Container.innerHTML += `
                <div class="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl p-2 border dark:border-gray-700 shadow-sm transition-all focus-within:ring-2 ring-blue-500/20">
                    <span class="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0">S${i}</span>
                    <input type="number" 
                           id="p1_set${i}" 
                           placeholder="0"
                           class="w-full bg-transparent border-none text-center font-black text-lg focus:outline-none dark:text-white"
                           onchange="window.matchManager.validateSetScore(${i})">
                </div>
            `;
            
            player2Container.innerHTML += `
                <div class="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl p-2 border dark:border-gray-700 shadow-sm transition-all focus-within:ring-2 ring-red-500/20">
                    <span class="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-[10px] font-black text-red-600 flex-shrink-0">S${i}</span>
                    <input type="number" 
                           id="p2_set${i}" 
                           placeholder="0"
                           class="w-full bg-transparent border-none text-center font-black text-lg focus:outline-none dark:text-white"
                           onchange="window.matchManager.validateSetScore(${i})">
                </div>
            `;
        }
    }
    
    validateSetScore(setNumber) {
        const p1Score = parseInt(document.getElementById(`p1_set${setNumber}`).value) || 0;
        const p2Score = parseInt(document.getElementById(`p2_set${setNumber}`).value) || 0;
        
        // Basic validation - both scores can't be 0
        if (p1Score === 0 && p2Score === 0) {
            return;
        }
        
        // Check for valid set scores
        const maxScore = Math.max(p1Score, p2Score);
        const minScore = Math.min(p1Score, p2Score);
        
        // Set must be won by 2 points (except 21-20)
        if (maxScore === 21 && minScore <= 19) {
            // Valid set
            document.getElementById(`p1_set${setNumber}`).classList.remove('border-red-500');
            document.getElementById(`p2_set${setNumber}`).classList.remove('border-red-500');
        } else if (maxScore > 21 && maxScore - minScore === 2) {
            // Valid extended set (e.g., 22-20, 23-21, etc.)
            document.getElementById(`p1_set${setNumber}`).classList.remove('border-red-500');
            document.getElementById(`p2_set${setNumber}`).classList.remove('border-red-500');
        } else {
            // Invalid set
            document.getElementById(`p1_set${setNumber}`).classList.add('border-red-500');
            document.getElementById(`p2_set${setNumber}`).classList.add('border-red-500');
        }
    }
    
    async submitMatchResult() {
        if (!this.currentMatch) {
            window.tournamentManager.showToast('No match selected', 'error');
            return;
        }
        
        const scores = [];
        
        // Collect and validate scores
        for (let i = 1; i <= this.setsPerMatch; i++) {
            const p1Score = parseInt(document.getElementById(`p1_set${i}`).value) || 0;
            const p2Score = parseInt(document.getElementById(`p2_set${i}`).value) || 0;
            
            if (p1Score === 0 && p2Score === 0) {
                continue; // Skip empty sets
            }
            
            scores.push({
                set_number: i,
                player1_score: p1Score,
                player2_score: p2Score
            });
        }
        
        if (scores.length === 0) {
            window.tournamentManager.showToast('Please enter at least one set score', 'error');
            return;
        }
        
        try {
            window.tournamentManager.showLoading(true);
            
            // Submit to unified endpoint
            const response = await fetch('/api/submit-result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    match_id: this.currentMatch.id,
                    scores: scores
                })
            });
            
            if (response.ok) {
                window.tournamentManager.showToast('Match result submitted successfully', 'success');
                this.clearMatchForm();
                await this.loadAvailableMatches();
                
                // Refresh all data
                await window.tournamentManager.loadInitialData();
                
                // Update other tabs if they exist
                if (window.standingsManager) await window.standingsManager.init();
                if (window.fixturesManager) await window.fixturesManager.init();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to submit result');
            }
            
        } catch (error) {
            console.error('Error submitting match result:', error);
            window.tournamentManager.showToast(error.message || 'Error submitting match result', 'error');
        } finally {
            window.tournamentManager.showLoading(false);
        }
    }
    
    async updateStandings() {
        if (!window.standingsManager) return;
        
        try {
            await window.standingsManager.recalculateStandings();
        } catch (error) {
            console.error('Error updating standings:', error);
        }
    }
    
    clearMatchForm() {
        document.getElementById('matchSelect').value = '';
        document.getElementById('matchEntryForm').style.display = 'none';
        this.currentMatch = null;
        
        // Clear set inputs
        for (let i = 1; i <= this.setsPerMatch; i++) {
            const p1Set = document.getElementById(`p1_set${i}`);
            const p2Set = document.getElementById(`p2_set${i}`);
            if (p1Set) {
                p1Set.value = '';
                p1Set.parentElement.classList.remove('ring-2', 'ring-red-500/50', 'border-red-500');
            }
            if (p2Set) {
                p2Set.value = '';
                p2Set.parentElement.classList.remove('ring-2', 'ring-red-500/50', 'border-red-500');
            }
        }
    }
    
    renderRecentMatches() {
        const container = document.getElementById('recentMatches');
        const matches = window.tournamentManager.matches;
        const players = window.tournamentManager.players;
        
        const recentMatches = matches
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 6);
        
        if (recentMatches.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No recent box scores</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentMatches.map(match => {
            const player1 = players.find(p => p.id === match.player1_id);
            const player2 = players.find(p => p.id === match.player2_id);
            const winner = players.find(p => p.id === match.winner_id);
            
            // Format scores: "3-1 (11-9, 11-7, 8-11, 11-5)"
            let setSummary = '';
            if (match.scores && match.scores.length > 0) {
                const s = match.scores;
                const p1Sets = s.filter(x => x.player1_score > x.player2_score).length;
                const p2Sets = s.filter(x => x.player2_score > x.player1_score).length;
                const details = s.map(x => `${x.player1_score}-${x.player2_score}`).join(', ');
                setSummary = `<div class="text-[10px] font-bold text-blue-500 mt-1">${p1Sets}-${p2Sets} (${details})</div>`;
            }

            return `
                <div class="bg-white dark:bg-gray-800 rounded-3xl p-6 border dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group/match">
                    <div class="flex justify-between items-center mb-6">
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Group ${match.group_id} • Round ${match.round_number}</span>
                        <div class="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[9px] font-black uppercase tracking-widest">Final Score</div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-black text-xs">P1</div>
                                <span class="font-bold text-gray-800 dark:text-gray-200">${player1?.name || 'Unknown'}</span>
                            </div>
                            ${match.winner_id === match.player1_id ? '<i class="fas fa-check-circle text-green-500"></i>' : ''}
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-black text-xs">P2</div>
                                <span class="font-bold text-gray-800 dark:text-gray-200">${player2?.name || 'Unknown'}</span>
                            </div>
                            ${match.winner_id === match.player2_id ? '<i class="fas fa-check-circle text-green-500"></i>' : ''}
                        </div>
                        ${setSummary}
                    </div>
                    
                    <div class="mt-6 pt-6 border-t dark:border-gray-700 flex justify-between items-center">
                        <div class="text-[10px] text-gray-400 font-bold">${new Date(match.updated_at).toLocaleDateString()}</div>
                        <div class="text-[10px] font-black text-green-500 uppercase tracking-widest">${winner?.name || 'TBD'} WON</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize match manager
window.matchManager = new MatchManager();

// Extend the main tournament manager
document.addEventListener('DOMContentLoaded', () => {
    if (window.tournamentManager) {
        window.tournamentManager.loadMatchEntry = () => window.matchManager.init();
        window.tournamentManager.loadAvailableMatches = () => window.matchManager.loadAvailableMatches();
        window.tournamentManager.loadMatchDetails = () => window.matchManager.loadMatchDetails();
        window.tournamentManager.submitMatchResult = () => window.matchManager.submitMatchResult();
        window.tournamentManager.clearMatchForm = () => window.matchManager.clearMatchForm();
    }
});