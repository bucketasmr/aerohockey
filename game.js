const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const displayId = document.getElementById('displayId');

let peer, conn, isHost = false, gameStarted = false;
let ballParticles = [], lastBallPos = { x: 200, y: 300 };
let lang = localStorage.getItem('gameLang') || 'ru';

const dict = {
    ru: { loading: "СЕТЬ ГОТОВА", create: "СОЗДАТЬ", join: "ВОЙТИ", start: "СТАРТ", wait: "ЖДЕМ ХОСТА...", press: "ЖМИ СТАРТ" },
    uk: { loading: "МЕРЕЖА ГОТОВА", create: "СТВОРИТИ", join: "УВІЙТИ", start: "СТАРТ", wait: "ЧЕКАЄМО ХОСТА...", press: "ТИСНИ СТАРТ" },
    en: { loading: "NETWORK READY", create: "CREATE", join: "JOIN", start: "START", wait: "WAITING HOST...", press: "PRESS START" }
};

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "#333", trail: "#555", goal: "#34c759" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", trail: "#fff", glow: 15, goal: "#ff0" },
    { bg: "#1a0f2e", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", trail: "#ff71ce", goal: "#0f0" },
    { bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.2)", trail: "#fff", goal: "#fff" },
    { bg: "#081c08", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", trail: "#81c784", goal: "#e91e63" },
    { bg: "#140d02", wall: "#5d4037", p1: "#ffd54f", p2: "#3e2723", ball: "#ffeb3b", line: "#6d4c41", trail: "#ffd54f", goal: "#03a9f4" },
    { bg: "#0d0000", wall: "#800", p1: "#ffeb3b", p2: "#d50000", ball: "#ff9100", line: "#ff4500", trail: "#ff4500", glow: 15, goal: "#fff" },
    { bg: "#02020a", wall: "#1a237e", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.1)", trail: "#fff", goal: "#fee715" },
    { bg: "#010816", wall: "#00ff41", p1: "#fee715", p2: "#ff00a0", ball: "#00ff41", line: "#001a00", trail: "#00ff41", goal: "#fff" }
];

let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0, skin: 0 };

const peerOptions = { config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }, { url: 'stun:stun1.l.google.com:19302' }] } };

peer = new Peer(peerOptions);
peer.on('open', () => {
    document.getElementById('status').innerText = dict[lang].loading;
    document.getElementById('setupActions').style.display = 'block';
    applyTranslation();
});

function applyTranslation() {
    document.querySelectorAll('[data-i18n]').forEach(el => el.innerText = dict[lang][el.getAttribute('data-i18n')]);
    document.getElementById('langSelect').value = lang;
}
function changeLanguage(v) { lang = v; localStorage.setItem('gameLang', v); applyTranslation(); }
function changeSkin(v) { if(isHost) game.skin = parseInt(v); }

function createRoom() {
    isHost = true;
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(id, peerOptions);
        peer.on('open', resId => showUI(resId));
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                document.getElementById('skinSelectorContainer').style.display = 'block';
                setupLoops();
            });
        });
    }, 300);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(peerOptions);
        peer.on('open', () => {
            conn = peer.connect(id, { reliable: false });
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
    document.getElementById('skinSelectorContainer').style.display = 'none';
    displayId.classList.replace('id-large', 'id-small');
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = x; game.p1.y = Math.max(320, y); }
    else if (conn && conn.open) conn.send({ x: x, y: y });
}, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    
    if (game.ball.x < 15 || game.ball.x > 385) { game.ball.vx *= -1; game.ball.x = game.ball.x < 15 ? 15 : 385; }
    
    if (game.ball.y < 5 || game.ball.y > 595) {
        if (game.ball.x > 135 && game.ball.x < 265) {
            if (game.ball.y < -10 || game.ball.y > 610) {
                if (game.ball.y < 0) game.score2++; else game.score1++;
                game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
            }
        } else {
            game.ball.vy *= -1;
            game.ball.y = game.ball.y < 5 ? 5 : 595;
        }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 38) {
            let angle = Math.atan2(dy, dx);
            let speed = Math.sqrt(game.ball.vx**2 + game.ball.vy**2) + 2;
            game.ball.vx = Math.cos(angle) * Math.min(speed, 12);
            game.ball.vy = Math.sin(angle) * Math.min(speed, 12);
            game.ball.x = p.x + Math.cos(angle) * 39;
            game.ball.y = p.y + Math.sin(angle) * 39;
        }
    });
    game.ball.vx *= 0.99; game.ball.vy *= 0.99;
    if (conn && conn.open) conn.send({ state: game, started: gameStarted });
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    
    // Разметка и ворота
    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    ctx.strokeStyle = s.wall; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 394, 594);
    
    // Ворота (видимые)
    ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.strokeStyle = s.goal;
    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.goal; }
    ctx.beginPath(); ctx.moveTo(135, 5); ctx.lineTo(265, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 595); ctx.lineTo(265, 595); ctx.stroke();
    ctx.shadowBlur = 0;

    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y};
    let op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    let bPos = { x: game.ball.x, y: isHost ? game.ball.y : 600 - game.ball.y };

    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.wall; }
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.ball; ctx.beginPath(); ctx.arc(bPos.x, bPos.y, 12, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.textAlign = "center";
        ctx.fillText(isHost ? dict[lang].press : dict[lang].wait, 200, 300);
    }
}

function gameLoop() { update(); draw(); if (conn && conn.open) requestAnimationFrame(gameLoop); }
