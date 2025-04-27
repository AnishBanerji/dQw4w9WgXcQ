let isHost = false;
let lobbyCode = "";
let players = [];

const socket = io();

const pathParts = window.location.pathname.split('/');
const roomId = pathParts[pathParts.length - 1];

// Emit joining request ONCE
socket.emit('join_room', { room_id: roomId });

// Handle successful join
socket.on('room_update', (data) => {
  players = data.players;
  lobbyCode = data.room_id;
  updateLobby();
});

// Handle join error
socket.on('join_error', (data) => {
  alert(data.message);
  window.location.href = '/find-room';
});

// Fetch room info once on load
async function fetchRoomInfo() {
  try {
    const response = await fetch(`/api/room-info/${roomId}`);
    if (response.ok) {
      const data = await response.json();
      players = data.players || [];
      lobbyCode = data.roomId || "";
      updateLobby();
    } else {
      console.error("Failed to fetch room info");
    }
  } catch (error) {
    console.error("Error fetching room info:", error);
  }
}

// Update lobby players
function updateLobby() {
  const playersList = document.getElementById('playersList');
  if (!playersList) return;

  playersList.innerHTML = '';

  players.forEach((player, index) => {
    const playerEntry = document.createElement('div');
    playerEntry.className = 'player-entry';

    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    const profilePic = document.createElement('img');
    profilePic.src = player.profilePicture || '/public/img/default_avatar.webp';

    const username = document.createElement('span');
    username.textContent = player.username || "Unnamed";

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

  const startButton = document.getElementById('startBtn');
  if (startButton) {
    if (isHost) {
      startButton.classList.remove('disabled');
      startButton.disabled = players.length < 4;
    } else {
      startButton.classList.add('disabled');
      startButton.disabled = true;
    }
  }

  const roomCodeText = document.getElementById('roomCode');
  if (roomCodeText) {
    roomCodeText.textContent = `Room Code: ${lobbyCode || '------'}`;
  }
}

function removePlayer(playerId) {
  players = players.filter(player => player.id !== playerId);
  updateLobby();
}

// Button event handlers
const backButton = document.getElementById('back-button');
if (backButton) {
  backButton.onclick = () => {
    window.location.href = '/find-room'; 
  };
}

const startButton = document.getElementById('startBtn');
if (startButton) {
  startButton.onclick = () => {
    if (!startButton.disabled) {
      window.location.href = '/start_game'; // (Backend for this missing)
    }
  };
}

fetchRoomInfo();
updateLobby();
