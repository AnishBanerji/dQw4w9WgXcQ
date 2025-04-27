import uuid
from util.player import *
from util.authentication import *
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
        player = player.__dict__
        self.players.append(player)
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
    if auth_token != None:
        user = find_auth(auth_token) 
    else:
        return "Not Logged In"
    player = Player()
    player.id = user.get('id')
    player.name = user.get('name')
    player.isHost = True

    roomName = request.form.get('room_name')
    roomType = request.form.get('room_type')
    maxPlayers = request.form.get('max_players')
    maxPlayers = int(maxPlayers)

    room.setRoomId(roomId)
    room.setRoomName(roomName)
    room.setRoomType(roomType)
    room.setMaxPlayers(maxPlayers)
    room.addNewPlayer(player)

    if roomType == 'private':
        passcode = request.form.get('passcode')
        room.setPasscode(passcode)
    else:
        room.setPasscode(None)
    ret = {'id':roomId}
    rooms[roomId]=room
    return ret

def find_rooms():
    global rooms
    roomIds = []
    print("rooms: ",rooms)
    for j in rooms.keys():
        roomIds.append(j)
    print("RoomIds: ", roomIds)
    return roomIds

def getRoomInfo(roomId:str):
    global rooms
    room = rooms[roomId]
    return room.__dict__



