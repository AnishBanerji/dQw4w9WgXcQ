from flask import Flask, request, send_file, abort, jsonify, make_response
from flask_socketio import SocketIO, emit, join_room as join_socketio_room, leave_room
import datetime
from util.room import *
from util.authentication import *
from util.settings import settingsChange
import os
import eventlet
from util.serve import *

app = Flask(__name__)
socketio = SocketIO(app)

@app.before_request
def log_req():
    dt = datetime.datetime.now()
    dt=dt.strftime('%m-%d-%Y %H-%M-%S')
    ip = request.remote_addr
    method = request.method
    path = request.path
    log = f'[{dt}]: {ip} {method} {path} \n'
    print(log)
    with open('/app/logs/requests.log','a') as f:
        f.write(log)



@app.route('/',methods=['GET'])
def load_home():
    filepath = "public/html/home.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/login',methods=['GET'])
def load_login():
    filepath = "public/html/login.html"
    return send_file(filepath,mimetype="text/html")

@app.route('/register',methods=["GET"])
def load_register():
    filepath = "public/html/register.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/create-room',methods=['GET'])
def load_createRoom():
    filepath = "public/html/create_room.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/create-room', methods=['POST'])
def make_room():
    a=create_room(request)
    if a == "Not Logged In":
        return "Unauthorized",401
    return jsonify(a)

@app.route('/find-room',methods=['GET'])
def load_findRoom():
    filepath = "public/html/find_room.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/settings', methods=['GET'])
def getSettings():
    filepath = "public/html/settings.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/room/<roomId>', methods=['GET'])
def load_room(roomId):
    try:
        roomInfo = getRoomInfo(roomId)
    except KeyError:
        return "Room Not Found", 404

    filepath = "public/html/room.html"
    return send_file(filepath, mimetype='text/html')

@app.route('/api/room-info/<roomId>', methods=['GET'])
def get_room_info_api(roomId):
    try:
        roomInfo = getRoomInfo(roomId)
    except KeyError:
        return jsonify({"error": "Room not found"}), 404
    return jsonify(roomInfo)

@app.route('/public/js/<filename>', methods=['GET'])
def getPublicJS(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'public', 'js', filename)

    if os.path.exists(file_path):
        return send_file(file_path, mimetype="text/javascript")
    else:
        return "Not Found", 404

@app.route('/public/css/<filename>', methods=['GET'])
def getPublicCSS(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'public', 'css', filename)

    if os.path.exists(file_path):
        return send_file(file_path, mimetype="text/css")
    else:
        return "Not Found", 404

@app.route('/join_room', methods=['POST'])
def join_room_api():
    room_id = request.args.get('id')
    data = request.get_json()
    password = data.get('password')

    if room_id not in rooms:
        return jsonify({"message": "Room not found"}), 404

    room = rooms[room_id]

    if room.roomType == 'private' and room.passcode != password:
        return jsonify({"message": "Incorrect room password"}), 403

    return jsonify({"message": "Successfully joined room"})

@app.route('/api/users/@me', methods=['GET'])
def get_user_profile():
    auth_token = request.cookies.get('auth_token')
    if not auth_token:
        return jsonify({"message": "Not authenticated"}), 401

    auth_token_hashed = hashlib.sha256(auth_token.encode()).hexdigest()
    user = userDB.find_one({"hashed_token": auth_token_hashed})
    if user is None:
        return jsonify({"message": "Invalid token"}), 401

    return jsonify({"username": user["username"], "avatar_url": "/public/imgs/user.webp"})

@app.route('/public/img/<filename>',methods=['GET'])
def get_imgs(filename):
    mimetype = get_mimetype(filename)
    filepath = "public/img/"+filename
    return send_file(filepath,mimetype=mimetype)



app.add_url_rule('/api/users/settings', 'settingsChange', settingsChange, methods=['POST'])
app.add_url_rule('/register','register',register,methods=['POST'])
app.add_url_rule('/login','login',login,methods=['POST'])

@socketio.on('find_rooms')
def getRoomList():
    listId = find_rooms()
    ret = []
    for ids in listId:
        cur_room = getRoomInfo(ids)
        ret.append(cur_room)
    emit("rooms_list",{"rooms":ret})

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room_id')
    auth_token = request.cookies.get('auth_token')

    if not auth_token:
        emit('join_error', {'message': 'Unauthorized'})
        return

    user = find_auth(auth_token)
    if not user:
        emit('join_error', {'message': 'Unauthorized'})
        return

    if room_id not in rooms:
        emit('join_error', {'message': 'Room not found'})
        return

    room = rooms[room_id]

    for p in room.getPlayers():
        if p['username'] == user['username']:
            join_socketio_room(room_id)
            emit('room_update', {'players': room.getPlayers(), 'room_id': room_id}, room=room_id)
            return

    if room.getCurrentNumberPlayers() >= room.getMaxPlayers():
        emit('join_error', {'message': 'Room is full'})
        return

    player = Player()
    player.username = user['username']
    player.id = str(uuid.uuid4())
    player.isHost = False

    room.addNewPlayer(player)

    join_socketio_room(room_id)

    emit('room_update', {'players': room.getPlayers(), 'room_id': room_id}, room=room_id)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080)
