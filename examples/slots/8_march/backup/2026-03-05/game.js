import { createDogPositionMenu } from './DogPositionMenu.js';

const GAME_SIZE = 1024;
const DUCK_SIZE = 64;
const BULLET_SIZE = 16;
const NUM_DUCKS_PER_WAVE = 2;
const TOTAL_WAVES = 8;
const WAVE_DURATION_MS = 10000;           // 10 секунд активного полёта
const WAVE_INTERVAL_MS = 15000;           // 15 секунд между стартом волн (обычный случай)
const INITIAL_WAVE_DELAY_MS = 5000;       // 5 секунд до первой волны
const NEXT_WAVE_AFTER_KILL_MS = 3000;     // 3 секунды после того, как все утки сбиты
const AMMO_PER_WAVE = 3;
const ESCAPE_DELAY_NO_AMMO_MS = 500;      // пауза после последнего выстрела, чтобы пуля успела долететь
const SHOOT_COOLDOWN_MS = 500;            // кулдаун между выстрелами, чтобы нельзя было стрелять очередями

const AUDIO_FILES = {
  intro: './sound/2-duck-hunt-intro.mp3',
  shoot: './sound/10-sfx-gun-shot.mp3',
  dogLaugh: './sound/16-sfx-dog-laughs.mp3',
  dogWin: './sound/4-dog-shows-ducks.mp3',
  dogBark: './sound/12-sfx-dog-bark.mp3',
  fly: './sound/fly.mp3',
  duckFall: './sound/14-sfx-dead-duck-falls.mp3',
  duckLand: './sound/15-sfx-dead-duck-lands.mp3',
  gameOver: './sound/8-game-over.mp3',
  roundClear: './sound/5-round-clear.mp3',
  perfect: './sound/6-perfect.mp3'
};

const audioMap = {};
let introSequenceCompleted = false;

for (const [key, src] of Object.entries(AUDIO_FILES)) {
  const audio = new Audio(src);
  if (key === 'intro') {
    audio.loop = false;
    audio.volume = 0.4;
    audio.addEventListener('ended', () => {
      if (introSequenceCompleted) return;
      introSequenceCompleted = true;
      playDogBarkSequence(3);
    });
  } else if (key === 'fly') {
    audio.loop = true;
    audio.volume = 1; // макс громкость (примерно в 3 раза выше прежних 0.5)
  } else {
    audio.volume = 0.9;
  }
  audioMap[key] = audio;
}

function playSound(name) {
  const audio = audioMap[name];
  if (!audio) return;
  if (name !== 'intro') {
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }
  audio.play().catch(() => {});
}

function stopSound(name) {
  const audio = audioMap[name];
  if (!audio) return;
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // ignore
  }
}

let gameplayEnabled = false;

function playDogBarkSequence(repeats, intervalMs = 400) {
  const audio = audioMap.dogBark;
  if (!audio || repeats <= 0) return;

  let played = 0;

  const playOnce = () => {
    if (played >= repeats) return;
    played++;
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    audio.play().catch(() => {});
    if (played < repeats) {
      setTimeout(playOnce, intervalMs);
    }
  };

  playOnce();
}

// Область полёта: ширина = экран, верх = 0. Редактировать только низ:
const DUCK_FLIGHT_BOTTOM_Y = 670; // нижняя граница, здесь появляются утки

class Duck {
  constructor(app, startX, startY, heartIndex = null, skinName = '1') {
    this.app = app;
    this.heartIndex = heartIndex;
    this.graphics = new PIXI.Graphics();
    this.graphics.rect(-DUCK_SIZE / 2, -DUCK_SIZE / 2, DUCK_SIZE, DUCK_SIZE);
    this.graphics.fill(0xffd447);
    this.graphics.stroke({ color: 0x000000, width: 2 });

    this.graphics.x = startX;
    this.graphics.y = startY;
    this.spawnY = startY;

    this.spine = null;
    this.facingRight = false; // направление взгляда (false = влево)

    this.state = 'flying'; // flying | escaping | falling | dead
    this.winTriggered = false; // для однократного триггера win при касании земли

    // Параметры ломаной траектории (движение с постоянной скоростью)
    this.pathPoints = [];
    this.currentPathIndex = 0; // индекс текущего сегмента в pathPoints (между i и i+1)
    this.flySpeed = 260 * 1.3; // px/s, постоянная скорость по ломаной (на 30% быстрее)

    // Параметры падения
    this.vy = 0;
    this.gravity = 2000; // px/s^2

    // Параметры улёта вверх
    this.escapeSpeed = 400; // px/s

    this.graphics.visible = false;
    (app.gameLayer || app.stage).addChild(this.graphics);

    if (typeof spine !== 'undefined') {
      const duckSpine = spine.Spine.from({ skeleton: 'duckSkeleton', atlas: 'duckAtlas' });
      if (duckSpine) {
        if (!duckSpine.skeleton.physics) {
          duckSpine.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
        }
        duckSpine.skeleton.setSkinByName(skinName);
        duckSpine.skeleton.setSlotsToSetupPose();
        duckSpine.state.setAnimation(0, 'fly', true);
        duckSpine.scale.set(0.7);
        duckSpine.x = startX;
        duckSpine.y = startY;
        duckSpine.zIndex = 25;
        (app.gameLayer || app.stage).addChild(duckSpine);
        this.spine = duckSpine;
      }
    }

    this._generateInitialPath();
  }

