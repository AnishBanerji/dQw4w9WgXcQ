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
    with open('./logs/server.log','a') as f:
        f.write(log)