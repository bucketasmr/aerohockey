const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const skinContainer = document.getElementById('skinSelectorContainer');

let peer, conn;
let isHost = false;
let gameStarted = false;
let particles = [];
let bgParticles = [];

const skins = [
    { name: "Classic", bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)", fx: "sparkle" },
    { name: "Neon", bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15, fx: "neon" },
    { name: "Retro", bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", fx: "grid" },
    { name: "Stadium", bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.5)", fx: "grass" },
    { name: "Forest", bg: "#0a2f0a", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", fx: "leaves" },
    { name: "Desert", bg: "#c2b280", wall: "#8b4513", p1: "#3e2723", p2: "#bf360c", ball: "#fff", line: "#d2b48c", fx: "sand" },
    { name: "Lava", bg: "#1a0000", wall: "#ff4500", p1: "#ffeb3b", p2: "#d50000", ball: "#ff9100", line: "#ff4500", glow: 20, fx: "lava" },
    { name: "Space", bg: "#050510", wall: "#303f9f", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.05)", fx: "space" },
    { name: "Cyber", bg: "#020024", wall: "#00ff41", p1: "#fee715", p2: "#ff00a0", ball: "#00ff41", line: "#003b00", glow: 12, fx: "matrix" }
];

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0,
    skin: 0
};

// Эффекты частиц
class Particle {
    constructor(x, y, color, size, vx, vy, life, type = 'fading') {
        this.x = x; this.y = y; this.color = color; this.size = size;
        this.vx = vx; this.vy = vy; this.life = life; this.maxLife = life;
        this.type = type;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life--;
        if (this.type === 'lava') this.vy -= 0.05; // Всплывающие частицы
    }
    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.type === 'star') {
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        } else {
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// PeerJS Сеть
peer = new Peer();
peer.on('open', () => {
    status.innerText = "Готов к подключению";
    document.getElementById('setupActions').style.display = 'block';
});

function changeSkin(val) { if(isHost) game.skin = parseInt(val); bgParticles = []; }

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => { showUI(id); status.innerText = "Ожидание игрока..."; });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                skinContainer.style.display = 'block';
                status.innerText = "Подключено!";
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
            conn.on('open', () => { showUI(id); status.innerText = "В игре!"; startLoop(); });
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
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

// Управление
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

// Логика обновления
function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;

    // Стены
    if (game.ball.x < 16 || game.ball.x > 384) { game.ball.x = game.ball.x < 16 ? 16 : 384; game.ball.vx *= -1; }

    const gL = 135, gR = 265;
    if (game.ball.y < 16) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y < -20) { game.score1++; manualBallReset(); }
        } else { game.ball.y = 16; game.ball.vy *= -1; }
    }
    if (game.ball.y > 584) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y > 620) { game.score2++; manualBallReset(); }
        } else { game.ball.y = 584; game.ball.vy *= -1; }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx);
            let s = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 5, 15);
            game.ball.vx = Math.cos(a) * s; game.ball.vy = Math.sin(a) * s;
            game.ball.x = p.x + Math.cos(a) * 38; game.ball.y = p.y + Math.sin(a) * 38;
        }
    });
    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

// Отрисовка спецэффектов
function drawFX(s) {
    // Частицы мяча (Trail)
    if (Math.abs(game.ball.vx) > 0.5) {
        let color = s.fx === 'lava' ? '#ff4500' : s.ball;
        particles.push(new Particle(game.ball.x, game.ball.y, color, Math.random()*5, 0, 0, 20));
    }

    // Фоновые эффекты
    if (s.fx === 'lava') {
        if (Math.random() > 0.8) bgParticles.push(new Particle(Math.random()*400, 600, '#ff4500', 2, 0, -Math.random()*2, 60, 'lava'));
        if (Math.random() > 0.9) bgParticles.push(new Particle(Math.random()*400, 600, '#555', 8, 0, -1, 100)); // Дым
    } else if (s.fx === 'space') {
        if (Math.random() > 0.95) bgParticles.push(new Particle(Math.random()*400, 0, '#fff', 1, 0.5, 5, 80, 'star')); // Кометы
    } else if (s.fx === 'grass') {
        // Тень от солнца (смещение вправо-вниз)
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.arc(game.ball.x+8, game.ball.y+8, 12, 0, Math.PI*2); ctx.fill();
    }

    particles = particles.filter(p => p.life > 0);
    bgParticles = bgParticles.filter(p => p.life > 0);
    bgParticles.forEach(p => { p.update(); p.draw(); });
    particles.forEach(p => { p.update(); p.draw(); });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    // Трава (спец-текстура)
    if (s.fx === 'grass') {
        for(let i=0; i<600; i+=40) {
            ctx.fillStyle = i % 80 === 0 ? "#2d5a27" : "#356a2e";
            ctx.fillRect(0, i, 400, 40);
        }
    }

    drawFX(s);

    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 396, 596);
    
    // Ворота
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(135, 2); ctx.lineTo(265, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 598); ctx.lineTo(265, 598); ctx.stroke();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;

    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.wall; }

    // Биты
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    // Мяч
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
