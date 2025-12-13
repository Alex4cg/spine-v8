import { SpineAnimation } from './SpineAnimation.js';
import { AclonicaText } from './AclonicaText.js';

export class CoinManager {
  constructor(config, app, container, indicatorsContainer, aclonicaText = null, collectEffect = null) {
    this.config = config;
    this.app = app;
    this.container = container; // Контейнер для монеток (spineContainer)
    this.indicatorsContainer = indicatorsContainer; // Контейнер для индикаторов (coinIndicatorsContainer, дочерний reelsContainer)
    this.coinSpines = {}; // Пул Spine: { "reelIndex_positionIndex": SpineAnimation }
    this.activeCoins = new Set(); // Активные позиции монеток
    this.reelsContainer = null; // Ссылка на контейнер рилов для синхронизации позиции (для монеток)
    this.coinIndicators = {}; // Пул статичных индикаторов: { "reelIndex": SpineAnimation }
    // Используем переданный экземпляр AclonicaText или создаем новый (для обратной совместимости)
    this.aclonicaText = aclonicaText || new AclonicaText();
    this.coinTextSprites = {}; // Пул текстовых спрайтов: { "reelIndex_positionIndex": PIXI.Sprite }
    this.reels = null; // Массив SlotReel для скрытия/показа спрайтовых монеток
    this.collectEffect = collectEffect; // Ссылка на CollectEffect для проигрывания анимации при событии start_flight
  }

  /**
   * Устанавливает ссылку на массив reels (вызывается после инициализации reels в SlotMachine)
   * @param {Array} reels - Массив SlotReel
   */
  setReels(reels) {
    this.reels = reels;
  }

  /**
   * Синхронизирует позицию монеток с контейнером рилов (для учета сдвига от дебаггера)
   */
  syncWithReelsContainer(reelsContainer) {
    this.reelsContainer = reelsContainer;
    // Обновляем позиции всех уже созданных монеток
    this.updateAllCoinPositions();
  }

  /**
   * Обновляет позиции всех созданных монеток (при изменении сдвига reelsContainer)
   * Индикаторы не нужно обновлять - они в контейнере, который позиционируется через дебаггер
   */
  updateAllCoinPositions() {
    // Обновляем монетки (они используют абсолютные координаты с учетом offset)
    Object.keys(this.coinSpines).forEach(key => {
      const [reelIndex, positionIndex] = key.split('_').map(Number);
      const position = this.getGridPosition(reelIndex, positionIndex);
      const coinSpine = this.coinSpines[key];
      if (coinSpine) {
        coinSpine.setPosition(position.x, position.y);
      }
    });
    
    // Индикаторы не нужно обновлять - они в контейнере, который позиционируется через дебаггер
    // X позиции индикаторов всегда одинаковые относительно контейнера (центр рила)
  }

  /**
   * Вычисляет позицию для индикатора под рилом
   * Индикаторы находятся в coinIndicatorsContainer на stage (отдельный контейнер)
   * Позиции относительно контейнера (контейнер позиционируется через дебаггер)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @returns {object} {x, y} - Координаты центра индикатора относительно контейнера
   */
  getIndicatorPosition(reelIndex) {
    const symbolWidth = this.config.symbolSize.width;

    // X: центр рила (относительно контейнера)
    const x = (reelIndex * symbolWidth) + (symbolWidth / 2);
    
    // Y = 0 (позиция контейнера настраивается через дебаггер)
    const y = 0;

    return { x, y };
  }

  /**
   * Инициализирует статичные индикаторы под рилами (вызывается один раз)
   */
  async initIndicators() {
    // Создаем индикатор для каждого рила
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      const position = this.getIndicatorPosition(reelIndex);
      
      const indicatorSpine = new SpineAnimation(
        this.config,
        this.app,
        this.indicatorsContainer, // Добавляем в контейнер индикаторов
        'coin_indicator',
        null, // без начальной анимации
        false
      );

      const loaded = await indicatorSpine.load();
      if (!loaded) {
        console.warn(`CoinManager: Failed to load coin_indicator Spine for reel ${reelIndex}`);
        continue;
      }

      // Устанавливаем статичную позицию
      indicatorSpine.setPosition(position.x, position.y);

      // Устанавливаем zIndex
      const container = indicatorSpine.getContainer();
      container.zIndex = 104; // Под монетками (105), но над символами (100)
      
      // ВРЕМЕННО: показываем все индикаторы с анимацией idle для настройки позиций
      container.visible = true;
      if (indicatorSpine.spine && indicatorSpine.spine.state) {
        indicatorSpine.spine.state.setAnimation(0, 'idle', true);
      }

      this.coinIndicators[reelIndex] = indicatorSpine;
    }

