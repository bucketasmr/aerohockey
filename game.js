// Функция для создания случайного кода (например, 5 символов: A1Z9)
function generateShortId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function initPeer(customId = null) {
    // Если мы хост, создаем короткий ID. Если клиент — подключаемся к существующему.
    if (isHost && !customId) {
        customId = generateShortId(5); // Генерируем код из 5 символов
    }

    // Создаем Peer с нашим коротким ID
    peer = new Peer(customId);

    peer.on('open', id => {
        document.getElementById('displayId').innerText = id;
        if (isHost) {
            status.innerText = "Комната создана. Передайте код второму игроку.";
        } else {
            status.innerText = "Подключение к " + id + "...";
        }
    });

    peer.on('error', err => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            alert("Этот код уже занят, попробуйте создать заново.");
        } else {
            alert("Ошибка связи: " + err.type);
        }
    });

    peer.on('connection', c => {
        conn = c;
        setupConnection();
    });
}

// Изменяем функции кнопок
function createRoom() {
    isHost = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    initPeer(); // Тут сгенерируется короткий ID
}

function joinRoom() {
    const id = document.getElementById('joinId').value.toUpperCase(); // Код из инпута
    if (!id) return alert("Введите код комнаты!");
    
    isHost = false;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameUI').style.display = 'block';
    
    // Клиенту НЕ НУЖЕН фиксированный ID, он просто подключается к хосту
    peer = new Peer(); 
    
    peer.on('open', () => {
        conn = peer.connect(id);
        setupConnection();
    });
}
