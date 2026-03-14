from flask import Flask, render_template, request, jsonify
# removed websocket dependency
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
import random
from sqlalchemy import func, text
import os
from dotenv import load_dotenv

import werkzeug
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration for uploads
UPLOAD_FOLDER = os.path.join('assets', 'images', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Serve assets folder
@app.route('/assets/<path:path>')
def send_assets(path):
    from flask import send_from_directory
    return send_from_directory('assets', path)

# Serve js folder
@app.route('/js/<path:path>')
def send_js(path):
    from flask import send_from_directory
    return send_from_directory('js', path)

# Production configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'table-tennis-tournament-secret')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Database configuration - Always use SQLite for simplicity
if os.environ.get('RENDER'):
    # On Render, try persistent disk first; if not writable, use /tmp
    db_dir = '/var/lib/tournament'
    db_path = os.path.join(db_dir, 'tournament.db')
    
    # Test if we can write to the persistent disk
    try:
        test_file = os.path.join(db_dir, '.write_test')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        print(f"Using persistent disk: {db_path}")
    except (PermissionError, FileNotFoundError, IOError):
        # Fall back to /tmp which is always writable on Render
        db_path = '/tmp/tournament.db'
        print(f"Persistent disk not writable, using temp directory: {db_path}")
else:
    # Use local file in development
    db_path = 'tournament.db'

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

db = SQLAlchemy(app)
# SocketIO removed, using plain Flask


# Database initialization function
def init_db():
    """Initialize database tables if they don't exist"""
    try:
        with app.app_context():
            db.create_all()
    except Exception as e:
        print(f'Error initializing database: {e}')

# Schema migration helper for SQLite
def migrate_schema():
    with app.app_context():
        engine = db.get_engine()
        if 'sqlite' in str(engine.url):
            with engine.connect() as conn:
                player_cols = [c[1] for c in conn.execute(text("PRAGMA table_info(player)"))]
                if 'avatar_url' not in player_cols:
                    try:
                        conn.execute(text("ALTER TABLE player ADD COLUMN avatar_url TEXT DEFAULT ''"))
                        print('Added player.avatar_url column')
                    except Exception as e:
                        print('Could not add avatar_url:', e)
                if 'updated_at' not in player_cols:
                    try:
                        conn.execute(text("ALTER TABLE player ADD COLUMN updated_at DATETIME"))
                        conn.execute(text("UPDATE player SET updated_at = CURRENT_TIMESTAMP"))
                        print('Added player.updated_at column')
                    except Exception as e:
                        print('Could not add updated_at to player:', e)

                match_cols = [c[1] for c in conn.execute(text("PRAGMA table_info(match)"))]
                if 'tournament_type' not in match_cols:
                    try:
                        conn.execute(text("ALTER TABLE match ADD COLUMN tournament_type TEXT DEFAULT 'league'"))
                        print('Added match.tournament_type column')
                    except Exception as e:
                        print('Could not add tournament_type:', e)
                if 'max_sets' not in match_cols:
                    try:
                        conn.execute(text("ALTER TABLE match ADD COLUMN max_sets INTEGER DEFAULT 5"))
                        print('Added match.max_sets column')
                    except Exception as e:
                        print('Could not add max_sets:', e)
                if 'updated_at' not in match_cols:
                    try:
                        conn.execute(text("ALTER TABLE match ADD COLUMN updated_at DATETIME"))
                        conn.execute(text("UPDATE match SET updated_at = CURRENT_TIMESTAMP"))
                        print('Added match.updated_at column')
                    except Exception as e:
                        print('Could not add updated_at to match:', e)
                if 'completed_at' not in match_cols:
                    try:
                        conn.execute(text("ALTER TABLE match ADD COLUMN completed_at DATETIME"))
                        print('Added match.completed_at column')
                    except Exception as e:
                        print('Could not add completed_at:', e)

# Initialize database before first request
@app.before_request
def before_request():
    """Ensure database is initialized"""
    try:
        # Test if tables exist by doing a simple query
        Player.query.first()
    except Exception:
        # If tables don't exist, create them
        init_db()

# Database Models
class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    avatar_url = db.Column(db.String(255), nullable=True, default='')
    group_id = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player1_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    player2_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    group_id = db.Column(db.String(10), nullable=False)
    stage = db.Column(db.String(30), default='league')  # league, knockout, league-knockout etc
    tournament_type = db.Column(db.String(30), default='league')
    max_sets = db.Column(db.Integer, default=5)
    round_number = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='pending')  # pending, completed
    winner_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MatchScore(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    set_number = db.Column(db.Integer, nullable=False)
    player1_score = db.Column(db.Integer, nullable=False)
    player2_score = db.Column(db.Integer, nullable=False)

class Standing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    group_id = db.Column(db.String(10), nullable=False)
    matches_played = db.Column(db.Integer, default=0)
    wins = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    sets_won = db.Column(db.Integer, default=0)
    sets_lost = db.Column(db.Integer, default=0)
    points_for = db.Column(db.Integer, default=0)
    points_against = db.Column(db.Integer, default=0)
    ranking_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Fixture Generation Service
class FixtureService:
    @staticmethod
    def generate_round_robin_fixtures(players, group_id, max_sets=5, tournament_type='league'):
        """Generate round-robin fixtures using circle method"""
        if len(players) < 2:
            return []

        # Shuffle players for randomness
        players_copy = players.copy()
        random.shuffle(players_copy)

        fixtures = []
        n = len(players_copy)

        # If odd number, add a dummy player
        if n % 2 == 1:
            players_copy.append(None)
            n += 1

        # Generate rounds
        for round_num in range(n - 1):
            round_fixtures = []
            for i in range(n // 2):
                player1 = players_copy[i]
                player2 = players_copy[n - 1 - i]

                if player1 is not None and player2 is not None:
                    match = Match(
                        player1_id=player1.id,
                        player2_id=player2.id,
                        group_id=group_id,
                        round_number=round_num + 1,
                        stage='league',
                        tournament_type=tournament_type,
                        max_sets=max_sets
                    )
                    round_fixtures.append(match)

            # Rotate players (except first)
            players_copy = [players_copy[0]] + [players_copy[-1]] + players_copy[1:-1]
            fixtures.extend(round_fixtures)

        return fixtures

    @staticmethod
    def generate_knockout_fixtures(players, group_id, max_sets=5, tournament_type='knockout'):
        """Generate single-elimination knockout bracket"""
        players_copy = players.copy()
        random.shuffle(players_copy)

        fixtures = []
        round_number = 1

        while len(players_copy) > 1:
            next_round = []
            matches_added = 0
            for i in range(0, len(players_copy), 2):
                if i + 1 < len(players_copy):
                    player1 = players_copy[i]
                    player2 = players_copy[i+1]
                    
                    if player1 and player2:
                        match = Match(
                            player1_id=player1.id,
                            player2_id=player2.id,
                            group_id=group_id,
                            round_number=round_number,
                            stage='knockout',
                            tournament_type=tournament_type,
                            max_sets=max_sets
                        )
                        fixtures.append(match)
                        matches_added += 1
                    
                    # Advance placeholder for winners
                    next_round.append(None)
                else:
                    # bye, advance player
                    next_round.append(players_copy[i])
            
            if matches_added == 0:
                break
                
            players_copy = next_round
            round_number += 1

        return fixtures

    @staticmethod
    def generate_league_knockout_fixtures(players, group_id, max_sets=5, advance_top=2):
        league_fixtures = FixtureService.generate_round_robin_fixtures(players, group_id, max_sets, 'league-cum-knockout')
        # knockout stage will be created dynamically after standings are computed, so just return league fixtures.
        return league_fixtures

    @staticmethod
    def generate_knockout_knockout_fixtures(players, group_id, max_sets=5):
        # For simplicity build one knockout stage; second stage can be bye winners
        return FixtureService.generate_knockout_fixtures(players, group_id, max_sets, 'knockout-cum-knockout')

    @staticmethod
    def generate_friendly_fixtures(players, group_id, max_sets=3):
        return FixtureService.generate_round_robin_fixtures(players, group_id, max_sets, 'friendly')

# Ranking Service
class RankingService:
    @staticmethod
    def calculate_standings(player_id, group_id):
        """Calculate standings for a player"""
        player = db.session.get(Player, player_id)
        if not player:
            return None
        
        # Get all matches for this player
        matches = Match.query.filter(
            ((Match.player1_id == player_id) | (Match.player2_id == player_id)) &
            (Match.group_id == group_id) &
            (Match.status == 'completed')
        ).all()
        
        stats = {
            'matches_played': 0,
            'wins': 0,
            'losses': 0,
            'sets_won': 0,
            'sets_lost': 0,
            'points_for': 0,
            'points_against': 0,
            'ranking_points': 0
        }
        
        for match in matches:
            stats['matches_played'] += 1
            
            # Get match scores
            scores = MatchScore.query.filter_by(match_id=match.id).all()
            
            player_sets_won = 0
            opponent_sets_won = 0
            
            for score in scores:
                if match.player1_id == player_id:
                    if score.player1_score > score.player2_score:
                        player_sets_won += 1
                    else:
                        opponent_sets_won += 1
                    stats['points_for'] += score.player1_score
                    stats['points_against'] += score.player2_score
                else:
                    if score.player2_score > score.player1_score:
                        player_sets_won += 1
                    else:
                        opponent_sets_won += 1
                    stats['points_for'] += score.player2_score
                    stats['points_against'] += score.player1_score
            
            stats['sets_won'] += player_sets_won
            stats['sets_lost'] += opponent_sets_won
            
            # Determine win/loss
            if match.winner_id == player_id:
                stats['wins'] += 1
                stats['ranking_points'] += 2  # Win = 2 points
            else:
                stats['losses'] += 1
                # Loss = 0 points (no change)
        
        return stats
    
    @staticmethod
    def update_all_standings(group_id):
        """Update standings for all players in a group"""
        players = Player.query.filter_by(group_id=group_id).all()
        
        for player in players:
            stats = RankingService.calculate_standings(player.id, group_id)
            
            if stats:
                standing = Standing.query.filter_by(player_id=player.id, group_id=group_id).first()
                if not standing:
                    standing = Standing(player_id=player.id, group_id=group_id)
                    db.session.add(standing)
                
                # Update standing with new stats
                standing.matches_played = stats['matches_played']
                standing.wins = stats['wins']
                standing.losses = stats['losses']
                standing.sets_won = stats['sets_won']
                standing.sets_lost = stats['sets_lost']
                standing.points_for = stats['points_for']
                standing.points_against = stats['points_against']
                standing.ranking_points = stats['ranking_points']
        
        db.session.commit()

# Qualification Service
class QualificationService:
    @staticmethod
    def predict_qualification(group_id, top_n=2):
        """Predict qualification chances for players in a group"""
        players = Player.query.filter_by(group_id=group_id).all()
        standings = Standing.query.filter_by(group_id=group_id).all()
        
        # Get current standings sorted by ranking points
        standings_sorted = sorted(standings, key=lambda x: x.ranking_points, reverse=True)
        
        predictions = []
        
        for standing in standings:
            player = db.session.get(Player, standing.player_id)
            
            # Calculate remaining matches
            remaining_matches = Match.query.filter(
                ((Match.player1_id == player.id) | (Match.player2_id == player.id)) &
                (Match.group_id == group_id) &
                (Match.status == 'pending')
            ).count()
            
            # Calculate maximum possible points
            max_possible_points = standing.ranking_points + (remaining_matches * 2)
            
            # Check if currently in qualification position
            current_position = next(i for i, s in enumerate(standings_sorted) if s.player_id == player.id) + 1
            
            # Simple qualification prediction
            if current_position <= top_n:
                status = "Likely Qualified"
                probability = 85
            elif len(standings_sorted) >= top_n and max_possible_points >= standings_sorted[top_n-1].ranking_points:
                status = "Can Still Qualify"
                probability = 60
            else:
                status = "Eliminated"
                probability = 10
            
            predictions.append({
                'player': player,
                'current_position': current_position,
                'ranking_points': standing.ranking_points,
                'remaining_matches': remaining_matches,
                'max_possible_points': max_possible_points,
                'status': status,
                'probability': probability
            })
        
        return predictions

# Routes
@app.route('/')
@app.route('/fixtures')
@app.route('/standings')
@app.route('/match-entry')
def index():
    return render_template('index.html')

@app.route('/api/players', methods=['GET', 'POST'])
@app.route('/tables/players', methods=['GET', 'POST'])
def handle_players():
    if request.method == 'POST':
        try:
            data = request.json
            if not data or 'name' not in data or 'group_id' not in data:
                return jsonify({'error': 'Missing required fields'}), 400
            
            player = Player(
                name=data['name'].strip(),
                group_id=data['group_id'].strip(),
                avatar_url=data.get('avatar_url', '').strip()
            )
            db.session.add(player)
            db.session.commit()
            
            # Auto-create standing for the player
            RankingService.update_all_standings(player.group_id)
            
            return jsonify({'id': player.id, 'name': player.name, 'group_id': player.group_id, 'avatar_url': player.avatar_url}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    players = Player.query.all()
    return jsonify({'data': [{
        'id': p.id,
        'name': p.name,
        'group_id': p.group_id,
        'avatar_url': p.avatar_url or ''
    } for p in players]})

@app.route('/api/players/<int:player_id>', methods=['GET', 'PUT', 'DELETE'])
@app.route('/tables/players/<int:player_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_player(player_id):
    player = db.session.get(Player, player_id)
    if not player:
        return jsonify({'error': 'Player not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'id': player.id, 'name': player.name, 'group_id': player.group_id, 'avatar_url': player.avatar_url})
    elif request.method == 'PUT':
        data = request.json
        player.name = data.get('name', player.name)
        player.group_id = data.get('group_id', player.group_id)
        player.avatar_url = data.get('avatar_url', player.avatar_url)
        db.session.commit()
        return jsonify({'message': 'Player updated'})
    elif request.method == 'DELETE':
        # Delete related records
        Match.query.filter((Match.player1_id == player_id)|(Match.player2_id == player_id)).delete()
        Standing.query.filter_by(player_id=player_id).delete()
        db.session.delete(player)
        db.session.commit()
        return jsonify({'message': 'Player deleted'})

@app.route('/api/matches', methods=['GET', 'POST'])
@app.route('/tables/matches', methods=['GET', 'POST'])
def handle_matches():
    if request.method == 'POST':
        try:
            data = request.json
            match = Match(
                player1_id=data['player1_id'],
                player2_id=data['player2_id'],
                group_id=data['group_id'],
                round_number=data.get('round_number', 1),
                status=data.get('status', 'pending'),
                max_sets=data.get('max_sets', 5)
            )
            db.session.add(match)
            db.session.commit()
            return jsonify({'message': 'Match created', 'id': match.id})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    # GET matches with optional filtering
    group_id = request.args.get('group_id')
    status = request.args.get('status')
    
    query = Match.query
    if group_id:
        query = query.filter_by(group_id=group_id)
    if status:
        query = query.filter_by(status=status)
        
    matches = query.all()
    result = []
    for match in matches:
        p1 = db.session.get(Player, match.player1_id)
        p2 = db.session.get(Player, match.player2_id)
        if not p1 or not p2: continue
        
        scores = MatchScore.query.filter_by(match_id=match.id).all()
        
        # Robust date handling
        created_at = match.created_at.isoformat() if match.created_at else None
        
        if match.completed_at:
            updated_at = match.completed_at.isoformat()
        elif hasattr(match, 'updated_at') and match.updated_at:
            updated_at = match.updated_at.isoformat()
        else:
            updated_at = created_at

        result.append({
            'id': match.id,
            'player1_id': match.player1_id,
            'player2_id': match.player2_id,
            'player1_name': p1.name,
            'player2_name': p2.name,
            'group_id': match.group_id,
            'round_number': match.round_number,
            'status': match.status,
            'winner_id': match.winner_id,
            'max_sets': match.max_sets,
            'scores': [{
                'set_number': s.set_number,
                'player1_score': s.player1_score,
                'player2_score': s.player2_score
            } for s in scores],
            'created_at': created_at,
            'updated_at': updated_at
        })
    return jsonify({'data': result})

@app.route('/api/matches/<int:match_id>', methods=['GET', 'PUT', 'DELETE'])
@app.route('/tables/matches/<int:match_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_match(match_id):
    match = db.session.get(Match, match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    if request.method == 'GET':
        p1 = db.session.get(Player, match.player1_id)
        p2 = db.session.get(Player, match.player2_id)
        return jsonify({
            'id': match.id,
            'player1_id': match.player1_id,
            'player2_id': match.player2_id,
            'player1_name': p1.name if p1 else 'Unknown',
            'player2_name': p2.name if p2 else 'Unknown',
            'group_id': match.group_id,
            'round_number': match.round_number,
            'status': match.status,
            'winner_id': match.winner_id,
            'max_sets': match.max_sets
        })
    elif request.method == 'PUT':
        data = request.json
        match.status = data.get('status', match.status)
        match.winner_id = data.get('winner_id', match.winner_id)
        db.session.commit()
        return jsonify({'message': 'Match updated'})
    elif request.method == 'DELETE':
        # Delete associated scores first
        MatchScore.query.filter_by(match_id=match_id).delete()
        db.session.delete(match)
        db.session.commit()
        
        # After deletion, it's good to recalculate standings for that group
        RankingService.update_all_standings(match.group_id)
        
        return jsonify({'message': 'Match deleted'})

@app.route('/api/standings', methods=['GET', 'POST'])
@app.route('/tables/standings', methods=['GET', 'POST'])
def handle_standings():
    if request.method == 'POST':
        try:
            data = request.json
            player_id = data['player_id']
            # Check for existing standing
            standing = Standing.query.filter_by(player_id=player_id).first()
            if not standing:
                standing = Standing(player_id=player_id, group_id=data['group_id'])
                db.session.add(standing)
            
            standing.matches_played = data.get('matches_played', standing.matches_played)
            standing.wins = data.get('wins', standing.wins)
            standing.losses = data.get('losses', standing.losses)
            standing.sets_won = data.get('sets_won', standing.sets_won)
            standing.sets_lost = data.get('sets_lost', standing.sets_lost)
            standing.points_for = data.get('points_for', standing.points_for)
            standing.points_against = data.get('points_against', standing.points_against)
            standing.ranking_points = data.get('ranking_points', standing.ranking_points)
            
            db.session.commit()
            return jsonify({'id': standing.id}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    standings = Standing.query.all()
    result = []
    for s in standings:
        p = db.session.get(Player, s.player_id)
        if not p: continue
        result.append({
            'id': s.id,
            'player_id': s.player_id,
            'player_name': p.name,
            'group_id': s.group_id,
            'matches_played': s.matches_played,
            'wins': s.wins,
            'losses': s.losses,
            'sets_won': s.sets_won,
            'sets_lost': s.sets_lost,
            'points_for': s.points_for,
            'points_against': s.points_against,
            'ranking_points': s.ranking_points
        })
    return jsonify({'data': result})

@app.route('/api/standings/<int:standing_id>', methods=['PUT', 'DELETE'])
@app.route('/tables/standings/<int:standing_id>', methods=['PUT', 'DELETE'])
def handle_single_standing(standing_id):
    standing = db.session.get(Standing, standing_id)
    if not standing:
        return jsonify({'error': 'Standing not found'}), 404
    
    if request.method == 'PUT':
        data = request.json
        standing.matches_played = data.get('matches_played', standing.matches_played)
        standing.wins = data.get('wins', standing.wins)
        standing.losses = data.get('losses', standing.losses)
        standing.sets_won = data.get('sets_won', standing.sets_won)
        standing.sets_lost = data.get('sets_lost', standing.sets_lost)
        standing.points_for = data.get('points_for', standing.points_for)
        standing.points_against = data.get('points_against', standing.points_against)
        standing.ranking_points = data.get('ranking_points', standing.ranking_points)
        db.session.commit()
        return jsonify({'message': 'Standing updated'})
    elif request.method == 'DELETE':
        db.session.delete(standing)
        db.session.commit()
        return jsonify({'message': 'Standing deleted'})

@app.route('/api/match_scores', methods=['POST'])
@app.route('/tables/match_scores', methods=['POST'])
def handle_match_scores():
    try:
        data = request.json
        score = MatchScore(
            match_id=data['match_id'],
            set_number=data['set_number'],
            player1_score=data['player1_score'],
            player2_score=data['player2_score']
        )
        db.session.add(score)
        db.session.commit()
        return jsonify({'id': score.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-result', methods=['POST'])
def submit_result():
    data = request.json
    match_id = data['match_id']
    scores = data['scores']
    
    match = db.session.get(Match, match_id)
    if not match: return jsonify({'error': 'Match not found'}), 404
    
    MatchScore.query.filter_by(match_id=match_id).delete()
    
    p1_points = 0
    p2_points = 0
    for s_data in scores:
        p1Score = int(s_data['player1_score'])
        p2Score = int(s_data['player2_score'])
        score = MatchScore(
            match_id=match_id,
            set_number=s_data['set_number'],
            player1_score=p1Score,
            player2_score=p2Score
        )
        db.session.add(score)
        p1_points += p1Score
        p2_points += p2Score
    
    match.winner_id = match.player1_id if p1_points > p2_points else match.player2_id
    match.status = 'completed'
    match.completed_at = datetime.utcnow()
    db.session.commit()
    
    RankingService.update_all_standings(match.group_id)
    return jsonify({'message': 'Result submitted successfully'})

@app.route('/api/qualification/<group_id>')
@app.route('/tables/qualification/<group_id>')
def get_qualification(group_id):
    predictions = QualificationService.predict_qualification(group_id)
    return jsonify([{
        'player': {'id': p['player'].id, 'name': p['player'].name},
        'current_position': p['current_position'],
        'ranking_points': p['ranking_points'],
        'remaining_matches': p['remaining_matches'],
        'max_possible_points': p['max_possible_points'],
        'status': p['status'],
        'probability': p['probability']
    } for p in predictions])

# Avatar Upload Endpoint
@app.route('/api/upload-avatar', methods=['POST'])
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to filename to prevent caching issues
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"{timestamp}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Return the public URL
        url = f"/assets/images/uploads/{filename}"
        return jsonify({'url': url})
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/generate-fixtures', methods=['POST', 'DELETE'])
def generate_fixtures_api():
    try:
        if request.method == 'DELETE':
            data = request.json or {}
            group_id = data.get('group_id', 'ALL')
            
            if group_id == 'ALL':
                # Delete all scores and matches
                MatchScore.query.delete()
                Match.query.delete()
                groups_to_update = db.session.query(Player.group_id).distinct().all()
                groups_to_update = [g[0] for g in groups_to_update]
            else:
                # Delete scores for matches in this group
                match_ids = [m.id for m in Match.query.filter_by(group_id=group_id).all()]
                if match_ids:
                    MatchScore.query.filter(MatchScore.match_id.in_(match_ids)).delete(synchronize_session=False)
                Match.query.filter_by(group_id=group_id).delete(synchronize_session=False)
                groups_to_update = [group_id]
            
            db.session.commit()
            
            # Update standings (they will become 0)
            for g in groups_to_update:
                RankingService.update_all_standings(g)
                
            return jsonify({'message': f'Deleted fixtures for {group_id}'})

        data = request.json
        group_id = data.get('group_id', 'ALL')
        tournament_type = data.get('tournament_type', 'league')
        max_sets = data.get('max_sets', 5)
        
        if group_id == 'ALL':
            groups = db.session.query(Player.group_id).distinct().all()
            groups = [g[0] for g in groups]
        else:
            groups = [group_id]
            
        all_new_fixtures = []
        for g_id in groups:
            players = Player.query.filter_by(group_id=g_id).all()
            if len(players) < 2: continue
            
            if tournament_type == 'league':
                fixtures = FixtureService.generate_round_robin_fixtures(players, g_id, max_sets)
            elif tournament_type == 'knockout':
                fixtures = FixtureService.generate_knockout_fixtures(players, g_id, max_sets)
            else:
                fixtures = FixtureService.generate_round_robin_fixtures(players, g_id, max_sets)
                
            all_new_fixtures.extend(fixtures)
            
        for f in all_new_fixtures:
            db.session.add(f)
        db.session.commit()
        
        return jsonify({'message': f'Generated {len(all_new_fixtures)} fixtures', 'count': len(all_new_fixtures)})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/recalculate-standings', methods=['POST'])
def recalculate_standings():
    try:
        groups = db.session.query(Player.group_id).distinct().all()
        for g in groups:
            RankingService.update_all_standings(g[0])
        return jsonify({'message': 'Standings recalculated for all groups'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/reset', methods=['POST'])
def reset_tournament():
    try:
        Standing.query.delete()
        MatchScore.query.delete()
        Match.query.delete()
        Player.query.delete()
        db.session.commit()
        return jsonify({'message': 'Tournament reset successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        init_db()
        migrate_schema()
    
    # Production deployment configuration
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    app.run(debug=debug, host='0.0.0.0', port=port)