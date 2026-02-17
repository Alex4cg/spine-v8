/**
 * Система частиц с поддержкой перелета между контрольными точками
 */
class ParticleSystem {
  constructor(app, config = {}) {
    this.app = app;
    this.particleContainer = null;
    this.particleEmitter = null;
    this.point1 = null;
    this.point2 = null;
    this.point3 = null;
    this.point4 = null;
    this.isFlying = false;
    this.flyProgress = 0;
    this.isSecondFlying = false;
    this.flyProgress2 = 0;
    this.isThirdFlying = false;
    this.flyProgress3 = 0;
    this.secondEmitter = null; // Второй эмитер для перелета point2 -> point3
    this.thirdEmitter = null; // Третий эмитер для перелета point2 -> point4
    this.flyDuration = config.flyDuration || 0.5;
    this.clearDelayTime = 0.3; // Задержка перед очисткой частиц после приземления (в секундах)
    this.clearDelayTimer1 = 0; // Таймер для первого перелета
    this.clearDelayTimer2 = 0; // Таймер для второго перелета
    this.clearDelayTimer3 = 0; // Таймер для третьего перелета
    this.emitterConfig = null;
    this.particleTexture = null; // Текстура для первых двух перелетов (blue)
    this.particleTextureGold = null; // Текстура для третьего перелета (gold)
    this.boomSpine = null; // Boom для первого перелета (point1 -> point2)
    this.boomSpine2 = null; // Boom для второго перелета (point2 -> point3)
    this.boomSpine3 = null; // Boom для третьего перелета (point2 -> point4)
    this.storyController = config.storyController || null; // Ссылка на контроллер сюжета
    
    // Инициализация будет выполнена асинхронно
    this.initialized = false;
    this.initPromise = this.init();
  }
  
  async init() {
    // Загрузка ресурсов частиц и boom
    await PIXI.Assets.load([
      { alias: "shotEmitter", src: "./particles/shot_emitter.json" },
      { alias: "particleBlue", src: "./particles/shot_emitter_p/blue.png" },
      { alias: "particleGold", src: "./particles/shot_emitter_p/gold.png" },
      { alias: "boomSkeleton", src: "./spine/boom/skeleton.json" },
      { alias: "boomAtlas", src: "./spine/boom/skeleton.atlas" },
    ]);
    
    this.emitterConfig = PIXI.Assets.get("shotEmitter");
    this.particleTexture = PIXI.Assets.get("particleBlue"); // Blue для перелетов 1 и 2
    this.particleTextureGold = PIXI.Assets.get("particleGold"); // Gold для перелета 3
    
    // Создание контейнера для частиц
    this.particleContainer = new PIXI.Container();
    this.particleContainer.zIndex = 2;
    this.app.stage.addChild(this.particleContainer);
    
    // Создание эмитера
    this.particleEmitter = new SimpleParticleEmitter(
      this.particleContainer,
      this.particleTexture,
      this.emitterConfig
    );
    
    // Создание контрольных точек
    this.createControlPoints();
    
    // Настройка перетаскивания
    this.setupDragging();
    
    // Позиционируем эмитер в точке 1
    this.particleEmitter.setPosition(this.point1.x, this.point1.y);
    this.particleEmitter.emit = false; // По умолчанию выключен
    
    // Создаем второй эмитер для перелета point2 -> point3
    this.secondEmitter = new SimpleParticleEmitter(
      this.particleContainer,
      this.particleTexture,
      this.emitterConfig
    );
    this.secondEmitter.setPosition(this.point2.x, this.point2.y);
    this.secondEmitter.emit = false;
    
    // Создаем третий эмитер для перелета point2 -> point4 (использует gold текстуру)
    this.thirdEmitter = new SimpleParticleEmitter(
      this.particleContainer,
      this.particleTextureGold,
      this.emitterConfig
    );
    this.thirdEmitter.setPosition(this.point2.x, this.point2.y);
    this.thirdEmitter.emit = false;
    
    // Создание Spine объекта для boom эффекта
    this.boomSpine = spine.Spine.from({
      skeleton: "boomSkeleton",
      atlas: "boomAtlas",
      scale: 1,
    });
    
    // Устанавливаем физику для boom
    if (!this.boomSpine.skeleton.physics) {
      this.boomSpine.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }
    
    this.boomSpine.zIndex = 3; // Поверх партиклов
    this.boomSpine.visible = false; // Скрыт по умолчанию
    this.app.stage.addChild(this.boomSpine);
    
    // Создание второго Spine объекта для boom эффекта (второй перелет)
    this.boomSpine2 = spine.Spine.from({
      skeleton: "boomSkeleton",
      atlas: "boomAtlas",
      scale: 1,
    });
    
    // Устанавливаем физику для второго boom
    if (!this.boomSpine2.skeleton.physics) {
      this.boomSpine2.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }
    
    this.boomSpine2.zIndex = 3; // Поверх партиклов
    this.boomSpine2.visible = false; // Скрыт по умолчанию
    this.app.stage.addChild(this.boomSpine2);
    
    // Создание третьего Spine объекта для boom эффекта (третий перелет)
    this.boomSpine3 = spine.Spine.from({
      skeleton: "boomSkeleton",
      atlas: "boomAtlas",
      scale: 1,
    });
    
    // Устанавливаем физику для третьего boom
    if (!this.boomSpine3.skeleton.physics) {
      this.boomSpine3.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }
    
    this.boomSpine3.zIndex = 3; // Поверх партиклов
    this.boomSpine3.visible = false; // Скрыт по умолчанию
    this.app.stage.addChild(this.boomSpine3);
    
    // Помечаем как инициализированный
    this.initialized = true;
  }
  
