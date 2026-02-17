import { SpineAnimation } from './SpineAnimation.js';

/**
 * Менеджер поезда - управляет Spine анимацией поезда
 * Поезд размещается на stage за рамкой (zIndex 90)
 */
export class TrainManager {
  constructor(config, app, stage) {
    this.config = config;
    this.app = app;
    this.stage = stage;
    this.trainAnimation = null;
    this.isLoaded = false;
    this.scaleIncrement = 0; // Текущее приращение масштаба (в процентах, 0-5%)
    this.maxScaleIncrement = 5; // Максимальное приращение масштаба (5%)
    this.scaleIncrementPerHit = 0.3; // Приращение масштаба за один прилет (0.3%)
    this.idlePlayCount = 0; // Счетчик проигранных обычных idle анимаций
    this.idleTargetCount = 2; // Целевое количество обычных idle перед idle2 (2-3)
  }

  /**
   * Инициализирует и загружает поезд
   */
  async init() {
    if (!this.config.spine || !this.config.spine.train || !this.config.spine.train.enabled) {
      console.log('TrainManager: Train disabled in config');
      return false;
    }

    const trainConfig = this.config.spine.train;
    
    // Создаем поезд в отдельном контейнере на stage
    this.trainAnimation = new SpineAnimation(
      this.config,
      this.app,
      this.stage, // Добавляем контейнер поезда напрямую на stage
      'train_2',
      trainConfig.animationName || '00_idle',
      trainConfig.loop !== undefined ? trainConfig.loop : true
    );

    const loaded = await this.trainAnimation.load();
    if (!loaded) {
      console.warn('TrainManager: Failed to load train Spine');
      return false;
    }

    // Получаем контейнер поезда и устанавливаем zIndex
    const trainContainer = this.trainAnimation.getContainer();
    trainContainer.zIndex = 90; // Значение из debug_positions.json

    // Размещаем поезд (значения из debug_positions.json)
    const trainX = 960;
    const trainY = 236;
    this.trainAnimation.setPosition(trainX, trainY);

    // Сохраняем исходный масштаб
    this.baseScale = {
      x: trainConfig.scale ? trainConfig.scale.x : 1.0,
      y: trainConfig.scale ? trainConfig.scale.y : 1.0
    };
    
    if (trainConfig.scale) {
      this.trainAnimation.setScale(trainConfig.scale.x, trainConfig.scale.y);
    } else {
      this.trainAnimation.setScale(1.0, 1.0);
    }

    // Запускаем постоянные анимации в цикле на разных треках
    // Трек 0: базовая idle анимация (уже запущена при load)
    // Трек 1: piles of gold (зациклено)
    this.trainAnimation.setAnimationOnTrack(1, '01_piles_of_gold', true);

    // Трек 2: speed effect (зациклено)
    this.trainAnimation.setAnimationOnTrack(2, '02_bg_speed_effect', true);

    // Трек 5: trail track (зациклено)
    this.trainAnimation.setAnimationOnTrack(5, '08_trail_track', true);

    // Настраиваем переключение между 00_idle и 00_idle2
    this.setupIdleAnimationSwitching();

    this.isLoaded = true;
    console.log('TrainManager: Train Spine animation loaded with continuous tracks (idle, piles, speed, trail)');
    return true;
  }

  /**
   * Настраивает переключение между 00_idle и 00_idle_2
   * Играет 2-3 обычных idle, затем один idle_2
   * Использует событие end_idle из Spine анимации
   */
  setupIdleAnimationSwitching() {
    if (!this.trainAnimation || !this.trainAnimation.spine) {
      return;
    }

    const TRACK_IDLE = 0;
    const spineState = this.trainAnimation.spine.state;

    // Устанавливаем случайное целевое количество (2 или 3)
    this.idleTargetCount = 2 + Math.floor(Math.random() * 2); // 2 или 3
    this.idlePlayCount = 0;
    
    // Добавляем слушатель события end_idle из Spine анимации
    spineState.addListener({
      event: (entry, event) => {
        // Проверяем, что это событие end_idle с трека 0
        if (entry.trackIndex === TRACK_IDLE && event?.data?.name === 'end_idle') {
          this.handleIdleAnimationComplete();
        }
      }
    });
    
    console.log(`TrainManager: Idle animation switching setup (target: ${this.idleTargetCount} idle before idle_2, using end_idle event)`);
  }

