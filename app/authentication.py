from util.database import userDB
from flask import request, jsonify, make_response
import bcrypt
import hashlib
import secrets

def validate_password(password: str):
    special_characters = {'!', '@', '#', '$', '%', '^', '&', '(', ')', '-', '_', '='}
    valid_characters = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&()-_=')
    if len(password) < 8:
        return False
    if not any(char.islower() for char in password):
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(char.isdigit() for char in password):
        return False
    if not any(char in special_characters for char in password):
        return False
    if not all(char in valid_characters for char in password):
        return False
    return True

def register():
    username = request.form.get('username')
    password = request.form.get('password')
    confirm_password = request.form.get("confirm_password")
    
    if userDB.find_one({"username": username}):
        return jsonify({"message": "Username already exists"}), 400
    
    if confirm_password != password:
        return jsonify({"message": "Passwords do not match"}), 400
    
    if validate_password(password) == False:
        return jsonify({"message": "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one digit, and one special character"}), 400

    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode(), salt)

    user_info = {
        "username": username,
        "password": hashed_password.decode(),
        "id": secrets.token_hex(10)
    }
    
    userDB.insert_one(user_info)
    return jsonify({"message": "User registered successfully"}), 200

def login():
    username = request.form.get('username')
    password = request.form.get('password')

    user_data = userDB.find_one({"username": username}) 

    if user_data != None:
        return jsonify({"message": "Invalid credentials"}), 400
    
    salt = user_data["password"][:29]
    hashed_password = bcrypt.hashpw(password.encode(), salt.encode())

    if hashed_password.decode() == user_data["password"]:
        auth_token = secrets.token_hex(10)
        hashed_token = hashlib.sha256(auth_token.encode()).hexdigest()
        userDB.update_one({"username": username}, {"$set": {"hash_token": hashed_token}})       
        
        res = make_response(jsonify({"message": "Login successful", "id": user_data["id"]}))
        res.set_cookie("auth_token", auth_token, max_age=3600, httponly=True)
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res
    else:
        return jsonify({"message": "Invalid password"}), 400