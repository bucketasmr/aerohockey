const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const btnResetBall = document.getElementById('btnResetBall');

let peer, conn;
let isHost = false;
let gameStarted = false;

// Константы размеров (чтобы математика была точной)
const W = 400; // Ширина поля внутри canvas
const H = 600; // Высота поля
const BIT_R = 25; // Радиус биты
const BALL_R = 12; // Радиус шайбы
const WALL_T = 5; // Толщина видимой рамки (для отступа)

// Состояние игры
let game = {
    p1: { x: W / 2, y: H - 70 }, // Хост (Синий)
    p2: { x: W / 2, y: 70 },      // Клиент (Красный)
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    score1: 0,
    score2: 0
};

// Генерация короткого ID (исправил, чтобы точно 5 символов)
function generateShortId() {
    let result = '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без похожих O/0, I/1
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

// Показываем меню после загрузки PeerJS
const showMenu = () => {
    status.innerText = "Выберите режим игры";
    document.getElementById('btnCreate').style.display = 'inline-block';
    document.getElementById('joinArea').style.display = 'block';
};

// Инициализация при старте
peer = new Peer(); 
peer.on('open', showMenu);
peer.on('error', (err) => {
    console.error(err);
    status.innerText = "Ошибка сети. Обновите страницу.";
});

function createRoom() {
    isHost = true;
    const shortId = generateShortId();
    // Пересоздаем Peer с коротким ID
    peer.destroy();
    
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => {
            switchToGameUI();
            displayId.innerText = id;
            status.innerText = "Ожидание подключения...";
            status.style.display = 'block';
        });
        peer.on('connection', setupHostConnection);
        peer.on('error', (err) => {
            if(err.type === 'unavailable-id') alert("Код занят, попробуйте снова.");
            else alert("Ошибка создания: " + err.type);
            location.reload();
        });
    }, 200);
}

function joinRoom() {
    let id = document.getElementById('joinId').value.toUpperCase().trim();
    if (id.length !== 5) return alert("Введите 5 символов кода!");
    isHost = false;
    switchToGameUI();
    displayId.innerText = id;
    status.innerText = "Соединение...";
    
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id, { reliable: true });
            setupClientConnection(conn);
        });
        peer.on('error', () => { alert("Комната не найдена."); location.reload(); });
    }, 200);
}

function switchToGameUI() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
}

// Логика Хоста
function setupHostConnection(c) {
    conn = c;
    conn.on('open', () => {
        status.innerText = "Игрок подключился! Нажмите Старт.";
        document.getElementById('hostControls').style.display = 'block';
        document.getElementById('gameArea').style.display = 'block';
        scoreDisplay.style.display = 'block';
        setupDataListener();
    });
}

// Логика Клиента
function setupClientConnection(c) {
    c.on('open', () => {
        status.innerText = "Подключено. Ждем старта...";
        document.getElementById('gameArea').style.display = 'block';
        scoreDisplay.style.display = 'block';
        setupDataListener();
    });
}

function setupDataListener() {
    conn.on('data', data => {
        if (data.type === 'START') {
            gameStarted = true;
            status.style.display = 'none';
            if (isHost) btnResetBall.style.display = 'block'; // Показываем кнопку сброса только хосту
        } else if (data.type === 'RESET_REQ') {
            // Если клиент просит сброс (на будущее), но пока сброс только у хоста
            if(isHost) resetBall(); 
        } else if (isHost) {
            game.p2.x = data.x;
            game.p2.y = H - data.y; // Инверсия Y
        } else {
            game = data.state;
            gameStarted = data.started;
        }
    });
    conn.on('close', () => { alert("Соперник отключился."); location.reload(); });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('btnStartGame').style.display = 'none';
    status.style.display = 'none';
    btnResetBall.style.display = 'block'; // Показываем кнопку сброса хосту
    
    let attempts = 0;
    const interval = setInterval(() => {
        if (conn && conn.open) conn.send({ type: 'START' });
        if (++attempts > 7) clearInterval(interval);
    }, 250);
}

