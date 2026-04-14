const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');

let peer, conn, isHost = false, gameStarted = false;
let lang = localStorage.getItem('gameLang') || 'ru';

// СЛОВАРЬ ПЕРЕВОДОВ
const dict = {
    ru: { loading: "СЕТЬ ГОТОВА", create: "СОЗДАТЬ", join: "ВОЙТИ", code: "КОД", start: "СТАРТ", wait: "ЖДЕМ ХОСТА...", press: "ЖМИ СТАРТ" },
    uk: { loading: "МЕРЕЖА ГОТОВА", create: "СТВОРИТИ", join: "УВІЙТИ", code: "КОД", start: "СТАРТ", wait: "ЧЕКАЄМО ХОСТА...", press: "ТИСНИ СТАРТ" },
    en: { loading: "NETWORK READY", create: "CREATE", join: "JOIN", code: "CODE", start: "START", wait: "WAITING HOST...", press: "PRESS START" }
};

function applyTranslation() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = dict[lang][el.getAttribute('data-i18n')];
    });
    const input = document.querySelector('[data-i18n-hold]');
    if(input) input.placeholder = dict[lang][input.getAttribute('data-i18n-hold')];
    document.getElementById('langSelect').value = lang;
}

function changeLanguage(v) { lang = v; localStorage.setItem('gameLang', v); applyTranslation(); }

// КОНФИГУРАЦИЯ ДЛЯ ГЛОБАЛЬНОЙ ИГРЫ (STUN-серверы Google)
const peerOptions = {
    config: { 'iceServers': [
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:stun1.l.google.com:19302' },
        { url: 'stun:stun2.l.google.com:19302' }
    ]},
    debug: 1
};

let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0 };

peer = new Peer(peerOptions);
peer.on('open', () => {
    document.getElementById('status').innerText = dict[lang].loading;
    document.getElementById('setupActions').style.display = 'block';
    applyTranslation();
});

function createRoom() {
    isHost = true;
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(id, peerOptions);
        peer.on('open', resId => { showUI(resId); });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                setupLoops();
            });
        });
    }, 300);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length < 3) return;
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(peerOptions);
        peer.on('open', () => {
            conn = peer.connect(id, { reliable: true });
            conn.on('open', () => { showUI(id); setupLoops(); });
        });
    }, 300);
}

function showUI(id) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'flex';
    displayId.innerText = id;
}

function setupLoops() {
    conn.on('data', data => {
        if (data.type === 'START') gameStarted = true;
        if (isHost) { if(data.x) { game.p2.x = data.x; game.p2.y = 600 - data.y; } }
        else { if(data.state) game = data.state; gameStarted = data.started; }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    displayId.classList.replace('id-large', 'id-small');
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = x; game.p1.y = Math.max(320, y); }
    else if (conn.open) conn.send({ x: x, y: y });
};

canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;
    if (game.ball.y < 0 || game.ball.y > 600) {
        if (game.ball.y < 0) game.score1++; else game.score2++;
        game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
    }
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 38) {
            game.ball.vx = (game.ball.x - p.x) * 0.25;
            game.ball.vy = (game.ball.y - p.y) * 0.25;
        }
    });
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

function draw() {
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, 400, 600);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    
    ctx.fillStyle = "#007aff"; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(game.ball.x, isHost?game.ball.y:600-game.ball.y, 12, 0, 7); ctx.fill();
    
    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.textAlign = "center";
        ctx.fillText(isHost ? dict[lang].press : dict[lang].wait, 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn && conn.open) requestAnimationFrame(gameLoop); }