    console.log(`CoinManager: Initialized ${Object.keys(this.coinIndicators).length} static indicators (temporarily visible for position adjustment)`);
  }

  /**
   * Показывает индикатор под рилом (статичный элемент, запускает анимацию)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   */
  showIndicator(reelIndex) {
    if (!this.coinIndicators[reelIndex]) {
      console.warn(`CoinManager: Indicator for reel ${reelIndex} not initialized`);
      return;
    }

    const indicator = this.coinIndicators[reelIndex];
    const container = indicator.getContainer();
    container.visible = true;

    // Запускаем анимацию появления (in), затем переключаемся на idle
    if (indicator.spine && indicator.spine.state) {
      const trackEntry = indicator.spine.state.setAnimation(0, 'in', false);
      
      if (trackEntry) {
        trackEntry.listener = {
          complete: () => {
            // После завершения 'in' переключаемся на 'idle' в цикле
            if (indicator.spine && indicator.spine.state) {
              indicator.spine.state.setAnimation(0, 'idle', true);
            }
          }
        };
      }
    }

    console.log(`CoinManager: Showing indicator for reel ${reelIndex}`);
  }

  /**
   * Скрывает индикатор под рилом (резко, без анимации)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   */
  hideIndicator(reelIndex) {
    if (this.coinIndicators[reelIndex]) {
      const container = this.coinIndicators[reelIndex].getContainer();
      container.visible = false;
      console.log(`CoinManager: Hiding indicator for reel ${reelIndex}`);
    }
  }

  /**
   * Скрывает все индикаторы (резко, без анимации)
   */
  hideAllIndicators() {
    Object.keys(this.coinIndicators).forEach(reelIndex => {
      this.hideIndicator(Number(reelIndex));
    });
  }

  /**
   * Вычисляет статичную позицию для монетки на сетке (с учетом сдвига от дебаггера)
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
   * Показывает монетку на указанной позиции сетки
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний)
   * @param {string} skin - Имя скина ('regular', 'mini', 'midi', 'major', 'grand')
   * @param {string} value - Значение монетки для отображения (например, "5.00")
   */
  async showCoin(reelIndex, positionIndex, skin = 'regular', value = '5.00') {
    const key = `${reelIndex}_${positionIndex}`;

    // Скрываем спрайтовую монетку на риле
    if (this.reels && this.reels[reelIndex]) {
      this.reels[reelIndex].setCoinSymbolVisible(positionIndex, false);
    }

    // Если монетка уже активна - обновляем позицию (на случай сдвига), скин и показываем
    if (this.activeCoins.has(key) && this.coinSpines[key]) {
      const coinSpine = this.coinSpines[key];
      const position = this.getGridPosition(reelIndex, positionIndex);
      coinSpine.setPosition(position.x, position.y);
      if (coinSpine.spine && coinSpine.spine.skeleton) {
        coinSpine.spine.skeleton.setSkinByName(skin);
        // Проигрываем shot, затем idle
        this.playCoinAnimationSequence(coinSpine);
      }
      const container = coinSpine.getContainer();
      container.visible = true;
      
      // Обновляем текст с правильным значением
      this.attachTextToCoin(coinSpine, value, key);
      
      console.log(`CoinManager: Coin at ${key} already active, updated position and skin to ${skin}`);
      return;
    }

    // Если Spine еще не создан - создаем
    if (!this.coinSpines[key]) {
      const position = this.getGridPosition(reelIndex, positionIndex);
      
      const coinSpine = new SpineAnimation(
        this.config,
        this.app,
        this.container,
        'coin',
        'shot', // Начинаем с shot анимации
        false // не зациклено
      );

      const loaded = await coinSpine.load();
      if (!loaded) {
        console.warn(`CoinManager: Failed to load coin Spine at ${key}`);
        return;
      }

      // Устанавливаем скин
      if (coinSpine.spine && coinSpine.spine.skeleton) {
        coinSpine.spine.skeleton.setSkinByName(skin);
      }

      // Устанавливаем позицию
      coinSpine.setPosition(position.x, position.y);

      // Устанавливаем zIndex (над символами, но под winframes)
      const container = coinSpine.getContainer();
      container.zIndex = 105; // Символы = 100, монетки = 105, winframes = 110
      container.visible = true; // Важно: делаем видимым!

      // Добавляем текст в слот text_holder
      this.attachTextToCoin(coinSpine, value, key);

      this.coinSpines[key] = coinSpine;
    } else {
      // Spine уже создан, обновляем позицию (на случай сдвига от дебаггера), устанавливаем скин и показываем
      const coinSpine = this.coinSpines[key];
      const position = this.getGridPosition(reelIndex, positionIndex);
      coinSpine.setPosition(position.x, position.y);
      if (coinSpine.spine && coinSpine.spine.skeleton) {
        coinSpine.spine.skeleton.setSkinByName(skin);
      }
      const container = coinSpine.getContainer();
      container.visible = true;
      
      // Убеждаемся, что текст добавлен с правильным значением
      this.attachTextToCoin(coinSpine, value, key);
    }

    // Запускаем последовательность анимаций: shot -> idle
    const coinSpine = this.coinSpines[key];
    if (coinSpine && coinSpine.spine) {
      this.playCoinAnimationSequence(coinSpine);
    }

    this.activeCoins.add(key);
    console.log(`CoinManager: Showing coin at ${key} with skin ${skin}, value ${value}`);
  }

  /**
   * Проигрывает последовательность анимаций монетки: shot -> idle
   * @param {SpineAnimation} coinSpine - Spine анимация монетки
   */
  playCoinAnimationSequence(coinSpine) {
    if (!coinSpine || !coinSpine.spine || !coinSpine.spine.state) {
      return;
    }

    // Запускаем анимацию shot (однократно)
    const trackEntry = coinSpine.spine.state.setAnimation(0, 'shot', false);

    if (trackEntry) {
      // Подписываемся на события из анимации shot
      trackEntry.listener = {
        event: (entry, event) => {
          // При событии start_flight запускаем анимацию hit_coin в CollectEffect
          if (event.data.name === 'start_flight' && this.collectEffect) {
            // Получаем позицию монетки для передачи в collect effect
            const container = coinSpine.getContainer();
            const startPosition = {
              x: container.x,
              y: container.y
            };
            
            // Проигрываем анимацию hit_coin в collect effect (async, но не ждем завершения)
            this.collectEffect.playHitCoin(startPosition).catch(err => {
              console.error('CoinManager: Error playing hit_coin:', err);
            });
            console.log(`CoinManager: start_flight event triggered, playing hit_coin at (${startPosition.x}, ${startPosition.y})`);
          }
        },
        complete: () => {
          // После завершения shot переключаемся на idle в цикле
          if (coinSpine.spine && coinSpine.spine.state) {
            coinSpine.spine.state.setAnimation(0, 'idle', true);
            console.log('CoinManager: Shot animation completed, switched to idle');
          }
        }
      };
    } else {
      // Если анимация shot не найдена, сразу запускаем idle
      console.warn('CoinManager: Shot animation not found, playing idle directly');
      coinSpine.spine.state.setAnimation(0, 'idle', true);
    }
  }

  /**
   * Прикрепляет текст к монете через Spine slot
   * @param {SpineAnimation} coinSpine - Spine анимация монеты
   * @param {string} value - Значение для отображения (например, "5.00")
   * @param {string} key - Ключ монетки для сохранения ссылки на спрайт текста
   */
  attachTextToCoin(coinSpine, value = '5.00', key) {
    if (!coinSpine || !coinSpine.spine) {
      console.warn('CoinManager: Cannot attach text - coin spine not loaded');
      return;
    }

    // Ищем слот text_holder
    const textSlot = coinSpine.spine.skeleton.findSlot('text_holder');
    if (!textSlot) {
      console.warn('CoinManager: Slot "text_holder" not found in coin Spine');
      return;
    }

    // Удаляем предыдущий текст, если он был добавлен
    if (this.coinTextSprites[key]) {
      try {
        coinSpine.spine.removeSlotObject('text_holder');
      } catch (e) {
        // Игнорируем ошибки, если объекта уже нет
      }
    }

    // Создаем текстовый спрайт
    const textSprite = this.aclonicaText.createText(value, {
      fontSize: 45,
      lineHeight: 52,
      color: '#FFFFFF',
      borderColor: '#6B0060',
      borderWidth: 4
    });

    // Центрируем текст (anchor в центре)
    textSprite.anchor.set(0.5);

    // Прикрепляем текст к слоту через addSlotObject
    coinSpine.spine.addSlotObject('text_holder', textSprite);

    // Сохраняем ссылку на текстовый спрайт
    this.coinTextSprites[key] = textSprite;

    console.log(`CoinManager: Attached text "${value}" to coin via text_holder slot`);
  }

  /**
   * Скрывает монетку на указанной позиции
   */
  hideCoin(reelIndex, positionIndex) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Показываем спрайтовую монетку на риле обратно
    if (this.reels && this.reels[reelIndex]) {
      this.reels[reelIndex].setCoinSymbolVisible(positionIndex, true);
    }
    
    if (this.coinSpines[key]) {
      const container = this.coinSpines[key].getContainer();
      container.visible = false;
      
      // Удаляем текст из слота (если есть)
      const coinSpine = this.coinSpines[key];
      if (coinSpine && coinSpine.spine) {
        try {
          coinSpine.spine.removeSlotObject('text_holder');
        } catch (e) {
          // Игнорируем ошибки, если объекта уже нет
        }
      }
      
      // Удаляем ссылку на текстовый спрайт
      delete this.coinTextSprites[key];
      
      this.activeCoins.delete(key);
      console.log(`CoinManager: Hiding coin at ${key}`);
    }
  }

  /**
   * Скрывает все монетки
   */
  hideAllCoins() {
    // Создаем копию Set, чтобы избежать проблем с изменением во время итерации
    const keysToHide = Array.from(this.activeCoins);
    keysToHide.forEach(key => {
      const [reelIndex, positionIndex] = key.split('_').map(Number);
      this.hideCoin(reelIndex, positionIndex); // hideCoin уже показывает спрайт обратно
    });
    // Очищаем activeCoins после скрытия всех монеток
    this.activeCoins.clear();
  }

  /**
   * Уничтожает все Spine монетки
   */
  destroy() {
    Object.values(this.coinSpines).forEach(coinSpine => {
      const container = coinSpine.getContainer();
      if (container.parent) {
        container.parent.removeChild(container);
      }
    });
    this.coinSpines = {};
    this.activeCoins.clear();
    this.coinTextSprites = {};
  }
}

