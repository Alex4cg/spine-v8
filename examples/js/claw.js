// Логика управления claw пиньятами

import { ensurePhysics, getClawAnimation, chooseHitAnimation, log } from './utils.js';
import { CONFIG } from './config.js';

// Создание основной claw пиньяты
export function createClaw(app, stage) {
  const claw = spine.Spine.from({
    skeleton: "clawSkeleton",
    atlas: "clawAtlas",
    scale: 1,
  });

  ensurePhysics(claw.skeleton);

  // Позиционируем claw
  claw.x = app.screen.width / 2;
  claw.y = app.screen.height / 2 - CONFIG.clawYOffset;
  claw.zIndex = CONFIG.clawZIndex;
  
  // Устанавливаем скин pinatas/blue по умолчанию
  const blueSkin = claw.skeleton.data.findSkin("pinatas/blue");
  if (blueSkin) {
    claw.skeleton.setSkin(blueSkin);
    claw.skeleton.setSlotsToSetupPose();
    if (claw.skeleton.physics && claw.skeleton.physics.update) {
      claw.skeleton.updateWorldTransform(claw.skeleton.physics.update);
    }
  } else {
    log("Skin 'pinatas/blue' not found, available skins: " + 
        claw.skeleton.data.skins.map(s => s.name).join(", "));
  }
  
  // Запускаем idle анимацию в цикле
  claw.state.setAnimation(0, "00_idle_1", true);
  
  stage.addChild(claw);
  return claw;
}

// Создание боковой пиньяты
export function createSidePinata(app, stage, x, skinName) {
  const sidePinata = spine.Spine.from({
    skeleton: "clawSkeleton",
    atlas: "clawAtlas",
    scale: 1,
  });
  
  ensurePhysics(sidePinata.skeleton);
  
  // Позиционируем
  sidePinata.x = x;
  sidePinata.y = app.screen.height / 2 - CONFIG.clawYOffset;
  sidePinata.zIndex = CONFIG.sidePinataZIndex;
  
  // Устанавливаем скин
  const skin = sidePinata.skeleton.data.findSkin(skinName);
  if (skin) {
    sidePinata.skeleton.setSkin(skin);
    sidePinata.skeleton.setSlotsToSetupPose();
    if (sidePinata.skeleton.physics && sidePinata.skeleton.physics.update) {
      sidePinata.skeleton.updateWorldTransform(sidePinata.skeleton.physics.update);
    }
  }
  
  // Запускаем idle анимацию в цикле
  sidePinata.state.setAnimation(0, "00_idle_1", true);
  
  stage.addChild(sidePinata);
  return sidePinata;
}

// Менеджер для управления claw логикой
export class ClawManager {
  constructor(claw, systemA) {
    this.claw = claw;
    this.isIdle = true;
    this.level = 1;
    
    this.setupListeners(systemA);
  }
  
  setupListeners(systemA) {
    // Слушаем события от системы "a" для управления claw
    systemA.spine.state.addListener({
      event: (entry, event) => {
        if (!event?.data?.name) return;
        const eventName = event.data.name;
        
        // Обрабатываем только событие collect_effect_hit
        if (eventName === "collect_effect_hit" && this.isIdle) {
          this.handleHit();
        }
      }
    });
    
    // Слушаем завершение анимаций claw для обработки переходов между уровнями
    this.claw.state.addListener({
      complete: (entry) => {
        if (!entry.animation) return;
        const animName = entry.animation.name;
        log(`Claw: animation complete - ${animName}, isIdle: ${this.isIdle}, track: ${entry.trackIndex}`);
        
        // Обрабатываем только трек 0 и только если не idle
        if (entry.trackIndex !== 0 || this.isIdle) return;
        
        // Игнорируем idle анимации (они играют в цикле)
        if (animName.includes("idle")) return;
        
        this.handleAnimationComplete(animName);
      }
    });
  }
  
