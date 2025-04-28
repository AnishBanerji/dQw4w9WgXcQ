import json
import sys
import os
import pymongo
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get MongoDB URI from environment variable
MONGO_URI = os.getenv('MONGO_URI')

if not MONGO_URI:
    raise ValueError("MongoDB connection string not found in .env file (MONGO_URI)")

client = pymongo.MongoClient(MONGO_URI)

# Select the database (replace 'your_database_name' if needed)
db = client.get_database('within_us_db') # Using a default name, adjust if necessary

# Make collections available
userDB = db.users
roomDB = db.rooms # Add room collection

# add collections below in the format
# <collection name> = db["<key>"]