// TODO: For deployment, conditionally use 'wss://' + window.location.host based on 'https://' protocol
// Example: const socketUrl = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
// const socket = io(socketUrl);
const socketUrl = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
const socket = io(socketUrl, { transports: ['websocket'] }); // Explicitly use WebSocket transport

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Dynamically Create UI Elements ---
function createUI() {
    // --- Back Button --- 
    const backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.innerText = 'Back';
    backBtn.classList.add(
        'overlay-element', 'absolute', 'top-4', 'left-4', 'z-50', // Positioning
        'px-4', 'py-2', 'bg-gray-700/80', 'hover:bg-gray-600/90', // Styling
        'text-white', 'font-semibold', 'rounded-md', 'backdrop-blur-sm'
    );
    backBtn.onclick = () => { window.location.href = '/'; };
    backBtn.style.display = 'none'; // Hidden initially
    document.body.appendChild(backBtn);

    // --- Room Code Display ---
    const roomCodeDiv = document.createElement('div');
    roomCodeDiv.id = 'room-code-display';
    roomCodeDiv.classList.add(
        'overlay-element', 'absolute', 'top-4', 'left-1/2', '-translate-x-1/2', 'z-50', // Positioning
        'px-4', 'py-2', 'bg-gray-800/70', 'rounded-md', 'backdrop-blur-sm', // Styling
        'text-white', 'font-mono', 'text-sm'
    );
    roomCodeDiv.innerText = 'Room Code: Loading...';
    roomCodeDiv.style.display = 'none'; // Hidden initially
    document.body.appendChild(roomCodeDiv);

    // --- Task Progress Indicator (Top Right) ---
    const taskProgressDiv = document.createElement('div');
    taskProgressDiv.id = 'task-progress';
    taskProgressDiv.classList.add(
        'overlay-element', 'absolute', 'top-4', 'right-4', 'z-50', // Positioning
        'px-4', 'py-2', 'bg-gray-800/70', 'rounded-md', 'backdrop-blur-sm', // Styling
        'text-white', 'font-semibold'
    );
    taskProgressDiv.style.display = 'none'; // Hidden initially
    taskProgressDiv.innerText = 'Tasks: 0/0';
    document.body.appendChild(taskProgressDiv);

    // --- Killer Info Area (Bottom Left) ---
    const killerInfoDiv = document.createElement('div');
    killerInfoDiv.id = 'killer-info';
    killerInfoDiv.classList.add(
        'overlay-element', 'absolute', 'bottom-4', 'left-4', 'z-50', // Positioning
        'px-4', 'py-2', 'bg-red-800/80', 'rounded-md', 'backdrop-blur-sm', // Styling
        'text-white', 'font-bold', 'text-lg'
    );
    killerInfoDiv.style.display = 'none'; // Controlled dynamically
    killerInfoDiv.innerText = 'YOU ARE THE KILLER';
    document.body.appendChild(killerInfoDiv);

    // --- Waiting Room Container (Centered Overlay) ---
    const waitingRoomDiv = document.createElement('div');
    waitingRoomDiv.id = 'waiting-room';
    waitingRoomDiv.classList.add(
        'overlay-element', 
        'absolute', 'top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2', 
        'bg-gray-900/80', 'backdrop-blur-md', 
        'p-8', 'rounded-lg', 'shadow-xl', 
        'text-white', 'text-center', 
        'flex', 'flex-col', 'items-center', 'gap-4', 
        'min-w-[300px]', 'z-40' // Ensure it's above canvas but below top overlays
    );
    waitingRoomDiv.style.display = 'none'; 
    document.body.appendChild(waitingRoomDiv); // Add to body

    // (Status Message, Player List, Instructions, Start Button, Game Over Controls are added INSIDE waitingRoomDiv)
    const statusMessage = document.createElement('p');
    statusMessage.id = 'status-message';
    statusMessage.innerText = 'Connecting...'; 
    statusMessage.classList.add('text-xl', 'font-semibold'); 
    waitingRoomDiv.appendChild(statusMessage);

    const playerList = document.createElement('ul');
    playerList.id = 'player-list';
    playerList.classList.add('list-none', 'p-0', 'm-0', 'max-h-40', 'overflow-y-auto', 'w-full', 'text-left', 'mb-4'); 
    waitingRoomDiv.appendChild(playerList);

    const instructionsDiv = document.createElement('div');
    instructionsDiv.id = 'game-instructions';
    instructionsDiv.classList.add('text-sm', 'text-gray-300', 'mt-4', 'text-left'); // Added text-left
    instructionsDiv.innerHTML = `
        <h4 class="font-bold mb-2 text-lg text-center">How to Play:</h4>
        <div class="space-y-3">
            <div>
                <h5 class="font-semibold text-base mb-1">Goal</h5>
                <ul class="list-disc list-inside space-y-1 text-gray-400">
                    <li><strong class="text-cyan-400 font-medium">Crewmates:</strong> Complete all tasks (minigames at highlighted locations) OR find the Killer.</li>
                    <li><strong class="text-red-500 font-medium">Killer:</strong> Eliminate Crewmates until your numbers are equal. Use your abilities wisely.</li>
                </ul>
            </div>
            <div>
                <h5 class="font-semibold text-base mb-1">Gameplay</h5>
                 <ul class="list-disc list-inside space-y-1 text-gray-400">
                    <li><strong>Tasks:</strong> Crewmates find locations marked for tasks. Interact (<kbd>Space</kbd>) to start a minigame. The team wins if the task bar fills.</li>
                    <li><strong>Meetings:</strong> Called when a body is discovered or someone uses the Emergency Button (Interact with <kbd>Space</kbd>).</li>
                    <li><strong>Voting:</strong> Discuss in chat, then click a player to vote. Most votes = ejected!</li>
                    <li><strong>Killer Actions:</strong> Kill (<kbd>Space</kbd> near Crew - has cooldown).</li>
                    <li><strong>Elimination:</strong> Eliminated players spectate the rest of the game.</li>
                </ul>
            </div>
            <div>
                <h5 class="font-semibold text-base mb-1">Controls</h5>
                 <ul class="list-disc list-inside space-y-1 text-gray-400">
                     <li><kbd>WASD</kbd>: Move</li>
                     <li><kbd>Space</kbd>: Interact / Kill (Killer) / Use Emergency Button</li>
                     <!-- Specific Sabotage/Vent keys would go here if added -->
                 </ul>
            </div>
        </div>
    `; 
    waitingRoomDiv.appendChild(instructionsDiv);

    const startGameBtn = document.createElement('button');
    startGameBtn.id = 'start-game-btn';
    startGameBtn.innerText = 'Start Game'; 
    startGameBtn.classList.add(
        'px-6', 'py-2', 'bg-blue-600', 'hover:bg-blue-700', 
        'text-white', 'font-bold', 'rounded-md', 'cursor-pointer', 
        'transition-colors', 'duration-200', 'disabled:opacity-50', 'disabled:cursor-not-allowed'
    );
    startGameBtn.style.display = 'none'; 
    startGameBtn.onclick = () => {
        const roomId = getRoomIdFromUrl();
        socket.emit('start_game', { room_id: roomId });
    };
    waitingRoomDiv.appendChild(startGameBtn);

    const gameOverControlsDiv = document.createElement('div');
    gameOverControlsDiv.id = 'game-over-controls';
    gameOverControlsDiv.classList.add('mt-4'); // Add margin top
    gameOverControlsDiv.style.display = 'none'; 
    waitingRoomDiv.appendChild(gameOverControlsDiv);

    const backHomeBtn = document.createElement('button');
    backHomeBtn.innerText = 'Back to Home'; 
    backHomeBtn.classList.add('px-4', 'py-2', 'bg-gray-600', 'hover:bg-gray-500', 'text-white', 'rounded-md'); // Style it
    backHomeBtn.onclick = () => { window.location.href = '/'; };
    gameOverControlsDiv.appendChild(backHomeBtn);

    // --- You Died Popup (Centered Overlay) ---
    const youDiedDiv = document.createElement('div');
    youDiedDiv.id = 'you-died-popup';
    youDiedDiv.classList.add(
        'overlay-element', 'absolute', 'top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2', 'z-50', // Positioning
        'px-6', 'py-4', 'bg-black/80', 'rounded-lg', 'backdrop-blur-sm', // Styling
        'text-red-500', 'text-4xl', 'font-bold', 'text-center'
    );
    youDiedDiv.style.display = 'none'; 
    youDiedDiv.innerHTML = 'YOU DIED<br><span class="text-lg text-gray-300 font-normal">Spectating...</span>'; 
    document.body.appendChild(youDiedDiv);

    // --- ADDED: Meeting Room UI Container (Similar to Waiting Room) ---
    const meetingRoomDiv = document.createElement('div');
    meetingRoomDiv.id = 'meeting-room';
    meetingRoomDiv.classList.add(
        'overlay-element',
        'absolute', 'top-1/2', 'left-1/2', '-translate-x-1/2', '-translate-y-1/2',
        'bg-black/80', 'backdrop-blur-lg',
        'p-6', 'rounded-lg', 'shadow-2xl',
        'text-white', 'text-left',
        'flex', 'flex-col', 'items-center', 'gap-4',
        'w-[90%]', 'max-w-[600px]', 'z-50' // High z-index
    );
    meetingRoomDiv.style.display = 'none'; // Hidden initially
    document.body.appendChild(meetingRoomDiv);

    // Elements INSIDE Meeting Room Div
    const meetingTitle = document.createElement('h3');
    meetingTitle.id = 'meeting-title';
    meetingTitle.classList.add('text-2xl', 'font-bold', 'mb-2');
    meetingTitle.innerText = 'Emergency Meeting';
    meetingRoomDiv.appendChild(meetingTitle);

    const meetingTimerDisplay = document.createElement('p');
    meetingTimerDisplay.id = 'meeting-timer';
    meetingTimerDisplay.classList.add('text-lg', 'font-mono', 'mb-4');
    meetingTimerDisplay.innerText = 'Time remaining: 30s';
    meetingRoomDiv.appendChild(meetingTimerDisplay);

    const meetingContentWrapper = document.createElement('div');
    meetingContentWrapper.classList.add('flex', 'flex-row', 'gap-4', 'w-full');
    meetingRoomDiv.appendChild(meetingContentWrapper);

    // Left side: Player list for voting
    const meetingPlayersDiv = document.createElement('div');
    meetingPlayersDiv.id = 'meeting-players';
    meetingPlayersDiv.classList.add('flex-1', 'bg-gray-800/50', 'p-3', 'rounded', 'max-h-[300px]', 'overflow-y-auto');
    meetingContentWrapper.appendChild(meetingPlayersDiv);

    const meetingPlayersTitle = document.createElement('h4');
    meetingPlayersTitle.classList.add('text-md', 'font-semibold', 'mb-2', 'border-b', 'border-gray-600', 'pb-1');
    meetingPlayersTitle.innerText = 'Players (Vote)';
    meetingPlayersDiv.appendChild(meetingPlayersTitle);

    const meetingPlayerListUl = document.createElement('ul');
    meetingPlayerListUl.id = 'meeting-player-list';
    meetingPlayerListUl.classList.add('list-none', 'p-0', 'm-0', 'space-y-1');
    meetingPlayersDiv.appendChild(meetingPlayerListUl);
    // Player list items will be added dynamically

    // Right side: Chat
    const meetingChatDiv = document.createElement('div');
    meetingChatDiv.id = 'meeting-chat';
    meetingChatDiv.classList.add('flex-1', 'flex', 'flex-col', 'bg-gray-800/50', 'p-3', 'rounded', 'max-h-[300px]');
    meetingContentWrapper.appendChild(meetingChatDiv);

    const meetingChatTitle = document.createElement('h4');
    meetingChatTitle.classList.add('text-md', 'font-semibold', 'mb-2', 'border-b', 'border-gray-600', 'pb-1');
    meetingChatTitle.innerText = 'Chat';
    meetingChatDiv.appendChild(meetingChatTitle);

    const meetingChatMessages = document.createElement('div');
    meetingChatMessages.id = 'meeting-chat-messages';
    meetingChatMessages.classList.add('flex-grow', 'overflow-y-auto', 'mb-2', 'text-sm', 'space-y-1');
    meetingChatDiv.appendChild(meetingChatMessages);
    // Messages will be added dynamically

    const meetingChatInput = document.createElement('input');
    meetingChatInput.id = 'meeting-chat-input';
    meetingChatInput.type = 'text';
    meetingChatInput.placeholder = 'Type message...';
    meetingChatInput.classList.add('w-full', 'p-2', 'bg-gray-700', 'border', 'border-gray-600', 'rounded', 'text-white', 'text-sm');
    meetingChatInput.maxLength = 100; // Limit message length
    // --- ADDED: Handle Enter key for chat --- 
    meetingChatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && meetingChatInput.value.trim()) {
            sendMeetingChat(meetingChatInput.value.trim());
            meetingChatInput.value = ''; // Clear input
            event.preventDefault(); // Prevent form submission/newline
        }
    });
    meetingChatDiv.appendChild(meetingChatInput);

    // TODO: Add send button or handle Enter key for chat -> DONE (Enter key)
    // TODO: Add vote confirmation / skip vote button?
}

