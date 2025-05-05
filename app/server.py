import os
os.environ['FLASK_APP'] = 'app/server.py'
# os.environ['FLASK_DEBUG'] = '1' # Optionally uncomment for auto-reload

from flask import Flask, request, send_file, abort, jsonify, make_response, redirect, url_for, g
from flask_socketio import SocketIO, emit, join_room as join_socketio_room, leave_room
import datetime
from util.room import create_room, find_rooms, getRoomInfo # Import DB functions
from util.authentication import *
from util.settings import settingsChange
from util.database import roomDB, userDB # Import userDB for logout
from util.achieve import *
import os
import eventlet
from util.serve import *
import uuid
import random
import math # Add math import for pi
from PIL import Image, ImageDraw # Import Pillow
from flask_limiter import Limiter # Import Limiter
from flask_limiter.util import get_remote_address # Import address getter
from functools import wraps # Added wraps for decorator
import pymongo
from dotenv import load_dotenv
import json
from datetime import datetime, timedelta, timezone # Added timezone
import threading # Added threading
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

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
# LOG_FILE = '/app/requests.log' # Main log file
# FULL_REQUEST_LOG_FILE = '/app/full_requests.log' # Separate file for full req/resp
# MAX_LOG_BODY_SIZE = 2048 # Max bytes for request/response bodies in full log
# AUTH_TOKEN_REDACTION = '[REDACTED_AUTH_TOKEN]' # Placeholder for redacted token
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
# LOG_FILE = os.path.join(LOGS_DIR, 'requests.log')
LOG_FILE = os.path.join(LOGS_DIR, 'requests.log')

# --- Define initial player starting position --- 
INITIAL_X = 1800
INITIAL_Y = 1800
DEFAULT_ANGLE = -math.pi / 2 # Facing down

# Define fixed task locations (example)
TASK_LOCATIONS = [
    { "id": "task_top",    "x": 1800, "y": 300,  "type": "timing_download" },
    { "id": "task_left",   "x": 300,  "y": 1800, "type": "wires"        },
    { "id": "task_bottom", "x": 1800, "y": 3200, "type": "keypad"       },
    { "id": "task_right",  "x": 3200, "y": 1800, "type": "pattern"      },
    { "id": "task_center", "x": 1500, "y": 1500, "type": "steering"     },
]
TASK_RADIUS = 40
TASK_RADIUS_SQ = TASK_RADIUS * TASK_RADIUS
KILL_RADIUS = 75 # Adjusted kill radius
KILL_RADIUS_SQ = KILL_RADIUS * KILL_RADIUS

# --- Constants ---
MIN_PLAYERS = 2
MAX_PLAYERS = 10
MEETING_DURATION_SECONDS = 30
EMERGENCY_BUTTON_COOLDOWN_SECONDS = 30 # Changed from 120 to 30

@app.before_request
def log_req():
    if not os.path.exists(LOGS_DIR):
        try:
            os.makedirs(LOGS_DIR)
        except OSError as e:
            print(f"Error creating logs directory {LOGS_DIR}: {e}")
            return
    # dt = datetime.now()
    dt = datetime.now() # Use datetime.datetime explicitly
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

@app.route('/register',methods=['POST'])
def handle_reg():
    username, success, reason, res, code = register()
    log_auth_attempt(username, success, reason)
    return res, code

def log_auth_attempt(username, success, reason=""):
    dt = datetime.now().strftime('%m-%d-%Y %H:%M:%S')
    status = "SUCCESS" if success else f"FAILURE ({reason})"
    log_line = f"[{dt}]: LOGIN ATTEMPT - {username} -> {status}"
    with open(LOG_FILE, 'a') as f:
        f.write(log_line)

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

@app.route('/stats', methods=['GET'])
@login_required_http
def getStats():
    filepath = "public/html/stats.html"
    auth_token = request.cookies.get('auth_token')
    user = find_auth(auth_token)
    stats = user.get('stats')
    achievements = user.get('achievements')
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace('gamesPlayed',str(stats.get('gamesPlayed',None)))
    content = content.replace('gamesWon',str(stats.get('gamesWon',None)))
    if int(stats.get('gamesPlayed')) != 0:
        winper = (int(stats.get('gamesWon'))/int(stats.get('gamesPlayed')))*100
    else:
        winper = 0
    content = content.replace('winPer',str(winper))
    content = content.replace('crewGames',str(int(stats.get('gamesPlayed'))-int(stats.get('saboteurPlayed'))))
    content = content.replace('tasks',str(stats.get('tasksDone',None)))
    content = content.replace('killGames',str(stats.get('saboteurPlayed',None)))
    content = content.replace('playersKilled',str(stats.get('playersKilled',None)))

    content = content.replace("firstGame", "Unlocked" if 'First Game Played' in achievements else "Locked")
    content = content.replace("firstWin", "Unlocked" if 'First Game Won' in achievements else "Locked")
    content = content.replace("firstKill", "Unlocked" if 'First Kill' in achievements else "Locked")
    content = content.replace("playedFive", "Unlocked" if 'Play 5 Games' in achievements else "Locked")
    content = content.replace("killedFive", "Unlocked" if 'Kill 5 Players' in achievements else "Locked")
    content = content.replace("wonFive", "Unlocked" if 'Win 5 Games' in achievements else "Locked")

    res = make_response(content)
    res.headers['X-Content-Type-Options'] = "nosniff"
    res.headers['Content-Type'] = 'text/html'

    return res, 200

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
    except Exception as e: print(f"Error fetching room info API for {roomId}: {e}"); return jsonify({"error": "Server error fetching room info"}), 500
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