  createControlPoints() {
    const defaultX = this.app.screen.width / 2;
    const defaultY = this.app.screen.height / 2;
    
    const createPoint = (defaultXPos, defaultYPos, color, label) => {
      const point = new PIXI.Graphics();
      point.beginFill(color);
      point.drawCircle(0, 0, 10);
      point.endFill();
      // Позиции будут установлены через DebugPositionEditor, используем значения по умолчанию временно
      point.x = defaultXPos;
      point.y = defaultYPos;
      point.zIndex = 1000;
      point.eventMode = 'static';
      point.cursor = 'pointer';
      point.hitArea = new PIXI.Circle(0, 0, 15);
      
      const text = new PIXI.Text(label, {
        fontSize: 12,
        fill: color,
        fontWeight: 'bold'
      });
      text.anchor.set(0.5);
      text.y = -20;
      point.addChild(text);
      
      this.app.stage.addChild(point);
      // Точки скрыты по умолчанию, можно показывать через DebugPositionEditor при необходимости
      point.visible = false;
      return point;
    };
    
    // Точки создаются с дефолтными позициями, которые потом будут управляться через DebugPositionEditor
    // Точки скрыты по умолчанию (visible = false)
    // Точка 1 (начальная позиция)
    this.point1 = createPoint(
      defaultX - 200,
      defaultY,
      0x00ff00,
      "Point 1"
    );
    
    // Точка 2 (конечная позиция первого перелета)
    this.point2 = createPoint(
      defaultX + 200,
      defaultY,
      0xff0000,
      "Point 2"
    );
    
    // Точка 3 (конечная позиция второго перелета)
    this.point3 = createPoint(
      defaultX + 400,
      defaultY,
      0x0000ff,
      "Point 3"
    );
    
    // Точка 4 (конечная позиция третьего перелета)
    this.point4 = createPoint(
      defaultX + 400,
      defaultY - 200,
      0xffff00,
      "Point 4"
    );
  }
  
