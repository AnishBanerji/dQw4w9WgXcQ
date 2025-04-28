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
    // Instructions visibility controlled by waitingRoom visibility

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
    } else { // Loading or error
        setDisplay(waitingRoom, 'flex');
        if (statusMessage) statusMessage.textContent = 'Loading room...';
    }

    // Update Room Code display text
    if (roomCodeDisplay) {
        const roomId = getRoomIdFromUrl(); // Get current room ID
        roomCodeDisplay.textContent = `Room Code: ${roomId || 'N/A'}`;
    }
}

async function loadAssets() {
    await Promise.all([
        loadImage('map', '/public/img/Map.png'),
        loadImage('character', '/public/img/Character.png'),
        loadImage('deadCharacter', '/public/img/Dead Character.png'),
        // --- ADDED: Load Task Images ---
        loadImage('task_unfinished', '/public/img/Unfinished Task.png'),
        loadImage('task_finished', '/public/img/Finished Task.png')
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
    if (!assetsLoaded || roomStatus !== 'playing') {
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
    }
    // --- End Draw Tasks --- 

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

    // --- Kill Attempt --- 
    if (event.code === 'Space' && isKiller && roomStatus === 'playing') {
        // console.log("Attempting kill...");
        const roomId = getRoomIdFromUrl();
        socket.emit('attempt_kill', { room_id: roomId });
        event.preventDefault(); 
    }

    // --- Task Attempt (Changed from E to Space for non-killers) --- 
    if (event.code === 'Space' && !isKiller && roomStatus === 'playing') {
        const currentPlayer = players[myPlayerId];
        if (!currentPlayer) return; // Should exist if playing

        let nearestIncompleteTaskDistSq = Infinity;
        let foundNearbyTask = false;

        tasks.forEach(task => {
            if (!task.completed) {
                const distSq = (currentPlayer.x - task.x)**2 + (currentPlayer.y - task.y)**2;
                if (distSq < TASK_RADIUS_CLIENT_SQ) {
                     nearestIncompleteTaskDistSq = distSq; 
                     foundNearbyTask = true;
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
             // console.log("Pressed Space, but no incomplete task nearby or is killer.");
        }
    }
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

initGame();
