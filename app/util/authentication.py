from util.database import userDB
from flask import request, jsonify, make_response
import bcrypt
import hashlib
import secrets

def find_auth(auth_token): #find_auth is a helper method which returns the user from the database who has the specified auth_token
    user_data = userDB.find_one({"hashed_token": auth_token})
    if user_data != None:
        return user_data["username"]
    else:
        return None

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
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    
    if userDB.find_one({"username": username}):
        res = make_response(jsonify({"message": "Username already exists"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400
    
    
    if validate_password(password) == False:
        res = make_response(jsonify({"message": "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one digit, and one special character"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400

    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode(), salt)

    user_info = {
        "username": username,
        "password": hashed_password.decode(),
        "id": secrets.token_hex(10)
    }
    
    userDB.insert_one(user_info)
    res = make_response(jsonify({"message": "User registered successfully"}))
    res.headers['X-Content-Type-Options'] = "nosniff"
    return res, 200

def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user_data = userDB.find_one({"username": username}) 

    if user_data == None:
        res = make_response(jsonify({"message": "Invalid credentials"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400
    
    salt = user_data["password"][:29]
    hashed_password = bcrypt.hashpw(password.encode(), salt.encode())

    if hashed_password.decode() == user_data["password"]:
        auth_token = secrets.token_hex(10)
        hashed_token = hashlib.sha256(auth_token.encode()).hexdigest()
        userDB.update_one({"username": username}, {"$set": {"hashed_token": hashed_token}})       
        
        res = make_response(jsonify({"message": "Login successful"}))
        res.set_cookie("auth_token", auth_token, max_age=3600, httponly=True)
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res
    else:
        res = make_response(jsonify({"message": "Invalid password"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400