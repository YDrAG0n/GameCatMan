// Константы редактора
const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 25;
const MAZE_COLS = Math.floor(CANVAS_WIDTH / CELL_SIZE);
const MAZE_ROWS = Math.floor(CANVAS_HEIGHT / CELL_SIZE);

// Canvas и контекст
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Состояние редактора
let currentTool = 'wall'; // 'wall', 'trapLow', 'trapHigh', 'clear', 'diamond'
let maze = [];
let traps = [];
let diamonds = [];
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;

// Инициализация лабиринта
function initMaze() {
    maze = [];
    for (let y = 0; y < MAZE_ROWS; y++) {
        maze[y] = [];
        for (let x = 0; x < MAZE_COLS; x++) {
            // Границы - стены
            if (x === 0 || x === MAZE_COLS - 1 || y === 0 || y === MAZE_ROWS - 1) {
                maze[y][x] = 0;
            } else {
                maze[y][x] = 1; // Проходы по умолчанию
            }
        }
    }
}

// Получить координаты клетки из пикселей
function getCellFromPixel(x, y) {
    return {
        col: Math.floor(x / CELL_SIZE),
        row: Math.floor(y / CELL_SIZE)
    };
}

// Обработка клика мыши
canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    handleMouseAction(e);
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    if (isMouseDown) {
        handleMouseAction(e);
    }
    
    draw();
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleMouseAction(e, true);
});

function handleMouseAction(e, isRightClick = false) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cell = getCellFromPixel(x, y);
    
    if (cell.col < 0 || cell.col >= MAZE_COLS || cell.row < 0 || cell.row >= MAZE_ROWS) {
        return;
    }
    
    // ПКМ - работа с ловушками
    if (isRightClick || e.button === 2) {
        // Работа с ловушками
        const trapIndex = traps.findIndex(t => 
            Math.floor(t.x / CELL_SIZE) === cell.col && 
            Math.floor(t.y / CELL_SIZE) === cell.row
        );
        
        if (trapIndex !== -1) {
            // Удаляем ловушку
            traps.splice(trapIndex, 1);
        } else if (maze[cell.row][cell.col] === 1) {
            // Добавляем ловушку в зависимости от текущего инструмента
            if (currentTool === 'trapLow') {
                traps.push({
                    x: cell.col * CELL_SIZE,
                    y: cell.row * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE / 2,
                    type: 'low',
                    active: true
                });
            } else if (currentTool === 'trapHigh') {
                traps.push({
                    x: cell.col * CELL_SIZE,
                    y: cell.row * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    type: 'high',
                    active: true
                });
            }
        }
    } else {
        // ЛКМ - работа со стенами и алмазами
        if (currentTool === 'wall') {
            // Ставим стену (но не на границах)
            if (cell.col > 0 && cell.col < MAZE_COLS - 1 && 
                cell.row > 0 && cell.row < MAZE_ROWS - 1) {
                maze[cell.row][cell.col] = 0;
            }
        } else if (currentTool === 'diamond') {
            // Работа с алмазами (как со стенами - ЛКМ)
            if (cell.col > 0 && cell.col < MAZE_COLS - 1 && 
                cell.row > 0 && cell.row < MAZE_ROWS - 1) {
                const diamondIndex = diamonds.findIndex(d => 
                    Math.floor(d.x / CELL_SIZE) === cell.col && 
                    Math.floor(d.y / CELL_SIZE) === cell.row
                );
                
                if (diamondIndex !== -1) {
                    // Удаляем алмаз, если он уже есть
                    diamonds.splice(diamondIndex, 1);
                } else if (maze[cell.row][cell.col] === 1) {
                    // Добавляем алмаз, если клетка проходима
                    diamonds.push({
                        x: cell.col * CELL_SIZE,
                        y: cell.row * CELL_SIZE,
                        width: CELL_SIZE * 0.6,
                        height: CELL_SIZE * 0.6,
                        collected: false
                    });
                }
            }
        } else if (currentTool === 'clear') {
            // Очищаем клетку
            if (cell.col > 0 && cell.col < MAZE_COLS - 1 && 
                cell.row > 0 && cell.row < MAZE_ROWS - 1) {
                maze[cell.row][cell.col] = 1;
                // Удаляем ловушки в этой клетке
                traps = traps.filter(t => 
                    Math.floor(t.x / CELL_SIZE) !== cell.col || 
                    Math.floor(t.y / CELL_SIZE) !== cell.row
                );
                // Удаляем алмазы в этой клетке
                diamonds = diamonds.filter(d => 
                    Math.floor(d.x / CELL_SIZE) !== cell.col || 
                    Math.floor(d.y / CELL_SIZE) !== cell.row
                );
            }
        }
    }
    
    draw();
}

