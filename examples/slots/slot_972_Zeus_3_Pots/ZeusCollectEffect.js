/**
 * ZeusCollectEffect — управляет анимацией перелёта из монеты (pot-тег) в корзины.
 *
 * Правильный порядок (как в collect-pinata-style.html):
 *   - На каждый перелёт создаём НОВЫЙ Spine-экземпляр с УНИКАЛЬНЫМ алиасом атласа
 *     (чтобы каждый экземпляр имел изолированный SkeletonData и свои attachment.uvs —
 *     иначе одновременные перелёты ломают секвенции друг друга, как с монетками)
 *   - addChild ДО любых анимаций
 *   - Ждём один кадр (requestAnimationFrame)
 *   - Ставим скин + setSlotsToSetupPose
 *   - Настраиваем траекторию
 *   - clearTracks + setAnimation на нужных треках
 *   - Слушаем событие collect_effect_hit → вызываем onHitCallback (отложенно через rAF)
 *   - После завершения: requestAnimationFrame → removeChild → clearTracks → destroy
 */

// Количество уникальных алиасов атласа. Должно быть >= максимально возможного
// числа одновременных перелётов (9 рилов → не более 9 одновременно).
const POOL_SIZE = 16;

export class ZeusCollectEffect {
  /**
   * @param {PIXI.Application} app
   * @param {PIXI.Container}   stage       — контейнер, куда добавляются эффекты
   * @param {number}           stageWidth
   * @param {number}           stageHeight
   */
  constructor(app, stage, stageWidth = 1920, stageHeight = 1080) {
    this.app = app;
    this.stage = stage;
    this.stageWidth = stageWidth;
    this.stageHeight = stageHeight;
    this.initialized = false;
    this._atlasIdx = 0;

    /**
     * Вызывается при событии collect_effect_hit (монета достигла корзины).
     * Аргумент: { x, y } — позиция цели.
     * @type {function|null}
     */
    this.onHitCallback = null;
  }

  /**
   * Загружает ассеты: один skeleton.json + POOL_SIZE уникальных atlas-алиасов.
   * Уникальные алиасы → уникальный cacheKey → отдельный SkeletonData для каждого
   * одновременного экземпляра → изолированные attachment.uvs (нет конфликтов секвенций).
   */
  async init() {
    PIXI.Assets.add({ alias: 'zeusCollectEffectSkeleton', src: './spine/collect_effect/skeleton.json' });
    for (let i = 0; i < POOL_SIZE; i++) {
      PIXI.Assets.add({ alias: `zeusCollectEffectAtlas_${i}`, src: './spine/collect_effect/skeleton.atlas' });
    }

    const aliases = [
      'zeusCollectEffectSkeleton',
      ...Array.from({ length: POOL_SIZE }, (_, i) => `zeusCollectEffectAtlas_${i}`)
    ];
    await PIXI.Assets.load(aliases);

    this.initialized = true;
    console.log('ZeusCollectEffect: инициализирован');
  }

