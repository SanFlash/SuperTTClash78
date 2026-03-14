// Dashboard JavaScript
class TournamentDashboard {
    constructor() {
        this.currentGroup = 'A';
        this.charts = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.initCharts();
        this.loadPlayers(); // Load players for management
    }

    // websockets removed; polling handles refreshes


    // connection status UI removed


    bindEvents() {
        // Group selection
        document.querySelectorAll('.group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentGroup = e.target.dataset.group;
                this.loadGroupData();
            });
        });

        // Player management events
        this.bindPlayerEvents();

        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.refreshData();
        }, 30000);
    }

    async loadInitialData() {
        try {
            await this.loadTournamentOverview();
            await this.loadGroupData();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async refreshData() {
        await this.loadTournamentOverview();
        await this.loadGroupData();
    }

    async loadTournamentOverview() {
        try {
            const playersResponse = await fetch('/api/players');
            const players = await playersResponse.json();
            
            const matchesResponse = await fetch(`/api/matches/${this.currentGroup}`);
            const matches = await matchesResponse.json();
            
            const completedMatches = matches.filter(m => m.status === 'completed').length;
            const pendingMatches = matches.filter(m => m.status === 'pending').length;
            const liveMatches = matches.filter(m => m.status === 'live').length;
            
            document.getElementById('total-players').textContent = players.length;
            document.getElementById('completed-matches').textContent = completedMatches;
            document.getElementById('pending-matches').textContent = pendingMatches;
            document.getElementById('live-matches').textContent = liveMatches;
            
        } catch (error) {
            console.error('Error loading tournament overview:', error);
        }
    }

    async loadGroupData() {
        try {
            await this.loadStandings();
            await this.loadQualificationPredictions();
            await this.loadRecentMatches();
            await this.loadUpcomingMatches();
            this.updateChartTitles();
        } catch (error) {
            console.error('Error loading group data:', error);
        }
    }

    async loadStandings() {
        try {
            const response = await fetch(`/api/standings/${this.currentGroup}`);
            const standings = await response.json();
            
            const tbody = document.getElementById('standings-tbody');
            tbody.innerHTML = '';
            
            standings.forEach((standing, index) => {
                const row = document.createElement('tr');
                if (index < 3) {
                    row.classList.add(`rank-${index + 1}`);
                }
                
                row.innerHTML = `
                    <td>${standing.rank}</td>
                    <td class="player-name">${standing.player.name}</td>
                    <td>${standing.matches_played}</td>
                    <td>${standing.wins}</td>
                    <td>${standing.losses}</td>
                    <td>${standing.sets_won}</td>
                    <td>${standing.sets_lost}</td>
                    <td>${standing.set_difference > 0 ? '+' : ''}${standing.set_difference}</td>
                    <td>${standing.points_for}</td>
                    <td>${standing.points_against}</td>
                    <td>${standing.point_difference > 0 ? '+' : ''}${standing.point_difference}</td>
                    <td><strong>${standing.ranking_points}</strong></td>
                `;
                
                tbody.appendChild(row);
            });
            
            document.querySelector('.standings-section h2').textContent = `Current Standings - Group ${this.currentGroup}`;
            
        } catch (error) {
            console.error('Error loading standings:', error);
        }
    }

    async loadQualificationPredictions() {
        try {
            const response = await fetch(`/api/qualification/${this.currentGroup}`);
            const predictions = await response.json();
            
            const container = document.getElementById('predictions-grid');
            container.innerHTML = '';
            
            predictions.forEach(pred => {
                const card = document.createElement('div');
                card.className = 'prediction-card';
                
                if (pred.probability >= 80) {
                    card.classList.add('likely');
                } else if (pred.probability >= 40) {
                    card.classList.add('possible');
                } else {
                    card.classList.add('eliminated');
                }
                
                card.innerHTML = `
                    <div class="prediction-header">
                        <div class="prediction-name">${pred.player.name}</div>
                        <div class="prediction-probability">${pred.probability}%</div>
                    </div>
                    <div class="prediction-details">
                        <div>Position: ${pred.current_position} | Points: ${pred.ranking_points}</div>
                        <div>Remaining: ${pred.remaining_matches} matches</div>
                        <div>Max Possible: ${pred.max_possible_points} pts</div>
                        <div><strong>${pred.status}</strong></div>
                    </div>
                `;
                
                container.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error loading qualification predictions:', error);
        }
    }

    async loadRecentMatches() {
        try {
            const response = await fetch(`/api/matches/${this.currentGroup}`);
            const matches = await response.json();
            
            const recentMatches = matches
                .filter(m => m.status === 'completed')
                .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
                .slice(0, 5);
            
            const container = document.getElementById('recent-matches');
            container.innerHTML = '';
            
            if (recentMatches.length === 0) {
                container.innerHTML = '<p class="text-center">No completed matches yet</p>';
                return;
            }
            
            recentMatches.forEach(match => {
                const card = this.createMatchCard(match, true);
                container.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error loading recent matches:', error);
        }
    }

    async loadUpcomingMatches() {
        try {
            const response = await fetch(`/api/matches/${this.currentGroup}`);
            const matches = await response.json();
            
            const upcomingMatches = matches
                .filter(m => m.status === 'pending')
                .slice(0, 5);
            
            const container = document.getElementById('upcoming-matches');
            container.innerHTML = '';
            
            if (upcomingMatches.length === 0) {
                container.innerHTML = '<p class="text-center">No upcoming matches</p>';
                return;
            }
            
            upcomingMatches.forEach(match => {
                const card = this.createMatchCard(match, false);
                container.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error loading upcoming matches:', error);
        }
    }

    createMatchCard(match, isCompleted) {
        const card = document.createElement('div');
        card.className = 'match-card';
        
        const winner = match.winner;
        const isPlayer1Winner = winner && winner.id === match.player1.id;
        const isPlayer2Winner = winner && winner.id === match.player2.id;
        
        card.innerHTML = `
            <div class="match-header">
                <span class="match-round">Round ${match.round_number}</span>
                <span class="match-status status-${match.status}">${match.status.toUpperCase()}</span>
            </div>
            <div class="match-players">
                <span class="player-name ${isCompleted ? (isPlayer1Winner ? 'winner' : 'loser') : ''}">${match.player1.name}</span>
                <span class="vs-text">VS</span>
                <span class="player-name ${isCompleted ? (isPlayer2Winner ? 'winner' : 'loser') : ''}">${match.player2.name}</span>
            </div>
            ${isCompleted ? `<div class="match-scores">Winner: ${winner.name}</div>` : ''}
        `;
        
        return card;
    }

    initCharts() {
        // Points distribution chart
        const pointsCtx = document.getElementById('pointsChart').getContext('2d');
        this.charts.points = new Chart(pointsCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
                        '#1abc9c', '#34495e', '#d35400', '#27ae60', '#8e44ad'
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

        // Win/Loss ratio chart
        const winLossCtx = document.getElementById('winLossChart').getContext('2d');
        this.charts.winLoss = new Chart(winLossCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Wins',
                        data: [],
                        backgroundColor: '#2ecc71'
                    },
                    {
                        label: 'Losses',
                        data: [],
                        backgroundColor: '#e74c3c'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async updateChartTitles() {
        try {
            const response = await fetch(`/api/standings/${this.currentGroup}`);
            const standings = await response.json();
            
            // Update points chart
            const pointsLabels = standings.map(s => s.player.name);
            const pointsData = standings.map(s => s.ranking_points);
            
            this.charts.points.data.labels = pointsLabels;
            this.charts.points.data.datasets[0].data = pointsData;
            this.charts.points.update();
            
            // Update win/loss chart
            const winLossLabels = standings.map(s => s.player.name);
            const winsData = standings.map(s => s.wins);
            const lossesData = standings.map(s => s.losses);
            
            this.charts.winLoss.data.labels = winLossLabels;
            this.charts.winLoss.data.datasets[0].data = winsData;
            this.charts.winLoss.data.datasets[1].data = lossesData;
            this.charts.winLoss.update();
            
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    // Player Management Methods
    bindPlayerEvents() {
        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) {
            addPlayerBtn.addEventListener('click', () => this.addPlayer());
        }
    }

    async loadPlayers() {
        try {
            const response = await fetch('/api/players');
            const players = await response.json();
            this.displayPlayers(players);
        } catch (error) {
            console.error('Error loading players:', error);
        }
    }

    displayPlayers(players) {
        const container = document.getElementById('players-list');
        if (!container) return;

        container.innerHTML = '';

        players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <div class="player-details">
                    <h4>${player.name}</h4>
                    <p>Group ${player.group_id}</p>
                </div>
                <div class="player-actions">
                    <button class="btn-edit" onclick="dashboard.editPlayer(${player.id}, '${player.name}', '${player.group_id}')">Edit</button>
                    <button class="btn-delete" onclick="dashboard.deletePlayer(${player.id}, '${player.name}')">Delete</button>
                </div>
            `;
            container.appendChild(playerItem);
        });
    }

    async addPlayer() {
        const nameInput = document.getElementById('player-name');
        const groupSelect = document.getElementById('player-group');

        const name = nameInput.value.trim();
        const groupId = groupSelect.value;

        if (!name) {
            alert('Please enter a player name');
            return;
        }

        if (!groupId || !['A', 'B', 'C', 'D'].includes(groupId)) {
            alert('Please select a valid group');
            return;
        }

        try {
            const response = await fetch('/api/players', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    group_id: groupId
                })
            });

            const result = await response.json();

            if (response.ok) {
                nameInput.value = '';
                this.loadPlayers();
                this.refreshData(); // Refresh standings and other data
                alert('Player added successfully!');
            } else {
                const errorMsg = result.error || 'Unknown error occurred';
                alert('Error adding player: ' + errorMsg);
                console.error('Server error:', result);
            }
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Error adding player: Network error or server unavailable');
        }
    }

    async editPlayer(playerId, currentName, currentGroup) {
        const newName = prompt('Enter new name:', currentName);
        if (!newName || newName.trim() === currentName) return;

        const newGroup = prompt('Enter new group (A, B, C, D):', currentGroup);
        if (!newGroup || !['A', 'B', 'C', 'D'].includes(newGroup.toUpperCase())) {
            alert('Invalid group. Please enter A, B, C, or D.');
            return;
        }

        try {
            const response = await fetch(`/api/players/${playerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName.trim(),
                    group_id: newGroup.toUpperCase()
                })
            });

            if (response.ok) {
                this.loadPlayers();
                this.refreshData();
                alert('Player updated successfully!');
            } else {
                const error = await response.json();
                alert('Error updating player: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating player:', error);
            alert('Error updating player');
        }
    }

    async deletePlayer(playerId, playerName) {
        if (!confirm(`Are you sure you want to delete "${playerName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${playerId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadPlayers();
                this.refreshData();
                alert('Player deleted successfully!');
            } else {
                const error = await response.json();
                alert('Error deleting player: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting player:', error);
            alert('Error deleting player');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TournamentDashboard();
});