def overlay_avatar_on_base(base_path, avatar_path, circle_center, circle_radius):
    base = Image.open(base_path).convert("RGBA")
    avatar = Image.open(avatar_path).convert("RGBA")

    # Create circular mask
    mask = Image.new("L", base.size, 0)
    draw = ImageDraw.Draw(mask)
    x, y = circle_center
    draw.ellipse((x - circle_radius, y - circle_radius, x + circle_radius, y + circle_radius), fill=255)

    # Resize avatar to fit circle
    avatar = avatar.resize((circle_radius * 2, circle_radius * 2), Image.LANCZOS)

    # Create transparent image to paste avatar in right spot
    positioned_avatar = Image.new("RGBA", base.size, (0, 0, 0, 0))
    positioned_avatar.paste(avatar, (x - circle_radius, y - circle_radius), avatar)

    # Composite avatar using mask
    combined = Image.composite(positioned_avatar, base, mask)

    return combined

@app.route('/api/user/update', methods=['POST'])
def update_user():
    avatar = request.files.get('avatar')

    auth_token = request.cookies.get("auth_token")
    if not auth_token:
        return jsonify({"message": "Access denied"}), 403

    hashed_token = hashlib.sha256(auth_token.encode()).hexdigest()
    current_user = userDB.find_one({"hashed_token": hashed_token})

    if not current_user:
        return jsonify({"message": "Current user does not exist"}), 403

    if avatar:
        filename = secure_filename(avatar.filename)
        filepath = os.path.join("./public/img", filename)
        avatar.save(filepath)

        image_url = f"/public/img/{filename}"

        userDB.update_one({"hashed_token" : hashed_token}, {"$set": {"imageURL": image_url}})

        result = overlay_avatar_on_base("./public/img/Character.png", f"./public/img/{filename}", (197, 100), 28)
        filepath = os.path.join("./public/img", current_user["username"] + "_model.png")
        result.save(filepath)

        model_url = f"/public/img/" + current_user["username"] + "_model.png"   

        userDB.update_one({"hashed_token" : hashed_token}, {"$set": {"characterURL": model_url}})

    return jsonify({"message": "Profile updated successfully"})

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
    except Exception as e: print(f"Error fetching room info API for {roomId}: {e}"); return jsonify({"error": "Server error fetching room info"}), 500
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
    auth_token = request.cookies.get('auth_token')
    if not auth_token:
        return jsonify({"message": "Not authenticated"}), 401
    
    user = find_auth(auth_token)
    
    if user is None:
        return jsonify({"message": "Invalid token"}), 401
    
    return jsonify({
        "username": user.get("username", "Unknown"), 
        "avatar_url": user.get("imageURL", "/public/img/default_avatar.webp") # Use imageURL field if exists
    })