  setupDragging() {
    let draggedPoint = null;
    let dragOffset = { x: 0, y: 0 };
    
    const startDrag = (point, event) => {
      draggedPoint = point;
      const globalPos = event.global;
      dragOffset.x = globalPos.x - point.x;
      dragOffset.y = globalPos.y - point.y;
    };
    
    const stopDrag = () => {
      draggedPoint = null;
    };
    
    // Функция для конвертации DOM координат в координаты PIXI с учетом масштабирования
    const getGlobalPos = (clientX, clientY) => {
      const rect = this.app.renderer.canvas.getBoundingClientRect();
      const scaleX = this.app.renderer.canvas.width / rect.width;
      const scaleY = this.app.renderer.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };
    
    // Подписываемся на события pointerdown для каждой точки
    this.point1.on('pointerdown', (e) => startDrag(this.point1, e));
    this.point2.on('pointerdown', (e) => startDrag(this.point2, e));
    this.point3.on('pointerdown', (e) => startDrag(this.point3, e));
    this.point4.on('pointerdown', (e) => startDrag(this.point4, e));
    
    // Используем нативные события DOM для работы независимо от eventMode stage
    // Это позволяет не менять eventMode на stage, чтобы не сломать Spine
    const handleMouseMove = (e) => {
      if (draggedPoint) {
        const globalPos = getGlobalPos(e.clientX, e.clientY);
        draggedPoint.x = globalPos.x - dragOffset.x;
        draggedPoint.y = globalPos.y - dragOffset.y;
      }
    };
    
    const handleMouseUp = () => {
      stopDrag();
    };
    
    const handleTouchMove = (e) => {
      if (draggedPoint && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const globalPos = getGlobalPos(touch.clientX, touch.clientY);
        draggedPoint.x = globalPos.x - dragOffset.x;
        draggedPoint.y = globalPos.y - dragOffset.y;
      }
    };
    
    this.app.renderer.canvas.addEventListener('mousemove', handleMouseMove);
    this.app.renderer.canvas.addEventListener('mouseup', handleMouseUp);
    this.app.renderer.canvas.addEventListener('mouseleave', handleMouseUp);
    this.app.renderer.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.app.renderer.canvas.addEventListener('touchend', handleMouseUp);
  }
  
  startFly() {
    if (this.isFlying) return;
    
    this.isFlying = true;
    this.flyProgress = 0;
    this.particleEmitter.emit = true;
    this.particleEmitter.setPosition(this.point1.x, this.point1.y);
    console.log("✅ Перелет частиц запущен");
  }
  
  stopFly() {
    this.isFlying = false;
    this.flyProgress = 0;
    this.particleEmitter.emit = false;
    // Не очищаем сразу - устанавливаем таймер на 0.3 секунды
    this.clearDelayTimer1 = this.clearDelayTime;
    // Не вызываем clear() и setPosition() сразу - они будут вызваны через задержку
    console.log("✅ Перелет частиц остановлен, очистка через 0.3 сек");
  }
  
  clearFirstEmitter() {
    if (this.particleEmitter) {
      this.particleEmitter.clear();
      this.particleEmitter.setPosition(this.point1.x, this.point1.y);
    }
    this.clearDelayTimer1 = 0;
  }
  
  startSecondFly() {
    if (this.isSecondFlying || !this.point2 || !this.point3) return;
    
    this.isSecondFlying = true;
    this.flyProgress2 = 0;
    this.secondEmitter.emit = true;
    this.secondEmitter.setPosition(this.point2.x, this.point2.y);
    console.log("✅ Второй перелет частиц запущен (point2 -> point3)");
  }
  
  stopSecondFly() {
    this.isSecondFlying = false;
    this.flyProgress2 = 0;
    if (this.secondEmitter) {
      this.secondEmitter.emit = false;
      // Не очищаем сразу - устанавливаем таймер на 0.3 секунды
      this.clearDelayTimer2 = this.clearDelayTime;
    }
    console.log("✅ Второй перелет частиц остановлен, очистка через 0.3 сек");
  }
  
  clearSecondEmitter() {
    if (this.secondEmitter) {
      this.secondEmitter.clear();
      this.secondEmitter.setPosition(this.point2.x, this.point2.y);
    }
    this.clearDelayTimer2 = 0;
  }
  
  startThirdFly() {
    if (this.isThirdFlying || !this.point2 || !this.point4) return;
    
    this.isThirdFlying = true;
    this.flyProgress3 = 0;
    this.thirdEmitter.emit = true;
    this.thirdEmitter.setPosition(this.point2.x, this.point2.y);
    console.log("✅ Третий перелет частиц запущен (point2 -> point4)");
  }
  
  stopThirdFly() {
    this.isThirdFlying = false;
    this.flyProgress3 = 0;
    if (this.thirdEmitter) {
      this.thirdEmitter.emit = false;
      // Не очищаем сразу - устанавливаем таймер на 0.3 секунды
      this.clearDelayTimer3 = this.clearDelayTime;
    }
    console.log("✅ Третий перелет частиц остановлен, очистка через 0.3 сек");
  }
  
  clearThirdEmitter() {
    if (this.thirdEmitter) {
      this.thirdEmitter.clear();
      this.thirdEmitter.setPosition(this.point2.x, this.point2.y);
    }
    this.clearDelayTimer3 = 0;
  }
  
