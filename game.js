const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const displayId = document.getElementById('displayId');
const scoreDisplay = document.getElementById('scoreDisplay');
const resetBtn = document.getElementById('resetBtn');

let peer, conn, isHost = false, gameStarted = false;
let ballParticles = [], bgParticles = [], eventsFX = [];
let lastEventTime = Date.now();

const translations = {
    ru: {
        loading: "Загрузка...",
        create: "СОЗДАТЬ",
        join: "ВОЙТИ",
        code: "КОД",
        start: "СТАРТ",
        pressStart: "ЖМИ СТАРТ",
        waitingHost: "ЖДЕМ ХОСТА...",
        invalidCode: "Ошибка: Код слишком короткий"
    },
    uk: {
        loading: "Завантаження...",
        create: "СТВОРИТИ",
        join: "УВІЙТИ",
        code: "КОД",
        start: "СТАРТ",
        pressStart: "ТИСНИ СТАРТ",
        waitingHost: "ЧЕКАЄМО ХОСТА...",
        invalidCode: "Помилка: Код занадто короткий"
    },
    en: {
        loading: "Loading...",
        create: "CREATE",
        join: "JOIN",
        code: "CODE",
        start: "START",
        pressStart: "PRESS START",
        waitingHost: "WAITING FOR HOST...",
        invalidCode: "Error: Code is too short"
    }
};

let currentLang = 'ru';

function applyLanguage(lang) {
    currentLang = lang;
    document.getElementById('langSelect').value = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) el.innerText = translations[lang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) el.placeholder = translations[lang][key];
    });
}

function changeLanguage(lang) {
    applyLanguage(lang);
    localStorage.setItem('prefLang', lang);
}

const skins = [
    { bg: "#1a1a1a", wall: "#444", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "#333", trail: "#555", goalColor: "#34c759", fx: "none" },
    { bg: "#000", wall: "#0ff", p1: "#0f0", p2: "#f0f", ball: "#fff", line: "#0ff", trail: "#fff", glow: 15, goalColor: "#ff0", fx: "neon" },
    { bg: "#1a0f2e", wall: "#ff71ce", p1: "#01cdfe", p2: "#b967ff", ball: "#fff", line: "#ff71ce", trail: "#ff71ce", goalColor: "#0f0", fx: "retro" },
    { bg: "#2d5a27", wall: "#1e3d1a", p1: "#007aff", p2: "#ff3b30", ball: "#fff", line: "rgba(255,255,255,0.2)", trail: "rgba(255,255,255,0.4)", goalColor: "#fff", fx: "grass" },
    { bg: "#081c08", wall: "#2e7d32", p1: "#fb8c00", p2: "#4e342e", ball: "#fff", line: "#4caf50", trail: "#81c784", goalColor: "#e91e63", fx: "forest" },
    { bg: "#140d02", wall: "#5d4037", p1: "#ffd54f", p2: "#3e2723", ball: "#ffeb3b", line: "#6d4c41", trail: "#ffd54f", goalColor: "#03a9f4", fx: "tomb" },
    { bg: "#0d0000", wall: "#800", p1: "#ffeb3b", p2: "#d50000", ball: "#ff9100", line: "#ff4500", trail: "#ff4500", glow: 15, goalColor: "#fff", fx: "lava" },
    { bg: "#02020a", wall: "#1a237e", p1: "#00e5ff", p2: "#d500f9", ball: "#e0e0e0", line: "rgba(255,255,255,0.1)", trail: "#fff", goalColor: "#fee715", fx: "space" },
    { bg: "#010816", wall: "#00ff41", p1: "#fee715", p2: "#ff00a0", ball: "#00ff41", line: "#001a00", trail: "#00ff41", goalColor: "#fff", fx: "cyber" }
];

let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, score1: 0, score2: 0, skin: 0 };
let lastBallPos = { x: 200, y: 300 };

