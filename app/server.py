import os
os.environ['FLASK_APP'] = 'app/server.py'
# os.environ['FLASK_DEBUG'] = '1' # Optionally uncomment for auto-reload

from flask import Flask, request, send_file, abort, jsonify, make_response, redirect, url_for
from flask_socketio import SocketIO, emit, join_room as join_socketio_room, leave_room
import datetime
from util.room import create_room, find_rooms, getRoomInfo # Import DB functions
from util.authentication import *
from util.settings import settingsChange
from util.database import roomDB, userDB # Import userDB for logout
import os
import eventlet
from util.serve import *
import uuid
import random
import math # Add math import for pi
from PIL import Image # Import Pillow
from flask_limiter import Limiter # Import Limiter
from flask_limiter.util import get_remote_address # Import address getter
from functools import wraps # Added wraps for decorator

app = Flask(__name__)
# --- Rate Limiting Setup ---
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)
# --- End Rate Limiting Setup ---

socketio = SocketIO(app)

# --- Login Required Decorator ---
def login_required_http(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('auth_token')
        user = find_auth(token) if token else None
        if user is None:
            if request.path.startswith('/api/'):
                 return jsonify({"message": "Authentication required"}), 401
            else:
                 return redirect(url_for('load_login', next=request.url))
        # Inject user into request context if needed later (optional)
        # from flask import g
        # g.user = user
        return f(*args, **kwargs)
    return decorated_function
# --- End Decorator ---

# --- Load Map Data for Collision ---
MAP_IMAGE_PATH = os.path.join(os.path.dirname(__file__), 'public', 'img', 'Map.png')
map_image = None
map_pixels = None
map_width = 0
map_height = 0
WALKABLE_RECTANGLES = [
    # Define rectangles as (x_min, y_min, x_max, y_max)
    # These should match client-side checks
    (1350, 1350, 2255, 2255), # center_room
    (1670, 70,   1930, 1440), # top_hall
    (1510, 70,   2100, 650),  # top_room
    (1670, 2200, 1930, 3500), # bottom_hall
    (1510, 2950, 2100, 3530), # bottom_room
    (70,   1670, 1440, 1935), # left_hall
    (70,   1510, 650,  2090), # left_room
    (2170, 1670, 3540, 1935), # right_hall
    (2950, 1510, 3540, 2090)  # right_room
]
try:
    map_image = Image.open(MAP_IMAGE_PATH).convert('RGB')
    # map_pixels = map_image.load() # Keep pixel access if needed later, but rects are primary
    map_width, map_height = map_image.size
except FileNotFoundError:
    print(f"Error: Map image not found at {MAP_IMAGE_PATH}. Collision detection using map disabled.")
    map_image = None
except Exception as e:
    print(f"Error loading map image: {e}. Collision detection using map disabled.")
    map_image = None

# Mapping from socket session ID (sid) to player/room info
sid_map = {} # { sid: {'player_id': player_id, 'room_id': room_id, 'username': username} }

# Determine the absolute path for the logs directory relative to this file
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
LOG_FILE = os.path.join(LOGS_DIR, 'requests.log')

# --- Define initial player starting position --- 
INITIAL_X = 1800
INITIAL_Y = 1800
DEFAULT_ANGLE = -math.pi / 2 # Facing down

# Define fixed task locations (example)
TASK_LOCATIONS = [
    { "id": "task_top",    "x": 1800, "y": 300  },
    { "id": "task_left",   "x": 300,  "y": 1800 },
    { "id": "task_bottom", "x": 1800, "y": 3200 },
    { "id": "task_right",  "x": 3200, "y": 1800 },
    { "id": "task_center", "x": 1500, "y": 1500 },
]
TASK_RADIUS = 40
TASK_RADIUS_SQ = TASK_RADIUS * TASK_RADIUS
KILL_RADIUS = 50 # Adjusted kill radius
KILL_RADIUS_SQ = KILL_RADIUS * KILL_RADIUS

# === Logging (Keep HEAD version) ===
@app.before_request
def log_req():
    if not os.path.exists(LOGS_DIR):
        try:
            os.makedirs(LOGS_DIR)
        except OSError as e:
            print(f"Error creating logs directory {LOGS_DIR}: {e}")
            return
    dt = datetime.datetime.now()
    dt_str = dt.strftime('%m-%d-%Y %H:%M:%S') # Use standard time format
    ip = request.remote_addr
    method = request.method
    path = request.path
    log = f'[{dt_str}]: {ip} {method} {path}\n'
    print(log) # Keep console log
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log)
    except Exception as e:
        print(f"Error writing to log file {LOG_FILE}: {e}")

