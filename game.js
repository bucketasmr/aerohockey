const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Состояние игры
let game = {
    p1: { x: 200, y: 550 }, // Хост (всегда внизу у себя)
    p2: { x: 200, y: 50 },  // Клиент (всегда вверху для хоста)
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
            status.innerText = "Игрок в сети! Нажмите Старт.";
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
            status.innerText = "ИГРА НАЧАТА";
        } else if (isHost) {
            // Хост получает координаты клиента. 
            // Клиент думает, что он внизу (Y > 300), поэтому хост должен "перевернуть" его Y для себя.
            game.p2.x = data.x;
            game.p2.y = 600 - data.y; 
        } else {
            // Клиент получает всё состояние от хоста
            game = data.state;
            gameStarted = data.started;
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    status.innerText = "ИГРА НАЧАТА";
    if (conn && conn.open) conn.send({ type: 'START' });
}

// Управление пальцем/мышкой
const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const clientY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    // Ограничиваем движение: только своя половина (нижняя)
    let myX = Math.max(20, Math.min(380, clientX));
    let myY = Math.max(320, Math.min(580, clientY)); 

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

    // Стенки
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;

    // Столкновения с битами (физика круга)
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 35) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 2;
            game.ball.vx = Math.cos(angle) * speed;
            game.ball.vy = Math.sin(angle) * speed;
        }
    });

    // Трение и лимиты скорости
    game.ball.vx *= 0.98;
    game.ball.vy *= 0.98;

    // Гол
    if (game.ball.y < -10 || game.ball.y > 610) {
        game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
    }

    if (conn && conn.open) {
        conn.send({ state: game, started: gameStarted });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Поле
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();

    // Мы рисуем всё относительно текущего игрока.
    // Каждый игрок должен видеть себя СИНЕЙ битой ВНИЗУ.
    
    // Своя бита (всегда внизу)
    ctx.fillStyle = "#007bff";
    let myPos = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y}; // Для клиента инвертируем его же Y
    ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 25, 0, Math.PI*2); ctx.fill();

    // Чужая бита (всегда вверху)
    ctx.fillStyle = "#ff4757";
    let oppPos = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    ctx.beginPath(); ctx.arc(oppPos.x, oppPos.y, 25, 0, Math.PI*2); ctx.fill();

    // Шайба
    ctx.fillStyle = "#fff";
    let ballY = isHost ? game.ball.y : 600 - game.ball.y;
    ctx.beginPath(); ctx.arc(game.ball.x, ballY, 12, 0, Math.PI*2); ctx.fill();
    
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ОЖИДАНИЕ ХОСТА...", 200, 300);
    }
}

function gameLoop() {
    update();
    draw();
    if (conn) requestAnimationFrame(gameLoop);
}
