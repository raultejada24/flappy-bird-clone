const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const currentScoreElement = document.querySelector('#current-score');
const bestScoreElement = document.querySelector('#best-score');
const liveLabel = document.querySelector('.live-label');

const WIDTH = 480;
const HEIGHT = 720;
const GROUND_HEIGHT = 80;
const GROUND_TOP = HEIGHT - GROUND_HEIGHT;
const BIRD_X = 118;
const BIRD_RADIUS = 18;
const GRAVITY = 1450;
const FLAP_VELOCITY = -430;
const BASE_PIPE_SPEED = 175;
const PIPE_WIDTH = 72;
const BASE_GAP = 178;

let state = 'ready';
let score = 0;
let bestScore = Number.parseInt(localStorage.getItem('wingline-best') ?? '0', 10);
let lastTime = 0;
let pipeTimer = 0;
let elapsedTime = 0;
let groundOffset = 0;
let shakeTime = 0;
let restartDelay = 0;
let pipes = [];
let particles = [];

const bird = {
  x: BIRD_X,
  y: HEIGHT * 0.44,
  velocity: 0,
  rotation: 0,
  wingPhase: 0,
};

const clouds = [
  { x: 45, y: 120, size: 0.75, speed: 8 },
  { x: 310, y: 205, size: 1.05, speed: 12 },
  { x: 190, y: 65, size: 0.55, speed: 6 },
];

function formatScore(value) {
  return String(value).padStart(2, '0');
}

function updateScoreDisplay() {
  currentScoreElement.textContent = formatScore(score);
  bestScoreElement.textContent = formatScore(bestScore);
}

function setStatus(label, isActive = false) {
  liveLabel.lastChild.textContent = ` ${label}`;
  liveLabel.classList.toggle('is-active', isActive);
}

function resetGame() {
  state = 'ready';
  score = 0;
  pipeTimer = 0.75;
  restartDelay = 0;
  pipes = [];
  particles = [];
  bird.y = HEIGHT * 0.44;
  bird.velocity = 0;
  bird.rotation = 0;
  updateScoreDisplay();
  setStatus('Ready');
}

function startGame() {
  if (state === 'ready') {
    state = 'playing';
    setStatus('Flying', true);
  }
}

function createParticles(count, color, speed = 120) {
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2;
    const force = speed * (0.4 + Math.random() * 0.7);
    particles.push({
      x: bird.x - 10,
      y: bird.y + 5,
      velocityX: Math.cos(angle) * force,
      velocityY: Math.sin(angle) * force,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      radius: 2 + Math.random() * 3,
      color,
    });
  }
}

function flap() {
  if (state === 'paused') {
    return;
  }

  if (state === 'gameover') {
    if (restartDelay <= 0) {
      resetGame();
      startGame();
    } else {
      return;
    }
  } else {
    startGame();
  }

  bird.velocity = FLAP_VELOCITY;
  bird.wingPhase = 0;
  createParticles(5, '#fff1c7', 90);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    setStatus('Paused');
  } else if (state === 'paused') {
    state = 'playing';
    setStatus('Flying', true);
  }
}

function endGame() {
  if (state !== 'playing') {
    return;
  }

  state = 'gameover';
  restartDelay = 0.55;
  shakeTime = 0.22;
  createParticles(16, '#ffb84d', 190);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('wingline-best', String(bestScore));
  }

  updateScoreDisplay();
  setStatus('Landed');
}

function spawnPipe() {
  const gapSize = Math.max(BASE_GAP - score * 1.5, 148);
  const minimumTop = 105;
  const maximumTop = GROUND_TOP - gapSize - 105;
  const gapTop = minimumTop + Math.random() * (maximumTop - minimumTop);

  pipes.push({
    x: WIDTH + 20,
    gapTop,
    gapSize,
    scored: false,
  });
}

