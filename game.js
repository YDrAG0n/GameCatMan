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
    gridX: 2,  // Позиция в сетке
    gridY: 2,
    pixelX: 0, // Точная позиция в пикселях для плавного движения
    pixelY: 0,
    width: 20,
    height: 30,
    speed: 0.2, // Скорость движения между клетками (0-1)
    direction: null, // 'up', 'down', 'left', 'right'
    nextDirection: null, // Следующее направление (для плавного поворота)
    isJumping: false,
    isCrouching: false,
    jumpTimer: 0, // Таймер прыжка
    crouchTimer: 0, // Таймер приседания
    color: '#FF8C00', // Оранжевый
    number: 14
};

let cat = {
    gridX: 32,
    gridY: 22,
    pixelX: 0,
    pixelY: 0,
    width: 20,
    height: 20,
    speed: 0.16,
    direction: null,
    nextDirection: null,
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

// Проверка, можно ли двигаться в указанную клетку
function canMoveTo(gridX, gridY) {
    if (gridX < 0 || gridX >= MAZE_COLS || gridY < 0 || gridY >= MAZE_ROWS) {
        return false;
    }
    return maze[gridY][gridX] === 1;
}

// Получить пиксельные координаты из сетки
function gridToPixel(gridX, gridY) {
    return {
        x: gridX * CELL_SIZE + CELL_SIZE / 2,
        y: gridY * CELL_SIZE + CELL_SIZE / 2
    };
}

// Проверка коллизии с ловушками
function checkTrapCollision(gridX, gridY, isCrouching, isJumping) {
    const pixelPos = gridToPixel(gridX, gridY);
    const playerX = pixelPos.x - player.width / 2;
    const playerY = pixelPos.y - player.height / 2;
    
    for (let trap of traps) {
        if (!trap.active) continue;
        
        // Проверяем, находится ли игрок в той же клетке, что и ловушка
        const trapGridX = Math.floor(trap.x / CELL_SIZE);
        const trapGridY = Math.floor(trap.y / CELL_SIZE);
        
        if (gridX === trapGridX && gridY === trapGridY) {
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
    // Обработка ввода направления
    if (keys['ArrowLeft']) player.nextDirection = 'left';
    if (keys['ArrowRight']) player.nextDirection = 'right';
    if (keys['ArrowUp']) player.nextDirection = 'up';
    if (keys['ArrowDown']) player.nextDirection = 'down';
    
    // Прыжок (пробел)
    if (keys[' '] && !player.isJumping && player.jumpTimer === 0) {
        player.isJumping = true;
        player.jumpTimer = 20; // Длительность прыжка в кадрах
    }
    
    // Приседание (S)
    player.isCrouching = (keys['s'] || keys['S']) && !player.isJumping;
    
    // Обновление таймеров
    if (player.jumpTimer > 0) {
        player.jumpTimer--;
        if (player.jumpTimer === 0) {
            player.isJumping = false;
        }
    }
    
    // Если игрок находится в центре клетки, можно сменить направление
    const centerX = player.gridX * CELL_SIZE + CELL_SIZE / 2;
    const centerY = player.gridY * CELL_SIZE + CELL_SIZE / 2;
    const distToCenter = Math.abs(player.pixelX - centerX) + Math.abs(player.pixelY - centerY);
    
    if (distToCenter < 3) {
        // Выравниваем позицию
        player.pixelX = centerX;
        player.pixelY = centerY;
        
        // Обновляем grid позицию
        player.gridX = Math.floor(player.pixelX / CELL_SIZE);
        player.gridY = Math.floor(player.pixelY / CELL_SIZE);
        
        // Проверяем, можно ли повернуть в новом направлении
        if (player.nextDirection) {
            let newGridX = player.gridX;
            let newGridY = player.gridY;
            
            if (player.nextDirection === 'left') newGridX--;
            if (player.nextDirection === 'right') newGridX++;
            if (player.nextDirection === 'up') newGridY--;
            if (player.nextDirection === 'down') newGridY++;
            
            if (canMoveTo(newGridX, newGridY)) {
                player.direction = player.nextDirection;
            }
        }
        
        // Если нет направления, пробуем установить его
        if (!player.direction && player.nextDirection) {
            let newGridX = player.gridX;
            let newGridY = player.gridY;
            
            if (player.nextDirection === 'left') newGridX--;
            if (player.nextDirection === 'right') newGridX++;
            if (player.nextDirection === 'up') newGridY--;
            if (player.nextDirection === 'down') newGridY++;
            
            if (canMoveTo(newGridX, newGridY)) {
                player.direction = player.nextDirection;
            }
        }
    }
    
    // Движение в текущем направлении
    if (player.direction) {
        let moveX = 0;
        let moveY = 0;
        
        if (player.direction === 'left') {
            moveX = -player.speed * CELL_SIZE;
        } else if (player.direction === 'right') {
            moveX = player.speed * CELL_SIZE;
        } else if (player.direction === 'up') {
            moveY = -player.speed * CELL_SIZE;
        } else if (player.direction === 'down') {
            moveY = player.speed * CELL_SIZE;
        }
        
        // Вычисляем новую позицию
        const newPixelX = player.pixelX + moveX;
        const newPixelY = player.pixelY + moveY;
        const newGridX = Math.floor(newPixelX / CELL_SIZE);
        const newGridY = Math.floor(newPixelY / CELL_SIZE);
        
        // Проверяем, можно ли двигаться в новую клетку
        if (canMoveTo(newGridX, newGridY)) {
            player.pixelX = newPixelX;
            player.pixelY = newPixelY;
            player.gridX = newGridX;
            player.gridY = newGridY;
        } else {
            // Достигли стены, выравниваем позицию
            const centerX = player.gridX * CELL_SIZE + CELL_SIZE / 2;
            const centerY = player.gridY * CELL_SIZE + CELL_SIZE / 2;
            player.pixelX = centerX;
            player.pixelY = centerY;
            player.direction = null;
        }
    }
    
    // Проверка коллизий с ловушками
    if (checkTrapCollision(player.gridX, player.gridY, player.isCrouching, player.isJumping)) {
        gameOver('Пойман ловушкой!');
    }
    
    // Обновляем координаты для отрисовки
    player.x = player.pixelX - player.width / 2;
    player.y = player.pixelY - player.height / 2;
}

// Обновление котика (AI преследования)
function updateCat() {
    // Если котик в центре клетки, выбираем направление
    const centerX = cat.gridX * CELL_SIZE + CELL_SIZE / 2;
    const centerY = cat.gridY * CELL_SIZE + CELL_SIZE / 2;
    const distToCenter = Math.abs(cat.pixelX - centerX) + Math.abs(cat.pixelY - centerY);
    
    if (distToCenter < 3) {
        cat.pixelX = centerX;
        cat.pixelY = centerY;
        
        // Обновляем grid позицию
        cat.gridX = Math.floor(cat.pixelX / CELL_SIZE);
        cat.gridY = Math.floor(cat.pixelY / CELL_SIZE);
        
        // Вычисляем направление к игроку
        const dx = player.gridX - cat.gridX;
        const dy = player.gridY - cat.gridY;
        
        // Пробуем двигаться в направлении игрока
        const directions = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) directions.push('right');
            if (dx < 0) directions.push('left');
            if (dy > 0) directions.push('down');
            if (dy < 0) directions.push('up');
        } else {
            if (dy > 0) directions.push('down');
            if (dy < 0) directions.push('up');
            if (dx > 0) directions.push('right');
            if (dx < 0) directions.push('left');
        }
        
        // Пробуем каждое направление
        for (let dir of directions) {
            let newGridX = cat.gridX;
            let newGridY = cat.gridY;
            
            if (dir === 'left') newGridX--;
            if (dir === 'right') newGridX++;
            if (dir === 'up') newGridY--;
            if (dir === 'down') newGridY++;
            
            if (canMoveTo(newGridX, newGridY)) {
                cat.direction = dir;
                break;
            }
        }
        
        // Если не можем двигаться к игроку, пробуем любое доступное направление
        if (!cat.direction) {
            const allDirections = ['up', 'down', 'left', 'right'];
            for (let dir of allDirections) {
                let newGridX = cat.gridX;
                let newGridY = cat.gridY;
                
                if (dir === 'left') newGridX--;
                if (dir === 'right') newGridX++;
                if (dir === 'up') newGridY--;
                if (dir === 'down') newGridY++;
                
                if (canMoveTo(newGridX, newGridY)) {
                    cat.direction = dir;
                    break;
                }
            }
        }
    }
    
    // Движение котика
    if (cat.direction) {
        let moveX = 0;
        let moveY = 0;
        
        if (cat.direction === 'left') {
            moveX = -cat.speed * CELL_SIZE;
        } else if (cat.direction === 'right') {
            moveX = cat.speed * CELL_SIZE;
        } else if (cat.direction === 'up') {
            moveY = -cat.speed * CELL_SIZE;
        } else if (cat.direction === 'down') {
            moveY = cat.speed * CELL_SIZE;
        }
        
        const newPixelX = cat.pixelX + moveX;
        const newPixelY = cat.pixelY + moveY;
        const newGridX = Math.floor(newPixelX / CELL_SIZE);
        const newGridY = Math.floor(newPixelY / CELL_SIZE);
        
        if (canMoveTo(newGridX, newGridY)) {
            cat.pixelX = newPixelX;
            cat.pixelY = newPixelY;
            cat.gridX = newGridX;
            cat.gridY = newGridY;
        } else {
            const centerX = cat.gridX * CELL_SIZE + CELL_SIZE / 2;
            const centerY = cat.gridY * CELL_SIZE + CELL_SIZE / 2;
            cat.pixelX = centerX;
            cat.pixelY = centerY;
            cat.direction = null;
        }
    }
    
    // Проверка поймал ли котик игрока
    const distance = Math.sqrt(
        Math.pow(player.gridX - cat.gridX, 2) + Math.pow(player.gridY - cat.gridY, 2)
    );
    if (distance < 1.5) {
        gameOver('Котик поймал вас!');
    }
    
    // Обновляем координаты для отрисовки
    cat.x = cat.pixelX - cat.width / 2;
    cat.y = cat.pixelY - cat.height / 2;
}

// Отрисовка лабиринта
function drawMaze() {
    // Сначала отрисовываем проходы (пол)
    ctx.fillStyle = '#2a2a2a';
    for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLS; x++) {
            if (maze[y][x] === 1) {
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
    
    // Затем отрисовываем стены с контуром
    for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLS; x++) {
            if (maze[y][x] === 0) {
                const wallX = x * CELL_SIZE;
                const wallY = y * CELL_SIZE;
                
                // Основной цвет стены (светло-серый)
                ctx.fillStyle = '#555555';
                ctx.fillRect(wallX, wallY, CELL_SIZE, CELL_SIZE);
                
                // Контур стены для лучшей видимости
                ctx.strokeStyle = '#777777';
                ctx.lineWidth = 2;
                ctx.strokeRect(wallX + 1, wallY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                
                // Внутренняя тень для объема
                ctx.fillStyle = '#444444';
                ctx.fillRect(wallX + 2, wallY + 2, CELL_SIZE - 4, CELL_SIZE - 4);
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
    // Очистка (темный фон)
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
    
    // Позиции персонажей в сетке
    player.gridX = 2;
    player.gridY = 2;
    const playerPos = gridToPixel(player.gridX, player.gridY);
    player.pixelX = playerPos.x;
    player.pixelY = playerPos.y;
    player.x = player.pixelX - player.width / 2;
    player.y = player.pixelY - player.height / 2;
    player.direction = null;
    player.nextDirection = null;
    player.isJumping = false;
    player.isCrouching = false;
    player.jumpTimer = 0;
    player.crouchTimer = 0;
    
    cat.gridX = MAZE_COLS - 3;
    cat.gridY = MAZE_ROWS - 3;
    const catPos = gridToPixel(cat.gridX, cat.gridY);
    cat.pixelX = catPos.x;
    cat.pixelY = catPos.y;
    cat.x = cat.pixelX - cat.width / 2;
    cat.y = cat.pixelY - cat.height / 2;
    cat.direction = null;
    cat.nextDirection = null;
    
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

// Устанавливаем начальные позиции
const playerPos = gridToPixel(2, 2);
player.pixelX = playerPos.x;
player.pixelY = playerPos.y;
player.x = player.pixelX - player.width / 2;
player.y = player.pixelY - player.height / 2;

const catPos = gridToPixel(MAZE_COLS - 3, MAZE_ROWS - 3);
cat.pixelX = catPos.x;
cat.pixelY = catPos.y;
cat.x = cat.pixelX - cat.width / 2;
cat.y = cat.pixelY - cat.height / 2;

gameLoop();