  _syncSpinePosition() {
    if (this.spine) {
      this.spine.x = this.graphics.x;
      this.spine.y = this.graphics.y;
    }
  }

  _randomPointInField() {
    // Ширина = весь экран, верх = 0, низ = DUCK_FLIGHT_BOTTOM_Y
    const x = Math.random() * GAME_SIZE;

    const baseY = this.graphics.y;
    const maxDeltaUp = GAME_SIZE * 0.25;   // шаг вверх — до 25% экрана
    const maxDeltaDown = GAME_SIZE * 0.12; // шаг вниз — меньше, чтобы приподнять среднюю траекторию

    const maxUp = Math.min(maxDeltaUp, baseY);
    const maxDownToBottom = Math.max(0, DUCK_FLIGHT_BOTTOM_Y - baseY);
    const maxDown = Math.min(maxDeltaDown, maxDownToBottom);

    let deltaY = 0;
    const biasUp = 0.82; // 82% вверх, 18% вниз
    if (Math.random() < biasUp && maxUp > 0) {
      // вверх: смещение к большему шагу (50–100% от maxUp)
      deltaY = -maxUp * (0.5 + 0.5 * Math.random());
    } else if (maxDown > 0) {
      // вниз: умеренный шаг
      deltaY = Math.random() * maxDown;
    }

    let y = baseY + deltaY;
    y = Math.min(DUCK_FLIGHT_BOTTOM_Y, Math.max(0, y));

    return { x, y };
  }

  _generateInitialPath() {
    this.pathPoints.length = 0;
    const start = { x: this.graphics.x, y: this.graphics.y };
    this.pathPoints.push(start);

    // Первое движение — обязательно вверх минимум на 100px
    const firstX = Math.random() * GAME_SIZE;

    const minUp = 100;
    const maxUp = Math.max(0, start.y); // вверх до 0
    let upAmount = minUp;
    if (maxUp > minUp) {
      upAmount = minUp + Math.random() * (maxUp - minUp);
    } else if (maxUp > 0) {
      upAmount = maxUp;
    } else {
      upAmount = 0;
    }

    const firstY = Math.max(0, start.y - upAmount);
    this.pathPoints.push({ x: firstX, y: firstY });

    const segments = 4;
    for (let i = 1; i < segments; i++) {
      const p = this._randomPointInField();
      this.pathPoints.push(p);
    }

    this.currentPathIndex = 0;
  }

  _extendPathFromCurrent() {
    const lastPoint = this.pathPoints[this.pathPoints.length - 1];
    const next = this._randomPointInField();
    this.pathPoints.push(next);
    // currentPathIndex не трогаем: утка продолжает движение с текущей позиции к следующей точке
  }

  update(dtMs) {
    const dtSec = dtMs / 1000;

    if (this.state === 'flying') {
      this._updateFlying(dtMs);
    } else if (this.state === 'escaping') {
      this.graphics.y -= this.escapeSpeed * dtSec;
      if (this.graphics.y + DUCK_SIZE < 0) {
        this.destroy();
      }
    } else if (this.state === 'falling') {
      this.vy += this.gravity * dtSec;
      this.graphics.y += this.vy * dtSec;
      if (this.graphics.y - DUCK_SIZE / 2 > GAME_SIZE) {
        this.destroy();
      }
    }

    this._syncSpinePosition();
  }

  _updateFlying(dtMs) {
    if (this.pathPoints.length < 2) {
      this._generateInitialPath();
    }

    const dtSec = dtMs / 1000;
    let remaining = this.flySpeed * dtSec;

    while (remaining > 0) {
      // Гарантируем, что есть следующий узел пути
      if (this.currentPathIndex >= this.pathPoints.length - 1) {
        this._extendPathFromCurrent();
      }

      const target = this.pathPoints[this.currentPathIndex + 1];
      const dx = target.x - this.graphics.x;
      const dy = target.y - this.graphics.y;
      const distToNext = Math.sqrt(dx * dx + dy * dy);

      // Обновляем зеркалирование по горизонтали: влево — как сейчас, вправо — зеркалим
      if (this.spine && Math.abs(dx) > 0.5) {
        this.facingRight = dx > 0;
        const baseScale = 0.7;
        this.spine.scale.x = this.facingRight ? -baseScale : baseScale;
      }

      if (distToNext < 0.001) {
        // Достигли точки — переходим к следующему сегменту
        this.graphics.x = target.x;
        this.graphics.y = Math.min(this.spawnY, target.y);
        this.currentPathIndex++;
        continue;
      }

      if (remaining < distToNext) {
        // Шага хватает только на часть сегмента
        const ratio = remaining / distToNext;
        this.graphics.x += dx * ratio;
        this.graphics.y = Math.min(this.spawnY, this.graphics.y + dy * ratio);
        remaining = 0;
      } else {
        // Проходим весь сегмент и идём дальше без остановки
        this.graphics.x = target.x;
        this.graphics.y = Math.min(this.spawnY, target.y);
        remaining -= distToNext;
        this.currentPathIndex++;
      }
    }
  }

  startEscape() {
    if (this.state === 'flying') {
      this.state = 'escaping';
    }
  }

  startFalling() {
    if (this.state === 'dead') return;
    this.state = 'falling';
    this.vy = 0;
    if (this.spine) {
      this.spine.state.setAnimation(0, 'hit', false);
    }
  }