function circleIntersectsRectangle(circleX, circleY, radius, x, y, width, height) {
  const closestX = Math.max(x, Math.min(circleX, x + width));
  const closestY = Math.max(y, Math.min(circleY, y + height));
  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function checkCollisions() {
  if (bird.y + BIRD_RADIUS >= GROUND_TOP || bird.y - BIRD_RADIUS <= 0) {
    endGame();
    return;
  }

  for (const pipe of pipes) {
    const hitTop = circleIntersectsRectangle(
      bird.x,
      bird.y,
      BIRD_RADIUS - 3,
      pipe.x,
      0,
      PIPE_WIDTH,
      pipe.gapTop,
    );
    const hitBottom = circleIntersectsRectangle(
      bird.x,
      bird.y,
      BIRD_RADIUS - 3,
      pipe.x,
      pipe.gapTop + pipe.gapSize,
      PIPE_WIDTH,
      GROUND_TOP - pipe.gapTop - pipe.gapSize,
    );

    if (hitTop || hitBottom) {
      endGame();
      return;
    }
  }
}

function updateParticles(deltaTime) {
  particles.forEach((particle) => {
    particle.x += particle.velocityX * deltaTime;
    particle.y += particle.velocityY * deltaTime;
    particle.velocityY += 260 * deltaTime;
    particle.life -= deltaTime;
  });
  particles = particles.filter((particle) => particle.life > 0);
}

function updateClouds(deltaTime) {
  clouds.forEach((cloud) => {
    cloud.x -= cloud.speed * deltaTime;
    if (cloud.x < -100 * cloud.size) {
      cloud.x = WIDTH + 80;
    }
  });
}

function update(deltaTime) {
  elapsedTime += deltaTime;
  updateClouds(deltaTime);
  updateParticles(deltaTime);

  if (restartDelay > 0) {
    restartDelay -= deltaTime;
  }

  if (shakeTime > 0) {
    shakeTime -= deltaTime;
  }

  if (state === 'ready') {
    bird.y = HEIGHT * 0.44 + Math.sin(elapsedTime * 3.2) * 10;
    bird.rotation = Math.sin(elapsedTime * 3.2) * 0.06;
    bird.wingPhase += deltaTime * 7;
    groundOffset = (groundOffset + BASE_PIPE_SPEED * 0.35 * deltaTime) % 32;
    return;
  }

  if (state !== 'playing') {
    return;
  }

  const pipeSpeed = BASE_PIPE_SPEED + Math.min(score * 3, 60);
  bird.velocity = Math.min(bird.velocity + GRAVITY * deltaTime, 720);
  bird.y += bird.velocity * deltaTime;
  bird.rotation = Math.max(-0.45, Math.min(1.15, bird.velocity / 620));
  bird.wingPhase += deltaTime * 13;
  groundOffset = (groundOffset + pipeSpeed * deltaTime) % 32;

  pipeTimer -= deltaTime;
  if (pipeTimer <= 0) {
    spawnPipe();
    pipeTimer = Math.max(1.42 - score * 0.012, 1.1);
  }

  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed * deltaTime;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < bird.x) {
      pipe.scored = true;
      score += 1;
      updateScoreDisplay();
    }
  });

  pipes = pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -20);
  checkCollisions();
}

