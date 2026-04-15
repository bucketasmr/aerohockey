const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const statusEl = document.getElementById('status');

let peer, conn, isHost = false, gameStarted = false;
let lastPacketTime = Date.now();
let game = { p1: { x: 200, y: 530 }, p2: { x: 200, y: 70 }, ball: { x: 200, y: 300, vx: 0, vy: 0 }, s1: 0, s2: 0 };

// МАКСИМАЛЬНО СТАБИЛЬНЫЕ НАСТРОЙКИ ДЛЯ США-УКРАИНА
const peerConfig = {
    debug: 1,
    pingInterval: 2000, // Частое подтверждение связи
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
        ],
        'iceCandidatePoolSize': 10
    }
};

function init() {
    peer = new Peer(peerConfig);
    peer.on('open', () => {
        if (statusEl) statusEl.innerText = "СЕТЬ ГОТОВА";
        document.getElementById('setupActions').style.display = 'block';
    });
    peer.on('error', (err) => {
        console.error(err);
        if (statusEl) statusEl.innerText = "Сбой: " + err.type;
        if (err.type === 'network' || err.type === 'server-error') setTimeout(init, 2000);
    });
}
init();

function createRoom() {
    isHost = true;
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(id, peerConfig);
        peer.on('open', resId => {
            document.getElementById('menu').style.display = 'none';
            document.getElementById('gameUI').style.display = 'flex';
            document.getElementById('displayId').innerText = "КОД: " + resId;
        });
        peer.on('connection', c => {
            conn = c;
            setupEvents();
        });
    }, 500);
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if(!id) return;
    isHost = false;
    peer.destroy();
    setTimeout(() => {
        peer = new Peer(peerConfig);
        peer.on('open', () => {
            // Увеличиваем надежность за счет надежного канала (reliable: true)
            conn = peer.connect(id, { reliable: true, connectionPriority: 'high' });
            conn.on('open', () => {
                document.getElementById('menu').style.display = 'none';
                document.getElementById('gameUI').style.display = 'flex';
                document.getElementById('displayId').innerText = "В ИГРЕ";
                setupEvents();
            });
        });
    }, 500);
}

function setupEvents() {
    conn.on('data', data => {
        lastPacketTime = Date.now();
        if (data === 'START') gameStarted = true;
        if (isHost) {
            if (data.x !== undefined) { game.p2.x = data.x; game.p2.y = 600 - data.y; }
        } else {
            if (data.g) game = data.g;
            gameStarted = data.s;
        }
    });
    requestAnimationFrame(gameLoop);
}

function sendStartSignal() {
    gameStarted = true;
    document.getElementById('hostControls').style.display = 'none';
    const startInt = setInterval(() => {
        if (conn && conn.open) conn.send('START');
        else clearInterval(startInt);
    }, 1000);
}

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * (400 / rect.width);
    const y = (t.clientY - rect.top) * (600 / rect.height);
    if (isHost) { game.p1.x = x; game.p1.y = Math.max(320, y); }
    else if (conn && conn.open) conn.send({ x: x, y: y });
}, { passive: false });

function update() {
    if (!isHost || !gameStarted) return;
    
    // Проверка на лаг (5 секунд тишины — пауза)
    if (Date.now() - lastPacketTime > 5000 && conn && conn.open) return;

    game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
    if (game.ball.x < 15 || game.ball.x > 385) game.ball.vx *= -1;
    if (game.ball.y < 5 || game.ball.y > 595) {
        if (game.ball.x > 130 && game.ball.x < 270) {
            if (game.ball.y < 0) game.s2++; else game.s1++;
            game.ball = { x: 200, y: 300, vx: 0, vy: 0 };
        } else { game.ball.vy *= -1; }
    }

    [game.p1, game.p2].forEach(p => {
        let dx = game.ball.x - p.x, dy = game.ball.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 38) {
            game.ball.vx = (game.ball.x - p.x) * 0.25;
            game.ball.vy = (game.ball.y - p.y) * 0.25;
        }
    });
    game.ball.vx *= 0.985; game.ball.vy *= 0.985;
    
    if (conn && conn.open) {
        conn.send({ g: game, s: gameStarted });
    }
}

function draw() {
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, 400, 600);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 590);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(400, 300); ctx.stroke();
    
    scoreDisplay.innerText = isHost ? `${game.s1} : ${game.s2}` : `${game.s2} : ${game.s1}`;

    let p1Disp = isHost ? game.p1 : { x: game.p2.x, y: 600 - game.p2.y };
    let p2Disp = isHost ? game.p2 : { x: game.p1.x, y: 600 - game.p1.y };
    let bDisp = { x: game.ball.x, y: isHost ? game.ball.y : 600 - game.ball.y };

    ctx.fillStyle = "#007aff"; ctx.beginPath(); ctx.arc(p1Disp.x, p1Disp.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(p2Disp.x, p2Disp.y, 25, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bDisp.x, bDisp.y, 12, 0, 7); ctx.fill();

    if (!gameStarted) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0,0,400,600);
        ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.textAlign = "center";
        ctx.fillText(isHost ? "НАЖМИТЕ СТАРТ" : "ЖДЕМ ХОСТА...", 200, 300);
    }
}

function gameLoop() { 
    update(); draw(); 
    requestAnimationFrame(gameLoop); 
}
з