# === HTTP Routes (Keep HEAD versions) ===
@app.route('/', methods=['GET'])
def load_home():
    filepath = "public/html/home.html"
    return send_file(filepath, mimetype='text/html')

@app.route('/login',methods=['GET'])
def load_login():
    filepath = "public/html/login.html"
    return send_file(filepath,mimetype="text/html")

@app.route('/register',methods=["GET"])
@limiter.limit("10 per hour") # Stricter limit for registration page load
def load_register():
    filepath = "public/html/register.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/logout', methods=['GET'])
def logout():
    token = request.cookies.get('auth_token')
    if token:
        try:
            hashed_token = hashlib.sha256(token.encode()).hexdigest()
            userDB.update_one({'hashed_token': hashed_token}, {'$unset': {'hashed_token': ""}})
        except Exception as e:
            print(f"Error removing token hash during logout: {e}")
    resp = make_response(redirect(url_for('load_login')))
    resp.set_cookie('auth_token', '', expires=0, httponly=True, secure=True, samesite='Lax')
    return resp

@app.route('/create-room',methods=['GET'])
@login_required_http
def load_createRoom():
    filepath = "public/html/create_room.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/create-room', methods=['POST'])
@login_required_http
def make_room_route():
    result = create_room(request)
    if isinstance(result, tuple): # Handles errors like ("msg", 400/500)
         # Ensure we return JSON even for errors the frontend might parse
         return jsonify({"message": result[0]}), result[1]
    elif result == "Not Logged In": # Should be caught by decorator, but defensive check
         return jsonify({"message": "Authentication required"}), 401
    # If result is not a tuple, assume it's the success dict {'roomId': ...} OR an error string
    if isinstance(result, str):
         # Explicitly return validation error strings with a 400 status and JSON structure
         print(f"[API Error] /create-room validation failed: {result}") # Log the specific error
         return jsonify({"message": result}), 400
    # Otherwise, assume success (result should be the {'roomId': ...} dict)
    return jsonify(result), 200

@app.route('/find-room',methods=['GET'])
@login_required_http
def load_findRoom():
    filepath = "public/html/find_room.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/settings', methods=['GET'])
@login_required_http
def getSettings():
    filepath = "public/html/settings.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/room/<roomId>', methods=['GET'])
@login_required_http
def load_room(roomId):
    try: getRoomInfo(roomId)
    except KeyError: return "Room Not Found", 404
    except Exception as e: print(f"Error checking room {roomId} before load: {e}")
    filepath = "public/html/room.html"
    return send_file(filepath, mimetype='text/html')

@app.route('/api/room-info/<roomId>', methods=['GET'])
@login_required_http
def get_room_info_api(roomId):
    try: roomInfo = getRoomInfo(roomId)
    except KeyError: return jsonify({"error": "Room not found"}), 404
    return jsonify(roomInfo)

@app.route('/public/js/<filename>', methods=['GET'])
@limiter.exempt # <<< Exempt this route
def getPublicJS(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'public', 'js', filename)
    if os.path.exists(file_path): return send_file(file_path, mimetype="text/javascript")
    else: return "Not Found", 404

@app.route('/public/css/<filename>', methods=['GET'])
@limiter.exempt # <<< Exempt this route
def getPublicCSS(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'public', 'css', filename)
    if os.path.exists(file_path): return send_file(file_path, mimetype="text/css")
    else: return "Not Found", 404

