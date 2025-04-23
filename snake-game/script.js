const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const gridSize = 20; // Size of each grid square
const canvasSize = 400; // Must match canvas width/height
const tileCount = canvasSize / gridSize; // Number of tiles across/down

// Game state
let snake = [{ x: 10, y: 10 }]; // Initial snake position (array of segments)
let dx = 0; // Initial horizontal velocity
let dy = 0; // Initial vertical velocity
let food = { x: 15, y: 15 }; // Initial food position
let score = 0;
let changingDirection = false; // Prevent rapid 180 turns
let gameLoopInterval = null;
let gameSpeed = 150; // Milliseconds between updates (lower is faster)

// --- Game Functions ---

function drawRect(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    ctx.strokeStyle = '#eee'; // Grid lines (optional)
    ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);
}

function drawSnake() {
    snake.forEach((segment, index) => {
        const color = index === 0 ? '#00695c' : '#00897b'; // Head is darker
        drawRect(segment.x, segment.y, color);
    });
}

function drawFood() {
    drawRect(food.x, food.y, '#d32f2f'); // Red food
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head); // Add new head

    // Check if snake ate food
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        generateFood();
        // Increase speed slightly (optional)
        // if (gameSpeed > 50) gameSpeed -= 5;
        // clearInterval(gameLoopInterval);
        // gameLoopInterval = setInterval(gameLoop, gameSpeed);
    } else {
        snake.pop(); // Remove tail segment if no food eaten
    }
}

function generateFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);

    // Ensure food doesn't spawn on the snake
    snake.forEach(segment => {
        if (segment.x === food.x && segment.y === food.y) {
            generateFood(); // Regenerate if collision
        }
    });
}

function checkCollision() {
    const head = snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return true;
    }

    // Self collision (check if head hits any other segment)
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }

    return false;
}

function clearCanvas() {
    ctx.fillStyle = '#b2dfdb'; // Match canvas background
    ctx.fillRect(0, 0, canvasSize, canvasSize);
}

function gameOver() {
    clearInterval(gameLoopInterval);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.font = '40px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvasSize / 2, canvasSize / 2 - 20);
    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${score}`, canvasSize / 2, canvasSize / 2 + 20);
    // Optional: Add a restart prompt
}

function changeDirection(event) {
    if (changingDirection) return;
    changingDirection = true;

    const keyPressed = event.key;
    const goingUp = dy === -1;
    const goingDown = dy === 1;
    const goingLeft = dx === -1;
    const goingRight = dx === 1;

    if (keyPressed === 'ArrowLeft' && !goingRight) { dx = -1; dy = 0; }
    if (keyPressed === 'ArrowUp' && !goingDown) { dx = 0; dy = -1; }
    if (keyPressed === 'ArrowRight' && !goingLeft) { dx = 1; dy = 0; }
    if (keyPressed === 'ArrowDown' && !goingUp) { dx = 0; dy = 1; }
}

// --- Main Game Loop ---

function gameLoop() {
    // Allow next direction change
    changingDirection = false;

    if (checkCollision()) {
        gameOver();
        return;
    }

    clearCanvas();
    drawFood();
    moveSnake();
    drawSnake();
}

// --- Event Listener ---
document.addEventListener('keydown', changeDirection);

// --- Start Game ---
generateFood(); // Initial food placement
// Start the game loop only after a key is pressed to move
document.addEventListener('keydown', function startGame(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && !gameLoopInterval) {
        // Set initial direction based on first key press
        changeDirection(event);
        // Start the main loop
        gameLoopInterval = setInterval(gameLoop, gameSpeed);
        // Remove this listener so it only runs once
        document.removeEventListener('keydown', startGame);
    }
}, { once: true }); // Ensure the outer listener runs only once if no key is pressed initially

// Initial draw before game starts
clearCanvas();
drawFood();
drawSnake();
