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
    speed: 0.26, // Скорость движения между клетками (0-1) - на 30% быстрее
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

// Текущий загруженный уровень
let currentLevel = null;

// Путь преследования котика (для визуализации)
let catPath = [];
let lastPathRecalculation = 0;
const PATH_RECALCULATION_INTERVAL = 30; // Пересчитываем путь каждые 30 кадров (~0.5 сек при 60 FPS)

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

// Волновой алгоритм (BFS) для поиска кратчайшего пути
function findPathToPlayer(catGridX, catGridY, playerGridX, playerGridY) {
    // Инициализация пути
    catPath = [];
    
    // Если котик уже на позиции игрока
    if (catGridX === playerGridX && catGridY === playerGridY) {
        catPath.push({ x: catGridX, y: catGridY });
        return null;
    }
    
    // Создаем матрицу расстояний
    const distances = [];
    for (let y = 0; y < MAZE_ROWS; y++) {
        distances[y] = [];
        for (let x = 0; x < MAZE_COLS; x++) {
            distances[y][x] = -1; // -1 означает непосещенную клетку
        }
    }
    
    // Очередь для BFS
    const queue = [];
    queue.push({ x: catGridX, y: catGridY });
    distances[catGridY][catGridX] = 0;
    
    // Матрица для восстановления пути (хранит предыдущую клетку)
    const prev = [];
    for (let y = 0; y < MAZE_ROWS; y++) {
        prev[y] = [];
        for (let x = 0; x < MAZE_COLS; x++) {
            prev[y][x] = null;
        }
    }
    
    // Направления движения (вверх, вниз, влево, вправо)
    const directions = [
        { dx: 0, dy: -1, name: 'up' },
        { dx: 0, dy: 1, name: 'down' },
        { dx: -1, dy: 0, name: 'left' },
        { dx: 1, dy: 0, name: 'right' }
    ];
    
    // BFS - поиск пути
    let found = false;
    while (queue.length > 0) {
        const current = queue.shift();
        
        // Если достигли цели
        if (current.x === playerGridX && current.y === playerGridY) {
            found = true;
            break;
        }
        
        // Проверяем всех соседей
        for (let dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            
            // Проверяем границы и доступность
            if (nx >= 0 && nx < MAZE_COLS && ny >= 0 && ny < MAZE_ROWS) {
                if (canMoveTo(nx, ny) && distances[ny][nx] === -1) {
                    distances[ny][nx] = distances[current.y][current.x] + 1;
                    prev[ny][nx] = { x: current.x, y: current.y };
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
    
    // Если путь найден, восстанавливаем его
    if (found) {
        const path = [];
        let current = { x: playerGridX, y: playerGridY };
        
        // Восстанавливаем путь от цели к началу
        while (current !== null) {
            path.unshift({ x: current.x, y: current.y });
            current = prev[current.y][current.x];
        }
        
        catPath = path;
        
        // Определяем первое направление движения
        if (path.length > 1) {
            const firstStep = path[1];
            const dx = firstStep.x - catGridX;
            const dy = firstStep.y - catGridY;
            
            if (dx === 1) return 'right';
            if (dx === -1) return 'left';
            if (dy === 1) return 'down';
            if (dy === -1) return 'up';
        }
    } else {
        // Если путь не найден, пробуем любое доступное направление
        catPath.push({ x: catGridX, y: catGridY });
        for (let dir of directions) {
            const nx = catGridX + dir.dx;
            const ny = catGridY + dir.dy;
            if (canMoveTo(nx, ny)) {
                catPath.push({ x: nx, y: ny });
                return dir.name;
            }
        }
    }
    
    return null;
}

// Обновление котика (AI преследования)
function updateCat() {
    // Увеличиваем счетчик кадров для пересчета пути
    lastPathRecalculation++;
    
    // Если котик в центре клетки, выбираем направление
    const centerX = cat.gridX * CELL_SIZE + CELL_SIZE / 2;
    const centerY = cat.gridY * CELL_SIZE + CELL_SIZE / 2;
    const distToCenter = Math.abs(cat.pixelX - centerX) + Math.abs(cat.pixelY - centerY);
    
    // Пересчитываем путь периодически или когда котик в центре клетки
    const shouldRecalculate = distToCenter < 3 || lastPathRecalculation >= PATH_RECALCULATION_INTERVAL;
    
    if (shouldRecalculate) {
        if (distToCenter < 3) {
            cat.pixelX = centerX;
            cat.pixelY = centerY;
            
            // Обновляем grid позицию
            cat.gridX = Math.floor(cat.pixelX / CELL_SIZE);
            cat.gridY = Math.floor(cat.pixelY / CELL_SIZE);
        }
        
        // Пересчитываем направление и путь, используя улучшенный алгоритм
        const direction = findPathToPlayer(cat.gridX, cat.gridY, player.gridX, player.gridY);
        if (direction) {
            cat.direction = direction;
        } else {
            // Если не можем найти путь, пробуем любое доступное направление
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
        
        // Сбрасываем счетчик пересчета
        lastPathRecalculation = 0;
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
            // Достигли препятствия, выравниваем позицию и сбрасываем направление
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
    const centerX = cat.x + cat.width / 2;
    const headY = cat.y - 5;
    
    // Тело
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.ellipse(centerX, cat.y + cat.height / 2, 
                cat.width / 2, cat.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Голова (рисуем после ушей, чтобы уши были поверх)
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.arc(centerX, headY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Уши (левое) - рисуем ПЕРЕД головой, чтобы были видны
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.moveTo(centerX - 3, headY - 2);
    ctx.lineTo(centerX - 10, headY - 15);
    ctx.lineTo(centerX - 1, headY - 2);
    ctx.closePath();
    ctx.fill();
    
    // Внутренняя часть уха (левое)
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.moveTo(centerX - 3, headY - 2);
    ctx.lineTo(centerX - 7, headY - 10);
    ctx.lineTo(centerX - 2, headY - 2);
    ctx.closePath();
    ctx.fill();
    
    // Уши (правое)
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.moveTo(centerX + 1, headY - 2);
    ctx.lineTo(centerX + 10, headY - 15);
    ctx.lineTo(centerX + 3, headY - 2);
    ctx.closePath();
    ctx.fill();
    
    // Внутренняя часть уха (правое)
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.moveTo(centerX + 1, headY - 2);
    ctx.lineTo(centerX + 7, headY - 10);
    ctx.lineTo(centerX + 2, headY - 2);
    ctx.closePath();
    ctx.fill();
    
    // Глаза
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(centerX - 3, headY - 1, 2, 0, Math.PI * 2);
    ctx.arc(centerX + 3, headY - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Нос
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.arc(centerX, headY + 2, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Хвост
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cat.x + cat.width, cat.y + cat.height / 2);
    ctx.quadraticCurveTo(cat.x + cat.width + 10, cat.y, cat.x + cat.width + 15, cat.y + 5);
    ctx.stroke();
}

// Отрисовка пути преследования
function drawCatPath() {
    if (catPath.length < 2) return;
    
    // Рисуем линию пути
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    
    for (let i = 0; i < catPath.length; i++) {
        const point = catPath[i];
        const pixelX = point.x * CELL_SIZE + CELL_SIZE / 2;
        const pixelY = point.y * CELL_SIZE + CELL_SIZE / 2;
        
        if (i === 0) {
            ctx.moveTo(pixelX, pixelY);
        } else {
            ctx.lineTo(pixelX, pixelY);
        }
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Рисуем точки на пути
    for (let i = 1; i < catPath.length; i++) {
        const point = catPath[i];
        const pixelX = point.x * CELL_SIZE + CELL_SIZE / 2;
        const pixelY = point.y * CELL_SIZE + CELL_SIZE / 2;
        
        ctx.fillStyle = i === 1 ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 165, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Отрисовка игры
function draw() {
    // Очистка (темный фон)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Отрисовка элементов (порядок важен!)
    drawMaze();
    drawTraps();
    drawCatPath(); // Рисуем путь преследования
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

// Загрузка уровня из данных
function loadLevelData(levelData) {
    if (levelData.maze) {
        maze = levelData.maze;
    }
    if (levelData.traps) {
        traps = levelData.traps;
    } else {
        traps = [];
    }
    currentLevel = levelData;
}

// Начало игры
function startGame(levelData = null) {
    gameState = 'playing';
    gameTime = 0;
    startTime = Date.now();
    
    if (levelData) {
        loadLevelData(levelData);
    } else {
        generateMaze();
        generateTraps();
        currentLevel = null;
    }
    
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
    document.getElementById('levelSelectMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
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

// Получить список сохраненных уровней
function getSavedLevels() {
    const levels = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('level_')) {
            try {
                const levelData = JSON.parse(localStorage.getItem(key));
                levels.push({
                    key: key,
                    name: levelData.name || key,
                    data: levelData
                });
            } catch (e) {
                // Игнорируем некорректные данные
            }
        }
    }
    return levels;
}

// Сохранить уровень в localStorage
function saveLevelToStorage(levelData) {
    const key = 'level_' + (levelData.name || Date.now());
    localStorage.setItem(key, JSON.stringify(levelData));
    return key;
}

// Загрузить уровень из localStorage
function loadLevelFromStorage(key) {
    const data = localStorage.getItem(key);
    if (data) {
        return JSON.parse(data);
    }
    return null;
}

// Удалить уровень из localStorage
function deleteLevelFromStorage(key) {
    localStorage.removeItem(key);
}

// Показать меню выбора уровня
function showLevelSelect() {
    const menu = document.getElementById('levelSelectMenu');
    const mainMenu = document.getElementById('mainMenu');
    const levelList = document.getElementById('levelList');
    
    menu.style.display = 'block';
    mainMenu.style.display = 'none';
    
    // Очищаем список
    levelList.innerHTML = '';
    
    // Добавляем опцию "Случайный уровень"
    const randomOption = document.createElement('div');
    randomOption.className = 'level-item';
    randomOption.style.cssText = 'padding: 10px; margin: 5px; background: #f0f0f0; border-radius: 5px; cursor: pointer;';
    randomOption.innerHTML = '<strong>🎲 Случайный уровень</strong>';
    randomOption.addEventListener('click', () => {
        startGame();
    });
    levelList.appendChild(randomOption);
    
    // Загружаем сохраненные уровни
    const levels = getSavedLevels();
    if (levels.length === 0) {
        const noLevels = document.createElement('div');
        noLevels.style.cssText = 'padding: 10px; color: #666;';
        noLevels.textContent = 'Нет сохраненных уровней. Создайте уровень в редакторе!';
        levelList.appendChild(noLevels);
    } else {
        levels.forEach(level => {
            const levelItem = document.createElement('div');
            levelItem.className = 'level-item';
            levelItem.style.cssText = 'padding: 10px; margin: 5px; background: #f0f0f0; border-radius: 5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
            
            const levelName = document.createElement('span');
            levelName.textContent = '📁 ' + level.name;
            levelName.style.flex = '1';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.style.cssText = 'background: #ff4444; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer; margin-left: 10px;';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Удалить уровень "' + level.name + '"?')) {
                    deleteLevelFromStorage(level.key);
                    showLevelSelect(); // Обновляем список
                }
            });
            
            levelItem.appendChild(levelName);
            levelItem.appendChild(deleteBtn);
            
            levelItem.addEventListener('click', () => {
                startGame(level.data);
            });
            
            levelList.appendChild(levelItem);
        });
    }
    
    // Кнопка загрузки из файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const levelData = JSON.parse(event.target.result);
                    startGame(levelData);
                } catch (error) {
                    alert('Ошибка загрузки уровня: ' + error.message);
                }
            };
            reader.readAsText(e.target.files[0]);
        }
    });
    
    const loadFileBtn = document.getElementById('loadLevelButton');
    loadFileBtn.style.display = 'block';
    loadFileBtn.onclick = () => fileInput.click();
    document.body.appendChild(fileInput);
}

// Обработчики кнопок
document.getElementById('startButton').addEventListener('click', () => startGame());
document.getElementById('selectLevelButton').addEventListener('click', showLevelSelect);
document.getElementById('editorButton').addEventListener('click', () => {
    window.location.href = 'editor.html';
});
document.getElementById('cancelLevelSelect').addEventListener('click', () => {
    document.getElementById('levelSelectMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
});
document.getElementById('restartButton').addEventListener('click', () => {
    document.getElementById('restartButton').style.display = 'none';
    document.getElementById('startButton').style.display = 'block';
    startGame(currentLevel);
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

// Проверяем, есть ли тестовый уровень из редактора
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('test') === 'true') {
    const testLevel = localStorage.getItem('testLevel');
    if (testLevel) {
        try {
            const levelData = JSON.parse(testLevel);
            startGame(levelData);
            localStorage.removeItem('testLevel'); // Удаляем после загрузки
        } catch (e) {
            console.error('Ошибка загрузки тестового уровня:', e);
        }
    }
}

gameLoop();