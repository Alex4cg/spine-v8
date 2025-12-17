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
      
      // Добавляем глобальный слушатель для логирования всех Spine событий (только для коллектора)
      const isCollector = this.spineName === 'coin_collector';
      this.spine.state.addListener({
        start: (entry) => {
          if (!isCollector) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          const loop = entry.loop;
          console.log(`[Spine ${this.spineName}] START: track=${trackIndex}, animation="${animName}", loop=${loop}`);
        },
        interrupt: (entry) => {
          if (!isCollector) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          console.log(`[Spine ${this.spineName}] INTERRUPT: track=${trackIndex}, animation="${animName}"`);
        },
        end: (entry) => {
          if (!isCollector) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          console.log(`[Spine ${this.spineName}] END: track=${trackIndex}, animation="${animName}"`);
        },
        complete: (entry) => {
          if (!isCollector) return;
          // Пропускаем зацикленные анимации для коллектора
          if (entry.loop) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          // Безопасный расчет loopCount
          let loopCount = 'N/A';
          if (entry.animation && entry.animation.duration && entry.animation.duration > 0) {
            loopCount = (entry.trackTime / entry.animation.duration).toFixed(2);
          }
          console.log(`[Spine ${this.spineName}] COMPLETE: track=${trackIndex}, animation="${animName}", loopCount=${loopCount}`);
        },
        event: (entry, event) => {
          if (!isCollector) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          const eventName = event.data ? event.data.name : 'unknown';
          const eventInt = event.intValue !== undefined ? event.intValue : null;
          const eventFloat = event.floatValue !== undefined ? event.floatValue : null;
          const eventString = event.stringValue || null;
          let eventData = '';
          if (eventInt !== null) eventData += ` int=${eventInt}`;
          if (eventFloat !== null) eventData += ` float=${eventFloat}`;
          if (eventString) eventData += ` string="${eventString}"`;
          console.log(`[Spine ${this.spineName}] EVENT: track=${trackIndex}, animation="${animName}", event="${eventName}"${eventData}`);
        },
        dispose: (entry) => {
          if (!isCollector) return;
          const animName = entry.animation ? entry.animation.name : 'unknown';
          const trackIndex = entry.trackIndex;
          console.log(`[Spine ${this.spineName}] DISPOSE: track=${trackIndex}, animation="${animName}"`);
        }
      });
      
      // Проверяем доступные анимации через skeletonData
      const animations = this.spine.state.data.skeletonData.animations;
      const animationNames = animations.map(anim => anim.name);
      
      // Устанавливаем анимацию только если она указана (не null/undefined)
      if (this.animationName && animationNames.includes(this.animationName)) {
        const entry = this.spine.state.setAnimation(0, this.animationName, this.loop);
        if (isCollector) {
          console.log(`[Spine ${this.spineName}] setAnimation(0, "${this.animationName}", ${this.loop}) -> entry:`, entry ? 'OK' : 'FAILED');
        }
      } else if (this.animationName) {
        // Если указано имя, но оно не найдено, пробуем найти первую доступную анимацию
        if (animations.length > 0) {
          const firstAnim = animations[0].name;
          const entry = this.spine.state.setAnimation(0, firstAnim, this.loop);
          if (isCollector) {
            console.log(`[Spine ${this.spineName}] setAnimation(0, "${firstAnim}", ${this.loop}) [fallback] -> entry:`, entry ? 'OK' : 'FAILED');
          }
          this.animationName = firstAnim; // Обновляем имя текущей анимации
        }
      } else {
        if (isCollector) {
          console.log(`[Spine ${this.spineName}] No initial animation set`);
        }
      }
      
      // Добавляем спайн в его контейнер
      this.container.addChild(this.spine);
      
      // Добавляем контейнер в родительский контейнер
      this.parentContainer.addChild(this.container);
      
      return true;
    } catch (error) {
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
      return;
    }
    
    // Проверяем доступные анимации через skeletonData
    const animations = this.spine.state.data.skeletonData.animations;
    const animationNames = animations.map(anim => anim.name);
    
    const isCollector = this.spineName === 'coin_collector';
    if (animationNames.includes(animationName)) {
      const shouldLoop = loop !== null ? loop : this.loop;
      const entry = this.spine.state.setAnimation(0, animationName, shouldLoop);
      if (isCollector) {
        console.log(`[Spine ${this.spineName}] playAnimation("${animationName}", ${shouldLoop}) -> entry:`, entry ? 'OK' : 'FAILED');
      }
      this.animationName = animationName;
      this.loop = shouldLoop;
    } else {
      if (isCollector) {
        console.warn(`[Spine ${this.spineName}] playAnimation("${animationName}") - animation not found`);
      }
    }
  }
  
  // Метод для установки анимации на конкретном треке
  setAnimationOnTrack(trackIndex, animationName, loop = false) {
    if (!this.spine) {
      return null;
    }
    
    const animations = this.spine.state.data.skeletonData.animations;
    const animationNames = animations.map(anim => anim.name);
    
    const isCollector = this.spineName === 'coin_collector';
    if (animationNames.includes(animationName)) {
      const entry = this.spine.state.setAnimation(trackIndex, animationName, loop);
      if (isCollector) {
        console.log(`[Spine ${this.spineName}] setAnimationOnTrack(${trackIndex}, "${animationName}", ${loop}) -> entry:`, entry ? 'OK' : 'FAILED');
      }
      return entry;
    } else {
      if (isCollector) {
        console.warn(`[Spine ${this.spineName}] setAnimationOnTrack(${trackIndex}, "${animationName}", ${loop}) - animation not found`);
      }
      return null;
    }
  }
  
  // Метод для очистки трека
  clearTrack(trackIndex) {
    if (this.spine) {
      const isCollector = this.spineName === 'coin_collector';
      if (isCollector) {
        console.log(`[Spine ${this.spineName}] clearTrack(${trackIndex})`);
      }
      this.spine.state.clearTrack(trackIndex);
    }
  }
  
  // Метод для установки пустой анимации на треке
  setEmptyAnimation(trackIndex, mixDuration = 0) {
    if (this.spine) {
      const isCollector = this.spineName === 'coin_collector';
      if (isCollector) {
        console.log(`[Spine ${this.spineName}] setEmptyAnimation(${trackIndex}, ${mixDuration})`);
      }
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

