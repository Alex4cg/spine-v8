/**
 * ChestManager — управление Spine-экземплярами сундуков с системой уровней.
 * Уровни: 0, 1, 2 — обычная игра; 3 — открытый сундук (бонусная игра).
 * Анимации (трек 0): XX_idle, XX_hit, XX_hit_up, XX_jump, XX_boom.
 */
import { SoundManager } from './SoundManager.js';

/** Имена скинов сундука в skeleton.json */
export const CHEST_SKINS = ['red', 'blue', 'yellow'];

// ============================================================================
// Константы
// ============================================================================

/** Максимальный уровень обычной игры (0, 1, 2) */
const MAX_REGULAR_LEVEL = 2;

/** Шанс перехода на следующий уровень при прилёте монетки (hit_up вместо hit) */
const HIT_UP_CHANCE = 0.12;

// ============================================================================
// Состояние уровней
// ============================================================================

/** Текущий уровень каждого сундука */
const chestLevels = {
  red: 0,
  blue: 0,
  yellow: 0
};

/**
 * Получить текущий уровень сундука.
 * @param {string} chestColor - цвет сундука: 'red', 'blue', 'yellow'
 * @returns {number} текущий уровень (0-2 в обычной игре)
 */
export function getChestLevel(chestColor) {
  return chestLevels[chestColor] ?? 0;
}

/**
 * Сбросить уровни всех сундуков в 0.
 */
export function resetChestLevels() {
  for (const color of CHEST_SKINS) {
    chestLevels[color] = 0;
  }
  console.log('[ChestManager] Уровни сундуков сброшены в 0');
}

// ============================================================================
// Вспомогательные функции
// ============================================================================

/**
 * Формирует имя анимации по уровню и типу.
 * @param {number} level - уровень (0, 1, 2, 3)
 * @param {string} type - тип анимации: 'idle', 'hit', 'hit_up', 'jump', 'boom'
 * @returns {string} имя анимации, например '01_hit'
 */
function getAnimationName(level, type) {
  const prefix = String(level).padStart(2, '0');
  return `${prefix}_${type}`;
}

/**
 * Проверяет существование анимации в скелете.
 * @param {spine.Spine} chest - экземпляр сундука
 * @param {string} animName - имя анимации
 * @returns {boolean}
 */
function hasAnimation(chest, animName) {
  const animations = chest?.skeleton?.data?.animations;
  return animations && animations.some(a => a.name === animName);
}

// ============================================================================
// Создание сундуков
// ============================================================================

/**
 * Создаёт один Spine-экземпляр сундука по уже загруженным алиасам и заданному скину.
 * @param {string} skeletonAlias - алиас скелета (PIXI.Assets)
 * @param {string} atlasAlias - алиас атласа (PIXI.Assets)
 * @param {string} [skinName='red'] - имя скина: 'red', 'blue', 'yellow'
 * @returns {spine.Spine|null} экземпляр Spine или null при ошибке
 */
export function createChest(skeletonAlias, atlasAlias, skinName = 'red') {
  if (typeof spine === 'undefined' || !skeletonAlias || !atlasAlias) {
    return null;
  }

  try {
    const spineInstance = spine.Spine.from({
      skeleton: skeletonAlias,
      atlas: atlasAlias,
      scale: 1
    });

    if (!spineInstance.skeleton.physics) {
      spineInstance.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {}
      };
    }

    const skin = spineInstance.skeleton.data.findSkin(skinName);
    if (skin) {
      spineInstance.skeleton.setSkin(skin);
      spineInstance.skeleton.setSlotsToSetupPose();
    }

    // Начинаем с уровня 0, idle
    const idleAnim = getAnimationName(0, 'idle');
    if (hasAnimation(spineInstance, idleAnim)) {
      spineInstance.state.setAnimation(0, idleAnim, true);
    }

    // Сбрасываем уровень для этого цвета
    chestLevels[skinName] = 0;

    return spineInstance;
  } catch (e) {
    console.warn('[ChestManager] createChest failed:', e);
    return null;
  }
}

/**
 * Создаёт по одному экземпляру сундука на каждый скин (red, blue, yellow).
 * @param {string} skeletonAlias - алиас скелета
 * @param {string} atlasAlias - алиас атласа
 * @returns {{ red: spine.Spine|null, blue: spine.Spine|null, yellow: spine.Spine|null }}
 */
