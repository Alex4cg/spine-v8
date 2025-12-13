import { CustomCoinEmitter } from './ParticleEmitter.js';

export class ParticleSystem {
  constructor(app, stage) {
    this.app = app;
    this.stage = stage;
    this.particleLayer = null;
    this.coinLayer = null;
    this.smokeEmitter = null;
    this.coinEmitters = [];
    this.particleNamespace = null;
    
    // Определяем namespace эмиттера частиц
    this.particleNamespace =
      (PIXI.particleEmitter && PIXI.particleEmitter.Emitter
        ? PIXI.particleEmitter
        : null) ??
      (PIXI.particles && PIXI.particles.Emitter ? PIXI.particles : null) ??
      (window.particleEmitter && window.particleEmitter.Emitter
        ? window.particleEmitter
        : null);
  }
  
  async init(trainSpine) {
    if (!trainSpine || !trainSpine.spine) {
      console.warn('ParticleSystem: trainSpine не найден');
      return;
    }
    
    // Создаем контейнеры
    // Эмиттер дыма должен быть ЗА поездом (zIndex < 90)
    this.particleLayer = new PIXI.Container();
    this.particleLayer.zIndex = 85; // За поездом (train zIndex = 90)
    this.stage.addChild(this.particleLayer);
    
    // Эмиттеры монет должны быть ПЕРЕД поездом (zIndex > 90)
    this.coinLayer = new PIXI.Container();
    this.coinLayer.zIndex = 95; // Перед поездом (train zIndex = 90)
    this.stage.addChild(this.coinLayer);
    
    // Инициализируем стандартный эмиттер дыма
    await this.initSmokeEmitter(trainSpine);
    
    // Инициализируем эмиттеры монет
    await this.initCoinEmitters(trainSpine);
    
    // Настраиваем обновление в ticker
    this.setupTickerUpdate(trainSpine);
  }
  
  // Инициализация стандартного эмиттера дыма
  async initSmokeEmitter(trainSpine) {
    if (!this.particleNamespace || !this.particleNamespace.Emitter) {
      console.warn('ParticleSystem: particle-emitter не найден, дым не будет работать');
      return;
    }
    
    const assets = await this.loadStandardEmitterAssets();
    if (!assets) {
      return;
    }
    
    // Находим кость для эмиттера
    const emitterBone = trainSpine.spine.skeleton.findBone("place_holder_emitter_1");
    
    if (!emitterBone) {
      console.warn('ParticleSystem: Кость place_holder_emitter_1 не найдена');
      return;
    }
    
    console.log('ParticleSystem: Кость place_holder_emitter_1 найдена');
    
    // Получаем конфигурацию и текстуру
    const rawEmitterConfig = assets.emitterConfig;
    const smokeTexture = assets.smokeTexture;
    
    // Обновляем конфигурацию (конвертируем старый формат в новый, если нужно)
    let emitterConfig = rawEmitterConfig;
    if (this.particleNamespace.upgradeConfig) {
      emitterConfig = this.particleNamespace.upgradeConfig(
        rawEmitterConfig,
        smokeTexture ? [smokeTexture] : []
      );
      console.log('ParticleSystem: Конфигурация эмиттера обновлена');
    } else if (smokeTexture) {
      // Если upgradeConfig нет, добавляем текстуру напрямую
      emitterConfig = JSON.parse(JSON.stringify(rawEmitterConfig));
      emitterConfig.texture = smokeTexture;
    }
    
    // Создаем эмиттер
    this.smokeEmitter = new this.particleNamespace.Emitter(
      this.particleLayer,
      emitterConfig
    );
    this.smokeEmitter.autoUpdate = true;
    this.smokeEmitter.emit = true;
    
    // Устанавливаем начальную позицию
    const bonePoint = { x: 0, y: 0 };
    bonePoint.x = emitterBone.worldX;
    bonePoint.y = emitterBone.worldY;
    trainSpine.spine.skeletonToPixiWorldCoordinates(bonePoint);
    this.smokeEmitter.updateOwnerPos(bonePoint.x, bonePoint.y);
    
    // Сохраняем ссылку на кость для обновления позиции
    this.smokeEmitterBone = emitterBone;
    this.smokeBonePoint = bonePoint;
    
    console.log('ParticleSystem: Эмиттер дыма создан и привязан к кости');
  }
  
  // Загрузка ресурсов для стандартного эмиттера
  async loadStandardEmitterAssets() {
    try {
      // Загружаем конфигурацию эмиттера и текстуру дыма
      const emitterConfig = await PIXI.Assets.load('./particles/emitter.json');
      const smokeTexture = await PIXI.Assets.load('./particles/m_smoke.png');
      
      return { emitterConfig, smokeTexture };
    } catch (error) {
      console.warn('ParticleSystem: Не удалось загрузить ресурсы для эмиттера дыма:', error);
      return null;
    }
  }
  