@app.route('/stats', methods=['GET'])
@login_required_http
def getStats():
    filepath = "public/html/stats.html"
    auth_token = request.cookies.get('auth_token')
    user = find_auth(auth_token)
    stats = user.get('stats')
    achievements = user.get('achievements')
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace('gamesPlayed',str(stats.get('gamesPlayed',None)))
    content = content.replace('gamesWon',str(stats.get('gamesWon',None)))
    if int(stats.get('gamesPlayed')) != 0:
        winper = (int(stats.get('gamesWon'))/int(stats.get('gamesPlayed')))*100
    else:
        winper = 0
    content = content.replace('winPer',str(winper))
    content = content.replace('crewGames',str(int(stats.get('gamesPlayed'))-int(stats.get('saboteurPlayed'))))
    content = content.replace('tasks',str(stats.get('tasksDone',None)))
    content = content.replace('killGames',str(stats.get('saboteurPlayed',None)))
    content = content.replace('playersKilled',str(stats.get('playersKilled',None)))

    content = content.replace("firstGame", "Unlocked" if 'First Game Played' in achievements else "Locked")
    content = content.replace("firstWin", "Unlocked" if 'First Game Won' in achievements else "Locked")
    content = content.replace("firstKill", "Unlocked" if 'First Kill' in achievements else "Locked")
    content = content.replace("playedFive", "Unlocked" if 'Play 5 Games' in achievements else "Locked")
    content = content.replace("killedFive", "Unlocked" if 'Kill 5 Players' in achievements else "Locked")
    content = content.replace("wonFive", "Unlocked" if 'Win 5 Games' in achievements else "Locked")

    res = make_response(content)
    res.headers['X-Content-Type-Options'] = "nosniff"
    res.headers['Content-Type'] = 'text/html'

    return res, 200

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
        # Revised approach v3: Use $addToSet & $set together, then conditionally $inc
        update_operation_part1 = {
            '$addToSet': {'players': new_player_in_list},
            '$set': {pos_key: new_player_position}
        }
    try:
        # For non-rejoin cases, perform the revised update
        if not is_rejoin:
            print(f"Adding/updating player {user_id} with $addToSet and $set.")
            # 1. Add to set first
            add_result = roomDB.update_one({'_id': room_id}, {'$addToSet': {'players': new_player_in_list}})
            if add_result.matched_count == 0:
                 raise Exception(f"Room {room_id} not found during $addToSet.")
            
            # 2. Update position (always do this for a join attempt)
            roomDB.update_one({'_id': room_id}, {'$set': {pos_key: new_player_position}})

            # 3. Fetch updated doc and set count based on actual array length
            room_doc_after_add = getRoomInfo(room_id)
            actual_player_count = len(room_doc_after_add.get('players', []))
            roomDB.update_one({'_id': room_id}, {'$set': {'currPlayers': actual_player_count}})

        else: # Handle rejoin case (original logic)
             # Ensure the count is also correct on rejoin, might as well sync it here too?
             update_result = roomDB.update_one({'_id': room_id}, update_operation) # Sets position
             if update_result.matched_count == 0: raise Exception("Room not found during rejoin update")
             # Sync count on rejoin as well
             room_doc_after_rejoin = getRoomInfo(room_id)
             actual_player_count_rejoin = len(room_doc_after_rejoin.get('players', []))
             roomDB.update_one({'_id': room_id}, {'$set': {'currPlayers': actual_player_count_rejoin}})

        # Fetch final state after all updates
        room_doc = getRoomInfo(room_id)

    except Exception as e:
        print(f"DB Error updating room {room_id} on join: {e}"); emit('join_error', {'message': 'Error saving player data'}, room=sid); return
    join_socketio_room(room_id)
    sid_map[sid] = {'player_id': user_id, 'room_id': room_id, 'username': username}
    current_room_players_positions = room_doc.get('player_positions', {})
    for pid, pdata in current_room_players_positions.items(): pdata.setdefault('angle', DEFAULT_ANGLE)

    # Emit success back to the specific client that just joined, triggering redirect
    emit('join_room_success', {'roomId': room_id}, room=sid)

    # Emit the updated room state to the joining client
    # --- Convert cooldown to ISO string before emitting ---
    cooldown_dt = room_doc.get('emergency_button_cooldown_until')
    cooldown_iso = cooldown_dt.isoformat() if isinstance(cooldown_dt, datetime) else None
    emit('current_state', {
        'status': room_doc.get('status'), 'players_positions': current_room_players_positions,
        'all_players_list': room_doc.get('players', []), 'your_id': user_id,
        'it_player_id': room_doc.get('it_player_id'), # Send killer ID if game started (None otherwise)
        'emergency_button_cooldown_until': cooldown_iso # Send ISO string or None
    }, room=sid)

    # Emit update to everyone else in the room
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
        # --- ADDED: Calculate initial kill cooldown time ---
        initial_cooldown_seconds = 5
        now_utc = datetime.now(timezone.utc)
        initial_kill_ready_time = now_utc + timedelta(seconds=initial_cooldown_seconds)

        update_payload = {'$set': {
            'status': 'playing', 
            'it_player_id': killer_player_id, 
            'tasks': tasks_for_room, 
            'totalTasks': total_tasks, 
            'completedTasks': 0,
            # --- ADDED: Initialize killer cooldown in DB ---
            'killer_can_kill_after': initial_kill_ready_time 
        }}
        update_result = roomDB.update_one({'_id': room_id}, update_payload)
        if update_result.matched_count == 0: raise Exception("Room not found during update")
        print(f"[DB] Game started in room {room_id}. Killer: {killer_player_id}. Tasks Initialized: {total_tasks}. Initial kill ready at: {initial_kill_ready_time.isoformat()}")
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
        if killer_sid: 
            player = userDB.find_one({"id": killer_player_id})
            if player is not None:
                player_stats = player["stats"]
                player_stats["saboteurPlayed"] += 1
                userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                roomDB.update_one({'_id': room_id}, {"$set": {"saboteurUsername": player["username"]}})
            else:
                print(f"Warning: Could not find player object for killer id {killer_player_id}")
            emit('you_are_killer', {}, room=killer_sid)
            # --- ADDED: Emit initial cooldown to killer ---
            emit('kill_cooldown_update', {'cooldown_ends_at': initial_kill_ready_time.isoformat()}, room=killer_sid)
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
        return
    current_players = room_doc.get('players', [])
    player_list_entry = next((p for p in current_players if p.get('id') == player_id), None)
    if not player_list_entry:
        print(f"[GAME ERROR] Move attempt from {username} ({sid}) but player not in room list {room_id}")
        return
    if player_list_entry.get('is_dead'):
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
    except Exception as e:
        print(f"[DB ERROR] Failed to update position for {username} ({player_id}) in room {room_id}: {e}")
        return

    # --- Broadcast Update --- 
    update_data = {
        'player_id': player_id,
        'position': {'x': final_x, 'y': final_y},
        'angle': new_angle
    }
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

        # --- ADDED: Check Kill Cooldown ---
        now_utc = datetime.now(timezone.utc)
        kill_ready_time = room_doc.get('killer_can_kill_after') 
        
        # Handle potential missing field or different timezone format if needed
        if kill_ready_time and isinstance(kill_ready_time, datetime):
             # Ensure comparison is timezone-aware
            if kill_ready_time.tzinfo is None:
                kill_ready_time = kill_ready_time.replace(tzinfo=timezone.utc) # Assume UTC if no timezone info

            if now_utc < kill_ready_time: # Just check, no need to print here
                # --- ADDED: Emit cooldown status back to killer ---
                emit('kill_cooldown_update', {'cooldown_ends_at': kill_ready_time.isoformat()}, room=sid)
                return # Exit if cooldown is active
        elif kill_ready_time:
             print(f"[KILL WARN] killer_can_kill_after for room {room_id} is not a datetime object: {type(kill_ready_time)}")
             # Decide how to handle this - maybe default to allowing the kill or resetting cooldown? For now, let it proceed.
        # --- End Cooldown Check ---

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
                            # If victim killed, add to userDB with user's stats
                            # Assumes killer_player_id is equivalent to the player's username
                            #
                            # Grabs stats, appends playersKilled by 1, then updates with new stats
                            player = userDB.find_one({"id": killer_player_id})
                            if player is not None:
                                player_stats = player["stats"]
                                player_stats["playersKilled"] += 1
                                userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                            else:
                                print(f"Could not find player object for player id {killer_player_id}")
                            
                            # --- ADDED: Set next kill cooldown --- 
                            kill_cooldown_seconds = 5
                            next_kill_ready_time = datetime.now(timezone.utc) + timedelta(seconds=kill_cooldown_seconds)
                            roomDB.update_one({'_id': room_id}, {'$set': {'killer_can_kill_after': next_kill_ready_time}})

                            # --- ADDED: Emit new cooldown to killer ---
                            killer_sid = next((csid for csid, cinfo in sid_map.items() if cinfo.get('room_id') == room_id and cinfo.get('player_id') == killer_player_id), None)
                            if killer_sid: 
                                emit('kill_cooldown_update', {'cooldown_ends_at': next_kill_ready_time.isoformat()}, room=killer_sid)
                            # --- End Emit Cooldown ---

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
                                    # given a list of all players in lobby, add 1 to games played for all of them
                                    for player_item in player_list:
                                        player_id = player_item["id"]
                                        player = userDB.find_one({"id": player_id})
                                        if player is not None:
                                            player_stats = player["stats"]
                                            player_stats["gamesPlayed"] += 1

                                            # check if they're killer, somehow, and add a win
                                            killer = userDB.find_one({"id": killer_player_id})
                                            if player["username"] == killer["username"]:
                                                player_stats["gamesWon"] += 1
                                            # update for each player their new stats
                                            userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                                        else:
                                            print(f"Could not find player for id {player_id}")
                                    achieve(player_list)
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
    # (Keep HEAD version logic for initial checks)
    room_id = data.get('room_id')
    sid = request.sid
    sender_info = sid_map.get(sid)
    if not sender_info or sender_info.get('room_id') != room_id: return
    player_id = sender_info.get('player_id')
    if not player_id: return
    try:
        room_doc = getRoomInfo(room_id)
        if room_doc.get('status') != 'playing': return
        player_list = room_doc.get('players', [])
        player_entry = next((p for p in player_list if p.get('id') == player_id), None)
        if not player_entry or player_entry.get('is_dead'): return
        if room_doc.get('it_player_id') == player_id: return
        player_pos = room_doc.get('player_positions', {}).get(player_id)
        if not player_pos: return

        tasks_in_room = room_doc.get('tasks', [])
        target_task_id = None
        target_task_type = None
        target_task_index = -1 # Keep track of index for potential use later
        min_dist_sq = TASK_RADIUS_SQ

        for i, task in enumerate(tasks_in_room):
            if not task.get('completed'):
                dist_sq = (player_pos['x'] - task['x'])**2 + (player_pos['y'] - task['y'])**2
                if dist_sq < min_dist_sq:
                    min_dist_sq = dist_sq
                    target_task_id = task.get('id')
                    # --- MODIFIED: Get task type ---
                    target_task_type = task.get('type', 'simple_click') # Default if type missing
                    target_task_index = i

        if target_task_id is not None:
            emit('start_task_minigame', {'task_id': target_task_id, 'task_type': target_task_type}, room=sid)
        else:
            print(f"Player {player_id} tried task in {room_id}, but none in range.")
    except KeyError: print(f"[TASK ERROR] Room {room_id} not found.")
    except Exception as e: print(f"[TASK ERROR] Unexpected error in handle_attempt_task room {room_id}: {e}")

