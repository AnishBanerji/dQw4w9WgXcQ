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
    user = userDB.find_one({"hash_token": authToken})

    if user == None:
        return jsonify({"message": "Invalid authentication token"}), 404

    if password != '' and validate_password(password):
        salt = bcrypt.gensalt()
        hashedPassword = bcrypt.hashpw(password.encode(), salt)
        userDB.update_one({"hash_token": authToken}, {"$set": {"password": hashedPassword.decode()}})

        msg_string = "Password changed successfully"
        
        if username != '':
            userDB.update_one({"hash_token": authToken}, {"$set": {"username": username}})
            msg_string += " and username changed successfully"

        res = make_response(jsonify({"message": msg_string}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res

    elif username != '':
        userDB.update_one({"hash_token": authToken}, {"$set": {"username": username}})
        res = make_response(jsonify({"message": "Username changed successfully"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res
    
    else:
        res = make_response(jsonify({"message": "No changes made"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400