@app.route('/public/img/<filename>', methods=['GET'])
@limiter.exempt # <<< Exempt this route
def get_imgs(filename):
    mimetype = get_mimetype(filename)
    filepath = os.path.join("public", "img", filename) # Use os.path.join
    return send_file(filepath, mimetype=mimetype)

@app.route('/favicon.ico')
@limiter.exempt # Favicon requests shouldn't be limited
def favicon():
    filepath = os.path.join(os.path.dirname(__file__), 'public', 'favicon.ico')
    try:
        return send_file(filepath, mimetype='image/vnd.microsoft.icon')
    except FileNotFoundError:
        abort(404) # Return 404 if the file doesn't exist

@app.route('/api/users/@me', methods=['GET'])
def get_user_profile():
    # print("[DEBUG] /api/users/@me route handler called", flush=True) # <<< ADDED DEBUG
    auth_token = request.cookies.get('auth_token')
    if not auth_token: 
        # print("[DEBUG] /api/users/@me: No auth_token cookie found", flush=True)
        return jsonify({"message": "Not authenticated"}), 401
    
    # print(f"[DEBUG] /api/users/@me: Found auth_token cookie: {auth_token[:5]}...", flush=True)
    user = find_auth(auth_token)
    
    if user is None: 
        # print("[DEBUG] /api/users/@me: find_auth returned None (Invalid token)", flush=True)
        return jsonify({"message": "Invalid token"}), 401
    
    # print(f"[DEBUG] /api/users/@me: User found: {user.get('username')}", flush=True)
    # Use .get() for safer access to dictionary keys
    return jsonify({
        "username": user.get("username", "Unknown"), 
        "avatar_url": user.get("imageURL", "/public/img/default_avatar.webp") # Use imageURL field if exists
    })

# Add URL rules (Keep HEAD versions)
app.add_url_rule('/api/users/settings', 'settingsChange', limiter.limit("10 per hour")(login_required_http(settingsChange)), methods=['POST'])
app.add_url_rule('/register', 'register_route', limiter.limit("5 per hour")(register), methods=['POST'])
app.add_url_rule('/login', 'login_route', limiter.limit("10 per hour")(login), methods=['POST'])

# === Socket IO Handlers (Keep HEAD versions for find_rooms, join_room, start_game, attempt_kill, attempt_task, disconnect) ===

@socketio.on('find_rooms')
def handle_find_rooms():
    # (Keep HEAD version logic)
    sid = request.sid
    auth_token = request.cookies.get('auth_token')
    if not auth_token or find_auth(auth_token) is None:
        emit('find_rooms_error', {'message': 'Authentication required'}, room=sid)
        return
    try:
        listIds = find_rooms() # Fetches IDs from DB
        ret = []
        for ids in listIds:
            try:
                cur_room = getRoomInfo(ids)
                host_player = next((p for p in cur_room.get('players', []) if p.get('isHost')), None)
                ret.append({
                    'roomId': cur_room.get('_id'),
                    'roomName': cur_room.get('roomName'),
                    'roomType': cur_room.get('roomType'),
                    'currPlayers': cur_room.get('currPlayers'),
                    'maxPlayers': cur_room.get('maxPlayers'),
                    'status': cur_room.get('status'),
                    'host': {'name': host_player['username'] if host_player else 'N/A'}
                })
            except KeyError:
                print(f"Room {ids} found by find_rooms but not found by getRoomInfo.")
                continue
        emit("rooms_list", {"rooms": ret}, room=sid)
    except Exception as e:
        print(f"Error handling find_rooms: {e}")
        emit("rooms_list", {"rooms": [], "error": "Could not retrieve room list"}, room=sid)

