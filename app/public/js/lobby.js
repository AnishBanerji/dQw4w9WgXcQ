let isHost = false;
let lobbyCode = ""; 
let players = [];

function updateLobby() {
  const playersList = document.getElementById('players-list');
  playersList.innerHTML = '';

  players.forEach((player, index) => {
    const playerEntry = document.createElement('div');
    playerEntry.className = 'player-entry';

    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    const profilePic = document.createElement('img');
    profilePic.src = player.profilePicture || '/static/img/default_avatar.png';

    const username = document.createElement('span');
    username.textContent = player.username;

    playerInfo.appendChild(profilePic);
    playerInfo.appendChild(username);
    playerEntry.appendChild(playerInfo);

    if (isHost && index !== 0) {
      const kickButton = document.createElement('button');
      kickButton.className = 'kick-button';
      kickButton.textContent = 'Remove';
      kickButton.onclick = () => {
        removePlayer(player.id);
      };
      playerEntry.appendChild(kickButton);
    }

    playersList.appendChild(playerEntry);
  });

  const startButton = document.getElementById('start-button');
  if (isHost) {
    startButton.classList.remove('hidden');
    startButton.disabled = players.length < 4;
  } else {
    startButton.classList.add('hidden');
  }

  const lobbyCodeText = document.getElementById('lobby-code');
  lobbyCodeText.textContent = `Lobby Code: ${lobbyCode || '------'}`;
}

function removePlayer(playerId) {
  players = players.filter(player => player.id !== playerId);
  updateLobby();
}

document.getElementById('back-button').onclick = () => {
  window.location.href = '/find_lobby'; 
};

document.getElementById('start-button').onclick = () => {
  if (!document.getElementById('start-button').disabled) {
    window.location.href = '/start_game'; 
  }
};

updateLobby();