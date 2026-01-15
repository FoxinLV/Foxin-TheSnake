const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const overlayAction = document.getElementById('overlayAction');

const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const comboValue = document.getElementById('comboValue');
const timeValue = document.getElementById('timeValue');
const modeBadge = document.getElementById('modeBadge');
const speedBadge = document.getElementById('speedBadge');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const randomBtn = document.getElementById('randomBtn');

const modeSelect = document.getElementById('modeSelect');
const speedRange = document.getElementById('speedRange');
const gridRange = document.getElementById('gridRange');
const themeSelect = document.getElementById('themeSelect');
const wrapToggle = document.getElementById('wrapToggle');
const trailToggle = document.getElementById('trailToggle');
const soundToggle = document.getElementById('soundToggle');
const gridToggle = document.getElementById('gridToggle');

const gamesPlayed = document.getElementById('gamesPlayed');
const totalFood = document.getElementById('totalFood');
const totalTime = document.getElementById('totalTime');
const maxLength = document.getElementById('maxLength');
const modeStats = document.getElementById('modeStats');

const CACHE_KEY = 'snake.cache.v1';

const MODES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Без трюков и таймеров.'
  },
  {
    id: 'rush',
    name: 'Rush',
    description: 'Скорость растет каждый фрукт.'
  },
  {
    id: 'labyrinth',
    name: 'Labyrinth',
    description: 'Случайные препятствия.'
  },
  {
    id: 'portals',
    name: 'Portals',
    description: 'Телепорты в два конца.'
  },
  {
    id: 'time',
    name: 'Time Attack',
    description: '90 секунд на максимум очков.'
  }
];

const THEMES = [
  { id: 'solar', name: 'Solar' },
  { id: 'mint', name: 'Mint' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'candy', name: 'Candy' }
];

const defaultCache = {
  settings: {
    mode: 'classic',
    speed: 7,
    grid: 18,
    theme: 'solar',
    wrap: false,
    trail: true,
    sound: false,
    showGrid: true
  },
  stats: {
    gamesPlayed: 0,
    totalFood: 0,
    totalTime: 0,
    maxLength: 0,
    bestByMode: {
      classic: 0,
      rush: 0,
      labyrinth: 0,
      portals: 0,
      time: 0
    }
  }
};

const cache = loadCache();
const settings = cache.settings;
const stats = cache.stats;

let gridSize = settings.grid;
let cellSize = 0;
let deviceScale = window.devicePixelRatio || 1;

let snake = [];
let direction = { x: 1, y: 0 };
let directionQueue = [];
let food = { x: 0, y: 0 };
let obstacles = [];
let portals = [];

let score = 0;
let combo = 1;
let lastFoodTimestamp = 0;
let foodCollected = 0;
let running = false;
let paused = false;
let elapsedTime = 0;
let timeLimit = 0;
let speed = settings.speed;
let lastFrame = 0;
let accumulator = 0;

const audio = {
  ctx: null,
  enabled: settings.sound
};

function initAudio() {
  if (!audio.ctx) {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(frequency, duration = 0.08) {
  if (!audio.enabled) return;
  initAudio();
  const oscillator = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(audio.ctx.destination);
  oscillator.start();
  oscillator.stop(audio.ctx.currentTime + duration);
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return cloneCache(defaultCache);
    const parsed = JSON.parse(raw);
    return {
      settings: { ...defaultCache.settings, ...parsed.settings },
      stats: {
        ...defaultCache.stats,
        ...parsed.stats,
        bestByMode: {
          ...defaultCache.stats.bestByMode,
          ...(parsed.stats ? parsed.stats.bestByMode : {})
        }
      }
    };
  } catch (error) {
    return cloneCache(defaultCache);
  }
}

function cloneCache(source) {
  return JSON.parse(JSON.stringify(source));
}

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ settings, stats }));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getMode() {
  return MODES.find((mode) => mode.id === settings.mode) || MODES[0];
}

function updateBadges() {
  modeBadge.textContent = getMode().name;
  const cleanSpeed = speed.toFixed(1).replace('.0', '');
  speedBadge.textContent = `${cleanSpeed}x`;
}

function applyTheme(themeId) {
  if (themeId === 'solar') {
    document.body.removeAttribute('data-theme');
    return;
  }
  document.body.dataset.theme = themeId;
}

function populateSelects() {
  modeSelect.innerHTML = '';
  MODES.forEach((mode) => {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.name;
    modeSelect.appendChild(option);
  });

  themeSelect.innerHTML = '';
  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });
}