@socketio.on('join_room')
def handle_join_room(data):
    # (Keep HEAD version logic)
    room_id = data.get('room_id')
    auth_token = request.cookies.get('auth_token')
    sid = request.sid
    if not auth_token: emit('join_error', {'message': 'Unauthorized: Missing token'}, room=sid); return
    user = find_auth(auth_token)
    if not user: emit('join_error', {'message': 'Unauthorized: Invalid token'}, room=sid); return
    try: room_doc = getRoomInfo(room_id)
    except KeyError: emit('join_error', {'message': 'Room not found'}, room=sid); return
    except Exception as e: print(f"DB Error fetching room {room_id} for join: {e}"); emit('join_error', {'message': 'Server error'}, room=sid); return
    if room_doc.get('status') != 'waiting': emit('join_error', {'message': 'Game already started'}, room=sid); return
    username = user['username']
    user_id = user['id']
    player_id_in_room = None
    is_rejoin = False
    current_players_list = room_doc.get('players', [])
    for p in current_players_list:
        if p.get('id') == user_id: player_id_in_room = p.get('id'); is_rejoin = True; break
    if not is_rejoin and room_doc.get('currPlayers', 0) >= room_doc.get('maxPlayers', 0): emit('join_error', {'message': 'Room is full'}, room=sid); return
    player_data_for_update = {}
    pos_key = f'player_positions.{user_id}'
    if is_rejoin:
        print(f"Player {username} ({user_id}) rejoining room {room_id}")
        existing_pos = room_doc.get('player_positions', {}).get(user_id, {})
        existing_pos['username'] = username
        existing_pos['angle'] = existing_pos.get('angle', DEFAULT_ANGLE)
        existing_pos['x'] = existing_pos.get('x', INITIAL_X)
        existing_pos['y'] = existing_pos.get('y', INITIAL_Y)
        player_data_for_update[pos_key] = existing_pos
        update_operation = {'$set': player_data_for_update}
    else:
        print(f"Player {username} ({user_id}) joining room {room_id} as new player")
        new_player_in_list = {'id': user_id, 'username': username, 'isHost': False, 'is_dead': False}
        new_player_position = {'x': INITIAL_X, 'y': INITIAL_Y, 'username': username, 'angle': DEFAULT_ANGLE}
        update_operation = {'$push': {'players': new_player_in_list}, '$inc': {'currPlayers': 1}, '$set': {pos_key: new_player_position}}
    try:
        update_result = roomDB.update_one({'_id': room_id}, update_operation)
        if update_result.matched_count == 0: raise Exception("Room not found during update")
        room_doc = getRoomInfo(room_id)
    except Exception as e:
        print(f"DB Error updating room {room_id} on join: {e}"); emit('join_error', {'message': 'Error saving player data'}, room=sid); return
    join_socketio_room(room_id)
    sid_map[sid] = {'player_id': user_id, 'room_id': room_id, 'username': username}
    current_room_players_positions = room_doc.get('player_positions', {})
    for pid, pdata in current_room_players_positions.items(): pdata.setdefault('angle', DEFAULT_ANGLE)
    emit('current_state', {
        'status': room_doc.get('status'), 'players_positions': current_room_players_positions,
        'all_players_list': room_doc.get('players', []), 'your_id': user_id,
        'it_player_id': room_doc.get('it_player_id') # Send killer ID if game started (None otherwise)
    }, room=sid)
    emit('room_update', {'status': room_doc.get('status'), 'all_players_list': room_doc.get('players', [])}, room=room_id)

