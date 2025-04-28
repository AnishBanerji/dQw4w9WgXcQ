const socket = io();

const playersListEl = document.getElementById("playersList");
const roomCodeEl = document.getElementById("roomCode");
const startBtn = document.getElementById("startBtn");

let isHost = false;
let roomId = null;

socket.emit("room-info-request");

socket.on("room-info", (data) => {
  roomId = data.id;
  playersListEl.innerHTML = "";

  data.players.forEach((player) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = "player";

    const playerInfo = document.createElement("div");
    playerInfo.className = "player-info";

    const img = document.createElement("img");
    img.src = player.profilePicture || "/public/img/default-avatar.png";

    const username = document.createElement("div");
    username.textContent = player.username;

    playerInfo.appendChild(img);
    playerInfo.appendChild(username);
    playerDiv.appendChild(playerInfo);

    if (player.isHost === "True") {
      isHost = player.id === socket.id;
    }

    if (isHost && player.id !== socket.id) {
      const kickBtn = document.createElement("button");
      kickBtn.className = "kick-btn";
      kickBtn.textContent = "Kick";
      kickBtn.onclick = () => {
        socket.emit("kick-player", { playerId: player.id });
      };
      playerDiv.appendChild(kickBtn);
    }

    playersListEl.appendChild(playerDiv);
  });

  roomCodeEl.textContent = `Room Code: ${roomId}`;

  if (isHost) {
    startBtn.style.display = "inline-block";
    if (data.currPlayers >= 4) {
      startBtn.disabled = false;
      startBtn.classList.remove("disabled");
    } else {
      startBtn.disabled = true;
      startBtn.classList.add("disabled");
    }
  } else {
    startBtn.style.display = "none";
  }
});

startBtn.onclick = () => {
  if (!startBtn.disabled) {
    socket.emit("start-game", { roomId });
  }
};