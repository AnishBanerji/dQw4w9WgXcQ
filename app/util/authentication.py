from util.database import userDB
from flask import request, jsonify, make_response
import bcrypt
import hashlib
import secrets

def find_auth(auth_token:str):
    auth_token = auth_token.encode('UTF-8')
    hash = hashlib.sha256(auth_token)
    user = userDB.find_one({"hashed_token":hash.hexdigest()})
    if user != None:
        return user
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
        "imageURL": "./public/img/default_avatar.webp",
        "id": secrets.token_hex(10)
    }
    
    userDB.insert_one(user_info)
    
    auth_token = secrets.token_hex(10)
    hashed_token = hashlib.sha256(auth_token.encode()).hexdigest()
    userDB.update_one({"username": username}, {"$set": {"hashed_token": hashed_token}})
    
    res = make_response(jsonify({"message": "User registered and logged in successfully"}))
    res.set_cookie(
        "auth_token",
        auth_token,
        max_age=3600,
        httponly=True,
        secure=True,
        samesite='Lax'
    )
    
    res.headers['X-Content-Type-Options'] = "nosniff"
    return res, 200

def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    # print(f"[DEBUG] Login attempt for user: {username}") # Debug

    user_data = userDB.find_one({"username": username})

    if user_data == None:
        # print(f"[DEBUG] Login failed: User '{username}' not found.") # Debug
        res = make_response(jsonify({"message": "Invalid credentials"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400

    # Use bcrypt.checkpw for comparison
    stored_hashed_password_str = user_data.get("password") # Get stored hash string
    if not stored_hashed_password_str:
        # print(f"[DEBUG] Login failed: No password stored for user '{username}'.") # Debug
        res = make_response(jsonify({"message": "Server error: User record incomplete"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 500 # Internal server error
        
    stored_hashed_password_bytes = stored_hashed_password_str.encode('utf-8') # Encode stored hash to bytes
    provided_password_bytes = password.encode('utf-8') # Encode provided password to bytes

    # print(f"[DEBUG] Stored hash (str) for {username}: {stored_hashed_password_str}") # Debug
    # print(f"[DEBUG] Provided password (str): {password}") # Debug

    try:
        passwords_match = bcrypt.checkpw(provided_password_bytes, stored_hashed_password_bytes)
    except Exception as e:
        # print(f"[DEBUG] bcrypt.checkpw error for user '{username}': {e}") # Debug bcrypt errors
        res = make_response(jsonify({"message": "Server error during authentication"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 500
        
    if passwords_match:
        # print(f"[DEBUG] Password match successful for user: {username}") # Debug
        # Passwords match - proceed with token generation and login
        auth_token = secrets.token_hex(10)
        hashed_token = hashlib.sha256(auth_token.encode()).hexdigest()
        userDB.update_one({"username": username}, {"$set": {"hashed_token": hashed_token}})

        res = make_response(jsonify({"message": "Login successful"}))
        res.set_cookie(
            "auth_token",
            auth_token,
            max_age=3600,
            httponly=True,
            secure=True, # Should be True in production with HTTPS
            samesite='Lax'
        )
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res
    else:
        # print(f"[DEBUG] Password mismatch for user: {username}") # Debug
        # Passwords do not match
        res = make_response(jsonify({"message": "Invalid credentials"})) # Changed message for security
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400

def logout():
    auth_token = request.cookies.get('auth_token')
    if auth_token == None:
        res = make_response(jsonify({"message": "You are not logged in"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 400

    user = find_auth(auth_token)
    if user == None:
        res = make_response(jsonify({"message": "Invalid credentials"}))
        res.headers['X-Content-Type-Options'] = "nosniff"
        return res, 404

    userDB.update_one({"hashed_token": user["hashed_token"]}, {"$unset": {"hashed_token": ""}})
    res = make_response(jsonify({"message": "Logout successful"}))
    res.set_cookie("auth_token", "", expires=0)
    res.headers['X-Content-Type-Options'] = "nosniff"
    return res, 200