@socketio.on('start_game')
def handle_start_game(data):
    # (Keep HEAD version logic)
    room_id = data.get('room_id')
    auth_token = request.cookies.get('auth_token')
    sid = request.sid
    if not auth_token: emit('start_game_error', {'message': 'Unauthorized'}, room=sid); return
    user = find_auth(auth_token)
    if not user: emit('start_game_error', {'message': 'Unauthorized'}, room=sid); return
    try: room_doc = getRoomInfo(room_id)
    except KeyError: emit('start_game_error', {'message': 'Room not found'}, room=sid); return
    except Exception as e: print(f"DB Error fetching room {room_id} for start: {e}"); emit('start_game_error', {'message': 'Server Error'}, room=sid); return
    player_id = sid_map.get(sid, {}).get('player_id')
    if not player_id: emit('start_game_error', {'message': 'Cannot identify player'}, room=sid); return
    host_player = next((p for p in room_doc.get('players', []) if p.get('isHost')), None)
    if not host_player or host_player.get('id') != player_id: emit('start_game_error', {'message': 'Only host can start'}, room=sid); return
    if room_doc.get('status') != 'waiting': emit('start_game_error', {'message': 'Game not waiting'}, room=sid); return
    if room_doc.get('currPlayers', 0) < 2: emit('start_game_error', {'message': 'Need >= 2 players'}, room=sid); return
    killer_player_id = None
    player_ids = [p['id'] for p in room_doc.get('players', [])]
    if player_ids: killer_player_id = random.choice(player_ids)
    tasks_for_room = [{**task_loc, "completed": False} for task_loc in TASK_LOCATIONS]
    total_tasks = len(tasks_for_room)
    try:
        update_payload = {'$set': {'status': 'playing', 'it_player_id': killer_player_id, 'tasks': tasks_for_room, 'totalTasks': total_tasks, 'completedTasks': 0}}
        update_result = roomDB.update_one({'_id': room_id}, update_payload)
        if update_result.matched_count == 0: raise Exception("Room not found during update")
        print(f"[DB] Game started in room {room_id}. Killer: {killer_player_id}. Tasks Initialized: {total_tasks}")
        room_doc = getRoomInfo(room_id)
    except Exception as e: print(f"DB Error starting game in room {room_id}: {e}"); emit('start_game_error', {'message': 'Error starting game'}, room=sid); return
    initial_game_state = {
        'status': room_doc.get('status'), 'players_positions': room_doc.get('player_positions', {}),
        'all_players_list': room_doc.get('players', []), 'tasks': room_doc.get('tasks', []),
        'totalTasks': room_doc.get('totalTasks', 0), 'completedTasks': room_doc.get('completedTasks', 0)
    }
    emit('game_started', initial_game_state, room=room_id)
    if killer_player_id:
        killer_sid = next((csid for csid, cinfo in sid_map.items() if cinfo.get('room_id') == room_id and cinfo.get('player_id') == killer_player_id), None)
        if killer_sid: emit('you_are_killer', {}, room=killer_sid)
        else: print(f"Warning: Could not find SID for killer {killer_player_id}")

# === player_move Handler (Merged) ===
def is_walkable(x, y):
    """Checks if the center point (x, y) is within any walkable rectangle."""
    # Basic map bounds check
    if not (0 <= x < map_width and 0 <= y < map_height):
        return False
    # Check against predefined rectangles
    for rect in WALKABLE_RECTANGLES:
        if rect[0] <= x < rect[2] and rect[1] <= y < rect[3]:
            return True
    return False

