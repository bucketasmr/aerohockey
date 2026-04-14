const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const skinContainer = document.getElementById('skinSelectorContainer');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Частицы
let ballParticles = [];
let bgParticles = [];
let goalFireworks = [];

const skins = [
    { name: "Classic", bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)", trailColor: "#888", fx: "none" },
    { name: "Neon", bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15, trailColor: "#fff", fx: "neon" },
    { name: "Retro", bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", fx: "retro" },
    { name: "Stadium", bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.4)", trailColor: "rgba(255,255,255,0.5)", fx: "grass" },
    { name: "Forest", bg: "#0a2f0a", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", trailColor: "#a5d6a7", fx: "leaves" },
    { name: "Tomb", bg: "#1a1100", wall: "#8b4513", p1: "#ffe082", p2: "#3e2723", ball: "#ffeb3b", line: "#6d4c41", glow: 5, trailColor: "#ffd54f", fx: "tomb" },
    { name: "Lava", bg: "#120000", wall: "#ff4500", p1: "#ffee58", p2: "#b71c1c", ball: "#ff9100", line: "#ff4500", glow: 20, trailColor: "#ff4500", fx: "lava" },
    { name: "Space", bg: "#050510", wall: "#283593", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.1)", trailColor: "#fff", fx: "space" },
    { name: "Cyber", bg: "#020024", wall: "#00ff41", p1: "#fed700", p2: "#ff00a0", ball: "#00ff41", line: "#002b00", glow: 10, trailColor: "#00ff41", fx: "cyber" }
];

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0,
    skin: 0
};

let lastBallPos = { x: 200, y: 300 };

class Particle {
    constructor(x, y, color, size, vx, vy, life, gravity = 0) {
        this.x = x; this.y = y; this.color = color; this.size = size;
        this.vx = vx; this.vy = vy; this.gravity = gravity;
        this.life = life; this.maxLife = life;
    }
    update() { this.x += this.vx; this.vy += this.gravity; this.y += this.vy; this.life--; }
}

peer = new Peer();
peer.on('open', () => { status.innerText = "Система готова"; document.getElementById('setupActions').style.display = 'block'; });

function changeSkin(val) { if(isHost) game.skin = parseInt(val); bgParticles = []; ballParticles = []; }

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => { 
            showUI(id); 
            status.innerText = "ОЖИДАНИЕ ИГРОКА..."; 
            displayId.style.display = 'block';
        });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                skinContainer.style.display = 'block';
                status.innerText = "ИГРОК ПОДКЛЮЧИЛСЯ!";
                setupLoops();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length < 3) return;
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id);
            conn.on('open', () => { 
                showUI(id); 
                displayId.style.display = 'none'; // Клиенту код не нужен так крупно
                status.innerText = "УДАЧИ В БОЮ!"; 
                setupLoops(); 
            });
        });
    }, 200);
}

function showUI(id) { document.getElementById('menu').style.display = 'none'; document.getElementById('gameUI').style.display = 'block'; displayId.innerText = id; }

function setupLoops() {
    document.getElementById('gameArea').style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') { 
            gameStarted = true; 
            status.style.display = 'none'; 
            displayId.style.display = 'none';
        }
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        else {
            const oldS1 = game.score1, oldS2 = game.score2;
            game = data.state;
            gameStarted = data.started;
            if(game.score1 > oldS1) spawnGoalExplosion(false); // Для клиента: Хост забил (верх)
            if(game.score2 > oldS2) spawnGoalExplosion(true);  // Для клиента: Мы забили (низ)
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    displayId.style.display = 'none';
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
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
    if (game.ball.x < 16) { game.ball.x = 16; game.ball.vx *= -1; }
    if (game.ball.x > 384) { game.ball.x = 384; game.ball.vx *= -1; }

    const gL = 135, gR = 265;
    if (game.ball.y < 16) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y < -20) { 
                game.score1++; 
                spawnGoalExplosion(false); // Салют в верхних воротах
                manualBallReset(); 
            }
        } else { game.ball.y = 16; game.ball.vy *= -1; }
    }
    if (game.ball.y > 584) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y > 620) { 
                game.score2++; 
                spawnGoalExplosion(true); // Салют в нижних воротах
                manualBallReset(); 
            }
        } else { game.ball.y = 584; game.ball.vy *= -1; }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx);
            let s = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 6, 16);
            game.ball.vx = Math.cos(a) * s; game.ball.vy = Math.sin(a) * s;
            game.ball.x = p.x + Math.cos(a) * 38; game.ball.y = p.y + Math.sin(a) * 38;
        }
    });
    game.ball.vx *= 0.985; game.ball.vy *= 0.985;
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

function spawnGoalExplosion(isBottom) {
    const s = skins[game.skin] || skins[0];
    const yPos = isBottom ? 590 : 10;
    const color = isBottom ? s.p1 : s.p2;
    for(let i=0; i<40; i++) {
        goalFireworks.push(new Particle(200, yPos, color, Math.random()*5+2, (Math.random()-0.5)*10, (Math.random()-0.5)*10, 60));
    }
}

function drawFX(s) {
    const renderBall = isHost ? game.ball : { x: game.ball.x, y: 600 - game.ball.y };
    const lvx = renderBall.x - lastBallPos.x, lvy = renderBall.y - lastBallPos.y;
    
    if (Math.abs(lvx) + Math.abs(lvy) > 2) {
        for(let i=0; i<2; i++) {
            ballParticles.push(new Particle(renderBall.x, renderBall.y, s.trailColor, Math.random()*5, -lvx*0.2, -lvy*0.2, 25));
        }
    }
    lastBallPos = { x: renderBall.x, y: renderBall.y };

    if (s.fx === 'lava' && Math.random() > 0.7) bgParticles.push(new Particle(Math.random()*400, 600, '#ff4500', 2, 0, -2, 50, -0.05));
    if (s.fx === 'space' && Math.random() > 0.9) bgParticles.push(new Particle(Math.random()*400, 0, '#fff', 1, 1, 6, 80));

    [bgParticles, ballParticles, goalFireworks].forEach(arr => {
        for(let i=arr.length-1; i>=0; i--) {
            arr[i].update();
            if(arr[i].life <= 0) arr.splice(i, 1);
            else {
                ctx.globalAlpha = arr[i].life / arr[i].maxLife;
                ctx.fillStyle = arr[i].color;
                ctx.beginPath(); ctx.arc(arr[i].x, arr[i].y, arr[i].size, 0, Math.PI*2); ctx.fill();
            }
        }
    });
    ctx.globalAlpha = 1;
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    if (s.fx === 'grass') {
        for(let i=0; i<600; i+=60) {
            ctx.fillStyle = i % 120 === 0 ? "#2d5a27" : "#32622c";
            ctx.fillRect(5, i+5, 390, 50);
        }
    }

    drawFX(s);

    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 394, 594);
    
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(135, 4); ctx.lineTo(265, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 596); ctx.lineTo(265, 596); ctx.stroke();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;

    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.wall; }
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = s.ball; ctx.shadowColor = s.ball;
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ОЖИДАНИЕ ХОСТА...", 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn && conn.open) requestAnimationFrame(gameLoop); }
