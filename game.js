const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');

let peer, conn;
let isHost = false;
let gameStarted = false;
let currentSkinIndex = 0;

// Список дизайнов
const skins = [
    { name: "Standard", bg: "#222", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)" },
    { name: "Neon", bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15 },
    { name: "Retro", bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce" },
    { name: "Ice", bg: "#e0f7fa", wall: "#80deea", p1: "#0288d1", p2: "#f06292", ball: "#fff", line: "#b2ebf2" },
    { name: "Forest", bg: "#1b5e20", wall: "#4caf50", p1: "#ffeb3b", p2: "#795548", ball: "#fff", line: "#a5d6a7" },
    { name: "Desert", bg: "#edc9af", wall: "#a0522d", p1: "#d2691e", p2: "#2f4f4f", ball: "#fff", line: "#f4a460" },
    { name: "Lava", bg: "#3e0000", wall: "#ff4500", p1: "#ffd700", p2: "#8b0000", ball: "#fff", line: "#ff4500", glow: 20 },
    { name: "Space", bg: "#0b0d17", wall: "#5c5c5c", p1: "#4fc3f7", p2: "#9575cd", ball: "#fff", line: "rgba(255,255,255,0.05)" },
    { name: "Cyber", bg: "#120458", wall: "#ff00a0", p1: "#fee715", p2: "#00ff41", ball: "#fff", line: "#330867" }
];

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0,
    skin: 0
};

// PeerJS Setup
peer = new Peer();
peer.on('open', () => {
    status.innerText = "Готов к игре";
    document.getElementById('mainButtons').style.display = 'block';
});

function setSkin(idx, btn) {
    currentSkinIndex = idx;
    game.skin = idx;
    document.querySelectorAll('.btn-skin').forEach(b => b.classList.remove('skin-active'));
    btn.classList.add('skin-active');
}

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => {
            switchToUI(id);
            status.innerText = "Ожидание игрока...";
        });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                status.innerText = "Игрок зашел!";
                setupGame();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length < 5) return;
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id, { reliable: true });
            conn.on('open', () => {
                switchToUI(id);
                status.innerText = "Подключено!";
                setupGame();
            });
        });
    }, 200);
}

function switchToUI(id) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    displayId.innerText = id;
}

function setupGame() {
    document.getElementById('gameArea').style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') gameStarted = true;
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        else { game = data.state; gameStarted = data.started; }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) resetBall(); }

function resetBall() { game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

// Input
const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = (touch.clientX - rect.left) * (400 / rect.width);
    const y = (touch.clientY - rect.top) * (600 / rect.height);
    
    let myX = Math.max(30, Math.min(370, x));
    let myY = Math.max(330, Math.min(570, y));

    if (isHost) { game.p1.x = myX; game.p1.y = myY; }
    else if (conn && conn.open) conn.send({ x: myX, y: myY });
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

// Physics (Host Only)
function update() {
    if (!isHost || !gameStarted) return;

    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Walls
    if (game.ball.x < 17 || game.ball.x > 383) { game.ball.vx *= -1; game.ball.x = game.ball.x < 17 ? 17 : 383; }

    const goalL = 140, goalR = 260;
    // Top goal
    if (game.ball.y < 17) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y < -10) { game.score1++; resetBall(); }
        } else { game.ball.y = 17; game.ball.vy *= -1; }
    }
    // Bottom goal
    if (game.ball.y > 583) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y > 610) { game.score2++; resetBall(); }
        } else { game.ball.y = 583; game.ball.vy *= -1; }
    }

    // Striker collision
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 37) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 4, 13);
            game.ball.vx = Math.cos(angle) * speed;
            game.ball.vy = Math.sin(angle) * speed;
        }
    });

    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn && conn.open) conn.send({ state: game, started: gameStarted });
}

// Drawing
function draw() {
    const s = skins[game.skin];
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, 400, 600);
    
    // Field
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 394, 594);
    
    // Goals
    ctx.strokeStyle = "#34c759";
    ctx.beginPath(); ctx.moveTo(140, 3); ctx.lineTo(260, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(140, 597); ctx.lineTo(260, 597); ctx.stroke();

    scoreDisplay.innerText = isHost ? `ВЫ ${game.score1} : ${game.score2} ВРАГ` : `ВЫ ${game.score2} : ${game.score1} ВРАГ`;

    if(s.glow) { ctx.shadowBlur = s.glow; } else { ctx.shadowBlur = 0; }

    // Strikers
    ctx.fillStyle = "#007aff"; ctx.shadowColor = "#007aff";
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30";
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    // Ball
    ctx.fillStyle = s.ball; ctx.shadowColor = s.ball;
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn) requestAnimationFrame(gameLoop); }