// --- Assets ---
const images = {};
function loadImage(name, src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        images[name] = img;
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}


// --- Game State ---
let players = {}; // Store player data { player_id: { x, y, username, id, angle, is_dead } }
let myPlayerId = null;
// let itPlayerId = null; // Removed - Use isKiller instead
const playerSpeed = 5;
const keysPressed = {};
let assetsLoaded = false;
let roomStatus = 'loading'; // loading, waiting, playing, game_over
let allPlayersList = []; // Full list from server { id, username, isHost, is_dead }
let isHost = false;
let isKiller = false;
let amIDead = false; // Added: Tracks if the local player is dead
// --- ADDED: Task State --- 
let tasks = []; // Array of task objects { id, x, y, completed }
let completedTasks = 0;
let totalTasks = 0;
// --- ADDED: Meeting State ---
let isInMeeting = false;
let meetingTimerId = null; // Store timer interval ID
// --- ADDED: Kill Cooldown State ---
let killReadyTimestamp = null; // Stores the Date object when kill is ready, or null
// --- ADDED: Emergency Button Cooldown State ---
let buttonCooldownEndTime = null; // Stores the Date object when button is ready, or null
// --- ADDED: Task Minigame State ---
const TASK_RADIUS_CLIENT = 40; // Same as server
const TASK_RADIUS_CLIENT_SQ = TASK_RADIUS_CLIENT * TASK_RADIUS_CLIENT;
// --- ADDED: Emergency Button State ---
const EMERGENCY_BUTTON = { id: 'emergency_button', x: 1800, y: 1800, radius: 50 }; // Example position near center spawn
const EMERGENCY_BUTTON_RADIUS_SQ = EMERGENCY_BUTTON.radius * EMERGENCY_BUTTON.radius;
const EMERGENCY_BUTTON_DRAW_SIZE = 50; // Added: Size to draw the button image
// --- ADDED: Wires Minigame State ---
let wiresCanvas = null;
let wiresCtx = null;
const WIRE_COLORS = ['red', 'blue', 'lime', 'yellow']; // Use lime for green
const WIRE_ENDPOINT_RADIUS = 15;
const WIRE_THICKNESS = 8;
let wireEndpoints = { left: [], right: [] }; // { color, x, y }
let wireConnections = {}; // { color: true/false }
let isDraggingWire = false;
let draggingWireColor = null;
let currentDragPos = { x: 0, y: 0 };
let wiresGameTaskId = null; // Store the task ID associated with the current wires game
// --- End Wires Minigame State ---

// --- ADDED: Function to cancel Wires task ---
function cancelWiresGame() {
    console.log("Wires task cancelled.");
    cleanupWiresListeners(); // Remove listeners
    const wiresOverlay = document.getElementById('task-overlay-wires');
    if (wiresOverlay) wiresOverlay.classList.add('hidden'); // Hide overlay
    isTaskActive = false; // Reset global task flag
    // Reset wires game state variables (optional, as init does this)
    wireConnections = {};
    isDraggingWire = false;
    draggingWireColor = null;
    wiresGameTaskId = null; // Clear task ID
}

// --- ADDED: Download Minigame State ---
let downloadInterval = null;
let downloadProgress = 0;
const DOWNLOAD_DURATION_MS = 5000; // 5 seconds total
const DOWNLOAD_UPDATE_INTERVAL_MS = 50; // Update every 50ms
let downloadGameTaskId = null;
// --- End Download Minigame State ---

// --- ADDED: Keypad Minigame State ---
const CORRECT_KEYCODE = "1337"; // The code to enter
let currentKeypadInput = "";
let keypadGameTaskId = null;
let keypadDisplay = null;
// --- End Keypad Minigame State ---

// --- ADDED: Pattern Minigame State ---
const PATTERN_LENGTH = 5;
const PATTERN_FLASH_DURATION_MS = 400;
const PATTERN_FLASH_INTERVAL_MS = 200;
let patternSequence = [];
let playerPatternInput = [];
let patternGameTaskId = null;
let patternButtons = [];
let patternInstructions = null;
let isDisplayingPattern = false; // Flag to prevent input during display
// --- End Pattern Minigame State ---

// --- Steering Minigame State (Reinstated) ---
let steeringCanvas = null;
let steeringCtx = null;
let steeringPlayer = { x: 50, y: 150, size: 15, speed: 2 };
let steeringTarget = { x: 500, y: 150, size: 20 };
const steeringWalls = [
    { x: 0, y: 0, width: 550, height: 20 }, { x: 0, y: 280, width: 550, height: 20 },
    { x: 0, y: 0, width: 20, height: 300 }, { x: 530, y: 0, width: 20, height: 300 },
    { x: 100, y: 20, width: 20, height: 150 }, { x: 100, y: 200, width: 300, height: 20 },
    { x: 400, y: 80, width: 20, height: 140 }, { x: 200, y: 80, width: 200, height: 20 },
];
let steeringKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let steeringGameLoopId = null;
let steeringGameTaskId = null;
let steeringActive = false;
// --- End Steering State ---

// --- Timing Download Minigame State ---
let timingDownloadLoopId = null;
let timingBar = null;
let timingTargetZone = null;
let timingBarPosition = 0;
let timingBarSpeed = 1.5;
let timingBarDirection = 1;
const TIMING_TARGET_LEFT = 40;
const TIMING_TARGET_WIDTH = 20;
let timingDownloadGameTaskId = null;
let timingDownloadActive = false;
const TIMING_BAR_WIDTH_PERCENT = 1.8; // Approx width of w-2 bar in track percentage
// --- End Timing Download State ---

// --- Global Task Active State ---
let isTaskActive = false;
// --- End Global Task Active State ---

// --- Collision Detection (Client-side) ---
// let mapCollisionCanvas = null; // No longer needed for pixel reading
// let mapCollisionCtx = null;
// const WALKABLE_MAX_THRESHOLD_CLIENT = 150; // No longer needed for pixel reading
let mapWidthClient = 0; // Still needed for bounds check
let mapHeightClient = 0;

// --- Utility Functions ---
function getRoomIdFromUrl() {
    const pathSegments = window.location.pathname.split('/');
    return pathSegments[pathSegments.length - 1]; // Assumes URL is /room/<roomId>
}

function drawPlayer(player, isLocalPlayer) {
    const characterImg = player.is_dead? images.deadCharacter: images[player.username];

    if (!characterImg || typeof player?.x !== 'number' || typeof player?.y !== 'number' || typeof player?.angle !== 'number') {
        return;
    }

    ctx.save(); // Save context state before transforming

    // Move to player's position
    ctx.translate(player.x, player.y);

    // Rotate character image based on player's angle
    ctx.rotate(player.angle - Math.PI / 2); // Adjust if image points down by default

    // Draw the character image centered at the player's position
    const drawX = -characterImg.width / 2;
    const drawY = -characterImg.height / 2;
    ctx.drawImage(characterImg, drawX, drawY);

    ctx.restore(); // Reset context state after drawing

    // --- Draw username below character ---
    ctx.fillStyle = 'black';
    ctx.font = 'bold 10px Verdana, Geneva, sans-serif';
    ctx.textAlign = 'center';

    const textY = player.y - (characterImg.height / 2) + 60; // Adjust text position
    ctx.fillText(player.username || '?', player.x, textY);
}


// --- Client-side walkability check ---
function is_walkable_client(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);

    // 1. Basic Bounds Check (using map dimensions from loaded image)
    if (px < 0 || px >= mapWidthClient || py < 0 || py >= mapHeightClient) {
        return false;
    }

    // 2. Define Walkable Rectangular Areas (must match server.py)
    const center_room = { xMin: 1350, yMin: 1350, xMax: 2255, yMax: 2255 };
    const top_hall    = { xMin: 1670, yMin: 70, xMax: 1930, yMax: 1440 };
    const top_room    = { xMin: 1510, yMin: 70,  xMax: 2100, yMax: 650 };
    const bottom_hall = { xMin: 1670, yMin: 2200, xMax: 1930, yMax: 3500 };
    const bottom_room = { xMin: 1510, yMin: 2950, xMax: 2100, yMax: 3530 };
    const left_hall   = { xMin: 70, yMin: 1670, xMax: 1440 /* Adj */, yMax: 1935 }; // Adjusted xMax based on map
    const left_room   = { xMin: 70,  yMin: 1510, xMax: 650, yMax: 2090 };
    const right_hall  = { xMin: 2170/* Adj */, yMin: 1670, xMax: 3540, yMax: 1935 }; // Adjusted xMin based on map
    const right_room  = { xMin: 2950, yMin: 1510, xMax: 3540, yMax: 2090 };

    const walkable_areas = [
        center_room, top_hall, top_room, bottom_hall, bottom_room,
        left_hall, left_room, right_hall, right_room
    ];

    // 3. Check if the point (px, py) is inside any walkable area
    for (const area of walkable_areas) {
        if (px >= area.xMin && px < area.xMax && py >= area.yMin && py < area.yMax) {
            return true; // Point is inside a walkable area
        }
    }

    // 4. If not in any walkable area, it's a wall
    return false;
}