  isAlive() {
    return this.state === 'flying' || this.state === 'escaping' || this.state === 'falling';
  }

  getBounds() {
    return {
      x: this.graphics.x - DUCK_SIZE / 2,
      y: this.graphics.y - DUCK_SIZE / 2,
      width: DUCK_SIZE,
      height: DUCK_SIZE
    };
  }

  destroy() {
    if (this.state === 'dead') return;
    const wasEscaping = this.state === 'escaping';
    this.state = 'dead';
    if (this.graphics.parent) {
      this.graphics.parent.removeChild(this.graphics);
    }
    this.graphics.destroy();
    if (this.spine) {
      if (this.spine.parent) {
        this.spine.parent.removeChild(this.spine);
      }
      this.spine.destroy();
      this.spine = null;
    }
    if (wasEscaping && this.heartIndex != null && this.app.setHeartState) {
      this.app.setHeartState(this.heartIndex, 'idle');
    }
  }
}

class Bullet {
  constructor(app, startX, startY, targetX, targetY, onDestroy) {
    this.app = app;
    const texture = app.roseTexture || PIXI.Texture.WHITE;
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(0.5);

    this.sprite.x = startX;
    this.sprite.y = startY;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
    this.sprite.rotation = Math.atan2(this.dirY, this.dirX);
    this.speed = 1400; // px/s

    this.onDestroy = onDestroy;
    this.active = true;

    (app.bulletLayer || app.gameLayer || app.stage).addChild(this.sprite);
  }

  update(dtMs) {
    if (!this.active) return;
    const dtSec = dtMs / 1000;
    const step = this.speed * dtSec;
    this.sprite.x += this.dirX * step;
    this.sprite.y += this.dirY * step;

    // Уничтожаем пулю при вылете за экран — значит пролетела мимо всех уток
    const margin = BULLET_SIZE * 2;
    if (
      this.sprite.x < -margin ||
      this.sprite.x > GAME_SIZE + margin ||
      this.sprite.y < -margin ||
      this.sprite.y > GAME_SIZE + margin
    ) {
      this.destroy();
    }
  }

  getBounds() {
    // Коллизии по изначальным размерам (BULLET_SIZE), не по отображаемому спрайту
    return {
      x: this.sprite.x - BULLET_SIZE / 2,
      y: this.sprite.y - BULLET_SIZE / 2,
      width: BULLET_SIZE,
      height: BULLET_SIZE
    };
  }