@socketio.on('complete_task_minigame')
def handle_complete_task_minigame(data):
    room_id = data.get('room_id')
    task_id_completed = data.get('task_id')
    sid = request.sid
    sender_info = sid_map.get(sid)

    # Basic validation
    if not sender_info or sender_info.get('room_id') != room_id:
        print(f"[TASK COMPLETE ERROR] Invalid sender or room mismatch for sid {sid} in room {room_id}")
        return
    if not task_id_completed:
        print(f"[TASK COMPLETE ERROR] Missing task_id from sid {sid} in room {room_id}")
        return

    player_id = sender_info.get('player_id')
    if not player_id:
        print(f"[TASK COMPLETE ERROR] Cannot identify player for sid {sid}")
        return

    try:
        room_doc = getRoomInfo(room_id)
        # --- Re-verify player/game status before completing ---
        if room_doc.get('status') != 'playing':
            print(f"[TASK COMPLETE ERROR] Game not playing in room {room_id}. Player {player_id} tried to complete {task_id_completed}.")
            return
        player_list = room_doc.get('players', [])
        player_entry = next((p for p in player_list if p.get('id') == player_id), None)
        if not player_entry or player_entry.get('is_dead'):
            print(f"[TASK COMPLETE ERROR] Dead or non-existent player {player_id} tried to complete {task_id_completed} in room {room_id}.")
            return
        if room_doc.get('it_player_id') == player_id:
            print(f"[TASK COMPLETE ERROR] Killer {player_id} tried to complete {task_id_completed} in room {room_id}.")
            return

        # Find the index of the task being completed
        tasks_in_room = room_doc.get('tasks', [])
        task_index_in_db_array = -1
        for i, task in enumerate(tasks_in_room):
            if task.get('id') == task_id_completed:
                 if task.get('completed'): return # Silently ignore if already done
                 task_index_in_db_array = i
                 break

        if task_index_in_db_array == -1:
            print(f"[TASK COMPLETE ERROR] Task {task_id_completed} not found in room {room_id} for completion attempt by {player_id}.")
            return

        # --- Proceed with DB Update ---
        print(f"Player {player_id} completing task {task_id_completed} in room {room_id}")
        try:
            task_completed_key = f'tasks.{task_index_in_db_array}.completed'
            update_result = roomDB.update_one(
                {'_id': room_id, f'tasks.{task_index_in_db_array}.id': task_id_completed},
                {'$set': {task_completed_key: True}, '$inc': {'completedTasks': 1}}
            )

            if update_result.modified_count > 0:
                # Refetch completed count after update
                updated_room_doc = getRoomInfo(room_id)
                completed_count = updated_room_doc.get('completedTasks', 0)
                total_count = updated_room_doc.get('totalTasks', 0)
                emit('task_completed', {'task_id': task_id_completed, 'player_id': player_id, 'completedTasks': completed_count, 'totalTasks': total_count}, room=room_id)

                # If task completed, add to userDB with user's stats
                # Assumes player_id is equivalent to the player's username
                #
                # Grabs stats, appends tasksDone by 1, then updates with new stats
                player = userDB.find_one({"id":player_id})
                if player is not None:
                    player_stats = player["stats"]
                    player_stats["tasksDone"] += 1
                    userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                else:
                    print(f"Could not find player object for player id {player_id}")


                # Check Game End Condition (Players Win)
                if completed_count >= total_count > 0:
                    print(f"[GAME_END] Players win by completing all tasks ({completed_count}/{total_count}) in room {room_id}!")

                    # given a list of all players in lobby, add 1 to games played for all of them
                    for player_item in player_list:
                        player_id = player_item["id"]
                        player = userDB.find_one({"id": player_id})
                        if player is not None:
                            player_stats = player["stats"]
                            player_stats["gamesPlayed"] += 1

                            # check if they're not killer, somehow, and add a win
                            if player["username"] != room_doc["saboteurUsername"]:
                                player_stats["gamesWon"] += 1
                        
                            # update for each player their new stats
                            userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                        else:
                            print(f"Could not find player object for player id {player_id}")
                    achieve(player_list)
                    roomDB.update_one({'_id': room_id}, {'$set': {'status': 'game_over'}})
                    emit('game_over', {'message': 'Players Win! All tasks completed!', 'outcome': 'players_win', 'status': 'game_over'}, room=room_id)
                    # Note: No early return needed here as it's the end of the handler
            else:
                print(f"[TASK COMPLETE ERROR] Failed to update task {task_id_completed} status in DB for player {player_id} in room {room_id}.")
        except Exception as db_err:
            print(f"[TASK COMPLETE DB ERROR] DB Error completing task {task_id_completed} by {player_id}: {db_err}")

    except KeyError: print(f"[TASK COMPLETE ERROR] Room {room_id} not found.")
    except Exception as e: print(f"[TASK COMPLETE ERROR] Unexpected error in handle_complete_task_minigame room {room_id}: {e}")

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

