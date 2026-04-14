const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

let peer, conn;
let isHost = false;

// Состояние игры
let game = {
    p1: { x: 200, y: 550, score: 0 }, // Нижний (вы)
    p2: { x: 200, y: 50, score: 0 },  // Верхний (соперник)
    ball: { x: 200, y: 300, vx: 0, vy: 0 }
};

// Инициализация PeerJS
function initPeer() {
    peer = new Peer();
    peer.on('open', id => {
        document.getElementById('displayId').innerText = id;
        if (!isHost) status.innerText = "Готов к подключению...";
    });

    peer.on('connection', c => {
        conn = c;
        setupConnection();
    });
}

function createRoom() {
    isHost = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    initPeer();
}

function joinRoom() {
    const id = document.getElementById('joinId').value;
    if (!id) return alert("Введите ID!");
    isHost = false;
    initPeer();
    
    peer.on('open', () => {
        conn = peer.connect(id);
        setupConnection();
    });
}

function setupConnection() {
    conn.on('open', () => {
        status.innerText = "Игрок подключен!";
        canvas.style.display = 'block';
        gameLoop();
    });

    conn.on('data', data => {
        // Получаем координаты от другого игрока
        if (isHost) {
            game.p2.x = data.x; // Хост получает позицию клиента (верх)
        } else {
            game = data; // Клиент получает все состояние игры от хоста
        }
    });
}

// Управление (мышь/тач)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Ограничиваем движение своей половиной поля
    game.p1.x = mouseX;
    
    // Отправляем свои координаты
    if (conn && conn.open) {
        if (isHost) {
            conn.send(game); 
        } else {
            conn.send({ x: mouseX });
        }
    }
});

function update() {
    if (!isHost) return; // Только хост считает физику

    // Движение шайбы
    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // Очень простая физика отскока от стенок
    if (game.ball.x <= 0 || game.ball.x >= 400) game.ball.vx *= -1;
    
    // Проверка столкновения с битами (упрощенно)
    checkCollision(game.p1);
    checkCollision(game.p2);

    // Отправка данных клиенту
    if (conn && conn.open) conn.send(game);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Отрисовка поля
    ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();

    // Биты
    ctx.fillStyle = "blue";
    ctx.beginPath(); ctx.arc(game.p1.x, game.p1.y, 20, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = "red";
    ctx.beginPath(); ctx.arc(game.p2.x, isHost ? game.p2.y : 600 - game.p2.y, 20, 0, Math.PI*2); ctx.fill();

    // Шайба
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(game.ball.x, game.ball.y, 10, 0, Math.PI*2); ctx.fill();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function checkCollision(p) {
    let dx = game.ball.x - p.x;
    let dy = game.ball.y - p.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 30) {
        game.ball.vx = dx * 0.2;
        game.ball.vy = dy * 0.2;
    }
}
