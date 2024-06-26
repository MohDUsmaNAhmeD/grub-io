const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
const leaderboard = document.getElementById('leaderboard');
const scoreDisplay = document.getElementById('score');

const gridSize = 20;
const worldSize = 5000;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let zoom = 1;
let joystickBase = document.getElementById('joystick-base');
let joystick = document.getElementById('joystick-handle');
let joystickActive = false;
let joystickOrigin = { x: 0, y: 0 };

// Determine if the device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function startJoystick(e) {
  joystickActive = true;
  let touch = e.touches[0];
  joystickOrigin = { x: touch.clientX, y: touch.clientY };
}

function moveJoystick(e) {
  if (!joystickActive) return;
  e.preventDefault();

  let touch = e.touches[0];
  let joystickRect = joystickBase.getBoundingClientRect();
  let centerX = joystickRect.left + joystickRect.width / 2;
  let centerY = joystickRect.top + joystickRect.height / 2;
  
  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;
  let distance = Math.min(joystickBase.offsetWidth / 2, Math.sqrt(dx * dx + dy * dy));
  let angle = Math.atan2(dy, dx);

  let x = Math.cos(angle) * distance;
  let y = Math.sin(angle) * distance;

  joystick.style.transform = `translate(${x}px, ${y}px)`;

  playerSnake.angle = angle; // Update player direction based on joystick angle
}

function endJoystick() {
  joystickActive = false;
  joystick.style.transform = 'translate(0, 0)';
}

if (isMobile) {
  joystickBase.addEventListener('touchstart', startJoystick);
  joystickBase.addEventListener('touchmove', moveJoystick);
  joystickBase.addEventListener('touchend', endJoystick);
}

canvas.width = viewportWidth;
canvas.height = viewportHeight;

const foodImagesSrc = ['apple.png', 'orange.png' ,'grapes.png', 'banana.png' , 'mango.png' , 'strawberry.png'];
const foodImages = [];
let imagesLoaded = 0;

const snakeColors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff',
  
  '#FF1493', 
  '#8B4513', 
 ' #20B2AA', 
  '#FFD70',
  '#FF6347' ]

let playerSnake, enemySnakes, foods, camera, mouseX, mouseY, boosting;

function initializeVariables() {
  playerSnake = {
    body: [{ x: worldSize / 2, y: worldSize / 2 }],
    angle: 0,
    speed: 3,
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: localStorage.getItem("playerName"),
    score: 0
  };
  enemySnakes = [];
  foods = [];
  camera = { x: 0, y: 0 };
  mouseX = viewportWidth / 2;
  mouseY = viewportHeight / 2;
  boosting = false;
}

function startJoystick(e) {
  joystickActive = true;
  let touch = e.touches[0];
  joystickOrigin = { x: touch.clientX, y: touch.clientY };
}

function moveJoystick(e) {
  if (!joystickActive) return;
  e.preventDefault();

  let touch = e.touches[0];
  let joystickRect = joystickBase.getBoundingClientRect();
  let centerX = joystickRect.left + joystickRect.width / 2;
  let centerY = joystickRect.top + joystickRect.height / 2;
  
  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;
  let distance = Math.min(joystickBase.offsetWidth / 2, Math.sqrt(dx * dx + dy * dy));
  let angle = Math.atan2(dy, dx);

  let x = Math.cos(angle) * distance;
  let y = Math.sin(angle) * distance;

  joystick.style.transform = `translate(${x}px, ${y}px)`;

  playerSnake.angle = angle;
}


function endJoystick() {
  joystickActive = false;
  joystick.style.transform = 'translate(0, 0)';
}

if (isMobile) {
  screen.orientation.lock('landscape').catch(() => {
    console.log('Failed to lock screen orientation');
  });

  document.querySelectorAll('.mobile-only').forEach(el => el.style.display = 'block');

  joystickBase.addEventListener('touchstart', startJoystick);
  joystickBase.addEventListener('touchmove', moveJoystick);
  joystickBase.addEventListener('touchend', endJoystick);

  let boostButton = document.getElementById('boost-button');
  boostButton.addEventListener('touchstart', () => {
    if (playerSnake.score > 0) boosting = true;
  });
  boostButton.addEventListener('touchend', () => boosting = false);
}
function movePlayerSnake() {
  const head = playerSnake.body[0];
  const speed = (boosting && playerSnake.score > 0) ? playerSnake.speed * 1.5 : playerSnake.speed;

  // Check if boosting is active and there's enough score to boost
  if (boosting && playerSnake.score > 1) {
    playerSnake.score -= 1; // Decrease score for boosting
    generateFood(head.x, head.y, 1); // Generate food pallet when boosting
    // Optionally, you can adjust the length decrease logic here
    // For example, uncomment the line below to reduce the length more aggressively
    // playerSnake.body.pop();
  }

  const newHead = {
    x: head.x + Math.cos(playerSnake.angle) * speed,
    y: head.y + Math.sin(playerSnake.angle) * speed
  };

  playerSnake.body.unshift(newHead); // Add new head
  if (playerSnake.body.length > playerSnake.score / 10 + 10) {
    playerSnake.body.pop(); // Remove tail segment to maintain length
  }

  wrapAroundWorld(newHead); // Wrap around world edges if necessary
  checkSnakeAteFood(playerSnake); // Check if player snake ate food
  checkCollisions(playerSnake); // Check collisions with other snakes
}


