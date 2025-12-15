/**
 * Генератор текста с шрифтом Aclonica для монет
 * Создает текстуры из текста с белым цветом и фиолетовой обводкой
 */
export class AclonicaText {
  constructor() {
    this.cache = new Map(); // Кеш текстур для оптимизации
  }

  /**
   * Ждет загрузки шрифта Aclonica из Google Fonts
   * Очищает кеш перед загрузкой, чтобы не использовать старые текстуры
   * @returns {Promise<void>}
   */
  async loadFont() {
    // Очищаем кеш, чтобы не использовать старые текстуры с неправильным шрифтом
    this.clearCache();
    
    // Явно загружаем шрифт через Font Loading API
    try {
      await document.fonts.load('400 45px "Aclonica"');
    } catch (e) {
      console.warn('AclonicaText: Ошибка при явной загрузке шрифта:', e);
    }
    
    // Ждем готовности всех шрифтов
    await document.fonts.ready;
    
    // Проверяем загрузку в цикле с таймаутом (более надежно)
    const maxAttempts = 50; // 5 секунд максимум (50 * 100ms)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const isLoaded = document.fonts.check('400 45px "Aclonica"');
      if (isLoaded) {
        console.log('AclonicaText: Шрифт загружен и проверен, попытка:', attempts + 1);
        
        // "Активируем" шрифт для Canvas - создаем временный элемент с шрифтом
        // Это помогает Canvas "увидеть" загруженный шрифт
        const activator = document.createElement('div');
        activator.style.fontFamily = 'Aclonica';
        activator.style.fontSize = '45px';
        activator.style.position = 'absolute';
        activator.style.visibility = 'hidden';
        activator.style.left = '-9999px';
        activator.textContent = '100';
        document.body.appendChild(activator);
        
        // Ждем несколько кадров для надежности
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        document.body.removeChild(activator);
        
        // Финальная проверка
        const finalCheck = document.fonts.check('400 45px "Aclonica"');
        console.log('AclonicaText: Финальная проверка шрифта:', finalCheck);
        return;
      }
      
      // Ждем 100ms перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    console.warn('AclonicaText: Шрифт не загрузился за отведенное время, будет использован fallback');
  }
  
  /**
   * Создает текст с шрифтом Aclonica
   * @param {string} text - Текст для отрисовки
   * @param {object} options - Настройки стиля
   * @returns {PIXI.Sprite} Спрайт с текстом
   */
  createText(text, options = {}) {
    const {
      fontSize = 45,
      padding = 10,
      useCache = true,
      color = '#FFFFFF',
      borderColor = '#6B0060',
      borderWidth = 4,
      lineHeight = 52
    } = options;
    
    const cacheKey = `aclonica_${text}_${fontSize}_${padding}_${color}_${borderColor}`;
    
    // Проверяем кеш
    if (useCache && this.cache.has(cacheKey)) {
      const cachedTexture = this.cache.get(cacheKey);
      return new PIXI.Sprite(cachedTexture);
    }
    
    // Создаем canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Настройка шрифта Aclonica
    // В Canvas font синтаксис: [font-style] [font-weight] font-size font-family
    // Явно указываем font-weight 400 для Regular версии
    // Добавляем fallback для надежности (если Aclonica не загрузился)
    ctx.font = `400 ${fontSize}px "Aclonica", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Измеряем текст
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = lineHeight;
    
    // Размеры canvas с учетом обводки и отступов
    const extraWidth = borderWidth * 2 + padding * 2;
    const extraHeight = borderWidth * 2 + padding * 2;
    
    canvas.width = textWidth + extraWidth;
    canvas.height = textHeight + extraHeight;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Переустанавливаем шрифт после изменения размера canvas
    ctx.font = `400 ${fontSize}px "Aclonica", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Правильный порядок для текста с обводкой в Canvas:
    // Сначала stroke (обводка), затем fill (заливка) - это создаст обводку вокруг текста
    // Обводка рисуется по контуру, заливка заполняет внутреннюю часть
    
    // Фиолетовая обводка
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 10;
    ctx.strokeText(text, centerX, centerY);
    
    // Белая заливка текста (поверх обводки, заполняет внутреннюю часть)
    ctx.fillStyle = color;
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
   * Создает текстуру монетки с текстом поверх базовой текстуры
   * @param {PIXI.Texture} coinTexture - Базовая текстура монетки (regular_coin_empty.png)
   * @param {string} value - Значение для отображения (например, "5.00")
   * @param {object} options - Настройки стиля текста
   * @returns {Promise<PIXI.Texture>} Новая текстура с текстом
   */
  async createCoinTextureWithText(coinTexture, value = '5.00', options = {}) {
    const {
      fontSize = 45,
      color = '#FFFFFF',
      borderColor = '#6B0060',
      borderWidth = 4
    } = options;

    // Получаем source базовой текстуры
    const baseTexture = coinTexture.baseTexture;
    const resource = baseTexture.resource;
    
    // Создаем canvas такого же размера как текстура монетки
    const canvas = document.createElement('canvas');
    canvas.width = coinTexture.width;
    canvas.height = coinTexture.height;
    const ctx = canvas.getContext('2d');

    // Создаем временный Image элемент для загрузки текстуры
    return new Promise((resolve) => {
      const img = new Image();
      
      // Используем источник текстуры
      if (resource.source instanceof HTMLImageElement) {
        img.src = resource.source.src;
      } else if (resource.source instanceof HTMLCanvasElement) {
        img.src = resource.source.toDataURL();
      } else if (resource.url) {
        img.src = resource.url;
      } else {
        // Если не можем получить источник, используем оригинальную текстуру
        console.warn('AclonicaText: Не удалось получить источник текстуры монетки');
        resolve(coinTexture);
        return;
      }

      img.onload = () => {
        // Рисуем базовую текстуру монетки
        ctx.drawImage(img, 0, 0);
        
        // Рисуем текст поверх
        ctx.font = `400 ${fontSize}px "Aclonica", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Обводка
        ctx.strokeText(value, centerX, centerY);
        // Заливка
        ctx.fillText(value, centerX, centerY);
        
        // Создаем текстуру PixiJS
        const texture = PIXI.Texture.from(canvas);
        resolve(texture);
      };
      
      img.onerror = () => {
        console.warn('AclonicaText: Ошибка загрузки текстуры монетки, используем оригинал');
        resolve(coinTexture);
      };
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