  // Инициализация эмиттеров монет
  async initCoinEmitters(trainSpine) {
    // Загружаем текстуры монет
    const coinTexturesArray = [];
    try {
      for (let i = 0; i <= 16; i++) {
        const num = i.toString().padStart(2, '0');
        const texture = await PIXI.Assets.load(`./particles/coin_gold/${num}.png`);
        coinTexturesArray.push(texture);
      }
    } catch (error) {
      console.warn('ParticleSystem: Не удалось загрузить текстуры монет:', error);
      return;
    }
    
    // Находим кости для эмиттеров монет
    const goldEmitterBone1 = trainSpine.spine.skeleton.findBone("place_holder_emitter_gold_1");
    const goldEmitterBone2 = trainSpine.spine.skeleton.findBone("place_holder_emitter_gold_2");
    
    // Создаем первый эмиттер монет (если кость найдена)
    if (goldEmitterBone1) {
      const coinEmitter1 = new CustomCoinEmitter(this.coinLayer, coinTexturesArray, {
        startSpeed: 420,
        gravity: 900,
        spread: 30,
        lifetimeMin: 1,
        lifetimeMax: 1,
        scaleStart: 0.5,
        scaleEnd: 0.3,
        rotationSpeedMin: -5,
        rotationSpeedMax: 5,
        animationSpeed: 30,
        maxParticles: 300,
        emissionRate: 0.1,
        x: 0,
        y: 0,
        angle: 0
      });
      coinEmitter1.emit = true;
      this.coinEmitters.push({ 
        emitter: coinEmitter1, 
        bone: goldEmitterBone1, 
        point: { x: 0, y: 0 } 
      });
      console.log('ParticleSystem: Эмиттер монет 1 создан и привязан к кости place_holder_emitter_gold_1');
    } else {
      console.warn('ParticleSystem: Кость place_holder_emitter_gold_1 не найдена');
    }
    
    // Создаем второй эмиттер монет (если кость найдена)
    if (goldEmitterBone2) {
      const coinEmitter2 = new CustomCoinEmitter(this.coinLayer, coinTexturesArray, {
        startSpeed: 420,
        gravity: 900,
        spread: 30,
        lifetimeMin: 1,
        lifetimeMax: 1,
        scaleStart: 0.5,
        scaleEnd: 0.3,
        rotationSpeedMin: -5,
        rotationSpeedMax: 5,
        animationSpeed: 30,
        maxParticles: 300,
        emissionRate: 0.1,
        x: 0,
        y: 0,
        angle: 0
      });
      coinEmitter2.emit = true;
      this.coinEmitters.push({ 
        emitter: coinEmitter2, 
        bone: goldEmitterBone2, 
        point: { x: 0, y: 0 } 
      });
      console.log('ParticleSystem: Эмиттер монет 2 создан и привязан к кости place_holder_emitter_gold_2');
    } else {
      console.warn('ParticleSystem: Кость place_holder_emitter_gold_2 не найдена');
    }
  }
  
  // Настройка обновления в ticker
  setupTickerUpdate(trainSpine) {
    this.app.ticker.add(() => {
      // Обновляем позицию эмиттера дыма в соответствии с костью
      if (this.smokeEmitter && this.smokeEmitterBone) {
        this.smokeBonePoint.x = this.smokeEmitterBone.worldX;
        this.smokeBonePoint.y = this.smokeEmitterBone.worldY;
        trainSpine.spine.skeletonToPixiWorldCoordinates(this.smokeBonePoint);
        this.smokeEmitter.updateOwnerPos(this.smokeBonePoint.x, this.smokeBonePoint.y);
      }
      
      // Обновляем эмиттеры монет
      for (const { emitter, bone, point } of this.coinEmitters) {
        if (bone && emitter) {
          // Получаем мировые координаты и угол кости
          point.x = bone.worldX;
          point.y = bone.worldY;
          trainSpine.spine.skeletonToPixiWorldCoordinates(point);
          
          // Получаем угол поворота кости (в радианах)
          let boneAngle = 0;
          if (typeof bone.getWorldRotationX === 'function') {
            // Метод возвращает угол в градусах, конвертируем в радианы
            const angleDeg = bone.getWorldRotationX();
            boneAngle = (angleDeg * Math.PI) / 180;
          } else if (bone.a !== undefined && bone.b !== undefined) {
            // Fallback: вычисляем угол из матрицы преобразования (в радианах)
            boneAngle = Math.atan2(bone.b, bone.a);
          }
          
          // Устанавливаем позицию и угол эмиттера
          emitter.setPositionAndAngle(point.x, point.y, boneAngle);
          
          // Обновляем эмиттер
          const deltaTime = this.app.ticker.deltaMS / 1000;
          emitter.update(deltaTime);
        }
      }
    });
  }
  
  // Уничтожение системы партиклов
  destroy() {
    if (this.smokeEmitter) {
      this.smokeEmitter.destroy();
      this.smokeEmitter = null;
    }
    
    for (const { emitter } of this.coinEmitters) {
      if (emitter) {
        emitter.destroy();
      }
    }
    this.coinEmitters = [];
    
    if (this.particleLayer) {
      this.stage.removeChild(this.particleLayer);
      this.particleLayer.destroy();
      this.particleLayer = null;
    }
    
    if (this.coinLayer) {
      this.stage.removeChild(this.coinLayer);
      this.coinLayer.destroy();
      this.coinLayer = null;
    }
  }
}

