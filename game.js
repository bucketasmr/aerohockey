const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const roomListUI = document.getElementById('roomList');
const qJoinBtn = document.getElementById('quickJoinBtn');

let peer, conn, isHost = false, gameStarted = false;
let myId = "";
let fastRoomId = null;
const PRE = "FXHOCKEY-"; 

let game = {
    p1: { x: 200, y: 530 },
    p2: { x: 200, y: 70 },
    ball: { x: 200, y: 300, vx: 0, vy: 0 },
    score1: 0, score2: 0
};

// --- ПЕРЕВОДЫ ---
const translations = {
    ru: {
        loading: "Загрузка системы...",
        noRooms: "НЕТ СВОБОДНЫХ ИГР",
        quickJoin: "БЫСТРАЯ ИГРА",
        create: "СОЗДАТЬ",
        join: "ВОЙТИ",
        code: "КОД",
        activeRooms: "АКТИВНЫЕ КОМНАТЫ:",
        searching: "Поиск игроков...",
        start: "СТАРТ",
        toMenu: "В МЕНЮ",
        waitingPlayer: "ОЖИДАНИЕ ИГРОКА",
        connected: "ИГРОК ПОДКЛЮЧИЛСЯ",
        waitingHost: "ОЖИДАНИЕ ХОСТА...",
        errorRoom: "Ошибка: Комната не найдена.",
        enterBtn: "ВХОД"
    },
    uk: {
        loading: "Завантаження системи...",
        noRooms: "НЕМАЄ ВІЛЬНИХ ІГОР",
        quickJoin: "ШВИДКА ГРА",
        create: "СТВОРИТИ",
        join: "УВІЙТИ",
        code: "КОД",
        activeRooms: "АКТИВНІ КІМНАТИ:",
        searching: "Пошук гравців...",
        start: "СТАРТ",
        toMenu: "В МЕНЮ",
        waitingPlayer: "ОЧІКУВАННЯ ГРАВЦЯ",
        connected: "ГРАВЕЦЬ ПРИЄДНАВСЯ",
        waitingHost: "ОЧІКУВАННЯ ХОСТА...",
        errorRoom: "Помилка: Кімнату не знайдено.",
        enterBtn: "ВХІД"
    },
    en: {
        loading: "System loading...",
        noRooms: "NO FREE ROOMS",
        quickJoin: "QUICK JOIN",
        create: "CREATE",
        join: "JOIN",
        code: "CODE",
        activeRooms: "ACTIVE ROOMS:",
        searching: "Searching for players...",
        start: "START",
        toMenu: "MENU",
        waitingPlayer: "WAITING FOR PLAYER",
        connected: "PLAYER CONNECTED",
        waitingHost: "WAITING FOR HOST...",
        errorRoom: "Error: Room not found.",
        enterBtn: "ENTER"
    }
};

let currentLang = 'ru';

function applyLanguage(lang) {
    currentLang = lang;
    document.getElementById('langSelect').value = lang;
    
    // Перевод всех элементов с атрибутом data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) el.innerText = translations[lang][key];
    });

    // Перевод плейсхолдеров
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) el.placeholder = translations[lang][key];
    });

    refreshLobby(); // Обновить текст на кнопках в списке
}

function changeLanguage(lang) {
    applyLanguage(lang);
    localStorage.setItem('prefLang', lang);
}

// --- СЕТЕВАЯ ЛОГИКА ---

function init() {
    // Определение языка
    const savedLang = localStorage.getItem('prefLang');
    const systemLang = navigator.language.split('-')[0];
    const targetLang = savedLang || (translations[systemLang] ? systemLang : 'en');
    applyLanguage(targetLang);

    myId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer = new Peer(PRE + myId);

    peer.on('open', (id) => {
        document.getElementById('status').style.display = 'none';
        document.getElementById('setupActions').style.display = 'block';
        setInterval(refreshLobby, 3000); 
    });

    peer.on('connection', (c) => {
        if (conn) return; 
        conn = c;
        isHost = true;
        setupConnection();
    });

    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') alert(translations[currentLang].errorRoom);
    });
}