@socketio.on('player_move')
def handle_player_move(data):
    sid = request.sid
    if sid not in sid_map:
        print(f"[AUTH ERROR] Move from unknown sid: {sid}")
        return

    player_info = sid_map[sid]
    player_id = player_info['player_id']
    room_id = player_info['room_id']
    username = player_info['username']

    # --- Input Validation --- 
    new_position = data.get('position') # Client sends 'position'
    new_angle = data.get('angle')
    if not isinstance(new_position, dict) or 'x' not in new_position or 'y' not in new_position or new_angle is None:
        print(f"[INVALID DATA] Move from {username} ({sid}) had malformed data: {data}")
        return
    try:
        new_x = float(new_position['x'])
        new_y = float(new_position['y'])
        new_angle = float(new_angle)
    except (ValueError, TypeError):
        print(f"[INVALID DATA] Move from {username} ({sid}) had non-numeric data: {data}")
        return

    try:
        room_doc = getRoomInfo(room_id) # Get latest room state
    except KeyError:
        print(f"[GAME ERROR] Move from {username} ({sid}) for non-existent room {room_id}")
        return
    except Exception as e:
        print(f"[DB ERROR] Failed to get room {room_id} for move: {e}")
        return

    # --- Game State Checks --- 
    if room_doc.get('status') != 'playing':
        # Allow movement only if game is playing
        # print(f"[GAME ERROR] Move attempt from {username} ({sid}) but game not playing in room {room_id}")
        return
    current_players = room_doc.get('players', [])
    player_list_entry = next((p for p in current_players if p.get('id') == player_id), None)
    if not player_list_entry:
        print(f"[GAME ERROR] Move attempt from {username} ({sid}) but player not in room list {room_id}")
        return
    if player_list_entry.get('is_dead'):
        # print(f"[GAME ERROR] Move attempt from dead player {username} ({sid}) in room {room_id}")
        return # Dead players can't move

    # --- Collision & Bounds Check --- 
    # Use map dimensions fetched at start or default
    current_map_width = map_width or 3600
    current_map_height = map_height or 3600
    # Assume player dimensions for now, can be customized later
    player_width = 30
    player_height = 30

    # Clamp position to map boundaries first
    clamped_x = max(player_width / 2, min(new_x, current_map_width - player_width / 2))
    clamped_y = max(player_height / 2, min(new_y, current_map_height - player_height / 2))

    final_x = clamped_x
    final_y = clamped_y

    # Check walkability using rectangle method
    if not is_walkable(clamped_x, clamped_y):
        # Collision detected, keep player at previous position (from DB)
        player_positions = room_doc.get('player_positions', {})
        old_pos = player_positions.get(player_id)
        if old_pos:
            final_x = old_pos.get('x', INITIAL_X)
            final_y = old_pos.get('y', INITIAL_Y)
        else:
            # Should not happen if player is in room, but fallback
            final_x = INITIAL_X
            final_y = INITIAL_Y
        # print(f"Collision detected for {username} at ({clamped_x:.1f}, {clamped_y:.1f}). Reverting to ({final_x:.1f}, {final_y:.1f})")
    # else: print(f"Move for {username} to ({final_x:.1f}, {final_y:.1f}) is walkable.")

    # --- Update Database --- 
    pos_key = f'player_positions.{player_id}'
    update_payload = {
        '$set': {
            pos_key: {
                'x': final_x,
                'y': final_y,
                'angle': new_angle,
                'username': username # Keep username updated
            }
        }
    }
    try:
        update_result = roomDB.update_one({'_id': room_id}, update_payload)
        if update_result.matched_count == 0:
             print(f"[DB ERROR] Failed to update position for {username} ({player_id}) in room {room_id} - Room not found?")
             return
        # print(f"DB update for move: {update_result.raw_result}")
    except Exception as e:
        print(f"[DB ERROR] Failed to update position for {username} ({player_id}) in room {room_id}: {e}")
        return

    # --- Broadcast Update --- 
    update_data = {
        'player_id': player_id,
        'position': {'x': final_x, 'y': final_y},
        'angle': new_angle
    }
    # print(f"Broadcasting player_moved: {update_data} to room {room_id}")
    emit('player_moved', update_data, room=room_id, include_self=False) # Exclude self to avoid echo

