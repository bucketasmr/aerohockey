const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const resetBtn = document.getElementById('resetBtn');
const roomListUI = document.getElementById('roomList');
const reconnectOverlay = document.getElementById('reconnectOverlay');
const hostPreMenu = document.getElementById('hostPreGameMenu');
const visibilityBtn = document.getElementById('visibilityBtn');

let peer, conn, isHost = false, gameStarted = false, isVisible = false;
let ballParticles = [], bgParticles = [], eventsFX = [];
let lastMsgTime = Date.now();
let currentRoomFullId = "";
const PRE = "FX-"; // Наш уникальный префикс для поиска в лобби

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

function initPeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        document.getElementById('status').style.display = 'none';
        document.getElementById('setupActions').style.display = 'block';
        setInterval(refreshLobby, 4000); // Обновляем список игр каждые 4 сек
    });
}

function goBackToMenu() { location.reload(); }

function toggleVisibility() {
    isVisible = !isVisible;
    if(isVisible) {
        visibilityBtn.innerText = "👁 ВИДИМОСТЬ: ВКЛ";
        visibilityBtn.style.background = "#34c759";
    } else {
        visibilityBtn.innerText = "👁 ВИДИМОСТЬ: ВЫКЛ";
        visibilityBtn.style.background = "#ff9500";
    }
}

function refreshLobby() {
    if (!peer || peer.destroyed || gameStarted) return;
    peer.listAllPeers((peers) => {
        if (!peers) { roomListUI.innerHTML = "<span style='opacity:0.4; font-size:10px;'>Лобби недоступно</span>"; return; }
        
        // Фильтруем только те комнаты, которые имеют наш префикс и это не мы сами
        const rooms = peers.filter(id => id.startsWith(PRE) && id !== currentRoomFullId);
        
        if (rooms.length === 0) {
            roomListUI.innerHTML = "<span style='opacity:0.4; font-size:10px;'>Поиск активных игр...</span>";
        } else {
            roomListUI.innerHTML = "";
            rooms.forEach(id => {
                const code = id.replace(PRE, "");
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `<span class="room-code">${code}</span><button class="btn-fast" onclick="autoJoin('${id}')">ВХОД</button>`;
                roomListUI.appendChild(div);
            });
        }
    });
}

function autoJoin(fullId) {
    document.getElementById('joinId').value = fullId.replace(PRE, "");
    document.getElementById('joinId').style.borderColor = "#34c759";
    setTimeout(() => { joinRoom(); }, 800);
}

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    currentRoomFullId = isVisible ? PRE + shortId : shortId; 
    // Если хост сразу хочет быть видимым - используем префикс, 
    // но в нашей логике мы пересоздаем peer при нажатии "Сделать видимой" если нужно. 
    // Для простоты: всегда создаем с PRE, но в списке лобби фильтруем.
    currentRoomFullId = PRE + shortId;

    peer.destroy();
    setTimeout(() => {
        peer = new Peer(currentRoomFullId);
        peer.on('open', id => { 
            showUI(shortId); 
            hostPreMenu.style.display = 'block';
            document.getElementById('hostControls').style.display = 'block';
            document.getElementById('skinSelectorContainer').style.display = 'block';
            resetBtn.style.display = 'block';
        });
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

function setGameStartedUI() { 
    gameStarted = true; 
    displayId.classList.replace('id-large', 'id-small');
    hostPreMenu.style.display = 'none';
}

function sendStartSignal() {
    gameStarted = true; setGameStartedUI();
    document.getElementById('hostControls').style.display = 'none';
    // Вещаем старт, пока клиент не ответит или просто интервалом
    const si = setInterval(() => { 
        if(conn && conn.open) conn.send({ type: 'START', started: true });
        else clearInterval(si);
    }, 500);
}

function changeSkin(val) { if(isHost) game.skin = parseInt(val); }
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
    
    // Отскоки от стен
    if (game.ball.x < 16 || game.ball.x > 384) { game.ball.x = game.ball.x < 16 ? 16 : 384; game.ball.vx *= -0.8; }
    
    // Ворота и стены (верх/низ)
    if (game.ball.y < 16) {
        if (game.ball.x > 135 && game.ball.x < 265) { 
            if (game.ball.y < -20) { game.score1++; manualBallReset(); } 
        } else { game.ball.y = 16; game.ball.vy *= -0.8; }
    }
    if (game.ball.y > 584) {
        if (game.ball.x > 135 && game.ball.x < 265) { 
            if (game.ball.y > 620) { game.score2++; manualBallReset(); } 
        } else { game.ball.y = 584; game.ball.vy *= -0.8; }
    }

    // Физика бит
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx), s = Math.min(Math.sqrt(game.ball.vx**2+game.ball.vy**2)+7, 15);
            game.ball.vx = Math.cos(a)*s; game.ball.vy = Math.sin(a)*s;
            game.ball.x = p.x + Math.cos(a)*38; game.ball.y = p.y + Math.sin(a)*38;
        }
    });
    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn && conn.open) conn.send({ state: game, started: true });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    // Поле
    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    // Видимые ворота
    ctx.strokeStyle = s.goalColor; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(135, 5); ctx.lineTo(265, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 595); ctx.lineTo(265, 595); ctx.stroke();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y}, op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.ball; ctx.beginPath(); ctx.arc(game.ball.x, isHost?game.ball.y:600-game.ball.y, 12, 0, 7); ctx.fill();

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "20px Arial";
        ctx.fillText(isHost ? "ОЖИДАНИЕ ИГРОКА..." : "ЖДЕМ СТАРТА ОТ ХОСТА...", 80, 300);
    }
}

function gameLoop() {
    if (gameStarted && Date.now() - lastMsgTime > 3000) {
        reconnectOverlay.style.display = 'flex';
    } else {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

initPeer();