  update(deltaTime) {
    if (!this.particleEmitter || !this.point1 || !this.point2) return;
    
    // Обновление эмитеров
    this.particleEmitter.update(deltaTime);
    if (this.secondEmitter) {
      this.secondEmitter.update(deltaTime);
    }
    if (this.thirdEmitter) {
      this.thirdEmitter.update(deltaTime);
    }
    
    // Обработка задержки перед очисткой частиц первого перелета
    if (this.clearDelayTimer1 > 0) {
      this.clearDelayTimer1 -= deltaTime;
      if (this.clearDelayTimer1 <= 0) {
        this.clearFirstEmitter();
      }
    }
    
    // Обработка задержки перед очисткой частиц второго перелета
    if (this.clearDelayTimer2 > 0) {
      this.clearDelayTimer2 -= deltaTime;
      if (this.clearDelayTimer2 <= 0) {
        this.clearSecondEmitter();
      }
    }
    
    // Обработка задержки перед очисткой частиц третьего перелета
    if (this.clearDelayTimer3 > 0) {
      this.clearDelayTimer3 -= deltaTime;
      if (this.clearDelayTimer3 <= 0) {
        this.clearThirdEmitter();
      }
    }
    
    // Логика первого перелета между точками point1 -> point2
    if (this.isFlying) {
      this.flyProgress += deltaTime;
      const t = Math.min(this.flyProgress / this.flyDuration, 1);
      
      // Базовые координаты (линейная интерполяция)
      const baseX = this.point1.x + (this.point2.x - this.point1.x) * t;
      const baseY = this.point1.y + (this.point2.y - this.point1.y) * t;
      
      // Вычисляем вектор направления от точки 1 к точке 2
      const dx = this.point2.x - this.point1.x;
      const dy = this.point2.y - this.point1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        // Нормализуем вектор направления
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Перпендикулярный вектор (повернутый на 90 градусов)
        const perpX = -dirY;
        const perpY = dirX;
        
        // Высота дуги в пикселях
        const arcHeight = 100;
        
        // Параболическая функция для высоты дуги
        const arcProgress = -4 * arcHeight * t * (t - 1);
        
        // Отклоняемся по перпендикуляру на высоту дуги
        const currentX = baseX + perpX * arcProgress;
        const currentY = baseY + perpY * arcProgress;
        
        this.particleEmitter.setPosition(currentX, currentY);
      }
      
      // Если перелет завершен
      if (t >= 1) {
        this.stopFly();
        this.playBoomAnimation();
      }
    } else {
      // Если не летит, эмитер следует за точкой 1
      this.particleEmitter.setPosition(this.point1.x, this.point1.y);
    }
    
    // Логика второго перелета между точками point2 -> point3
    if (this.isSecondFlying && this.secondEmitter && this.point2 && this.point3) {
      this.flyProgress2 += deltaTime;
      const t2 = Math.min(this.flyProgress2 / this.flyDuration, 1);
      
      // Базовые координаты (линейная интерполяция)
      const baseX2 = this.point2.x + (this.point3.x - this.point2.x) * t2;
      const baseY2 = this.point2.y + (this.point3.y - this.point2.y) * t2;
      
      // Вычисляем вектор направления от точки 2 к точке 3
      const dx2 = this.point3.x - this.point2.x;
      const dy2 = this.point3.y - this.point2.y;
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      if (distance2 > 0) {
        // Нормализуем вектор направления
        const dirX2 = dx2 / distance2;
        const dirY2 = dy2 / distance2;
        
        // Перпендикулярный вектор (повернутый на 90 градусов)
        const perpX2 = -dirY2;
        const perpY2 = dirX2;
        
        // Высота дуги в пикселях
        const arcHeight2 = 100;
        
        // Параболическая функция для высоты дуги
        const arcProgress2 = -4 * arcHeight2 * t2 * (t2 - 1);
        
        // Отклоняемся по перпендикуляру на высоту дуги
        const currentX2 = baseX2 + perpX2 * arcProgress2;
        const currentY2 = baseY2 + perpY2 * arcProgress2;
        
        this.secondEmitter.setPosition(currentX2, currentY2);
      }
      
      // Если второй перелет завершен
      if (t2 >= 1) {
        this.stopSecondFly();
        this.playSecondBoomAnimation(); // Запускаем boom анимацию для второго перелета
      }
    }
    
