// TODO: For deployment, conditionally use 'wss://' + window.location.host based on 'https://' protocol
// Example: const socketUrl = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
// const socket = io(socketUrl);
const socket = io(); // Connect to the Socket.IO server

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Dynamically Create UI Elements ---
function createUI() {
    // Waiting Room Container
    const waitingRoomDiv = document.createElement('div');
    waitingRoomDiv.id = 'waiting-room';
    waitingRoomDiv.classList.add('overlay-element'); // Add base class
    // Keep position/transform inline as they define placement
    waitingRoomDiv.style.position = 'absolute'; 
    waitingRoomDiv.style.top = '50%';
    waitingRoomDiv.style.left = '50%';
    waitingRoomDiv.style.transform = 'translate(-50%, -50%)';
    // display is controlled dynamically
    waitingRoomDiv.style.display = 'none'; 

    // Status Message
    const statusMessage = document.createElement('p');
    statusMessage.id = 'status-message';
    statusMessage.innerText = 'Connecting...'; // Styles handled by CSS
    waitingRoomDiv.appendChild(statusMessage);

    // Player List
    const playerList = document.createElement('ul');
    playerList.id = 'player-list'; // Styles handled by CSS
    waitingRoomDiv.appendChild(playerList);

    // Start Game Button
    const startGameBtn = document.createElement('button');
    startGameBtn.id = 'start-game-btn';
    startGameBtn.innerText = 'Start Game'; // Styles handled by CSS
    startGameBtn.style.display = 'none'; // Controlled dynamically
    startGameBtn.onclick = () => {
        const roomId = getRoomIdFromUrl();
        socket.emit('start_game', { room_id: roomId });
    };
    waitingRoomDiv.appendChild(startGameBtn);

    // Game Over Button Container
    const gameOverControlsDiv = document.createElement('div');
    gameOverControlsDiv.id = 'game-over-controls';
    gameOverControlsDiv.style.display = 'none'; // Controlled dynamically

    const backHomeBtn = document.createElement('button');
    backHomeBtn.innerText = 'Back to Home'; // Styles handled by CSS
    backHomeBtn.onclick = () => { window.location.href = '/'; };
    gameOverControlsDiv.appendChild(backHomeBtn);

    waitingRoomDiv.appendChild(gameOverControlsDiv);

    // Killer Info Area
    const killerInfoDiv = document.createElement('div');
    killerInfoDiv.id = 'killer-info';
    killerInfoDiv.classList.add('overlay-element'); // Add base class
    // Keep position inline
    killerInfoDiv.style.position = 'absolute'; 
    killerInfoDiv.style.top = '80px'; // Adjusted in CSS, keep consistency?
    killerInfoDiv.style.left = '10px';
    killerInfoDiv.style.display = 'none'; // Controlled dynamically
    killerInfoDiv.innerText = 'YOU ARE THE KILLER'; // Text content
    // Styles like background, color, padding, font-weight are in CSS

    // You Died Popup
    const youDiedDiv = document.createElement('div');
    youDiedDiv.id = 'you-died-popup';
    youDiedDiv.classList.add('overlay-element'); // Add base class
    // Keep position/transform inline
    youDiedDiv.style.position = 'absolute'; 
    youDiedDiv.style.top = '50%';
    youDiedDiv.style.left = '50%';
    youDiedDiv.style.transform = 'translate(-50%, -50%)';
    youDiedDiv.style.display = 'none'; // Controlled dynamically
    youDiedDiv.style.zIndex = '1000'; // Keep z-index inline
    youDiedDiv.innerHTML = 'YOU DIED<br><span style="font-size: 20px; color: #ccc;">Spectating...</span>'; // Inner HTML, span styles kept inline for simplicity or move to CSS
    // Base styles like background, color, font-size, padding are in CSS

    // --- ADDED: Task Progress Indicator ---
    const taskProgressDiv = document.createElement('div');
    taskProgressDiv.id = 'task-progress';
    taskProgressDiv.classList.add('overlay-element'); // Use base style
    taskProgressDiv.style.position = 'absolute'; // Positioning
    taskProgressDiv.style.top = '10px';
    taskProgressDiv.style.right = '10px';
    taskProgressDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Keep some background
    taskProgressDiv.style.padding = '8px 15px';
    taskProgressDiv.style.display = 'none'; // Hidden initially
    taskProgressDiv.innerText = 'Tasks: 0/0';

    document.body.appendChild(waitingRoomDiv);
    document.body.appendChild(killerInfoDiv);
    document.body.appendChild(youDiedDiv);
    document.body.appendChild(taskProgressDiv); // Add task progress to body
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
    const waitingRoomDiv = document.getElementById('waiting-room');
    const playerListUl = document.getElementById('player-list');
    const startGameBtn = document.getElementById('start-game-btn');
    const statusMessageP = document.getElementById('status-message');
    const killerInfoDiv = document.getElementById('killer-info');
    const gameCanvas = document.getElementById('gameCanvas');
    const taskProgressDiv = document.getElementById('task-progress'); // Get task progress element

    if (!waitingRoomDiv || !playerListUl || !startGameBtn || !statusMessageP || !killerInfoDiv || !gameCanvas || !taskProgressDiv) {
        console.error("UI elements not found!");
        return;
    }

    // Killer Info visibility
    killerInfoDiv.style.display = isKiller ? 'block' : 'none';

    // Task Progress visibility
    taskProgressDiv.style.display = (roomStatus === 'playing') ? 'block' : 'none';
    if (roomStatus === 'playing') {
        taskProgressDiv.innerText = `Tasks: ${completedTasks}/${totalTasks}`;
    }

    if (roomStatus === 'waiting') {
        gameCanvas.style.display = 'none';
        waitingRoomDiv.style.display = 'block';
        statusMessageP.innerText = 'Waiting for players...';

        // Update player list
        playerListUl.innerHTML = ''; // Clear previous list
        allPlayersList.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.username}${p.isHost ? ' (Host)' : ''}${p.id === myPlayerId ? ' (You)' : ''}`;
            if (p.id === myPlayerId) li.style.fontWeight = 'bold';
            playerListUl.appendChild(li);
        });

        // Show/hide start button
        const canStart = isHost && allPlayersList.length >= 2;
        startGameBtn.style.display = canStart ? 'block' : 'none';
        startGameBtn.disabled = !canStart;
        if (isHost && allPlayersList.length < 2) {
            statusMessageP.innerText = 'Waiting for more players to join... (Need at least 2)';
        } else if (isHost) {
             statusMessageP.innerText = 'Waiting for you (Host) to start the game.';
        } else {
            statusMessageP.innerText = 'Waiting for the host to start the game...';
        }

    } else if (roomStatus === 'playing') {
        waitingRoomDiv.style.display = 'none';
        gameCanvas.style.display = 'block';
        // No specific status message needed here, game is running
    } else if (roomStatus === 'game_over') {
        gameCanvas.style.display = 'none'; // Or keep showing final state?
        waitingRoomDiv.style.display = 'block'; // Re-show waiting room elements for message
        startGameBtn.style.display = 'none'; // Hide start button
        // statusMessageP will be set by the game_over event handler
        // Keep player list updated
        playerListUl.innerHTML = ''; // Clear previous list
        allPlayersList.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.username}${p.isHost ? ' (Host)' : ''}${p.id === myPlayerId ? ' (You)' : ''}`;
            if (p.id === myPlayerId) li.style.fontWeight = 'bold';
            playerListUl.appendChild(li);
        });

    } else { // loading or error
        gameCanvas.style.display = 'none';
        waitingRoomDiv.style.display = 'block';
        startGameBtn.style.display = 'none';
        playerListUl.innerHTML = ''; // Clear list
        // statusMessageP text set by specific events like connect/join_error
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
        console.log("Attempting kill...");
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
            console.log("Attempting task with Space bar...");
            const roomId = getRoomIdFromUrl();
            socket.emit('attempt_task', { room_id: roomId });
            event.preventDefault(); // Prevent default Space bar behavior (e.g., scrolling)
        } else {
             console.log("Pressed Space, but no incomplete task nearby or is killer.");
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
    console.log(`Setting up Socket listeners for room: ${roomId}`);

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
        console.log('Connected to server!');
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) statusMessageP.innerText = 'Joining room...';
        socket.emit('join_room', { room_id: roomId });
        roomStatus = 'loading'; // Reset status on connect/reconnect
        isKiller = false; // Reset killer status
        isHost = false;
        updateUI();
    });

    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from server: ${reason}`);
        players = {};
        myPlayerId = null;
        roomStatus = 'error';
        isKiller = false;
        isHost = false;
        allPlayersList = [];
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) statusMessageP.innerText = `Disconnected: ${reason}. Please refresh.`;
        updateUI();
    });

    socket.on('join_error', (data) => {
        console.error('Join Error:', data.message);
        roomStatus = 'error';
        const statusMessageP = document.getElementById('status-message');
        if (statusMessageP) statusMessageP.innerText = `Failed to join: ${data.message}`;
        updateUI();
    });

    // Received when YOU successfully join/rejoin
    socket.on('current_state', (data) => {
        console.log('Received current state:', data);
        myPlayerId = data.your_id;
        roomStatus = data.status;
        players = data.players_positions || {}; // Start with position data
        allPlayersList = data.all_players_list || [];
        amIDead = false; // Reset dead status on join

        // Merge is_dead status into local players object
        allPlayersList.forEach(playerInfo => {
            if (players[playerInfo.id]) {
                players[playerInfo.id].is_dead = playerInfo.is_dead;
                players[playerInfo.id].username = playerInfo.username; // Ensure username is updated
            } else if (playerInfo.id === myPlayerId) { 
                // If own position data wasn't in players_positions (unlikely), add self
                // This might happen if DB state is inconsistent briefly
                players[playerInfo.id] = { 
                    x: 1800, y: 1800, angle: -Math.PI/2, // Use defaults
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

        // Determine if host
        const hostPlayer = allPlayersList.find(p => p.isHost);
        isHost = hostPlayer ? hostPlayer.id === myPlayerId : false;

        // console.log(`My ID: ${myPlayerId}, Host: ${isHost}, Status: ${roomStatus}, Dead: ${amIDead}`);
        // console.log("Initial players state (with is_dead merged):", players); // Log initial positions

        updateUI();

        // If already playing when joined (and not dead), start the loop
        if (roomStatus === 'playing' && assetsLoaded && !amIDead) {
            requestAnimationFrame(gameLoop); // Start drawing/updates
        }
    });

    // Received when anyone joins or leaves (updates waiting room list)
    socket.on('room_update', (data) => {
        // console.log('Received room update:', data);
        roomStatus = data.status; // Keep status in sync
        allPlayersList = data.all_players_list || [];

         // Update host status based on the new list
        const hostPlayer = allPlayersList.find(p => p.isHost);
        isHost = hostPlayer ? hostPlayer.id === myPlayerId : false;

        // NOTE: This event currently only sends the player list, not positions.
        // If a player joins *after* the game started (e.g., spectator mode later),
        // we might need to handle adding their position info here or via another event.
        // For now, relies on 'current_state' and 'game_started' for positions.

        updateUI();
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
        console.log('Game started:', data);
        roomStatus = 'playing';
        players = data.players_positions || {}; 
        allPlayersList = data.all_players_list || [];
        
        // --- ADDED: Store Task Info --- 
        tasks = data.tasks || [];
        totalTasks = data.totalTasks || 0;
        completedTasks = data.completedTasks || 0;
        console.log(`Tasks Initialized: ${completedTasks}/${totalTasks}`, tasks);

        // Determine if host
        const hostPlayer = allPlayersList.find(p => p.isHost);
        isHost = hostPlayer ? hostPlayer.id === myPlayerId : false;

        console.log(`My ID: ${myPlayerId}, Host: ${isHost}, Status: ${roomStatus}`);
        console.log("Initial players positions:", players); 

        updateUI(); // Update UI including task progress

        // Start the game loop
        if (assetsLoaded) {
            requestAnimationFrame(gameLoop); 
        }
    });

    socket.on('you_are_killer', () => {
        console.log("You are the killer!");
        isKiller = true;
        updateUI(); // Show killer info
    });

    socket.on('player_died', (data) => {
        console.log("Player died event received: Victim ID", data.victim_id);
        if (players[data.victim_id]) {
            players[data.victim_id].is_dead = true;
            console.log(`Marked player ${data.victim_id} as dead locally.`);
        } else {
             console.warn(`Received player_died for unknown ID: ${data.victim_id}`);
        }
        // Update visual state in the next game loop draw
    });

    // --- ADDED: You Died Handler ---
    socket.on('you_died', () => {
        console.log("Received 'you_died' event!");
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
        console.log("Input disabled due to death.");
    });

    // --- ADDED: Task Completed Handler ---
    socket.on('task_completed', (data) => {
        console.log(`Task Completed event: ID=${data.task_id}, New Count=${data.completedTasks}/${data.totalTasks}`);
        // Update local task state
        const taskIndex = tasks.findIndex(t => t.id === data.task_id);
        if (taskIndex !== -1) {
            tasks[taskIndex].completed = true;
        }
        // Update overall counts
        completedTasks = data.completedTasks;
        totalTasks = data.totalTasks; // Keep total in sync just in case
        
        updateUI(); // Update the task progress display
    });

    socket.on('game_over', (data) => {
        console.log('Game Over:', data);
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

        if (statusMessageP) {
            let finalMessage = data.message || 'Game Over!';
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
        
        // No need to call updateUI() here as we manually set the state
        // Resetting local flags like isKiller isn't strictly necessary as the page will redirect
        // isKiller = false;
        // isHost = false;
    });
}

async function initGame() {
    createUI();
    setupInputListeners();
    setupSocketListeners(getRoomIdFromUrl());

    try {
        await loadAssets();
        console.log("Assets loaded!");
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