function syncControls() {
  modeSelect.value = settings.mode;
  speedRange.value = settings.speed;
  gridRange.value = settings.grid;
  themeSelect.value = settings.theme;
  wrapToggle.checked = settings.wrap;
  trailToggle.checked = settings.trail;
  soundToggle.checked = settings.sound;
  gridToggle.checked = settings.showGrid;
  applyTheme(settings.theme);
  updateBadges();
}

function resizeCanvas() {
  const size = canvas.parentElement.clientWidth;
  deviceScale = window.devicePixelRatio || 1;
  canvas.width = size * deviceScale;
  canvas.height = size * deviceScale;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  cellSize = size / gridSize;
}

function resetState() {
  running = false;
  paused = false;
  accumulator = 0;
  const center = Math.floor(gridSize / 2);
  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center }
  ];
  direction = { x: 1, y: 0 };
  directionQueue = [];
  score = 0;
  combo = 1;
  lastFoodTimestamp = 0;
  foodCollected = 0;
  elapsedTime = 0;
  timeLimit = settings.mode === 'time' ? 90 : 0;
  speed = settings.speed;
  obstacles = [];
  portals = [];
  if (settings.mode === 'labyrinth') {
    obstacles = generateObstacles();
  }
  if (settings.mode === 'portals') {
    portals = generatePortals();
  }
  spawnFood();
  updateHud();
  updateStatsPanel();
  updateBadges();
  overlayTitle.textContent = 'Готовы?';
  overlaySubtitle.textContent = 'Жми старт или пробел, чтобы начать.';
  overlayAction.textContent = 'Старт';
  overlay.classList.remove('hidden');
}

function startGame() {
  if (running) return;
  resetState();
  running = true;
  paused = false;
  overlay.classList.add('hidden');
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running) return;
  paused = !paused;
  overlayTitle.textContent = paused ? 'Пауза' : 'Продолжаем?';
  overlaySubtitle.textContent = paused
    ? 'Нажми пробел или кнопку, чтобы вернуться.'
    : 'Можно продолжить игру.';
  overlayAction.textContent = paused ? 'Продолжить' : 'Старт';
  overlay.classList.toggle('hidden', !paused);
}

function endGame(reason) {
  running = false;
  paused = false;
  stats.gamesPlayed += 1;
  stats.totalFood += foodCollected;
  stats.totalTime += elapsedTime;
  stats.maxLength = Math.max(stats.maxLength, snake.length);
  stats.bestByMode[settings.mode] = Math.max(stats.bestByMode[settings.mode], score);
  saveCache();
  updateStatsPanel();
  updateHud();
  overlayTitle.textContent = 'Игра окончена';
  overlaySubtitle.textContent = reason;
  overlayAction.textContent = 'Сыграть снова';
  overlay.classList.remove('hidden');
}

function loop(timestamp) {
  if (!running) return;
  if (paused) {
    lastFrame = timestamp;
    requestAnimationFrame(loop);
    return;
  }

  const delta = (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  accumulator += delta;
  const step = 1 / speed;

  while (accumulator >= step) {
    tick(step);
    accumulator -= step;
  }

  render();
  requestAnimationFrame(loop);
}

function tick(step) {
  elapsedTime += step;
  if (settings.mode === 'time') {
    if (elapsedTime >= timeLimit) {
      endGame('Время вышло.');
      playTone(180, 0.12);
      return;
    }
  }

  if (directionQueue.length) {
    direction = directionQueue.shift();
  }
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  if (settings.wrap) {
    head.x = (head.x + gridSize) % gridSize;
    head.y = (head.y + gridSize) % gridSize;
  } else {
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      endGame('Стена остановила тебя.');
      playTone(120, 0.12);
      return;
    }
  }

  if (portals.length === 2) {
    if (head.x === portals[0].x && head.y === portals[0].y) {
      head.x = portals[1].x;
      head.y = portals[1].y;
      playTone(540, 0.06);
    } else if (head.x === portals[1].x && head.y === portals[1].y) {
      head.x = portals[0].x;
      head.y = portals[0].y;
      playTone(540, 0.06);
    }
  }

  if (snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
    endGame('Сама себя поймала.');
    playTone(120, 0.12);
    return;
  }

  if (obstacles.some((block) => block.x === head.x && block.y === head.y)) {
    endGame('Врезалась в преграду.');
    playTone(120, 0.12);
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    const now = performance.now();
    combo = now - lastFoodTimestamp < 2800 ? Math.min(combo + 1, 6) : 1;
    lastFoodTimestamp = now;
    score += Math.round(10 * combo);
    foodCollected += 1;
    playTone(620, 0.06);
    if (settings.mode === 'rush') {
      speed = Math.min(speed + 0.3, 18);
    }
    if (settings.mode === 'labyrinth' && score % 30 === 0) {
      obstacles = growObstacles(obstacles);
    }
    spawnFood();
  } else {
    snake.pop();
  }

  updateHud();
}