  /**
   * Запустить перелёт.
   * @param {object} startPos  — мировые координаты монеты { x, y }
   * @param {object} endPos    — мировые координаты цели   { x, y }
   * @param {string} [potType] — 'green' | 'red' | 'violet'
   */
  fire(startPos, endPos = null, potType = null) {
    if (!this.initialized) {
      console.warn('ZeusCollectEffect: не инициализирован, fire() проигнорирован');
      return;
    }

    const target   = endPos ?? { x: startPos.x, y: 120 };
    const skinName = potType === 'green'  ? 'green'
                   : potType === 'red'    ? 'red'
                   : potType === 'violet' ? 'violet'
                   : 'gold';

    // Два уникальных алиаса: один для перелёта, один для взрыва прилёта.
    // Уникальный SkeletonData на каждый экземпляр → изолированные attachment.uvs.
    const flightAlias  = `zeusCollectEffectAtlas_${this._atlasIdx % POOL_SIZE}`;
    this._atlasIdx++;
    const arrivalAlias = `zeusCollectEffectAtlas_${this._atlasIdx % POOL_SIZE}`;
    this._atlasIdx++;

    // fire() может вызываться из Spine-ивента (внутри рендер-прохода).
    // Чтобы addChild не попал в текущий рендер-проход (→ slotBatches undefined),
    // откладываем создание и addChild на следующий кадр.
    requestAnimationFrame(() => {
      // ── Экземпляр 1: перелёт (hit_coin + effect) ──
      const flightObj = spine.Spine.from({
        skeleton: 'zeusCollectEffectSkeleton',
        atlas:    flightAlias
      });
      if (!flightObj.skeleton.physics) {
        flightObj.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
      }
      flightObj.state.data.defaultMix = 0;
      flightObj.x      = 0;
      flightObj.y      = 0;
      flightObj.zIndex = 500;
      this.stage.sortableChildren = true;
      this.stage.addChild(flightObj);

      // ── Экземпляр 2: взрыв прилёта (end_effect) в точке цели ──
      // end_effect содержит встроенную задержку — её можно запустить одновременно
      // с hit_coin, и анимация сама отыграет взрыв в нужный момент.
      const arrivalObj = spine.Spine.from({
        skeleton: 'zeusCollectEffectSkeleton',
        atlas:    arrivalAlias
      });
      if (!arrivalObj.skeleton.physics) {
        arrivalObj.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
      }
      arrivalObj.state.data.defaultMix = 0;
      arrivalObj.x      = target.x;
      arrivalObj.y      = target.y;
      arrivalObj.zIndex = 501;
      this.stage.addChild(arrivalObj);

      // Скин, setup pose и анимации — ещё один кадр, чтобы SpinePipe
      // успел вызвать initRenderable (иначе slotBatches = undefined).
      requestAnimationFrame(() => {
        // ── Настройка перелёта ──
        if (!flightObj.destroyed) {
          const skin = flightObj.skeleton.data.findSkin(skinName);
          if (skin) flightObj.skeleton.setSkin(skin);
          flightObj.skeleton.setSlotsToSetupPose();

          this._setControlPoints(flightObj, startPos, target);

          flightObj.state.clearTracks();
          flightObj.state.setAnimation(0, 'hit_coin', false);

          const flightListener = {
            complete: (entry) => {
              if (entry.trackIndex === 0 && entry.animation?.name === 'hit_coin') {
                flightObj.state.removeListener(flightListener);
                this._cleanupInstance(flightObj);
              }
            }
          };
          flightObj.state.addListener(flightListener);
        }

        // ── Настройка взрыва прилёта ──
        if (!arrivalObj.destroyed) {
          const skin = arrivalObj.skeleton.data.findSkin(skinName);
          if (skin) arrivalObj.skeleton.setSkin(skin);
          arrivalObj.skeleton.setSlotsToSetupPose();

          arrivalObj.state.clearTracks();
          arrivalObj.state.setAnimation(0, 'end_effect', false);

          const onHitCallback = this.onHitCallback;
          const arrivalListener = {
            event: (entry, event) => {
              if (event?.data?.name === 'collect_effect_hit' && onHitCallback) {
                requestAnimationFrame(() => onHitCallback({ x: target.x, y: target.y }));
              }
            },
            complete: (entry) => {
              if (entry.trackIndex === 0 && entry.animation?.name === 'end_effect') {
                arrivalObj.state.removeListener(arrivalListener);
                this._cleanupInstance(arrivalObj);
              }
            }
          };
          arrivalObj.state.addListener(arrivalListener);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Устанавливает кости управления траекторией.
   */
  _setControlPoints(spineObj, startPos, endPos) {
    const skeleton = spineObj.skeleton;
    const bone1   = skeleton.findBone('control_point_1');
    const bone2   = skeleton.findBone('control_point_2');
    const bone1_t = skeleton.findBone('control_point_1_t');
    const bone2_t = skeleton.findBone('control_point_2_t');

    if (!bone1 || !bone2 || !bone1_t || !bone2_t) {
      console.warn('ZeusCollectEffect: кости управления не найдены');
      return;
    }

    const toSpineBone = (bone, px, py) => {
      const pt = { x: px, y: py };
      if (typeof spineObj.pixiWorldCoordinatesToBone === 'function') {
        spineObj.pixiWorldCoordinatesToBone(pt, bone);
        bone.x = pt.x;
        bone.y = pt.y;
      } else {
        bone.x =  px - spineObj.x;
        bone.y = -(py - spineObj.y);
      }
    };

    toSpineBone(bone1, startPos.x, startPos.y);
    toSpineBone(bone2, endPos.x,   endPos.y);

    const dx   = endPos.x - startPos.x;
    const dy   = endPos.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    let perpX = -dy / dist;
    let perpY =  dx / dist;

    if (startPos.x < this.stageWidth / 2) {
      perpX = -Math.abs(perpX);
      perpY = -Math.abs(perpY);
    }

    const arcDeviation = Math.min(250, Math.max(120, dist * 0.2));

    toSpineBone(bone1_t,
      startPos.x + dx * 0.33 + perpX * arcDeviation,
      startPos.y + dy * 0.33 + perpY * arcDeviation
    );
    toSpineBone(bone2_t,
      startPos.x + dx * 0.67 + perpX * arcDeviation,
      startPos.y + dy * 0.67 + perpY * arcDeviation
    );

    if (skeleton.physics) {
      skeleton.updateWorldTransform(skeleton.physics.update);
    }
  }

  _cleanupInstance(spineObj) {
    // Уничтожение строго по гайду: следующий кадр, removeChild → clearTracks → destroy
    requestAnimationFrame(() => {
      if (spineObj.parent) {
        spineObj.parent.removeChild(spineObj);
      }
      if (!spineObj.destroyed) {
        spineObj.state?.clearTracks();
        spineObj.destroy({ children: true });
      }
    });
  }
}