// --- UI Update Function ---
function updateUI() {
    // console.log(`[updateUI] Called. Current roomStatus: ${roomStatus}, isHost: ${isHost}, isKiller: ${isKiller}, amIDead: ${amIDead}`); // Remove log
    // Get all potentially visible elements
    const waitingRoom = document.getElementById('waiting-room');
    const statusMessage = document.getElementById('status-message');
    const playerList = document.getElementById('player-list');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameOverControls = document.getElementById('game-over-controls');
    const killerInfo = document.getElementById('killer-info');
    const youDiedPopup = document.getElementById('you-died-popup');
    const taskProgress = document.getElementById('task-progress');
    const backBtn = document.getElementById('back-btn');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const gameInstructions = document.getElementById('game-instructions');
    // --- ADDED: Get Meeting Room elements ---
    const meetingRoom = document.getElementById('meeting-room');
    const gameCanvas = document.getElementById('gameCanvas'); // Need canvas to hide/show

    // Helper to safely set display style
    const setDisplay = (el, displayStyle) => { if (el) el.style.display = displayStyle; };

    // Hide most elements by default
    setDisplay(waitingRoom, 'none');
    setDisplay(gameOverControls, 'none');
    setDisplay(killerInfo, 'none');
    setDisplay(youDiedPopup, 'none');
    setDisplay(taskProgress, 'none');
    setDisplay(backBtn, 'none');
    setDisplay(roomCodeDisplay, 'none');
    setDisplay(meetingRoom, 'none'); // Hide meeting room by default
    setDisplay(gameCanvas, 'block'); // Show game canvas by default

    // Update player list
    if (playerList) {
        playerList.innerHTML = ''; // Clear previous list
        allPlayersList.forEach(player => {
            const li = document.createElement('li');
            li.classList.add('py-1', 'border-b', 'border-gray-700');
            let text = player.username;
            if (player.isHost) text += ' (Host)';
            if (player.id === myPlayerId) text += ' (You)';
            if (player.is_dead) text += ' [DEAD]';
            li.textContent = text;
            playerList.appendChild(li);
        });
    }

    // Show elements based on roomStatus
    if (roomStatus === 'waiting') {
        setDisplay(gameCanvas, 'none'); // Hide canvas in waiting room
        setDisplay(waitingRoom, 'flex'); // Show centered overlay
        setDisplay(gameInstructions, 'block'); // Show instructions within overlay
        const minPlayers = 2;
        const currentPlayers = allPlayersList.length;
        if (statusMessage) {
            if (currentPlayers < minPlayers) {
                statusMessage.textContent = `Waiting for more players to join... (Need at least ${minPlayers})`;
            } else {
                statusMessage.textContent = isHost ? 'Waiting for you (Host) to start the game.' : 'Waiting for the host to start the game.';
            }
        }
        if (startGameBtn) {
            startGameBtn.style.display = isHost ? 'inline-block' : 'none';
            startGameBtn.disabled = currentPlayers < minPlayers; // Disable if not enough players
        }
        loadAssetsForPlayers(allPlayersList); // Load player images
    } else if (roomStatus === 'playing') {
        setDisplay(backBtn, 'block');
        setDisplay(roomCodeDisplay, 'block');
        setDisplay(taskProgress, 'block');
        taskProgress.innerText = `Tasks: ${completedTasks}/${totalTasks}`;

        if (isKiller && !amIDead) {
            setDisplay(killerInfo, 'block');
        }
        if (amIDead) {
            setDisplay(youDiedPopup, 'flex'); // Show 'You Died' overlay
        }
        // Hide waiting room elements
        setDisplay(waitingRoom, 'none');
        setDisplay(meetingRoom, 'none'); // Ensure meeting room hidden
    } else if (roomStatus === 'game_over') {
        // Hide game elements
        setDisplay(killerInfo, 'none');
        setDisplay(youDiedPopup, 'none');
        setDisplay(taskProgress, 'none');
        setDisplay(backBtn, 'none'); 
        setDisplay(roomCodeDisplay, 'none'); 
        if(gameCanvas) gameCanvas.style.display = 'none'; // Hide the game canvas
        
        // Show centered overlay for results
        setDisplay(waitingRoom, 'flex'); 
        
        // Configure elements INSIDE the waiting room overlay
        setDisplay(gameOverControls, 'block'); 
        setDisplay(gameInstructions, 'none'); 
        setDisplay(playerList, 'none'); 
        if (startGameBtn) setDisplay(startGameBtn, 'none'); 

        if (statusMessage) {
            statusMessage.textContent = window.lastGameOverMessage || 'Game Over!'; 
            if ((window.lastGameOverMessage || '').includes('YOU WON')) {
                 statusMessage.style.color = 'lime';
            } else if ((window.lastGameOverMessage || '').includes('Crew Wins')) {
                 statusMessage.style.color = 'cyan';
            } else if ((window.lastGameOverMessage || '').includes('Killer Wins')) {
                 statusMessage.style.color = 'red'; 
            } else {
                statusMessage.style.color = 'white'; 
            }
        }
        setDisplay(meetingRoom, 'none'); 
    } else if (roomStatus === 'meeting') {
        setDisplay(gameCanvas, 'none'); // Hide game canvas
        // Hide regular game UI elements
        setDisplay(killerInfo, 'none');
        setDisplay(youDiedPopup, 'none');
        setDisplay(taskProgress, 'none');
        setDisplay(backBtn, 'none');
        setDisplay(roomCodeDisplay, 'none');
        setDisplay(waitingRoom, 'none');
        // Show meeting room UI
        setDisplay(meetingRoom, 'flex');
        // TODO: Populate meeting room player list & chat here or via socket handlers
    } else { // Loading or error
        setDisplay(gameCanvas, 'none'); // Hide canvas
        setDisplay(waitingRoom, 'flex');
        if (statusMessage) statusMessage.textContent = 'Loading room...';
        setDisplay(meetingRoom, 'none'); // Ensure meeting room hidden
    }

    // Update Room Code display text
    if (roomCodeDisplay) {
        const roomId = getRoomIdFromUrl(); // Get current room ID
        if(roomCodeDisplay) roomCodeDisplay.textContent = `Room Code: ${roomId || 'N/A'}`;
    }
}

async function loadAssetsForPlayers(allPlayersList) {
    const playerImagePromises = allPlayersList.map(async (player) => {
        const username = player.username;
        const imagePath = `/public/img/${username}_model.png`;

        try {
            await loadImage(username, imagePath);
        } catch (err) {
            console.warn(`Failed to load image for ${username}: ${err.message}. Falling back to default.`);
            try {
                await loadImage(username, '/public/img/Character.png');
            } catch (fallbackErr) {
                console.error(`Failed to load fallback image for ${username}: ${fallbackErr.message}`);
            }
        }
    });

    const staticAssets = [
        loadImage('map', '/public/img/Map.png'),
        loadImage('deadCharacter', '/public/img/Dead Character.png'),
        loadImage('task_unfinished', '/public/img/Unfinished Task.png'),
        loadImage('task_finished', '/public/img/Finished Task.png'),
        loadImage('emergency_button', '/public/img/Emergency Button.png')
    ];

    await Promise.all([...playerImagePromises, ...staticAssets]);

    const mapImg = images.map;
    if (mapImg) {
        mapWidthClient = mapImg.naturalWidth;
        mapHeightClient = mapImg.naturalHeight;
    }

    assetsLoaded = true;
}



function gameLoop() {
    // ADDED: Log status at the start of the loop
    console.log(`[gameLoop] Status check: roomStatus='${roomStatus}', assetsLoaded=${assetsLoaded}`);

    // --- PAUSE game loop if in meeting or assets not loaded ---
    // This check correctly pauses game logic but keeps the loop running via requestAnimationFrame below
    if (!assetsLoaded || (roomStatus !== 'playing' && roomStatus !== 'game_over')) { // Allow loop for game_over for potential spectating?
        // If meeting status, ensure movement keys are cleared
        if (roomStatus === 'meeting') {
            for (const key in keysPressed) {
                 keysPressed[key] = false;
            }
        }
        // Still request next frame to keep checking status, but don't run game logic
        requestAnimationFrame(gameLoop);
        return;
    }

    // --- Get Current Player --- 
    const currentPlayer = players[myPlayerId];
    let dx = 0, dy = 0;

    // --- Process Input (Only if ALIVE) ---
    if (currentPlayer && !amIDead && !isTaskActive) { // <<< ADDED !isTaskActive check
        if (keysPressed['ArrowUp'] || keysPressed['KeyW']) dy -= playerSpeed;
        if (keysPressed['ArrowDown'] || keysPressed['KeyS']) dy += playerSpeed;
        if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) dx -= playerSpeed;
        if (keysPressed['ArrowRight'] || keysPressed['KeyD']) dx += playerSpeed;

        // --- Normalize Diagonal Movement ---
        if (dx !== 0 && dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            // Check if magnitude is zero before dividing
            if (magnitude > 0) {
                 // Re-scale dx and dy based on playerSpeed and the original magnitude
                 // This ensures the total speed along the diagonal is `playerSpeed`
                 dx = (dx / magnitude) * playerSpeed;
                 dy = (dy / magnitude) * playerSpeed;
            }
        }

        // --- Calculate Angle Based on Movement ---
        let targetAngle = currentPlayer.angle; // Keep current angle if no movement
        if (dx !== 0 || dy !== 0) {
            targetAngle = Math.atan2(dy, dx);
        }

        // --- Calculate Potential New Position ---
        const potentialX = currentPlayer.x + dx;
        const potentialY = currentPlayer.y + dy;

        // --- Client-Side Collision Check ---
        let moveAllowed = is_walkable_client(potentialX, potentialY);

        // --- Send Movement Update if Changed and Allowed ---
        if (moveAllowed && (dx !== 0 || dy !== 0 || targetAngle !== currentPlayer.angle)) {
            // Update local state immediately for responsiveness
            currentPlayer.x = potentialX;
            currentPlayer.y = potentialY;
            currentPlayer.angle = targetAngle;

            // Send update to server
            const roomId = getRoomIdFromUrl();
            socket.emit('player_move', {
                room_id: roomId,
                player_id: myPlayerId,
                position: { x: currentPlayer.x, y: currentPlayer.y },
                angle: currentPlayer.angle
            });
        } else if (!moveAllowed && targetAngle !== currentPlayer.angle) {
             // Allow angle change even if move blocked
             currentPlayer.angle = targetAngle;
             const roomId = getRoomIdFromUrl();
             socket.emit('player_move', {
                room_id: roomId,
                player_id: myPlayerId,
                position: { x: currentPlayer.x, y: currentPlayer.y }, // Send old pos
                angle: currentPlayer.angle
             });
        }
    }

    // --- Drawing --- 
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Calculate Camera Position (Center on Player IF ALIVE) ---
    let cameraX = 0, cameraY = 0;
    if (currentPlayer && !amIDead) {
        cameraX = canvas.width / 2 - currentPlayer.x;
        cameraY = canvas.height / 2 - currentPlayer.y;
    } else {
        // If dead or no player data, center on map origin or last known position?
        // For now, keep camera static (potentially showing origin 0,0)
        // Or, let's try centering on map center if map loaded
        if (images.map) {
             cameraX = canvas.width / 2 - mapWidthClient / 2;
             cameraY = canvas.height / 2 - mapHeightClient / 2;
        } else {
             cameraX = canvas.width / 2; // Fallback
             cameraY = canvas.height / 2;
        }
        // TODO: Could implement spectating specific players later
    }

    ctx.save();
    ctx.translate(cameraX, cameraY); // Apply camera offset

    // Draw map
    if (images.map) {
        ctx.drawImage(images.map, 0, 0);
    } else {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(0, 0, 2000, 2000); // Draw fallback background
    }

    // --- ADDED: Draw Tasks --- 
    if (roomStatus === 'playing') {
        tasks.forEach(task => {
            // Choose the correct image based on completion status
            const taskImage = task.completed ? images.task_finished : images.task_unfinished;

            if (taskImage) {
                // Calculate draw position to center the image
                const drawX = task.x - taskImage.width / 2;
                const drawY = task.y - taskImage.height / 2;
                ctx.drawImage(taskImage, drawX, drawY);
            } else {
                // Fallback drawing if images failed to load
                ctx.beginPath();
                ctx.arc(task.x, task.y, 15, 0, Math.PI * 2); 
                ctx.fillStyle = task.completed ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 255, 0, 0.5)';
                ctx.fill();
                ctx.strokeStyle = task.completed ? 'lime' : 'yellow';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        // --- Draw Emergency Button --- 
        const now = Date.now();
        const cooldownActive = buttonCooldownEndTime && now < buttonCooldownEndTime.getTime();
        let remainingCooldownSeconds = 0;
        if (cooldownActive) {
             remainingCooldownSeconds = Math.ceil((buttonCooldownEndTime.getTime() - now) / 1000);
        }

        if (images.emergency_button) {
            const btnImg = images.emergency_button;
            const btnDrawX = EMERGENCY_BUTTON.x - EMERGENCY_BUTTON_DRAW_SIZE / 2;
            const btnDrawY = EMERGENCY_BUTTON.y - EMERGENCY_BUTTON_DRAW_SIZE / 2;
            
            ctx.save(); // Save context for applying opacity/overlay
            if (cooldownActive) {
                 ctx.globalAlpha = 0.5; // Make button semi-transparent during cooldown
            }
            ctx.drawImage(btnImg, btnDrawX, btnDrawY, EMERGENCY_BUTTON_DRAW_SIZE, EMERGENCY_BUTTON_DRAW_SIZE); // Draw scaled
            ctx.restore(); // Restore full opacity

            // Draw cooldown text overlay if active
            if (cooldownActive) {
                 ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark overlay box
                 ctx.fillRect(btnDrawX, btnDrawY, EMERGENCY_BUTTON_DRAW_SIZE, EMERGENCY_BUTTON_DRAW_SIZE);
                 ctx.fillStyle = 'white';
                 ctx.font = 'bold 14px sans-serif';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(`${remainingCooldownSeconds}s`, EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y);
            }
        } else {
             // Fallback drawing 
             // ... (fallback circle drawing, maybe add cooldown text here too?) ...
        }
    }
    // --- End Draw Tasks & Button --- 

    // Draw all players
    for (const playerId in players) {
        if (players.hasOwnProperty(playerId)) {
            drawPlayer(players[playerId], playerId === myPlayerId);
        }
    }

    ctx.restore(); // Remove camera offset

    // --- ADDED: Update Killer Cooldown UI --- 
    const killerInfoDiv = document.getElementById('killer-info');
    if (isKiller && !amIDead && killerInfoDiv) {
        if (killReadyTimestamp) {
            const now = Date.now();
            const remainingSeconds = Math.max(0, (killReadyTimestamp.getTime() - now) / 1000);
            if (remainingSeconds > 0) {
                killerInfoDiv.innerText = `KILL (CD: ${remainingSeconds.toFixed(1)}s)`;
                killerInfoDiv.style.backgroundColor = 'rgba(150, 0, 0, 0.8)'; // Darker red for cooldown
            } else {
                killerInfoDiv.innerText = 'KILL READY';
                killerInfoDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.8)'; // Brighter red for ready
            }
        } else {
            // Default state if timestamp not yet received (should be brief)
            killerInfoDiv.innerText = 'YOU ARE KILLER'; 
            killerInfoDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
        }
        killerInfoDiv.style.display = 'block'; // Ensure visible
    } else if (killerInfoDiv) {
        killerInfoDiv.style.display = 'none'; // Hide if not killer or dead
    }
    // --- End Killer Cooldown UI --- 

    requestAnimationFrame(gameLoop);
}

