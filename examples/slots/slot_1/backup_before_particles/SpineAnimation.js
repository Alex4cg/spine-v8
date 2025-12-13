export class SpineAnimation {
  constructor(config, app, parentContainer, spineName, animationName = 'idle', loop = true) {
    this.config = config;
    this.app = app;
    this.parentContainer = parentContainer; // Родительский контейнер (stage или другой контейнер)
    this.spineName = spineName;
    this.animationName = animationName;
    this.loop = loop;
    this.spine = null;
    
    // Создаем отдельный контейнер для этого спайна
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
  }
  
  async load() {
    try {
      const skeletonPath = `./spine/${this.spineName}/skeleton.json`;
      const atlasPath = `./spine/${this.spineName}/skeleton.atlas`;
      
      // Создаем алиасы для ресурсов
      const skeletonAlias = `${this.spineName}Skeleton`;
      const atlasAlias = `${this.spineName}Atlas`;
      
      // Загружаем ресурсы через PIXI.Assets.load с объектами
      await PIXI.Assets.load([
        { alias: skeletonAlias, src: skeletonPath },
        { alias: atlasAlias, src: atlasPath }
      ]);
      
      // Создаем Spine экземпляр через spine.Spine.from()
      this.spine = spine.Spine.from({
        skeleton: skeletonAlias,
        atlas: atlasAlias,
        scale: 1
      });
      
      // Устанавливаем физику, если нужно (как в примере)
      if (!this.spine.skeleton.physics) {
        this.spine.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {},
        };
      }
      
      // Проверяем доступные анимации через skeletonData
      const animations = this.spine.state.data.skeletonData.animations;
      const animationNames = animations.map(anim => anim.name);
      
      // Устанавливаем анимацию
      if (animationNames.includes(this.animationName)) {
        this.spine.state.setAnimation(0, this.animationName, this.loop);
        console.log(`Spine ${this.spineName}: Playing animation "${this.animationName}"`);
      } else {
        console.warn(`Spine ${this.spineName}: Animation "${this.animationName}" not found. Available:`, animationNames);
        // Пробуем найти первую доступную анимацию
        if (animations.length > 0) {
          const firstAnim = animations[0].name;
          console.log(`Spine ${this.spineName}: Using first available animation "${firstAnim}"`);
          this.spine.state.setAnimation(0, firstAnim, this.loop);
          this.animationName = firstAnim; // Обновляем имя текущей анимации
        }
      }
      
      // Добавляем спайн в его контейнер
      this.container.addChild(this.spine);
      
      // Добавляем контейнер в родительский контейнер
      this.parentContainer.addChild(this.container);
      
      console.log(`Spine ${this.spineName} loaded successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to load Spine ${this.spineName}:`, error);
      return false;
    }
  }
  
  setPosition(x, y) {
    // Трансформируем контейнер, а не сам спайн
    if (this.container) {
      this.container.x = x;
      this.container.y = y;
    }
  }
  
  setScale(scaleX, scaleY = null) {
    // Трансформируем контейнер, а не сам спайн
    if (this.container) {
      this.container.scale.x = scaleX;
      this.container.scale.y = scaleY !== null ? scaleY : scaleX;
    }
  }
  
  getContainer() {
    return this.container;
  }
  
  playAnimation(animationName, loop = null) {
    if (!this.spine) {
      console.warn(`Spine ${this.spineName}: Not loaded yet`);
      return;
    }
    
    // Проверяем доступные анимации через skeletonData
    const animations = this.spine.state.data.skeletonData.animations;
    const animationNames = animations.map(anim => anim.name);
    
    if (animationNames.includes(animationName)) {
      const shouldLoop = loop !== null ? loop : this.loop;
      this.spine.state.setAnimation(0, animationName, shouldLoop);
      this.animationName = animationName;
      this.loop = shouldLoop;
      console.log(`Spine ${this.spineName}: Playing animation "${animationName}"`);
    } else {
      console.warn(`Spine ${this.spineName}: Animation "${animationName}" not found. Available:`, animationNames);
    }
  }
  
  // Метод для установки анимации на конкретном треке
  setAnimationOnTrack(trackIndex, animationName, loop = false) {
    if (!this.spine) {
      console.warn(`Spine ${this.spineName}: Not loaded yet`);
      return null;
    }
    
    const animations = this.spine.state.data.skeletonData.animations;
    const animationNames = animations.map(anim => anim.name);
    
    if (animationNames.includes(animationName)) {
      const entry = this.spine.state.setAnimation(trackIndex, animationName, loop);
      console.log(`Spine ${this.spineName}: Playing animation "${animationName}" on track ${trackIndex} (loop: ${loop})`);
      return entry;
    } else {
      console.warn(`Spine ${this.spineName}: Animation "${animationName}" not found. Available:`, animationNames);
      return null;
    }
  }
  
  // Метод для очистки трека
  clearTrack(trackIndex) {
    if (this.spine) {
      this.spine.state.clearTrack(trackIndex);
    }
  }
  
  // Метод для установки пустой анимации на треке
  setEmptyAnimation(trackIndex, mixDuration = 0) {
    if (this.spine) {
      this.spine.state.setEmptyAnimation(trackIndex, mixDuration);
    }
  }
  
  destroy() {
    if (this.spine && this.container) {
      this.container.removeChild(this.spine);
      this.spine.destroy();
      this.spine = null;
    }
    if (this.container && this.parentContainer) {
      this.parentContainer.removeChild(this.container);
      this.container.destroy();
      this.container = null;
    }
  }
}