class Particle {
    constructor(x, y, color, size, vx, vy, life) {
        this.x = x; this.y = y; this.color = color; this.size = size;
        this.vx = vx; this.vy = vy; this.life = life; this.maxLife = life;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
}

window.addEventListener('load', () => {
    const savedLang = localStorage.getItem('prefLang');
    const systemLang = navigator.language.split('-')[0];
    const targetLang = savedLang || (translations[systemLang] ? systemLang : 'en');
    applyLanguage(targetLang);
});

peer = new Peer();
peer.on('open', () => document.getElementById('setupActions').style.display = 'block');

function changeSkin(val) { if(isHost) game.skin = parseInt(val); ballParticles = []; bgParticles = []; eventsFX = []; }

function createRoom() {
    isHost = true;
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(shortId);
        peer.on('open', id => { showUI(id); resetBtn.style.display = 'block'; });
        peer.on('connection', c => {
            conn = c;
            conn.on('open', () => {
                document.getElementById('hostControls').style.display = 'block';
                document.getElementById('skinSelectorContainer').style.display = 'block';
                setupLoops();
            });
        });
    }, 200);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(id.length < 3) { alert(translations[currentLang].invalidCode); return; }
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer();
        peer.on('open', () => {
            conn = peer.connect(id);
            conn.on('open', () => { showUI(id); setupLoops(); });
        });
    }, 200);
}

function showUI(id) { document.getElementById('menu').style.display = 'none'; document.getElementById('gameUI').style.display = 'block'; displayId.innerText = id; }

function setupLoops() {
    document.getElementById('gameArea').style.display = 'block';
    conn.on('data', data => {
        if (data.type === 'START') setGameStartedUI();
        else if (isHost) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        else { game = data.state; gameStarted = data.started; if(gameStarted) setGameStartedUI(); }
    });
    requestAnimationFrame(gameLoop);
}

function setGameStartedUI() {
    gameStarted = true;
    displayId.classList.remove('id-large');
    displayId.classList.add('id-small');
}

function sendStartSignal() {
    setGameStartedUI();
    document.getElementById('hostControls').style.display = 'none';
    setInterval(() => { if(conn && conn.open) conn.send({ type: 'START' }); }, 500);
}

function manualBallReset() { if(isHost) game.ball = { x: 200, y: 300, vx: 0, vy: 0 }; }

const handleInput = (e) => {
    if(!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = Math.max(25, Math.min(375, x)); game.p1.y = Math.max(320, Math.min(575, y)); }
    else if (conn.open) conn.send({ x: Math.max(25, Math.min(375, x)), y: Math.max(320, Math.min(575, y)) });
};

canvas.addEventListener('mousemove', handleInput);
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e); }, {passive: false});

function update() {
    if (!isHost || !gameStarted) return;
    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    if (game.ball.x < 16 || game.ball.x > 384) { game.ball.x = game.ball.x < 16 ? 16 : 384; game.ball.vx *= -1; }
    if (game.ball.y < 16) {
        if (game.ball.x > 135 && game.ball.x < 265) { if (game.ball.y < -20) { game.score1++; manualBallReset(); } }
        else { game.ball.y = 16; game.ball.vy *= -1; }
    }
    if (game.ball.y > 584) {
        if (game.ball.x > 135 && game.ball.x < 265) { if (game.ball.y > 620) { game.score2++; manualBallReset(); } }
        else { game.ball.y = 584; game.ball.vy *= -1; }
    }
    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 37) {
            let a = Math.atan2(dy, dx), s = Math.min(Math.sqrt(game.ball.vx**2+game.ball.vy**2)+6, 15);
            game.ball.vx = Math.cos(a)*s; game.ball.vy = Math.sin(a)*s;
            game.ball.x = p.x+Math.cos(a)*38; game.ball.y = p.y+Math.sin(a)*38;
        }
    });
    game.ball.vx *= 0.988; game.ball.vy *= 0.988;
    if (conn.open) conn.send({ state: game, started: gameStarted });
}

