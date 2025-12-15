// Инициализация приложения

import { log, waitNextFrame, getParticleNamespace, ensurePhysics } from './utils.js';
import { CONFIG, SYSTEMS_CONFIG } from './config.js';
import { SpineEffectSystem } from './SpineEffectSystem.js';
import { createClaw, createSidePinata, ClawManager } from './claw.js';
import { setupUI } from './ui.js';

export async function init() {
  // Инициализация PIXI приложения
  const app = new PIXI.Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);
  app.stage.sortableChildren = true;

  // Настройка drag & drop для контрольных точек
  const dragState = { node: null, system: null, lastX: 0, lastY: 0 };
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  const endDrag = () => {
    dragState.node = null;
    dragState.system = null;
  };

  app.stage
    .on("pointerup", endDrag)
    .on("pointerupoutside", endDrag)
    .on("pointermove", ({ x, y }) => {
      if (!dragState.node) return;
      dragState.node.x += x - dragState.lastX;
      dragState.node.y += y - dragState.lastY;
      dragState.lastX = x;
      dragState.lastY = y;
    });

  // Получение namespace для particle emitter
  const particleNamespace = getParticleNamespace();

  // Загрузка ресурсов
  await PIXI.Assets.load([
    { alias: "pinataSkeleton", src: "./assets/pinatas/skeleton.json" },
    { alias: "pinataAtlas", src: "./assets/pinatas/skeleton.atlas" },
    { alias: "pinataEmitter", src: "./assets/pinatas/emitter.json" },
    { alias: "particleBlue", src: "./assets/pinatas/conf_blue.png" },
    { alias: "particleGreen", src: "./assets/pinatas/conf_green.png" },
    { alias: "particleRed", src: "./assets/pinatas/conf_red.png" },
    { alias: "background", src: "./assets/pinatas/bg.png?v=" + Date.now() },
    { alias: "clawSkeleton", src: "./assets/pinatas/claw.json" },
    { alias: "clawAtlas", src: "./assets/pinatas/claw.atlas" },
  ]);

  const rawEmitterConfig = PIXI.Assets.get("pinataEmitter");
  const particleTextures = {
    blue: PIXI.Assets.get("particleBlue"),
    green: PIXI.Assets.get("particleGreen"),
    red: PIXI.Assets.get("particleRed"),
  };

  // Создание фона
  const bgTexture = PIXI.Assets.get("background");
  const bgSprite = new PIXI.Sprite(bgTexture);
  bgSprite.zIndex = 0;
  
  // Масштабируем фон под размер экрана (cover mode)
  const scaleX = app.screen.width / bgTexture.width;
  const scaleY = app.screen.height / bgTexture.height;
  const scale = Math.max(scaleX, scaleY);
  bgSprite.scale.set(scale);
  
  // Центрируем фон
  bgSprite.x = (app.screen.width - bgTexture.width * scale) / 2;
  bgSprite.y = (app.screen.height - bgTexture.height * scale) / 2;
  
  app.stage.addChild(bgSprite);

  // Создание claw пиньят
  const claw = createClaw(app, app.stage);
  
  const centerX = app.screen.width / 2;
  const clawLeft = createSidePinata(app, app.stage, centerX - CONFIG.sidePinataDistance, "pinatas/red");
  const clawRight = createSidePinata(app, app.stage, centerX + CONFIG.sidePinataDistance, "pinatas/green");
  
  // Сохраняем ссылки для обновления в ticker
  const sidePinatas = [clawLeft, clawRight];

  // Создание систем эффектов
  const systems = [];
  const createSystem = async (config) => {
    const system = new SpineEffectSystem({
      ...config,
      app,
      stage: app.stage,
      controlBoneNames: CONFIG.controlBoneNames,
      emitterBoneName: CONFIG.emitterBoneName,
      animations: CONFIG.animations,
      idleAnimationName: CONFIG.idleAnimationName,
      initialSkin: CONFIG.initialSkin,
      rawEmitterConfig,
      particleNamespace,
      particleTextures,
      dragState,
      waitNextFrame,
      log,
    });
    await system.init();
    systems.push(system);
    return system;
  };

  // Создаём 3 системы, расположенные вертикально
  const startY = app.screen.height - CONFIG.systemStartYOffset;
  
  const systemA = await createSystem({ 
    id: SYSTEMS_CONFIG[0].id, 
    x: app.screen.width / 2, 
    y: startY - CONFIG.systemSpacing * 2,
    controlPointColor: SYSTEMS_CONFIG[0].controlPointColor
  });
  await createSystem({ 
    id: SYSTEMS_CONFIG[1].id, 
    x: app.screen.width / 2, 
    y: startY - CONFIG.systemSpacing,
    controlPointColor: SYSTEMS_CONFIG[1].controlPointColor
  });
  await createSystem({ 
    id: SYSTEMS_CONFIG[2].id, 
    x: app.screen.width / 2, 
    y: startY,
    controlPointColor: SYSTEMS_CONFIG[2].controlPointColor
  });
  
  // Создание менеджера для claw
  const clawManager = new ClawManager(claw, systemA);

  // Настройка UI
  setupUI(systems);

  // Ticker для обновления
  app.ticker.add(() => {
    systems.forEach((system) => system.update());
    
    // Обновляем claw
    clawManager.update();
    
    // Обновляем боковые пиньяты
    sidePinatas.forEach((pinata) => {
      if (pinata && pinata.skeleton && pinata.skeleton.physics) {
        pinata.skeleton.updateWorldTransform(pinata.skeleton.physics.update);
      }
    });
  });

  return { app, systems, clawManager };
}

