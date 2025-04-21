import uuid

public_lobbies={}
private_lobbies={}

class Lobby:
    def __init__(self):
        self.lobbyName = ""
        self.lobbyType = ""
        self.passcode = ""
        self.maxPlayers = 0
        self.LobbyId=''

    def setLobbyId(self,LobbyId:str):
        self.LobbyId = LobbyId

    def getLobbyId(self):
        return self.LobbyId
    
    def setLobbyName(self, lobbyName: str):
        self.lobbyName = lobbyName

    def getLobbyName(self):
        return self.lobbyName

    def setLobbyType(self, lobbyType: str):
        self.lobbyType = lobbyType

    def getLobbyType(self):
        return self.lobbyType

    def setPasscode(self, passcode: str):
        self.passcode = passcode

    def getPasscode(self):
        return self.passcode

    def setMaxPlayers(self, maxPlayers: int):
        self.maxPlayers = maxPlayers

    def getMaxPlayers(self):
        return self.maxPlayers

def create_room(request):
    lobby = Lobby()
    lobbyId = str(uuid.uuid4())
    lobbyName = request.form.get('lobby_name')
    lobbyType = request.form.get('lobby_type')
    maxPlayers = request.form.get('max_players')
    maxPlayers = int(maxPlayers)
    lobby.setLobbyId(lobbyId)
    lobby.setLobbyName(lobbyName)
    lobby.setLobbyType(lobbyType)
    lobby.setMaxPlayers(maxPlayers)
    if lobbyType == 'private':
        passcode = request.form.get('passcode')
        lobby.setPasscode(passcode)
        private_lobbies[lobbyId]=lobby
    else:
        lobby.setPasscode(None)
        public_lobbies[lobbyId]=lobby
    ret = {'lobbyId':lobbyId}

    return ret

