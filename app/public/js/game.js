import { websocketUrl } from "./utils.js";

const ws = new WebSocket(websocketUrl);

ws.onopen = () => {
  console.log("Game socket connected");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

function sendGameEvent(type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

export function reportTaskDone(taskId) {
  sendGameEvent("task_done", { taskId });
}

export function reportKill(victimId) {
  sendGameEvent("kill", { victimId });
}

export function callMeeting() {
  sendGameEvent("meeting_called");
}

export function reportBody(bodyId) {
  sendGameEvent("body_reported", { bodyId });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "T") reportTaskDone("task_123");
  else if (e.key === "K") reportKill("player_456");
  else if (e.key === "M") callMeeting();
  else if (e.key === "B") reportBody("body_789");
});