function drawRoundedRectangle(x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawCloud(cloud) {
  context.save();
  context.translate(cloud.x, cloud.y);
  context.scale(cloud.size, cloud.size);
  context.fillStyle = 'rgba(255, 255, 255, 0.55)';
  context.beginPath();
  context.arc(0, 12, 24, 0, Math.PI * 2);
  context.arc(26, 0, 32, 0, Math.PI * 2);
  context.arc(58, 14, 22, 0, Math.PI * 2);
  context.rect(0, 12, 58, 24);
  context.fill();
  context.restore();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#79cbd8');
  gradient.addColorStop(0.62, '#b7e3df');
  gradient.addColorStop(1, '#f3d7a2');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = 'rgba(255, 245, 204, 0.6)';
  context.beginPath();
  context.arc(390, 105, 48, 0, Math.PI * 2);
  context.fill();

  clouds.forEach(drawCloud);

  context.fillStyle = 'rgba(28, 78, 84, 0.12)';
  for (let index = 0; index < 9; index++) {
    const buildingWidth = 48 + (index % 3) * 13;
    const buildingHeight = 80 + ((index * 47) % 120);
    context.fillRect(index * 61 - 18, GROUND_TOP - buildingHeight, buildingWidth, buildingHeight);
  }
}

function drawPipeBody(x, y, width, height, isTop) {
  if (height <= 0) {
    return;
  }

  const capHeight = 34;
  const capY = isTop ? height - capHeight : y;
  const bodyY = isTop ? y : y + capHeight;
  const bodyHeight = height - capHeight;
  const pipeGradient = context.createLinearGradient(x, 0, x + width, 0);
  pipeGradient.addColorStop(0, '#163f43');
  pipeGradient.addColorStop(0.45, '#2b6764');
  pipeGradient.addColorStop(1, '#0d3035');

  context.fillStyle = pipeGradient;
  context.fillRect(x + 8, bodyY, width - 16, bodyHeight);

  context.fillStyle = '#1b4c4d';
  drawRoundedRectangle(x, capY, width, capHeight, 7);

  context.fillStyle = 'rgba(255, 255, 255, 0.12)';
  context.fillRect(x + 16, bodyY, 7, bodyHeight);
  context.fillRect(x + 10, capY + 5, 8, capHeight - 10);
}

function drawPipes() {
  pipes.forEach((pipe) => {
    drawPipeBody(pipe.x, 0, PIPE_WIDTH, pipe.gapTop, true);
    drawPipeBody(
      pipe.x,
      pipe.gapTop + pipe.gapSize,
      PIPE_WIDTH,
      GROUND_TOP - pipe.gapTop - pipe.gapSize,
      false,
    );
  });
}

function drawGround() {
  context.fillStyle = '#d7c079';
  context.fillRect(0, GROUND_TOP, WIDTH, GROUND_HEIGHT);

  context.fillStyle = '#314c3c';
  context.fillRect(0, GROUND_TOP, WIDTH, 12);

  context.fillStyle = '#f3d895';
  for (let x = -groundOffset; x < WIDTH + 32; x += 32) {
    context.beginPath();
    context.moveTo(x, GROUND_TOP + 16);
    context.lineTo(x + 16, GROUND_TOP + 32);
    context.lineTo(x + 32, GROUND_TOP + 16);
    context.closePath();
    context.fill();
  }
}

function drawParticles() {
  particles.forEach((particle) => {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
}

function drawBird() {
  context.save();
  context.translate(bird.x, bird.y);
  context.rotate(bird.rotation);

  context.fillStyle = 'rgba(17, 27, 33, 0.18)';
  context.beginPath();
  context.ellipse(2, 7, 25, 18, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ffbd4a';
  context.beginPath();
  context.ellipse(0, 0, 25, 20, 0, 0, Math.PI * 2);
  context.fill();

  const wingLift = Math.sin(bird.wingPhase) * 7;
  context.fillStyle = '#ef783f';
  context.beginPath();
  context.ellipse(-9, 7 + wingLift * 0.4, 15, 9, -0.35, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#fff8df';
  context.beginPath();
  context.arc(11, -7, 8, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#101a24';
  context.beginPath();
  context.arc(14, -7, 3.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#e75532';
  context.beginPath();
  context.moveTo(20, -1);
  context.lineTo(34, 4);
  context.lineTo(20, 8);
  context.closePath();
  context.fill();

  context.restore();
}

function drawScore() {
  if (state === 'ready') {
    return;
  }

  context.save();
  context.textAlign = 'center';
  context.lineWidth = 7;
  context.strokeStyle = 'rgba(16, 26, 36, 0.5)';
  context.fillStyle = '#fff8e7';
  context.font = '700 58px Georgia';
  context.strokeText(String(score), WIDTH / 2, 82);
  context.fillText(String(score), WIDTH / 2, 82);
  context.restore();
}

function drawPanel(title, message, action) {
  const panelY = 370;

  context.save();
  context.fillStyle = 'rgba(16, 26, 36, 0.88)';
  drawRoundedRectangle(54, panelY, WIDTH - 108, 190, 22);

  context.textAlign = 'center';
  context.fillStyle = '#ffb84d';
  context.font = '700 13px "Courier New"';
  context.fillText(title.toUpperCase(), WIDTH / 2, panelY + 42);

  context.fillStyle = '#fff8e7';
  context.font = '400 38px Georgia';
  context.fillText(message, WIDTH / 2, panelY + 94);

  context.fillStyle = '#aeb9bb';
  context.font = '400 14px Arial';
  context.fillText(action, WIDTH / 2, panelY + 140);

  context.fillStyle = '#ffb84d';
  drawRoundedRectangle(WIDTH / 2 - 44, panelY + 157, 88, 5, 3);
  context.restore();
}

function drawOverlay() {
  if (state === 'ready') {
    drawPanel('Ready for takeoff', 'Find your rhythm', 'Press Space or tap to fly');
  } else if (state === 'paused') {
    context.fillStyle = 'rgba(10, 18, 24, 0.35)';
    context.fillRect(0, 0, WIDTH, GROUND_TOP);
    drawPanel('Flight paused', 'Take a breath', 'Press P to continue');
  } else if (state === 'gameover') {
    drawPanel('Flight complete', `Score ${score}`, 'Press Space or tap to try again');
  }
}

function draw() {
  context.save();

  if (shakeTime > 0) {
    const intensity = shakeTime * 18;
    context.translate(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity,
    );
  }

  drawBackground();
  drawPipes();
  drawGround();
  drawParticles();
  drawBird();
  drawScore();
  drawOverlay();
  context.restore();
}

function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;
  update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

function handlePrimaryAction(event) {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  flap();
}

canvas.addEventListener('pointerdown', handlePrimaryAction);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    flap();
  } else if (event.code === 'KeyP') {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener('blur', () => {
  if (state === 'playing') {
    togglePause();
  }
});

updateScoreDisplay();
resetGame();
requestAnimationFrame(gameLoop);
