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
const OUTER_MARGIN_Y = 55; // Внешние поля от краёв сцены по Y
// Смещение всего массива рилов относительно геометрического центра сцены (1920x1080).
// Базовые значения: поле центрировано по X, слегка опущено по Y.
// ТОНКАЯ подстройка под рамку — только через эти константы.
const GRID_OFFSET_X = 0;
const GRID_OFFSET_Y = 0;
const REEL_GAP_X = 0; // Расстояние между рилами по X
const REEL_GAP_Y = 5; // Расстояние между рилами по Y
const ENABLE_DEBUG_REEL = true; // Показ одиночной отладочной ленты слева
const SHOW_GRID_INDICES = false; // Показ статических подписей индексов (col,row)

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

  // Фон 1920x1080 отрисовываем внутри PIXI,
  // чтобы фон и игровое поле жили в одной сцене.
  const bgTexture = await PIXI.Assets.load('./png/1920х1080.png');
  const bg = new PIXI.Sprite(bgTexture);
  bg.x = 0;
  bg.y = 0;
  bg.width = STAGE_WIDTH;
  bg.height = STAGE_HEIGHT;
  app.stage.addChild(bg);

  root.appendChild(app.canvas);
  return app;
}

function createSlotManager(app, reelProfile, symbolTexture, frameTexture, plateTexture, createSpineCoin) {

  // ВЕРСТКА поля 3×3 всегда опирается на физический размер символа,
  // а не на шаг анимации из профиля. Профиль используется только для движения рилов.
  const rowStep = SYMBOL_HEIGHT;
  const gridWidth = COLS * SYMBOL_WIDTH + (COLS - 1) * REEL_GAP_X;
  const gridHeight = ROWS * SYMBOL_HEIGHT + (ROWS - 1) * REEL_GAP_Y;

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
    symbolTexture,
    frameTexture,
    plateTexture,
    createSpineCoin,
    onSpinComplete: (finalMatrix) => {
      // Для отладки покажем в консоли итоговую матрицу
      // eslint-disable-next-line no-console
      console.log('Spin complete. Matrix:', finalMatrix);
    }
  });

  // Стартовая матрица устанавливается из сценария (см. main()),
  // чтобы поведение было детерминированным между перезагрузками.

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
      symbolTexture,
      startDelayMs: 0,
      onStop: null,
      useMask: false,
      padding: 0
    });

    // Сохраним ссылку на отладочную ленту в менеджере, чтобы использовать её при спине и апдейте.
    manager.debugReel = debugReel;
  }

  if (SHOW_GRID_INDICES) {
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
  }

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

  function triggerSpin(nextMatrix) {
    const target = nextMatrix;
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

  // Сценарий спинов (последовательность матриц).
  let scenario = [];
  let scenarioIndex = 0;

  async function loadScenario() {
    try {
      const resp = await fetch('./scenario/scenario_zeus_2026-03-12T15-44-52.json');
      if (!resp.ok) throw new Error('Failed to load scenario JSON');
      const data = await resp.json();
      if (Array.isArray(data)) {
        scenario = data.map((step) => step.matrix).filter((m) => Array.isArray(m));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load scenario, using random matrices.', e);
      scenario = [];
    }
  }

  function getNextScenarioMatrix() {
    if (scenario.length === 0) {
      // Фолбэк: если сценарий не загрузился — генерим случайную матрицу как раньше.
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
    const matrix = scenario[scenarioIndex % scenario.length];
    scenarioIndex += 1;
    return matrix;
  }

  // Клавиатура: пробел — новый спин по сценарию.
  window.addEventListener('keydown', (evt) => {
    if (evt.code === 'Space') {
      evt.preventDefault();
      const m = getNextScenarioMatrix();
      triggerSpin(m);
    }
  });

  // Начальная инициализация: загружаем сценарий и ставим первый спин.
  (async () => {
    await loadScenario();
    const firstMatrix = getNextScenarioMatrix();
    slotManager.setMatrixImmediately(firstMatrix);
  })();
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

  const coinTexture = await PIXI.Assets.load('./png/coin_default.png');
  const frameTexture = await PIXI.Assets.load('./png/Frame.png');
  const plateTexture = await PIXI.Assets.load('./png/plate.png');

  // Spine-монетка для оверлея: skeleton.json + skeleton.atlas в spine/coin.
  // Регистрируем алиасы и один раз подгружаем ресурсы.
  PIXI.Assets.add({ alias: 'zeusCoinSkeleton', src: './spine/coin/skeleton.json' });
  PIXI.Assets.add({ alias: 'zeusCoinAtlas', src: './spine/coin/skeleton.atlas' });
  await PIXI.Assets.load(['zeusCoinSkeleton', 'zeusCoinAtlas']);

  const createSpineCoin = () => {
    const spineCoin = spine.Spine.from({
      skeleton: 'zeusCoinSkeleton',
      atlas: 'zeusCoinAtlas'
    });

    // Скин-монетка: mult. setSkin принимает объект Skin, не строку.
    const multSkin = spineCoin.skeleton.data.findSkin('mult');
    if (multSkin) {
      spineCoin.skeleton.setSkin(multSkin);
    }
    spineCoin.skeleton.setSlotsToSetupPose();

    // Заглушка physics, если не задана в экспорте.
    if (!spineCoin.skeleton.physics) {
      spineCoin.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {}
      };
    }

    // Базовая анимация — idle, зацикленная.
    spineCoin.state.setAnimation(0, 'idle', true);

    return spineCoin;
  };

  const slotManager = createSlotManager(app, reelConfig, coinTexture, frameTexture, plateTexture, createSpineCoin);
  setupSpinDemo(app, slotManager);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

