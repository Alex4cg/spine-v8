/**
 * Кастомный эмиттер фонтана монет для PIXI.js
 * 
 * Класс для создания эффекта фонтана монет с физикой гравитации,
 * анимацией текстур и поддержкой привязки к костям Spine.
 * 
 * @class CustomCoinEmitter
 */
class CustomCoinEmitter {
  /**
   * Создает новый эмиттер монет
   * 
   * @param {PIXI.Container} container - Контейнер PIXI для частиц
   * @param {PIXI.Texture[]} textures - Массив текстур монет (17 кадров: 00-16)
   * @param {Object} config - Конфигурация эмиттера
   * @param {number} config.startSpeed - Начальная скорость частиц (по умолчанию: 450)
   * @param {number} config.gravity - Гравитация вниз в пикселях/сек² (по умолчанию: 900)
   * @param {number} config.spread - Разброс угла в градусах (по умолчанию: 30)
   * @param {number} config.lifetimeMin - Минимальное время жизни частицы в секундах (по умолчанию: 1.2)
   * @param {number} config.lifetimeMax - Максимальное время жизни частицы в секундах (по умолчанию: 1.6)
   * @param {number} config.scaleStart - Начальный масштаб частицы (по умолчанию: 1)
   * @param {number} config.scaleEnd - Конечный масштаб частицы (по умолчанию: 0.5)
   * @param {number} config.rotationSpeedMin - Минимальная скорость вращения (по умолчанию: -5)
   * @param {number} config.rotationSpeedMax - Максимальная скорость вращения (по умолчанию: 5)
   * @param {number} config.animationSpeed - Скорость анимации текстуры в кадрах/сек (по умолчанию: 30)
   * @param {number} config.maxParticles - Максимальное количество частиц (по умолчанию: 500)
   * @param {number} config.emissionRate - Частота эмиссии в секундах (по умолчанию: 0.02)
   * @param {number} config.x - Начальная позиция X (по умолчанию: 0)
   * @param {number} config.y - Начальная позиция Y (по умолчанию: 0)
   * @param {number} config.angle - Угол направления эмиттера в радианах (по умолчанию: 0)
   */
  constructor(container, textures, config = {}) {
    this.container = container;
    this.textures = textures; // Массив текстур монет (00-16)
    this.particles = [];
    this.activeParticles = [];
    
    // Конфигурация
    this.config = {
      startSpeed: config.startSpeed || 450,      // Начальная скорость вверх
      gravity: config.gravity || 900,              // Гравитация вниз
      spread: config.spread || 30,                 // Разброс угла в градусах
      lifetime: { min: config.lifetimeMin || 1.2, max: config.lifetimeMax || 1.6 },
      scale: { start: config.scaleStart || 1, end: config.scaleEnd || 0.5 },
      rotationSpeed: { min: config.rotationSpeedMin || -5, max: config.rotationSpeedMax || 5 },
      animationSpeed: config.animationSpeed || 30, // Скорость анимации монеты (30 fps = 30 кадров/сек)
      maxParticles: config.maxParticles || 500,
      ...config
    };
    
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.angle = config.angle || 0; // Угол направления эмиттера (в радианах)
    this.emit = false;
    this.emissionTimer = 0;
    this.emissionRate = config.emissionRate || 0.02; // Частота эмиссии
  }
  
  /**
   * Создает новую частицу
   * @returns {Object} Объект частицы
   */
  createParticle() {
    let sprite = null;
    
    // Переиспользуем неактивную частицу или создаем новую
    const inactive = this.particles.find(p => !p.active);
    if (inactive) {
      sprite = inactive.sprite;
      inactive.active = true;
    } else {
      sprite = new PIXI.Sprite(this.textures[0]);
      sprite.anchor.set(0.5);
      this.container.addChild(sprite);
      this.particles.push({ sprite, active: false });
    }
    
    // Инициализация частицы
    const particle = this.particles.find(p => p.sprite === sprite);
    particle.active = true;
    particle.x = this.x;
    particle.y = this.y;
    
    // Учитываем направление эмиттера (угол кости)
    const speed = this.config.startSpeed * (0.8 + Math.random() * 0.4);
    // spread теперь в градусах, конвертируем в радианы и применяем как разброс угла
    const spreadRad = (this.config.spread * Math.PI) / 180; // Конвертируем spread из градусов в радианы
    const spreadAngle = (Math.random() - 0.5) * spreadRad; // Разброс относительно направления
    const emissionAngle = this.angle + spreadAngle;
    
    // Начальная скорость по направлению эмиттера
    particle.vx = Math.sin(emissionAngle) * speed;
    particle.vy = -Math.cos(emissionAngle) * speed; // Отрицательный, т.к. Y растет вниз
    particle.lifetime = 0;
    particle.maxLifetime = this.config.lifetime.min + Math.random() * (this.config.lifetime.max - this.config.lifetime.min);
    particle.rotationSpeed = this.config.rotationSpeed.min + Math.random() * (this.config.rotationSpeed.max - this.config.rotationSpeed.min);
    // Рандомизируем начальный кадр анимации для более естественного вида
    particle.animationFrame = Math.random() * this.textures.length;
    particle.scaleStart = this.config.scale.start;
    particle.scaleEnd = this.config.scale.end;
    
    // Сразу устанавливаем правильную текстуру с учетом начального кадра
    const initialFrameIndex = Math.floor(particle.animationFrame) % this.textures.length;
    sprite.texture = this.textures[initialFrameIndex];
    
    sprite.x = particle.x;
    sprite.y = particle.y;
    sprite.rotation = Math.random() * Math.PI * 2;
    sprite.scale.set(particle.scaleStart);
    sprite.alpha = 1;
    sprite.visible = true;
    
    return particle;
  }
  
