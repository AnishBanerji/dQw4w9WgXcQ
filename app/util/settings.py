from util.database import userDB
from flask import request, jsonify, make_response
from util.authentication import validate_password
import bcrypt
import hashlib
import re

def settingsChange():
    username = request.form.get('username')
    password = request.form.get('password')

    if "auth_token" not in request.cookies:
        return jsonify({"message": "No authentication token found"}), 401

    authToken = hashlib.sha256(request.cookies["auth_token"].encode()).hexdigest()
    user = userDB.find_one({"hashed_token": authToken})

    if user == None:
        return jsonify({"message": "Invalid authentication token"}), 404

    user_identifier = {"_id": user["_id"]}

    update_ops = {}
    msgs = []

    if username and not re.match(r'^[a-zA-Z0-9]{3,20}$', username):
        return jsonify({"message": "Username must be 3-20 alphanumeric characters"}), 400

    if password:
        if validate_password(password):
            salt = bcrypt.gensalt()
            hashedPassword = bcrypt.hashpw(password.encode(), salt)
            update_ops['password'] = hashedPassword.decode()
            msgs.append("Password changed successfully")
        else:
            return jsonify({"message": "Password does not meet requirements (8+ chars, upper, lower, digit, symbol: !@#$%^&()-_=)"}), 400

    if username and username != user.get('username'):
        existing_user = userDB.find_one({"username": username})
        if existing_user and existing_user['_id'] != user['_id']:
            return jsonify({"message": "Username already taken"}), 400
        
        update_ops['username'] = username
        msgs.append("Username changed successfully")

    if update_ops:
        try:
            userDB.update_one(user_identifier, {"$set": update_ops})
            msg_string = " and ".join(msgs)
            res = make_response(jsonify({"message": msg_string}))
            res.headers['X-Content-Type-Options'] = "nosniff"
            return res, 200
        except Exception as e:
            print(f"[ERROR] Failed to update user settings in DB: {e}")
            return jsonify({"message": "Server error updating settings"}), 500
    else:
        res = make_response(jsonify({"message": "No changes needed or submitted"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 200
