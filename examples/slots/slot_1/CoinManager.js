import { SpineAnimation } from './SpineAnimation.js';
import { AclonicaText } from './AclonicaText.js';

export class CoinManager {
  constructor(config, app, container, indicatorsContainer, aclonicaText = null, collectEffect = null, reelsContainer = null) {
    this.config = config;
    this.app = app;
    this.container = container; // Контейнер для монеток (spineContainer)
    this.indicatorsContainer = indicatorsContainer; // Контейнер для индикаторов (coinIndicatorsContainer, дочерний reelsContainer)
    this.reelsContainerForIndicators = reelsContainer; // Контейнер для индикаторов рилов (reelsContainer, чтобы были под символами)
    this.coinSpines = {}; // Пул Spine: { "reelIndex_positionIndex": SpineAnimation }
    this.activeCoins = new Set(); // Активные позиции монеток
    this.reelsContainer = null; // Ссылка на контейнер рилов для синхронизации позиции (для монеток)
    this.coinIndicators = {}; // Пул статичных индикаторов: { "reelIndex": SpineAnimation }
    // Используем переданный экземпляр AclonicaText или создаем новый (для обратной совместимости)
    this.aclonicaText = aclonicaText || new AclonicaText();
    this.coinTextSprites = {}; // Пул текстовых спрайтов: { "reelIndex_positionIndex": PIXI.Sprite }
    this.reels = null; // Массив SlotReel для скрытия/показа спрайтовых монеток
    this.collectEffect = collectEffect; // Ссылка на CollectEffect для проигрывания анимации при событии start_flight
    this.hasWinLines = false; // Флаг наличия выигрышных линий (для определения поведения после полета монетки)
    this.reelIndicators = {}; // Пул индикаторов рилов: { "reelIndex": SpineAnimation }
    this.hasCoinCollectorEvent = false; // Флаг наличия события coin_collector
    this.collectorPositions = []; // Массив позиций коллекторов { reelIndex, positionIndex } для перелета
    this.coinFlightCounters = {}; // Счетчики перелетов для каждой монетки: { "reelIndex_positionIndex": number }
    this.hasBonusEvent = false; // Флаг наличия события bonus (для win анимации после shot)
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
   * Индикаторы монеток не нужно обновлять - они в контейнере, который позиционируется через дебаггер
   * Индикаторы рилов обновляются, так как они используют абсолютные координаты
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
    
    // Обновляем позиции индикаторов рилов
    this.updateReelIndicatorsPosition();
    
    // Индикаторы монеток не нужно обновлять - они в контейнере, который позиционируется через дебаггер
    // X позиции индикаторов монеток всегда одинаковые относительно контейнера (центр рила)
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
   * Вычисляет позицию для индикатора рила (центр средней линии)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @returns {object} {x, y} - Координаты центра средней линии
   */
  getReelIndicatorPosition(reelIndex) {
    const startX = this.config.startPosition.x;
    const startY = this.config.startPosition.y;
    const symbolWidth = this.config.symbolSize.width;
    const symbolHeight = this.config.symbolSize.height;
    
    // Учитываем сдвиг от дебаггера
    const offsetX = this.reelsContainer ? this.reelsContainer.x : 0;
    const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;
    
    // X: центр рила
    const x = startX + (reelIndex * symbolWidth) + (symbolWidth / 2) + offsetX;
    
    // Y: центр средней линии (positionIndex 1) + смещение на 22 пикселя вверх
    const y = startY + (1 * symbolHeight) + (symbolHeight / 2) + offsetY - 22;
    
    return { x, y };
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
   * @param {string} value - Значение монетки для отображения (например, "5х")
   */
  async showCoin(reelIndex, positionIndex, skin = 'regular', value = '5х') {
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
      // Spine уже создан - полностью уничтожаем и пересоздаем для чистого состояния
      const oldCoinSpine = this.coinSpines[key];
      
      // Уничтожаем старый экземпляр
      if (oldCoinSpine) {
        // Очищаем все треки и listeners
        if (oldCoinSpine.spine && oldCoinSpine.spine.state) {
          const state = oldCoinSpine.spine.state;
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
          state.clearTracks();
          
          // Удаляем текст из слота
          try {
            oldCoinSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки
          }
        }
        
        // Удаляем контейнер из stage
        if (oldCoinSpine.getContainer) {
          const container = oldCoinSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (oldCoinSpine.destroy) {
          oldCoinSpine.destroy();
        }
      }
      
      // Удаляем ссылку
      delete this.coinSpines[key];
      delete this.coinTextSprites[key];
      
      // Создаем новый экземпляр
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
    }

    // Запускаем последовательность анимаций: shot -> idle
    const coinSpine = this.coinSpines[key];
    if (coinSpine && coinSpine.spine) {
      // Сохраняем reelIndex и positionIndex в coinSpine для использования в callback
      coinSpine.reelIndex = reelIndex;
      coinSpine.positionIndex = positionIndex;
      this.playCoinAnimationSequence(coinSpine);
    }

    this.activeCoins.add(key);
    console.log(`CoinManager: Showing coin at ${key} with skin ${skin}, value ${value}`);
  }

  /**
   * Проигрывает последовательность анимаций монетки: shot -> (shot второй раз если есть coin_collector) -> idle
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
            
            // Получаем reelIndex и positionIndex из coinSpine (сохранены в showCoin)
            const reelIndex = coinSpine.reelIndex;
            const positionIndex = coinSpine.positionIndex;
            
            // Создаем callback для завершения анимации hit_coin
            const coinKey = `${reelIndex}_${positionIndex}`;
            // Сохраняем ссылку на coinSpine для использования в callback
            const coinSpineRef = coinSpine;
            const onFlightComplete = () => {
              console.log(`CoinManager: Flight completed for coin at ${coinKey}, hasWinLines: ${this.hasWinLines}, hasBonusEvent: ${this.hasBonusEvent}`);
              
              if (this.hasWinLines) {
                // Если есть выигрышные линии - скрываем Spine монетку и показываем спрайт на риле
                this.hideCoin(reelIndex, positionIndex);
              } else if (this.hasBonusEvent) {
                // Если есть событие bonus - проигрываем win анимацию после полета
                const hasWin = coinSpineRef.spine.state.data.skeletonData.animations.some(
                  anim => anim.name === 'win'
                );
                if (hasWin && coinSpineRef && coinSpineRef.spine && coinSpineRef.spine.state) {
                  coinSpineRef.spine.state.setAnimation(0, 'win', true);
                  console.log(`CoinManager: Bonus event - playing win animation after flight for coin at ${coinKey}`);
                } else {
                  // Если win анимации нет, переключаемся на idle
                  coinSpineRef.spine.state.setAnimation(0, 'idle', true);
                  console.log(`CoinManager: Win animation not found, switching to idle for coin at ${coinKey}`);
                }
              } else {
                // Если нет выигрышных линий и нет бонуса - переключаем монетку на idle в цикле
                if (coinSpineRef && coinSpineRef.spine && coinSpineRef.spine.state) {
                  coinSpineRef.spine.state.setAnimation(0, 'idle', true);
                  console.log(`CoinManager: No win lines, switching coin at ${coinKey} to idle loop`);
                }
              }
            };
            
            // Проигрываем анимацию hit_coin в collect effect с callback
            this.collectEffect.playHitCoin(startPosition, onFlightComplete).catch(err => {
              console.error('CoinManager: Error playing hit_coin:', err);
            });
            console.log(`CoinManager: start_flight event triggered, playing hit_coin at (${startPosition.x}, ${startPosition.y})`);
          }
        },
        complete: () => {
          // После завершения shot проверяем, нужно ли проиграть второй shot или win анимацию
          if (this.hasCoinCollectorEvent) {
            // Если есть событие coin_collector - проигрываем shot второй раз перед idle
            const secondShotTrackEntry = coinSpine.spine.state.setAnimation(0, 'shot', false);
            if (secondShotTrackEntry) {
              // Подписываемся на события из второго shot (для перелета в коллекторы)
              secondShotTrackEntry.listener = {
                event: (entry, event) => {
                  // При событии start_flight запускаем анимацию hit_coin в CollectEffect для каждого коллектора
                  if (event.data.name === 'start_flight' && this.collectEffect && this.collectorPositions.length > 0) {
                    // Получаем позицию монетки для передачи в collect effect
                    const container = coinSpine.getContainer();
                    const startPosition = {
                      x: container.x,
                      y: container.y
                    };
                    
                    // Получаем reelIndex и positionIndex из coinSpine
                    const reelIndex = coinSpine.reelIndex;
                    const positionIndex = coinSpine.positionIndex;
                    const coinKey = `${reelIndex}_${positionIndex}`;
                    
                    // Инициализируем счетчик перелетов для этой монетки
                    if (!this.coinFlightCounters[coinKey]) {
                      this.coinFlightCounters[coinKey] = 0;
                    }
                    
                    // Запускаем перелеты ко всем коллекторам одновременно
                    this.collectorPositions.forEach((collectorPosition, index) => {
                      // Получаем координаты коллектора используя getGridPosition
                      const collectorEndPosition = this.getGridPosition(
                        collectorPosition.reelIndex,
                        collectorPosition.positionIndex
                      );
                      
                      // Увеличиваем счетчик активных перелетов
                      this.coinFlightCounters[coinKey]++;
                      
                      const coinSpineRef = coinSpine;
                      const onFlightComplete = () => {
                        console.log(`CoinManager: Flight to collector ${index} completed for coin at ${coinKey}`);
                        
                        // Уменьшаем счетчик перелетов
                        this.coinFlightCounters[coinKey]--;
                        
                        // Если все перелеты завершены, скрываем монетку
                        if (this.coinFlightCounters[coinKey] === 0) {
                          this.hideCoin(reelIndex, positionIndex);
                          delete this.coinFlightCounters[coinKey];
                          console.log(`CoinManager: All flights completed, coin at ${coinKey} hidden`);
                        }
                      };
                      
                      // Проигрываем анимацию hit_coin в collect effect с координатами коллектора
                      // Указываем targetType: 'collector' чтобы вызвать правильный callback
                      // Передаем информацию о коллекторе для правильной обработки события
                      this.collectEffect.playHitCoin(
                        startPosition, 
                        onFlightComplete, 
                        collectorEndPosition, 
                        'collector',
                        { reelIndex: collectorPosition.reelIndex, positionIndex: collectorPosition.positionIndex }
                      ).catch(err => {
                        console.error(`CoinManager: Error playing hit_coin to collector ${index}:`, err);
                        // В случае ошибки уменьшаем счетчик
                        this.coinFlightCounters[coinKey]--;
                        if (this.coinFlightCounters[coinKey] === 0) {
                          this.hideCoin(reelIndex, positionIndex);
                          delete this.coinFlightCounters[coinKey];
                        }
                      });
                      console.log(`CoinManager: Second shot start_flight event triggered, playing hit_coin to collector ${index} at (${collectorEndPosition.x}, ${collectorEndPosition.y})`);
                    });
                  }
                },
                complete: () => {
                  // После завершения второго shot проверяем, нужно ли проиграть win анимацию (для бонуса)
                  if (this.hasBonusEvent) {
                    // Для бонуса проигрываем win анимацию после shot
                    const hasWin = coinSpine.spine.state.data.skeletonData.animations.some(
                      anim => anim.name === 'win'
                    );
                    if (hasWin && coinSpine.spine && coinSpine.spine.state) {
                      const winTrackEntry = coinSpine.spine.state.setAnimation(0, 'win', true);
                      console.log(`CoinManager: Bonus event - playing win animation after second shot for coin at ${coinSpine.reelIndex}_${coinSpine.positionIndex}`);
                    } else {
                      // Если win анимации нет, переключаемся на idle
                      coinSpine.spine.state.setAnimation(0, 'idle', true);
                    }
                  } else {
                    // После завершения второго shot не скрываем монетку сразу
                    // Монетка будет скрыта после завершения всех перелетов к коллекторам
                    console.log(`CoinManager: Second shot completed, waiting for all flights to complete`);
                  }
                }
              };
            } else {
              // Если анимация shot не найдена, сразу переключаемся на idle
              console.warn('CoinManager: Second shot animation not found, playing idle directly');
              coinSpine.spine.state.setAnimation(0, 'idle', true);
            }
          } else {
            // Если нет события coin_collector - проверяем, нужно ли проиграть win анимацию (для бонуса)
            if (this.hasBonusEvent) {
              // Для бонуса проигрываем win анимацию после shot
              const hasWin = coinSpine.spine.state.data.skeletonData.animations.some(
                anim => anim.name === 'win'
              );
              if (hasWin && coinSpine.spine && coinSpine.spine.state) {
                const winTrackEntry = coinSpine.spine.state.setAnimation(0, 'win', true);
                console.log(`CoinManager: Bonus event - playing win animation after shot for coin at ${coinSpine.reelIndex}_${coinSpine.positionIndex}`);
              } else {
                // Если win анимации нет, переключаемся на idle
                coinSpine.spine.state.setAnimation(0, 'idle', true);
                console.log('CoinManager: Shot animation completed, win animation not found, switched to idle');
              }
            } else {
              // Если нет события bonus - сразу переключаемся на idle в цикле
              if (coinSpine.spine && coinSpine.spine.state) {
                coinSpine.spine.state.setAnimation(0, 'idle', true);
                console.log('CoinManager: Shot animation completed, switched to idle');
              }
            }
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
   * @param {string} value - Значение для отображения (например, "5х")
   * @param {string} key - Ключ монетки для сохранения ссылки на спрайт текста
   */
  attachTextToCoin(coinSpine, value = '5х', key) {
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
      const coinSpine = this.coinSpines[key];
      
      // Очищаем все треки анимации перед скрытием (чтобы избежать ошибок в validateAttachments)
      if (coinSpine && coinSpine.spine && coinSpine.spine.state) {
        try {
          // Очищаем все треки
          coinSpine.spine.state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          coinSpine.spine.removeSlotObject('text_holder');
        } catch (e) {
          console.warn(`CoinManager: Error cleaning up coin Spine at ${key}:`, e);
        }
      }
      
      // Скрываем контейнер
      const container = coinSpine.getContainer();
      if (container) {
        container.visible = false;
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
   * Устанавливает флаг наличия выигрышных линий
   * @param {boolean} hasWinLines - true если есть выигрышные линии
   */
  setHasWinLines(hasWinLines) {
    this.hasWinLines = hasWinLines;
  }

  /**
   * Устанавливает флаг наличия события coin_collector и позиции коллекторов
   * @param {boolean} hasCoinCollectorEvent - true если есть событие coin_collector
   * @param {Array} collectorPositions - Массив позиций коллекторов [{ reelIndex, positionIndex }, ...] или null
   */
  setHasCoinCollectorEvent(hasCoinCollectorEvent, collectorPositions = null) {
    this.hasCoinCollectorEvent = hasCoinCollectorEvent;
    this.collectorPositions = collectorPositions || [];
  }
  
  /**
   * Устанавливает флаг наличия события bonus
   * @param {boolean} hasBonusEvent - true если есть событие bonus
   */
  setHasBonusEvent(hasBonusEvent) {
    this.hasBonusEvent = hasBonusEvent;
  }

  /**
   * Проверяет, есть ли активные монетки на экране
   * @returns {boolean} true если есть активные монетки
   */
  hasActiveCoins() {
    return this.activeCoins.size > 0;
  }

  /**
   * Инициализирует индикаторы рилов (coin_indicator_reel)
   * По одному индикатору на рил, центр в центре средней линии
   */
  async initReelIndicators() {
    // Проверяем наличие контейнера для индикаторов рилов
    if (!this.reelsContainerForIndicators) {
      console.warn('CoinManager: reelsContainer not provided, cannot initialize reel indicators');
      return;
    }

    // Создаем индикатор для каждого рила
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      const position = this.getReelIndicatorPosition(reelIndex);
      
      const reelIndicatorSpine = new SpineAnimation(
        this.config,
        this.app,
        this.reelsContainerForIndicators, // Добавляем в reelsContainer, чтобы были под символами
        'coin_indicator_reel',
        null, // без начальной анимации
        false
      );

      const loaded = await reelIndicatorSpine.load();
      if (!loaded) {
        console.warn(`CoinManager: Failed to load coin_indicator_reel Spine for reel ${reelIndex}`);
        continue;
      }

      // Устанавливаем позицию (центр средней линии)
      reelIndicatorSpine.setPosition(position.x, position.y);

      // Устанавливаем zIndex под символами
      const container = reelIndicatorSpine.getContainer();
      container.zIndex = 95; // Под символами (100), но над винлайнами (99)
      container.visible = false; // Изначально скрыты

      this.reelIndicators[reelIndex] = reelIndicatorSpine;
    }

    console.log(`CoinManager: Initialized ${Object.keys(this.reelIndicators).length} reel indicators`);
  }

  /**
   * Показывает индикатор рила (проигрывает in, затем idle в цикле)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   */
  showReelIndicator(reelIndex) {
    if (!this.reelIndicators[reelIndex]) {
      console.warn(`CoinManager: Reel indicator for reel ${reelIndex} not initialized`);
      return;
    }

    const indicator = this.reelIndicators[reelIndex];
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

    console.log(`CoinManager: Showing reel indicator for reel ${reelIndex}`);
  }

  /**
   * Скрывает индикатор рила (резко, без анимации)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   */
  hideReelIndicator(reelIndex) {
    if (this.reelIndicators[reelIndex]) {
      const container = this.reelIndicators[reelIndex].getContainer();
      container.visible = false;
      // Останавливаем анимацию
      if (this.reelIndicators[reelIndex].spine && this.reelIndicators[reelIndex].spine.state) {
        this.reelIndicators[reelIndex].spine.state.clearTracks();
      }
      console.log(`CoinManager: Hiding reel indicator for reel ${reelIndex}`);
    }
  }

  /**
   * Скрывает все индикаторы рилов
   */
  hideAllReelIndicators() {
    Object.keys(this.reelIndicators).forEach(reelIndex => {
      this.hideReelIndicator(Number(reelIndex));
    });
  }

  /**
   * Обновляет позиции индикаторов рилов (вызывается при изменении позиции reelsContainer)
   */
  updateReelIndicatorsPosition() {
    Object.keys(this.reelIndicators).forEach(reelIndex => {
      const indicator = this.reelIndicators[reelIndex];
      const position = this.getReelIndicatorPosition(Number(reelIndex));
      indicator.setPosition(position.x, position.y);
    });
  }

  /**
   * Устанавливает прозрачность всех видимых индикаторов рилов
   * @param {number} alpha - Значение прозрачности (0-1)
   */
  setReelIndicatorsAlpha(alpha) {
    Object.values(this.reelIndicators).forEach(indicator => {
      const container = indicator.getContainer();
      if (container && container.visible) {
        container.alpha = alpha;
      }
    });
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
    
    // Уничтожаем индикаторы рилов
    Object.values(this.reelIndicators).forEach(indicator => {
      const container = indicator.getContainer();
      if (container.parent) {
        container.parent.removeChild(container);
      }
    });
    this.reelIndicators = {};
    
  }
}