    // Логика третьего перелета между точками point2 -> point4
    if (this.isThirdFlying && this.thirdEmitter && this.point2 && this.point4) {
      this.flyProgress3 += deltaTime;
      const t3 = Math.min(this.flyProgress3 / this.flyDuration, 1);
      
      // Базовые координаты (линейная интерполяция)
      const baseX3 = this.point2.x + (this.point4.x - this.point2.x) * t3;
      const baseY3 = this.point2.y + (this.point4.y - this.point2.y) * t3;
      
      // Вычисляем вектор направления от точки 2 к точке 4
      const dx3 = this.point4.x - this.point2.x;
      const dy3 = this.point4.y - this.point2.y;
      const distance3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
      
      if (distance3 > 0) {
        // Нормализуем вектор направления
        const dirX3 = dx3 / distance3;
        const dirY3 = dy3 / distance3;
        
        // Перпендикулярный вектор (повернутый на 90 градусов)
        const perpX3 = -dirY3;
        const perpY3 = dirX3;
        
        // Высота дуги в пикселях
        const arcHeight3 = 100;
        
        // Параболическая функция для высоты дуги
        const arcProgress3 = -4 * arcHeight3 * t3 * (t3 - 1);
        
        // Отклоняемся по перпендикуляру на высоту дуги
        const currentX3 = baseX3 + perpX3 * arcProgress3;
        const currentY3 = baseY3 + perpY3 * arcProgress3;
        
        this.thirdEmitter.setPosition(currentX3, currentY3);
      }
      
      // Если третий перелет завершен
      if (t3 >= 1) {
        this.stopThirdFly();
        this.playThirdBoomAnimation(); // Запускаем boom анимацию для третьего перелета
      }
    }
  }
  
  playBoomAnimation() {
    if (!this.boomSpine || !this.point2) return;
    
    // Запускаем сюжет одновременно с boom анимацией
    if (this.storyController) {
      this.storyController.playStory();
    }
    
    // Позиционируем boom в точке приземления
    this.boomSpine.x = this.point2.x;
    this.boomSpine.y = this.point2.y;
    this.boomSpine.visible = true;
    
    // Название анимации из skeleton.json
    const animName = "animation";
    
    this.boomSpine.state.setAnimation(0, animName, false);
    
    // Очищаем предыдущие слушатели и добавляем новый
    this.boomSpine.state.clearListeners();
    this.boomSpine.state.addListener({
      complete: (entry) => {
        if (entry.trackIndex === 0 && entry.animation.name === animName) {
          this.boomSpine.visible = false;
          console.log("✅ Boom анимация завершена");
        }
      }
    });
    
    console.log(`✅ Boom анимация '${animName}' запущена в точке приземления`);
  }
  
  playSecondBoomAnimation() {
    if (!this.boomSpine2 || !this.point3) return;
    
    // Позиционируем второй boom в точке приземления (point3)
    this.boomSpine2.x = this.point3.x;
    this.boomSpine2.y = this.point3.y;
    this.boomSpine2.visible = true;
    
    // Название анимации из skeleton.json
    const animName = "animation";
    
    this.boomSpine2.state.setAnimation(0, animName, false);
    
    // Очищаем предыдущие слушатели и добавляем новый
    this.boomSpine2.state.clearListeners();
    this.boomSpine2.state.addListener({
      complete: (entry) => {
        if (entry.trackIndex === 0 && entry.animation.name === animName) {
          this.boomSpine2.visible = false;
          console.log("✅ Boom анимация (второй перелет) завершена");
        }
      }
    });
    
    console.log(`✅ Boom анимация '${animName}' (второй перелет) запущена в точке приземления`);
  }
  
  playThirdBoomAnimation() {
    if (!this.boomSpine3 || !this.point4) return;
    
    // Позиционируем третий boom в точке приземления (point4)
    this.boomSpine3.x = this.point4.x;
    this.boomSpine3.y = this.point4.y;
    this.boomSpine3.visible = true;
    
    // Название анимации из skeleton.json
    const animName = "animation";
    
    this.boomSpine3.state.setAnimation(0, animName, false);
    
    // Очищаем предыдущие слушатели и добавляем новый
    this.boomSpine3.state.clearListeners();
    this.boomSpine3.state.addListener({
      complete: (entry) => {
        if (entry.trackIndex === 0 && entry.animation.name === animName) {
          this.boomSpine3.visible = false;
          console.log("✅ Boom анимация (третий перелет) завершена");
        }
      }
    });
    
    console.log(`✅ Boom анимация '${animName}' (третий перелет) запущена в точке приземления`);
  }
  
  // Позиции точек теперь управляются через DebugPositionEditor
  // Метод оставлен для совместимости, но не обновляет позиции
  updatePositions() {
    // Позиции точек управляются через DebugPositionEditor
    // Ничего не делаем здесь
  }
}

