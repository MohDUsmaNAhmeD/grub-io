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
  if (!playerSnake) return;

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
  const storedName = localStorage.getItem("playerName");
  playerSnake = {
    body: [{ x: worldSize / 2, y: worldSize / 2 }],
    angle: 0,
    speed: 3,
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: (storedName && storedName.trim() !== "") ? storedName.trim() : "Player",
    score: 0
  };
  enemySnakes = [];
  foods = [];
  camera = { x: 0, y: 0 };
  mouseX = viewportWidth / 2;
  mouseY = viewportHeight / 2;
  boosting = false;
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
  const distToPlayer = Math.hypot(playerSnake.body[0].x - head.x, playerSnake.body[0].y - head.y);

  let nearestFood = foods.reduce((nearest, food) => {
    const distance = Math.hypot(food.x - head.x, food.y - head.y);
    return distance < nearest.distance ? { food, distance } : nearest;
  }, { food: null, distance: Infinity }).food;

  let dangerSnake = null;
  let dangerDist = Infinity;
  const allSnakes = [playerSnake, ...enemySnakes];
  for (let other of allSnakes) {
    if (other === snake || other.body.length < 3) continue;
    const dist = Math.hypot(other.body[0].x - head.x, other.body[0].y - head.y);
    if (dist < 300 && dist < dangerDist) {
      dangerDist = dist;
      dangerSnake = other;
    }
  }

  let targetAngle = snake.angle;
  let shouldBoost = false;

  // Chase player if within aggro radius and player is smaller
  if (distToPlayer < snake.aggroRadius && playerSnake.score < snake.score * 1.2) {
    const playerAngle = Math.atan2(playerSnake.body[0].y - head.y, playerSnake.body[0].x - head.x);
    const predictX = playerSnake.body[0].x + Math.cos(playerSnake.angle) * 100;
    const predictY = playerSnake.body[0].y + Math.sin(playerSnake.angle) * 100;
    const predictAngle = Math.atan2(predictY - head.y, predictX - head.x);
    targetAngle = (distToPlayer < 150) ? playerAngle : predictAngle;
    shouldBoost = distToPlayer < 250 && snake.score > 10;
  }
  // Flee from larger snakes
  else if (dangerSnake && dangerDist < 200 && snake.score < dangerSnake.score * 0.8) {
    targetAngle = Math.atan2(head.y - dangerSnake.body[0].y, head.x - dangerSnake.body[0].x);
    shouldBoost = dangerDist < 120 && snake.score > 5;
  }
  // Circle player if much larger
  else if (distToPlayer < 600 && snake.score > playerSnake.score * 1.5) {
    const playerAngle = Math.atan2(playerSnake.body[0].y - head.y, playerSnake.body[0].x - head.x);
    targetAngle = playerAngle + Math.PI / 2.5;
    shouldBoost = distToPlayer > 300 && distToPlayer < 500 && snake.score > 20;
  }
  // Chase nearest food
  else if (nearestFood) {
    targetAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
  }

  // Obstacle avoidance: steer away from nearby snake bodies
  const lookAhead = 80;
  for (let other of allSnakes) {
    if (other === snake) continue;
    for (let i = 0; i < Math.min(other.body.length, 10); i++) {
      const segment = other.body[i];
      const segDist = Math.hypot(segment.x - head.x, segment.y - head.y);
      if (segDist < lookAhead) {
        const avoidAngle = Math.atan2(head.y - segment.y, head.x - segment.x);
        const avoidStrength = (lookAhead - segDist) / lookAhead;
        targetAngle += avoidAngle * avoidStrength * 0.5;
      }
    }
  }

  // World boundary avoidance
  const margin = 200;
  if (head.x < margin) targetAngle = 0;
  else if (head.x > worldSize - margin) targetAngle = Math.PI;
  if (head.y < margin) targetAngle = Math.PI / 2;
  else if (head.y > worldSize - margin) targetAngle = -Math.PI / 2;

  // Smooth angle interpolation
  let angleDiff = targetAngle - snake.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  snake.angle += angleDiff * 0.1;

  // Small random jitter (reduced for smarter bots)
  if (Math.random() < 0.01) {
    snake.angle += (Math.random() - 0.5) * Math.PI / 6;
  }

  // Apply speed and boosting
  let moveSpeed = snake.speed;
  if (shouldBoost && snake.score > 1) {
    moveSpeed *= 1.4;
    snake.score -= 1;
  }

  const newHead = {
    x: head.x + Math.cos(snake.angle) * moveSpeed,
    y: head.y + Math.sin(snake.angle) * moveSpeed
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
  const difficulty = Math.random();
  let speed, score, aggroRadius;
  if (difficulty < 0.2) {
    speed = 2.5; score = 15; aggroRadius = 400;
  } else if (difficulty < 0.6) {
    speed = 3.2; score = 30; aggroRadius = 550;
  } else {
    speed = 3.8; score = 50; aggroRadius = 700;
  }
  return {
    body: [{ 
      x: Math.random() * worldSize, 
      y: Math.random() * worldSize 
    }],
    angle: Math.random() * Math.PI * 2,
    speed: speed,
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: `Bot ${Math.floor(Math.random() * 1000)}`,
    score: score,
    aggroRadius: aggroRadius,
    difficulty: difficulty,
    boostCooldown: 0,
    targetAngle: null
  };
}