function spawnFood() {
  food = randomEmptyCell();
}

function generateObstacles() {
  const blocks = [];
  const target = Math.floor(gridSize * gridSize * 0.08);
  let guard = 0;
  while (blocks.length < target && guard < target * 8) {
    guard += 1;
    const cell = randomCell();
    const isNearStart = Math.abs(cell.x - Math.floor(gridSize / 2)) < 3 && Math.abs(cell.y - Math.floor(gridSize / 2)) < 3;
    const occupied = blocks.some((block) => block.x === cell.x && block.y === cell.y) ||
      snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
    if (!isNearStart && !occupied) {
      blocks.push(cell);
    }
  }
  return blocks;
}

function growObstacles(existing) {
  const blocks = [...existing];
  let guard = 0;
  while (blocks.length < Math.floor(gridSize * gridSize * 0.1) && guard < 120) {
    guard += 1;
    const cell = randomCell();
    const occupied = blocks.some((block) => block.x === cell.x && block.y === cell.y) ||
      snake.some((segment) => segment.x === cell.x && segment.y === cell.y) ||
      (cell.x === food.x && cell.y === food.y);
    if (!occupied) {
      blocks.push(cell);
      break;
    }
  }
  return blocks;
}

function generatePortals() {
  const first = randomEmptyCell();
  let second = randomEmptyCell();
  let guard = 0;
  while (second.x === first.x && second.y === first.y && guard < 20) {
    guard += 1;
    second = randomEmptyCell();
  }
  return [first, second];
}

function randomCell() {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

function randomEmptyCell() {
  let guard = 0;
  while (guard < 400) {
    guard += 1;
    const cell = randomCell();
    const occupied = snake.some((segment) => segment.x === cell.x && segment.y === cell.y) ||
      obstacles.some((block) => block.x === cell.x && block.y === cell.y) ||
      portals.some((portal) => portal.x === cell.x && portal.y === cell.y);
    if (!occupied) return cell;
  }
  return { x: 1, y: 1 };
}

function renderGrid(size) {
  ctx.strokeStyle = getCssVar('--grid');
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridSize; i += 1) {
    const pos = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }
}

function render() {
  const size = canvas.width / deviceScale;
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = getCssVar('--board');
  ctx.fillRect(0, 0, size, size);

  if (settings.showGrid) {
    renderGrid(size);
  }

  if (obstacles.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    obstacles.forEach((block) => {
      ctx.fillRect(block.x * cellSize, block.y * cellSize, cellSize, cellSize);
    });
  }

  if (portals.length === 2) {
    portals.forEach((portal) => {
      const cx = portal.x * cellSize + cellSize / 2;
      const cy = portal.y * cellSize + cellSize / 2;
      const radius = cellSize * 0.4;
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      gradient.addColorStop(0, getCssVar('--portal'));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const foodCenterX = food.x * cellSize + cellSize / 2;
  const foodCenterY = food.y * cellSize + cellSize / 2;
  ctx.fillStyle = getCssVar('--food');
  ctx.beginPath();
  ctx.arc(foodCenterX, foodCenterY, cellSize * 0.32, 0, Math.PI * 2);
  ctx.fill();

  snake.forEach((segment, index) => {
    const ratio = settings.trail ? 1 - index / (snake.length + 1) : 1;
    const color = index === 0 ? getCssVar('--snake') : getCssVar('--snake-alt');
    ctx.fillStyle = withAlpha(color, Math.max(0.35, ratio));
    const radius = index === 0 ? 6 : 4;
    drawRoundedRect(segment.x * cellSize + 1, segment.y * cellSize + 1, cellSize - 2, cellSize - 2, radius);
    ctx.fill();
  });

  drawEyes();
}

function drawEyes() {
  if (!snake.length) return;
  const head = snake[0];
  const centerX = head.x * cellSize + cellSize / 2;
  const centerY = head.y * cellSize + cellSize / 2;
  const eyeOffsetX = direction.y !== 0 ? cellSize * 0.18 : cellSize * 0.22;
  const eyeOffsetY = direction.x !== 0 ? cellSize * 0.18 : cellSize * 0.22;
  const eyeRadius = cellSize * 0.08;
  ctx.fillStyle = '#0f0f0f';
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(centerX + eyeOffsetX, centerY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
}

function withAlpha(color, alpha) {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function drawRoundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
}

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function updateHud() {
  scoreValue.textContent = score;
  bestValue.textContent = stats.bestByMode[settings.mode] || 0;
  comboValue.textContent = `x${combo}`;
  const timeLeft = settings.mode === 'time' ? Math.max(0, timeLimit - elapsedTime) : elapsedTime;
  timeValue.textContent = formatTime(timeLeft);
  updateBadges();
}

function updateStatsPanel() {
  gamesPlayed.textContent = stats.gamesPlayed;
  totalFood.textContent = stats.totalFood;
  totalTime.textContent = formatTime(stats.totalTime);
  maxLength.textContent = stats.maxLength;

  modeStats.innerHTML = '';
  MODES.forEach((mode) => {
    const item = document.createElement('div');
    item.className = 'stats__item';
    const label = document.createElement('span');
    label.textContent = mode.name;
    const value = document.createElement('span');
    value.textContent = `${stats.bestByMode[mode.id] || 0}`;
    item.appendChild(label);
    item.appendChild(value);
    modeStats.appendChild(item);
  });
}

function handleDirection(x, y) {
  const next = { x, y };
  const last = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
  if (next.x === -last.x && next.y === -last.y) {
    return;
  }
  if (next.x === last.x && next.y === last.y) {
    return;
  }
  if (directionQueue.length < 2) {
    directionQueue.push(next);
  }
}

function handleKey(event) {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const blockedKeys = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'w',
    'W',
    'a',
    'A',
    's',
    'S',
    'd',
    'D',
    ' '
  ];
  if (blockedKeys.includes(event.key)) {
    event.preventDefault();
  }
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      handleDirection(0, -1);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      handleDirection(0, 1);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      handleDirection(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      handleDirection(1, 0);
      break;
    case ' ':
      if (running) {
        pauseGame();
      } else {
        startGame();
      }
      break;
    default:
      break;
  }
}

function handleSwipe() {
  let startX = 0;
  let startY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleDirection(dx > 0 ? 1 : -1, 0);
    } else {
      handleDirection(0, dy > 0 ? 1 : -1);
    }
  });
}

