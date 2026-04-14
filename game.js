const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Конфигурация скинов
const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.1)" }, // Стандарт
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", glow: 15 }, // Неон
    { bg: "#2b1d42", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce" }, // Ретро
    { bg: "#e0f7fa", wall: "#80deea", p1: "#0288d1", p2: "#f06292", ball: "#fff", line: "#b2ebf2" }, // Лед
    { bg: "#1b5e20", wall: "#4caf50", p1: "#ffeb3b", p2: "#795548", ball: "#fff", line: "#a5d6a7" }, // Лес
    { bg: "#edc9af", wall: "#a0522d", p1: "#d2691e", p2: "#2f4f4f", ball: "#fff", line: "#f4a460" }, // Пустыня
    { bg: "#3e0000", wall: "#ff4500", p1: "#ffd700", p2: "#8b0000", ball: "#fff", line: "#ff4500", glow: 20 }, // Лава
    { bg: "#0b0d17", wall: "#5c5c5c", p1: "#4fc3f7", p2: "#9575cd", ball: "#fff", line: "rgba(255,255,255,0.1)" }, // Космос
    { bg: "#120458", wall: "#ff00a0", p1: "#fee715", p2: "#00ff41", ball: "#fff", line: "#330867", glow: 10 }  // Киберпанк
];

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0,
    skin: 0
};

// Инициализация
peer = new Peer();
peer.on('open', () => {
    status.innerText = "Связь готова";
    document.getElementById('mainButtons').style.display = 'block';
});

function setSkin(idx, btn) {
    game.skin = idx;
    // Визуальное выделение кнопок (во всех списках)
    document.querySelectorAll('.btn-skin').forEach((b, i) => {
        if (i % 9 === idx) b.classList.add('skin-active');
        else b.classList.remove('skin-active');
    });
}

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => {
            switchToUI(id);
            status.innerText = "Код: " + id + ". Ждем игрока...";
        });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                document.getElementById('inGameSkins').style.display = 'block';
                status.innerText = "Игрок подключен!";
                setupGame();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length < 5) return alert("Введите код комнаты");
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id, { reliable: true });
            conn.on('open', () => {
                switchToUI(id);
                status.innerText = "Подключено к " + id;
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
        if (data.type === 'START') {
            gameStarted = true;
            status.style.display = 'none';
        } else if (isHost) {
            game.p2.x = data.x;
            game.p2.y = 600 - data.y;
        } else {
            game = data.state;
            gameStarted = data.started;
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    status.style.display = 'none';
    // Отправляем сигнал старта несколько раз для надежности
    let count = 0;
    const itv = setInterval(() => {
        if(conn && conn.open) conn.send({ type: 'START' });
        if(++count > 10) clearInterval(itv);
    }, 300);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

// Управление
const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    
    // Масштабируем под внутренние 400x600
    const x = (touch.clientX - rect.left) * (400 / rect.width);
    const y = (touch.clientY - rect.top) * (600 / rect.height);
    
    let myX = Math.max(25, Math.min(375, x));
    let myY = Math.max(320, Math.min(575, y)); // Только нижняя половина

    if (isHost) {
        game.p1.x = myX; game.p1.y = myY;
    } else {
        if (conn && conn.open) conn.send({ x: myX, y: myY });
    }
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleInput(e); }, {passive: false});

// Физика (Только Хост)
function update() {
    if (!isHost || !gameStarted) return;

    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Стены (защита от вылета)
    if (game.ball.x < 15) { game.ball.x = 15; game.ball.vx *= -1; }
    if (game.ball.x > 385) { game.ball.x = 385; game.ball.vx *= -1; }

    const goalL = 135, goalR = 265;
    // Верх (Клиент)
    if (game.ball.y < 15) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y < -15) { game.score1++; game.ball = {x:200, y:300, vx:0, vy:0}; }
        } else { game.ball.y = 15; game.ball.vy *= -1; }
    }
    // Низ (Хост)
    if (game.ball.y > 585) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y > 615) { game.score2++; game.ball = {x:200, y:300, vx:0, vy:0}; }
        } else { game.ball.y = 585; game.ball.vy *= -1; }
    }

    // Столкновение с битами
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 36) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 4, 13);
            game.ball.vx = Math.cos(angle) * speed;
            game.ball.vy = Math.sin(angle) * speed;
            // Выталкивание чтобы не залипало
            game.ball.x = p.x + Math.cos(angle) * 37;
            game.ball.y = p.y + Math.sin(angle) * 37;
        }
    });

    game.ball.vx *= 0.992; game.ball.vy *= 0.992; // Трение

    if (conn && conn.open) conn.send({ state: game, started: gameStarted });
}

// Отрисовка
function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, 400, 600);
    
    // Разметка
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 396, 596);
    
    // Ворота
    ctx.strokeStyle = "#34c759";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(135, 2); ctx.lineTo(265, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 598); ctx.lineTo(265, 598); ctx.stroke();

    scoreDisplay.innerText = isHost ? `ВЫ ${game.score1} : ${game.score2} ВРАГ` : `ВЫ ${game.score2} : ${game.score1} ВРАГ`;

    if(s.glow) { ctx.shadowBlur = s.glow; } else { ctx.shadowBlur = 0; }

    // Биты
    ctx.fillStyle = "#007aff"; ctx.shadowColor = "#007aff";
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30";
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    // Шайба
    ctx.fillStyle = s.ball; ctx.shadowColor = s.ball;
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn) requestAnimationFrame(gameLoop); }