  /**
   * Обновляет частицу (физика, анимация, время жизни)
   * @param {Object} particle - Объект частицы
   * @param {number} deltaTime - Время с последнего кадра в секундах
   */
  updateParticle(particle, deltaTime) {
    // Физика
    particle.vy += this.config.gravity * deltaTime;
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    
    // Время жизни
    particle.lifetime += deltaTime;
    const lifeProgress = particle.lifetime / particle.maxLifetime;
    
    if (lifeProgress >= 1) {
      // Частица умерла
      particle.active = false;
      particle.sprite.visible = false;
      return;
    }
    
    // Обновление спрайта
    particle.sprite.x = particle.x;
    particle.sprite.y = particle.y;
    particle.sprite.rotation += particle.rotationSpeed * deltaTime;
    
    // Анимация текстуры монеты (30 fps = 30 кадров в секунду)
    // animationSpeed в кадрах в секунду, умножаем на deltaTime для получения кадров
    particle.animationFrame += this.config.animationSpeed * deltaTime;
    const frameIndex = Math.floor(particle.animationFrame) % this.textures.length;
    particle.sprite.texture = this.textures[frameIndex];
    
    // Масштаб (прозрачность убрана - монеты не затухают)
    const scale = particle.scaleStart + (particle.scaleEnd - particle.scaleStart) * lifeProgress;
    particle.sprite.scale.set(scale);
    particle.sprite.alpha = 1; // Постоянная полная непрозрачность
  }
  
  /**
   * Обновляет эмиттер (создает новые частицы и обновляет существующие)
   * @param {number} deltaTime - Время с последнего кадра в секундах
   */
  update(deltaTime) {
    // Эмиссия новых частиц
    if (this.emit) {
      this.emissionTimer += deltaTime;
      const activeCount = this.particles.filter(p => p.active).length;
      
      if (this.emissionTimer >= this.emissionRate && activeCount < this.config.maxParticles) {
        this.createParticle();
        this.emissionTimer = 0;
      }
    }
    
    // Обновление всех активных частиц
    for (const particle of this.particles) {
      if (particle.active) {
        this.updateParticle(particle, deltaTime);
      }
    }
  }
  
  /**
   * Устанавливает позицию эмиттера
   * @param {number} x - Координата X
   * @param {number} y - Координата Y
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  
  /**
   * Устанавливает угол направления эмиттера
   * @param {number} angle - Угол в радианах
   */
  setAngle(angle) {
    this.angle = angle;
  }
  
  /**
   * Устанавливает позицию и угол одновременно
   * @param {number} x - Координата X
   * @param {number} y - Координата Y
   * @param {number} angle - Угол в радианах
   */
  setPositionAndAngle(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }
  
  /**
   * Устанавливает частоту эмиссии (чем меньше значение, тем чаще эмиссия)
   * @param {number} rate - Интервал между эмиссиями в секундах
   */
  setEmissionRate(rate) {
    this.emissionRate = rate;
  }
  
  /**
   * Устанавливает разброс угла (spread) в градусах
   * @param {number} spread - Разброс в градусах
   */
  setSpread(spread) {
    this.config.spread = spread;
  }
  
  /**
   * Создает взрыв частиц (burst)
   * @param {number} count - Количество частиц для создания (по умолчанию: 40)
   */
  burst(count = 40) {
    for (let i = 0; i < count; i++) {
      if (this.particles.filter(p => p.active).length < this.config.maxParticles) {
        this.createParticle();
      }
    }
  }
  
  /**
   * Очищает все частицы (делает их неактивными)
   */
  clear() {
    for (const particle of this.particles) {
      particle.active = false;
      if (particle.sprite) {
        particle.sprite.visible = false;
      }
    }
  }
  
  /**
   * Уничтожает эмиттер и все его частицы
   */
  destroy() {
    this.clear();
    for (const particle of this.particles) {
      if (particle.sprite) {
        this.container.removeChild(particle.sprite);
        particle.sprite.destroy();
      }
    }
    this.particles = [];
  }
}









