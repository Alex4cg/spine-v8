// Вспомогательные функции
import { CLAW_ANIMATIONS } from './config.js';

export const log = (msg) => console.log(`[pinata] ${msg}`);

export const waitNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Получение namespace для particle emitter
export function getParticleNamespace() {
  const namespace =
    (PIXI.particleEmitter && PIXI.particleEmitter.Emitter
      ? PIXI.particleEmitter
      : null) ??
    (PIXI.particles && PIXI.particles.Emitter ? PIXI.particles : null) ??
    (window.particleEmitter && window.particleEmitter.Emitter
      ? window.particleEmitter
      : null);

  if (!namespace || !namespace.Emitter) {
    throw new Error("particle-emitter plugin не найден");
  }

  return namespace;
}

// Создание заглушки physics для Spine
export function createPhysicsStub() {
  return {
    update: () => {},
    updateGlobal: () => {},
  };
}

// Обеспечение наличия physics у skeleton
export function ensurePhysics(skeleton) {
  if (!skeleton.physics) {
    skeleton.physics = createPhysicsStub();
  }
}

// Получение имени анимации claw по типу и уровню
export function getClawAnimation(type, level) {
  return CLAW_ANIMATIONS[type]?.[level];
}

// Выбор типа анимации при попадании
export function chooseHitAnimation(level) {
  if (level === 3) {
    // На 3-м уровне только boom
    return "boom";
  }
  
  // Вероятности: hit (70%), hitup (20%), boom (10%)
  const rand = Math.random();
  if (rand < 0.7) {
    return "hit";
  } else if (rand < 0.9) {
    return "hitup";
  } else {
    return "boom";
  }
}

