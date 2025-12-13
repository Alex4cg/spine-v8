/**
 * Генератор золотого 3D текста для выигрышей
 * Создает текстуры из текста с градиентами, обводками и тенями
 * Используется для отображения сумм выигрышей
 */
export class MiniWinText {
  constructor() {
    this.cache = new Map(); // Кеш текстур для оптимизации
  }
  
  /**
   * Создает золотой 3D текст с эффектами
   * @param {string} text - Текст для отрисовки
   * @param {object} options - Настройки стиля
   * @returns {PIXI.Sprite} Спрайт с текстом
   */
  createGolden3DText(text, options = {}) {
    const {
      fontSize = 72,
      padding = 30,
      useCache = true
    } = options;
    
    const cacheKey = `golden_${text}_${fontSize}_${padding}`;
    
    // Проверяем кеш
    if (useCache && this.cache.has(cacheKey)) {
      const cachedTexture = this.cache.get(cacheKey);
      return new PIXI.Sprite(cachedTexture);
    }
    
    // Создаем canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Настройка шрифта Montserrat Extra Bold (font-weight: 800 из Figma)
    // Используем fallback на Arial Black, если Montserrat не загружен
    ctx.font = `800 ${fontSize}px "Montserrat", "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Letter spacing из Figma (0.03em) - применяется через изменение текста
    // Но для простоты оставляем как есть, или можно реализовать отдельную отрисовку символов
    
    // Измеряем текст
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    // Размеры canvas с учетом всех эффектов из Figma
    // Фиолетовая обводка: 3px
    // Размытая тень: blur 11.3361px, offset 8.50204px
    const strokeWidth = 3; // Фиолетовая обводка из Figma
    const shadowBlur = 11.3361;
    const shadowOffsetY = 8.50204;
    
    // Размер canvas с учетом эффектов и отступов
    const extraWidth = strokeWidth * 2 + padding * 2 + shadowBlur * 2;
    const extraHeight = strokeWidth * 2 + padding * 2 + shadowBlur * 2 + shadowOffsetY;
    
    canvas.width = textWidth + extraWidth;
    canvas.height = textHeight + extraHeight;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Переустанавливаем шрифт после изменения размера canvas
    ctx.font = `800 ${fontSize}px "Montserrat", "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 1. Размытая тень из Figma
    // text-shadow: 0px 8.50204px 11.3361px rgba(45, 7, 0, 0.64)
    ctx.shadowColor = 'rgba(45, 7, 0, 0.64)';
    ctx.shadowBlur = 11.3361;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8.50204;
    
    // Временная заливка для размытой тени
    ctx.fillStyle = '#FFE8AA';
    ctx.fillText(text, centerX, centerY);
    
    // Сбрасываем тень для следующих слоев
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // 2. Фиолетовая обводка из Figma
    // text-shadow: 0px 3px 0px #91009E (смещение вниз на 3px)
    ctx.strokeStyle = '#91009E'; // Фиолетовый цвет из Figma
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Рисуем фиолетовую обводку со смещением вниз на 3px (эффект тени сверху)
    ctx.strokeText(text, centerX, centerY + 3);
    
    // 3. Градиент из Figma (180deg = сверху вниз)
    // linear-gradient(180deg, #FFE8AA 19.44%, #FFFE18 46.94%, #FF7700 85.44%)
    const gradient = ctx.createLinearGradient(
      centerX, centerY - textHeight / 2,  // Верх (начало градиента)
      centerX, centerY + textHeight / 2   // Низ (конец градиента)
    );
    
    // Точные цвета и позиции из Figma
    gradient.addColorStop(0.1944, '#FFE8AA');   // 19.44% - светло-желтый
    gradient.addColorStop(0.4694, '#FFFE18');   // 46.94% - ярко-желтый
    gradient.addColorStop(0.8544, '#FF7700');   // 85.44% - оранжевый
    
    ctx.fillStyle = gradient;
    ctx.fillText(text, centerX, centerY);
    
    // Преобразуем canvas в текстуру PixiJS
    const texture = PIXI.Texture.from(canvas);
    
    // Сохраняем в кеш
    if (useCache) {
      this.cache.set(cacheKey, texture);
    }
    
    return new PIXI.Sprite(texture);
  }
  
  /**
   * Создает анимированный золотой текст (для выигрышей)
   * @param {number|string} value - Значение для отображения
   * @param {object} position - Позиция {x, y}
   * @param {object} options - Опции стиля
   * @returns {PIXI.Sprite} Спрайт готовый к анимации
   */
  createAnimatedGoldenText(value, position, options = {}) {
    const textValue = typeof value === 'number' ? value.toFixed(2) : value;
    const sprite = this.createGolden3DText(textValue, options);
    
    sprite.x = position.x;
    sprite.y = position.y;
    sprite.anchor.set(0.5); // Центрирование
    
    // Начальное состояние для анимации
    sprite.scale.set(0);
    sprite.alpha = 0;
    sprite.rotation = 0;
    
    return sprite;
  }
  
  /**
   * Обновляет текст существующего спрайта (создает новую текстуру)
   * @param {PIXI.Sprite} sprite - Существующий спрайт
   * @param {string} newText - Новый текст
   * @param {object} options - Опции стиля
   */
  updateText(sprite, newText, options = {}) {
    const newSprite = this.createGolden3DText(newText, options);
    sprite.texture = newSprite.texture;
    // Размеры могут измениться, но позиция остается
  }
  
  /**
   * Анимирует счетчик от начального значения к конечному
   * @param {PIXI.Sprite} sprite - Спрайт текста для обновления
   * @param {number} fromValue - Начальное значение
   * @param {number} toValue - Конечное значение
   * @param {number} duration - Длительность в миллисекундах
   * @param {object} options - Опции стиля и easing
   * @returns {Promise} Промис, который резолвится по завершении
   */
  animateCounter(sprite, fromValue, toValue, duration, options = {}) {
    return new Promise((resolve) => {
      const {
        decimals = 2, // Количество знаков после запятой
        easing = 'easeOutCubic', // Функция плавности
        onUpdate = null, // Callback при каждом обновлении
        textOptions = {} // Опции для updateText
      } = options;
      
      const startTime = Date.now();
      const valueRange = toValue - fromValue;
      
      // Easing функции
      const easingFunctions = {
        linear: (t) => t,
        easeInQuad: (t) => t * t,
        easeOutQuad: (t) => t * (2 - t),
        easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: (t) => t * t * t,
        easeOutCubic: (t) => --t * t * t + 1,
        easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeOutBack: (t) => {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }
      };
      
      const ease = easingFunctions[easing] || easingFunctions.easeOutCubic;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = ease(progress);
        
        // Вычисляем текущее значение
        const currentValue = fromValue + valueRange * easedProgress;
        
        // Обновляем текст (каждый кадр)
        this.updateText(sprite, currentValue.toFixed(decimals), textOptions);
        
        // Callback при обновлении
        if (onUpdate) {
          onUpdate(currentValue, progress);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Анимация завершена, устанавливаем финальное значение
          this.updateText(sprite, toValue.toFixed(decimals), textOptions);
          if (onUpdate) {
            onUpdate(toValue, 1);
          }
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }
  
  /**
   * Очищает кеш текстур
   */
  clearCache() {
    this.cache.forEach(texture => {
      if (texture && !texture.baseTexture.destroyed) {
        texture.destroy();
      }
    });
    this.cache.clear();
  }
}

