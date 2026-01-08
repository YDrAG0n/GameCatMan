// Игровые константы
const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 25;
const MAZE_COLS = Math.floor(CANVAS_WIDTH / CELL_SIZE);
const MAZE_ROWS = Math.floor(CANVAS_HEIGHT / CELL_SIZE);

// Состояние игры
let gameState = 'menu'; // menu, playing, gameOver
let gameTime = 0;
let startTime = 0;

// Canvas и контекст
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Лабиринт (0 - стена, 1 - проход)
let maze = [];

// Персонажи
let player = {
    x: 50,
    y: 50,
    width: 20,
    height: 30,
    speed: 3,
    vx: 0,
    vy: 0,
    isJumping: false,
    isCrouching: false,
    jumpPower: -8,
    gravity: 0.5,
    velocityY: 0,
    onGround: false,
    color: '#FF8C00', // Оранжевый
    number: 14
};

let cat = {
    x: 800,
    y: 550,
    width: 20,
    height: 20,
    speed: 2.5,
    color: '#FFA500'
};

// Ловушки
let traps = [];

// Клавиши
const keys = {};

// Генерация лабиринта (упрощенный алгоритм)
function generateMaze() {
    maze = [];
    // Сначала заполняем все проходами
    for (let y = 0; y < MAZE_ROWS; y++) {
        maze[y] = [];
        for (let x = 0; x < MAZE_COLS; x++) {
            maze[y][x] = 1;
        }
    }
    
    // Границы - стены
    for (let y = 0; y < MAZE_ROWS; y++) {
        maze[y][0] = 0;
        maze[y][MAZE_COLS - 1] = 0;
    }
    for (let x = 0; x < MAZE_COLS; x++) {
        maze[0][x] = 0;
        maze[MAZE_ROWS - 1][x] = 0;
    }
    
    // Добавляем случайные стены внутри (15% вероятность для более проходимого лабиринта)
    for (let y = 2; y < MAZE_ROWS - 2; y++) {
        for (let x = 2; x < MAZE_COLS - 2; x++) {
            if (Math.random() < 0.15) {
                maze[y][x] = 0;
            }
        }
    }
    
    // Создаем основные проходы
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(Math.random() * (MAZE_COLS - 4)) + 2;
        const y = Math.floor(Math.random() * (MAZE_ROWS - 4)) + 2;
        maze[y][x] = 1;
        // Очищаем область вокруг
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (y + dy > 0 && y + dy < MAZE_ROWS - 1 && 
                    x + dx > 0 && x + dx < MAZE_COLS - 1) {
                    maze[y + dy][x + dx] = 1;
                }
            }
        }
    }
    
    // Убеждаемся, что старт и финиш проходимы
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            maze[y][x] = 1;
        }
    }
    for (let y = MAZE_ROWS - 4; y <= MAZE_ROWS - 2; y++) {
        for (let x = MAZE_COLS - 4; x <= MAZE_COLS - 2; x++) {
            maze[y][x] = 1;
        }
    }
}

// Генерация ловушек
function generateTraps() {
    traps = [];
    for (let i = 0; i < 15; i++) {
        let x, y, type;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * (MAZE_COLS - 2)) + 1;
            y = Math.floor(Math.random() * (MAZE_ROWS - 2)) + 1;
            type = Math.random() < 0.5 ? 'low' : 'high'; // Низкая или высокая ловушка
            attempts++;
        } while (maze[y][x] === 0 && attempts < 50);
        
        if (maze[y][x] === 1) {
            traps.push({
                x: x * CELL_SIZE,
                y: y * CELL_SIZE,
                width: CELL_SIZE,
                height: type === 'low' ? CELL_SIZE / 2 : CELL_SIZE,
                type: type,
                active: true
            });
        }
    }
}

// Проверка коллизии со стенами
function checkWallCollision(x, y, width, height) {
    const left = Math.floor(x / CELL_SIZE);
    const right = Math.floor((x + width) / CELL_SIZE);
    const top = Math.floor(y / CELL_SIZE);
    const bottom = Math.floor((y + height) / CELL_SIZE);
    
    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) {
                return true;
            }
            if (maze[row][col] === 0) {
                return true;
            }
        }
    }
    return false;
}

// Проверка коллизии с ловушками
function checkTrapCollision(x, y, width, height, isCrouching, isJumping) {
    for (let trap of traps) {
        if (!trap.active) continue;
        
        if (x < trap.x + trap.width &&
            x + width > trap.x &&
            y < trap.y + trap.height &&
            y + height > trap.y) {
            
            // Низкая ловушка - нужно присесть
            if (trap.type === 'low' && !isCrouching) {
                return true;
            }
            // Высокая ловушка - нужно прыгнуть
            if (trap.type === 'high' && !isJumping) {
                return true;
            }
        }
    }
    return false;
}