  handleHit() {
    this.isIdle = false;
    
    // Останавливаем текущую анимацию (idle) и очищаем трек
    this.claw.state.clearTrack(0);
    
    // Выбираем тип анимации на основе уровня
    const animType = chooseHitAnimation(this.level);
    const animName = getClawAnimation(animType, this.level);
    
    if (animName) {
      // Небольшая задержка для гарантии, что трек очищен
      requestAnimationFrame(() => {
        const entry = this.claw.state.setAnimation(0, animName, false);
        if (entry) {
          entry.mixDuration = CONFIG.animationMixDuration;
          log(`Claw: Level ${this.level}, playing ${animName} (${animType})`);
        } else {
          log(`Claw: Failed to set animation ${animName}`);
          this.isIdle = true;
        }
      });
    } else {
      log(`Claw: Animation not found for ${animType} at level ${this.level}`);
      this.isIdle = true;
    }
  }
  
  handleAnimationComplete(animName) {
    if (!animName) return;
    
    // Определяем тип анимации по имени
    let animType = null;
    if (animName.includes("hit_") && !animName.includes("hitup") && !animName.includes("boom")) {
      animType = "hit";
    } else if (animName.includes("hitup")) {
      animType = "hitup";
    } else if (animName.includes("boom")) {
      animType = "boom";
    }
    
    if (animType === "hit") {
      // После hit остаемся на том же уровне
      this.setIdleAnimation(this.level);
    } else if (animType === "hitup") {
      // После hitup переходим на следующий уровень
      if (this.level < 3) {
        this.level++;
        this.setIdleAnimation(this.level);
        log(`Claw: level up to ${this.level}`);
      } else {
        // Уже на 3-м уровне, возвращаемся к idle
        this.setIdleAnimation(this.level);
      }
    } else if (animType === "boom") {
      // После boom сбрасываемся на первый уровень и в начальное состояние
      this.level = 1;
      log(`Claw: reset to level ${this.level} with pose reset`);
      this.setIdleAnimation(this.level, true); // true = сброс в setup pose
    } else {
      // Неизвестная анимация, возвращаемся к idle текущего уровня
      log(`Claw: unknown animation type: ${animName}, returned to idle`);
      this.setIdleAnimation(this.level);
    }
  }
  
  setIdleAnimation(level, resetPose = false) {
    const idleAnim = getClawAnimation("idle", level);
    if (idleAnim) {
      // Устанавливаем isIdle в false перед установкой анимации
      this.isIdle = false;
      
      // Очищаем все треки
      this.claw.state.clearTracks();
      
      // Если нужно сбросить в начальное состояние (после boom)
      if (resetPose) {
        this.claw.skeleton.setToSetupPose();
        // Используем заглушку physics, если она есть
        if (this.claw.skeleton.physics && this.claw.skeleton.physics.update) {
          this.claw.skeleton.updateWorldTransform(this.claw.skeleton.physics.update);
        } else {
          // Если physics нет, создаем заглушку
          ensurePhysics(this.claw.skeleton);
          this.claw.skeleton.updateWorldTransform(this.claw.skeleton.physics.update);
        }
        log(`Claw: skeleton reset to setup pose`);
      }
      
      requestAnimationFrame(() => {
        const entry = this.claw.state.setAnimation(0, idleAnim, true);
        if (entry) {
          entry.mixDuration = CONFIG.animationMixDuration;
          this.isIdle = true;
          log(`Claw: returned to ${idleAnim} (level ${level})`);
        } else {
          log(`Claw: Failed to set idle animation ${idleAnim}`);
          this.isIdle = true;
        }
      });
    } else {
      log(`Claw: Idle animation not found for level ${level}`);
      this.isIdle = true;
    }
  }
  
  update() {
    if (this.claw && this.claw.skeleton && this.claw.skeleton.physics) {
      this.claw.skeleton.updateWorldTransform(this.claw.skeleton.physics.update);
    }
  }
}

