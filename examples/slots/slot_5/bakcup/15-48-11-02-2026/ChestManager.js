/**
 * ChestManager — создание Spine-экземпляров сундука (скины red, blue, yellow; анимация 00_idle).
 * Всем сундуками заведует этот менеджер. Экземпляры можно добавить на сцену и зарегистрировать в DebugMenu.
 */

/** Имена скинов сундука в skeleton.json */
export const CHEST_SKINS = ['red', 'blue', 'yellow'];

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

    const animations = spineInstance.skeleton.data.animations;
    if (animations && animations.find(a => a.name === '00_idle')) {
      spineInstance.state.setAnimation(0, '00_idle', true);
    }

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

const CHEST_JUMP_ANIM = '00_jump';
const CHEST_IDLE_ANIM = '00_idle';

/**
 * Проигрывает 00_jump на всех сундуках. По завершении анимации каждый сундук возвращается к 00_idle.
 * Вызывается по ивенту "boom" анимации бомбы (config.onBombBoom в CascadeManager).
 * @param {{ red: spine.Spine|null, blue: spine.Spine|null, yellow: spine.Spine|null }} chests - объект с экземплярами сундуков
 */
export function playJumpOnAll(chests) {
  if (!chests) return;
  const animations = chests.red?.skeleton?.data?.animations;
  const hasJump = animations && animations.find(a => a.name === CHEST_JUMP_ANIM);
  for (const key of CHEST_SKINS) {
    const chest = chests[key];
    if (!chest || chest.destroyed) continue;
    if (hasJump) {
      const entry = chest.state.setAnimation(0, CHEST_JUMP_ANIM, false);
      if (entry) {
        entry.listener = {
          complete: () => {
            chest.state.setAnimation(0, CHEST_IDLE_ANIM, true);
          }
        };
      } else {
        chest.state.setAnimation(0, CHEST_IDLE_ANIM, true);
      }
    } else {
      chest.state.setAnimation(0, CHEST_IDLE_ANIM, true);
    }
  }
}
