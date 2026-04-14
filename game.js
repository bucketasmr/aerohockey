const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const skinContainer = document.getElementById('skinSelectorContainer');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Локальная система частиц (не синхронизируется)
let ballParticles = []; // Хвост мяча
let bgParticles = [];   // Эффекты фона
let goalFireworks = []; // Салют при голе

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)", trailColor: "#888", fx: "none" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15, trailColor: "#fff", fx: "neon" },
    { bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", fx: "retro" },
    { bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.4)", trailColor: "rgba(255,255,255,0.5)", fx: "grass" },
    { bg: "#0a2f0a", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", trailColor: "#a5d6a7", fx: "leaves" },
    { bg: "#1a1100", wall: "#8b4513", p1: "#ffe082", p2: "#3e2723", ball: "#ffeb3b", line: "#6d4c41", glow: 5, trailColor: "#ffd54f", fx: "tomb" },
    { bg: "#120000", wall: "#ff4500", p1: "#ffee58", p2: "#b71c1c", ball: "#ff9100", line: "#ff4500", glow: 20, trailColor: "#ff4500", fx: "lava" },
    { bg: "#050510", wall: "#283593", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.1)", trailColor: "#fff", fx: "space" },
    { bg: "#020024", wall: "#00ff41", p1: "#fed700", p2: "#ff00a0", ball: "#00ff41", line: "#002b00", glow: 10, trailColor: "#00ff41", fx: "cyber" }
];

let game = {
    p1: { x: 200, y: 530 }, // Хост
    p2: { x: 200, y: 70 },  // Клиент
    ball: { x: 200, y: 300, vx: 0, vy: 0, lastGoal: 0 },
    score1: 0, score2: 0,
    skin: 0
};

// Хранение предыдущих координат мяча для расчета хвоста (Trail)
let lastBallPos = { x: 200, y: 300 };

// Класс Частицы (Trail / Гол)
class Particle {
    constructor(x, y, color, size, vx, vy, life, gravity = 0, type = 'fading') {
        this.x = x; this.y = y; this.color = color; this.size = size;
        this.vx = vx; this.vy = vy; this.gravity = gravity;
        this.life = life; this.maxLife = life; this.type = type;
    }
    update() {
        this.x += this.vx; this.vy += this.gravity; this.y += this.vy; this.life--;
        if(this.type === 'lava') this.size *= 0.98;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if(this.type === 'star') ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        else ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// PeerJS Сеть
peer = new Peer();
peer.on('open', () => { status.innerText = "Подключение готово"; document.getElementById('setupActions').style.display = 'block'; });
peer.on('error', err => { console.error(err); status.innerText = "Ошибка сети: " + err.type; });

function changeSkin(val) { if(isHost) game.skin = parseInt(val); clearParticles(); }
function clearParticles() { bgParticles = []; ballParticles = []; }

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => { showUI(id); status.innerText = "Код: " + id + ". Ждем оппонента..."; });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                skinContainer.style.display = 'block';
                status.innerText = "Матч готов!";
                setupLoops();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length !== 5) return alert("Введите 5 символов!");
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id);
            conn.on('open', () => { showUI(id); status.innerText = "Входим в игру..."; setupLoops(); });
        });
        peer.on('error', () => { alert("Комната не найдена."); location.reload(); });
    }, 200);
}

function showUI(id) { document.getElementById('menu').style.display = 'none'; document.getElementById('gameUI').style.display = 'block'; displayId.innerText = id; }