# Dictionary to keep track of active meeting timers (room_id -> threading.Timer object)
meeting_timers = {}
# --- ADDED: Lock for thread-safe access to meeting_timers ---
meeting_timers_lock = threading.Lock()

def end_meeting(room_id):
    """Function to be called when the meeting timer expires OR all votes are in."""
    with app.app_context(): # Need app context for DB operations and emit
        # --- Acquire Lock --- 
        with meeting_timers_lock:
            # Check if timer still exists and remove it
            timer = meeting_timers.pop(room_id, None)
            if timer: 
                # We are likely called by the timer thread itself, but cancel just in case
                # of rare race conditions where end_meeting is called manually *just* before timer fires.
                timer.cancel() 
            else:
                # Timer was already removed, likely by the vote handler.
                # Check status again to be sure we should proceed.
                try:
                    current_status = getRoomInfo(room_id).get('status')
                    if current_status != 'meeting':
                        print(f"[MEETING] end_meeting called for room {room_id}, but timer already gone AND status is {current_status}. Aborting.")
                        return # Exit early, meeting already ended
                    else:
                        print(f"[MEETING] end_meeting called for room {room_id}, timer already removed (likely by vote handler), proceeding.")
                except KeyError:
                     print(f"[MEETING ERROR] Room {room_id} not found when checking status in end_meeting after timer removal.")
                     return # Exit if room doesn't exist
                except Exception as e:
                     print(f"[MEETING ERROR] DB error checking status in end_meeting for room {room_id}: {e}")
                     return # Exit on other DB errors
            room_doc = None
            # --- Double-check status *after* lock acquisition and timer removal ---
            # This is the most critical check to prevent double execution
            try:
                room_doc = getRoomInfo(room_id)
                if room_doc.get('status') != 'meeting':
                    print(f"[MEETING] end_meeting called for room {room_id}, but status is now {room_doc.get('status')} (already ended?). Aborting.")
                    # No need to release lock here, `with` handles it.
                    return
            except KeyError:
                 print(f"[MEETING ERROR] Room {room_id} not found during final status check in end_meeting.")
                 return
            except Exception as e:
                 print(f"[MEETING ERROR] DB error during final status check in end_meeting for room {room_id}: {e}")
                 return

            # --- Proceed with ending the meeting (rest of the logic is within the lock) ---
            print(f"[MEETING] Proceeding to end meeting for room {room_id}.")
            # --- Tally Votes (moved print inside) ---
            print(f"[MEETING] Ending meeting for room {room_id}.") # Combined print

            # --- Tally Votes ---
            votes = room_doc.get('meeting_votes', {})
            vote_counts = {}
            for voter, voted_for in votes.items():
                vote_counts[voted_for] = vote_counts.get(voted_for, 0) + 1

            ejected_player_id = None
            max_votes = 0
            tied = False
            if vote_counts:
                sorted_votes = sorted(vote_counts.items(), key=lambda item: item[1], reverse=True)
                max_votes = sorted_votes[0][1]
                # Check for tie (more than one player has max_votes)
                if len(sorted_votes) > 1 and sorted_votes[1][1] == max_votes:
                    tied = True
                    print(f"[MEETING] Vote tied in room {room_id}.")
                elif max_votes > 0: # Ensure there was at least one vote
                    ejected_player_id = sorted_votes[0][0]
                    print(f"[MEETING] Player {ejected_player_id} voted out in room {room_id} with {max_votes} votes.")

            # --- Process Ejection ---
            game_over_data = None
            final_status = 'playing' # Assume game continues unless win condition met
            new_player_list = room_doc.get('players', []) # Start with current list

            if ejected_player_id:
                # Mark player as dead in the database
                update_ejected = roomDB.update_one(
                    {'_id': room_id, 'players.id': ejected_player_id},
                    {'$set': {'players.$.is_dead': True}}
                )
                if update_ejected.modified_count > 0:
                    print(f"[DB] Marked ejected player {ejected_player_id} as dead in room {room_id}.")
                    # Emit death events using socketio.emit
                    ejected_sid = next((csid for csid, cinfo in sid_map.items() if cinfo.get('room_id') == room_id and cinfo.get('player_id') == ejected_player_id), None)
                    socketio.emit('player_died', {'victim_id': ejected_player_id}, room=room_id)
                    if ejected_sid: socketio.emit('you_died', {}, room=ejected_sid)

                    # Refetch room doc to get updated player list for win checks
                    room_doc = getRoomInfo(room_id)
                    new_player_list = room_doc.get('players', [])

                    # --- Check Win Conditions After Ejection ---
                    killer_id = room_doc.get('it_player_id')
                    if ejected_player_id == killer_id:
                        # Crew Wins
                        print(f"[GAME_END] Crew wins by ejecting killer {ejected_player_id} in room {room_id}!")
                        # given a list of all players in lobby, add 1 to games played for all of them
                        for player_item in new_player_list:
                            player_id = player_item["id"]
                            player = userDB.find_one({"id": player_id})
                            if player is not None:
                                player_stats = player["stats"]
                                player_stats["gamesPlayed"] += 1

                                # check if they're killer, somehow, and add a win
                                killer = userDB.find_one({"id": killer_id})
                                if player["username"] != killer["username"]:
                                    player_stats["gamesWon"] += 1
                            
                                # update for each player their new stats
                                userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                            else:
                                print(f"Could not find player object for player id {player_id}")
                        final_status = 'game_over'
                        game_over_data = {'message': 'Crew Wins! The Killer was ejected!', 'outcome': 'crew_win_vote', 'status': 'game_over'}
                    else:
                        # Check if Killer Wins (only killer left alive)
                        alive_players = [p for p in new_player_list if not p.get('is_dead')]
                        alive_crew = [p for p in alive_players if p.get('id') != killer_id]
                        if not alive_crew: # No alive crewmates left
                            killer_info = next((p for p in new_player_list if p.get('id') == killer_id), None)
                            killer_username = killer_info.get('username', 'Unknown') if killer_info else 'Unknown'
                            print(f"[GAME_END] Killer ({killer_username}) wins after ejection in room {room_id}!")
                            # given a list of all players in lobby, add 1 to games played for all of them
                            for player_item in new_player_list:
                                player_id = player_item["id"]
                                player = userDB.find_one({"id": player_id})
                                if player is not None:
                                    player_stats = player["stats"]
                                    player_stats["gamesPlayed"] += 1

                                    # check if they're killer, somehow, and add a win
                                    if player["username"] == killer_username:
                                        player_stats["gamesWon"] += 1
                                
                                    # update for each player their new stats
                                    userDB.update_one({"username": player["username"]}, {"$set": {"stats": player_stats}})
                                else:
                                    print(f"Could not find player object for player id {player_id}")
                            final_status = 'game_over'
                            game_over_data = {'message': f'Game Over: {killer_username} (Killer) Wins!', 'outcome': 'killer_win_vote', 'winner_id': killer_id, 'winner_username': killer_username, 'status': 'game_over'}

            # --- Update Room Status and Cooldown ---
            cooldown_time = datetime.now(timezone.utc) + timedelta(seconds=EMERGENCY_BUTTON_COOLDOWN_SECONDS)
            update_fields = {'status': final_status, 'meeting_votes': {}, 'meeting_caller_id': None, 'emergency_button_cooldown_until': cooldown_time}
            roomDB.update_one({'_id': room_id}, {'$set': update_fields})
            print(f"[DB] Updated room {room_id} status to {final_status}, reset votes, set cooldown.")

            # --- Emit Meeting Ended using socketio.emit ---
            # --- Convert cooldown to ISO string before emitting ---
            cooldown_iso_end = cooldown_time.isoformat() # Convert to string
            meeting_end_payload = {
                'outcome': 'tie' if tied else ('ejected' if ejected_player_id else 'no_votes'),
                'ejected_player_id': ejected_player_id,
                'status': final_status,
                 'players': new_player_list, # Send updated player list
                 'emergency_button_cooldown_until': cooldown_iso_end # Send ISO string
            }
            socketio.emit('meeting_ended', meeting_end_payload, room=room_id)

            # --- Emit Game Over if necessary using socketio.emit ---
            if game_over_data:
                socketio.emit('game_over', game_over_data, room=room_id)

        # --- Lock automatically released by `with` statement ---

