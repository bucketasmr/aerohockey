const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const resumeBtn = document.getElementById('resumeBtn');
const statusEl = document.getElementById('status');

let peer, conn, isHost = false, gameStarted = false, isPaused = false;
let lastPacketTime = Date.now();
let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0, skin: 0 };

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", goal: "#34c759" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", glow: 15, goal: "#ff0" },
    { bg: "#1a0f2e", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", goal: "#0f0" },
    { bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", goal: "#fff" },
    { bg: "#0d0000", wall: "#800", p1: "#ffeb3b", p2: "#d50000", ball: "#ff9100", glow: 15, goal: "#fff" },
    { bg: "#010816", wall: "#00ff41", p1: "#fee715", p2: "#ff00a0", ball: "#00ff41", goal: "#fff" }
];

// УЛЬТРА-КОНФИГУРАЦИЯ ДЛЯ ОБХОДА БЛОКИРОВОК (TURN СЕРВЕРЫ)
const peerConfig = {
    debug: 2,
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }
        ],
        'iceCandidatePoolSize': 10
    }
};

function init() {
    peer = new Peer(peerConfig);
    peer.on('open', (id) => {
        statusEl.innerText = "СЕТЬ ГОТОВА";
        document.getElementById('setup').style.display = 'block';
    });
    peer.on('error', (err) => {
        console.error('Peer error:', err.type);
        statusEl.innerText = "Ошибка: " + err.type;
        if(err.type === 'network' || err.type === 'disconnected') peer.reconnect();
    });
}
init();

function changeSkin(v) { if(isHost) game.skin = parseInt(v); }

function createRoom() {
    isHost = true;
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(roomCode, peerConfig);
        peer.on('open', id => {
            document.getElementById('menu').style.display = 'none';
            document.getElementById('gameUI').style.display = 'flex';
            document.getElementById('hostUI').style.display = 'block';
            document.getElementById('roomCodeDisplay').innerText = "КОД: " + id;
        });
        peer.on('connection', c => {
            conn = c;
            handleConnection();
        });
    }, 500);
}

function joinRoom() {
    const code = document.getElementById('joinId').value.toUpperCase().trim();
    if(!code) return;
    isHost = false;
    statusEl.innerText = "ПОДКЛЮЧЕНИЕ...";
    conn = peer.connect(code, { reliable: true });
    conn.on('open', () => {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'flex';
        document.getElementById('roomCodeDisplay').innerText = "ИГРОК 2 | ПОДКЛЮЧЕНО";
        handleConnection();
    });
    setTimeout(() => { if(!conn.open) statusEl.innerText = "НЕ УДАЛОСЬ ЗАЙТИ (TIMEOUT)"; }, 8000);
}

function handleConnection() {
    conn.on('data', data => {
        lastPacketTime = Date.now();
        if (data.type === 'SIGNAL_START') { gameStarted = true; isPaused = false; resumeBtn.style.display = 'none'; }
        if (data.type === 'SIGNAL_PAUSE') { isPaused = true; }
        
        if (isHost) {
            if(data.x !== undefined) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        } else {
            if(data.state) game = data.state;
            gameStarted = data.started;
            isPaused = data.paused;
        }
    });
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameStarted = true;
    isPaused = false;
    setInterval(() => {
        if(conn && conn.open && !isPaused) conn.send({ type: 'SIGNAL_START' });
    }, 1000);
}

function resumeGame() {
    isPaused = false;
    resumeBtn.style.display = 'none';
    if(conn && conn.open) conn.send({ type: 'SIGNAL_START' });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isHost && gameStarted) {
        isPaused = true;
        if(conn && conn.open) conn.send({ type: 'SIGNAL_PAUSE' });
    } else if (!document.hidden && isHost && gameStarted) {
        resumeBtn.style.display = 'block';
    }
});

canvas.addEventListener('touchmove', e => {
    if (isPaused || !gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = x; game.p1.y = Math.max(320, y); }
    else if (conn && conn.open) conn.send({ x: x, y: y });
}, {passive: false});

function update() {
    if (!isHost || !gameStarted || isPaused) return;
    if (Date.now() - lastPacketTime > 5000) { isPaused = true; return; }

    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    if (game.ball.x < 15 || game.ball.x > 385) { game.ball.vx *= -1; game.ball.x = game.ball.x < 15 ? 15 : 385; }
    
    if (game.ball.y < 5 || game.ball.y > 595) {
        if (game.ball.x > 130 && game.ball.x < 270) {
            if (game.ball.y < -15 || game.ball.y > 615) {
                if (game.ball.y < 0) game.score2++; else game.score1++;
                game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
            }
        } else { game.ball.vy *= -1; game.ball.y = game.ball.y < 5 ? 5 : 595; }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 38) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 2;
            game.ball.vx = Math.cos(angle) * Math.min(speed, 11);
            game.ball.vy = Math.sin(angle) * Math.min(speed, 11);
            game.ball.x = p.x + Math.cos(angle) * 39;
            game.ball.y = p.y + Math.sin(angle) * 39;
        }
    });
    game.ball.vx *= 0.985; game.ball.vy *= 0.985;
    if (conn && conn.open) conn.send({ state: game, started: gameStarted, paused: isPaused });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    ctx.strokeStyle = s.wall; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 394, 594);
    ctx.lineWidth = 10; ctx.strokeStyle = s.goal;
    ctx.beginPath(); ctx.moveTo(130, 5); ctx.lineTo(270, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(130, 595); ctx.lineTo(270, 595); ctx.stroke();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    let bPos = { x: game.ball.x, y: isHost ? game.ball.y : 600 - game.ball.y };

    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.p1; }
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.ball; ctx.beginPath(); ctx.arc(bPos.x, bPos.y, 12, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;

    const lag = Date.now() - lastPacketTime;
    if (!gameStarted || isPaused || (!isHost && lag > 4000)) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        let msg = !gameStarted ? (isHost ? "ОЖИДАНИЕ ИГРОКА" : "ЖДЕМ ХОСТА...") : "ЖДЕМ ХОСТА...";
        ctx.fillText(msg, 200, 300);
    }
}

function gameLoop() { 
    update(); draw(); 
    if (conn && conn.open) requestAnimationFrame(gameLoop); 
}
