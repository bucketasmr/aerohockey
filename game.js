const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Состояние игры
let game = {
    p1: { x: 200, y: 550 }, // Нижний игрок
    p2: { x: 200, y: 50 },  // Верхний игрок
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0,
    score2: 0
};

// Генератор короткого ID
function generateShortId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// СОЗДАТЬ КОМНАТУ (ХОСТ)
function createRoom() {
    isHost = true;
    const shortId = generateShortId();
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    
    peer = new Peer(shortId);

    peer.on('open', id => {
        displayId.innerText = id;
        status.innerText = "Ждем второго игрока...";
    });

    peer.on('connection', c => {
        conn = c;
        conn.on('open', () => {
            document.getElementById('hostControls').style.display = 'block';
            status.innerText = "Игрок подключился!";
            setupConnection();
        });
    });

    peer.on('error', err => {
        alert("Ошибка: " + err.type);
        location.reload();
    });
}

// ПРИСОЕДИНИТЬСЯ (КЛИЕНТ)
function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if (!id) return alert("Введите код!");

    isHost = false;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    
    peer = new Peer();

    peer.on('open', () => {
        displayId.innerText = id;
        status.innerText = "Подключаемся...";
        conn = peer.connect(id, { reliable: true });
        setupConnection();
    });
}

function setupConnection() {
    canvas.style.display = 'block';
    
    conn.on('data', data => {
        if (data.type === 'START') {
            gameStarted = true;
            status.innerText = "ПОЕХАЛИ!";
        } else if (isHost) {
            game.p2.x = data.x; // Получаем позицию клиента
        } else {
            game = data.state;  // Получаем всё состояние от хоста
            gameStarted = data.started;
        }
    });

    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    if (conn && conn.open) {
        conn.send({ type: 'START' });
    }
}

// Управление
const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    
    if (isHost) game.p1.x = x;
    else {
        if (conn && conn.open) conn.send({ x: x });
    }
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;

    // Физика шайбы
    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Отскоки от стен
    if (game.ball.x < 10 || game.ball.x > 390) game.ball.vx *= -1;
    
    // Простая проверка столкновений
    const checkHit = (p) => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) < 30) {
            game.ball.vx = dx * 0.15;
            game.ball.vy = dy * 0.15;
        }
    };
    checkHit(game.p1);
    checkHit(game.p2);

    // Трение
    game.ball.vx *= 0.99;
    game.ball.vy *= 0.99;

    // Гол и сброс
    if (game.ball.y < 0 || game.ball.y > 600) {
        game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
    }

    if (conn && conn.open) {
        conn.send({ state: game, started: gameStarted });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Центр
    ctx.strokeStyle = "#555";
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();

    // Биты (своя синяя, чужая красная)
    ctx.fillStyle = isHost ? "blue" : "red";
    ctx.beginPath(); ctx.arc(game.p1.x, game.p1.y, 20, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = isHost ? "red" : "blue";
    ctx.beginPath(); ctx.arc(game.p2.x, 600 - game.p2.y, 20, 0, Math.PI*2); ctx.fill();

    // Шайба
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(game.ball.x, game.ball.y, 10, 0, Math.PI*2); ctx.fill();
    
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 150, 300);
    }
}

function gameLoop() {
    update();
    draw();
    if (conn && conn.open) requestAnimationFrame(gameLoop);
}
