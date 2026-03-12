import { ZeusSlotManager } from './ZeusSlotManager.js';
import { ReelAnimationCurve } from './ReelAnimationCurve.js';
import { ZeusReel } from './ZeusReel.js';

// Параметры сцены
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const ROWS = 3;
const COLS = 3;
const SYMBOL_WIDTH = 248;
const SYMBOL_HEIGHT = 166;
const OUTER_MARGIN_X = 0; // Внешние поля от краёв сцены по X
const OUTER_MARGIN_Y = 0; // Внешние поля от краёв сцены по Y
const GRID_OFFSET_X = 0; // Смещение всего массива рилов относительно центра по X
const GRID_OFFSET_Y = 55; // Смещение всего массива рилов относительно центра по Y
const REEL_GAP_X = 0; // Расстояние между рилами по X
const REEL_GAP_Y = 5; // Расстояние между рилами по Y
const ENABLE_DEBUG_REEL = false; // Показ одиночной отладочной ленты слева

async function createApp() {
  const root = document.getElementById('game-root');
  if (!root) {
    throw new Error('Element #game-root not found');
  }

  const app = new PIXI.Application();
  await app.init({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1
  });

  root.appendChild(app.canvas);
  return app;
}

function createSlotManager(app, reelProfile) {

  const rowStep = reelProfile.step || SYMBOL_HEIGHT;
  const gridWidth = COLS * SYMBOL_WIDTH + (COLS - 1) * REEL_GAP_X;
  const gridHeight = ROWS * rowStep + (ROWS - 1) * REEL_GAP_Y;

  // Центруем поле относительно сцены + добавляем внешние поля и дополнительные смещения.
  const originX = (STAGE_WIDTH - gridWidth) / 2 + OUTER_MARGIN_X + GRID_OFFSET_X;
  const originY = (STAGE_HEIGHT - gridHeight) / 2 + OUTER_MARGIN_Y + GRID_OFFSET_Y;

  const container = new PIXI.Container();
  app.stage.addChild(container);

  const manager = new ZeusSlotManager({
    parent: container,
    rows: ROWS,
    cols: COLS,
    symbolWidth: SYMBOL_WIDTH,
    symbolHeight: SYMBOL_HEIGHT,
    originX,
    originY,
    gapX: REEL_GAP_X,
    gapY: REEL_GAP_Y,
    reelProfile,
    onSpinComplete: (finalMatrix) => {
      // Для отладки покажем в консоли итоговую матрицу
      // eslint-disable-next-line no-console
      console.log('Spin complete. Matrix:', finalMatrix);
    }
  });

  // Инициализируем стартовую матрицу
  const initialMatrix = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(Math.random() < 0.5 ? 0 : 1);
    }
    initialMatrix.push(row);
  }
  manager.setMatrixImmediately(initialMatrix);

  if (ENABLE_DEBUG_REEL) {
    // Отладочная одиночная лента слева от поля (без маски),
    // привязанная к центральной ячейке [1,1] по символам.
    const debugColIndex = 1; // колонка, для которой хотим смотреть ленту (центр)
    const debugCurve = new ReelAnimationCurve(reelProfile, debugColIndex);
    const debugX = originX - SYMBOL_WIDTH * 1.5;
    const debugY = originY + rowStep; // средний ряд (row = 1 при ROWS = 3)

    const debugReel = new ZeusReel({
      parent: app.stage,
      x: debugX,
      y: debugY,
      width: SYMBOL_WIDTH,
      height: SYMBOL_HEIGHT,
      row: 1,
      col: -1, // вне основной сетки, чтобы по индексу было видно, что это отладка
      curve: debugCurve,
      startDelayMs: 0,
      onStop: null,
      useMask: false,
      padding: 0
    });

    // Стартовый символ — тот же, что в центральной ячейке сценария.
    if (initialMatrix[1] && typeof initialMatrix[1][1] !== 'undefined') {
      debugReel.setSymbol(initialMatrix[1][1]);
    }

    // Сохраним ссылку на отладочную ленту в менеджере, чтобы использовать её при спине и апдейте.
    manager.debugReel = debugReel;
  }

  // Отладочная нумерация индексов сетки (col,row) в единой системе координат.
  const indexContainer = new PIXI.Container();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const label = new PIXI.Text(`${col},${row}`, {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xff0000,
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 2
      });
      label.x = originX + col * (SYMBOL_WIDTH + REEL_GAP_X) + 6;
      label.y = originY + row * (rowStep + REEL_GAP_Y) + 6;
      label.zIndex = 1000;
      indexContainer.addChild(label);
    }
  }
  app.stage.addChild(indexContainer);

  return manager;
}

async function loadReelAnimationConfig() {
  const response = await fetch('./reel_animation/hw_normal_speed.json');
  if (!response.ok) {
    throw new Error('Failed to load hw_normal_speed.json');
  }
  // В этой игре используем один профиль Hold & Win → возвращаем объект профиля напрямую.
  return response.json();
}

function setupSpinDemo(app, slotManager) {
  let lastTime = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;
    slotManager.update(deltaMs);
    if (ENABLE_DEBUG_REEL && slotManager.debugReel) {
      slotManager.debugReel.update(deltaMs);
    }
  });

  function randomMatrix() {
    const m = [];
    for (let r = 0; r < ROWS; r += 1) {
      const row = [];
      for (let c = 0; c < COLS; c += 1) {
        row.push(Math.random() < 0.5 ? 0 : 1);
      }
      m.push(row);
    }
    return m;
  }

  function triggerSpin() {
    const target = randomMatrix();
    slotManager.spinToMatrix(target);

    // Отладочная лента (если включена) повторяет поведение центральной ячейки [1,1]
    // по целевому символу.
    if (ENABLE_DEBUG_REEL && slotManager.debugReel && target[1]) {
      const debugTargetSymbol = typeof target[1][1] !== 'undefined' ? target[1][1] : 0;
      // Используем тот же номер шага сценария, что и в слот-менеджере.
      const stepId = slotManager.spinIndex || 0;
      slotManager.debugReel.spinToSymbol(debugTargetSymbol, stepId);
    }
  }

  // Клавиатура: пробел — новый спин
  window.addEventListener('keydown', (evt) => {
    if (evt.code === 'Space') {
      evt.preventDefault();
      triggerSpin();
    }
  });
}

async function main() {
  const app = await createApp();

  let reelConfig;
  try {
    reelConfig = await loadReelAnimationConfig();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to load hw_normal_speed.json, using fallback profile.', e);
    // Фолбэк-профиль, если JSON не загрузился
    reelConfig = {
      step: SYMBOL_HEIGHT - 10,
      tapeLength: 5,
      extraLength: 1,
      reelStartDelayMs: 20,
      containers: {
        start: { durationMs: 260, rangePx: (SYMBOL_HEIGHT - 10) * 0.8 },
        linear: { durationMs: 90, distancePx: SYMBOL_HEIGHT - 10 },
        end: { durationMs: 210, rangePx: (SYMBOL_HEIGHT - 10) * 0.6 }
      },
      startCurve: [],
      endCurve: []
    };
  }

  const slotManager = createSlotManager(app, reelConfig);
  setupSpinDemo(app, slotManager);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