function initGame() {
  initializeVariables();

  const numEnemySnakes = 30;
  for (let i = 0; i < numEnemySnakes; i++) {
    enemySnakes.push(createEnemySnake());
  }

  const numInitialFood = 100;
  for (let i = 0; i < numInitialFood; i++) {
    generateFood(Math.random() * worldSize, Math.random() * worldSize, 1);
  }
}

foodImagesSrc.forEach((src, index) => {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    imagesLoaded++;
    if (imagesLoaded === foodImagesSrc.length) {
      initGame();
      gameLoop();
    }
  };
  foodImages.push(img);
});

canvas.addEventListener('mousemove', (e) => {
  if (!playerSnake) return;
  mouseX = e.clientX;
  mouseY = e.clientY;
  playerSnake.angle = Math.atan2(mouseY - viewportHeight / 2, mouseX - viewportWidth / 2);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!playerSnake) return;
  const touch = e.touches[0];
  mouseX = touch.clientX;
  mouseY = touch.clientY;
  playerSnake.angle = Math.atan2(mouseY - viewportHeight / 2, mouseX - viewportWidth / 2);
});

canvas.addEventListener('mousedown', () => {
  if (playerSnake && playerSnake.score > 0) boosting = true;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (playerSnake && playerSnake.score > 0) boosting = true;
});

canvas.addEventListener('mouseup', () => boosting = false);
canvas.addEventListener('touchend', () => boosting = false);

window.addEventListener('resize', () => {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
});

// Function to respawn the player
function respawnPlayer() {
  const storedName = localStorage.getItem('playerName');
  playerSnake = {
    body: [{ x: Math.random() * worldSize, y: Math.random() * worldSize }],
    angle: 0,
    speed: 3,
    color: snakeColors[Math.floor(Math.random() * snakeColors.length)],
    name: (storedName && storedName.trim() !== "") ? storedName.trim() : "Player",
    score: 0
  };
  camera = { x: 0, y: 0 };
  boosting = false;
}

// Modify the gameOver function to allow respawning
function gameOver() {
  gamePaused = true;
  document.getElementById('go-score').textContent = `Score: ${playerSnake.score}`;
  document.getElementById('game-over-overlay').style.display = 'flex';
}

let gamePaused = false;

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

// Game loop
function gameLoop() {
  if (!gamePaused) {
    movePlayerSnake();
    enemySnakes.forEach(moveEnemySnake);
    drawGame();
  }
  requestAnimationFrame(gameLoop);
}

// Start the game loop
// (gameLoop is called from the image onload callback after initGame)