// Отрисовка лабиринта
function drawMaze() {
    // Пол
    ctx.fillStyle = '#2a2a2a';
    for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLS; x++) {
            if (maze[y][x] === 1) {
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
    
    // Стены
    for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLS; x++) {
            if (maze[y][x] === 0) {
                const wallX = x * CELL_SIZE;
                const wallY = y * CELL_SIZE;
                
                ctx.fillStyle = '#555555';
                ctx.fillRect(wallX, wallY, CELL_SIZE, CELL_SIZE);
                
                ctx.strokeStyle = '#777777';
                ctx.lineWidth = 2;
                ctx.strokeRect(wallX + 1, wallY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                
                ctx.fillStyle = '#444444';
                ctx.fillRect(wallX + 2, wallY + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
        }
    }
}

// Отрисовка ловушек
function drawTraps() {
    for (let trap of traps) {
        if (trap.type === 'low') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(trap.x, trap.y + trap.height, trap.width, trap.height);
        } else {
            ctx.fillStyle = '#44ff44';
            ctx.fillRect(trap.x, trap.y, trap.width, trap.height);
        }
    }
}

// Отрисовка алмазов
function drawDiamonds() {
    for (let diamond of diamonds) {
        const centerX = diamond.x + CELL_SIZE / 2;
        const centerY = diamond.y + CELL_SIZE / 2;
        
        // Рисуем алмаз (ромб)
        ctx.fillStyle = '#00BFFF';
        ctx.strokeStyle = '#0080FF';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - diamond.height / 2); // Верх
        ctx.lineTo(centerX + diamond.width / 2, centerY); // Право
        ctx.lineTo(centerX, centerY + diamond.height / 2); // Низ
        ctx.lineTo(centerX - diamond.width / 2, centerY); // Лево
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Блеск
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Отрисовка сетки и курсора
function drawGrid() {
    const cell = getCellFromPixel(mouseX, mouseY);
    
    if (cell.col >= 0 && cell.col < MAZE_COLS && cell.row >= 0 && cell.row < MAZE_ROWS) {
        const x = cell.col * CELL_SIZE;
        const y = cell.row * CELL_SIZE;
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        
        // Показываем что будет сделано
        if (currentTool === 'wall') {
            ctx.fillStyle = 'rgba(85, 85, 85, 0.5)';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (currentTool === 'trapLow') {
            ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.fillRect(x, y + CELL_SIZE / 2, CELL_SIZE, CELL_SIZE / 2);
        } else if (currentTool === 'trapHigh') {
            ctx.fillStyle = 'rgba(68, 255, 68, 0.5)';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (currentTool === 'diamond') {
            const centerX = x + CELL_SIZE / 2;
            const centerY = y + CELL_SIZE / 2;
            const size = CELL_SIZE * 0.6;
            
            ctx.fillStyle = 'rgba(0, 191, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - size / 2);
            ctx.lineTo(centerX + size / 2, centerY);
            ctx.lineTo(centerX, centerY + size / 2);
            ctx.lineTo(centerX - size / 2, centerY);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// Основная отрисовка
function draw() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawMaze();
    drawTraps();
    drawDiamonds();
    drawGrid();
}

// Сохранение уровня
function saveLevel() {
    const levelName = document.getElementById('levelNameInput').value || 'level_' + Date.now();
    
    const levelData = {
        name: levelName,
        maze: maze,
        traps: traps,
        diamonds: diamonds,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        cellSize: CELL_SIZE,
        version: '1.0'
    };
    
    // Сохраняем в localStorage
    const key = 'level_' + levelName;
    localStorage.setItem(key, JSON.stringify(levelData));
    
    // Сохраняем в файл
    const json = JSON.stringify(levelData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = levelName + '.json';
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Уровень сохранен:\n- В файл: ' + levelName + '.json\n- В браузер (для быстрого доступа)');
}

// Загрузка уровня
function loadLevel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const levelData = JSON.parse(e.target.result);
            maze = levelData.maze;
            traps = levelData.traps || [];
            diamonds = levelData.diamonds || [];
            document.getElementById('levelNameInput').value = levelData.name || '';
            draw();
            alert('Уровень загружен: ' + levelData.name);
        } catch (error) {
            alert('Ошибка загрузки уровня: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Генерация случайного лабиринта
function generateMaze() {
    initMaze();
    
    // Добавляем случайные стены
    for (let y = 2; y < MAZE_ROWS - 2; y++) {
        for (let x = 2; x < MAZE_COLS - 2; x++) {
            if (Math.random() < 0.15) {
                maze[y][x] = 0;
            }
        }
    }
    
    // Создаем проходы
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(Math.random() * (MAZE_COLS - 4)) + 2;
        const y = Math.floor(Math.random() * (MAZE_ROWS - 4)) + 2;
        maze[y][x] = 1;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (y + dy > 0 && y + dy < MAZE_ROWS - 1 && 
                    x + dx > 0 && x + dx < MAZE_COLS - 1) {
                    maze[y + dy][x + dx] = 1;
                }
            }
        }
    }
    
    // Очищаем старт и финиш
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
    
    traps = [];
    diamonds = [];
    draw();
}

// Обработчики кнопок
document.getElementById('wallTool').addEventListener('click', () => {
    currentTool = 'wall';
    updateToolButtons();
});

document.getElementById('trapLowTool').addEventListener('click', () => {
    currentTool = 'trapLow';
    updateToolButtons();
});

document.getElementById('trapHighTool').addEventListener('click', () => {
    currentTool = 'trapHigh';
    updateToolButtons();
});

document.getElementById('diamondTool').addEventListener('click', () => {
    currentTool = 'diamond';
    updateToolButtons();
});

document.getElementById('clearTool').addEventListener('click', () => {
    currentTool = 'clear';
    updateToolButtons();
});

document.getElementById('generateTool').addEventListener('click', generateMaze);

document.getElementById('saveButton').addEventListener('click', saveLevel);

document.getElementById('loadFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadLevel(e.target.files[0]);
    }
});

document.getElementById('testButton').addEventListener('click', () => {
    // Сохраняем уровень во временное хранилище и переходим к игре
    const levelName = document.getElementById('levelNameInput').value || 'test_level';
    const levelData = {
        name: levelName,
        maze: maze,
        traps: traps,
        diamonds: diamonds,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        cellSize: CELL_SIZE,
        version: '1.0'
    };
    localStorage.setItem('testLevel', JSON.stringify(levelData));
    window.location.href = 'index.html?test=true';
});

document.getElementById('backButton').addEventListener('click', () => {
    window.location.href = 'index.html';
});

function updateToolButtons() {
    document.querySelectorAll('.tool-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (currentTool === 'wall') {
        document.getElementById('wallTool').classList.add('active');
    } else if (currentTool === 'trapLow') {
        document.getElementById('trapLowTool').classList.add('active');
    } else if (currentTool === 'trapHigh') {
        document.getElementById('trapHighTool').classList.add('active');
    } else if (currentTool === 'diamond') {
        document.getElementById('diamondTool').classList.add('active');
    } else if (currentTool === 'clear') {
        document.getElementById('clearTool').classList.add('active');
    }
}

// Инициализация
initMaze();
draw();