// --- Input Handlers ---
function setupInputListeners() {
    // Clear existing listeners first? (If setup might be called multiple times)
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
}

function handleKeyDown(event) {
    // Ignore input if dead OR if a task overlay is active
    if (amIDead || isTaskActive) return;

    keysPressed[event.code] = true;

    // --- Space Bar Actions (Prioritize Emergency Meeting) ---
    if (event.code === 'Space' && roomStatus === 'playing') {
        const currentPlayer = players[myPlayerId];
        if (!currentPlayer) return;

        // --- Check for Emergency Button Interaction ---
        const distToButtonSq = (currentPlayer.x - EMERGENCY_BUTTON.x)**2 + (currentPlayer.y - EMERGENCY_BUTTON.y)**2;
        // --- Check Cooldown using timestamp --- 
        const now = Date.now();
        const cooldownActive = buttonCooldownEndTime && now < buttonCooldownEndTime.getTime();
        if (distToButtonSq < EMERGENCY_BUTTON_RADIUS_SQ && !cooldownActive) {
            // console.log("Attempting to call meeting...");
            const roomId = getRoomIdFromUrl();
            socket.emit('call_meeting', { room_id: roomId });
            event.preventDefault(); // Prevent other space actions
            return; // Don't process kill or task if meeting called
        } else if (distToButtonSq < EMERGENCY_BUTTON_RADIUS_SQ && cooldownActive) {
             console.log("Tried to call meeting but button is on cooldown.");
             // Optionally show feedback to user here
             return; // Prevent other space actions if near button but on cooldown
        }

        // --- Kill Attempt (Only if Killer and NOT near button) ---
        if (isKiller) {
            // --- ADDED: Client-side cooldown check ---
            if (killReadyTimestamp && Date.now() < killReadyTimestamp.getTime()) {
                console.log("Kill on cooldown (client check).");
                // Maybe flash the button red briefly?
                return; // Don't emit if on cooldown
            }
            // --- End client-side check ---
            // console.log("Attempting kill...");
            const roomId = getRoomIdFromUrl();
            socket.emit('attempt_kill', { room_id: roomId });
            event.preventDefault();
            return; // Don't process task
        }

        // --- Task Attempt (Only if NOT Killer and NOT near button) ---
        let nearestIncompleteTaskDistSq = Infinity;
        let foundNearbyTask = false;

        tasks.forEach(task => {
            if (!task.completed) {
                const distSq = (currentPlayer.x - task.x)**2 + (currentPlayer.y - task.y)**2;
                if (distSq < TASK_RADIUS_CLIENT_SQ) {
                    nearestIncompleteTaskDistSq = distSq;
                    foundNearbyTask = true;
                    // Note: forEach doesn't have a standard way to break early like a for loop's `break`.
                    // This `return` only exits the current iteration of the callback, not the whole forEach.
                    // However, finding *any* nearby task is sufficient here.
                    return;
                }
            }
        });

        if (foundNearbyTask) {
            // console.log("Attempting task with Space bar...");
            const roomId = getRoomIdFromUrl();
            socket.emit('attempt_task', { room_id: roomId });
            event.preventDefault(); // Prevent default Space bar behavior (e.g., scrolling)
        } else {
            // console.log("Pressed Space, but no interaction target nearby (button on cooldown, task, or kill target).");
        }
    } // End Space Bar Actions
}

function handleKeyUp(event) {
    keysPressed[event.code] = false;
}

function handleBlur() {
    // Clear all pressed keys to prevent character running indefinitely
    for (const key in keysPressed) {
        keysPressed[key] = false;
    }
    // console.log("Window lost focus, keys cleared.");
}


