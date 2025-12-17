import { SpineAnimation } from './SpineAnimation.js';

export class BonusManager {
  constructor(config, app, spineContainer, coinManager, collectorManager, reelsContainer) {
    this.config = config;
    this.app = app;
    this.spineContainer = spineContainer;
    this.coinManager = coinManager;
    this.collectorManager = collectorManager;
    this.reelsContainer = reelsContainer;
    
    this.intrigueAnimation = null; // Анимация intrigue поверх рила 2
    this.bonusCoins = {}; // Отдельные экземпляры Spine монет для бонуса
    this.bonusCollectors = {}; // Отдельные экземпляры Spine коллекторов для бонуса
  }

  /**
   * Вычисляет позицию для монетки/коллектора на сетке
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний видимый)
   * @returns {object} {x, y} - Координаты центра ячейки
   */
  getGridPosition(reelIndex, positionIndex) {
    const startX = this.config.startPosition.x;
    const startY = this.config.startPosition.y;
    const symbolWidth = this.config.symbolSize.width;
    const symbolHeight = this.config.symbolSize.height;

    // Учитываем сдвиг от дебаггера (если reelsContainer сдвинут)
    const offsetX = this.reelsContainer ? this.reelsContainer.x : 0;
    const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;

    // positionIndex: 0 = нижний видимый (второй ряд), 1 = средний, 2 = верхний
    // Инвертируем positionIndex для Y: нижний (0) должен быть ниже (больший Y), верхний (2) - выше (меньший Y)
    const maxPositionIndex = this.config.reels.symbolsPerReel - 1; // 2 (для 3 позиций: 0, 1, 2)
    const invertedPositionIndex = maxPositionIndex - positionIndex; // 0->2 (нижний), 1->1 (средний), 2->0 (верхний)
    
    const x = startX + (reelIndex * symbolWidth) + (symbolWidth / 2) + offsetX;
    const y = startY + (invertedPositionIndex * symbolHeight) + (symbolHeight / 2) + offsetY;

    return { x, y };
  }

  /**
   * Показывает анимацию intrigue поверх рила 2
   */
  async showIntrigueAnimation(reels) {
    if (this.intrigueAnimation) {
      // Если анимация уже существует, плавно показываем её
      const container = this.intrigueAnimation.getContainer();
      container.visible = true;
      
      // Плавное появление через альфа-канал
      const fadeInDuration = 300; // 300ms для появления
      const startTime = performance.now();
      container.alpha = 0;
      
      const fadeIn = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / fadeInDuration, 1);
        container.alpha = progress;
        
        if (progress < 1) {
          requestAnimationFrame(fadeIn);
        }
      };
      
