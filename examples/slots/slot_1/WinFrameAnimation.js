export class WinFrameAnimation {
  constructor(config, app, container) {
    this.config = config;
    this.app = app;
    this.container = container;
    this.atlas = null;
    this.textures = [];
    this.spritePool = {}; // Пул спрайтов: { "reelIndex_positionIndex": sprite }
    this.isPlaying = false;
  }
  
  // Маппинг линий на позиции [reelIndex, positionIndex]
  // positionIndex: 0 = второй ряд (активная линия 1), 1 = третий ряд (активная линия 2), 2 = четвертый ряд (активная линия 3)
  // Активные символы начинаются со второго ряда (первый ряд - только для движения)
  static LINE_POSITIONS = {
    1: [[0, 0], [1, 0], [2, 0]], // Нижняя горизонталь (второй ряд)
    2: [[0, 1], [1, 1], [2, 1]], // Средняя горизонталь (третий ряд)
    3: [[0, 2], [1, 2], [2, 2]], // Верхняя горизонталь (четвертый ряд)
    4: [[0, 0], [1, 1], [2, 2]], // Диагональ снизу-вверх
    5: [[0, 2], [1, 1], [2, 0]]  // Диагональ сверху-вниз
  };
  
  async loadAtlas() {
    const atlasPath = this.config.winFrameAnimation.atlasPath;
    this.atlas = await PIXI.Assets.load(atlasPath);
    
    // Извлекаем текстуры в правильном порядке (00.png - 59.png)
    for (let i = 0; i < this.config.winFrameAnimation.frameCount; i++) {
      const frameName = String(i).padStart(2, '0') + '.png';
      if (this.atlas.textures[frameName]) {
        this.textures.push(this.atlas.textures[frameName]);
      }
    }
    
    if (this.textures.length === 0) {
      console.warn('WinFrame: No textures found in atlas');
      return;
    }
    
    console.log(`WinFrame: Loaded ${this.textures.length} textures`);
  }
  
  /**
   * Создает пул спрайтов со статичными позициями относительно игрового поля
   * Активные символы начинаются со второго ряда (positionIndex 0 = второй ряд)
   */
  createSpritePool(reels) {
    if (this.textures.length === 0) {
      console.warn('WinFrame: Cannot create sprite pool - textures not loaded');
      return;
    }
    
    // Очищаем старый пул
    this.destroySpritePool();
    
    const numReels = this.config.reels.count; // 3 рила
    const numPositions = 3; // Активные позиции: 0, 1, 2 (второй, третий, четвертый ряды)
    
    // Позиция начала игрового поля
    const startX = this.config.startPosition.x;
    const startY = this.config.startPosition.y;
    const symbolWidth = this.config.symbolSize.width;
    const symbolHeight = this.config.symbolSize.height;
    
    // Создаем спрайт для каждой позиции со статичными координатами
    for (let reelIndex = 0; reelIndex < numReels; reelIndex++) {
      for (let positionIndex = 0; positionIndex < numPositions; positionIndex++) {
        const key = `${reelIndex}_${positionIndex}`;
        
        const sprite = new PIXI.AnimatedSprite(this.textures);
        sprite.animationSpeed = 1.0; // 60 fps
        sprite.loop = false; // ОДИН ЦИКЛ - не зациклено!
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        sprite.zIndex = 110; // Над символами (символы zIndex = 100)
        sprite.visible = false;
        sprite.stop();
        
        // Статичная позиция относительно игрового поля
        // positionIndex: 0 = второй ряд (активная линия 1), 1 = третий ряд (активная линия 2), 2 = четвертый ряд (активная линия 3)
        // Если винфреймы на ячейку ниже, значит startY уже указывает на второй ряд или выше
        // Используем positionIndex напрямую (без +1)
        const actualRowIndex = positionIndex; // 0, 1, 2 (второй, третий, четвертый ряды, если startY на втором ряду)
        
        sprite.x = startX + (reelIndex * symbolWidth) + (symbolWidth / 2);
        sprite.y = startY + (actualRowIndex * symbolHeight) + (symbolHeight / 2);
        
        this.container.addChild(sprite);
        this.spritePool[key] = sprite;
      }
    }
    
    console.log(`WinFrame: Created sprite pool with ${Object.keys(this.spritePool).length} sprites at static positions`);
  }
  
  /**
   * Обновляет позиции всех спрайтов (теперь не нужно - позиции статичные)
   * Оставляем для совместимости, но не обновляем позиции
   */
  updateSpritePositions(reels) {
    // Позиции статичные относительно игрового поля, обновление не требуется
    // Метод оставлен для совместимости
  }
  
  /**
   * Показывает winframes для конкретной линии (один цикл)
   * @param {Array} reels - массив рилов (используется только для создания пула при первом вызове)
   * @param {number} lineNumber - номер линии (1-5)
   */
  playOnLine(reels, lineNumber) {
    // Создаем пул если еще не создан (теперь создаем со статичными позициями)
    if (Object.keys(this.spritePool).length === 0) {
      this.createSpritePool(reels);
    }
    // Больше не обновляем позиции - они статичные относительно игрового поля
    
    const positions = WinFrameAnimation.LINE_POSITIONS[lineNumber];
    if (!positions) {
      console.warn(`WinFrame: Unknown line number ${lineNumber}`);
      return;
    }
    
    // Скрываем все спрайты
    this.hideAllSprites();
    
    // Показываем спрайты для этой линии (один цикл)
    positions.forEach(([reelIndex, positionIndex]) => {
      const key = `${reelIndex}_${positionIndex}`;
      const sprite = this.spritePool[key];
      
      if (sprite) {
        sprite.visible = true;
        sprite.loop = false; // Один цикл
        sprite.gotoAndPlay(0);
      }
    });
    
    this.isPlaying = true;
    console.log(`WinFrame: Playing one cycle on line ${lineNumber}`);
  }
  
  /**
   * Показывает winframes для нескольких линий одновременно (один цикл)
   * @param {Array} reels - массив рилов (используется только для создания пула при первом вызове)
   * @param {Array<number>} lineNumbers - массив номеров линий (1-5)
   */
  playOnLines(reels, lineNumbers) {
    if (!lineNumbers || lineNumbers.length === 0) {
      console.warn('WinFrame: Invalid parameters');
      return;
    }
    
    // Создаем пул если еще не создан (теперь создаем со статичными позициями)
    if (Object.keys(this.spritePool).length === 0) {
      this.createSpritePool(reels);
    }
    // Больше не обновляем позиции - они статичные относительно игрового поля
    
    // Скрываем все спрайты
    this.hideAllSprites();
    
    // Собираем все позиции для всех линий (без дубликатов)
    const allPositions = new Set();
    lineNumbers.forEach(lineNumber => {
      const positions = WinFrameAnimation.LINE_POSITIONS[lineNumber];
      if (positions) {
        positions.forEach(pos => {
          allPositions.add(`${pos[0]}_${pos[1]}`);
        });
      }
    });
    
    // Показываем спрайты для всех позиций (один цикл)
    allPositions.forEach(key => {
      const sprite = this.spritePool[key];
      if (sprite) {
        sprite.visible = true;
        sprite.loop = false; // Один цикл
        sprite.gotoAndPlay(0);
      }
    });
    
    this.isPlaying = true;
    console.log(`WinFrame: Playing one cycle on lines ${lineNumbers.join(', ')}`);
  }
  
  /**
   * Скрывает все спрайты
   */
  hideAllSprites() {
    Object.values(this.spritePool).forEach(sprite => {
      sprite.visible = false;
      sprite.stop();
    });
  }
  
  /**
   * Останавливает и скрывает все winframes
   */
  stop() {
    this.hideAllSprites();
    this.isPlaying = false;
  }
  
  /**
   * Уничтожает пул спрайтов
   */
  destroySpritePool() {
    Object.values(this.spritePool).forEach(sprite => {
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy();
    });
    this.spritePool = {};
  }
  
  // Старый метод - оставляем для совместимости, но не используем
  playOnRandomSymbols(reels) {
    console.warn('WinFrame: playOnRandomSymbols is deprecated, use playOnLines() instead');
    // Можно оставить старую логику для обратной совместимости, но лучше не использовать
  }
  
  createAnimatedSprite() {
    // Устаревший метод, не используется
    console.warn('WinFrame: createAnimatedSprite is deprecated');
  }
}
