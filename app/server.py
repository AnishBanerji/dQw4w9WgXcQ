from flask import Flask, request, send_file, abort, jsonify
import datetime
from util.room import *

app = Flask(__name__)

@app.before_request
def log_req():
    dt = datetime.datetime.now()
    dt=dt.strftime('%m-%d-%Y %H-%M-%S')
    ip = request.remote_addr
    method = request.method
    path = request.path
    log = f'[{dt}]: {ip} {method} {path} \n'
    with open('./logs/requests.log','a') as f:
        f.write(log)

@app.before_request
def print_full_request():
    print("---- Incoming Request ----")
    print(f"Method: {request.method}")
    print(f"Path: {request.path}")
    print(f"Full URL: {request.url}")
    print(f"Headers:\n{request.headers}")
    print(f"Query Params: {request.args}")
    print(f"Body:\n{request.get_data(as_text=True)}")
    print("--------------------------")

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
    return jsonify(a),200

@app.route('/all_rooms',methods=['GET'])
def get_all_rooms():
    a = find_rooms()
    return jsonify(a),200

@app.route('/find-room',methods=['GET'])
def load_findRoom():
    filepath = "public/html/find_room.html"
    return send_file(filepath,mimetype='text/html')

@app.route('/room-info',methods=['GET'])
def getRoomInfo():
    roomId = request.args.get('roomId')
    a = getRoomInfo(roomId)
    return jsonify(a),200


if __name__ == "__main__":
    app.run()