const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const roomListUI = document.getElementById('roomList');

let peer, conn, isHost = false, gameStarted = false, isVisible = false;
let lastMsgTime = Date.now();
const PRE = "AHFX-"; // Стабильный префикс

let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0, skin: 0 };

// 1. Инициализация Peer происходит ОДИН РАЗ
function init() {
    // Генерируем случайный ID сразу при входе
    const myShortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer = new Peer(PRE + myShortId);

    peer.on('open', (id) => {
        document.getElementById('status').style.display = 'none';
        document.getElementById('setupActions').style.display = 'block';
        document.getElementById('displayId').innerText = myShortId;
        console.log("Мой ID:", id);
        setInterval(refreshLobby, 3000);
    });

    peer.on('connection', (c) => {
        conn = c;
        isHost = true; // Если к нам подключились, мы хост
        setupConn();
    });

    peer.on('error', (err) => {
        console.error("Ошибка Peer:", err.type);
        if(err.type === 'peer-unavailable') alert("Игрок не найден. Проверь код.");
    });
}

function refreshLobby() {
    if (!peer || peer.destroyed || gameStarted) return;
    peer.listAllPeers((peers) => {
        if (!peers) return;
        const rooms = peers.filter(id => id.startsWith(PRE) && id !== peer.id);
        roomListUI.innerHTML = rooms.length ? "" : "Нет активных комнат";
        rooms.forEach(id => {
            const code = id.replace(PRE, "");
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `<span>${code}</span><button class="btn-fast" onclick="autoJoin('${id}')">ВХОД</button>`;
            roomListUI.appendChild(div);
        });
    });
}

function autoJoin(fullId) {
    document.getElementById('joinId').value = fullId.replace(PRE, "");
    joinRoom();
}

function createRoom() {
    // В этой версии мы просто открываем интерфейс ожидания
    isHost = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    document.getElementById('hostPreMenu').style.display = 'block';
}

function joinRoom() {
    const code = document.getElementById('joinId').value.toUpperCase().trim();
    if(!code) return;
    conn = peer.connect(PRE + code);
    isHost = false;
    setupConn();
}

function setupConn() {
    conn.on('open', () => {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'block';
        document.getElementById('gameArea').style.display = 'block';
        lastMsgTime = Date.now();
        if(!isHost) document.getElementById('displayId').classList.replace('id-large', 'id-small');
        requestAnimationFrame(gameLoop);
    });

    conn.on('data', (data) => {
        lastMsgTime = Date.now();
        if (data.type === 'START') {
            gameStarted = true;
            document.getElementById('displayId').classList.replace('id-large', 'id-small');
            document.getElementById('hostPreMenu').style.display = 'none';
        }
        if (isHost) {
            game.p2.x = data.x; game.p2.y = 600 - data.y;
        } else {
            game = data.state;
            gameStarted = data.started;
        }
    });
}

function toggleVisibility() {
    // В этой версии мы всегда "видимы", если наш ID начинается с PRE
    // Но можем добавить флаг, если нужно. Для простоты - сейчас работает всегда.
    alert("Вы теперь видны в списке всех игроков!");
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostPreMenu').style.display = 'none';
    if(conn) conn.send({ type: 'START' });
}

function changeSkin(v) { game.skin = parseInt(v); }

// Управление
const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) {
        game.p1.x = x; game.p1.y = Math.max(310, y);
    } else if (conn) {
        conn.send({ x, y });
    }
};
canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    
    // Физика (упрощенная для стабильности)
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;
    if (game.ball.y < 15 || game.ball.y > 585) {
        if (game.ball.x > 130 && game.ball.x < 270) {
            if(game.ball.y < 0) game.score2++;
            if(game.ball.y > 600) game.score1++;
            game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
        } else {
            game.ball.vy *= -1;
        }
    }
    
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y;
        if (Math.sqrt(dx*dx+dy*dy) < 35) {
            game.ball.vx = (game.ball.x - p.x) * 0.2;
            game.ball.vy = (game.ball.y - p.y) * 0.2;
        }
    });
    
    if(conn) conn.send({ state: game, started: gameStarted });
}

function draw() {
    ctx.fillStyle = "#111"; ctx.fillRect(0,0,400,600);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 2;
    ctx.strokeRect(5,5,390,590);
    ctx.beginPath(); ctx.moveTo(0,300); ctx.lineTo(400,300); ctx.stroke();
    
    // Ворота
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 8;
    ctx.strokeRect(135, 0, 130, 5); ctx.strokeRect(135, 595, 130, 5);

    scoreDisplay.innerText = `${game.score1} : ${game.score2}`;
    
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600-game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600-game.p1.y};
    let bx = isHost ? game.ball.x : game.ball.x;
    let by = isHost ? game.ball.y : 600 - game.ball.y;

    ctx.fillStyle = "#007aff"; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, 12, 0, 7); ctx.fill();
}

function gameLoop() {
    update(); draw();
    if (gameStarted && Date.now() - lastMsgTime > 4000) {
        document.getElementById('reconnectOverlay').style.display = 'flex';
    }
    requestAnimationFrame(gameLoop);
}

init();