// --- Socket IO Handlers ---
function setupSocketListeners(roomId) {
    // console.log(`Setting up Socket listeners for room: ${roomId}`);

    // Remove existing listeners before adding new ones (important for hot reloading/reconnects)
    socket.off('connect');
    socket.off('disconnect');
    socket.off('join_error');
    socket.off('current_state');
    socket.off('room_update');
    socket.off('player_left');
    socket.off('player_moved');
    socket.off('start_game_error');
    socket.off('game_started');
    socket.off('you_are_killer');
    socket.off('player_died');
    socket.off('you_died');
    socket.off('game_over');
    socket.off('task_completed'); // Add new listener removal
    // --- ADDED: Remove meeting listeners ---
    socket.off('meeting_started');
    socket.off('meeting_ended');
    socket.off('new_meeting_message');
    socket.off('vote_update');
    socket.off('meeting_call_failed');
    // --- ADDED: Kill Cooldown Listener Removal ---
    socket.off('kill_cooldown_update');

    socket.on('connect', () => {
        // console.log('Socket connected:', socket.id); // Remove log
        // Re-join room on reconnection to ensure server has the right SID map
        // console.log(`Re-emitting join_room for room ${roomId} on connect event.`); // Remove log
        socket.emit('join_room', { room_id: roomId });
        roomStatus = 'loading'; // Reset status on connect/reconnect
        isKiller = false; // Reset killer status
        isHost = false;
        updateUI();
    });

    socket.on('disconnect', (reason) => {
        // console.log('Socket disconnected:', reason); // Remove log
        roomStatus = 'loading'; // Reset status on disconnect
        updateUI(); // Update UI to show disconnected state perhaps
    });

    socket.on('connect_error', (error) => {
        // console.error('Socket connection error:', error); // Remove log
        // Optionally show an error message to the user
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) statusMessage.innerText = 'Connection Error!';
    });

    socket.on('join_error', (data) => {
        console.error('Join Error:', data.message);
        roomStatus = 'error';
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) statusMessageP.innerText = `Failed to join: ${data.message}`;
        updateUI();
    });

    // This event provides the initial state when joining or reconnecting
    socket.on('current_state', (data) => {
        // console.log('[current_state] Received:', data); // Remove log

        // --- Restore original logic --- 
        myPlayerId = data.your_id;
        roomStatus = data.status;
        players = data.players_positions || {}; // Start with position data
        allPlayersList = data.all_players_list || [];
        amIDead = false; // Reset dead status on join/rejoin

        // Merge is_dead status and username into local players object from the definitive list
        allPlayersList.forEach(playerInfo => {
            if (players[playerInfo.id]) {
                players[playerInfo.id].is_dead = playerInfo.is_dead;
                players[playerInfo.id].username = playerInfo.username; // Ensure username is up-to-date
            } else {
                 // If player from list isn't in positions (e.g., joined but server hasn't sent pos yet, or error)
                 // Create a default entry, especially important for self if missing.
                 console.warn(`[current_state] Player ${playerInfo.id} (${playerInfo.username}) in list but not in positions. Creating default entry.`);
                 players[playerInfo.id] = {
                    x: 1800, y: 1800, angle: -Math.PI/2, // Default spawn
                    username: playerInfo.username,
                    is_dead: playerInfo.is_dead,
                    id: playerInfo.id
                 };
            }
            // Update local dead status if it pertains to self
            if (playerInfo.id === myPlayerId && playerInfo.is_dead) {
                 amIDead = true;
            }
        });

        // Determine if host based on the definitive list
        const hostPlayer = allPlayersList.find(p => p.isHost);
        isHost = hostPlayer ? hostPlayer.id === myPlayerId : false;

        // Determine if killer (server now includes it_player_id in current_state)
        isKiller = (data.it_player_id === myPlayerId);

        // Task related state (keep this part)
        tasks = data.tasks || [];
        completedTasks = data.completedTasks || 0;
        totalTasks = data.totalTasks || 0;
        // --- End Restore original logic ---

        // --- ADDED: Store Cooldown Time ---
        if (data.emergency_button_cooldown_until) {
            buttonCooldownEndTime = new Date(data.emergency_button_cooldown_until);
             console.log("Received initial cooldown end time:", buttonCooldownEndTime);
        } else {
             buttonCooldownEndTime = null;
        }
        // --- End Cooldown Handling ---

        // console.log(`[current_state] Updated local state: roomStatus=${roomStatus}, isHost=${isHost}, isKiller=${isKiller}, myPlayerId=${myPlayerId}, amIDead=${amIDead}`); // Remove log

        updateUI(); // Refresh the UI based on the new state

        // If already playing when joined/reconnected (and not dead), start the game loop
        if (roomStatus === 'playing' && assetsLoaded && !amIDead) {
            // console.log("[current_state] Game is playing and assets loaded, ensuring game loop starts."); // Remove log
            // Check if loop is already running? (Optional, requestAnimationFrame handles duplicates okay)
            requestAnimationFrame(gameLoop); // Start drawing/updates
        } else if (roomStatus === 'playing' && amIDead) {
            // console.log("[current_state] Game is playing, but local player is dead. Ensuring game loop starts for spectating."); // Remove log
            requestAnimationFrame(gameLoop); // Also start loop if dead to allow spectating
        }
    });

    // This event provides incremental updates, like player list changes in the lobby
    socket.on('room_update', (data) => {
        // console.log('[room_update] Received:', data); // Remove log
        allPlayersList = data.all_players_list || [];
        roomStatus = data.status; // Update status from room_update as well
        // Determine host status based on updated list
        isHost = allPlayersList.find(p => p.id === myPlayerId)?.isHost || false;
        // console.log(`[room_update] Updated local state: roomStatus=${roomStatus}, isHost=${isHost}`); // Remove log
        updateUI(); // Refresh the UI (mainly the player list in the lobby)
    });

    socket.on('player_left', (data) => {
        // console.log('Player left:', data.player_id);
        if (players.hasOwnProperty(data.player_id)) { // Check own property
            delete players[data.player_id];
            // console.log("Removed player locally:", data.player_id);
        }
        // Player list display is updated via 'room_update' in waiting room
    });

    socket.on('player_moved', (data) => {
        // console.log(`Received player_moved event for player ${data.player_id}. My ID: ${myPlayerId}`); // REMOVED DEBUG
        const opponentExists = players.hasOwnProperty(data.player_id); // Check own property
        // console.log(`Opponent data exists locally? ${opponentExists}`); // REMOVED DEBUG

        if (data.player_id !== myPlayerId && opponentExists) { // Only update other players and ensure they exist
            // console.log(`Updating local position for ${data.player_id} to`, data.position, data.angle); // REMOVED DEBUG
            players[data.player_id].x = data.position.x;
            players[data.player_id].y = data.position.y;
            players[data.player_id].angle = data.angle; // Update angle
        } else if (data.player_id !== myPlayerId && !opponentExists) { // Log if opponent doesn't exist locally
            // console.warn(`Received player_moved for unknown player ${data.player_id}`); // Keep this warn? Or remove?
             // Let's comment it out for now to reduce noise
              // console.warn(`Received player_moved for unknown player ${data.player_id}`);
        }
    });

    socket.on('start_game_error', (data) => {
        console.error('Start Game Error:', data.message);
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) statusMessageP.innerText = `Failed to start game: ${data.message}`;
        updateUI();
    });

    socket.on('game_started', (data) => {
        // console.log('[game_started] Received:', data); // Remove log
        roomStatus = 'playing';
        players = data.players_positions || {};
        allPlayersList = data.all_players_list || [];
        
        // --- ADDED: Store Task Info --- 
        tasks = data.tasks || [];
        totalTasks = data.totalTasks || 0;
        completedTasks = data.completedTasks || 0;
        // console.log(`Tasks Initialized: ${completedTasks}/${totalTasks}`, tasks);

        // Determine if host
        const hostPlayer = allPlayersList.find(p => p.isHost);
        isHost = hostPlayer ? hostPlayer.id === myPlayerId : false;

        // console.log(`My ID: ${myPlayerId}, Host: ${isHost}, Status: ${roomStatus}`);
        // console.log("Initial players positions:", players); 

        updateUI(); // Update UI including task progress

        // Start the game loop
        if (assetsLoaded) {
            requestAnimationFrame(gameLoop); 
        }
    });

    socket.on('you_are_killer', () => {
        // console.log("You are the killer!");
        isKiller = true;
        updateUI(); // Show killer info
    });

    socket.on('player_died', (data) => {
        // console.log("Player died event received: Victim ID", data.victim_id);
        if (players[data.victim_id]) {
            players[data.victim_id].is_dead = true;
            // console.log(`Marked player ${data.victim_id} as dead locally.`);
        } else {
             console.warn(`Received player_died for unknown ID: ${data.victim_id}`);
        }
        // Update visual state in the next game loop draw
    });

    // --- ADDED: You Died Handler ---
    socket.on('you_died', () => {
        // console.log("Received 'you_died' event!");
        amIDead = true;
        const popup = document.getElementById('you-died-popup');
        if (popup) {
            popup.style.display = 'block';
        }
        // Optional: Hide killer info if they die (shouldn't happen if killer wins, but belt & braces)
        const killerInfoDiv = document.getElementById('killer-info');
        if (killerInfoDiv) killerInfoDiv.style.display = 'none'; 
        
        // Stop sending movement commands immediately (gameLoop check handles future)
        for (const key in keysPressed) {
            if (keysPressed.hasOwnProperty(key)) {
                keysPressed[key] = false;
            }
        }
        // console.log("Input disabled due to death.");
    });

    // --- ADDED: Task Completed Handler ---
    socket.on('task_completed', (data) => {
        // console.log(`Task Completed event: ID=${data.task_id}, New Count=${data.completedTasks}/${data.totalTasks}`);
        completedTasks = data.completedTasks;
        totalTasks = data.totalTasks;

        // --- ADDED: Update the specific task's status in the local array ---
        const completedTask = tasks.find(task => task.id === data.task_id);
        if (completedTask) {
            completedTask.completed = true;
            // console.log(`Marked task ${data.task_id} as completed locally.`);
        } else {
            console.warn(`Received task_completed for unknown task ID: ${data.task_id}`);
        }
        // --- End Added Section ---
        
        updateUI(); // Update the task progress display text ("Tasks: X/Y")
    });

    // --- Listener for starting task minigame ---
    socket.on('start_task_minigame', (data) => {
        const { task_id, task_type } = data;
        console.log(`Received start_task_minigame: id=${task_id}, type=${task_type}`);
        
        // Get ALL overlay elements
        const simpleOverlay = document.getElementById('task-overlay-simple');
        const wiresOverlay = document.getElementById('task-overlay-wires');
        const keypadOverlay = document.getElementById('task-overlay-keypad');
        const patternOverlay = document.getElementById('task-overlay-pattern');
        const steeringOverlay = document.getElementById('task-overlay-steering');
        const timingDownloadOverlay = document.getElementById('task-overlay-timing-download');
        
        // Get ALL cancel/close buttons
        const closeWiresBtn = document.getElementById('close-wires-task-btn');
        const cancelKeypadBtn = document.getElementById('cancel-keypad-btn');
        const cancelPatternBtn = document.getElementById('cancel-pattern-btn');
        const cancelSteeringBtn = document.getElementById('cancel-steering-btn');
        const cancelTimingDownloadBtn = document.getElementById('cancel-timing-download-btn');
        
        // Get necessary canvas elements
        wiresCanvas = document.getElementById('wires-canvas');
        // steeringCanvas is retrieved in its init function

        // Hide all task overlays first
        if (simpleOverlay) simpleOverlay.classList.add('hidden');
        if (wiresOverlay) wiresOverlay.classList.add('hidden');
        if (keypadOverlay) keypadOverlay.classList.add('hidden');
        if (patternOverlay) patternOverlay.classList.add('hidden');
        if (steeringOverlay) steeringOverlay.classList.add('hidden');
        if (timingDownloadOverlay) timingDownloadOverlay.classList.add('hidden');
        
        // Cancel any ongoing tasks (important!)
        cleanupWiresListeners(); // Does not set isTaskActive, handled by button/completion
        if (timingDownloadActive) cancelTimingDownloadGame(); // Sets isTaskActive = false
        // cleanupKeypadGame(); // Should be handled by cancel button
        // cleanupPatternGame(); // Should be handled by cancel button
        if (steeringActive) cancelSteeringGame(); // Sets isTaskActive = false

        // --- SET TASK ACTIVE & CLEAR MOVEMENT --- 
        isTaskActive = true;
        keysPressed['ArrowUp'] = false; keysPressed['KeyW'] = false;
        keysPressed['ArrowDown'] = false; keysPressed['KeyS'] = false;
        keysPressed['ArrowLeft'] = false; keysPressed['KeyA'] = false;
        keysPressed['ArrowRight'] = false; keysPressed['KeyD'] = false;
        // -----------------------------------------

        // --- Route to correct task initialization ---
        if (task_type === 'simple_click' && simpleOverlay) {
            simpleOverlay.classList.remove('hidden');
            setTimeout(() => {
                /* complete task logic */ isTaskActive = false;
            }, 1000); 
        } else if (task_type === 'wires' && wiresOverlay && wiresCanvas) {
            wiresOverlay.classList.remove('hidden');
            initWiresGame(task_id); 
            if (closeWiresBtn) {
                closeWiresBtn.onclick = () => { /* cleanup, set isTaskActive=false */ cancelWiresGame(); };
            }
        } else if (task_type === 'keypad' && keypadOverlay) {
            keypadOverlay.classList.remove('hidden');
            initKeypadGame(task_id);
            if (cancelKeypadBtn) {
                cancelKeypadBtn.onclick = cancelKeypadGame; // Ensure this sets isTaskActive=false
            }
        } else if (task_type === 'pattern' && patternOverlay) {
            patternOverlay.classList.remove('hidden');
            initPatternGame(task_id);
            // Need to get cancelPatternBtn again inside this scope?
            const cancelPatternBtn = document.getElementById('cancel-pattern-btn');
            if (cancelPatternBtn) {
                cancelPatternBtn.onclick = null;
                cancelPatternBtn.onclick = cancelPatternGame; // Ensure this sets isTaskActive=false
            }
        } else if (task_type === 'steering' && steeringOverlay) {
            // --- ADDED BACK: Steering task handler block ---
            steeringOverlay.classList.remove('hidden');
            initSteeringGame(task_id);
            // Get cancel button within this block's scope
            const cancelSteeringBtn = document.getElementById('cancel-steering-btn'); 
            if (cancelSteeringBtn) {
                cancelSteeringBtn.onclick = null; // Remove previous listener
                cancelSteeringBtn.onclick = cancelSteeringGame; // cancelSteeringGame sets isTaskActive=false
            }
            // --- End Added Block ---
        } else if (task_type === 'timing_download' && timingDownloadOverlay) {
            timingDownloadOverlay.classList.remove('hidden');
            initTimingDownloadGame(task_id);
            // Need to get cancelTimingDownloadBtn again inside this scope?
            const cancelTimingDownloadBtn = document.getElementById('cancel-timing-download-btn');
            if (cancelTimingDownloadBtn) {
                cancelTimingDownloadBtn.onclick = null;
                cancelTimingDownloadBtn.onclick = cancelTimingDownloadGame; // cancelTimingDownloadGame sets isTaskActive=false
            }
        } else {
            console.warn(`Unknown task type '${task_type}' or overlay/canvas not found for task ${task_id}`);
            isTaskActive = false; // Reset flag if task can't start
        }
    });

    socket.on('game_over', (data) => {
        // console.log('Game Over:', data);
        roomStatus = 'game_over';
        amIDead = true; 

        // --- Cleanup UI --- 
        const killerInfoDiv = document.getElementById('killer-info');
        if (killerInfoDiv) killerInfoDiv.style.display = 'none';
        const popup = document.getElementById('you-died-popup');
        if (popup) popup.style.display = 'none';
        const gameCanvas = document.getElementById('gameCanvas');
        if(gameCanvas) gameCanvas.style.display = 'none'; // Hide the game canvas

        // --- Display Game Over Message in Waiting Room --- 
        const waitingRoomDiv = document.getElementById('waiting-room');
        const statusMessageP = document.getElementById('status-message');
        const startGameBtn = document.getElementById('start-game-btn');
        const gameOverControls = document.getElementById('game-over-controls');
        
        if (waitingRoomDiv) waitingRoomDiv.style.display = 'block'; // Show the container
        if (startGameBtn) startGameBtn.style.display = 'none'; // Hide start button
        if (gameOverControls) gameOverControls.style.display = 'block'; // Show back home button

        let finalMessage = 'Game Over!'; // Declare outside the if block with a default
        if (statusMessageP) {
            finalMessage = data.message || 'Game Over!'; // Assign inside, remove let
            if (data.outcome === 'killer_win' && data.winner_id === myPlayerId) {
                finalMessage = 'YOU WON!'; 
                statusMessageP.style.color = 'lime';
            } else if (data.outcome === 'players_win') { // Check for player win
                finalMessage = 'TASK COMPLETE! Crew Wins!';
                statusMessageP.style.color = 'cyan'; // Different color for player win
            } else { 
                 statusMessageP.style.color = 'white';
            }
            statusMessageP.innerText = finalMessage;
        }
        
        // Store the message for updateUI to use
        window.lastGameOverMessage = finalMessage; 

        // No need to call updateUI() here as we manually set the state
        // Resetting local flags like isKiller isn't strictly necessary as the page will redirect
    });

    // --- ADDED: Meeting Listeners ---
    socket.on('meeting_started', (data) => {
        console.log("[Meeting Started]", data);
        roomStatus = 'meeting';
        // TODO: Populate player list for voting based on data.players
        // TODO: Start client-side timer display using data.duration
        startMeetingTimer(data.duration);
        populateMeetingPlayerList(data.players);
        clearMeetingChat(); // Clear chat from previous meeting
        // Display who called it?
        addMeetingChatMessage(`Meeting called by ${data.caller_username || 'Someone'}.`, 'system');

        updateUI();
    });

    socket.on('meeting_ended', (data) => {
        console.log("[Meeting Ended]", data);
        stopMeetingTimer(); // Stop the client timer interval
        roomStatus = data.status; // Should be 'playing' or 'game_over'

        // Display outcome message (e.g., in chat or a temporary popup)
        let outcomeMsg = "Meeting ended.";
        if (data.outcome === 'tie') {
            outcomeMsg = "Vote tied! No one was ejected.";
        } else if (data.outcome === 'ejected') {
            const ejectedPlayer = data.players.find(p => p.id === data.ejected_player_id);
            const ejectedName = ejectedPlayer?.username || 'Someone';
            outcomeMsg = `${ejectedName} was ejected.`;
            // Update local player list (allPlayersList) if needed, though current_state/room_update should handle it
            const localPlayer = allPlayersList.find(p => p.id === data.ejected_player_id);
            if(localPlayer) localPlayer.is_dead = true;
            if(data.ejected_player_id === myPlayerId) amIDead = true;
        }
        // Add message to meeting chat? Or just update UI based on new status?
        // Maybe add a temporary announcement overlay?
        console.log("Meeting Outcome:", outcomeMsg);
        // For now, just log it. `updateUI` handles switching back.

        // Update local state if needed (e.g., `allPlayersList` from data.players)
        allPlayersList = data.players || allPlayersList;
        
        // --- ADDED: Store Cooldown Time --- 
        if (data.emergency_button_cooldown_until) {
             buttonCooldownEndTime = new Date(data.emergency_button_cooldown_until);
             console.log("Meeting ended, received cooldown end time:", buttonCooldownEndTime);
        } else {
             buttonCooldownEndTime = null;
        }
        // --- End Cooldown Handling ---
        
        updateUI();
    });

    socket.on('new_meeting_message', (data) => {
        // TODO: Display the chat message in the meeting UI
        console.log("[Meeting Chat]", data);
        addMeetingChatMessage(data.message, 'player', data.sender_username);
    });

    socket.on('vote_update', (data) => {
        // TODO: Update the display of vote counts next to player names
        console.log("[Vote Update]", data);
        updateMeetingVoteCounts(data.vote_counts); // Assuming server sends { player_id: count }
    });

    socket.on('meeting_call_failed', (data) => {
        console.warn("[Meeting Call Failed]", data.reason);
        // Optionally show a temporary message to the user
        // e.g., display data.reason briefly on screen
    });

    // --- ADDED: Kill Cooldown Update Handler ---
    socket.on('kill_cooldown_update', (data) => {
        if (data.cooldown_ends_at) {
            killReadyTimestamp = new Date(data.cooldown_ends_at);
            console.log(`[Kill Cooldown] Updated. Ready at: ${killReadyTimestamp.toLocaleTimeString()}`);
            // Update UI immediately (gameLoop will handle continuous updates)
            // updateUI(); // Might cause stutter if called too often, rely on gameLoop
        } else {
            killReadyTimestamp = null; // Clear if server sends null
            console.log("[Kill Cooldown] Cleared.");
        }
    });
    // --- End Kill Cooldown Handler ---

    // --- End Meeting Listeners ---
}

