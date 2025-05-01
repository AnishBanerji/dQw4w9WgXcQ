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
    instructionsDiv.classList.add('text-sm', 'text-gray-300', 'mt-4');
    instructionsDiv.innerHTML = `
        <h4 class="font-bold mb-1">How to Play:</h4>
        <p>Crew: Complete tasks! Avoid the Killer.</p>
        <p>Killer: Eliminate the crew! Don't get caught.</p>
        <p>Controls: WASD to Move. Space to interact/kill.</p>
    `; // Updated controls
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
const TASK_RADIUS_CLIENT = 40; // Same as server
const TASK_RADIUS_CLIENT_SQ = TASK_RADIUS_CLIENT * TASK_RADIUS_CLIENT;
// --- ADDED: Emergency Button State ---
const EMERGENCY_BUTTON = { id: 'emergency_button', x: 1800, y: 1800, radius: 50 }; // Example position near center spawn
const EMERGENCY_BUTTON_RADIUS_SQ = EMERGENCY_BUTTON.radius * EMERGENCY_BUTTON.radius;
const EMERGENCY_BUTTON_DRAW_SIZE = 50; // Added: Size to draw the button image
let buttonCooldownEndTime = null; // Added: Store Date object for cooldown end
let meetingEndTime = null; // Timestamp when meeting ends
let meetingTimerInterval = null; // Interval ID for updating timer display

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
    // Choose image based on dead status
    const characterImg = player.is_dead ? images.deadCharacter : images.character;

    // Ensure image is loaded and player data (pos/angle) is valid before drawing
    if (!characterImg || typeof player?.x !== 'number' || typeof player?.y !== 'number' || typeof player?.angle !== 'number') {
        // console.warn("Skipping drawPlayer due to missing image or invalid player data:", player);
        return;
    }

    ctx.save(); // Save context state before transforming

    // Translate to the player's center position
    ctx.translate(player.x, player.y);

    // Rotate based on the player's angle
    ctx.rotate(player.angle - Math.PI / 2); // Assuming base image faces DOWN

    // Draw the character image centered at the translated+rotated origin
    const drawX = -characterImg.width / 2;
    const drawY = -characterImg.height / 2;
    ctx.drawImage(characterImg, drawX, drawY);

    ctx.restore(); // Restore context state (removes translation and rotation)

    // --- Drawing elements relative to the player's world position (like text) ---
    ctx.fillStyle = 'black'; // Set fillStyle to black for the username
    ctx.font = 'bold 10px Verdana, Geneva, sans-serif'; // Smaller, bold, different font stack
    ctx.textAlign = 'center';
    // Adjust text Y position based on image height - move lower down onto icon
    const textY = player.y - (characterImg.height / 2) + 60; // Changed offset from +5 to +15
    ctx.fillText(player.username || '?', player.x, textY); // Draw username
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
        const gameCanvas = document.getElementById('gameCanvas'); // Get canvas
        setDisplay(gameCanvas, 'none'); // Hide the game canvas
        
        // Show centered overlay for results
        setDisplay(waitingRoom, 'flex'); 
        
        // Configure elements INSIDE the waiting room overlay
        setDisplay(gameOverControls, 'block'); // Show 'Back to Home' button
        setDisplay(gameInstructions, 'none'); // Hide instructions
        setDisplay(playerList, 'none'); // Hide player list
        setDisplay(startGameBtn, 'none'); // Ensure start button is hidden

        if (statusMessage) {
            statusMessage.textContent = window.lastGameOverMessage || 'Game Over!'; 
            if ((window.lastGameOverMessage || '').includes('YOU WON')) {
                 statusMessage.style.color = 'lime';
            } else if ((window.lastGameOverMessage || '').includes('Crew Wins')) {
                 statusMessage.style.color = 'cyan';
            } else if ((window.lastGameOverMessage || '').includes('Killer Wins')) {
                 statusMessage.style.color = 'red'; // Example color for killer win
            } else {
                statusMessage.style.color = 'white'; // Default game over color
            }
        }
        setDisplay(meetingRoom, 'none'); // Ensure meeting room hidden
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

async function loadAssets() {
    await Promise.all([
        loadImage('map', '/public/img/Map.png'),
        loadImage('character', '/public/img/Character.png'),
        loadImage('deadCharacter', '/public/img/Dead Character.png'),
        loadImage('task_unfinished', '/public/img/Unfinished Task.png'),
        loadImage('task_finished', '/public/img/Finished Task.png'),
        loadImage('emergency_button', '/public/img/Emergency Button.png') // Load button image
    ]);

    const mapImg = images.map;
    if (mapImg) {
        mapWidthClient = mapImg.naturalWidth;
        mapHeightClient = mapImg.naturalHeight;
    } else {
         console.error("Map image not found after load! Client collision bounds check might fail.");
    }

    // --- ADDED: Check if task images loaded ---
    if (!images.task_unfinished || !images.task_finished) {
         console.warn("Task images failed to load. Tasks might not be visible.");
         // Depending on importance, could throw an error here
    }

    assetsLoaded = true;
}

function gameLoop() {
    // --- PAUSE game loop if in meeting --- 
    if (!assetsLoaded || (roomStatus !== 'playing' && roomStatus !== 'game_over')) { // Also allow loop for game_over for potential spectating?
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
    if (currentPlayer && !amIDead) {
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
    // Ignore input if dead
    if (amIDead) return;

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
        await loadAssets();
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

initGame();
