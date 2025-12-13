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
      'train',
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

    this.isLoaded = true;
    console.log('TrainManager: Train Spine animation loaded with continuous tracks (idle, piles, speed)');
    return true;
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

