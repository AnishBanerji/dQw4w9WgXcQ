import uuid
from util.player import *
from util.authentication import *

rooms = {}

class Room:
    def __init__(self):
        self.roomName = ""
        self.roomType = ""
        self.passcode = ""
        self.maxPlayers = 0
        self.roomId = ''
        self.players = []
        self.currPlayers = 0

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


def create_room(request):
    global rooms

    room = Room()
    roomId = str(uuid.uuid4())

    auth_token = request.cookies.get('auth_token')
    if not auth_token:
        return "Not Logged In"

    user = find_auth(auth_token)

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
    except ValueError:
        return "Invalid max players"

    # Set room details
    room.setRoomId(roomId)
    room.setRoomName(roomName)
    room.setRoomType(roomType)
    room.setMaxPlayers(maxPlayers)

    if roomType == 'private':
        passcode = data.get('passcode')
        if not passcode:
            return "Passcode required for private rooms"
        room.setPasscode(passcode)
    else:
        room.setPasscode(None)

    # Add host player
    player = Player()
    player.username = user['username']
    player.id = user['id']
    player.isHost = True

    room.addNewPlayer(player)

    rooms[roomId] = room
    return {'id': roomId}


def find_rooms():
    global rooms
    return list(rooms.keys())


def getRoomInfo(roomId: str):
    global rooms
    room = rooms.get(roomId)
    if room is None:
        raise KeyError("Room not found")
    return room.__dict__