function moveEnemySnake(snake) {
  const head = snake.body[0];
  let nearestFood = foods.reduce((nearest, food) => {
    const distance = Math.hypot(food.x - head.x, food.y - head.y);
    return distance < nearest.distance ? { food, distance } : nearest;
  }, { food: null, distance: Infinity }).food;

  // Calculate distance to player snake's head
  const distanceToPlayer = Math.hypot(playerSnake.body[0].x - head.x, playerSnake.body[0].y - head.y);

  if (distanceToPlayer < 200) { // If player snake is within a certain radius, target it
    snake.angle = Math.atan2(playerSnake.body[0].y - head.y, playerSnake.body[0].x - head.x);
  } else if (nearestFood) { // Otherwise, move towards nearest food
    snake.angle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
  }

  if (Math.random() < 0.02) { // Random movement adjustment
    snake.angle += (Math.random() - 0.5) * Math.PI / 2;
  }

  const newHead = {
    x: head.x + Math.cos(snake.angle) * snake.speed,
    y: head.y + Math.sin(snake.angle) * snake.speed
  };

  snake.body.unshift(newHead);
  if (snake.body.length > snake.score / 10 + 10) {
    snake.body.pop();
  }

  wrapAroundWorld(newHead);
  checkSnakeAteFood(snake);
  checkCollisions(snake);
}

function checkCollisions(snake) {
  const head = snake.body[0];
  const allSnakes = [playerSnake, ...enemySnakes];

  for (let otherSnake of allSnakes) {
    if (otherSnake === snake) continue;
    for (let i = 0; i < otherSnake.body.length; i++) {
      const segment = otherSnake.body[i];
      if (Math.hypot(head.x - segment.x, head.y - segment.y) < gridSize) {
        if (snake === playerSnake) {
          gameOver();
        } else {
          killSnake(snake);
        }
        return;
      }
    }
  }
}

function killSnake(snake) {
  const index = enemySnakes.indexOf(snake);
  if (index > -1) {
    enemySnakes.splice(index, 1);
    for (let segment of snake.body) {
      generateFood(segment.x, segment.y, 2);
    }
    enemySnakes.push(createEnemySnake());
  }
}

function gameOver() {
  alert(`Game Over! Your score: ${playerSnake.score}`);
  window.location.href = "C:/UsersWajahat Traders/Coding/New Folder/slither.io/startmnu/index.html"
  initGame();
}

function updateZoom() {
  zoom = Math.max(0.5, Math.min(1, 800 / playerSnake.body.length));
  canvas.style.transform = `scale(${zoom})`;
}

function updateLeaderboard() {
  const allSnakes = [playerSnake, ...enemySnakes].sort((a, b) => b.score - a.score);
  leaderboard.innerHTML = allSnakes.slice(0, 10).map((snake, index) => 
    `<div>${index + 1}. ${snake.name}: ${snake.score}</div>`
  ).join('');
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  camera.x = playerSnake.body[0].x - viewportWidth / 2 / zoom;
  camera.y = playerSnake.body[0].y - viewportHeight / 2 / zoom;

  drawSnake(playerSnake);
  enemySnakes.forEach(drawSnake);
  drawFoods();
  drawMinimap();
  updateZoom();
  updateLeaderboard();
  
  scoreDisplay.textContent = `Score: ${playerSnake.score}`;
}