function setMode(newMode) {
  settings.mode = newMode;
  saveCache();
  resetState();
  render();
}

function setSpeed(newSpeed) {
  settings.speed = Number(newSpeed);
  speed = settings.speed;
  saveCache();
  updateBadges();
}

function setGrid(newGrid) {
  settings.grid = Number(newGrid);
  gridSize = settings.grid;
  saveCache();
  resizeCanvas();
  resetState();
  render();
}

function setTheme(themeId) {
  settings.theme = themeId;
  saveCache();
  applyTheme(themeId);
  render();
}

function setToggle(key, value) {
  settings[key] = value;
  if (key === 'sound') audio.enabled = value;
  saveCache();
  render();
}

function surpriseMe() {
  const randomMode = MODES[Math.floor(Math.random() * MODES.length)];
  const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const randomSpeed = Math.floor(Math.random() * 8) + 6;
  const randomGrid = [14, 16, 18, 20, 22, 24][Math.floor(Math.random() * 6)];
  settings.mode = randomMode.id;
  settings.theme = randomTheme.id;
  settings.speed = randomSpeed;
  settings.grid = randomGrid;
  settings.wrap = Math.random() > 0.5;
  settings.trail = Math.random() > 0.3;
  settings.showGrid = Math.random() > 0.3;
  saveCache();
  syncControls();
  gridSize = settings.grid;
  speed = settings.speed;
  resetState();
  resizeCanvas();
  render();
}

function bindEvents() {
  if (startBtn) {
    startBtn.addEventListener('click', startGame);
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', pauseGame);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      running = false;
      paused = false;
      resetState();
      render();
    });
  }
  if (randomBtn) {
    randomBtn.addEventListener('click', surpriseMe);
  }
  if (overlayAction) {
    overlayAction.addEventListener('click', () => {
      if (running) {
        pauseGame();
      } else {
        startGame();
      }
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', (event) => setMode(event.target.value));
  }
  if (speedRange) {
    speedRange.addEventListener('input', (event) => setSpeed(event.target.value));
  }
  if (gridRange) {
    gridRange.addEventListener('input', (event) => setGrid(event.target.value));
  }
  if (themeSelect) {
    themeSelect.addEventListener('change', (event) => setTheme(event.target.value));
  }
  if (wrapToggle) {
    wrapToggle.addEventListener('change', (event) => setToggle('wrap', event.target.checked));
  }
  if (trailToggle) {
    trailToggle.addEventListener('change', (event) => setToggle('trail', event.target.checked));
  }
  if (soundToggle) {
    soundToggle.addEventListener('change', (event) => setToggle('sound', event.target.checked));
  }
  if (gridToggle) {
    gridToggle.addEventListener('change', (event) => setToggle('showGrid', event.target.checked));
  }

  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  handleSwipe();
}

function init() {
  populateSelects();
  syncControls();
  resizeCanvas();
  resetState();
  render();
  bindEvents();
  updateStatsPanel();
}

init();
