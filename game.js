const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Состояние игры
let game = {
    p1: { x: 200, y: 530 }, // Хост (Синий)
    p2: { x: 200, y: 70 },  // Клиент (Красный)
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, // Очки Хоста
    score2: 0  // Очки Клиента
};

function generateShortId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function createRoom() {
    isHost = true;
    const shortId = generateShortId();
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    peer = new Peer(shortId);
    peer.on('open', id => { displayId.innerText = id; status.innerText = "Ожидание подключения..."; });
    peer.on('connection', c => {
        conn = c;
        conn.on('open', () => {
            document.getElementById('hostControls').style.display = 'block';
            status.innerText = "Игрок готов!";
            setupConnection();
        });
    });
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if (!id) return alert("Введите код!");
    isHost = false;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    peer = new Peer();
    peer.on('open', () => {
        displayId.innerText = id;
        status.innerText = "Соединение...";
        conn = peer.connect(id, { reliable: true });
        setupConnection();
    });
}

function setupConnection() {
    canvas.style.display = 'block';
    scoreDisplay.style.display = 'block';
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
    let attempts = 0;
    const interval = setInterval(() => {
        if (conn && conn.open) conn.send({ type: 'START' });
        if (++attempts > 5) clearInterval(interval);
    }, 300);
}

const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    // Масштабирование координат под размер canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let myX = Math.max(25, Math.min(375, x * scaleX));
    let myY = Math.max(320, Math.min(575, y * scaleY)); // Движение только на своей половине

    if (isHost) {
        game.p1.x = myX; game.p1.y = myY;
    } else {
        if (conn && conn.open) conn.send({ x: myX, y: myY });
    }
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;

    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Стенки
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;

    // ЛОГИКА ВОРОТ (Ширина 120px)
    const goalL = 140, goalR = 260;

    // Верхняя стенка
    if (game.ball.y < 15) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y < -15) { game.score1++; resetBall(); }
        } else { game.ball.y = 15; game.ball.vy *= -1; }
    }
    // Нижняя стенка
    if (game.ball.y > 585) {
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y > 615) { game.score2++; resetBall(); }
        } else { game.ball.y = 585; game.ball.vy *= -1; }
    }

    // Соударения
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) < 35) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 5, 12);
            game.ball.vx = Math.cos(angle) * speed;
            game.ball.vy = Math.sin(angle) * speed;
        }
    });

    game.ball.vx *= 0.992;
    game.ball.vy *= 0.992;

    if (conn && conn.open) conn.send({ state: game, started: gameStarted });
}

function resetBall() {
    game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Разметка
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, Math.PI*2); ctx.stroke();
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();

    // Отрисовка ворот
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#34c759";
    ctx.beginPath(); ctx.moveTo(140, 5); ctx.lineTo(260, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(140, 595); ctx.lineTo(260, 595); ctx.stroke();

    // Обновление текста счета
    scoreDisplay.innerText = isHost ? 
        `ВЫ ${game.score1} : ${game.score2} ВРАГ` : 
        `ВЫ ${game.score2} : ${game.score1} ВРАГ`;

    // БИТЫ (Своя - Синяя, Чужая - Красная)
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#007aff"; ctx.shadowColor = "#007aff";
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30";
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, Math.PI*2); ctx.fill();

    // ШАЙБА
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff";
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif";
        ctx.fillText(isHost ? "ЖМИ СТАРТ" : "ЖДЕМ ХОСТА...", 130, 300);
    }
}

function gameLoop() {
    update();
    draw();
    if (conn) requestAnimationFrame(gameLoop);
}
