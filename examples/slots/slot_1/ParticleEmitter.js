// Кастомный эмиттер фонтана монет
export class CustomCoinEmitter {
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
  
  // Создание новой частицы
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
  
  // Обновление частицы
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
  
  // Обновление эмиттера
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
  
  // Установка позиции эмиттера
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  
  // Установка угла направления эмиттера
  setAngle(angle) {
    this.angle = angle;
  }
  
  // Установка позиции и угла одновременно
  setPositionAndAngle(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }
  
  // Установка частоты эмиссии (чем меньше значение, тем чаще эмиссия)
  setEmissionRate(rate) {
    this.emissionRate = rate;
  }
  
  // Установка разброса угла (spread) в градусах
  setSpread(spread) {
    this.config.spread = spread;
  }
  
  // Взрыв частиц (burst)
  burst(count = 40) {
    for (let i = 0; i < count; i++) {
      if (this.particles.filter(p => p.active).length < this.config.maxParticles) {
        this.createParticle();
      }
    }
  }
  
  // Очистка всех частиц
  clear() {
    for (const particle of this.particles) {
      particle.active = false;
      if (particle.sprite) {
        particle.sprite.visible = false;
      }
    }
  }
  
  // Уничтожение эмиттера
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

