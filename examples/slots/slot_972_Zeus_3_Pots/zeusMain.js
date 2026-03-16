import { ZeusSlotManager } from './ZeusSlotManager.js';
import { ReelAnimationCurve } from './ReelAnimationCurve.js';
import { ZeusReel } from './ZeusReel.js';
import { parseScenarioCode, metaToNumericSymbol } from './SymbolMapping.js';
import { fontManager } from './FontManager.js';

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

function createSlotManager(app, reelProfile, symbolTexture, frameTexture, plateTexture, coinFactories) {

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
    coinFactories,
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

  function triggerSpin(nextStep) {
    // nextStep может быть либо чистой числовой матрицей (фолбэк),
    // либо объектом { symbols, meta } из сценария.
    const targetMatrix = Array.isArray(nextStep?.symbols) ? nextStep.symbols : nextStep;
    const metaMatrix = Array.isArray(nextStep?.meta) ? nextStep.meta : null;

    slotManager.spinToMatrix(targetMatrix, metaMatrix);

    // Отладочная лента (если включена) повторяет поведение центральной ячейки [1,1]
    // по целевому символу.
    if (ENABLE_DEBUG_REEL && slotManager.debugReel && targetMatrix[1]) {
      const debugTargetSymbol = typeof targetMatrix[1][1] !== 'undefined' ? targetMatrix[1][1] : 0;
      const debugMeta = metaMatrix && metaMatrix[1] ? metaMatrix[1][1] : null;
      // Используем тот же номер шага сценария, что и в слот-менеджере.
      const stepId = slotManager.spinIndex || 0;
      slotManager.debugReel.spinToSymbol(debugTargetSymbol, stepId, debugMeta);
    }
  }

  // Сценарий спинов (последовательность матриц).
  // Храним отдельно числовые значения для старой логики 0/1
  // и meta-объекты для маппинга на Spine-скины.
  let scenarioNumeric = [];
  let scenarioMeta = [];
  let scenarioIndex = 0;

  async function loadScenario() {
    try {
      const resp = await fetch('./scenario/scenario_zeus_2026-03-16T10-16-49.json');
      if (!resp.ok) throw new Error('Failed to load scenario JSON');
      const data = await resp.json();
      if (Array.isArray(data)) {
        scenarioNumeric = [];
        scenarioMeta = [];

        data.forEach((step) => {
          const matrix = step && Array.isArray(step.matrix) ? step.matrix : null;
          if (!matrix) return;

          const rows = matrix.length;
          const numericMatrix = [];
          const metaMatrix = [];

          for (let r = 0; r < rows; r += 1) {
            const rowCodes = Array.isArray(matrix[r]) ? matrix[r] : [];
            const numericRow = [];
            const metaRow = [];
            for (let c = 0; c < rowCodes.length; c += 1) {
              const code = typeof rowCodes[c] === 'string' ? rowCodes[c] : 'E';
              const meta = parseScenarioCode(code);
              numericRow.push(metaToNumericSymbol(meta));
              metaRow.push(meta);
            }
            numericMatrix.push(numericRow);
            metaMatrix.push(metaRow);
          }

          scenarioNumeric.push(numericMatrix);
          scenarioMeta.push(metaMatrix);
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load scenario, using random matrices.', e);
      scenarioNumeric = [];
      scenarioMeta = [];
    }
  }

  function getNextScenarioStep() {
    if (scenarioNumeric.length === 0) {
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
    const numericMatrix = scenarioNumeric[scenarioIndex % scenarioNumeric.length];
    const metaMatrix = scenarioMeta[scenarioIndex % scenarioMeta.length];
    scenarioIndex += 1;
    return {
      symbols: numericMatrix,
      meta: metaMatrix
    };
  }

  // Клавиатура: пробел — новый спин по сценарию.
  window.addEventListener('keydown', (evt) => {
    if (evt.code === 'Space') {
      evt.preventDefault();
      const step = getNextScenarioStep();
      triggerSpin(step);
    }
  });

  // Начальная инициализация: загружаем сценарий и ставим первый спин.
  (async () => {
    await loadScenario();
    const firstStep = getNextScenarioStep();
    const firstMatrix = Array.isArray(firstStep?.symbols) ? firstStep.symbols : firstStep;
    const firstMeta = Array.isArray(firstStep?.meta) ? firstStep.meta : null;
    slotManager.setMatrixImmediately(firstMatrix, firstMeta);
  })();
}

async function main() {
  const app = await createApp();

  await fontManager.loadFonts();

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

  // Spine-монетки: один скелетон + по 3 уникальных атлас-алиаса на каждый рил.
  // Уникальный алиас → уникальный cacheKey в Spine.from() → отдельный SkeletonData
  // → отдельные объекты Attachment → изолированный attachment.uvs (Float32Array).
  // Это устраняет баг, когда несколько монеток из одного SkeletonData перезаписывают
  // общий attachment.uvs при _applyState(), что приводило к неверным UV у всех, кроме последней.
  const TOTAL_REELS = ROWS * COLS; // 9 рилов для сетки 3×3
  // Слоты: 0 = overlay, 1 = scroll[0] (уходящий), 2 = scroll[1] (приходящий)
  const SLOTS_PER_REEL = 3;

  PIXI.Assets.add({ alias: 'zeusCoinSkeleton', src: './spine/coin/skeleton.json' });
  const atlasAliases = [];
  for (let i = 0; i < TOTAL_REELS * SLOTS_PER_REEL; i++) {
    const alias = `zeusCoinAtlas_${i}`;
    PIXI.Assets.add({ alias, src: './spine/coin/skeleton.atlas' });
    atlasAliases.push(alias);
  }
  await PIXI.Assets.load(['zeusCoinSkeleton', ...atlasAliases]);

  /** Создаёт изолированный Spine-экземпляр из конкретного атлас-алиаса. */
  function makeSpine(atlasAlias) {
    const c = spine.Spine.from({ skeleton: 'zeusCoinSkeleton', atlas: atlasAlias });
    if (!c.skeleton.physics) {
      c.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
    }
    // defaultMix = 0 на каждом экземпляре — мгновенный переход без блендинга.
    c.state.data.defaultMix = 0;
    return c;
  }

  // Создаём по одной фабрике на рил: overlay и scroll-монетки используют
  // разные алиасы → разные SkeletonData → нет общих attachment.uvs.
  const coinFactories = Array.from({ length: TOTAL_REELS }, (_, reelIdx) => ({
    createOverlayCoin: () => makeSpine(`zeusCoinAtlas_${reelIdx * SLOTS_PER_REEL + 0}`),
    createScrollCoin:  (slotIdx) => makeSpine(`zeusCoinAtlas_${reelIdx * SLOTS_PER_REEL + 1 + Math.min(slotIdx, 1)}`),
  }));

  const slotManager = createSlotManager(app, reelConfig, coinTexture, frameTexture, plateTexture, coinFactories);
  setupSpinDemo(app, slotManager);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