export function createAllChests(skeletonAlias, atlasAlias) {
  return {
    red: createChest(skeletonAlias, atlasAlias, 'red'),
    blue: createChest(skeletonAlias, atlasAlias, 'blue'),
    yellow: createChest(skeletonAlias, atlasAlias, 'yellow')
  };
}

// ============================================================================
// Реакции на события
// ============================================================================

/**
 * Обрабатывает прилёт монетки к сундуку.
 * С вероятностью HIT_UP_CHANCE (если уровень < MAX_REGULAR_LEVEL) проигрывает hit_up и повышает уровень.
 * Иначе проигрывает hit и возвращается к idle текущего уровня.
 * 
 * @param {{ red: spine.Spine|null, blue: spine.Spine|null, yellow: spine.Spine|null }} chests - объект с экземплярами
 * @param {string} chestColor - цвет сундука, к которому прилетела монетка: 'red', 'blue', 'yellow'
 */
export function onCoinArrival(chests, chestColor) {
  const chest = chests?.[chestColor];
  if (!chest || chest.destroyed) return;

  SoundManager.playBomb();

  const currentLevel = chestLevels[chestColor] ?? 0;
  const canLevelUp = currentLevel < MAX_REGULAR_LEVEL;
  const shouldLevelUp = canLevelUp && Math.random() < HIT_UP_CHANCE;

  if (shouldLevelUp) {
    // Переход на следующий уровень
    const hitUpAnim = getAnimationName(currentLevel, 'hit_up');
    const newLevel = currentLevel + 1;
    const newIdleAnim = getAnimationName(newLevel, 'idle');

    if (hasAnimation(chest, hitUpAnim)) {
      console.log(`[ChestManager] ${chestColor}: hit_up (${currentLevel} -> ${newLevel})`);
      const entry = chest.state.setAnimation(0, hitUpAnim, false);
      if (entry) {
        entry.listener = {
          complete: () => {
            chestLevels[chestColor] = newLevel;
            chest.state.setAnimation(0, newIdleAnim, true);
          }
        };
      } else {
        chestLevels[chestColor] = newLevel;
        chest.state.setAnimation(0, newIdleAnim, true);
      }
    } else {
      // Fallback: если hit_up не существует, играем обычный hit
      playHitAnimation(chest, chestColor, currentLevel);
    }
  } else {
    // Обычный hit
    playHitAnimation(chest, chestColor, currentLevel);
  }
}

/**
 * Проигрывает hit анимацию и возвращается к idle.
 * @param {spine.Spine} chest - экземпляр сундука
 * @param {string} chestColor - цвет сундука
 * @param {number} level - текущий уровень
 */
function playHitAnimation(chest, chestColor, level) {
  const hitAnim = getAnimationName(level, 'hit');
  const idleAnim = getAnimationName(level, 'idle');

  if (hasAnimation(chest, hitAnim)) {
    console.log(`[ChestManager] ${chestColor}: hit (level ${level})`);
    const entry = chest.state.setAnimation(0, hitAnim, false);
    if (entry) {
      entry.listener = {
        complete: () => {
          chest.state.setAnimation(0, idleAnim, true);
        }
      };
    } else {
      chest.state.setAnimation(0, idleAnim, true);
    }
  } else {
    chest.state.setAnimation(0, idleAnim, true);
  }
}

/**
 * Проигрывает jump анимацию на всех сундуках (реакция на взрыв бомбы).
 * Использует анимацию текущего уровня каждого сундука.
 * Вызывается по ивенту "boom" анимации бомбы (config.onBombBoom в CascadeManager).
 * 
 * @param {{ red: spine.Spine|null, blue: spine.Spine|null, yellow: spine.Spine|null }} chests - объект с экземплярами сундуков
 */
export function playJumpOnAll(chests) {
  if (!chests) return;

  for (const color of CHEST_SKINS) {
    const chest = chests[color];
    if (!chest || chest.destroyed) continue;

    const level = chestLevels[color] ?? 0;
    const jumpAnim = getAnimationName(level, 'jump');
    const idleAnim = getAnimationName(level, 'idle');

    if (hasAnimation(chest, jumpAnim)) {
      const entry = chest.state.setAnimation(0, jumpAnim, false);
      if (entry) {
        entry.listener = {
          complete: () => {
            chest.state.setAnimation(0, idleAnim, true);
          }
        };
      } else {
        chest.state.setAnimation(0, idleAnim, true);
      }
    } else {
      chest.state.setAnimation(0, idleAnim, true);
    }
  }
}