@socketio.on('call_meeting')
def handle_call_meeting(data):
    room_id = data.get('room_id')
    sid = request.sid
    sender_info = sid_map.get(sid)
    if not sender_info or sender_info.get('room_id') != room_id:
        print(f"[MEETING AUTH] Invalid call from SID {sid} for room {room_id}.")
        return # Basic auth check

    player_id = sender_info.get('player_id')
    username = sender_info.get('username', 'Unknown')

    try:
        room_doc = getRoomInfo(room_id)

        # --- Validation Checks ---
        if room_doc.get('status') != 'playing':
            print(f"[MEETING REJECT] Room {room_id} not in 'playing' state (status: {room_doc.get('status')}). Call rejected.")
            emit('meeting_call_failed', {'reason': 'Game not in progress'}, room=sid)
            return

        player_list = room_doc.get('players', [])
        caller_entry = next((p for p in player_list if p.get('id') == player_id), None)
        if not caller_entry or caller_entry.get('is_dead'):
            print(f"[MEETING REJECT] Caller {username} ({player_id}) in room {room_id} is dead or not found. Call rejected.")
            emit('meeting_call_failed', {'reason': 'Dead players cannot call meetings'}, room=sid)
            return

        cooldown_until = room_doc.get('emergency_button_cooldown_until')
        # --- Use timestamp comparison for naive/aware safety --- 
        if cooldown_until:
            now_utc = datetime.now(timezone.utc)
            # Convert both to UTC timestamps (seconds since epoch) for comparison
            if now_utc.timestamp() < cooldown_until.timestamp():
                wait_seconds = cooldown_until.timestamp() - now_utc.timestamp()
                print(f"[MEETING REJECT] Emergency button on cooldown in room {room_id}. Wait {wait_seconds:.1f}s. Call rejected.")
                emit('meeting_call_failed', {'reason': f'Button on cooldown ({wait_seconds:.1f}s left)'}, room=sid)
                return

        # --- Initiate Meeting ---
        print(f"[MEETING] Player {username} ({player_id}) initiated meeting in room {room_id}.")
        meeting_start_time = datetime.now(timezone.utc)
        update_payload = {
            '$set': {
                'status': 'meeting',
                'meeting_start_time': meeting_start_time,
                'meeting_votes': {}, # Clear previous votes
                'meeting_caller_id': player_id,
                'emergency_button_cooldown_until': None # Clear cooldown while meeting active
            }
        }
        update_result = roomDB.update_one({'_id': room_id}, update_payload)

        if update_result.matched_count == 0:
            print(f"[DB ERROR] Room {room_id} not found during meeting initiation update.")
            emit('meeting_call_failed', {'reason': 'Room not found'}, room=sid)
            return
        if update_result.modified_count == 0:
             print(f"[DB ERROR] Failed to update room {room_id} status to meeting.")
             emit('meeting_call_failed', {'reason': 'Server error starting meeting'}, room=sid)
             return

        # --- Broadcast Meeting Start ---
        updated_room_doc = getRoomInfo(room_id) # Refetch doc
        meeting_state = {
            'caller_id': player_id,
            'caller_username': username,
            'duration': MEETING_DURATION_SECONDS,
            'players': updated_room_doc.get('players', [])
        }
        emit('meeting_started', meeting_state, room=room_id)

        # --- Start Timer (Protected by Lock) ---
        with meeting_timers_lock:
            # Cancel existing timer for this room if any (shouldn't happen ideally)
            if room_id in meeting_timers:
                try:
                     meeting_timers[room_id].cancel()
                     print(f"[MEETING WARN] Cancelled existing timer for room {room_id} before starting new one.")
                except Exception as e:
                     print(f"[MEETING WARN] Error cancelling existing timer for room {room_id}: {e}")
            # Start new timer
            timer = threading.Timer(MEETING_DURATION_SECONDS, end_meeting, args=[room_id])
            meeting_timers[room_id] = timer
            timer.start()
            print(f"[MEETING] Timer started for {MEETING_DURATION_SECONDS}s in room {room_id}.")

    except KeyError:
        print(f"[MEETING ERROR] Room {room_id} not found during call_meeting.")
        emit('meeting_call_failed', {'reason': 'Room not found'}, room=sid)
    except Exception as e:
        print(f"[MEETING ERROR] Unexpected error during call_meeting for room {room_id}: {e}")
        emit('meeting_call_failed', {'reason': 'Unexpected server error'}, room=sid)
        # Attempt to revert status if update went through but something else failed?
        # Maybe revert status back to playing if it was set to meeting?
        # roomDB.update_one({'_id': room_id, 'status': 'meeting'}, {'$set': {'status': 'playing'}})