function drawSnake(snake) {
  ctx.fillStyle = snake.color;
  for (let i = 0; i < snake.body.length; i++) {
    const segment = snake.body[i];
    ctx.beginPath();
    ctx.arc(segment.x - camera.x, segment.y - camera.y, gridSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const head = snake.body[0];
  const eyeOffset = gridSize / 4;
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(head.x - camera.x + Math.cos(snake.angle) * eyeOffset, 
          head.y - camera.y + Math.sin(snake.angle) * eyeOffset, 
          gridSize / 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(head.x - camera.x + Math.cos(snake.angle + Math.PI / 4) * eyeOffset, 
          head.y - camera.y + Math.sin(snake.angle + Math.PI / 4) * eyeOffset, 
          gridSize / 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw snake name
  drawSnakeName(snake);
}

function drawSnakeName(snake) {
  const head = snake.body[0];
  ctx.fillStyle = 'black';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(snake.name, head.x - camera.x, head.y - camera.y - gridSize);
}

function drawFoods() {
  foods.forEach(food => {
    ctx.drawImage(foodImages[food.type], food.x - camera.x - gridSize / 2, food.y - camera.y - gridSize / 2, gridSize, gridSize);
  });
}

function drawMinimap() {
  minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
  const scale = minimap.width / worldSize;

  // Draw player snake
  minimapCtx.fillStyle = playerSnake.color;
  playerSnake.body.forEach(segment => {
    minimapCtx.fillRect(segment.x * scale, segment.y * scale, 2, 2);
  });

  // Draw enemy snakes
  enemySnakes.forEach(snake => {
    minimapCtx.fillStyle = snake.color;
    snake.body.forEach(segment => {
      minimapCtx.fillRect(segment.x * scale, segment.y * scale, 2, 2);
    });
  });

  // Draw foods
  minimapCtx.fillStyle = 'green';
  foods.forEach(food => {
    minimapCtx.fillRect(food.x * scale, food.y * scale, 1, 1);
  });
}

function wrapAroundWorld(position) {
  if (position.x < 0) position.x += worldSize;
  if (position.y < 0) position.y += worldSize;
  if (position.x >= worldSize) position.x -= worldSize;
  if (position.y >= worldSize) position.y -= worldSize;
}

function checkSnakeAteFood(snake) {
  const head = snake.body[0];
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    if (Math.hypot(head.x - food.x, head.y - food.y) < gridSize) {
      foods.splice(i, 1);
      snake.score += food.value;
      generateFood(Math.random() * worldSize, Math.random() * worldSize, 1);
      return true;
    }
  }
  return false;
}

function generateFood(x, y, value) {
  foods.push({
    x: x,
    y: y,
    type: Math.floor(Math.random() * foodImages.length),
    value: value
  });
}

function createEnemySnake() {
  return {
    body: [{ 
      x: Math.random() * worldSize, 
      y: Math.random() * worldSize 
    }],
    angle: Math.random() * Math.PI * 2,
    speed: 2 + Math.random(),
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: `Bot ${Math.floor(Math.random() * 1000)}`,
    score: 20
  };
}

function initGame() {
  initializeVariables();

  const numEnemySnakes = 20;
  for (let i = 0; i < numEnemySnakes; i++) {
    enemySnakes.push(createEnemySnake());
  }

  const numInitialFood = 100;
  for (let i = 0; i < numInitialFood; i++) {
    generateFood(Math.random() * worldSize, Math.random() * worldSize, 1);
  }

  function gameLoop() {
    movePlayerSnake();
    enemySnakes.forEach(moveEnemySnake);
    drawGame();
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

foodImagesSrc.forEach((src, index) => {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    imagesLoaded++;
    if (imagesLoaded === foodImagesSrc.length) {
      initGame();
    }
  };
  foodImages.push(img);
});

canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  playerSnake.angle = Math.atan2(mouseY - viewportHeight / 2, mouseX - viewportWidth / 2);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  mouseX = touch.clientX;
  mouseY = touch.clientY;
  playerSnake.angle = Math.atan2(mouseY - viewportHeight / 2, mouseX - viewportWidth / 2);
});

canvas.addEventListener('mousedown', () => {
  if (playerSnake.score > 0) boosting = true;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (playerSnake.score > 0) boosting = true;
});

canvas.addEventListener('mouseup', () => boosting = false);
canvas.addEventListener('touchend', () => boosting = false);

window.addEventListener('resize', () => {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
});

// Function to handle player name input
function setPlayerName() {
  let name = localStorage.getItem('playerName') || 'Player'; // Default to 'Player' if name is not set
  playerSnake.name = name;
}

// Call this function when the game starts
setPlayerName();

// Add a button to change the player's name
const changeNameButton = document.createElement('button');
changeNameButton.textContent = 'Change Name';
changeNameButton.style.position = 'absolute';
changeNameButton.style.top = '10px';
changeNameButton.style.right = '10px';
changeNameButton.addEventListener('click', setPlayerName);
document.body.appendChild(changeNameButton);

// Function to respawn the player
function respawnPlayer() {
  playerSnake = {
    body: [{ x: Math.random() * worldSize, y: Math.random() * worldSize }],
    angle: 0,
    speed: 3,
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: localStorage.getItem('playerName') || 'Player',
    score: 0
  };
  camera = { x: 0, y: 0 };
  boosting = false;
}

// Modify the gameOver function to allow respawning
function gameOver() {
  alert(`Game Over! Your score: ${playerSnake.score}`);
  window.location.href="C:/Users/Wajahat Traders/Coding/New Folder/slither.io/startmnu/index.html"
}

let gamePaused = true;

function togglePause() {
  gamePaused = !gamePaused;
  if (gamePaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('PAUSED', canvas.width / 2 - 80, canvas.height / 2);
  }
}

// Add pause button
const pauseButton = document.createElement('button');
pauseButton.textContent = 'Pause';
pauseButton.style.position = 'absolute';
pauseButton.style.top = '10px';
pauseButton.style.left = '10px';
pauseButton.addEventListener('click', togglePause);
document.body.appendChild(pauseButton);

// Modify your game loop to respect the pause state
function gameLoop() {
  if (!gamePaused) {
    movePlayerSnake();
    enemySnakes.forEach(moveEnemySnake);
    drawGame();
  }
  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