// Store the last game over message globally
window.lastGameOverMessage = 'Game Over!';

async function initGame() {
    // console.log("Initializing game..."); // Remove log
    createUI(); // Create UI elements first
    const roomId = getRoomIdFromUrl();
    document.getElementById('room-code-display').innerText = `Room Code: ${roomId}`; // Show Room ID

    function resizeCanvas() {
        const gameContainer = document.getElementById('gameContainer');
        canvas.width = gameContainer.clientWidth;
        canvas.height = gameContainer.clientHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial resize

    setupInputListeners();
    setupSocketListeners(roomId);

    // Re-emit join_room when the game page loads to sync this connection
    // console.log(`Emitting join_room for room ${roomId} on game page load.`); // Remove log
    socket.emit('join_room', { room_id: roomId });

    try {
        loadAssetsForPlayers(allPlayersList); // Load player images
        assetsLoaded = true;
        // console.log("Assets loaded!");
    } catch (error) {
        console.error("Failed to load assets:", error);
        assetsLoaded = false;
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) {
            statusMessageP.innerText = 'Error loading game assets. Please refresh.';
        }
    }
}

let meetingTimerInterval = null; // Declare the timer interval variable
let meetingEndTime = null; // Declare meeting end time

// --- ADDED: Helper functions for Meeting UI ---
function startMeetingTimer(duration) {
    stopMeetingTimer(); // Clear any existing timer
    meetingEndTime = Date.now() + duration * 1000;
    const timerDisplay = document.getElementById('meeting-timer');

    const updateTimer = () => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.round((meetingEndTime - now) / 1000));
        if (timerDisplay) {
            timerDisplay.innerText = `Time remaining: ${timeLeft}s`;
        }
        if (timeLeft <= 0) {
            stopMeetingTimer();
            // Server's end_meeting should trigger the actual transition
        }
    };

    updateTimer(); // Update immediately
    meetingTimerInterval = setInterval(updateTimer, 1000);
}

function stopMeetingTimer() {
    if (meetingTimerInterval) {
        clearInterval(meetingTimerInterval);
        meetingTimerInterval = null;
    }
    meetingEndTime = null;
}

function populateMeetingPlayerList(playersData) {
    const listUl = document.getElementById('meeting-player-list');
    if (!listUl) return;
    listUl.innerHTML = ''; // Clear previous list
    // Clear existing button styles
    document.querySelectorAll('#meeting-player-list button').forEach(btn => btn.classList.remove('ring-2', 'ring-offset-2', 'ring-yellow-400'));

    playersData.forEach(player => {
        const li = document.createElement('li');
        li.classList.add('flex', 'items-center', 'justify-between', 'p-1', 'hover:bg-gray-700', 'rounded');

        const playerName = document.createElement('span');
        playerName.textContent = player.username;
        if (player.id === myPlayerId) {
            playerName.textContent += ' (You)';
            playerName.classList.add('font-bold');
        }
        if (player.is_dead) {
            playerName.classList.add('text-red-500', 'line-through', 'opacity-60');
        }
        li.appendChild(playerName);

        // Add vote count display (initially 0)
        const voteCountSpan = document.createElement('span');
        voteCountSpan.id = `vote-count-${player.id}`;
        voteCountSpan.classList.add('text-xs', 'text-gray-400', 'ml-2');
        voteCountSpan.textContent = '(0 votes)';
        li.appendChild(voteCountSpan);

        // Add Vote button (only if voter is not dead)
        const localPlayerAlive = !amIDead; // Check if the local player is alive
        if (!player.is_dead && localPlayerAlive) {
            const voteButton = document.createElement('button');
            voteButton.dataset.playerId = player.id; // Store player ID for handler
            voteButton.textContent = 'Vote';
            voteButton.classList.add(
                'ml-auto', 'px-2', 'py-0.5', 'text-xs', 'bg-blue-600', 'hover:bg-blue-500',
                'rounded', 'disabled:opacity-50', 'transition-all'
            );
            // --- ADDED: onclick handler to emit 'player_vote' --- 
            voteButton.onclick = () => handleVote(player.id);
            li.appendChild(voteButton);
        } else if (player.is_dead) {
             // Add placeholder for dead players (e.g., [DEAD])
             const deadLabel = document.createElement('span');
             deadLabel.textContent = '[DEAD]';
             deadLabel.classList.add('ml-auto', 'text-xs', 'text-red-600');
             li.appendChild(deadLabel);
        } else if (!localPlayerAlive && !player.is_dead) {
            // If local player is dead, show non-interactive state for other alive players
             const aliveLabel = document.createElement('span');
             aliveLabel.textContent = 'Alive';
             aliveLabel.classList.add('ml-auto', 'text-xs', 'text-green-500');
             li.appendChild(aliveLabel);
        }

        listUl.appendChild(li);
    });
}

function handleVote(targetPlayerId) {
    console.log(`Voting for: ${targetPlayerId}`);
    const roomId = getRoomIdFromUrl();
    socket.emit('player_vote', { room_id: roomId, target_player_id: targetPlayerId });

    // --- ADDED: UI Feedback for voting ---
    // Remove highlight from previously selected button
    document.querySelectorAll('#meeting-player-list button.ring-2').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-yellow-400', 'bg-yellow-500');
        btn.classList.add('bg-blue-600');
        btn.disabled = false; // Re-enable other buttons
    });

    // Highlight the newly selected button
    const votedButton = document.querySelector(`#meeting-player-list button[data-player-id="${targetPlayerId}"]`);
    if (votedButton) {
        votedButton.classList.add('ring-2', 'ring-offset-2', 'ring-yellow-400', 'bg-yellow-500');
        votedButton.classList.remove('bg-blue-600');
        // Optional: Disable the button just voted for? Or keep enabled to change vote?
        // Let's keep enabled for now.
    }

    // Optional: Disable all vote buttons after voting once?
    // document.querySelectorAll('#meeting-player-list button').forEach(btn => btn.disabled = true);
}

function updateMeetingVoteCounts(voteCounts) {
     // voteCounts is expected to be { player_id: count }
     for (const playerId in voteCounts) {
         const countSpan = document.getElementById(`vote-count-${playerId}`);
         if (countSpan) {
             countSpan.textContent = `(${voteCounts[playerId]} votes)`;
         }
     }
     // Reset counts for players not in the voteCounts object (if needed)?
     // Or assume server sends counts for all players with votes > 0?
}

