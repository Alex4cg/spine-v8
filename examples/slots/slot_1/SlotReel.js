export class SlotReel {
  constructor(config, reelIndex, container, app, spinOffset = null, totalSymbols = null) {
    this.config = config;
    this.reelIndex = reelIndex;
    this.container = container;
    this.app = app;
    this.symbols = [];
    this.isSpinning = false;
    this.symbolSpacing = this.config.symbolSize.height;
    this.visibleSymbols = config.reels.symbolsPerReel;
    this.totalSymbols = totalSymbols !== null ? Math.max(this.visibleSymbols + 5, totalSymbols) : 40;
    this.animationId = null;
    this.startPositions = [];
    const maxSpinOffset = this.totalSymbols - this.visibleSymbols;
    this.spinOffset = spinOffset !== null ? Math.max(3, Math.min(maxSpinOffset, spinOffset)) : maxSpinOffset;
    this.onSpinComplete = null;
    
    this.init();
  }
  
  init() {
    this.reelContainer = new PIXI.Container();
    this.reelContainer.x = this.config.startPosition.x + 
      this.reelIndex * (this.config.symbolSize.width + this.config.reelSpacing);
    
    // Формула позиции: Y = (totalSymbols - 2 - i) * symbolSpacing
    // Сдвиг вверх на 1 символ, чтобы над верхним видимым был еще один символ (для копирования текстур)
    this.reelContainer.y = this.config.startPosition.y;
    this.reelContainer.visible = true;
    this.reelContainer.renderable = true;
    this.reelContainer.zIndex = 100;
    
    for (let i = 0; i < this.totalSymbols; i++) {
      const textureIndex = Math.floor(Math.random() * this.config.symbolTextures.length);
      const symbolY = (this.totalSymbols - 2 - i) * this.symbolSpacing;
      
      this.startPositions.push(symbolY);
      const symbolNumber = i;
      
      const symbol = this.createSymbol(textureIndex, symbolNumber);
      symbol.y = symbolY;
      symbol.visible = true;
      symbol.renderable = true;
      this.symbols.push(symbol);
      this.reelContainer.addChild(symbol);
    }
    
    this.container.addChild(this.reelContainer);
  }
  
  createSymbol(textureIndex, symbolNumber) {
    const placeholder = new PIXI.Container();
    placeholder.width = this.config.symbolSize.width;
    placeholder.height = this.config.symbolSize.height;
    
    if (this.config.showPlaceholderDebug) {
      const debugFrame = new PIXI.Graphics();
      debugFrame.rect(0, 0, this.config.symbolSize.width, this.config.symbolSize.height);
      debugFrame.stroke({ width: 1, color: 0x00FF00, alpha: 0.3 });
      placeholder.addChild(debugFrame);
    }
    
    if (!this.config.symbolTextures || this.config.symbolTextures.length === 0) {
      console.warn(`Reel ${this.reelIndex}: Textures not loaded, using fallback`);
      const graphics = new PIXI.Graphics();
      graphics.rect(0, 0, this.config.symbolSize.width, this.config.symbolSize.height);
      graphics.fill(0xFF0000);
      placeholder.addChild(graphics);
      placeholder.textureIndex = 0;
      return placeholder;
    }
    
    const validIndex = Math.max(0, Math.min(textureIndex, this.config.symbolTextures.length - 1));
    const texture = this.config.symbolTextures[validIndex];
    const sprite = new PIXI.Sprite(texture);
    
    // Центрируем спрайт в плейсхолдере (текстуры могут быть разного размера)
    sprite.anchor.set(0.5);
    sprite.x = this.config.symbolSize.width / 2;
    sprite.y = this.config.symbolSize.height / 2;
    
    sprite.textureIndex = validIndex;
    placeholder.textureIndex = validIndex;
    placeholder.addChild(sprite);
    
    // Если это монетка (индекс 8) и есть aclonicaText, добавляем текст поверх
    if (validIndex === 8 && this.aclonicaText) {
      const textSprite = this.aclonicaText.createText('5.00', {
        fontSize: 45,
        color: '#FFFFFF',
        borderColor: '#6B0060',
        borderWidth: 4
      });
      textSprite.anchor.set(0.5);
      textSprite.x = this.config.symbolSize.width / 2;
      textSprite.y = this.config.symbolSize.height / 2;
      placeholder.addChild(textSprite);
      placeholder.coinTextSprite = textSprite; // Сохраняем ссылку для обновления
    }
    
    return placeholder;
  }
  
  async startSpin(resultMatrix = null, coinValues = null) {
    this.isSpinning = true;
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Копируем текстуры из 5 символов (включая символы выше/ниже видимых)
    // Это нужно чтобы графика, выходящая за границы квадратов, не создавала артефакты при подмене
    const visibleStartIndex = this.totalSymbols - this.visibleSymbols - 1;
    const sourceIndex0 = visibleStartIndex - 1;
    const sourceIndex1 = visibleStartIndex;
    const sourceIndex2 = visibleStartIndex + 1;
    const sourceIndex3 = visibleStartIndex + 2;
    const sourceIndex4 = visibleStartIndex + 3;
    
    // Вычисляем целевые индексы с оборачиванием через модуль для предотвращения отрицательных значений
    const wrapIndex = (index) => {
      while (index < 0) index += this.totalSymbols;
      return index % this.totalSymbols;
    };
    
    const targetIndex0 = wrapIndex(sourceIndex0 - this.spinOffset);
    const targetIndex1 = wrapIndex(sourceIndex1 - this.spinOffset);
    const targetIndex2 = wrapIndex(sourceIndex2 - this.spinOffset);
    const targetIndex3 = wrapIndex(sourceIndex3 - this.spinOffset);
    const targetIndex4 = wrapIndex(sourceIndex4 - this.spinOffset);
    
    // Проверяем валидность исходных индексов перед чтением текстур
    if (sourceIndex0 < 0 || sourceIndex0 >= this.totalSymbols ||
        sourceIndex1 < 0 || sourceIndex1 >= this.totalSymbols ||
        sourceIndex2 < 0 || sourceIndex2 >= this.totalSymbols ||
        sourceIndex3 < 0 || sourceIndex3 >= this.totalSymbols ||
        sourceIndex4 < 0 || sourceIndex4 >= this.totalSymbols) {
      console.warn(`Reel ${this.reelIndex}: Invalid source indices for texture copying`);
      return;
    }
    
    const texture0 = this.symbols[sourceIndex0]?.textureIndex ?? 0;
    const texture1 = this.symbols[sourceIndex1]?.textureIndex ?? 0;
    const texture2 = this.symbols[sourceIndex2]?.textureIndex ?? 0;
    const texture3 = this.symbols[sourceIndex3]?.textureIndex ?? 0;
    const texture4 = this.symbols[sourceIndex4]?.textureIndex ?? 0;
    
    console.log(`Reel ${this.reelIndex}: Copying textures - ${sourceIndex0}(${texture0})->${targetIndex0}, ${sourceIndex1}(${texture1})->${targetIndex1}, ${sourceIndex2}(${texture2})->${targetIndex2}, ${sourceIndex3}(${texture3})->${targetIndex3}, ${sourceIndex4}(${texture4})->${targetIndex4}`);
    
    // При копировании сохраняем coinValue из исходного символа
    const sourceCoinValue0 = this.symbols[sourceIndex0]?.coinValue;
    const sourceCoinValue1 = this.symbols[sourceIndex1]?.coinValue;
    const sourceCoinValue2 = this.symbols[sourceIndex2]?.coinValue;
    const sourceCoinValue3 = this.symbols[sourceIndex3]?.coinValue;
    const sourceCoinValue4 = this.symbols[sourceIndex4]?.coinValue;
    
    this.updateSymbolTexture(targetIndex0, texture0, sourceCoinValue0);
    this.updateSymbolTexture(targetIndex1, texture1, sourceCoinValue1);
    this.updateSymbolTexture(targetIndex2, texture2, sourceCoinValue2);
    this.updateSymbolTexture(targetIndex3, texture3, sourceCoinValue3);
    this.updateSymbolTexture(targetIndex4, texture4, sourceCoinValue4);
    
    // Безопасный вывод логов с проверкой существования символов
    const safeGetTexture = (idx) => this.symbols[idx]?.textureIndex ?? '?';
    console.log(`Reel ${this.reelIndex}: After copy - ${targetIndex0}(${safeGetTexture(targetIndex0)}), ${targetIndex1}(${safeGetTexture(targetIndex1)}), ${targetIndex2}(${safeGetTexture(targetIndex2)}), ${targetIndex3}(${safeGetTexture(targetIndex3)}), ${targetIndex4}(${safeGetTexture(targetIndex4)})`);
    
    // Мгновенное смещение вверх на spinOffset символов
    const shiftUp = this.spinOffset * this.symbolSpacing;
    for (let i = 0; i < this.symbols.length; i++) {
      this.symbols[i].y -= shiftUp;
    }
    
    this.reelContainer.visible = true;
    for (let i = 0; i < this.symbols.length; i++) {
      this.symbols[i].visible = true;
      this.symbols[i].renderable = true;
    }
    
    await this.delay(300);
    console.log(`Reel ${this.reelIndex}: After pause - ${targetIndex0}(${safeGetTexture(targetIndex0)}), ${targetIndex1}(${safeGetTexture(targetIndex1)}), ${targetIndex2}(${safeGetTexture(targetIndex2)}), ${targetIndex3}(${safeGetTexture(targetIndex3)}), ${targetIndex4}(${safeGetTexture(targetIndex4)})`);
    
    // Индексы символов, которые станут видимыми после анимации
    const finalVisibleIndices = [
      visibleStartIndex,     // нижний видимый
      visibleStartIndex + 1, // средний видимый
      visibleStartIndex + 2  // верхний видимый
    ].filter(idx => idx >= 0 && idx < this.totalSymbols);
    
    // Базовые защищенные индексы: 5 для копирования текстур (только валидные)
    let protectedIndices = [targetIndex0, targetIndex1, targetIndex2, targetIndex3, targetIndex4].filter(idx => idx >= 0 && idx < this.totalSymbols);
    
    // Если передан resultMatrix - присваиваем текстуры видимым символам из матрицы
    // Структура матрицы: resultMatrix[symbolPosition][reelIndex]
    // symbolPosition: 0=верхний, 1=средний, 2=нижний
    if (resultMatrix && resultMatrix[0] && resultMatrix[0][this.reelIndex] !== undefined && finalVisibleIndices.length === 3) {
      // Получаем значения для текущего рила из каждой позиции
      const topSymbol = resultMatrix[0][this.reelIndex];    // верхний символ
      const middleSymbol = resultMatrix[1][this.reelIndex]; // средний символ
      const bottomSymbol = resultMatrix[2][this.reelIndex];  // нижний символ
      
      // Получаем значения монеток для видимых позиций
      // Структура coinValues должна совпадать с matrix: [positionIndex][reelIndex]
      // positionIndex: 0=верхний, 1=средний, 2=нижний
      const topCoinValue = coinValues && coinValues[0] ? coinValues[0][this.reelIndex] : null;
      const middleCoinValue = coinValues && coinValues[1] ? coinValues[1][this.reelIndex] : null;
      const bottomCoinValue = coinValues && coinValues[2] ? coinValues[2][this.reelIndex] : null;
      
      console.log(`Reel ${this.reelIndex}: Coin values - top=${topCoinValue}, middle=${middleCoinValue}, bottom=${bottomCoinValue}, symbols: top=${topSymbol}, middle=${middleSymbol}, bottom=${bottomSymbol}`);
      console.log(`Reel ${this.reelIndex}: coinValues array:`, coinValues);
      
      // Присваиваем текстуры видимым символам из матрицы
      // Индексы: finalVisibleIndices[2]=верхний, [1]=средний, [0]=нижний
      this.updateSymbolTexture(finalVisibleIndices[2], topSymbol, topSymbol === 8 ? topCoinValue : null);    // верхний
      this.updateSymbolTexture(finalVisibleIndices[1], middleSymbol, middleSymbol === 8 ? middleCoinValue : null); // средний
      this.updateSymbolTexture(finalVisibleIndices[0], bottomSymbol, bottomSymbol === 8 ? bottomCoinValue : null); // нижний
      
      // Защищаем видимые индексы от рандомизации (они уже установлены из матрицы)
      protectedIndices = [...protectedIndices, ...finalVisibleIndices];
      
      console.log(`Reel ${this.reelIndex}: Applied scenario - top=${topSymbol}, middle=${middleSymbol}, bottom=${bottomSymbol}`);
    }
    
    // Рандомизируем все остальные текстуры (кроме защищенных)
    for (let i = 0; i < this.totalSymbols; i++) {
      if (!protectedIndices.includes(i)) {
        const randomTextureIndex = Math.floor(Math.random() * this.config.symbolTextures.length);
        this.updateSymbolTexture(i, randomTextureIndex);
      }
    }
    
    console.log(`Reel ${this.reelIndex}: After randomize - ${targetIndex0}(${safeGetTexture(targetIndex0)}), ${targetIndex1}(${safeGetTexture(targetIndex1)}), ${targetIndex2}(${safeGetTexture(targetIndex2)}), ${targetIndex3}(${safeGetTexture(targetIndex3)}), ${targetIndex4}(${safeGetTexture(targetIndex4)})`);
    
    this.animateSpin();
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  animateSpin() {
    const targetDistance = this.spinOffset * this.symbolSpacing;
    const startPositions = this.symbols.map(s => s.y);
    
    const LINEAR_SPEED = this.config.reelAnimation.linearSpeed;
    const SYMBOL_HEIGHT = this.symbolSpacing;
    const ACCELERATION_TIME = this.config.reelAnimation.accelerationTime;
    const DECELERATION_TIME = this.config.reelAnimation.decelerationTime;
    
    // Трехфазная анимация: разгон (1 символ) -> линейное движение -> торможение с отскоком (1 символ)
    const accelerationDistance = SYMBOL_HEIGHT;
    const decelerationDistance = SYMBOL_HEIGHT;
    const linearDistance = Math.max(0, targetDistance - accelerationDistance - decelerationDistance);
    const linearTime = (linearDistance / (LINEAR_SPEED * SYMBOL_HEIGHT)) * 1000;
    const totalDuration = ACCELERATION_TIME + linearTime + DECELERATION_TIME;
    
    const startTime = performance.now();
    
    const easeInCubic = (t) => t * t * t;
    const easeOutBack = (t) => {
      // ease-out-back с отскоком (может возвращать > 1)
      const c1 = 2.5;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    
    const animate = () => {
      if (!this.isSpinning) {
        this.animationId = null;
        return;
      }
      
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      
      let currentDistance = 0;
      
      if (elapsed < ACCELERATION_TIME) {
        const phaseProgress = elapsed / ACCELERATION_TIME;
        currentDistance = easeInCubic(phaseProgress) * accelerationDistance;
      } else if (elapsed < ACCELERATION_TIME + linearTime) {
        const linearElapsed = elapsed - ACCELERATION_TIME;
        const linearProgress = linearTime > 0 ? Math.min(linearElapsed / linearTime, 1) : 1;
        currentDistance = accelerationDistance + linearProgress * linearDistance;
      } else {
        const decelElapsed = elapsed - ACCELERATION_TIME - linearTime;
        const phaseProgress = Math.min(decelElapsed / DECELERATION_TIME, 1);
        const easedProgress = easeOutBack(phaseProgress);
        currentDistance = accelerationDistance + linearDistance + easedProgress * decelerationDistance;
      }
      
      for (let i = 0; i < this.symbols.length; i++) {
        this.symbols[i].y = startPositions[i] + currentDistance;
      }
      
      if (elapsed >= totalDuration) {
        this.isSpinning = false;
        this.animationId = null;
        // Фиксируем точное целевое расстояние после отскока
        for (let i = 0; i < this.symbols.length; i++) {
          this.symbols[i].y = startPositions[i] + targetDistance;
        }
        console.log(`Reel ${this.reelIndex} spin completed, moved ${targetDistance}px`);
        if (this.onSpinComplete) {
          this.onSpinComplete();
        }
      } else {
        this.animationId = requestAnimationFrame(animate);
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  updateSymbolTexture(symbolIndex, textureIndex, coinValue = null) {
    const placeholder = this.symbols[symbolIndex];
    if (!placeholder) {
      console.warn(`Reel ${this.reelIndex}: Symbol ${symbolIndex} not found`);
      return;
    }
    
    if (!this.config.symbolTextures || this.config.symbolTextures.length === 0) {
      console.warn(`Reel ${this.reelIndex}: Textures not loaded`);
      return;
    }
    
    if (textureIndex < 0 || textureIndex >= this.config.symbolTextures.length) {
      console.warn(`Reel ${this.reelIndex}: Invalid textureIndex ${textureIndex} for symbol ${symbolIndex}`);
      return;
    }
    
    const texture = this.config.symbolTextures[textureIndex];
    const currentY = placeholder.y;
    
    const oldSprite = placeholder.children.find(child => child instanceof PIXI.Sprite);
    if (oldSprite) {
      placeholder.removeChild(oldSprite);
    }
    
    const newSprite = new PIXI.Sprite(texture);
    newSprite.anchor.set(0.5);
    newSprite.x = this.config.symbolSize.width / 2;
    newSprite.y = this.config.symbolSize.height / 2;
    newSprite.textureIndex = textureIndex;
    
    // Добавляем после отладочной рамки (если есть)
    const debugFrame = placeholder.children.find(child => child instanceof PIXI.Graphics);
    if (debugFrame) {
      const debugIndex = placeholder.getChildIndex(debugFrame);
      placeholder.addChildAt(newSprite, debugIndex + 1);
    } else {
      placeholder.addChild(newSprite);
    }
    
    // Удаляем старый текстовый спрайт монетки, если есть
    if (placeholder.coinTextSprite) {
      placeholder.removeChild(placeholder.coinTextSprite);
      placeholder.coinTextSprite = null;
    }
    
    // Сохраняем coinValue в placeholder для монеток
    if (textureIndex === 8) {
      placeholder.coinValue = coinValue;
    } else {
      placeholder.coinValue = null;
    }
    
    // Если это монетка (индекс 8) и есть aclonicaText, добавляем текст поверх
    if (textureIndex === 8 && this.aclonicaText) {
      // Используем значение из сценария или сохраненное значение, если передано, иначе дефолтное "5.00"
      const valueToUse = coinValue !== null ? coinValue : (placeholder.coinValue !== null ? placeholder.coinValue : null);
      const coinTextValue = valueToUse !== null ? valueToUse.toFixed(2) : '5.00';
      const textSprite = this.aclonicaText.createText(coinTextValue, {
        fontSize: 45,
        color: '#FFFFFF',
        borderColor: '#6B0060',
        borderWidth: 4
      });
      textSprite.anchor.set(0.5);
      textSprite.x = this.config.symbolSize.width / 2;
      textSprite.y = this.config.symbolSize.height / 2;
      placeholder.addChild(textSprite);
      placeholder.coinTextSprite = textSprite; // Сохраняем ссылку
    }
    
    placeholder.textureIndex = textureIndex;
    placeholder.y = currentY;
    placeholder.visible = true;
  }
  
  stopSpin(finalSymbols = null) {
    if (!this.isSpinning && this.animationId === null) {
      return;
    }
    
    this.isSpinning = false;
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  getSymbols() {
    const sortedSymbols = this.symbols.map((s, idx) => ({ symbol: s, index: idx, y: s.y }))
      .sort((a, b) => a.y - b.y);
    
    const visible = [];
    for (let i = 0; i < this.visibleSymbols; i++) {
      visible.push(sortedSymbols[i].symbol.textureIndex);
    }
    return visible;
  }

  /**
   * Получает индекс символа на указанной видимой позиции
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний)
   * @returns {number|null} Индекс символа в массиве symbols или null
   */
  getVisibleSymbolIndex(positionIndex) {
    const visibleStartIndex = this.totalSymbols - this.visibleSymbols - 1;
    const visibleIndices = [
      visibleStartIndex,     // positionIndex 0 = нижний видимый
      visibleStartIndex + 1, // positionIndex 1 = средний видимый
      visibleStartIndex + 2  // positionIndex 2 = верхний видимый
    ];

    if (positionIndex >= 0 && positionIndex < visibleIndices.length) {
      const symbolIndex = visibleIndices[positionIndex];
      if (symbolIndex >= 0 && symbolIndex < this.symbols.length) {
        return symbolIndex;
      }
    }
    return null;
  }

  /**
   * Скрывает или показывает символ монетки на указанной позиции
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний)
   * @param {boolean} visible - true чтобы показать, false чтобы скрыть
   */
  setCoinSymbolVisible(positionIndex, visible) {
    const symbolIndex = this.getVisibleSymbolIndex(positionIndex);
    if (symbolIndex !== null) {
      const symbol = this.symbols[symbolIndex];
      // Скрываем только если это монетка (textureIndex === 8)
      if (symbol && symbol.textureIndex === 8) {
        symbol.visible = visible;
        symbol.renderable = visible;
        console.log(`SlotReel ${this.reelIndex}: Coin symbol at position ${positionIndex} (symbolIndex ${symbolIndex}) ${visible ? 'shown' : 'hidden'}`);
      }
    }
  }
  
  destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
