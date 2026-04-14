const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const resetBtn = document.getElementById('resetBtn');
const roomListUI = document.getElementById('roomList');
const reconnectOverlay = document.getElementById('reconnectOverlay');

let peer, conn, isHost = false, gameStarted = false;
let ballParticles = [], bgParticles = [], eventsFX = [];
let lastMsgTime = Date.now();
let currentRoomFullId = "";
const PRE = "FX-"; 

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "#333", trail: "#555", goalColor: "#34c759", fx: "none" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", trail: "#fff", glow: 15, goalColor: "#ff0", fx: "neon" },
    { bg: "#1a0f2e", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", trail: "#ff71ce", goalColor: "#0f0", fx: "retro" },
    { bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.2)", trail: "rgba(255,255,255,0.4)", goalColor: "#fff", fx: "grass" },
    { bg: "#081c08", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", trail: "#81c784", goalColor: "#e91e63", fx: "forest" },
    { bg: "#140d02", wall: "#5d4037", p1: "#ffd54f", p2: "#3e2723", ball: "#ffeb3b", line: "#6d4c41", trail: "#ffd54f", goalColor: "#03a9f4", fx: "tomb" },
    { bg: "#0d0000", wall: "#800", p1: "#ffeb3b", p2: "#d50000", ball: "#ff9100", line: "#ff4500", trail: "#ff4500", glow: 15, goalColor: "#fff", fx: "lava" },
    { bg: "#02020a", wall: "#1a237e", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.1)", trail: "#fff", goalColor: "#fee715", fx: "space" },
    { bg: "#010816", wall: "#00ff41", p1: "#fee715", p2: "#ff00a0", ball: "#00ff41", line: "#001a00", trail: "#00ff41", goalColor: "#fff", fx: "cyber" }
];

let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0, skin: 0 };
let lastBallPos = { x: 200, y: 300 };

class Particle {
    constructor(x, y, color, size, vx, vy, life) {
        this.x = x; this.y = y; this.color = color; this.size = size;
        this.vx = vx; this.vy = vy; this.life = life; this.maxLife = life;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
}

// Инициализация PeerJS
function initPeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        document.getElementById('status').style.display = 'none';
        document.getElementById('setupActions').style.display = 'block';
        refreshLobby();
    });
    peer.on('error', (err) => {
        console.error(err);
        if(err.type === 'peer-unavailable') { alert("Комната не найдена"); }
    });
}

// Логика Лобби
function refreshLobby() {
    if (!peer || peer.destroyed) return;
    peer.listAllPeers((peers) => {
        if (!peers) { roomListUI.innerText = "Сервер скрыл список"; return; }
        const rooms = peers.filter(id => id.startsWith(PRE));
        roomListUI.innerHTML = rooms.length ? "" : "Нет активных комнат";
        rooms.forEach(id => {
            const code = id.replace(PRE, "");
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `<span class="room-code">${code}</span><button class="btn-fast" onclick="autoJoin('${id}')">ПОДКЛЮЧИТЬСЯ</button>`;
            roomListUI.appendChild(div);
        });
    });
}
setInterval(refreshLobby, 5000);

function autoJoin(fullId) {
    const code = fullId.replace(PRE, "");
    document.getElementById('joinId').value = code;
    setTimeout(() => { document.getElementById('manualJoinBtn').click(); }, 1000);
}

function changeSkin(val) { if(isHost) game.skin = parseInt(val); }

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    currentRoomFullId = PRE + shortId;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(currentRoomFullId);
        peer.on('open', id => { showUI(shortId); resetBtn.style.display = 'block'; });
        peer.on('connection', c => { conn = c; bindConn(); });
    }, 300);
}

function joinRoom() {
    const code = document.getElementById('joinId').value.toUpperCase().trim();
    if(code.length < 3) return;
    isHost = false;
    currentRoomFullId = PRE + code;
    conn = peer.connect(currentRoomFullId);
    bindConn();
}

function bindConn() {
    conn.on('open', () => {
        lastMsgTime = Date.now();
        reconnectOverlay.style.display = 'none';
        showUI(currentRoomFullId.replace(PRE, ""));
        if(isHost) {
            document.getElementById('hostControls').style.display = 'block';
            document.getElementById('skinSelectorContainer').style.display = 'block';
        }
        setupLoops();
    });
    conn.on('data', data => {
        lastMsgTime = Date.now();
        if (data.type === 'START') setGameStartedUI();
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        else { game = data.state; if(data.started && !gameStarted) setGameStartedUI(); }
    });
}

function showUI(id) { document.getElementById('menu').style.display = 'none'; document.getElementById('gameUI').style.display = 'block'; displayId.innerText = id; }
function setupLoops() { requestAnimationFrame(gameLoop); }
function setGameStartedUI() { gameStarted = true; displayId.classList.replace('id-large', 'id-small'); }

function sendStartSignal() {
    gameStarted = true; setGameStartedUI();
    document.getElementById('hostControls').style.display = 'none';
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

const handleInput = (e) => {
    if(!gameStarted || reconnectOverlay.style.display === 'flex') return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = Math.max(25, Math.min(375, x)); game.p1.y = Math.max(320, Math.min(575, y)); }
    else if (conn && conn.open) conn.send({ x: Math.max(25, Math.min(375, x)), y: Math.max(320, Math.min(575, y)) });
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    if (game.ball.x < 16 || game.ball.x > 384) { game.ball.x = game.ball.x < 16 ? 16 : 384; game.ball.vx *= -0.8; }
    if (game.ball.y < 16) {
        if (game.ball.x > 135 && game.ball.x < 265) { if (game.ball.y < -20) { game.score1++; manualBallReset(); } }
        else { game.ball.y = 16; game.ball.vy *= -0.8; }
    }
    if (game.ball.y > 584) {
        if (game.ball.x > 135 && game.ball.x < 265) { if (game.ball.y > 620) { game.score2++; manualBallReset(); } }
        else { game.ball.y = 584; game.ball.vy *= -0.8; }
    }
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx), s = Math.min(Math.sqrt(game.ball.vx**2+game.ball.vy**2)+7, 15);
            game.ball.vx = Math.cos(a)*s; game.ball.vy = Math.sin(a)*s;
        }
    });
    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn && conn.open) conn.send({ state: game, started: true });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    ctx.strokeStyle = s.goalColor; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(135, 5); ctx.lineTo(265, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 595); ctx.lineTo(265, 595); ctx.stroke();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y}, op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.ball; ctx.beginPath(); ctx.arc(game.ball.x, isHost?game.ball.y:600-game.ball.y, 12, 0, 7); ctx.fill();

    if (!gameStarted) { ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600); ctx.fillStyle = "#fff"; ctx.fillText(isHost?"ЖМИ СТАРТ":"ЖДЕМ ХОСТА...", 160, 300); }
}

function gameLoop() {
    if (gameStarted && Date.now() - lastMsgTime > 3000) reconnectOverlay.style.display = 'flex';
    else { update(); draw(); }
    requestAnimationFrame(gameLoop);
}

initPeer();