@socketio.on('player_vote')
def handle_player_vote(data):
    room_id = data.get('room_id')
    target_player_id = data.get('target_player_id')
    sid = request.sid
    sender_info = sid_map.get(sid)

    if not sender_info or sender_info.get('room_id') != room_id:
        print(f"[VOTE AUTH] Invalid vote from SID {sid} for room {room_id}.")
        return
    if not target_player_id:
        print(f"[VOTE INVALID] Missing target_player_id from SID {sid} in room {room_id}.")
        return

    voter_player_id = sender_info.get('player_id')
    voter_username = sender_info.get('username', 'Unknown')

    # --- Acquire Lock (only needed briefly for the check/timer cancel) ---
    should_end_meeting_early = False
    room_status_before_vote = None
    
    try:
        room_doc = getRoomInfo(room_id)
        room_status_before_vote = room_doc.get('status') # Store status before potential modification

        # --- Validation Checks ---
        if room_status_before_vote != 'meeting':
            print(f"[VOTE REJECT] Room {room_id} not in 'meeting' state. Vote rejected.")
            return

        player_list = room_doc.get('players', [])
        voter_entry = next((p for p in player_list if p.get('id') == voter_player_id), None)
        target_entry = next((p for p in player_list if p.get('id') == target_player_id), None)

        if not voter_entry or voter_entry.get('is_dead'):
            print(f"[VOTE REJECT] Voter {voter_username} ({voter_player_id}) in room {room_id} is dead or not found. Vote rejected.")
            return
        if not target_entry:
            print(f"[VOTE REJECT] Target player {target_player_id} not found in room {room_id}. Vote rejected.")
            return

        # --- Record Vote --- 
        vote_key = f'meeting_votes.{voter_player_id}'
        update_payload = {'$set': {vote_key: target_player_id}}
        update_result = roomDB.update_one({'_id': room_id}, update_payload)

        if update_result.matched_count == 0:
            print(f"[DB ERROR] Room {room_id} not found during vote recording.")
            return

        print(f"[VOTE] Player {voter_username} ({voter_player_id}) voted for {target_player_id} in room {room_id}.")

        # --- Refetch state AFTER vote recorded --- 
        updated_room_doc = getRoomInfo(room_id)
        current_votes = updated_room_doc.get('meeting_votes', {})
        current_players = updated_room_doc.get('players', [])
        # Remove redundant status check here - initial check is enough, end_meeting handles race conditions
        # if updated_room_doc.get('status') != 'meeting':
        #     print(f"[VOTE] Room {room_id} status changed ({updated_room_doc.get('status')}) during vote processing. Aborting further vote logic.")
        #     return

        # --- Check if all alive players have voted --- 
        alive_players_count = sum(1 for p in current_players if not p.get('is_dead'))
        votes_cast_count = len(current_votes)
        print(f"[VOTE CHECK] Room {room_id}: Votes Cast = {votes_cast_count}, Alive Players = {alive_players_count}")

        if votes_cast_count >= alive_players_count:
            print(f"[VOTE] All {alive_players_count} alive players have voted in room {room_id}. Ending meeting early.")
            should_end_meeting_early = True
        else:
            # --- Broadcast Vote Update (Send Counts) --- 
            vote_counts = {}
            for voter, voted_for in current_votes.items():
                 vote_counts[voted_for] = vote_counts.get(voted_for, 0) + 1
            emit('vote_update', {'vote_counts': vote_counts}, room=room_id)

    except KeyError:
        print(f"[VOTE ERROR] Room {room_id} not found during player_vote.")
        return # Stop processing if room gone
    except Exception as e:
        print(f"[VOTE ERROR] Unexpected error during player_vote for room {room_id}: {e}")
        return # Stop processing on other errors

    # --- Trigger early end meeting OUTSIDE the main try/except block and AFTER DB/emit ---
    if should_end_meeting_early:
        # Now, safely cancel timer and call end_meeting
        with meeting_timers_lock:
            timer = meeting_timers.pop(room_id, None)
            if timer:
                print(f"[VOTE] Cancelling timer for room {room_id} due to all votes in.")
                timer.cancel()
            else:
                print(f"[VOTE WARN] Timer for room {room_id} already removed when trying to end early.")
        # Call end_meeting directly
        end_meeting(room_id)

