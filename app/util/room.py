import uuid
from player import *
rooms={}

class Room:
    def __init__(self):
        self.roomName = ""
        self.roomType = ""
        self.passcode = ""
        self.maxPlayers = 0
        self.roomId=''
        self.players=[]
        self.currPlayers=0
        self.host=None

    def setRoomId(self,roomId:str):
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
    
    def addNewPlayer(self, player:Player):
        self.players.append(player)
        self.currPlayers += 1
    
    def getPlayers(self):
        return self.players
    
    def getCurrentNumberPlayers(self):
        return self.currPlayers
    
    def getHost(self):
        return self.host
    
    def setHost(self, player:Player):
        self.host = player

def create_room(request):
    room = Room()
    roomId = str(uuid.uuid4())

    auth_token = request.headers.get('auth_token')
    user = find_auth(auth_token) #Assuming find_auth is a helper method which returns the user from the database who has the specified auth_token
    player = Player()
    player.id = user.get('id')
    player.name = user.get('name')

    roomName = request.form.get('room_name')
    roomType = request.form.get('room_type')
    maxPlayers = request.form.get('max_players')
    maxPlayers = int(maxPlayers)

    room.setRoomId(roomId)
    room.setRoomName(roomName)
    room.setRoomType(roomType)
    room.setMaxPlayers(maxPlayers)
    room.addNewPlayer(player)
    room.setHost(player)

    if roomType == 'private':
        passcode = request.form.get('passcode')
        room.setPasscode(passcode)
    else:
        room.setPasscode(None)
    rooms[roomId]=room
    ret = {'roomId':roomId}

    return ret

def find_rooms():
    roomIds = []
    for j in rooms.keys():
        roomIds.append(j)
    ret = {'allLobbies':roomIds}
    return ret

def getRoomInfo(roomId:str):
    room = rooms[roomId]
    return room.__dict__