  /**
   * Обрабатывает завершение idle анимации
   */
  handleIdleAnimationComplete() {
    if (!this.trainAnimation || !this.trainAnimation.spine) {
      console.warn('TrainManager: handleIdleAnimationComplete - train not loaded');
      return;
    }

    const TRACK_IDLE = 0;
    const currentEntry = this.trainAnimation.spine.state.tracks[TRACK_IDLE];
    
    if (!currentEntry) {
      console.warn('TrainManager: handleIdleAnimationComplete - no entry on track 0');
      return;
    }

    const currentAnimation = currentEntry.animation ? currentEntry.animation.name : null;
    console.log(`TrainManager: Idle animation cycle complete - current: "${currentAnimation}", count: ${this.idlePlayCount}/${this.idleTargetCount}`);

    // Если сейчас играет 00_idle_2, переключаемся обратно на 00_idle
    if (currentAnimation === '00_idle_2') {
      this.idlePlayCount = 0;
      this.idleTargetCount = 2 + Math.floor(Math.random() * 2); // Новое случайное значение 2-3
      const entry = this.trainAnimation.setAnimationOnTrack(TRACK_IDLE, '00_idle', true);
      if (entry) {
        console.log(`TrainManager: Switched from 00_idle_2 to 00_idle (new target: ${this.idleTargetCount})`);
      } else {
        console.warn('TrainManager: Failed to switch to 00_idle');
      }
      return;
    }

    // Если играет 00_idle, увеличиваем счетчик
    if (currentAnimation === '00_idle') {
      this.idlePlayCount++;

      // Если достигли целевого количества, переключаемся на 00_idle_2
      if (this.idlePlayCount >= this.idleTargetCount) {
        const entry = this.trainAnimation.setAnimationOnTrack(TRACK_IDLE, '00_idle_2', true);
        if (entry) {
          console.log(`TrainManager: Switched from 00_idle to 00_idle_2 (played ${this.idlePlayCount} times)`);
        } else {
          console.warn('TrainManager: Failed to switch to 00_idle_2 - animation may not exist');
        }
      } else {
        console.log(`TrainManager: 00_idle continues (${this.idlePlayCount}/${this.idleTargetCount})`);
      }
    } else {
      console.warn(`TrainManager: Unexpected animation on track 0: "${currentAnimation}"`);
    }
  }

  /**
   * Запускает разовую анимацию поезда при спине
   */
  playSpinAnimation() {
    if (!this.trainAnimation || !this.trainAnimation.spine) {
      console.warn('TrainManager: Train not loaded');
      return;
    }

    // Список разовых анимаций
    const spinAnimations = ['03_blick_add', '04_steam_1', '05_steam_2'];

    // Выбираем случайную анимацию
    const randomAnim = spinAnimations[Math.floor(Math.random() * spinAnimations.length)];

    // Трек 3 для разовых анимаций
    const TRACK_ONESHOT = 3;

    // Очищаем трек перед запуском
    this.trainAnimation.clearTrack(TRACK_ONESHOT);
    this.trainAnimation.setEmptyAnimation(TRACK_ONESHOT, 0);

    // Запускаем разовую анимацию
    this.trainAnimation.setAnimationOnTrack(TRACK_ONESHOT, randomAnim, false);

    console.log(`TrainManager: Playing spin animation "${randomAnim}"`);
  }

