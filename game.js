let peer, conn;
let isHost = false;
let gameStarted = false;

// 1. Генератор короткого кода
function generateShortId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 2. Функция создания комнаты (для ХОСТА)
function createRoom() {
    isHost = true;
    const shortId = generateShortId(5); // Создаем код типа "XJ84S"
    
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    
    // Инициализируем Peer С КОНКРЕТНЫМ ID
    peer = new Peer(shortId); 

    peer.on('open', id => {
        document.getElementById('displayId').innerText = id; // Здесь будет короткий код
        status.innerText = "Комната создана. Ждем игрока...";
    });

    peer.on('connection', c => {
        conn = c;
        setupConnection();
    });

    peer.on('error', err => {
        if (err.type === 'unavailable-id') {
            alert("Этот код уже занят, попробуйте еще раз.");
            location.reload(); 
        }
    });
}

// 3. Функция присоединения (для КЛИЕНТА)
function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase().trim();
    if (!id) return alert("Введите код комнаты!");

    isHost = false;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';

    // Клиент создает peer с ПРОВИЗОРОНЫМ (длинным) ID, 
    // потому что ему не важно, какой ID у него, важно — к кому он коннектится.
    peer = new Peer(); 

    peer.on('open', () => {
        document.getElementById('displayId').innerText = "Подключаемся к " + id;
        conn = peer.connect(id); // Коннектимся к короткому ID хоста
        setupConnection();
    });
}