// Обновление игрока
function updatePlayer() {
    // Горизонтальное движение
    player.vx = 0;
    if (keys['ArrowLeft']) player.vx = -player.speed;
    if (keys['ArrowRight']) player.vx = player.speed;
    
    // Вертикальное движение (прыжок)
    if (keys[' '] && player.onGround && !player.isJumping) {
        player.velocityY = player.jumpPower;
        player.isJumping = true;
        player.onGround = false;
    }
    
    // Приседание
    player.isCrouching = keys['s'] || keys['S'];
    
    // Гравитация
    if (!player.onGround) {
        player.velocityY += player.gravity;
    }
    
    // Применение движения
    let newX = player.x + player.vx;
    let newY = player.y + player.velocityY;
    
    // Проверка коллизий со стенами
    const playerHeight = player.isCrouching ? player.height / 2 : player.height;
    if (!checkWallCollision(newX, player.y, player.width, playerHeight)) {
        player.x = newX;
    }
    
    // Проверка коллизий по вертикали
    if (!checkWallCollision(player.x, newY, player.width, playerHeight)) {
        player.y = newY;
        if (player.y + playerHeight >= CANVAS_HEIGHT - CELL_SIZE) {
            player.y = CANVAS_HEIGHT - CELL_SIZE - playerHeight;
            player.onGround = true;
            player.velocityY = 0;
            player.isJumping = false;
        } else {
            // Проверка на землю
            const belowY = player.y + playerHeight + 1;
            if (checkWallCollision(player.x, belowY, player.width, 1)) {
                player.onGround = true;
                player.velocityY = 0;
                player.isJumping = false;
            } else {
                player.onGround = false;
            }
        }
    } else {
        if (player.velocityY > 0) {
            player.onGround = true;
            player.velocityY = 0;
            player.isJumping = false;
        }
    }
    
    // Проверка коллизий с ловушками
    if (checkTrapCollision(player.x, player.y, player.width, playerHeight, 
                          player.isCrouching, player.isJumping)) {
        gameOver('Пойман ловушкой!');
    }
    
    // Ограничение границами
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - playerHeight, player.y));
}

// Обновление котика (AI преследования)
function updateCat() {
    const dx = player.x - cat.x;
    const dy = player.y - cat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
        const moveX = (dx / distance) * cat.speed;
        const moveY = (dy / distance) * cat.speed;
        
        // Пробуем двигаться по X
        let newX = cat.x + moveX;
        if (!checkWallCollision(newX, cat.y, cat.width, cat.height)) {
            cat.x = newX;
        } else {
            // Если не можем двигаться по X, пробуем только по Y
            if (Math.abs(dy) > Math.abs(dx)) {
                const moveYOnly = (dy / Math.abs(dy)) * cat.speed;
                let newY = cat.y + moveYOnly;
                if (!checkWallCollision(cat.x, newY, cat.width, cat.height)) {
                    cat.y = newY;
                }
            }
        }
        
        // Пробуем двигаться по Y
        let newY = cat.y + moveY;
        if (!checkWallCollision(cat.x, newY, cat.width, cat.height)) {
            cat.y = newY;
        } else {
            // Если не можем двигаться по Y, пробуем только по X
            if (Math.abs(dx) > Math.abs(dy)) {
                const moveXOnly = (dx / Math.abs(dx)) * cat.speed;
                let newX = cat.x + moveXOnly;
                if (!checkWallCollision(newX, cat.y, cat.width, cat.height)) {
                    cat.x = newX;
                }
            }
        }
        
        // Проверка поймал ли котик игрока
        if (distance < 25) {
            gameOver('Котик поймал вас!');
        }
    }
}

// Отрисовка лабиринта
function drawMaze() {
    ctx.fillStyle = '#2a2a2a';
    for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLS; x++) {
            if (maze[y][x] === 0) {
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
}

// Отрисовка ловушек
function drawTraps() {
    for (let trap of traps) {
        if (!trap.active) continue;
        
        if (trap.type === 'low') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(trap.x, trap.y + trap.height, trap.width, trap.height);
        } else {
            ctx.fillStyle = '#44ff44';
            ctx.fillRect(trap.x, trap.y, trap.width, trap.height);
        }
    }
}