  destroy() {
    if (!this.active) return;
    this.active = false;
    if (this.onDestroy) {
      this.onDestroy(this);
    }
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
    this.sprite.destroy();
  }
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

(async () => {
  const container = document.getElementById('game-container');
  const waveInfoEl = document.getElementById('wave-info');

  const app = new PIXI.Application();
  await app.init({
    width: GAME_SIZE,
    height: GAME_SIZE,
    backgroundColor: 0x102030,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  container.appendChild(app.canvas);

  const [bgTexture, grassTexture, roseTexture, tarrTexture, barrTexture, heartRedTexture] = await Promise.all([
    PIXI.Assets.load('./png/bg.png'),
    PIXI.Assets.load('./png/grass.png'),
    PIXI.Assets.load('./png/rose.png'),
    PIXI.Assets.load('./png/tarr.png'),
    PIXI.Assets.load('./png/barr.png'),
    PIXI.Assets.load('./png/heart_red.png')
  ]);

  await PIXI.Assets.load([
    { alias: 'dogSkeleton', src: './spine/dog/dog.json' },
    { alias: 'dogAtlas', src: './spine/dog/dog.atlas' },
    { alias: 'duckSkeleton', src: './spine/girl/duck.json' },
    { alias: 'duckAtlas', src: './spine/girl/duck.atlas' },
    { alias: 'heartSkeleton', src: './spine/heart/skeleton.json' },
    { alias: 'heartAtlas', src: './spine/heart/skeleton.atlas' },
    { alias: 'roseSkeleton', src: './spine/rose/rose.json' },
    { alias: 'roseAtlas', src: './spine/rose/rose.atlas' }
  ]);

  const bgSprite = new PIXI.Sprite(bgTexture);
  bgSprite.width = GAME_SIZE;
  bgSprite.height = GAME_SIZE;
  bgSprite.zIndex = 0;
  app.stage.addChild(bgSprite);

  const dogBgLayer = new PIXI.Container();
  dogBgLayer.zIndex = 10;
  dogBgLayer.sortableChildren = true;

  const gameLayer = new PIXI.Container();
  gameLayer.zIndex = 20;
  app.stage.addChild(dogBgLayer);
  app.stage.addChild(gameLayer);
  app.gameLayer = gameLayer;

  // Контейнер красных сердечек в конце игры — заполняет всё поле
  const heartEndContainer = new PIXI.Container();
  heartEndContainer.zIndex = 35;
  heartEndContainer.visible = false;
  app.stage.addChild(heartEndContainer);
  app.heartEndContainer = heartEndContainer;
  app.heartRedTexture = heartRedTexture;

  // Рамка области полёта (видна при debugFlightFrame.visible = true)
  const debugFlightFrame = new PIXI.Graphics();
  debugFlightFrame.rect(0, 0, GAME_SIZE, DUCK_FLIGHT_BOTTOM_Y);
  debugFlightFrame.stroke({ color: 0xff00ff, width: 2, alpha: 0.8 });
  debugFlightFrame.visible = false; // скрыта
  gameLayer.addChildAt(debugFlightFrame, 0);

  const grassSprite = new PIXI.Sprite(grassTexture);
  grassSprite.width = GAME_SIZE;
  grassSprite.height = GAME_SIZE;
  grassSprite.zIndex = 30;
  app.stage.addChild(grassSprite);

  const barrSprite = new PIXI.Sprite(barrTexture);
  barrSprite.zIndex = 35;
  app.stage.addChild(barrSprite);

  const bulletLayer = new PIXI.Container();
  bulletLayer.zIndex = 40;
  app.stage.addChild(bulletLayer);
  app.bulletLayer = bulletLayer;
  app.roseTexture = roseTexture;

  // Индикаторы сердец (16 штук в ряд) — соответствуют уткам: idle / loop (летит) / red (сбита)
  const NUM_HEARTS = 16;
  const HEART_WIDTH = 39;
  const HEART_HEIGHT = 33;
  const HEART_SPACING = 37;
  const HEART_SCALE = 0.75;
  const heartContainer = new PIXI.Container();
  heartContainer.zIndex = 36;
  const heartSpines = [];
  if (typeof spine !== 'undefined') {
    const totalRowWidth = (NUM_HEARTS - 1) * HEART_SPACING * HEART_SCALE + HEART_WIDTH * HEART_SCALE;
    const startX = (GAME_SIZE - totalRowWidth) / 2 + (HEART_WIDTH * HEART_SCALE) / 2;
    const heartY = 870;
    for (let i = 0; i < NUM_HEARTS; i++) {
      const heartSpine = spine.Spine.from({ skeleton: 'heartSkeleton', atlas: 'heartAtlas' });
      if (heartSpine) {
        heartSpine.skeleton.setSlotsToSetupPose();
        heartSpine.state.setAnimation(0, 'idle', true);
        heartSpine.scale.set(HEART_SCALE);
        heartSpine.x = startX + i * HEART_SPACING * HEART_SCALE;
        heartSpine.y = heartY;
        heartContainer.addChild(heartSpine);
        heartSpines.push(heartSpine);
      }
    }
  }
  app.stage.addChild(heartContainer);
  app.heartSpines = heartSpines;

  function setHeartState(index, state) {
    if (!heartSpines[index]) return;
    if (state === 'idle') {
      heartSpines[index].state.setAnimation(0, 'idle', true);
    } else if (state === 'loop') {
      heartSpines[index].state.setAnimation(0, 'loop', true);
    } else if (state === 'red') {
      heartSpines[index].state.setAnimation(0, 'red', false);
    }
  }
  app.setHeartState = setHeartState;

  // Счётчик патронов на волну — Spine-роза (анимации "3", "2", "1", "0")
  const ROSE_AMMO_X = 140;
  const ROSE_AMMO_Y = 890;
  const ROSE_AMMO_SCALE = 1;
  let roseSpine = null;
  if (typeof spine !== 'undefined') {
    roseSpine = spine.Spine.from({ skeleton: 'roseSkeleton', atlas: 'roseAtlas' });
    if (roseSpine) {
      roseSpine.skeleton.setSlotsToSetupPose();
      roseSpine.state.setAnimation(0, '3', true);
      roseSpine.scale.set(ROSE_AMMO_SCALE);
      roseSpine.x = ROSE_AMMO_X;
      roseSpine.y = ROSE_AMMO_Y;
      roseSpine.zIndex = 36;
      app.stage.addChild(roseSpine);
    }
  }
  app.roseSpine = roseSpine;
  function setRoseAmmo(ammo) {
    if (!roseSpine) return;
    const anim = String(Math.max(0, Math.min(3, ammo)));
    roseSpine.state.setAnimation(0, anim, true);
  }
  app.setRoseAmmo = setRoseAmmo;

  const crosshairSprite = new PIXI.Sprite(tarrTexture);
  crosshairSprite.anchor.set(0.5);
  crosshairSprite.scale.set(0.25);
  crosshairSprite.x = GAME_SIZE / 2;
  crosshairSprite.y = GAME_SIZE / 2;
  crosshairSprite.zIndex = 1000;
  app.stage.addChild(crosshairSprite);

  const dogLayer = new PIXI.Container();
  dogLayer.zIndex = 500;
  dogLayer.sortableChildren = true;
  app.stage.addChild(dogLayer);
  app.stage.sortableChildren = true;

  app.stage.eventMode = 'static';
  app.stage.hitArea = new PIXI.Rectangle(0, 0, GAME_SIZE, GAME_SIZE);

  if (app.canvas && app.canvas.style) {
    app.canvas.style.cursor = 'none';
  }

  app.stage.on('pointermove', (event) => {
    const global = event.global;
    crosshairSprite.x = global.x;
    crosshairSprite.y = global.y;
  });

  const defaultPositions = {
    dogStart: { x: 512, y: 400, scale: 1, zIndex: 500 },
    dogWin: { x: 512, y: 450, scale: 1, zIndex: 1 },
    dogLose: { x: 512, y: 500, scale: 1, zIndex: 2 }
  };

  function createDogSpineContainer(animName, def) {
    const container = new PIXI.Container();
    container.x = def.x;
    container.y = def.y;
    container.scale.set(def.scale);
    container.zIndex = def.zIndex;

    if (typeof spine !== 'undefined') {
      const spineInstance = spine.Spine.from({ skeleton: 'dogSkeleton', atlas: 'dogAtlas' });
      if (spineInstance) {
        if (!spineInstance.skeleton.physics) {
          spineInstance.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
        }
        spineInstance.skeleton.setSlotsToSetupPose();
        spineInstance.x = 0;
        spineInstance.y = 0;
        spineInstance.state.setAnimation(0, animName, true);
        container.addChild(spineInstance);
      }
    }
    return container;
  }

  const animToKey = { start: 'dogStart', win: 'dogWin', loss: 'dogLose' };
  const dogStartContainer = createDogSpineContainer('start', defaultPositions.dogStart);
  const dogWinContainer = createDogSpineContainer('win', defaultPositions.dogWin);
  const dogLoseContainer = createDogSpineContainer('loss', defaultPositions.dogLose);

  dogLayer.addChild(dogStartContainer);
  dogBgLayer.addChild(dogWinContainer);
  dogBgLayer.addChild(dogLoseContainer);

  const debugMenu = createDogPositionMenu(app, { width: GAME_SIZE, height: GAME_SIZE });
  await debugMenu.addElement('dogStart', 'Dog Start', dogStartContainer, defaultPositions.dogStart);
  await debugMenu.addElement('dogWin', 'Dog Win', dogWinContainer, defaultPositions.dogWin);
  await debugMenu.addElement('dogLose', 'Dog Lose', dogLoseContainer, defaultPositions.dogLose);
  await debugMenu.addElement('barr', 'Bar', barrSprite, { x: 77, y: 888, scale: 1, zIndex: 109 }, { skipVisibilityToggle: true });
  await debugMenu.reloadAllSettings();

  function getDogPosition(animName) {
    const key = animToKey[animName];
    const container = key === 'dogStart' ? dogStartContainer : key === 'dogWin' ? dogWinContainer : dogLoseContainer;
    return {
      x: container?.x ?? GAME_SIZE / 2,
      y: container?.y ?? GAME_SIZE / 2,
      scale: container?.scale?.x ?? 1
    };
  }

  /** Время в мс, когда собака уходит за траву в анимации start (событие sprite_down) */
  const START_SPRITE_DOWN_MS = 4750;

  function createDogSpineInstance() {
    const instance = spine.Spine.from({ skeleton: 'dogSkeleton', atlas: 'dogAtlas' });
    if (!instance) return null;
    if (!instance.skeleton.physics) {
      instance.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
    }
    instance.skeleton.setSlotsToSetupPose();
    return instance;
  }

  function destroyDogSpineInstance(instance) {
    if (!instance) return;
    requestAnimationFrame(() => {
      if (instance?.parent) instance.parent.removeChild(instance);
      if (instance?.state) instance.state.clearTracks();
      if (!instance.destroyed) instance.destroy({ children: true });
    });
  }

  function playDogAnimation(animName) {
    if (animName === 'win') {
      playSound('dogWin');
    } else if (animName === 'loss') {
      playSound('dogLaugh');
    }
    if (typeof spine === 'undefined') return;
    const pos = getDogPosition(animName);

    if (animName === 'start') {
      // Два экземпляра: спереди травы (0–4.75с), сзади (4.75с–конец)
      const spineFront = createDogSpineInstance();
      if (!spineFront) return;
      spineFront.x = pos.x;
      spineFront.y = pos.y;
      spineFront.scale.set(pos.scale);
      spineFront.zIndex = 99999;
      dogLayer.addChild(spineFront);
      dogLayer.sortChildren();
      spineFront.state.setAnimation(0, 'start', false);

      let switched = false;
      const timerId = setTimeout(() => {
        if (switched) return;
        switched = true;
        spineFront.visible = false;

        const spineBack = createDogSpineInstance();
        if (!spineBack) {
          destroyDogSpineInstance(spineFront);
          return;
        }
        spineBack.x = pos.x;
        spineBack.y = pos.y;
        spineBack.scale.set(pos.scale);
        spineBack.zIndex = 99999;
        dogBgLayer.addChild(spineBack);
        dogBgLayer.sortChildren();
        app.stage.sortChildren();

        const entry = spineBack.state.setAnimation(0, 'start', false);
        if (entry) {
          entry.trackTime = START_SPRITE_DOWN_MS / 1000;
          entry.listener = {
            complete: () => {
              destroyDogSpineInstance(spineFront);
              destroyDogSpineInstance(spineBack);
            }
          };
        }
      }, START_SPRITE_DOWN_MS);

      const frontEntry = spineFront.state.getCurrent(0);
      if (frontEntry) {
        frontEntry.listener = {
          complete: () => {
            clearTimeout(timerId);
            if (!switched) {
              switched = true;
              destroyDogSpineInstance(spineFront);
            }
          }
        };
      }
      return;
    }

    // win, loss — один экземпляр
    const spineInstance = createDogSpineInstance();
    if (!spineInstance) return;
    spineInstance.x = pos.x;
    spineInstance.y = pos.y;
    spineInstance.scale.set(pos.scale);
    spineInstance.zIndex = 99999;
    const targetLayer = animName === 'win' || animName === 'loss' ? dogBgLayer : dogLayer;
    targetLayer.addChild(spineInstance);
    targetLayer.sortChildren();

    if (animName === 'win' || animName === 'loss') {
      const useAltSkins = state.ducksHit >= 8;
      if (animName === 'win') spineInstance.skeleton.setSkinByName(useAltSkins ? 'tim' : 'orig');
      else spineInstance.skeleton.setSkinByName(useAltSkins ? 'pavel' : 'orig');
    }
    spineInstance.skeleton.setSlotsToSetupPose();

    const entry = spineInstance.state.setAnimation(0, animName, false);
    if (!entry) return;

    entry.listener = {
      complete: () => destroyDogSpineInstance(spineInstance)
    };
  }

  const state = {
    ducks: [],
    bullet: null,
    ammo: AMMO_PER_WAVE,
    shootCooldownMs: 0,
    currentWave: 0,
    ducksHit: 0,
    nextHeartIndex: 0,
    timeSinceWaveStartMs: 0,
    waveRunning: false,
    escapeTriggered: false,
    timeUntilNextWaveMs: INITIAL_WAVE_DELAY_MS,
    escapeDelayNoAmmoMs: 0,
    gameEnded: false,
    lastTimestampMs: performance.now()
  };

  let mainSequenceStarted = false;

  function beginMainSequence() {
    if (mainSequenceStarted) return;
    mainSequenceStarted = true;
    playSound('intro');

    setTimeout(() => {
      const screen = document.getElementById('start-screen');
      if (screen) {
        screen.style.display = 'none';
      }

      gameplayEnabled = true;
      playDogAnimation('start');

      state.ducks.forEach(d => d.destroy());
      state.ducks = [];
      state.bullet?.destroy();
      state.bullet = null;

      state.timeSinceWaveStartMs = 0;
      state.escapeTriggered = false;
      state.waveRunning = false;
      state.timeUntilNextWaveMs = INITIAL_WAVE_DELAY_MS;
      state.ammo = AMMO_PER_WAVE;
      if (app.setRoseAmmo) app.setRoseAmmo(state.ammo);
      state.shootCooldownMs = 0;
      state.escapeDelayNoAmmoMs = 0;
      state.currentWave = 0;
      state.ducksHit = 0;
      state.gameEnded = false;
      state.nextHeartIndex = 0;
      const duckSkinNames = Array.from({ length: 16 }, (_, i) => String(i + 1));
      for (let i = duckSkinNames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [duckSkinNames[i], duckSkinNames[j]] = [duckSkinNames[j], duckSkinNames[i]];
      }
      state.shuffledDuckSkins = duckSkinNames;
      if (app.setHeartState) {
        for (let i = 0; i < NUM_HEARTS; i++) app.setHeartState(i, 'idle');
      }
      if (app.heartEndContainer) {
        app.heartEndContainer.removeChildren();
        app.heartEndContainer.visible = false;
      }
      if (app.heartPulseTicker) {
        app.ticker.remove(app.heartPulseTicker);
        app.heartPulseTicker = null;
      }
    }, 2000);
  }

  window.startDuckHuntGame = () => {
    beginMainSequence();
  };

  function startWave() {
    if (state.gameEnded) {
      return;
    }
    if (state.currentWave >= TOTAL_WAVES) {
      endGame();
      return;
    }

    state.currentWave++;

    state.ducks.forEach(d => d.destroy());
    state.ducks = [];
    state.bullet?.destroy();
    state.bullet = null;

    for (let i = 0; i < NUM_DUCKS_PER_WAVE; i++) {
      const heartIndex = state.nextHeartIndex;
      state.nextHeartIndex = Math.min(state.nextHeartIndex + 1, NUM_HEARTS);
      const skinName = state.shuffledDuckSkins[heartIndex];
      const startX = Math.random() * GAME_SIZE;
      const startY = DUCK_FLIGHT_BOTTOM_Y; // появляются от нижней границы области полёта
      const duck = new Duck(app, startX, startY, heartIndex, skinName);
      state.ducks.push(duck);
      app.setHeartState(heartIndex, 'loop');
    }

    state.timeSinceWaveStartMs = 0;
    state.escapeTriggered = false;
    state.waveRunning = true;
    state.timeUntilNextWaveMs = 0;
    state.ammo = AMMO_PER_WAVE;
    if (app.setRoseAmmo) app.setRoseAmmo(state.ammo);
    state.shootCooldownMs = 0;
    state.escapeDelayNoAmmoMs = 0;

    const flyAudio = audioMap.fly;
    if (flyAudio) {
      try { flyAudio.currentTime = 0; } catch (_) {}
      flyAudio.play().catch(() => {});
    }
  }

  function updateWave(dtMs) {
    if (!gameplayEnabled) {
      return;
    }

    if (state.gameEnded) {
      return;
    }

    if (!state.waveRunning) {
      if (state.timeUntilNextWaveMs > 0) {
        state.timeUntilNextWaveMs -= dtMs;
        if (state.timeUntilNextWaveMs <= 0) {
          startWave();
        }
      }
      return;
    }

    state.timeSinceWaveStartMs += dtMs;

    if (state.escapeDelayNoAmmoMs > 0) {
      state.escapeDelayNoAmmoMs -= dtMs;
      if (state.escapeDelayNoAmmoMs <= 0) {
        state.escapeDelayNoAmmoMs = 0;
        triggerEscapeNoAmmo();
      }
    }

    if (!state.escapeTriggered && state.timeSinceWaveStartMs >= WAVE_DURATION_MS) {
      state.escapeTriggered = true;
      state.ducks.forEach(d => d.startEscape());
      // Волна завершена естественным образом (утки улетают вверх)
      state.waveRunning = false;
      state.timeUntilNextWaveMs = NEXT_WAVE_AFTER_KILL_MS;
    }
  }

  function updateBullet(dtMs) {
    if (state.bullet && state.bullet.active) {
      state.bullet.update(dtMs);
      if (!state.bullet.active) {
        state.bullet = null;
      }
    }
  }

  function updateDucks(dtMs) {
    state.ducks = state.ducks.filter(d => d.isAlive());
    state.ducks.forEach(d => d.update(dtMs));

    for (const duck of state.ducks) {
      if (duck.state === 'falling' && !duck.winTriggered) {
        const duckBottom = duck.graphics.y + DUCK_SIZE / 2;
        if (duckBottom >= DUCK_FLIGHT_BOTTOM_Y) {
          duck.winTriggered = true;
          stopSound('duckFall');
          playSound('duckLand');
          playDogAnimation('win');
        }
      }
    }

    // Если волна активна и все утки уже "мертвые" (сбиты и упали/улетели),
    // запускаем таймер до следующей волны на 3 секунды.
    if (state.waveRunning && state.ducks.length === 0) {
      state.waveRunning = false;
      state.escapeTriggered = false;
      state.timeUntilNextWaveMs = NEXT_WAVE_AFTER_KILL_MS;
    }
  }

  function updateCollisions() {
    if (!state.bullet || !state.bullet.active) return;

    const bulletBounds = state.bullet.getBounds();
    for (const duck of state.ducks) {
      if (!duck.isAlive() || duck.state === 'falling') continue;
      const duckBounds = duck.getBounds();
      if (rectsOverlap(bulletBounds, duckBounds)) {
        duck.startFalling();
        if (duck.heartIndex != null && app.setHeartState) app.setHeartState(duck.heartIndex, 'red');
        state.ducksHit++;
        playSound('duckFall');
        state.bullet.onDestroy = null;
        state.bullet.destroy();
        state.bullet = null;
        break;
      }
    }
  }

  function triggerEscapeNoAmmo() {
    if (!state.escapeTriggered && state.waveRunning) {
      state.escapeTriggered = true;
      state.ducks.forEach(d => d.startEscape());
      state.waveRunning = false;
      state.timeUntilNextWaveMs = NEXT_WAVE_AFTER_KILL_MS;
    }
  }

  function easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }

  function fillFieldWithRedHearts() {
    const container = app.heartEndContainer;
    const texture = app.heartRedTexture;
    if (!container || !texture) return;
    container.removeChildren();
    const w = texture.width || 48;
    const hTex = texture.height || 48;
    const spacingX = Math.max(20, w * 0.85);
    const spacingY = Math.max(20, hTex * 0.85);
    const cols = Math.ceil((GAME_SIZE + w) / spacingX) + 1;
    const rows = Math.ceil((GAME_SIZE + hTex) / spacingY) + 1;
    const positions = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions.push({ x: col * spacingX, y: row * spacingY, diag: row + col });
      }
    }
    positions.sort((a, b) => a.diag - b.diag || a.y - b.y);
    const durationMs = 1000;
    const bounceDurationMs = 280;
    const startTime = performance.now();
    positions.forEach((pos, i) => {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = pos.x;
      sprite.y = pos.y;
      sprite.scale.set(0);
      sprite.revealAt = (i / positions.length) * durationMs;
      container.addChild(sprite);
    });
    container.visible = true;

    const tickReveal = () => {
      const elapsed = performance.now() - startTime;
      let allDone = true;
      for (let i = 0; i < container.children.length; i++) {
        const child = container.children[i];
        if (child.revealAt !== undefined) {
          if (elapsed >= child.revealAt) {
            const localT = (elapsed - child.revealAt) / bounceDurationMs;
            const t = Math.min(1, localT);
            const s = easeOutBounce(t);
            child.scale.set(s);
            if (t < 1) allDone = false;
          } else {
            allDone = false;
          }
        }
      }
      if (allDone) {
        app.ticker.remove(tickReveal);
        container.children.forEach(c => {
          delete c.revealAt;
          c.pulsePhase = Math.random() * Math.PI * 2;
          c.pulseFreq = 0.4 + Math.random() * 0.8;
          c.baseScale = 1;
        });
        const pulseStartMs = performance.now();
        const tickPulse = () => {
          if (container.children.length === 0) {
            app.ticker.remove(tickPulse);
            if (app.heartPulseTicker === tickPulse) app.heartPulseTicker = null;
            return;
          }
          const tSec = (performance.now() - pulseStartMs) / 1000;
          for (let i = 0; i < container.children.length; i++) {
            const c = container.children[i];
            if (c.pulsePhase == null) continue;
            const s = c.baseScale * (1 + 0.12 * Math.sin(tSec * 2 * Math.PI * c.pulseFreq + c.pulsePhase));
            c.scale.set(s);
          }
        };
        app.heartPulseTicker = tickPulse;
        app.ticker.add(tickPulse);
      }
    };
    app.ticker.add(tickReveal);
  }

  function endGame() {
    if (state.gameEnded) return;
    state.gameEnded = true;

    stopSound('fly');

    state.ducks.forEach(d => d.destroy());
    state.ducks = [];
    if (state.bullet) {
      state.bullet.destroy();
      state.bullet = null;
    }

    fillFieldWithRedHearts();

    const resultScreen = document.getElementById('result-screen');
    const titleEl = document.getElementById('result-title');
    const subtitleEl = document.getElementById('result-subtitle');

    if (!resultScreen || !titleEl || !subtitleEl) {
      return;
    }

    const totalDucks = TOTAL_WAVES * NUM_DUCKS_PER_WAVE;
    const hits = state.ducksHit;

    if (hits < 8) {
      titleEl.textContent = 'GAME OVER';
      playSound('gameOver');
    } else if (hits < totalDucks) {
      titleEl.textContent = 'Поздравляем!';
      playSound('roundClear');
    } else {
      titleEl.textContent = 'Перфект!';
      const perfectAudio = audioMap.perfect;
      const roundClearAudio = audioMap.roundClear;
      if (perfectAudio && roundClearAudio) {
        try {
          perfectAudio.currentTime = 0;
        } catch {
          // ignore
        }
        const handler = () => {
          perfectAudio.removeEventListener('ended', handler);
          try {
            roundClearAudio.currentTime = 0;
          } catch {
            // ignore
          }
          roundClearAudio.play().catch(() => {});
        };
        perfectAudio.addEventListener('ended', handler);
        perfectAudio.play().catch(() => {});
      } else {
        playSound('roundClear');
      }
    }

    subtitleEl.textContent = `Женщин осчастливленно: ${hits} из ${totalDucks}`;
    resultScreen.style.display = 'flex';
  }

  function updateWaveInfo() {
    const ammoText = `Патроны: ${state.ammo}`;
    const progressText =
      state.currentWave > 0
        ? ` · Волна ${Math.min(state.currentWave, TOTAL_WAVES)} из ${TOTAL_WAVES} · Сбито: ${state.ducksHit}`
        : ` · Сбито: ${state.ducksHit}`;
    if (!state.waveRunning) {
      const remainMs = Math.max(0, state.timeUntilNextWaveMs || 0);
      if (remainMs <= 0) {
        waveInfoEl.textContent = `Волна вот-вот начнётся · ${ammoText}${progressText}`;
      } else {
        const remainSec = (remainMs / 1000).toFixed(1);
        waveInfoEl.textContent = `Новая волна через ${remainSec} c · ${ammoText}${progressText}`;
      }
    } else if (!state.escapeTriggered) {
      const remainMs = Math.max(
        0,
        WAVE_DURATION_MS - state.timeSinceWaveStartMs
      );
      const remainSec = (remainMs / 1000).toFixed(1);
      waveInfoEl.textContent = `Волна: ${remainSec} c · ${ammoText}${progressText}`;
    } else {
      const remainMs = Math.max(0, state.timeUntilNextWaveMs || 0);
      const remainSec = (remainMs / 1000).toFixed(1);
      waveInfoEl.textContent = `Утки улетают · через ${remainSec} c новая волна · ${ammoText}${progressText}`;
    }
  }

  app.stage.on('pointerdown', (event) => {
    const global = event.global;
    const targetX = global.x;
    const targetY = global.y;

    if (state.gameEnded) return;
    if (state.bullet && state.bullet.active) return;
    if (state.ammo <= 0 || !state.waveRunning) return;
    if (state.shootCooldownMs > 0) return;

    playSound('shoot');

    state.ammo--;
    if (app.setRoseAmmo) app.setRoseAmmo(state.ammo);
    state.shootCooldownMs = SHOOT_COOLDOWN_MS;
    const startX = GAME_SIZE / 2;
    const startY = GAME_SIZE;
    state.bullet = new Bullet(app, startX, startY, targetX, targetY, (bullet) => {
      const flyingDucks = state.ducks.filter(
        d => (d.state === 'flying' || d.state === 'escaping') && d.isAlive()
      );
      if (flyingDucks.length > 0) {
        const topDuckY = Math.min(...flyingDucks.map(d => d.graphics.y));
        if (bullet.sprite.y < topDuckY) {
          playDogAnimation('loss');
        }
      }
    });

    if (state.ammo <= 0) {
      state.escapeDelayNoAmmoMs = ESCAPE_DELAY_NO_AMMO_MS;
    }
  });

  app.ticker.add(() => {
    const now = performance.now();
    const dtMs = now - state.lastTimestampMs;
    state.lastTimestampMs = now;

    const hasFlyingDucks = gameplayEnabled && state.waveRunning && !state.escapeTriggered &&
      state.ducks.some(d => d.state === 'flying');
    const flyAudio = audioMap.fly;
    if (flyAudio) {
      if (hasFlyingDucks) {
        if (flyAudio.paused) flyAudio.play().catch(() => {});
      } else {
        if (!flyAudio.paused) {
          flyAudio.pause();
          try { flyAudio.currentTime = 0; } catch (_) {}
        }
      }
    }

    if (state.shootCooldownMs > 0) {
      state.shootCooldownMs = Math.max(0, state.shootCooldownMs - dtMs);
    }
    updateWave(dtMs);
    updateDucks(dtMs);
    updateBullet(dtMs);
    updateCollisions();
    updateWaveInfo();
  });
})();

