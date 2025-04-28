// Define WebSocket URL dynamically
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const websocketUrl = `${wsProtocol}://${window.location.host}/`; // Assumes WS endpoint is at root

// VC Stuff
const localAudioElement = document.createElement("audio");
localAudioElement.autoplay = true;
localAudioElement.muted = true;
document.body.appendChild(localAudioElement);

const localPeers = {};
let localStream = null;
const ws = new WebSocket(websocketUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join_voice" }));
};

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "offer") {
    if (!localPeers[data.from]) {
      const pc = createPeerConnection(data.from);
      localPeers[data.from] = pc;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", to: data.from, answer }));
    }
  } else if (data.type === "answer") {
    const pc = localPeers[data.from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  } else if (data.type === "candidate") {
    const pc = localPeers[data.from];
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } else if (data.type === "new_peer") {
    const id = data.id;
    if (id !== data.selfId) {
      const pc = createPeerConnection(id);
      localPeers[id] = pc;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", to: id, offer }));
    }
  } else if (data.type === "peer_left") {
    const id = data.id;
    if (localPeers[id]) {
      localPeers[id].close();
      delete localPeers[id];
      const elem = document.getElementById("audio-" + id);
      if (elem) elem.remove();
    }
  }
};

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection();
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send(JSON.stringify({ type: "candidate", to: peerId, candidate: e.candidate }));
    }
  };
  pc.ontrack = (e) => {
    let audioElem = document.getElementById("audio-" + peerId);
    if (!audioElem) {
      audioElem = document.createElement("audio");
      audioElem.id = "audio-" + peerId;
      audioElem.autoplay = true;
      document.body.appendChild(audioElem);
    }
    audioElem.srcObject = e.streams[0];
  };
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }
  return pc;
}

navigator.mediaDevices.getUserMedia({ audio: true })
  .then((stream) => {
    localStream = stream;
    localAudioElement.srcObject = stream;
  })
  .catch((err) => {
    console.error(err);
  });

// Text Chat Stuff
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatDisplay = document.getElementById("chat-messages");

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  try {
    const response = await fetch("/api/send_message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (response.ok) {
      const data = await response.json();
      appendChatMessage(data.username, data.message, data.timestamp);
      chatInput.value = "";
    } else {
      const err = await response.text();
      alert("Failed to send message: " + err);
    }
  } catch (err) {
    alert("Error: " + err.message);
  }
});

function appendChatMessage(username, message, timestamp) {
  const container = document.createElement("div");
  container.className = "mb-2";
  const time = new Date(timestamp).toLocaleTimeString();
  container.innerHTML = `<strong>${username}</strong> <span class="text-gray-500 text-xs">${time}</span><br>${message}`;
  chatDisplay.appendChild(container);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}