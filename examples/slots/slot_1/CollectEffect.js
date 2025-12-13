import { SpineAnimation } from './SpineAnimation.js';

export class CollectEffect {
  constructor(config, app, stage) {
    this.config = config;
    this.app = app;
    this.stage = stage;
    this.spineAnimation = null;
    this.container = null;
    this.coinKey = null; // Привязка к монетке
    this.targetType = null; // Тип цели
  }
  
  async init() {
    // Создаем Spine анимацию для collect effect
    this.spineAnimation = new SpineAnimation(
      this.config,
      this.app,
      this.stage,
      'collect_effect',
      'null', // Начальная анимация null (скрытое состояние)
      true
    );
    
    const loaded = await this.spineAnimation.load();
    if (!loaded) {
      console.warn('CollectEffect: Не удалось загрузить collect effect');
      return false;
    }
    
    // Получаем контейнер и устанавливаем zIndex
    this.container = this.spineAnimation.getContainer();
    this.container.zIndex = 300; // Выше всего (выше logo zIndex = 250)
    
    // Позиционируем в центре экрана
    const x = this.config.resolution.width / 2;
    const y = this.config.resolution.height / 2;
    this.spineAnimation.setPosition(x, y);
    
    // Устанавливаем скин "gold" (если есть)
    if (this.spineAnimation.spine && this.spineAnimation.spine.skeleton) {
      const goldSkin = this.spineAnimation.spine.skeleton.data.findSkin("gold");
      if (goldSkin) {
        this.spineAnimation.spine.skeleton.setSkin(goldSkin);
        this.spineAnimation.spine.skeleton.setSlotsToSetupPose();
        if (this.spineAnimation.spine.skeleton.physics) {
          this.spineAnimation.spine.skeleton.updateWorldTransform(
            this.spineAnimation.spine.skeleton.physics.update
          );
        }
        console.log('CollectEffect: Скин "gold" установлен');
      }
    }
    
    console.log('CollectEffect: Инициализирован');
    return true;
  }
  
  // Воспроизведение анимации collect effect
  play() {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    // Очищаем трек перед запуском
    const TRACK_COLLECT = 0;
    this.spineAnimation.clearTrack(TRACK_COLLECT);
    this.spineAnimation.setEmptyAnimation(TRACK_COLLECT, 0);
    
    // Запускаем анимацию (предполагаем, что есть анимация "collect" или подобная)
    // Если анимация не найдена, можно использовать другую
    const animName = 'collect'; // Или другое имя анимации из Spine
    const entry = this.spineAnimation.setAnimationOnTrack(TRACK_COLLECT, animName, false);
    
    if (entry) {
      console.log(`CollectEffect: Воспроизводится анимация "${animName}"`);
    } else {
      console.warn(`CollectEffect: Анимация "${animName}" не найдена`);
    }
  }
  
  // Получение контейнера для доступа из дебаггера
  getContainer() {
    return this.container;
  }
  
  // Уничтожение collect effect
  destroy() {
    if (this.spineAnimation) {
      this.spineAnimation.destroy();
      this.spineAnimation = null;
    }
    this.container = null;
  }
}