@socketio.on('attempt_kill')
def handle_attempt_kill(data):
    # (Keep HEAD version logic)
    room_id = data.get('room_id')
    sid = request.sid
    sender_info = sid_map.get(sid)
    if not sender_info or sender_info.get('room_id') != room_id: return
    killer_player_id = sender_info.get('player_id')
    if not killer_player_id: return
    try:
        room_doc = getRoomInfo(room_id)
        if room_doc.get('status') != 'playing': return
        if room_doc.get('it_player_id') != killer_player_id: return
        killer_pos_data = room_doc.get('player_positions', {}).get(killer_player_id)
        if not killer_pos_data: return
        kill_successful = False
        for victim_player_info in room_doc.get('players', []):
            victim_id = victim_player_info.get('id')
            if victim_id == killer_player_id or victim_player_info.get('is_dead'): continue
            victim_pos_data = room_doc.get('player_positions', {}).get(victim_id)
            if victim_pos_data:
                dist_sq = (killer_pos_data['x'] - victim_pos_data['x'])**2 + (killer_pos_data['y'] - victim_pos_data['y'])**2
                if dist_sq < KILL_RADIUS_SQ:
                    print(f"[KILL] {killer_player_id} KILLED {victim_id} in room {room_id}")
                    try:
                        update_victim = roomDB.update_one({'_id': room_id, 'players.id': victim_id}, {'$set': {'players.$.is_dead': True}})
                        if update_victim.modified_count > 0:
                            kill_successful = True
                            victim_sid = next((csid for csid, cinfo in sid_map.items() if cinfo.get('room_id') == room_id and cinfo.get('player_id') == victim_id), None)
                            emit('player_died', {'victim_id': victim_id}, room=room_id)
                            if victim_sid: emit('you_died', {}, room=victim_sid)
                            # --- Check Game End Condition (Killer Wins) ---
                            try:
                                updated_room_doc = getRoomInfo(room_id)
                                alive_players_count = sum(1 for p in updated_room_doc.get('players', []) if not p.get('is_dead'))
                                killer_info = next((p for p in updated_room_doc.get('players', []) if p.get('id') == killer_player_id), None)
                                killer_username = killer_info.get('username', 'Unknown') if killer_info else 'Unknown'
                                if alive_players_count <= 1:
                                    print(f"[GAME_END] Killer ({killer_username}) wins in room {room_id}!")
                                    roomDB.update_one({'_id': room_id}, {'$set': {'status': 'game_over'}})
                                    emit('game_over', {'message': f'Game Over: {killer_username} (Killer) Wins!', 'outcome': 'killer_win', 'winner_id': killer_player_id, 'winner_username': killer_username, 'status': 'game_over'}, room=room_id)
                                    return # Exit handler early
                            except Exception as end_check_err: print(f"[KILL_ENDCHECK_ERROR] {end_check_err}")
                            # --- End Game End Check ---
                        else: print(f"[KILL] Warning: Failed to update victim {victim_id} status in DB.")
                        break # Only one kill
                    except Exception as db_err: print(f"[KILL] DB Error updating victim {victim_id}: {db_err}"); break
        if not kill_successful: print(f"[KILL] Missed attempt by {killer_player_id} in {room_id}.")
    except KeyError: print(f"[KILL ERROR] Room {room_id} not found.")
    except Exception as e: print(f"[KILL ERROR] Unexpected error in room {room_id}: {e}")