function clearMeetingChat() {
    const chatMessages = document.getElementById('meeting-chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}

function addMeetingChatMessage(message, type = 'player', sender = null) {
    const chatMessages = document.getElementById('meeting-chat-messages');
    if (!chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('p-1', 'rounded');

    let prefix = '';
    if (type === 'system') {
        msgDiv.classList.add('text-yellow-400', 'italic');
    } else if (type === 'player') {
        // --- ADDED: Check if sender is dead (using info from server) ---
        // Assuming the `new_meeting_message` event payload now includes `is_dead` boolean
        const senderIsDead = message.sender_is_dead; // Need to adjust based on actual payload structure
        
        msgDiv.classList.add('bg-gray-700/50');
        // Update prefix to potentially show dead status
        prefix = `<span class="font-semibold${senderIsDead ? ' text-red-500 line-through' : ''}">${sender || '??'}:</span> `;
        // Ensure message content is treated as text, not HTML, unless intended.
        // Using textContent after setting innerHTML for the prefix is safer.
        const textContent = message.message || message; // Adjust based on payload
        msgDiv.innerHTML = prefix;
        msgDiv.appendChild(document.createTextNode(textContent)); 

    } else { // Fallback for unknown type or if message is just a string
         msgDiv.appendChild(document.createTextNode(message)); 
    }

    // Original code (use innerHTML for prefix, append text node for message)
    // msgDiv.innerHTML = prefix; // Use innerHTML to parse sender span
    // msgDiv.appendChild(document.createTextNode(message)); // Append actual message as text

    chatMessages.appendChild(msgDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- ADDED: Function to send chat message ---
function sendMeetingChat(message) {
    console.log(`Sending chat: ${message}`);
    const roomId = getRoomIdFromUrl();
    socket.emit('meeting_chat', { room_id: roomId, message: message });
}

// --- End Helper functions for Meeting UI ---

// --- ADDED: Wires Minigame Functions ---

// Fisher-Yates shuffle utility
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function initWiresGame(taskId) {
    wiresGameTaskId = taskId; // Store the task ID

    // Ensure canvas and context are assigned
    if (!wiresCanvas) {
        wiresCanvas = document.getElementById('wires-canvas');
    }
    if (!wiresCanvas) {
        console.error("Wires canvas element not found!");
        return; // Cannot proceed without canvas
    }
    // Always try to get context if canvas exists
    wiresCtx = wiresCanvas.getContext('2d');
    if (!wiresCtx) {
        console.error("Failed to get 2D context for wires canvas!");
        return; // Cannot proceed without context
    }

    // Reset state
    wireEndpoints = { left: [], right: [] };
    wireConnections = {};
    isDraggingWire = false;
    draggingWireColor = null;
    currentDragPos = { x: 0, y: 0 };

    const canvasWidth = wiresCanvas.width;
    const canvasHeight = wiresCanvas.height;
    const verticalSpacing = canvasHeight / (WIRE_COLORS.length + 1);
    const leftX = 40;
    const rightX = canvasWidth - 40;

    // Create shuffled positions for right side
    let rightIndices = WIRE_COLORS.map((_, index) => index);
    shuffleArray(rightIndices);

    WIRE_COLORS.forEach((color, index) => {
        const yPos = verticalSpacing * (index + 1);
        wireEndpoints.left.push({ color: color, x: leftX, y: yPos });
        wireConnections[color] = false; // Initialize as not connected

        // Assign right side based on shuffled order
        const rightYPos = verticalSpacing * (rightIndices[index] + 1);
        wireEndpoints.right.push({ color: color, x: rightX, y: rightYPos });
    });

    // Add event listeners (remove old ones first)
    wiresCanvas.removeEventListener('mousedown', handleWiresMouseDown);
    wiresCanvas.removeEventListener('mousemove', handleWiresMouseMove);
    wiresCanvas.removeEventListener('mouseup', handleWiresMouseUp);
    // Add touch events for mobile compatibility (optional but good)
    wiresCanvas.removeEventListener('touchstart', handleWiresTouchStart);
    wiresCanvas.removeEventListener('touchmove', handleWiresTouchMove);
    wiresCanvas.removeEventListener('touchend', handleWiresTouchEnd);

    wiresCanvas.addEventListener('mousedown', handleWiresMouseDown);
    wiresCanvas.addEventListener('mousemove', handleWiresMouseMove);
    wiresCanvas.addEventListener('mouseup', handleWiresMouseUp);
    wiresCanvas.addEventListener('touchstart', handleWiresTouchStart, { passive: false });
    wiresCanvas.addEventListener('touchmove', handleWiresTouchMove, { passive: false });
    wiresCanvas.addEventListener('touchend', handleWiresTouchEnd, { passive: false });


    drawWiresGame();
}

function drawWiresGame() {
    if (!wiresCtx || !wiresCanvas) return;
    wiresCtx.clearRect(0, 0, wiresCanvas.width, wiresCanvas.height);

    // Draw connections first (behind endpoints)
    wireEndpoints.left.forEach(leftPoint => {
        if (wireConnections[leftPoint.color]) {
            const rightPoint = wireEndpoints.right.find(rp => rp.color === leftPoint.color);
            if (rightPoint) {
                wiresCtx.beginPath();
                wiresCtx.moveTo(leftPoint.x, leftPoint.y);
                wiresCtx.lineTo(rightPoint.x, rightPoint.y);
                wiresCtx.strokeStyle = leftPoint.color;
                wiresCtx.lineWidth = WIRE_THICKNESS;
                wiresCtx.stroke();
            }
        }
    });

    // Draw the wire currently being dragged
    if (isDraggingWire && draggingWireColor) {
        const startPoint = wireEndpoints.left.find(p => p.color === draggingWireColor);
        if (startPoint) {
            wiresCtx.beginPath();
            wiresCtx.moveTo(startPoint.x, startPoint.y);
            wiresCtx.lineTo(currentDragPos.x, currentDragPos.y);
            wiresCtx.strokeStyle = draggingWireColor;
            wiresCtx.lineWidth = WIRE_THICKNESS;
            wiresCtx.stroke();
        }
    }

    // Draw endpoints on top
    [...wireEndpoints.left, ...wireEndpoints.right].forEach(point => {
        wiresCtx.beginPath();
        wiresCtx.arc(point.x, point.y, WIRE_ENDPOINT_RADIUS, 0, Math.PI * 2);
        wiresCtx.fillStyle = point.color;
        wiresCtx.fill();
        // Add a border or highlight
        wiresCtx.strokeStyle = 'black';
        wiresCtx.lineWidth = 2;
        wiresCtx.stroke();
    });
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    // For touch events, use the first touch point
    const clientX = evt.clientX ?? evt.touches?.[0]?.clientX;
    const clientY = evt.clientY ?? evt.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return null; // Exit if no coordinates
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handleWiresMouseDown(evt) {
    const pos = getMousePos(wiresCanvas, evt);
    if (!pos) return;

    wireEndpoints.left.forEach(point => {
        const distSq = (pos.x - point.x)**2 + (pos.y - point.y)**2;
        // Only allow dragging if not already connected
        if (distSq < WIRE_ENDPOINT_RADIUS**2 && !wireConnections[point.color]) {
            isDraggingWire = true;
            draggingWireColor = point.color;
            currentDragPos = pos;
            // Prevent default actions like text selection during drag
            evt.preventDefault();
        }
    });
    drawWiresGame();
}

function handleWiresMouseMove(evt) {
    if (!isDraggingWire) return;
    const pos = getMousePos(wiresCanvas, evt);
    if (!pos) return;

    currentDragPos = pos;
    // Prevent default actions like scrolling during drag
    evt.preventDefault();
    drawWiresGame();
}

function handleWiresMouseUp(evt) {
    if (!isDraggingWire || !draggingWireColor) return;
    const pos = getMousePos(wiresCanvas, evt);
    if (!pos) {
         // If we can't get pos on mouseup, just cancel the drag
         isDraggingWire = false;
         draggingWireColor = null;
         drawWiresGame();
         return;
    }

    let connected = false;
    wireEndpoints.right.forEach(point => {
        const distSq = (pos.x - point.x)**2 + (pos.y - point.y)**2;
        if (distSq < WIRE_ENDPOINT_RADIUS**2 && point.color === draggingWireColor) {
            wireConnections[draggingWireColor] = true;
            connected = true;
        }
    });

    isDraggingWire = false;
    draggingWireColor = null;
    drawWiresGame();

    if (checkWiresCompletion()) {
        console.log("Wires task completed!");
        const completedTaskId = wiresGameTaskId; // Store ID
        // Add a slight delay before closing overlay and sending event
        setTimeout(() => {
             const roomId = getRoomIdFromUrl();
             if (completedTaskId) { // Use stored ID
                 socket.emit('complete_task_minigame', { room_id: roomId, task_id: completedTaskId });
                 console.log(`Sent complete_task_minigame for ${completedTaskId}`);
                 const wiresOverlay = document.getElementById('task-overlay-wires');
                 if (wiresOverlay) wiresOverlay.classList.add('hidden');
                 cleanupWiresListeners(); // Clean up listeners after completion
                 isTaskActive = false; // <<< ADDED: Set task inactive on completion
             } else {
                  console.error("Cannot complete wires task, missing task ID.");
             }
        }, 300); // 300ms delay
    }
}

// Touch event handlers (delegate to mouse handlers)
function handleWiresTouchStart(evt) {
    if (evt.touches.length === 1) { // Handle single touch
        handleWiresMouseDown(evt);
    }
}
function handleWiresTouchMove(evt) {
    if (evt.touches.length === 1) { // Handle single touch
        handleWiresMouseMove(evt);
    }
}
function handleWiresTouchEnd(evt) {
    // Use changedTouches for touchend position
    const touchEndEvent = { // Create a synthetic event object for getMousePos
         clientX: evt.changedTouches?.[0]?.clientX,
         clientY: evt.changedTouches?.[0]?.clientY
    };
    handleWiresMouseUp(touchEndEvent);
}

function checkWiresCompletion() {
    return WIRE_COLORS.every(color => wireConnections[color]);
}

function cleanupWiresListeners() {
     if (wiresCanvas) {
        wiresCanvas.removeEventListener('mousedown', handleWiresMouseDown);
        wiresCanvas.removeEventListener('mousemove', handleWiresMouseMove);
        wiresCanvas.removeEventListener('mouseup', handleWiresMouseUp);
        wiresCanvas.removeEventListener('touchstart', handleWiresTouchStart);
        wiresCanvas.removeEventListener('touchmove', handleWiresTouchMove);
        wiresCanvas.removeEventListener('touchend', handleWiresTouchEnd);
     }
}

// --- ADDED: Download Minigame Functions ---
function initDownloadGame(taskId) {
    downloadGameTaskId = taskId;
    downloadProgress = 0;
    const progressBar = document.getElementById('download-progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
    }

    // Clear any existing interval
    if (downloadInterval) {
        clearInterval(downloadInterval);
        downloadInterval = null;
    }

    const steps = DOWNLOAD_DURATION_MS / DOWNLOAD_UPDATE_INTERVAL_MS;
    const increment = 100 / steps;

    downloadInterval = setInterval(() => {
        downloadProgress += increment;
        if (downloadProgress >= 100) {
            downloadProgress = 100;
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.textContent = '100%';
            }
            clearInterval(downloadInterval);
            downloadInterval = null;
            console.log("Download task complete!");

            // Complete the task on the server
            setTimeout(() => {
                const roomId = getRoomIdFromUrl();
                if (downloadGameTaskId) {
                    socket.emit('complete_task_minigame', { room_id: roomId, task_id: downloadGameTaskId });
                    console.log(`Sent complete_task_minigame for ${downloadGameTaskId}`);
                    const downloadOverlay = document.getElementById('task-overlay-download');
                    if (downloadOverlay) downloadOverlay.classList.add('hidden');
                } else {
                     console.error("Cannot complete download task, missing task ID.");
                }
            }, 300); // Short delay after completion

        } else {
            if (progressBar) {
                progressBar.style.width = `${downloadProgress}%`;
                progressBar.textContent = `${Math.round(downloadProgress)}%`;
            }
        }
    }, DOWNLOAD_UPDATE_INTERVAL_MS);
}

function cancelDownloadGame() {
    if (downloadInterval) {
        clearInterval(downloadInterval);
        downloadInterval = null;
    }
    downloadProgress = 0;
    downloadGameTaskId = null;
    const downloadOverlay = document.getElementById('task-overlay-download');
    if (downloadOverlay) downloadOverlay.classList.add('hidden');
    console.log("Download task cancelled.");
    isTaskActive = false; // <<< ADDED: Set task inactive
}
// --- End Download Minigame Functions ---

// --- ADDED: Keypad Minigame Functions ---
function initKeypadGame(taskId) {
    keypadGameTaskId = taskId;
    currentKeypadInput = "";
    keypadDisplay = document.getElementById('keypad-display');
    updateKeypadDisplay();

    // ADDED: Display the correct code
    const requiredCodeDisplay = document.getElementById('keypad-required-code');
    if (requiredCodeDisplay) {
        requiredCodeDisplay.textContent = CORRECT_KEYCODE;
    }

    // Add listeners to keypad buttons
    document.querySelectorAll('.keypad-btn[data-key]').forEach(button => {
        button.onclick = () => handleKeypadInput(button.dataset.key);
    });
    document.getElementById('keypad-clear').onclick = () => {
        currentKeypadInput = "";
        updateKeypadDisplay();
    };
    document.getElementById('keypad-enter').onclick = checkKeypadCode;
}

function handleKeypadInput(key) {
    if (currentKeypadInput.length < CORRECT_KEYCODE.length) { // Limit input length
        currentKeypadInput += key;
        updateKeypadDisplay();
    }
}

function updateKeypadDisplay() {
    if (keypadDisplay) {
        keypadDisplay.textContent = currentKeypadInput;
        // Reset feedback colors
        keypadDisplay.classList.remove('text-green-400', 'text-red-400');
        keypadDisplay.classList.add('text-gray-400');
    }
}

function checkKeypadCode() {
    if (currentKeypadInput === CORRECT_KEYCODE) {
        console.log("Keypad task complete!");
        if (keypadDisplay) {
            keypadDisplay.classList.remove('text-gray-400', 'text-red-400');
            keypadDisplay.classList.add('text-green-400');
            keypadDisplay.textContent = "ACCESS GRANTED";
        }
        // Complete task on server after short delay
        setTimeout(() => {
            const roomId = getRoomIdFromUrl();
            if (keypadGameTaskId) {
                socket.emit('complete_task_minigame', { room_id: roomId, task_id: keypadGameTaskId });
                console.log(`Sent complete_task_minigame for ${keypadGameTaskId}`);
                cleanupKeypadGame(); // Close overlay and clean up
            } else {
                console.error("Cannot complete keypad task, missing task ID.");
            }
        }, 500);
    } else {
        console.log("Incorrect keypad code.");
        if (keypadDisplay) {
            keypadDisplay.classList.remove('text-gray-400', 'text-green-400');
            keypadDisplay.classList.add('text-red-400');
            keypadDisplay.textContent = "ACCESS DENIED";
        }
        // Clear input after showing error
        setTimeout(() => {
             currentKeypadInput = "";
             updateKeypadDisplay();
        }, 700);
    }
}

function cancelKeypadGame() {
    cleanupKeypadGame();
    console.log("Keypad task cancelled.");
}

function cleanupKeypadGame() {
    keypadGameTaskId = null;
    currentKeypadInput = "";
    // Remove listeners? (Optional, as they are added again in init)
    const keypadOverlay = document.getElementById('task-overlay-keypad');
    if (keypadOverlay) keypadOverlay.classList.add('hidden');
    // Reset display text just in case
    if (keypadDisplay) keypadDisplay.textContent = "";
    isTaskActive = false; // <<< ADDED: Set task inactive
}

// --- End Keypad Minigame Functions ---

// --- ADDED: Pattern Minigame Functions ---
function initPatternGame(taskId) {
    patternGameTaskId = taskId;
    patternButtons = document.querySelectorAll('.pattern-btn');
    patternInstructions = document.getElementById('pattern-instructions');
    resetPatternGame();

    document.getElementById('start-pattern-btn').onclick = displayPatternSequence;
    patternButtons.forEach(button => {
        // Remove old listener before adding new one
        button.onclick = null;
        button.onclick = () => handlePatternInput(parseInt(button.dataset.patternIndex));
        // Reset visual state
        button.classList.remove('brightness-150', 'ring-2'); 
    });
}

function resetPatternGame() {
    patternSequence = [];
    playerPatternInput = [];
    isDisplayingPattern = false;
    for (let i = 0; i < PATTERN_LENGTH; i++) {
        patternSequence.push(Math.floor(Math.random() * patternButtons.length)); // Random index 0-3
    }
    if (patternInstructions) patternInstructions.textContent = "Watch the sequence, then repeat it.";
    patternButtons.forEach(button => { button.disabled = true; }); // Disable buttons initially
    document.getElementById('start-pattern-btn').disabled = false;
}

async function displayPatternSequence() {
    if (isDisplayingPattern) return; // Don't replay if already displaying
    isDisplayingPattern = true;
    if (patternInstructions) patternInstructions.textContent = "Watch carefully...";
    document.getElementById('start-pattern-btn').disabled = true; // Disable replay button
    patternButtons.forEach(button => { button.disabled = true; }); // Ensure buttons disabled

    // Short delay before starting
    await new Promise(resolve => setTimeout(resolve, 500)); 

    for (const index of patternSequence) {
        const button = patternButtons[index];
        if (button) {
            // Flash effect
            button.classList.add('brightness-150', 'ring-2'); // Make it brighter
            await new Promise(resolve => setTimeout(resolve, PATTERN_FLASH_DURATION_MS));
            button.classList.remove('brightness-150', 'ring-2');
            await new Promise(resolve => setTimeout(resolve, PATTERN_FLASH_INTERVAL_MS));
        }
    }

    if (patternInstructions) patternInstructions.textContent = "Your turn! Repeat the sequence.";
    isDisplayingPattern = false;
    patternButtons.forEach(button => { button.disabled = false; }); // Enable buttons for input
}

function handlePatternInput(index) {
    if (isDisplayingPattern || patternButtons[index]?.disabled) return; // Ignore clicks during display or if disabled

    playerPatternInput.push(index);

    // Brief visual feedback on click
    const button = patternButtons[index];
    if (button) {
        button.classList.add('brightness-125');
        setTimeout(() => button.classList.remove('brightness-125'), 150);
    }

    // Check if the input matches the sequence so far
    const currentInputIndex = playerPatternInput.length - 1;
    if (playerPatternInput[currentInputIndex] !== patternSequence[currentInputIndex]) {
        console.log("Pattern incorrect!");
        if (patternInstructions) patternInstructions.textContent = "Incorrect! Try again. Watch the sequence.";
        // Reset player input and disable buttons until sequence is replayed
        playerPatternInput = [];
        patternButtons.forEach(button => { button.disabled = true; }); 
        document.getElementById('start-pattern-btn').disabled = false; // Enable replay button
        return;
    }

    // Check for completion
    if (playerPatternInput.length === patternSequence.length) {
        console.log("Pattern task complete!");
        if (patternInstructions) patternInstructions.textContent = "Correct! Task Complete.";
        patternButtons.forEach(button => { button.disabled = true; }); // Disable after success
        document.getElementById('start-pattern-btn').disabled = true;
        
        // Complete task on server after short delay
        setTimeout(() => {
            const roomId = getRoomIdFromUrl();
            if (patternGameTaskId) {
                socket.emit('complete_task_minigame', { room_id: roomId, task_id: patternGameTaskId });
                console.log(`Sent complete_task_minigame for ${patternGameTaskId}`);
                cleanupPatternGame(); // Close overlay and clean up
            } else {
                console.error("Cannot complete pattern task, missing task ID.");
            }
        }, 500);
    }
}

function cancelPatternGame() {
    cleanupPatternGame();
    console.log("Pattern task cancelled.");
}

function cleanupPatternGame() {
    patternGameTaskId = null;
    patternSequence = [];
    playerPatternInput = [];
    isDisplayingPattern = false;
    // Remove listeners?
    document.getElementById('start-pattern-btn').onclick = null;
    if (patternButtons && patternButtons.length) { // Check if patternButtons exists
      patternButtons.forEach(button => { button.onclick = null; });
    }
    const patternOverlay = document.getElementById('task-overlay-pattern');
    if (patternOverlay) patternOverlay.classList.add('hidden');
    isTaskActive = false; // <<< ADDED: Set task inactive
}

// --- End Pattern Minigame Functions ---

// --- ADDED: Steering Minigame Functions ---
function initSteeringGame(taskId) {
    steeringGameTaskId = taskId;
    steeringActive = true; 
    if (!steeringCanvas) {
        steeringCanvas = document.getElementById('steering-canvas');
        if (!steeringCanvas) { console.error("Steering canvas not found!"); steeringActive = false; return; }
        steeringCtx = steeringCanvas.getContext('2d');
        if (!steeringCtx) { console.error("Failed to get steering context!"); steeringActive = false; return; }
    }
    steeringPlayer.x = 50;
    steeringPlayer.y = 150;
    steeringKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    window.addEventListener('keydown', handleSteeringKeyDown);
    window.addEventListener('keyup', handleSteeringKeyUp);
    if (steeringGameLoopId) cancelAnimationFrame(steeringGameLoopId);
    steeringGameLoop();
}
function handleSteeringKeyDown(event) {
    if (!steeringActive) return; 
    if (event.key in steeringKeys) {
        steeringKeys[event.key] = true;
        event.preventDefault(); 
    }
}
function handleSteeringKeyUp(event) {
    if (!steeringActive) return; 
    if (event.key in steeringKeys) {
        steeringKeys[event.key] = false;
    }
}
function steeringGameLoop() {
    if (!steeringActive || !steeringCtx) return;
    let nextX = steeringPlayer.x;
    let nextY = steeringPlayer.y;
    if (steeringKeys.ArrowUp) nextY -= steeringPlayer.speed;
    if (steeringKeys.ArrowDown) nextY += steeringPlayer.speed;
    if (steeringKeys.ArrowLeft) nextX -= steeringPlayer.speed;
    if (steeringKeys.ArrowRight) nextX += steeringPlayer.speed;
    let collision = false;
    const playerRect = { x: nextX - steeringPlayer.size / 2, y: nextY - steeringPlayer.size / 2, width: steeringPlayer.size, height: steeringPlayer.size };
    for (const wall of steeringWalls) {
        if (rectOverlap(playerRect, wall)) {
            collision = true;
            break;
        }
    }
    if (!collision) {
        steeringPlayer.x = nextX;
        steeringPlayer.y = nextY;
    } else {
        steeringPlayer.x = 50;
        steeringPlayer.y = 150;
    }
    steeringCtx.clearRect(0, 0, steeringCanvas.width, steeringCanvas.height);
    steeringCtx.fillStyle = '#4a5568'; 
    steeringWalls.forEach(wall => { steeringCtx.fillRect(wall.x, wall.y, wall.width, wall.height); });
    steeringCtx.fillStyle = '#38a169';
    steeringCtx.beginPath();
    steeringCtx.arc(steeringTarget.x, steeringTarget.y, steeringTarget.size / 2, 0, Math.PI * 2);
    steeringCtx.fill();
    steeringCtx.fillStyle = '#e53e3e'; 
    steeringCtx.fillRect(playerRect.x, playerRect.y, playerRect.width, playerRect.height);
    const distToTargetSq = (steeringPlayer.x - steeringTarget.x)**2 + (steeringPlayer.y - steeringTarget.y)**2;
    if (distToTargetSq < ((steeringPlayer.size + steeringTarget.size) / 2)**2) {
        const completedTaskId = steeringGameTaskId;
        steeringActive = false;
        cancelAnimationFrame(steeringGameLoopId);
        cleanupSteeringGame();
        setTimeout(() => {
             const roomId = getRoomIdFromUrl();
             if (completedTaskId) {
                 socket.emit('complete_task_minigame', { room_id: roomId, task_id: completedTaskId });
                 console.log(`Sent complete_task_minigame for ${completedTaskId}`);
             } else { console.error("Cannot complete steering task, missing task ID in callback."); }
        }, 300);
        return;
    }
    steeringGameLoopId = requestAnimationFrame(steeringGameLoop);
}
function rectOverlap(rect1, rect2) { /* ... AABB check ... */ return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y );}
function cancelSteeringGame() { cleanupSteeringGame(); console.log("Steering task cancelled."); }
function cleanupSteeringGame() {
    steeringActive = false;
    if (steeringGameLoopId) { cancelAnimationFrame(steeringGameLoopId); steeringGameLoopId = null; }
    window.removeEventListener('keydown', handleSteeringKeyDown);
    window.removeEventListener('keyup', handleSteeringKeyUp);
    steeringGameTaskId = null;
    const steeringOverlay = document.getElementById('task-overlay-steering');
    if (steeringOverlay) steeringOverlay.classList.add('hidden');
    isTaskActive = false;
}
// --- End Steering Functions ---

// --- ADDED: Timing Download Minigame Functions ---
function initTimingDownloadGame(taskId) {
    timingDownloadGameTaskId = taskId;
    timingDownloadActive = true;
    timingBar = document.getElementById('timing-moving-bar');
    timingTargetZone = document.getElementById('timing-target-zone'); // We only need this for positioning info if needed, not manipulation
    const downloadButton = document.getElementById('timing-download-btn');

    if (!timingBar || !downloadButton) {
        console.error("Timing download UI elements not found!");
        timingDownloadActive = false;
        return;
    }

    // Reset state
    timingBarPosition = 0;
    timingBarDirection = 1;
    timingBar.style.left = '0%';
    downloadButton.disabled = false; // Ensure button is enabled
    downloadButton.textContent = 'DOWNLOAD'; // Reset button text
    downloadButton.onclick = handleTimingDownloadClick;

    // Start the animation loop
    if (timingDownloadLoopId) cancelAnimationFrame(timingDownloadLoopId);
    timingDownloadGameLoop();
}

function timingDownloadGameLoop() {
    if (!timingDownloadActive || !timingBar) return;

    // Update position
    timingBarPosition += timingBarSpeed * timingBarDirection;

    // Bounce off edges (Ensure the bar's *left edge* stays within 0-100)
    if (timingBarPosition >= (100 - TIMING_BAR_WIDTH_PERCENT)) { // Stop before right edge goes past 100
        timingBarPosition = 100 - TIMING_BAR_WIDTH_PERCENT;
        timingBarDirection = -1;
    } else if (timingBarPosition <= 0) {
        timingBarPosition = 0;
        timingBarDirection = 1;
    }

    // Apply position to the bar element's left edge
    timingBar.style.left = `${timingBarPosition}%`;

    // Request next frame
    timingDownloadLoopId = requestAnimationFrame(timingDownloadGameLoop);
}

function handleTimingDownloadClick() {
    if (!timingDownloadActive) return;

    const targetStart = TIMING_TARGET_LEFT;
    const targetEnd = TIMING_TARGET_LEFT + TIMING_TARGET_WIDTH;

    // Calculate the center of the bar
    const barCenterPosition = timingBarPosition + (TIMING_BAR_WIDTH_PERCENT / 2);

    // Check if the center of the bar is within the target zone
    if (barCenterPosition >= targetStart && barCenterPosition <= targetEnd) {
        console.log("Timing download successful!");
        cleanupTimingDownloadGame(true); // Pass true for success

        // Complete task on server
        setTimeout(() => {
             const roomId = getRoomIdFromUrl();
             if (timingDownloadGameTaskId) {
                 socket.emit('complete_task_minigame', { room_id: roomId, task_id: timingDownloadGameTaskId });
                 console.log(`Sent complete_task_minigame for ${timingDownloadGameTaskId}`);
             } else {
                 console.error("Cannot complete timing download task, missing task ID.");
             }
        }, 300);

    } else {
        console.log("Timing download missed!");
        // Add feedback: flash button red? Disable briefly?
        const downloadButton = document.getElementById('timing-download-btn');
        if (downloadButton) {
            downloadButton.textContent = 'MISSED!';
            downloadButton.disabled = true;
            downloadButton.classList.add('bg-red-600');
            setTimeout(() => {
                downloadButton.disabled = false;
                downloadButton.textContent = 'DOWNLOAD';
                downloadButton.classList.remove('bg-red-600');
            }, 800); // Cooldown after miss
        }
    }
}

function cancelTimingDownloadGame() {
    cleanupTimingDownloadGame(false); // Pass false for cancel
    console.log("Timing download task cancelled.");
}

function cleanupTimingDownloadGame(isSuccess = false) {
    timingDownloadActive = false;
    if (timingDownloadLoopId) {
        cancelAnimationFrame(timingDownloadLoopId);
        timingDownloadLoopId = null;
    }
    // No listeners on window to remove for this one
    const downloadButton = document.getElementById('timing-download-btn');
    if(downloadButton) downloadButton.onclick = null;

    if (!isSuccess) { // Only nullify task ID if cancelled, not on success
         timingDownloadGameTaskId = null;
    }
    const timingOverlay = document.getElementById('task-overlay-timing-download');
    if (timingOverlay) timingOverlay.classList.add('hidden');
    isTaskActive = false; // Set global task flag
}

// --- End Timing Download Functions ---

console.log("My Player ID:", myPlayerId);
console.log("Server Killer ID:", data.it_player_id);
console.log("Am I Killer?", isKiller);

initGame();