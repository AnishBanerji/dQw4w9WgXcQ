from flask import Flask, request, send_file, abort
import datetime

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

if __name__ == "__main__":
    app.run()