/**
 * Простой эмитер частиц
 */
class SimpleParticleEmitter {
  constructor(container, texture, config = {}) {
    this.container = container;
    this.texture = texture;
    this.particles = [];
    this.config = {
      frequency: config.frequency || 0.003,
      lifetime: { min: config.lifetime?.min || 0.2, max: config.lifetime?.max || 0.2 },
      scale: { start: config.scale?.start || 0.6, end: config.scale?.end || 0.2 },
      speed: { start: config.speed?.start || 0, end: config.speed?.end || 0 },
      rotationSpeed: { min: config.rotationSpeed?.min || 0, max: config.rotationSpeed?.max || 0 },
      alpha: { start: config.alpha?.start || 1, end: config.alpha?.end || 1 },
      maxParticles: config.maxParticles || 2000,
    };
    this.x = 0;
    this.y = 0;
    this.emit = false;
    this.emissionTimer = 0;
  }
  
  createParticle() {
    let particle = this.particles.find(p => !p.active);
    if (!particle) {
      const sprite = new PIXI.Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      this.container.addChild(sprite);
      particle = { sprite, active: false };
      this.particles.push(particle);
    }
    particle.active = true;
    particle.x = this.x;
    particle.y = this.y;
    const speed = this.config.speed.start + Math.random() * (this.config.speed.end - this.config.speed.start);
    const angle = Math.random() * Math.PI * 2;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.lifetime = 0;
    particle.maxLifetime = this.config.lifetime.min + Math.random() * (this.config.lifetime.max - this.config.lifetime.min);
    particle.rotationSpeed = this.config.rotationSpeed.min + Math.random() * (this.config.rotationSpeed.max - this.config.rotationSpeed.min);
    particle.scaleStart = this.config.scale.start;
    particle.scaleEnd = this.config.scale.end;
    particle.alphaStart = this.config.alpha.start;
    particle.alphaEnd = this.config.alpha.end;
    particle.sprite.x = particle.x;
    particle.sprite.y = particle.y;
    particle.sprite.rotation = Math.random() * Math.PI * 2;
    particle.sprite.scale.set(particle.scaleStart);
    particle.sprite.alpha = particle.alphaStart;
    particle.sprite.visible = true;
    return particle;
  }
  
  updateParticle(particle, deltaTime) {
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.lifetime += deltaTime;
    const lifeProgress = particle.lifetime / particle.maxLifetime;
    if (lifeProgress >= 1) {
      particle.active = false;
      particle.sprite.visible = false;
      return;
    }
    particle.sprite.x = particle.x;
    particle.sprite.y = particle.y;
    particle.sprite.rotation += particle.rotationSpeed * deltaTime;
    const scale = particle.scaleStart + (particle.scaleEnd - particle.scaleStart) * lifeProgress;
    const alpha = particle.alphaStart + (particle.alphaEnd - particle.alphaStart) * lifeProgress;
    particle.sprite.scale.set(scale);
    particle.sprite.alpha = alpha;
  }
  
  update(deltaTime) {
    if (this.emit) {
      this.emissionTimer += deltaTime;
      const activeCount = this.particles.filter(p => p.active).length;
      if (this.emissionTimer >= this.config.frequency && activeCount < this.config.maxParticles) {
        this.createParticle();
        this.emissionTimer = 0;
      }
    }
    for (const particle of this.particles) {
      if (particle.active) {
        this.updateParticle(particle, deltaTime);
      }
    }
  }
  
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  
  clear() {
    for (const particle of this.particles) {
      particle.active = false;
      if (particle.sprite) {
        particle.sprite.visible = false;
      }
    }
  }
}
