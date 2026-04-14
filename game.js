const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const skinContainer = document.getElementById('skinSelectorContainer');

let peer, conn;
let isHost = false;
let gameStarted = false;

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15 },
    { bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce" },
    { bg: "#e0f7fa", wall: "#80deea", p1: "#0288d1", p2: "#f06292", ball: "#fff", line: "#b2ebf2" },
    { bg: "#1b5e20", wall: "#4caf50", p1: "#ffeb3b", p2: "#795548", ball: "#fff", line: "#a5d6a7" },
    { bg: "#edc9af", wall: "#a0522d", p1: "#d2691e", p2: "#2f4f4f", ball: "#fff", line: "#f4a460" },
    { bg: "#3e0000", wall: "#ff4500", p1: "#ffd700", p2: "#8b0000", ball: "#fff", line: "#ff4500", glow: 20 },
    { bg: "#0b0d17", wall: "#5c5c5c", p1: "#4fc3f7", p2: "#9575cd", ball: "#fff", line: "rgba(255,255,255,0.1)" },
    { bg: "#120458", wall: "#ff00a0", p1: "#fee715", p2: "#00ff41", ball: "#fff", line: "#330867", glow: 10 }
];

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0,
    skin: 0
};

peer = new Peer();
peer.on('open', () => {
    status.innerText = "Система готова";
    document.getElementById('setupActions').style.display = 'block';
});

function changeSkin(val) {
    if(isHost) game.skin = parseInt(val);
}

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => { showUI(id); status.innerText = "Ждем оппонента..."; });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                skinContainer.style.display = 'block';
                status.innerText = "Игрок на месте!";
                startLoop();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(!id) return;
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id);
            conn.on('open', () => { showUI(id); status.innerText = "Подключено!"; startLoop(); });
        });
    }, 200);
}

function showUI(id) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    displayId.innerText = id;
}

function startLoop() {
    document.getElementById('gameArea').style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') { gameStarted = true; status.style.display = 'none'; }
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        else { game = data.state; gameStarted = data.started; }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    setInterval(() => { if(conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    let mx = Math.max(25, Math.min(375, x));
    let my = Math.max(320, Math.min(575, y));
    if (isHost) { game.p1.x = mx; game.p1.y = my; }
    else if (conn.open) conn.send({ x: mx, y: my });
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;

    // ЖЕСТКИЕ ГРАНИЦЫ (ИСПРАВЛЕНИЕ ВЫЛЕТА)
    if (game.ball.x < 15) { game.ball.x = 15; game.ball.vx *= -1; }
    if (game.ball.x > 385) { game.ball.x = 385; game.ball.vx *= -1; }

    const gL = 135, gR = 265;
    if (game.ball.y < 15) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y < -15) { game.score1++; manualBallReset(); }
        } else { game.ball.y = 15; game.ball.vy *= -1; }
    }
    if (game.ball.y > 585) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y > 615) { game.score2++; manualBallReset(); }
        } else { game.ball.y = 585; game.ball.vy *= -1; }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx);
            let s = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 4, 14);
            game.ball.vx = Math.cos(a) * s; game.ball.vy = Math.sin(a) * s;
            game.ball.x = p.x + Math.cos(a) * 38; game.ball.y = p.y + Math.sin(a) * 38;
        }
    });
    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 396, 596);
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(135, 2); ctx.lineTo(265, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 598); ctx.lineTo(265, 598); ctx.stroke();
    scoreDisplay.innerText = isHost ? `ВЫ ${game.score1} : ${game.score2} ВРАГ` : `ВЫ ${game.score2} : ${game.score1} ВРАГ`;
    if(s.glow) ctx.shadowBlur = s.glow; else ctx.shadowBlur = 0;
    ctx.fillStyle = "#007aff"; ctx.shadowColor = "#007aff";
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30";
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = s.ball; ctx.shadowColor = s.ball;
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn) requestAnimationFrame(gameLoop); }