function refreshLobby() {
    if (gameStarted || !peer || peer.destroyed) return;

    peer.listAllPeers((peers) => {
        if (!peers) return;
        const rooms = peers.filter(id => id.startsWith(PRE) && id !== (PRE + myId));

        if (rooms.length > 0) {
            fastRoomId = rooms[0];
            qJoinBtn.style.background = "#34c759";
            qJoinBtn.innerText = `${translations[currentLang].quickJoin} (${rooms.length})`;
            
            roomListUI.innerHTML = "";
            rooms.forEach(id => {
                const code = id.replace(PRE, "");
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `<span class="room-code">${code}</span>
                                 <button class="btn btn-mini" onclick="joinByCode('${code}')">${translations[currentLang].enterBtn}</button>`;
                roomListUI.appendChild(div);
            });
        } else {
            fastRoomId = null;
            qJoinBtn.style.background = "#ff3b30";
            qJoinBtn.innerText = translations[currentLang].noRooms;
            roomListUI.innerHTML = `<div style='opacity:0.5'>${translations[currentLang].searching}</div>`;
        }
    });
}

function createRoom() {
    isHost = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'flex';
    document.getElementById('hostControls').style.display = 'block';
    document.getElementById('roomCodeDisplay').innerText = myId;
}

function quickJoin() {
    if (fastRoomId) {
        joinByCode(fastRoomId.replace(PRE, ""));
    }
}

function joinRoom() {
    const code = document.getElementById('joinId').value.toUpperCase().trim();
    joinByCode(code);
}

function joinByCode(code) {
    if (!code) return;
    conn = peer.connect(PRE + code);
    isHost = false;
    setupConnection();
}

function setupConnection() {
    conn.on('open', () => {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'flex';
        document.getElementById('msgOverlay').style.display = 'flex';
        document.getElementById('overlayText').innerText = isHost ? translations[currentLang].connected : translations[currentLang].waitingHost;
        if (!isHost) document.getElementById('roomCodeDisplay').innerText = "";
        requestAnimationFrame(gameLoop);
    });

    conn.on('data', (data) => {
        if (data.type === 'START') {
            gameStarted = true;
            document.getElementById('msgOverlay').style.display = 'none';
        }
        if (isHost) {
            game.p2.x = data.x;
            game.p2.y = 600 - data.y;
        } else {
            game = data.state;
            if (data.started) {
                gameStarted = true;
                document.getElementById('msgOverlay').style.display = 'none';
            }
        }
    });
}

function startGame() {
    if (!conn) return;
    gameStarted = true;
    document.getElementById('msgOverlay').style.display = 'none';
    conn.send({ type: 'START' });
}

// --- ИГРОВАЯ ЛОГИКА ---

const handleInput = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);

    if (isHost) {
        game.p1.x = x; game.p1.y = Math.max(320, y);
    } else if (conn && conn.open) {
        conn.send({ x, y });
    }
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;
    if (game.ball.y < 15 || game.ball.y > 585) {
        if (game.ball.x > 130 && game.ball.x < 270) {
            if (game.ball.y < 0) { game.score2++; resetBall(); }
            else if (game.ball.y > 600) { game.score1++; resetBall(); }
        } else { game.ball.vy *= -1; }
    }
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x;
        let dy = game.ball.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) < 38) {
            let angle = Math.atan2(dy, dx);
            game.ball.vx = Math.cos(angle) * 8;
            game.ball.vy = Math.sin(angle) * 8;
        }
    });
    game.ball.vx *= 0.98; game.ball.vy *= 0.98;
    if (conn) conn.send({ state: game, started: gameStarted });
}

function resetBall() { game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

function draw() {
    ctx.clearRect(0, 0, 400, 600);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = "#34c759"; ctx.lineWidth = 8;
    ctx.strokeRect(135, 0, 130, 5); ctx.strokeRect(135, 595, 130, 5);
    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    let myPos = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let opPos = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    let bPos = isHost ? game.ball : {x: game.ball.x, y: 600 - game.ball.y};
    ctx.fillStyle = "#007aff"; ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(opPos.x, opPos.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bPos.x, bPos.y, 12, 0, 7); ctx.fill();
}

function gameLoop() {
    update(); draw();
    requestAnimationFrame(gameLoop);
}

init();