  /**
   * Запускает анимацию active поезда (при событии collect_effect_hit)
   */
  playActiveAnimation() {
    if (!this.trainAnimation || !this.trainAnimation.spine) {
      console.warn('TrainManager: Train not loaded');
      return;
    }

    // Запускаем анимацию active на треке 4 (аналогично train-test.html, где используется playOneshot("06_active"))
    const TRACK_ACTIVE = 4;
    
    // Очищаем трек перед запуском
    this.trainAnimation.clearTrack(TRACK_ACTIVE);
    this.trainAnimation.setEmptyAnimation(TRACK_ACTIVE, 0);
    
    // Запускаем анимацию active (или 06_active, в зависимости от того, как она названа в Spine)
    // Пробуем сначала '06_active', потом 'active'
    let entry = this.trainAnimation.setAnimationOnTrack(TRACK_ACTIVE, '06_active', false);
    if (!entry) {
      entry = this.trainAnimation.setAnimationOnTrack(TRACK_ACTIVE, 'active', false);
    }
    
    if (entry) {
      console.log('TrainManager: Playing active animation (reaction to coin hit)');
    } else {
      console.warn('TrainManager: Active animation not found (tried 06_active and active)');
    }
    
    // Увеличиваем масштаб контейнера на 0.1% за каждый прилет (максимум 5%)
    if (this.scaleIncrement < this.maxScaleIncrement) {
      this.scaleIncrement = Math.min(this.scaleIncrement + this.scaleIncrementPerHit, this.maxScaleIncrement);
      
      // Вычисляем новый масштаб (базовый масштаб * (1 + приращение в процентах / 100))
      const scaleMultiplier = 1 + (this.scaleIncrement / 100);
      const newScaleX = this.baseScale.x * scaleMultiplier;
      const newScaleY = this.baseScale.y * scaleMultiplier;
      
      // Применяем новый масштаб
      this.trainAnimation.setScale(newScaleX, newScaleY);
      
      console.log(`TrainManager: Scale incremented to ${this.scaleIncrement.toFixed(1)}% (scale: ${newScaleX.toFixed(3)})`);
    }
  }

  /**
   * Возвращает ссылку на Spine анимацию поезда (для ParticleSystem и других систем)
   */
  getSpineAnimation() {
    return this.trainAnimation;
  }

  /**
   * Возвращает контейнер поезда
   */
  getContainer() {
    return this.trainAnimation ? this.trainAnimation.getContainer() : null;
  }

  /**
   * Возвращает позицию поезда
   * @returns {object|null} {x, y} или null если поезд не загружен
   */
  getPosition() {
    if (!this.trainAnimation) {
      return null;
    }
    const container = this.trainAnimation.getContainer();
    if (!container) {
      return null;
    }
    return {
      x: container.x,
      y: container.y
    };
  }

  /**
   * Возвращает позицию кости coin_target поезда в мировых координатах
   * @returns {object|null} {x, y} или null если поезд не загружен или кость не найдена
   */
  getCoinTargetPosition() {
    if (!this.trainAnimation || !this.trainAnimation.spine) {
      return null;
    }

    const spine = this.trainAnimation.spine;
    const skeleton = spine.skeleton;
    
    // Находим кость coin_target
    const coinTargetBone = skeleton.findBone('coin_target');
    if (!coinTargetBone) {
      console.warn('TrainManager: Кость coin_target не найдена');
      return null;
    }

    // Получаем мировые координаты кости в системе скелета
    const bonePoint = { x: coinTargetBone.worldX, y: coinTargetBone.worldY };
    
    // Преобразуем координаты кости в мировые координаты PixiJS
    // Используем тот же подход, что и в ParticleSystem
    if (typeof spine.skeletonToPixiWorldCoordinates === 'function') {
      spine.skeletonToPixiWorldCoordinates(bonePoint);
    } else if (typeof skeleton.skeletonToPixiWorldCoordinates === 'function') {
      skeleton.skeletonToPixiWorldCoordinates(bonePoint);
    } else {
      // Fallback: используем позицию контейнера + мировые координаты кости
      const container = this.trainAnimation.getContainer();
      bonePoint.x += container.x;
      bonePoint.y += container.y;
    }

    return {
      x: bonePoint.x,
      y: bonePoint.y
    };
  }

  /**
   * Уничтожение менеджера
   */
  destroy() {
    if (this.trainAnimation) {
      // Если SpineAnimation имеет метод destroy, вызываем его
      if (this.trainAnimation.destroy) {
        this.trainAnimation.destroy();
      }
      this.trainAnimation = null;
    }
    this.isLoaded = false;
  }
}

