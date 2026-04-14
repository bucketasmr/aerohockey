const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const roomListUI = document.getElementById('roomList');
const qJoinBtn = document.getElementById('quickJoinBtn');

let peer, conn, isHost = false, gameStarted = false;
let myId = "";
let fastRoomId = null;
const PRE = "FXHOCKEY-"; // Уникальный префикс для поиска друг друга

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0
};

// --- СЕТЕВАЯ ЛОГИКА ---

function init() {
    // Создаем ID один раз при загрузке
    myId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer = new Peer(PRE + myId);

    peer.on('open', (id) => {
        document.getElementById('status').style.display = 'none';
        document.getElementById('setupActions').style.display = 'block';
        setInterval(refreshLobby, 3000); // Опрос сервера каждые 3 сек
    });

    peer.on('connection', (c) => {
        if (conn) return; // Не пускать третьего
        conn = c;
        isHost = true;
        setupConnection();
    });

    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') alert("Ошибка: Комната не найдена.");
    });
}

function refreshLobby() {
    if (gameStarted || !peer || peer.destroyed) return;

    peer.listAllPeers((peers) => {
        if (!peers) return;
        
        // Находим все комнаты кроме своей
        const rooms = peers.filter(id => id.startsWith(PRE) && id !== (PRE + myId));

        if (rooms.length > 0) {
            fastRoomId = rooms[0];
            qJoinBtn.style.background = "#34c759";
            qJoinBtn.innerText = `БЫСТРАЯ ИГРА (${rooms.length})`;
            
            roomListUI.innerHTML = "";
            rooms.forEach(id => {
                const code = id.replace(PRE, "");
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `<span class="room-code">${code}</span>
                                 <button style="padding:4px 8px;" onclick="joinByCode('${code}')">ВХОД</button>`;
                roomListUI.appendChild(div);
            });
        } else {
            fastRoomId = null;
            qJoinBtn.style.background = "#ff3b30";
            qJoinBtn.innerText = "НЕТ СВОБОДНЫХ ИГР";
            roomListUI.innerHTML = "Поиск...";
        }
    });
}

function createRoom() {
    isHost = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'flex';
    document.getElementById('hostControls').style.display = 'flex';
    document.getElementById('roomCodeDisplay').innerText = myId;
}

function quickJoin() {
    if (fastRoomId) {
        conn = peer.connect(fastRoomId);
        isHost = false;
        setupConnection();
    }
}

function joinByCode(customCode) {
    const code = customCode || document.getElementById('manualId').value.toUpperCase().trim();
    if (!code) return;
    conn = peer.connect(PRE + code);
    isHost = false;
    setupConnection();
}

function setupConnection() {
    conn.on('open', () => {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'flex';
        document.getElementById('overlayText').innerText = isHost ? "ИГРОК ПОДКЛЮЧИЛСЯ" : "ОЖИДАНИЕ ХОСТА...";
        if (!isHost) document.getElementById('roomCodeDisplay').innerText = "";
        
        requestAnimationFrame(gameLoop);
    });

    conn.on('data', (data) => {
        if (data.type === 'START') {
            gameStarted = true;
            document.getElementById('msgOverlay').style.display = 'none';
        }
        if (isHost) {
            game.p2.x = data.x;
            game.p2.y = 600 - data.y;
        } else {
            game = data.state;
            if (data.started) {
                gameStarted = true;
                document.getElementById('msgOverlay').style.display = 'none';
            }
        }
    });
}

function startGame() {
    if (!conn) return;
    gameStarted = true;
    document.getElementById('msgOverlay').style.display = 'none';
    conn.send({ type: 'START' });
}

// --- ИГРОВАЯ ЛОГИКА ---

const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);

    if (isHost) {
        game.p1.x = x; game.p1.y = Math.max(320, y);
    } else if (conn && conn.open) {
        conn.send({ x, y });
    }
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;

    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Стены
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;
    
    // Ворота
    if (game.ball.y < 15 || game.ball.y > 585) {
        if (game.ball.x > 130 && game.ball.x < 270) {
            if (game.ball.y < 0) { game.score2++; resetBall(); }
            else if (game.ball.y > 600) { game.score1++; resetBall(); }
        } else {
            game.ball.vy *= -1;
        }
    }

    // Физика бит
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 38) {
            let angle = Math.atan2(dy, dx);
            game.ball.vx = Math.cos(angle) * 8;
            game.ball.vy = Math.sin(angle) * 8;
        }
    });

    game.ball.vx *= 0.98;
    game.ball.vy *= 0.98;

    if (conn) conn.send({ state: game, started: gameStarted });
}

function resetBall() {
    game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
}

function draw() {
    ctx.clearRect(0, 0, 400, 600);
    
    // Разметка
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    // Ворота
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 8;
    ctx.strokeRect(135, 0, 130, 5); ctx.strokeRect(135, 595, 130, 5);

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;

    let myPos = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let opPos = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    let bPos = isHost ? game.ball : {x: game.ball.x, y: 600 - game.ball.y};

    // Бита 1
    ctx.fillStyle = "#007aff"; ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 25, 0, 7); ctx.fill();
    // Бита 2
    ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(opPos.x, opPos.y, 25, 0, 7); ctx.fill();
    // Шайба
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bPos.x, bPos.y, 12, 0, 7); ctx.fill();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

init();