// Кнопка Сброса Мяча (только для Хоста)
function manualBallReset() {
    if (!isHost || !gameStarted) return;
    // Кратковременно "гасим" кнопку, чтобы не спамили
    btnResetBall.disabled = true;
    btnResetBall.innerText = "⏱️";
    resetBall();
    setTimeout(() => {
        btnResetBall.disabled = false;
        btnResetBall.innerText = "🆘 СБРОС МЯЧА";
    }, 1000);
}

const handleInput = (e) => {
    if (!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    
    // Получаем сырые координаты касания/мыши
    let rawX, rawY;
    if (e.touches) {
        rawX = e.touches[0].clientX - rect.left;
        rawY = e.touches[0].clientY - rect.top;
    } else {
        rawX = e.clientX - rect.left;
        rawY = e.clientY - rect.top;
    }
    
    // Масштабируем CSS-пиксели в внутренние координаты canvas (400x600)
    const x = rawX * (W / rect.width);
    const y = rawY * (H / rect.height);

    // Ограничиваем движение: только своя (нижняя) половина с отступами
    let myX = Math.max(BIT_R + WALL_T, Math.min(W - BIT_R - WALL_T, x));
    let myY = Math.max(H/2 + BIT_R + 2, Math.min(H - BIT_R - WALL_T, y));

    if (isHost) {
        game.p1.x = myX; game.p1.y = myY;
    } else {
        // Клиент отправляет свои координаты (он думает, что он внизу)
        if (conn && conn.open) conn.send({ x: myX, y: myY });
    }
};

// Обработчики ввода (touchmove с passive: false обязателен для iOS)
canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', (e) => {
    if(e.cancelable) e.preventDefault(); 
    handleInput(e);
}, {passive: false});

// ==========================================
// ФИЗИКА И ОБНОВЛЕНИЕ (ТОЛЬКО ХОСТ)
// ==========================================
function update() {
    if (!isHost || !gameStarted) return;

    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // --- ЖЕСТКАЯ КОРРЕКЦИЯ ОТСКОКА ОТ СТЕН (ИСПРАВЛЕНИЕ БАГА) ---
    const minBallX = WALL_T + BALL_R;
    const maxBallX = W - WALL_T - BALL_R;
    const minBallY = WALL_T + BALL_R;
    const maxBallY = H - WALL_T - BALL_R;

    // Отскок от ЛЕВОЙ И ПРАВОЙ стены
    if (game.ball.x < minBallX) {
        game.ball.x = minBallX; // Принудительно возвращаем на поле
        game.ball.vx *= -1;
    } else if (game.ball.x > maxBallX) {
        game.ball.x = maxBallX; // Принудительно возвращаем на поле
        game.ball.vx *= -1;
    }

    // ЛОГИКА ВОРОТ И ЗАДНИХ СТЕН
    const goalL = 140, goalR = 260; // Границы ворот по X

    // ВЕРХНЯЯ стенка (сторона Клиента для Хоста)
    if (game.ball.y < minBallY) {
        // Проверка: попали в ворота?
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y < -BALL_R * 2) { // Улетела глубоко
                game.score1++; // Хост забил
                resetBall();
                return; // Выходим из update, чтобы не считать отскок
            }
        } else {
            // Отскок от стены
            game.ball.y = minBallY;
            game.ball.vy *= -1;
        }
    }

    // НИЖНЯЯ стенка (сторона Хоста)
    if (game.ball.y > maxBallY) {
        // Проверка: попали в ворота?
        if (game.ball.x > goalL && game.ball.x < goalR) {
            if (game.ball.y > H + BALL_R * 2) { // Улетела глубоко
                game.score2++; // Клиент забил
                resetBall();
                return;
            }
        } else {
            // Отскок от стены
            game.ball.y = maxBallY;
            game.ball.vy *= -1;
        }
    }

    // Соударения с битами (физика кругов)
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = BIT_R + BALL_R;
        
        if (dist < minDist) {
            // Выталкиваем шайбу, чтобы не "слипались"
            let angle = Math.atan2(dy, dx);
            game.ball.x = p.x + Math.cos(angle) * minDist;
            game.ball.y = p.y + Math.sin(angle) * minDist;
            
            // Считаем новую скорость (старая скорость + импульс от движения биты)
            let speed = Math.min(Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 4, 14); // Ограничим макс скорость
            game.ball.vx = Math.cos(angle) * speed;
            game.ball.vy = Math.sin(angle) * speed;
        }
    });

    // Трение (постепенное замедление)
    game.ball.vx *= 0.99;
    game.ball.vy *= 0.99;

    // Синхронизация: Хост отправляет всё состояние
    if (conn && conn.open) conn.send({ state: game, started: gameStarted });
}

