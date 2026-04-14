const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Состояние игры
let game = {
    p1: { x: 200, y: 530 }, // Хост (Синий для себя)
    p2: { x: 200, y: 70 },  // Клиент (Синий для себя)
    ball: { x: 200, y: 300, vx: 0, vy: 0 }
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
    peer.on('open', id => { displayId.innerText = id; status.innerText = "Ждем игрока..."; });
    peer.on('connection', c => {
        conn = c;
        conn.on('open', () => {
            document.getElementById('hostControls').style.display = 'block';
            status.innerText = "Игрок подключен!";
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
        status.innerText = "Подключение...";
        conn = peer.connect(id, { reliable: true });
        setupConnection();
    });
}

function setupConnection() {
    canvas.style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') {
            gameStarted = true;
            status.innerText = "ИГРАЕМ!";
        } else if (isHost) {
            // Хост получает данные от клиента
            game.p2.x = data.x;
            game.p2.y = 600 - data.y; // Инвертируем Y клиента для мира хоста
        } else {
            // Клиент получает мир от хоста
            game = data.state;
            gameStarted = data.started;
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    // Посылаем сигнал несколько раз для надежности
    let attempts = 0;
    const interval = setInterval(() => {
        if (conn && conn.open) conn.send({ type: 'START' });
        attempts++;
        if (attempts > 5) clearInterval(interval);
    }, 300);
}

const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    // Ограничиваем: только нижняя половина
    let myX = Math.max(25, Math.min(375, x));
    let myY = Math.max(325, Math.min(575, y));

    if (isHost) {
        game.p1.x = myX;
        game.p1.y = myY;
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

    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 35) {
            let angle = Math.atan2(dy, dx);
            game.ball.vx = Math.cos(angle) * 7;
            game.ball.vy = Math.sin(angle) * 7;
        }
    });

    game.ball.vx *= 0.985;
    game.ball.vy *= 0.985;

    if (game.ball.y < -20 || game.ball.y > 620) {
        game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
    }

    if (conn && conn.open) {
        conn.send({ state: game, started: gameStarted });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Линии поля
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeRect(5, 5, 390, 590);

    // ВАША БИТА (Синяя, всегда снизу)
    ctx.fillStyle = "#007aff";
    let myPos = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 25, 0, Math.PI*2); ctx.fill();

    // ЧУЖАЯ БИТА (Красная, всегда сверху)
    ctx.fillStyle = "#ff3b30";
    let oppPos = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(oppPos.x, oppPos.y, 25, 0, Math.PI*2); ctx.fill();

    // ШАЙБА
    ctx.fillStyle = "#fff";
    let bY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, bY, 12, 0, Math.PI*2); ctx.fill();
    
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 200, 300);
    }
}

function gameLoop() {
    update();
    draw();
    if (conn) requestAnimationFrame(gameLoop);
}