@socketio.on('attempt_task')
def handle_attempt_task(data):
    # (Keep HEAD version logic)
    room_id = data.get('room_id')
    sid = request.sid
    sender_info = sid_map.get(sid)
    if not sender_info or sender_info.get('room_id') != room_id: return
    player_id = sender_info.get('player_id')
    if not player_id: return
    try:
        room_doc = getRoomInfo(room_id)
        if room_doc.get('status') != 'playing': return # Can only do tasks if game is playing
        # Check if player is killer or dead
        player_list = room_doc.get('players', [])
        player_entry = next((p for p in player_list if p.get('id') == player_id), None)
        if not player_entry or player_entry.get('is_dead'): return # Dead players can't do tasks
        if room_doc.get('it_player_id') == player_id: return # Killer can't do tasks
        player_pos = room_doc.get('player_positions', {}).get(player_id)
        if not player_pos: return # Need player position
        tasks_in_room = room_doc.get('tasks', [])
        target_task_id = None
        min_dist_sq = TASK_RADIUS_SQ
        for i, task in enumerate(tasks_in_room):
            if not task.get('completed'):
                dist_sq = (player_pos['x'] - task['x'])**2 + (player_pos['y'] - task['y'])**2
                if dist_sq < min_dist_sq:
                    min_dist_sq = dist_sq
                    target_task_id = task.get('id')
                    task_index_in_db_array = i # Need index for update
        if target_task_id is not None:
            print(f"Player {player_id} attempting task {target_task_id} in room {room_id}")
            try:
                # Update the specific task using its index in the array
                task_completed_key = f'tasks.{task_index_in_db_array}.completed'
                update_result = roomDB.update_one(
                    {'_id': room_id, f'tasks.{task_index_in_db_array}.id': target_task_id}, # Ensure we target the correct task
                    {'$set': {task_completed_key: True}, '$inc': {'completedTasks': 1}}
                )
                if update_result.modified_count > 0:
                    print(f"Task {target_task_id} completed by {player_id} in room {room_id}.")
                    # Refetch completed count after update
                    updated_room_doc = getRoomInfo(room_id)
                    completed_count = updated_room_doc.get('completedTasks', 0)
                    total_count = updated_room_doc.get('totalTasks', 0)
                    emit('task_completed', {'task_id': target_task_id, 'player_id': player_id, 'completedTasks': completed_count, 'totalTasks': total_count}, room=room_id)
                    # --- Check Game End Condition (Players Win) ---
                    if completed_count >= total_count > 0: # Ensure totalTasks > 0
                        print(f"[GAME_END] Players win by completing all tasks ({completed_count}/{total_count}) in room {room_id}!")
                        roomDB.update_one({'_id': room_id}, {'$set': {'status': 'game_over'}})
                        emit('game_over', {'message': 'Players Win! All tasks completed!', 'outcome': 'players_win', 'status': 'game_over'}, room=room_id)
                        return # Exit handler early
                    # --- End Game End Check ---
                else: print(f"[TASK] Failed to update task {target_task_id} status in DB.")
            except Exception as db_err: print(f"[TASK] DB Error completing task {target_task_id}: {db_err}")
        else: print(f"Player {player_id} tried task in {room_id}, but none in range.")
    except KeyError: print(f"[TASK ERROR] Room {room_id} not found.")
    except Exception as e: print(f"[TASK ERROR] Unexpected error in room {room_id}: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    # (Keep HEAD version logic)
    sid = request.sid
    if sid in sid_map:
        player_info = sid_map.pop(sid)
        room_id = player_info.get('room_id')
        player_id = player_info.get('player_id')
        username = player_info.get('username', 'Unknown')
        print(f"Player {username} ({player_id}) disconnected from room {room_id} (SID: {sid})")
        try:
            room_doc_before = getRoomInfo(room_id) # Get state before update
            # Construct update to remove player and decrement count
            update_result = roomDB.update_one(
                {'_id': room_id},
                {
                    '$pull': {'players': {'id': player_id}},
                    '$inc': {'currPlayers': -1}
                    # Consider removing position data too?
                    # '$unset': {f'player_positions.{player_id}': ""}
                }
            )
            if update_result.matched_count > 0 and update_result.modified_count > 0:
                print(f"Removed player {player_id} from room {room_id} list in DB.")
                room_doc_after = getRoomInfo(room_id) # Get state after update
                new_player_list = room_doc_after.get('players', [])
                current_status = room_doc_after.get('status')
                 # Check if host left
                host_left = not any(p.get('isHost') for p in new_player_list)
                if host_left and current_status == 'waiting' and new_player_list:
                     # Assign a new host
                     new_host_id = new_player_list[0]['id']
                     roomDB.update_one(
                         {'_id': room_id, 'players.id': new_host_id},
                         {'$set': {'players.$.isHost': True}}
                     )
                     print(f"Host left room {room_id}. Assigned new host: {new_host_id}")
                     # Refetch after host update for correct broadcast
                     room_doc_after = getRoomInfo(room_id)
                     new_player_list = room_doc_after.get('players', [])
                emit('room_update', {'status': current_status, 'all_players_list': new_player_list}, room=room_id)
            elif update_result.matched_count == 0:
                print(f"Room {room_id} not found during disconnect update.")
            else: # Corresponds to modified_count == 0
                print(f"Player {player_id} not found in room {room_id} list for removal or no change needed.")
        except KeyError:
            print(f"Room {room_id} already deleted or not found during disconnect.")
        except Exception as e:
            print(f"Error updating room {room_id} on disconnect for player {player_id}: {e}")
    else: # Corresponds to `if sid in sid_map:`
        print(f"Disconnected SID {sid} not found in sid_map.")

# === Collision Logic (Simplified) ===
# Removed is_walkable_for_room as it relied on deleted in-memory structure
# is_walkable handles the check based on predefined rectangles now.

# === Main Execution (Keep HEAD version) ===
if __name__ == '__main__':
    print("Starting server with eventlet...")
    socketio.run(app, host='0.0.0.0', port=8080, use_reloader=False)