// Отрисовка игрока
function drawPlayer() {
    const height = player.isCrouching ? player.height / 2 : player.height;
    const offsetY = player.isCrouching ? player.height / 2 : 0;
    
    // Тело (оранжевая футболка)
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y + offsetY, player.width, height * 0.6);
    
    // Шорты (черные)
    ctx.fillStyle = '#000000';
    ctx.fillRect(player.x, player.y + offsetY + height * 0.6, player.width, height * 0.2);
    
    // Ноги
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(player.x + 2, player.y + offsetY + height * 0.8, 6, height * 0.2);
    ctx.fillRect(player.x + 12, player.y + offsetY + height * 0.8, 6, height * 0.2);
    
    // Голова
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + offsetY + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Шапка (оранжевая)
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - 2, player.y + offsetY, player.width + 4, 6);
    
    // Номер 14
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('14', player.x + player.width / 2, player.y + offsetY + height * 0.4);
}

// Отрисовка котика
function drawCat() {
    // Тело
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.ellipse(cat.x + cat.width / 2, cat.y + cat.height / 2, 
                cat.width / 2, cat.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Голова
    ctx.beginPath();
    ctx.arc(cat.x + cat.width / 2, cat.y - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Уши
    ctx.beginPath();
    ctx.moveTo(cat.x + cat.width / 2 - 5, cat.y - 5);
    ctx.lineTo(cat.x + cat.width / 2 - 2, cat.y - 10);
    ctx.lineTo(cat.x + cat.width / 2, cat.y - 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cat.x + cat.width / 2, cat.y - 5);
    ctx.lineTo(cat.x + cat.width / 2 + 2, cat.y - 10);
    ctx.lineTo(cat.x + cat.width / 2 + 5, cat.y - 5);
    ctx.fill();
    
    // Глаза
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cat.x + cat.width / 2 - 3, cat.y - 5, 2, 0, Math.PI * 2);
    ctx.arc(cat.x + cat.width / 2 + 3, cat.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Хвост
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cat.x + cat.width, cat.y + cat.height / 2);
    ctx.quadraticCurveTo(cat.x + cat.width + 10, cat.y, cat.x + cat.width + 15, cat.y + 5);
    ctx.stroke();
}

// Отрисовка игры
function draw() {
    // Очистка
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Отрисовка элементов (порядок важен!)
    drawMaze();
    drawTraps();
    drawPlayer();
    drawCat();
    
    // Информация о состоянии
    if (player.isCrouching) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 30);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ПРИСЕЛ!', CANVAS_WIDTH / 2, 20);
    }
    if (player.isJumping) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 30);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ПРЫЖОК!', CANVAS_WIDTH / 2, 20);
    }
    
    // Отладочная информация (можно убрать позже)
    if (gameState === 'menu') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Лабиринт загружен. Нажмите "Начать игру"', 10, 30);
    }
}

// Обновление игры
function update() {
    if (gameState === 'playing') {
        updatePlayer();
        updateCat();
        
        // Обновление времени
        gameTime = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('time').textContent = gameTime;
        
        // Обновление дистанции
        const distance = Math.sqrt(
            Math.pow(player.x - 50, 2) + Math.pow(player.y - 50, 2)
        );
        document.getElementById('distance').textContent = Math.floor(distance / 10);
    }
    
    // Всегда перерисовываем, чтобы видеть лабиринт даже в меню
    draw();
}

// Игровой цикл
function gameLoop() {
    update();
    requestAnimationFrame(gameLoop);
}

// Обработка клавиатуры
document.addEventListener('keydown', (e) => {
    // Предотвращаем скроллинг при нажатии стрелок и пробела
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = false;
});

// Фокус на canvas при клике
canvas.addEventListener('click', () => {
    canvas.focus();
});

// Делаем canvas фокусируемым
canvas.setAttribute('tabindex', '0');
canvas.style.outline = 'none';

// Начало игры
function startGame() {
    gameState = 'playing';
    gameTime = 0;
    startTime = Date.now();
    
    generateMaze();
    generateTraps();
    
    // Позиции персонажей
    player.x = 50;
    player.y = 50;
    player.velocityY = 0;
    player.onGround = false;
    player.isJumping = false;
    player.isCrouching = false;
    
    cat.x = CANVAS_WIDTH - 100;
    cat.y = CANVAS_HEIGHT - 100;
    
    document.getElementById('gameOverlay').style.display = 'none';
}

// Конец игры
function gameOver(message) {
    gameState = 'gameOver';
    document.getElementById('overlayTitle').textContent = 'Игра окончена!';
    document.getElementById('overlayText').textContent = message + 
        `\nВы продержались ${gameTime} секунд!`;
    document.getElementById('startButton').style.display = 'none';
    document.getElementById('restartButton').style.display = 'block';
    document.getElementById('gameOverlay').style.display = 'flex';
}

// Обработчики кнопок
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', () => {
    document.getElementById('restartButton').style.display = 'none';
    document.getElementById('startButton').style.display = 'block';
    startGame();
});

// Инициализация
generateMaze();
generateTraps();
gameLoop();