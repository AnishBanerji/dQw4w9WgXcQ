from util.database import userDB
from flask import request, jsonify, make_response
from util.authentication import validate_password
import bcrypt
import hashlib

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

    password_changed = False
    username_changed = False

    if password != '' and validate_password(password):
        salt = bcrypt.gensalt()
        hashedPassword = bcrypt.hashpw(password.encode(), salt)
        userDB.update_one(user_identifier, {"$set": {"password": hashedPassword.decode()}})
        password_changed = True
        
    if username != '' and username != user['username']:
        existing_user = userDB.find_one({"username": username})
        if existing_user and existing_user['_id'] != user['_id']:
            return jsonify({"message": "Username already taken"}), 400
        
        userDB.update_one(user_identifier, {"$set": {"username": username}})
        username_changed = True

    if password_changed and username_changed:
        msg_string = "Password and username changed successfully"
    elif password_changed:
        msg_string = "Password changed successfully"
    elif username_changed:
        msg_string = "Username changed successfully"
    else:
        res = make_response(jsonify({"message": "No changes needed or submitted"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 200

    res = make_response(jsonify({"message": msg_string}))
    res.headers['X-Content-Type-Options'] = "nosniff"
    return res
