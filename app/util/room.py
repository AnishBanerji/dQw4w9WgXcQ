import uuid
from util.player import *
from util.authentication import *
from util.database import roomDB
from flask import request

class Room:
    def __init__(self):
        self.roomName = ""
        self.roomType = ""
        self.passcode = ""
        self.maxPlayers = 0
        self.roomId = ''
        self.players = []
        self.currPlayers = 0
        self.status = 'waiting'
        self.it_player_id = None
        self.player_positions = {}

    def setRoomId(self, roomId: str):
        self.roomId = roomId

    def getRoomId(self):
        return self.roomId

    def setRoomName(self, roomName: str):
        self.roomName = roomName

    def getRoomName(self):
        return self.roomName

    def setRoomType(self, roomType: str):
        self.roomType = roomType

    def getRoomType(self):
        return self.roomType

    def setPasscode(self, passcode: str):
        self.passcode = passcode

    def getPasscode(self):
        return self.passcode

    def setMaxPlayers(self, maxPlayers: int):
        self.maxPlayers = maxPlayers

    def getMaxPlayers(self):
        return self.maxPlayers

    def addNewPlayer(self, player: Player):
        self.players.append(player.__dict__)
        self.currPlayers += 1

    def getPlayers(self):
        return self.players

    def getCurrentNumberPlayers(self):
        return self.currPlayers

    def removePlayerByUsername(self, username: str):
        initial_length = len(self.players)
        self.players = [p for p in self.players if p.get('username') != username]
        players_removed = initial_length - len(self.players)
        if players_removed > 0:
            self.currPlayers -= players_removed
            # print(f"Removed {players_removed} player(s) with username {username}. Current players: {self.currPlayers}")
            return True
        else:
            # print(f"Player with username {username} not found in room {self.roomId}.")
            return False


def create_room(request):
    roomId = str(uuid.uuid4())

    auth_token = request.cookies.get('auth_token')
    if not auth_token:
        return "Not Logged In"

    user = find_auth(auth_token)
    if user is None:
        return "Invalid Token", 401

    data = request.get_json()
    if not data:
        return "Invalid Request"

    roomName = data.get('room_name')
    roomType = data.get('room_type')
    maxPlayers = data.get('max_players')

    if not roomName or not roomType or not maxPlayers:
        return "Invalid Request"

    try:
        maxPlayers = int(maxPlayers)
        if maxPlayers <= 0: raise ValueError()
    except ValueError:
        return "Invalid max players"

    host_player = {
        'username': user['username'],
        'id': user['id'],
        'isHost': True
    }

    room_doc = {
        '_id': roomId,
        'roomName': roomName,
        'roomType': roomType,
        'maxPlayers': maxPlayers,
        'passcode': None,
        'players': [host_player],
        'currPlayers': 1,
        'status': 'waiting',
        'it_player_id': None,
        'player_positions': {}
    }

    if roomType == 'private':
        passcode = data.get('passcode')
        if not passcode:
            return "Passcode required for private rooms"
        room_doc['passcode'] = passcode

    try:
        result = roomDB.insert_one(room_doc)
        print(f"[DB] Room {result.inserted_id} created.")
        return {'id': result.inserted_id}
    except Exception as e:
        print(f"Error creating room in DB: {e}")
        return "Database Error", 500


def find_rooms():
    """Finds all rooms currently in the 'waiting' state."""
    try:
        # Only find rooms where the status is 'waiting'
        cursor = roomDB.find({'status': 'waiting'}, {'_id': 1})
        room_ids = [doc['_id'] for doc in cursor]
        print(f"[find_rooms] Found waiting room IDs: {room_ids}") # Add logging
        return room_ids
    except Exception as e:
        print(f"Error finding waiting rooms in DB: {e}")
        return []


def getRoomInfo(roomId: str):
    try:
        room_doc = roomDB.find_one({'_id': roomId})
        if room_doc is None:
            raise KeyError("Room not found in DB")
        return room_doc
    except Exception as e:
        print(f"Error getting room info from DB for {roomId}: {e}")
        raise KeyError("Room not found or DB error")