function setupLoops() {
    document.getElementById('gameArea').style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') { gameStarted = true; status.style.display = 'none'; }
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; } // Инверсия от клиента
        else {
            // КЛИЕНТ получает мир от ХОСТА
            const prevScore1 = game.score1; const prevScore2 = game.score2;
            game = data.state;
            gameStarted = data.started;
            // Проверка на гол локально (для салюта)
            if (game.score1 > prevScore1) spawnGoalExplosion(true); // Забили нам (для клиента)
            if (game.score2 > prevScore2) spawnGoalExplosion(false); // Забили им
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    status.style.display = 'none';
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

// Управление
const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    // ВАЖНО: Масштабируем пиксели в координаты 400x600
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    
    // Ограничение: только нижняя половина
    let mx = Math.max(25, Math.min(375, x));
    let my = Math.max(320, Math.min(575, y));

    if (isHost) { game.p1.x = mx; game.p1.y = my; }
    else if (conn.open) conn.send({ x: mx, y: my }); // Клиент шлет свои "нижние" координаты
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

// ==========================================
// ФИЗИКА И ОБНОВЛЕНИЕ (ТОЛЬКО ХОСТ)
// ==========================================
function update() {
    if (!isHost || !gameStarted) return;
    
    const prevBallPos = {x: game.ball.x, y: game.ball.y};
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;

    // Стены (Жесткие границы 16px)
    if (game.ball.x < 16) { game.ball.x = 16; game.ball.vx *= -1; }
    if (game.ball.x > 384) { game.ball.x = 384; game.ball.vx *= -1; }

    const gL = 135, gR = 265;
    // Гол Верх (Клиент)
    if (game.ball.y < 16) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y < -20) { 
                game.score1++; // Хост забил
                spawnGoalExplosion(false); // Салют на стороне хоста (враг забил)
                manualBallReset(); 
            }
        } else { game.ball.y = 16; game.ball.vy *= -1; }
    }
    // Гол Низ (Хост)
    if (game.ball.y > 584) {
        if (game.ball.x > gL && game.ball.x < gR) {
            if (game.ball.y > 620) { 
                game.score2++; // Клиент забил
                spawnGoalExplosion(true); // Салют на стороне хоста (враг забил)
                manualBallReset(); 
            }
        } else { game.ball.y = 584; game.ball.vy *= -1; }
    }

    // Соударение с битами
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx);
            let s = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 5, 16); // Увеличили макс скорость
            game.ball.vx = Math.cos(a) * s; game.ball.vy = Math.sin(a) * s;
            // Выталкивание (Жесткое 38px)
            game.ball.x = p.x + Math.cos(a) * 38; game.ball.y = p.y + Math.sin(a) * 38;
        }
    });
    
    game.ball.vx *= 0.99; game.ball.vy *= 0.99; // Трение
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

// ==========================================
// ОТРИСОВКА И ЭФФЕКТЫ (ДЛЯ ОБОИХ)
// ==========================================

// Салют при Голе (Уникальный для темы)
function spawnGoalExplosion(isMyGoal) {
    const s = skins[game.skin] || skins[0];
    const y = isMyGoal ? 598 : 2; // Координаты для ХОСТА. Для клиента отзеркалятся в drawGoalFX
    let color = isMyGoal ? s.p1 : s.p2;
    if (s.fx === 'tomb') color = "#ffd54f"; // Золотой салют для гробницы
    if (s.fx === 'lava') color = "#ff9100"; // Огненный салют

    for(let i=0; i<30; i++) {
        goalFireworks.push(new Particle(200, y, color, Math.random()*4+1, (Math.random()-0.5)*8, (Math.random()-0.5)*8, 50));
    }
}

// Обновление и отрисовка Локальных FX
function drawGoalFX() {
    goalFireworks = goalFireworks.filter(p => p.life > 0);
    goalFireworks.forEach(p => { 
        p.update(); 
        // ОТЗЕРКАЛИВАЕМ Салют для Клиента в Draw
        let y = isHost ? p.y : 600 - p.y;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, y, p.size, 0, Math.PI*2); ctx.fill();
    });
}

function updateLocalParticles() {
    // 1. ХВОСТ МЯЧА (Локальный Fix)
    const renderPos = isHost ? game.ball : { x: game.ball.x, y: 600 - game.ball.y }; // Локальная позиция на экране
    
    // Считаем локальную скорость (движение от кадра к кадру на этом экране)
    const localVX = renderPos.x - lastBallPos.x;
    const localVY = renderPos.y - lastBallPos.y;
    const s = skins[game.skin] || skins[0];

    if (Math.abs(localVX) + Math.abs(localVY) > 1.5) { // Увеличили порог
        let trailColor = s.trailColor;
        
        for(let i=0; i<2; i++) { // По 2 частицы для густоты
            let size = Math.random()*5;
            let vx = (Math.random()-0.5) * Math.abs(localVX)*0.2;
            let vy = (Math.random()-0.5) * Math.abs(localVY)*0.2;
            // Частицы летят ОТ направления движения
            vx -= localVX * (0.05 + Math.random()*0.1); 
            vy -= localVY * (0.05 + Math.random()*0.1);

            let type = s.fx === 'tomb' ? 'star' : 'fading';
            if (s.fx === 'tomb' && Math.random() > 0.8) trailColor = "#ffeb3b"; // Золотые искры

            ballParticles.push(new Particle(renderPos.x, renderPos.y, trailColor, size, vx, vy, 20 + Math.random()*15, 0, type));
        }
    }
    lastBallPos = { x: renderPos.x, y: renderPos.y }; // Запоминаем для след. кадра

    ballParticles = ballParticles.filter(p => p.life > 0);
    ballParticles.forEach(p => { p.update(); ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; });

    // 2. ФОНОВЫЕ FX (Локальные)
    updateBackgroundFX(s);
}

