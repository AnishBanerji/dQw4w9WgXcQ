from flask import Flask, request, send_file, abort, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import datetime
from util.room import *
from util.authentication import *
import os
import eventlet

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
    with open('/app/logs/requests.log','a') as f:
        f.write(log)

#@app.before_request
#def print_full_request():
    #print("---- Incoming Request ----")
    #print(f"Method: {request.method}")
    #print(f"Path: {request.path}")
    #print(f"Full URL: {request.url}")
    #print(f"Headers:\n{request.headers}")
    #print(f"Query Params: {request.args}")
    #print(f"Body:\n{request.get_data(as_text=True)}")
    #print("--------------------------")

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
    return "Ok",200

@app.route('/find-room',methods=['GET'])
def load_findRoom():
    filepath = "public/html/find_room.html"
    return send_file(filepath,mimetype='text/html')


@app.route('/settings', methods=['GET'])
def getSettings():
    filepath = "public/html/settings.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/public/js/<filename>', methods=['GET'])
def getPublic(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'public', 'js', filename)

    if os.path.exists(file_path):
        return send_file(file_path, mimetype="text/javascript")
    else:
        return "Not Found", 404
    
@socketio.on('find_rooms')
def getRoomList():
    listId = find_rooms()
    ret = []
    for ids in listId:
        cur_room = getRoomInfo(ids)
        ret.append(cur_room)
    print("ret: ",ret)
    emit("rooms_list",{"rooms":ret})

#Make routes for backend functions

app.add_url_rule('/register','register',register,methods=['POST'])
app.add_url_rule('/login','login',login,methods=['POST'])

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080)