function drawFX(s) {
    const rB = isHost ? game.ball : { x: game.ball.x, y: 600 - game.ball.y };
    if (Math.abs(rB.x - lastBallPos.x) + Math.abs(rB.y - lastBallPos.y) > 2) {
        ballParticles.push(new Particle(rB.x, rB.y, s.trail, Math.random()*4, -(rB.x-lastBallPos.x)*0.2, -(rB.y-lastBallPos.y)*0.2, 20));
    }
    lastBallPos = { x: rB.x, y: rB.y };
    if (s.fx === 'space') { if(Math.random() > 0.98) bgParticles.push(new Particle(Math.random()*400, 0, "#fff", 1, 0.2, 0.6, 150)); }
    else if (s.fx === 'lava') { if(Math.random() > 0.95) bgParticles.push(new Particle(Math.random()*400, 600, "#ff4500", 1, 0, -1, 60)); }
    else if (s.fx === 'forest') { if(Math.random() > 0.96) bgParticles.push(new Particle(Math.random()*400, 600, "#aaffaa", 1, (Math.random()-0.5), -0.5, 100)); }
    eventsFX.forEach((ev, i) => {
        ev.progress += 0.005; ctx.globalAlpha = Math.sin(ev.progress * Math.PI) * 0.2;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ev.progress*600, ev.y, 50, 0, 7); ctx.fill();
        if (ev.progress >= 1) eventsFX.splice(i, 1);
    });
    [bgParticles, ballParticles].forEach(arr => {
        for(let i=arr.length-1; i>=0; i--) {
            arr[i].update();
            if(arr[i].life <= 0) arr.splice(i, 1);
            else { ctx.globalAlpha = arr[i].life/arr[i].maxLife; ctx.fillStyle = arr[i].color; ctx.beginPath(); ctx.arc(arr[i].x, arr[i].y, arr[i].size, 0, 7); ctx.fill(); }
        }
    });
    ctx.globalAlpha = 1;
}

function draw() {
    const s = skins[game.skin] || skins[0];
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 400, 600);
    if (s.fx === 'grass') { for(let i=0; i<600; i+=60) { ctx.fillStyle = i%120===0 ? "#2d5a27" : "#32622c"; ctx.fillRect(5, i+5, 390, 50); } }
    drawFX(s);
    ctx.strokeStyle = s.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(200, 300, 40, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    ctx.strokeStyle = s.wall; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 394, 594);
    ctx.lineCap = "round"; ctx.strokeStyle = s.goalColor; ctx.shadowBlur = 10; ctx.shadowColor = s.goalColor; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(135, 5); ctx.lineTo(265, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(135, 595); ctx.lineTo(265, 595); ctx.stroke();
    ctx.shadowBlur = 0;
    scoreDisplay.innerText = isHost ? `${game.score1} : ${game.score2}` : `${game.score2} : ${game.score1}`;
    let my = isHost ? game.p1 : {x: game.p2.x, y: 600 - game.p2.y}, op = isHost ? game.p2 : {x: game.p1.x, y: 600 - game.p1.y};
    if(s.glow) { ctx.shadowBlur = s.glow; ctx.shadowColor = s.wall; }
    ctx.fillStyle = s.p1; ctx.beginPath(); ctx.arc(my.x, my.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.p2; ctx.beginPath(); ctx.arc(op.x, op.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = s.ball; ctx.beginPath(); ctx.arc(game.ball.x, isHost?game.ball.y:600-game.ball.y, 12, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    if (!gameStarted) { 
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,400,600); ctx.fillStyle = "#fff"; 
        ctx.textAlign = "center"; ctx.font = "20px Segoe UI";
        ctx.fillText(isHost ? translations[currentLang].pressStart : translations[currentLang].waitingHost, 200, 300); 
    }
}

function gameLoop() { update(); draw(); if (conn && conn.open) requestAnimationFrame(gameLoop); }

// Исправленная функция Fullscreen
document.getElementById('fsBtn').addEventListener('click', () => {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
});