      requestAnimationFrame(fadeIn);
      return;
    }
    
    try {
      // Получаем позицию рила 2
      const reel2 = reels[2];
      if (!reel2) {
        console.warn('BonusManager: Cannot show intrigue animation - reel 2 not found');
        return;
      }
      
      const reel2X = reel2.reelContainer.x;
      const reel2Y = reel2.reelContainer.y;
      
      // Создаем анимацию intrigue
      this.intrigueAnimation = new SpineAnimation(
        this.config,
        this.app,
        this.spineContainer,
        'intrigue',
        'animation', // имя анимации из skeleton.json
        true // loop = true
      );
      
      const loaded = await this.intrigueAnimation.load();
      if (loaded) {
        // Устанавливаем позицию поверх рила 2
        // Центрируем по горизонтали рила (ширина символа / 2)
        const symbolWidth = this.config.symbolSize.width;
        const symbolHeight = this.config.symbolSize.height;
        const visibleSymbols = this.config.reels.symbolsPerReel;
        
        // Центрируем по вертикали: центр видимой области рила + 22 пикселя вниз
        const reelHeight = visibleSymbols * symbolHeight;
        const intrigueX = reel2X + symbolWidth / 2;
        const intrigueY = reel2Y + reelHeight / 2 + 22;
        
        this.intrigueAnimation.setPosition(intrigueX, intrigueY);
        
        // Устанавливаем zIndex выше рилов
        const container = this.intrigueAnimation.getContainer();
        container.zIndex = 110; // Выше рилов (zIndex = 100)
        container.alpha = 0; // Начинаем с прозрачности
        container.visible = true;
        
        // Плавное появление через альфа-канал
        const fadeInDuration = 300; // 300ms для появления
        const startTime = performance.now();
        
        const fadeIn = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / fadeInDuration, 1);
          container.alpha = progress;
          
          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          }
        };
        
        requestAnimationFrame(fadeIn);
        
        console.log(`BonusManager: Intrigue animation shown at (${intrigueX}, ${intrigueY})`);
      } else {
        console.error('BonusManager: Failed to load intrigue animation');
        this.intrigueAnimation = null;
      }
    } catch (error) {
      console.error('BonusManager: Error showing intrigue animation:', error);
      this.intrigueAnimation = null;
    }
  }
  
  /**
   * Скрывает анимацию intrigue
   */
  hideIntrigueAnimation() {
    if (this.intrigueAnimation) {
      const container = this.intrigueAnimation.getContainer();
      
      // Плавное исчезновение через альфа-канал
      const fadeOutDuration = 300; // 300ms для исчезновения
      const startTime = performance.now();
      const startAlpha = container.alpha;
      
      const fadeOut = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / fadeOutDuration, 1);
        container.alpha = startAlpha * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(fadeOut);
        } else {
          // После завершения затухания скрываем контейнер
          container.visible = false;
          container.alpha = 0;
          console.log('BonusManager: Intrigue animation hidden');
        }
      };
      
      requestAnimationFrame(fadeOut);
    }
  }

  /**
   * Показывает отдельные экземпляры Spine монет для бонуса (играют anticipation)
   * ВАЖНО: Монетки показываются только на рилах 0 и 1 (рил 2 вращается)
   */
  async showBonusCoins(currentScenarioData) {
    if (!currentScenarioData || !this.coinManager) {
      return;
    }
    
    const scenarioData = currentScenarioData;
    const currentMatrix = scenarioData?.matrix || scenarioData;
    const coinValues = scenarioData?.coinValues || null;
    
    if (!currentMatrix || !Array.isArray(currentMatrix)) {
      return;
    }
    
    // Показываем монетки (индекс 8) из матрицы
    // НЕ показываем на риле 2, так как там происходит вращение во время бонуса
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      // Пропускаем рил 2
      if (reelIndex === 2) {
        continue;
      }
      
      // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
      if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
        await this.createBonusCoin(reelIndex, 0, coinValues ? coinValues[2]?.[reelIndex] : null);
      }
      // Проверяем средний (currentMatrix[1]) -> positionIndex 1
      if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
        await this.createBonusCoin(reelIndex, 1, coinValues ? coinValues[1]?.[reelIndex] : null);
      }
      // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
      if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
        await this.createBonusCoin(reelIndex, 2, coinValues ? coinValues[0]?.[reelIndex] : null);
      }
    }
    
    console.log('BonusManager: Bonus coins shown with anticipation animation');
  }
  
  /**
   * Создает отдельный экземпляр Spine монетки для бонуса
   */
  async createBonusCoin(reelIndex, positionIndex, coinValue) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Если монетка уже существует, просто показываем её
    if (this.bonusCoins[key]) {
      const container = this.bonusCoins[key].getContainer();
      container.visible = true;
      if (this.bonusCoins[key].spine && this.bonusCoins[key].spine.state) {
        this.bonusCoins[key].spine.state.setAnimation(0, 'anticipation', true);
      }
      return;
    }
    
    // Создаем новый экземпляр Spine монетки
    const position = this.getGridPosition(reelIndex, positionIndex);
    
    const coinSpine = new SpineAnimation(
      this.config,
      this.app,
      this.spineContainer,
      'coin',
      'anticipation', // Начинаем с anticipation анимации
      true // loop = true
    );

    const loaded = await coinSpine.load();
    if (!loaded) {
      console.warn(`BonusManager: Failed to load bonus coin Spine at ${key}`);
      return;
    }

    // Устанавливаем скин
    if (coinSpine.spine && coinSpine.spine.skeleton) {
      coinSpine.spine.skeleton.setSkinByName('regular');
    }

    // Устанавливаем позицию
    coinSpine.setPosition(position.x, position.y);

    // Устанавливаем zIndex (над символами, но под winframes)
    const container = coinSpine.getContainer();
    container.zIndex = 105; // Символы = 100, монетки = 105, winframes = 110
    container.visible = true;

    // Добавляем текст в слот text_holder (используем те же параметры, что и в CoinManager)
    const formattedValue = coinValue !== null ? `${Math.round(coinValue)}х` : '5х';
    if (coinSpine.spine && this.coinManager && this.coinManager.aclonicaText) {
      const textSlot = coinSpine.spine.skeleton.findSlot('text_holder');
      if (textSlot) {
        const textSprite = this.coinManager.aclonicaText.createText(formattedValue, {
          fontSize: 45,
          lineHeight: 52,
          color: '#FFFFFF',
          borderColor: '#6B0060',
          borderWidth: 4
        });
        if (textSprite) {
          // Центрируем текст (anchor в центре)
          textSprite.anchor.set(0.5);
          coinSpine.spine.addSlotObject('text_holder', textSprite);
        }
      }
    }

    this.bonusCoins[key] = coinSpine;
    console.log(`BonusManager: Bonus coin created at ${key} with value ${formattedValue}`);
  }
  
  /**
   * Скрывает и уничтожает все монетки бонуса
   */
  hideBonusCoins() {
    Object.entries(this.bonusCoins).forEach(([key, coinSpine]) => {
      if (coinSpine) {
        // Очищаем все треки и listeners перед уничтожением
        if (coinSpine.spine && coinSpine.spine.state) {
          const state = coinSpine.spine.state;
          // Очищаем все listeners
          if (state.tracks) {
            state.tracks.forEach((track, index) => {
              if (track && track.entry) {
                const entry = track.entry;
                if (entry.listener) {
                  entry.listener = null;
                }
              }
            });
          }
          // Очищаем все треки
          state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          try {
            coinSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки, если слот не существует
          }
        }
        
        // Удаляем контейнер из stage
        if (coinSpine.getContainer) {
          const container = coinSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (coinSpine.destroy) {
          coinSpine.destroy();
        }
      }
    });
    
    // Очищаем объект
    this.bonusCoins = {};
    console.log('BonusManager: Bonus coins hidden and destroyed');
  }
  
  /**
   * Показывает отдельные экземпляры Spine коллекторов для бонуса (играют anticipation или idle)
   * ВАЖНО: Коллекторы показываются только на рилах 0 и 1 (рил 2 вращается)
   */
  async showBonusCollectors(currentScenarioData) {
    if (!currentScenarioData || !this.collectorManager) {
      return;
    }
    
    const scenarioData = currentScenarioData;
    const currentMatrix = scenarioData?.matrix || scenarioData;
    const collectorValue = scenarioData?.collectorValue || null;
    
    if (!currentMatrix || !Array.isArray(currentMatrix)) {
      return;
    }
    
    // Показываем коллекторы (индекс 10) из матрицы
    // НЕ показываем на риле 2, так как там происходит вращение во время бонуса
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      // Пропускаем рил 2
      if (reelIndex === 2) {
        continue;
      }
      
      // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
      if (currentMatrix[2] && currentMatrix[2][reelIndex] === 10) {
        await this.createBonusCollector(reelIndex, 0, collectorValue);
      }
      // Проверяем средний (currentMatrix[1]) -> positionIndex 1
      if (currentMatrix[1] && currentMatrix[1][reelIndex] === 10) {
        await this.createBonusCollector(reelIndex, 1, collectorValue);
      }
      // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
      if (currentMatrix[0] && currentMatrix[0][reelIndex] === 10) {
        await this.createBonusCollector(reelIndex, 2, collectorValue);
      }
    }
    
    console.log('BonusManager: Bonus collectors shown with anticipation/idle animation');
  }
  
  /**
   * Создает отдельный экземпляр Spine коллектора для бонуса
   */
  async createBonusCollector(reelIndex, positionIndex, collectorValue) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Если коллектор уже существует, просто показываем его
    if (this.bonusCollectors[key]) {
      const container = this.bonusCollectors[key].getContainer();
      container.visible = true;
      if (this.bonusCollectors[key].spine && this.bonusCollectors[key].spine.state) {
        // Пробуем установить anticipation, если нет - используем idle
        const spine = this.bonusCollectors[key].spine;
        const hasAnticipation = spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'anticipation'
        );
        if (hasAnticipation) {
          spine.state.setAnimation(0, 'anticipation', true);
        } else {
          spine.state.setAnimation(0, 'idle', true);
        }
      }
      return;
    }
    
    // Создаем новый экземпляр Spine коллектора
    const position = this.getGridPosition(reelIndex, positionIndex);
    
    // Используем конфиг коллектора из CollectorManager
    const spineName = this.collectorManager && this.collectorManager.collectorConfig 
      ? this.collectorManager.collectorConfig.spineName 
      : 'coin_collector';
    
    const collectorSpine = new SpineAnimation(
      this.config,
      this.app,
      this.spineContainer,
      spineName,
      null, // Начальная анимация будет установлена после загрузки
      false
    );

    const loaded = await collectorSpine.load();
    if (!loaded) {
      console.warn(`BonusManager: Failed to load bonus collector Spine at ${key}`);
      return;
    }

    // Устанавливаем масштаб из конфига коллектора
    if (this.collectorManager && this.collectorManager.collectorConfig && this.collectorManager.collectorConfig.scale) {
      const container = collectorSpine.getContainer();
      container.scale.x = this.collectorManager.collectorConfig.scale.x;
      container.scale.y = this.collectorManager.collectorConfig.scale.y;
    }

    // Устанавливаем позицию
    collectorSpine.setPosition(position.x, position.y);

    // Устанавливаем zIndex (над символами, но под winframes)
    const container = collectorSpine.getContainer();
    const zIndex = this.collectorManager && this.collectorManager.collectorConfig 
      ? this.collectorManager.collectorConfig.zIndex 
      : 105;
    container.zIndex = zIndex;
    container.visible = true;

    // Пробуем установить anticipation, если нет - используем idle
    if (collectorSpine.spine && collectorSpine.spine.state) {
      const hasAnticipation = collectorSpine.spine.state.data.skeletonData.animations.some(
        anim => anim.name === 'anticipation'
      );
      if (hasAnticipation) {
        collectorSpine.spine.state.setAnimation(0, 'anticipation', true);
      } else {
        collectorSpine.spine.state.setAnimation(0, 'idle', true);
      }
    }

    // Добавляем текст в слот text_holder (используем те же параметры, что и в CollectorManager)
    const formattedValue = collectorValue !== null && collectorValue !== undefined 
      ? `${Math.round(collectorValue)}х` 
      : '0х';
    if (collectorSpine.spine && this.collectorManager && this.collectorManager.aclonicaText) {
      const textSlot = collectorSpine.spine.skeleton.findSlot('text_holder');
      if (textSlot) {
        const textSprite = this.collectorManager.aclonicaText.createText(formattedValue, {
          fontSize: 45,
          lineHeight: 52,
          color: '#FFFFFF',
          borderColor: '#6B0060',
          borderWidth: 4
        });
        if (textSprite) {
          // Центрируем текст (anchor в центре)
          textSprite.anchor.set(0.5);
          collectorSpine.spine.addSlotObject('text_holder', textSprite);
          
          // Устанавливаем обновление альфы текста синхронно с альфой слота (как в CollectorManager)
          if (!collectorSpine._textAlphaUpdateSet) {
            collectorSpine._textAlphaUpdateSet = new Set();
            const originalAfterUpdate = collectorSpine.spine.afterUpdateWorldTransforms;
            collectorSpine.spine.afterUpdateWorldTransforms = () => {
              if (originalAfterUpdate) {
                originalAfterUpdate.call(collectorSpine.spine);
              }
              collectorSpine._textAlphaUpdateSet.forEach(updateFn => updateFn());
            };
          }
          
          const updateTextAlpha = () => {
            if (textSlot && textSlot.color && textSprite) {
              textSprite.alpha = textSlot.color.a;
            }
          };
          collectorSpine._textAlphaUpdateSet.add(updateTextAlpha);
          updateTextAlpha();
        }
      }
    }

    this.bonusCollectors[key] = collectorSpine;
    console.log(`BonusManager: Bonus collector created at ${key} with value ${formattedValue}`);
  }
  
  /**
   * Скрывает и уничтожает все коллекторы бонуса
   */
  hideBonusCollectors() {
    Object.entries(this.bonusCollectors).forEach(([key, collectorSpine]) => {
      if (collectorSpine) {
        // Очищаем все треки и listeners перед уничтожением
        if (collectorSpine.spine && collectorSpine.spine.state) {
          const state = collectorSpine.spine.state;
          // Очищаем все listeners
          if (state.tracks) {
            state.tracks.forEach((track, index) => {
              if (track && track.entry) {
                const entry = track.entry;
                if (entry.listener) {
                  entry.listener = null;
                }
              }
            });
          }
          // Очищаем все треки
          state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          try {
            collectorSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки, если слот не существует
          }
          
          // Удаляем функцию обновления альфы, если она была установлена
          if (collectorSpine._textAlphaUpdateSet) {
            collectorSpine._textAlphaUpdateSet.clear();
            delete collectorSpine._textAlphaUpdateSet;
          }
        }
        
        // Удаляем контейнер из stage
        if (collectorSpine.getContainer) {
          const container = collectorSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (collectorSpine.destroy) {
          collectorSpine.destroy();
        }
      }
    });
    
    // Очищаем объект
    this.bonusCollectors = {};
    console.log('BonusManager: Bonus collectors hidden and destroyed');
  }
}