function resetBall() {
    game.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    // Даем небольшую случайную начальную скорость, чтобы не стояла на месте
    setTimeout(() => {
        game.ball.vx = (Math.random() - 0.5) * 2;
        game.ball.vy = (Math.random() - 0.5) * 2;
    }, 500);
}

// ==========================================
// ОТРИСОВКА (ДЛЯ ОБОИХ)
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Разметка поля
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    // Центр
    ctx.beginPath(); ctx.arc(W/2, H/2, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    // Видимая рамка (границы)
    ctx.strokeStyle = "#444"; ctx.lineWidth = WALL_T;
    ctx.strokeRect(WALL_T/2, WALL_T/2, W - WALL_T, H - WALL_T);

    // Ворота (Зеленые зоны)
    ctx.lineWidth = 6; ctx.strokeStyle = "#34c759"; ctx.shadowColor = "#34c759"; ctx.shadowBlur = 10;
    // Границы ворот за рамкой поля для визуализации глубины
    ctx.beginPath(); ctx.moveTo(140, WALL_T); ctx.lineTo(260, WALL_T); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(140, H - WALL_T); ctx.lineTo(260, H - WALL_T); ctx.stroke();
    ctx.shadowBlur = 0; // Выключаем свечение для остального

    // Обновление HTML счета
    scoreDisplay.innerText = isHost ? 
        `ВЫ ${game.score1} : ${game.score2} ВРАГ` : 
        `ВЫ ${game.score2} : ${game.score1} ВРАГ`;

    // БИТЫ (Своя - Синяя, Чужая - Красная)
    ctx.shadowBlur = 15;
    
    // 1. Рисуем ВАШУ биту (она всегда снизу на экране)
    ctx.fillStyle = "#007aff"; ctx.shadowColor = "#007aff";
    let myCoords = isHost ? game.p1 : { x: game.p2.x, y: H - game.p2.y };
    ctx.beginPath(); ctx.arc(myCoords.x, myCoords.y, BIT_R, 0, Math.PI*2); ctx.fill();

    // 2. Рисуем ЧУЖУЮ биту (она всегда сверху)
    ctx.fillStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30";
    let opCoords = isHost ? game.p2 : { x: game.p1.x, y: H - game.p1.y };
    ctx.beginPath(); ctx.arc(opCoords.x, opCoords.y, BIT_R, 0, Math.PI*2); ctx.fill();

    // ШАЙБА
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
    let bY = isHost ? game.ball.y : H - game.ball.y;
    // Коррекция: если шайба улетает в ворота, не рисуем её за пределами canvas на iOS
    let drawBY = Math.max(-BALL_R, Math.min(H + BALL_R, bY));
    ctx.beginPath(); ctx.arc(game.ball.x, drawBY, BALL_R, 0, Math.PI*2); ctx.fill();
    
    ctx.shadowBlur = 0; // Сброс теней
    
    // Оверлей паузы
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ОЖИДАНИЕ ХОСТА...", W/2, H/2);
    }
}

function gameLoop() {
    update();
    draw();
    if (conn && conn.open) requestAnimationFrame(gameLoop);
}