@socketio.on('meeting_chat')
def handle_meeting_chat(data):
    room_id = data.get('room_id')
    message = data.get('message')
    sid = request.sid
    sender_info = sid_map.get(sid)

    if not sender_info or sender_info.get('room_id') != room_id:
        print(f"[CHAT AUTH] Invalid chat from SID {sid} for room {room_id}.")
        return
    if not message or not isinstance(message, str) or len(message.strip()) == 0:
        print(f"[CHAT INVALID] Empty or invalid message from SID {sid} in room {room_id}.")
        return

    player_id = sender_info.get('player_id')
    username = sender_info.get('username', 'Unknown')
    # Limit message length server-side too
    message = message.strip()[:100] 

    try:
        room_doc = getRoomInfo(room_id)

        # --- Validation Checks ---
        if room_doc.get('status') != 'meeting':
            print(f"[CHAT REJECT] Room {room_id} not in 'meeting' state. Chat rejected.")
            return

        # Allow dead players to chat? Typically yes in Among Us.
        player_list = room_doc.get('players', [])
        sender_entry = next((p for p in player_list if p.get('id') == player_id), None)
        if not sender_entry:
            print(f"[CHAT REJECT] Sender {username} ({player_id}) not found in room {room_id}. Chat rejected.")
            return
        is_dead = sender_entry.get('is_dead', False)

        # --- Broadcast Message ---
        print(f"[CHAT] [{room_id}] <{username}{' [DEAD]' if is_dead else ''}>: {message}")
        chat_payload = {
            'sender_id': player_id,
            'sender_username': username,
            'message': message,
            'is_dead': is_dead # Send dead status so client can potentially style differently
        }
        emit('new_meeting_message', chat_payload, room=room_id)

    except KeyError:
        print(f"[CHAT ERROR] Room {room_id} not found during meeting_chat.")
    except Exception as e:
        print(f"[CHAT ERROR] Unexpected error during meeting_chat for room {room_id}: {e}")

# Add other handlers (handle_meeting_chat, handle_player_vote) here later