// Уникальные Фоновые Эффекты (Локальные)
function updateBackgroundFX(s) {
    if (s.fx === 'lava') {
        if (Math.random() > 0.6) bgParticles.push(new Particle(Math.random()*400, 600, '#ff4500', Math.random()*3+1, 0, -Math.random()*2, 60, -0.05, 'lava')); // Искры
        if (Math.random() > 0.8) bgParticles.push(new Particle(Math.random()*400, 600, '#444', 10, 0, -1, 120, 0)); // Дым
    } else if (s.fx === 'space') {
        if (Math.random() > 0.95) bgParticles.push(new Particle(Math.random()*400, 0, '#fff', 1, 0.3, 5, 100, 0, 'star')); // Метеориты
    } else if (s.fx === 'grass') {
        // Тень (Локально зеркалится)
        const renderPos = isHost ? game.ball : { x: game.ball.x, y: 600 - game.ball.y };
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); 
        // Если хост - справа-снизу (+8,+8), клиент видит этот же мир как слева-сверху (-8,-8)
        const offset = isHost ? 8 : -8;
        ctx.arc(renderPos.x+offset, renderPos.y+offset, 13, 0, Math.PI*2); ctx.fill();
    } else if (s.fx === 'tomb') {
        // Песчаная Пыль (все время летает)
        if (Math.random() > 0.5) bgParticles.push(new Particle(400, Math.random()*600, "rgba(180,160,100,0.2)", Math.random()*3+1, -Math.random()*1.5-0.5, 0, 100));
        // Мерцающие Искры от "Факелов" по бокам
        if (Math.random() > 0.8) bgParticles.push(new Particle(WALL_T+10, Math.random()*600, '#ffeb3b', 2, (Math.random()-0.5)*1, (Math.random()-0.5)*1, 40));
        if (Math.random() > 0.8) bgParticles.push(new Particle(400-WALL_T-10, Math.random()*600, '#ffeb3b', 2, (Math.random()-0.5)*1, (Math.random()-0.5)*1, 40));
    } else if (s.fx === 'cyber') {
        // Цифровой мерцающий дождь
        if (Math.random() > 0.7) bgParticles.push(new Particle(Math.random()*400, Math.random()*600, '#005b14', 1, 0, 0, 30));
    }

    bgParticles = bgParticles.filter(p => p.life > 0);
    bgParticles.forEach(p => { p.update(); ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; });
}

// ОСНОВНАЯ ОТРИСОВКА
const WALL_T = 6;
function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    // Stadium Grass Pattern
    if (s.fx === 'grass') {
        for(let i=0; i<600; i+=60) {
            ctx.fillStyle = i % 120 === 0 ? "#2d5a27" : "#32622c";
            ctx.fillRect(WALL_T, i+WALL_T, 400-WALL_T*2, 60-WALL_T*2);
        }
    }

    // ЛОКАЛЬНЫЕ FX (Сначала фон)
    updateLocalParticles();

    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall; ctx.lineWidth = WALL_T;
    ctx.strokeRect(WALL_T/2, WALL_T/2, 400-WALL_T, 600-WALL_T);
    
    // Ворота
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(135, WALL_T); ctx.lineTo(265, WALL_T); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 600-WALL_T); ctx.lineTo(265, 600-WALL_T); ctx.stroke();

    // Салют при Голе (поверх разметки)
    drawGoalFX();

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;

    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.wall; }

    // Биты (Зеркалятся)
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    // Мяч (Зеркалится)
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

function gameLoop() { update(); draw(); if (conn && conn.open) requestAnimationFrame(gameLoop); }
