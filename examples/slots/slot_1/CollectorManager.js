import { SpineAnimation } from './SpineAnimation.js';
import { AclonicaText } from './AclonicaText.js';

export class CollectorManager {
  constructor(config, app, container, reelsContainer = null, aclonicaText = null) {
    this.config = config;
    this.app = app;
    this.container = container; // Контейнер для коллекторов (spineContainer)
    this.reelsContainer = null; // Ссылка на контейнер рилов для синхронизации позиции
    this.collectorSpines = {}; // Пул Spine: { "reelIndex_positionIndex": SpineAnimation }
    this.activeCollectors = new Set(); // Активные позиции коллекторов
    this.reels = null; // Массив SlotReel для скрытия/показа спрайтового коллектора
    this.collectorConfig = null; // Конфиг коллектора (загружается из collector_config.json)
    this.collectEffect = null; // Ссылка на CollectEffect для подписки на события
    this.miniWinText = null; // Ссылка на MiniWinText для показа выигрышей
    // Используем переданный экземпляр AclonicaText или создаем новый (для обратной совместимости)
    this.aclonicaText = aclonicaText || new AclonicaText();
    this.collectorTextSprites = {}; // Пул текстовых спрайтов: { "reelIndex_positionIndex": PIXI.Sprite }
    this.collectorValues = {}; // Значения коллекторов: { "reelIndex_positionIndex": number }
    this.collectorTextAlphaUpdaters = {}; // Функции обновления альфы: { "reelIndex_positionIndex": Function }
    this.winTextSprite = null; // Контейнер win текста с подложкой (остается до начала нового спина)
    this.ellipseTexture = null; // Текстура Ellipse.png для фона под текстом
  }

  /**
   * Загружает конфигурацию коллектора из JSON файла
   */
  async loadConfig() {
    try {
      const response = await fetch('./collector_config.json');
      this.collectorConfig = await response.json();
      console.log('CollectorManager: Config loaded', this.collectorConfig);
      
      // Загружаем текстуру Ellipse.png для фона под текстом
      try {
        this.ellipseTexture = await PIXI.Assets.load('./bg_png/Ellipse.png');
        console.log('CollectorManager: Ellipse texture loaded');
      } catch (error) {
        console.warn('CollectorManager: Failed to load Ellipse texture:', error);
      }
      
      return true;
    } catch (error) {
      console.error('CollectorManager: Failed to load config:', error);
      // Используем значения по умолчанию
      this.collectorConfig = {
        spineName: 'coin_collector',
        zIndex: 105,
        initialAnimation: 'idle',
        animationLoop: true,
        scale: { x: 1, y: 1 }
      };
      return false;
    }
  }

  /**
   * Устанавливает ссылку на массив reels (вызывается после инициализации reels в SlotMachine)
   * @param {Array} reels - Массив SlotReel
   */
  setReels(reels) {
    this.reels = reels;
  }

  /**
   * Устанавливает ссылку на CollectEffect (для информации, callback устанавливается в SlotMachine)
   * @param {CollectEffect} collectEffect - Экземпляр CollectEffect
   */
  setCollectEffect(collectEffect) {
    this.collectEffect = collectEffect;
  }

  /**
   * Устанавливает ссылку на MiniWinText для показа выигрышей
   * @param {MiniWinText} miniWinText - Экземпляр MiniWinText
   */
  setMiniWinText(miniWinText) {
    this.miniWinText = miniWinText;
  }

  /**
   * Синхронизирует позицию коллекторов с контейнером рилов (для учета сдвига от дебаггера)
   */
  syncWithReelsContainer(reelsContainer) {
    this.reelsContainer = reelsContainer;
    // Обновляем позиции всех уже созданных коллекторов
    this.updateAllCollectorPositions();
  }

  /**
   * Обновляет позиции всех созданных коллекторов (при изменении сдвига reelsContainer)
   */
  updateAllCollectorPositions() {
    Object.keys(this.collectorSpines).forEach(key => {
      const [reelIndex, positionIndex] = key.split('_').map(Number);
      const position = this.getGridPosition(reelIndex, positionIndex);
      const collectorSpine = this.collectorSpines[key];
      if (collectorSpine) {
        collectorSpine.setPosition(position.x, position.y);
      }
    });
  }

  /**
   * Вычисляет статичную позицию для коллектора на сетке (с учетом сдвига от дебаггера)
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
   * Показывает коллектор на указанной позиции сетки
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний)
   * @param {number} totalValue - Суммарное значение монеток, которые прилетят в коллектор
   */
  async showCollector(reelIndex, positionIndex, totalValue = 0) {
    const key = `${reelIndex}_${positionIndex}`;

    // Сохраняем значение коллектора
    this.collectorValues[key] = totalValue;
    console.log(`CollectorManager: showCollector called with totalValue = ${totalValue} for ${key}`);

    // Скрываем спрайтовый коллектор на риле
    if (this.reels && this.reels[reelIndex]) {
      this.reels[reelIndex].setCollectorSymbolVisible(positionIndex, false);
    }

    // Если коллектор уже активен - обновляем позицию (на случай сдвига) и показываем
    if (this.activeCollectors.has(key) && this.collectorSpines[key]) {
      const collectorSpine = this.collectorSpines[key];
      const position = this.getGridPosition(reelIndex, positionIndex);
      collectorSpine.setPosition(position.x, position.y);
      const container = collectorSpine.getContainer();
      container.visible = true;
      
      // Привязываем текст сразу после показа (как для монеток)
      this.attachTextToCollector(collectorSpine, totalValue, key);
      
      // Проигрываем анимацию появления, затем idle
      this.playCollectorAnimationSequence(collectorSpine);
      
      console.log(`CollectorManager: Collector at ${key} already active, updated position, value: ${totalValue}`);
      return;
    }

    // Если Spine еще не создан - создаем
    if (!this.collectorSpines[key]) {
      const position = this.getGridPosition(reelIndex, positionIndex);
      
      const spineName = this.collectorConfig ? this.collectorConfig.spineName : 'coin_collector';
      const initialAnimation = null; // Не устанавливаем начальную анимацию, запустим shot через playCollectorAnimationSequence
      const animationLoop = false;
      
      const collectorSpine = new SpineAnimation(
        this.config,
        this.app,
        this.container,
        spineName,
        initialAnimation,
        animationLoop
      );

      const loaded = await collectorSpine.load();
      if (!loaded) {
        console.warn(`CollectorManager: Failed to load collector Spine at ${key}`);
        return;
      }

      // Устанавливаем масштаб из конфига
      if (this.collectorConfig && this.collectorConfig.scale) {
        const container = collectorSpine.getContainer();
        container.scale.x = this.collectorConfig.scale.x;
        container.scale.y = this.collectorConfig.scale.y;
      }

      // Устанавливаем позицию
      collectorSpine.setPosition(position.x, position.y);

      // Устанавливаем zIndex (над символами, но под winframes)
      const container = collectorSpine.getContainer();
      const zIndex = this.collectorConfig ? this.collectorConfig.zIndex : 105;
      container.zIndex = zIndex; // Символы = 100, коллекторы = 105, winframes = 110
      container.visible = true; // Важно: делаем видимым!

      // Привязываем текст сразу после создания (как для монеток)
      this.attachTextToCollector(collectorSpine, totalValue, key);

      this.collectorSpines[key] = collectorSpine;
    } else {
      // Spine уже создан - полностью уничтожаем и пересоздаем для чистого состояния
      const oldCollectorSpine = this.collectorSpines[key];
      
      // Уничтожаем старый экземпляр
      if (oldCollectorSpine) {
        // Очищаем все треки и listeners
        if (oldCollectorSpine.spine && oldCollectorSpine.spine.state) {
          const state = oldCollectorSpine.spine.state;
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
            oldCollectorSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки
          }
          
          // Удаляем функцию обновления альфы
          if (oldCollectorSpine._textAlphaUpdateSet) {
            oldCollectorSpine._textAlphaUpdateSet.clear();
            delete oldCollectorSpine._textAlphaUpdateSet;
          }
        }
        
        // Удаляем контейнер из stage
        if (oldCollectorSpine.getContainer) {
          const container = oldCollectorSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (oldCollectorSpine.destroy) {
          oldCollectorSpine.destroy();
        }
      }
      
      // Удаляем ссылки
      delete this.collectorSpines[key];
      delete this.collectorTextSprites[key];
      
      // Создаем новый экземпляр
      const position = this.getGridPosition(reelIndex, positionIndex);
      
      const spineName = this.collectorConfig ? this.collectorConfig.spineName : 'coin_collector';
      const initialAnimation = null; // Не устанавливаем начальную анимацию, запустим shot через playCollectorAnimationSequence
      const animationLoop = false;
      
      const collectorSpine = new SpineAnimation(
        this.config,
        this.app,
        this.container,
        spineName,
        initialAnimation,
        animationLoop
      );

      const loaded = await collectorSpine.load();
      if (!loaded) {
        console.warn(`CollectorManager: Failed to load collector Spine at ${key}`);
        return;
      }

      // Устанавливаем масштаб из конфига
      if (this.collectorConfig && this.collectorConfig.scale) {
        const container = collectorSpine.getContainer();
        container.scale.x = this.collectorConfig.scale.x;
        container.scale.y = this.collectorConfig.scale.y;
      }

      // Устанавливаем позицию
      collectorSpine.setPosition(position.x, position.y);

      // Устанавливаем zIndex (над символами, но под winframes)
      const container = collectorSpine.getContainer();
      const zIndex = this.collectorConfig ? this.collectorConfig.zIndex : 105;
      container.zIndex = zIndex; // Символы = 100, коллекторы = 105, winframes = 110
      container.visible = true; // Важно: делаем видимым!

      // Привязываем текст сразу после создания (как для монеток)
      this.attachTextToCollector(collectorSpine, totalValue, key);

      this.collectorSpines[key] = collectorSpine;
    }

    // Запускаем последовательность анимаций (как для монеток - после привязки текста)
    const collectorSpine = this.collectorSpines[key];
    if (collectorSpine && collectorSpine.spine) {
      // Сохраняем reelIndex и positionIndex в collectorSpine для использования в callback
      collectorSpine.reelIndex = reelIndex;
      collectorSpine.positionIndex = positionIndex;
      this.playCollectorAnimationSequence(collectorSpine);
    }

    this.activeCollectors.add(key);
    console.log(`CollectorManager: Showing collector at ${key} with value ${totalValue}`);
  }

  /**
   * Проигрывает последовательность анимаций коллектора: появление -> idle
   * @param {SpineAnimation} collectorSpine - Spine анимация коллектора
   */
  playCollectorAnimationSequence(collectorSpine) {
    if (!collectorSpine || !collectorSpine.spine || !collectorSpine.spine.state) {
      console.log('CollectorManager: playCollectorAnimationSequence - collectorSpine or spine not available');
      return;
    }

    const key = `${collectorSpine.reelIndex}_${collectorSpine.positionIndex}`;
    console.log(`CollectorManager: playCollectorAnimationSequence START for ${key}`);

    // ВАЖНО: Очищаем все listeners перед установкой новых анимаций
    const state = collectorSpine.spine.state;
    if (state.tracks) {
      state.tracks.forEach((track, index) => {
        if (track && track.entry) {
          const entry = track.entry;
          if (entry.listener) {
            entry.listener = null; // Очищаем listener
          }
        }
      });
    }

    // Получаем список доступных анимаций
    const availableAnimations = collectorSpine.spine.state.data.skeletonData.animations.map(a => a.name);
    console.log(`CollectorManager: Available animations for ${key}:`, availableAnimations);

    // Проверяем наличие анимации появления
    const hasAppearAnimation = collectorSpine.spine.state.data.skeletonData.animations.some(
      anim => anim.name === 'appear' || anim.name === 'in' || anim.name === 'show'
    );
    console.log(`CollectorManager: Has appear animation for ${key}:`, hasAppearAnimation);

    if (hasAppearAnimation) {
      // Запускаем анимацию появления (однократно)
      const appearAnimName = collectorSpine.spine.state.data.skeletonData.animations.find(
        anim => anim.name === 'appear' || anim.name === 'in' || anim.name === 'show'
      )?.name || 'appear';
      
      const trackEntry = collectorSpine.spine.state.setAnimation(0, appearAnimName, false);
      console.log(`CollectorManager: Playing appear animation "${appearAnimName}" for ${key}`);

      if (trackEntry) {
        trackEntry.listener = {
          complete: () => {
            console.log(`CollectorManager: Appear animation completed for ${key}, switching to shot`);
            // После завершения появления запускаем shot (однократно)
            if (collectorSpine.spine && collectorSpine.spine.state) {
              collectorSpine.spine.state.clearTrack(0); // Очищаем только трек 0
              collectorSpine.spine.state.setEmptyAnimation(0, 0); // Устанавливаем пустую анимацию для чистой очистки
              const shotTrackEntry = collectorSpine.spine.state.setAnimation(0, 'shot', false);
              console.log(`CollectorManager: Shot animation set for ${key}, trackEntry:`, shotTrackEntry ? 'OK' : 'FAILED');
              if (shotTrackEntry) {
                shotTrackEntry.listener = {
                  event: (entry, event) => {
                    console.log(`CollectorManager: Event "${event.data.name}" triggered in shot animation for ${key}`);
                    // При событии start_flight запускаем анимацию hit_coin в CollectEffect (выстрел в поезд)
                    if (event.data.name === 'start_flight' && this.collectEffect) {
                      // Получаем позицию коллектора для передачи в collect effect
                      const container = collectorSpine.getContainer();
                      const startPosition = {
                        x: container.x,
                        y: container.y
                      };
                      
                      // Получаем reelIndex и positionIndex из collectorSpine (сохранены в showCollector)
                      const reelIndex = collectorSpine.reelIndex;
                      const positionIndex = collectorSpine.positionIndex;
                      
                      // Создаем callback для завершения анимации hit_coin
                      const collectorKey = `${reelIndex}_${positionIndex}`;
                      const collectorSpineRef = collectorSpine;
                      const onFlightComplete = () => {
                        console.log(`CollectorManager: Flight to train completed for collector at ${collectorKey}`);
                        // После перелета коллектор остается в idle (уже переключится после завершения shot)
                      };
                      
                      // Проигрываем анимацию hit_coin в collect effect (перелет в поезд)
                      // Не передаем customEndPosition, чтобы использовалась позиция поезда
                      // targetType: 'train' по умолчанию
                      this.collectEffect.playHitCoin(startPosition, onFlightComplete).catch(err => {
                        console.error('CollectorManager: Error playing hit_coin:', err);
                      });
                      console.log(`CollectorManager: start_flight event triggered, playing hit_coin to train at (${startPosition.x}, ${startPosition.y})`);
                    }
                  },
                  complete: () => {
                    console.log(`CollectorManager: Shot animation completed for ${key}, switching to idle`);
                    // После завершения shot переключаемся на idle в цикле
                    if (collectorSpine.spine && collectorSpine.spine.state) {
                      collectorSpine.spine.state.setAnimation(0, 'idle', true);
                      console.log(`CollectorManager: Idle animation started (loop) for ${key}`);
                    }
                  }
                };
              }
            }
          }
        };
      } else {
        console.warn(`CollectorManager: Failed to set appear animation for ${key}`);
      }
    } else {
      // Если анимации появления нет, сразу запускаем shot (однократно)
      console.log(`CollectorManager: No appear animation found for ${key}, playing shot directly`);
      // Очищаем трек перед установкой новой анимации
      collectorSpine.spine.state.clearTrack(0); // Очищаем только трек 0
      collectorSpine.spine.state.setEmptyAnimation(0, 0); // Устанавливаем пустую анимацию для чистой очистки
      const shotTrackEntry = collectorSpine.spine.state.setAnimation(0, 'shot', false);
      console.log(`CollectorManager: Shot animation set directly for ${key}, trackEntry:`, shotTrackEntry ? 'OK' : 'FAILED');
      if (shotTrackEntry) {
        shotTrackEntry.listener = {
          event: (entry, event) => {
            console.log(`CollectorManager: Event "${event.data.name}" triggered in shot animation (no appear) for ${key}`);
            // При событии start_flight запускаем анимацию hit_coin в CollectEffect (выстрел в поезд)
            if (event.data.name === 'start_flight' && this.collectEffect) {
              // Получаем позицию коллектора для передачи в collect effect
              const container = collectorSpine.getContainer();
              const startPosition = {
                x: container.x,
                y: container.y
              };
              
              // Получаем reelIndex и positionIndex из collectorSpine (сохранены в showCollector)
              const reelIndex = collectorSpine.reelIndex;
              const positionIndex = collectorSpine.positionIndex;
              
              // Создаем callback для завершения анимации hit_coin
              const collectorKey = `${reelIndex}_${positionIndex}`;
              const collectorSpineRef = collectorSpine;
              const onFlightComplete = () => {
                console.log(`CollectorManager: Flight to train completed for collector at ${collectorKey}`);
                // После перелета коллектор остается в idle (уже переключится после завершения shot)
              };
              
              // Проигрываем анимацию hit_coin в collect effect (перелет в поезд)
              // Не передаем customEndPosition, чтобы использовалась позиция поезда
              // targetType: 'train' по умолчанию
              this.collectEffect.playHitCoin(startPosition, onFlightComplete).catch(err => {
                console.error('CollectorManager: Error playing hit_coin:', err);
              });
              console.log(`CollectorManager: start_flight event triggered, playing hit_coin to train at (${startPosition.x}, ${startPosition.y})`);
            }
          },
          complete: () => {
            console.log(`CollectorManager: Shot animation completed (no appear) for ${key}, switching to idle`);
            // После завершения shot переключаемся на idle в цикле
            if (collectorSpine.spine && collectorSpine.spine.state) {
              collectorSpine.spine.state.setAnimation(0, 'idle', true);
              console.log(`CollectorManager: Idle animation started (loop, no appear) for ${key}`);
            }
          }
        };
      } else {
        console.warn(`CollectorManager: Failed to set shot animation directly for ${key}`);
      }
    }
    console.log(`CollectorManager: playCollectorAnimationSequence END for ${key}`);
  }

  /**
   * Скрывает коллектор на указанной позиции
   */
  hideCollector(reelIndex, positionIndex) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Показываем спрайтовый коллектор на риле обратно
    if (this.reels && this.reels[reelIndex]) {
      this.reels[reelIndex].setCollectorSymbolVisible(positionIndex, true);
    }
    
    if (this.collectorSpines[key]) {
      const collectorSpine = this.collectorSpines[key];
      
      // Очищаем все треки анимации перед скрытием
      if (collectorSpine && collectorSpine.spine && collectorSpine.spine.state) {
        try {
          // Сначала очищаем все listeners, чтобы избежать утечек памяти и конфликтов
          const state = collectorSpine.spine.state;
          if (state.tracks) {
            state.tracks.forEach((track, index) => {
              if (track && track.entry) {
                const entry = track.entry;
                if (entry.listener) {
                  entry.listener = null; // Очищаем listener
                }
              }
            });
          }
          
          // Теперь очищаем все треки
          state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          collectorSpine.spine.removeSlotObject('text_holder');
          
          // Удаляем функцию обновления альфы, если она была установлена
          if (collectorSpine._textAlphaUpdateSet && this.collectorTextAlphaUpdaters[key]) {
            collectorSpine._textAlphaUpdateSet.delete(this.collectorTextAlphaUpdaters[key]);
            delete this.collectorTextAlphaUpdaters[key];
            
            // Если больше нет текстов, очищаем Set
            if (collectorSpine._textAlphaUpdateSet.size === 0) {
              delete collectorSpine._textAlphaUpdateSet;
            }
          }
        } catch (e) {
          console.warn(`CollectorManager: Error cleaning up collector Spine at ${key}:`, e);
        }
      }
      
      // Скрываем контейнер
      const container = collectorSpine.getContainer();
      if (container) {
        container.visible = false;
      }
      
      // Удаляем ссылку на текстовый спрайт
      delete this.collectorTextSprites[key];
      delete this.collectorValues[key];
      
      this.activeCollectors.delete(key);
      console.log(`CollectorManager: Hiding collector at ${key}`);
    }
  }

  /**
   * Скрывает все коллекторы
   */
  hideAllCollectors() {
    const keysToHide = Array.from(this.activeCollectors);
    keysToHide.forEach(key => {
      const [reelIndex, positionIndex] = key.split('_').map(Number);
      this.hideCollector(reelIndex, positionIndex);
    });
    this.activeCollectors.clear();
  }

  /**
   * Проверяет, есть ли активные коллекторы на экране
   * @returns {boolean} true если есть активные коллекторы
   */
  hasActiveCollectors() {
    return this.activeCollectors.size > 0;
  }

  /**
   * Проигрывает последовательность анимаций реакции коллектора на удар монетки
   * Последовательность: train_to_mult -> win_mult -> disable_mult
   * Использует простой подход с addAnimation на треке 0 (как в basic_copy.html)
   * @param {number} reelIndex - Индекс рила конкретного коллектора (если указан, проигрывает только для него)
   * @param {number} positionIndex - Индекс позиции конкретного коллектора (если указан, проигрывает только для него)
   */
  playHitAnimation(reelIndex = null, positionIndex = null) {
    console.log(`CollectorManager: playHitAnimation START, active collectors:`, Array.from(this.activeCollectors));
    
    // Определяем, для каких коллекторов проигрывать анимацию
    let collectorsToAnimate = [];
    
    if (reelIndex !== null && positionIndex !== null) {
      // Если указан конкретный коллектор, проигрываем только для него
      const key = `${reelIndex}_${positionIndex}`;
      if (this.activeCollectors.has(key)) {
        collectorsToAnimate = [key];
        console.log(`CollectorManager: Playing hit animation for specific collector: ${key}`);
      } else {
        console.warn(`CollectorManager: Collector ${key} not found in active collectors`);
        return;
      }
    } else {
      // Если не указан конкретный коллектор, проигрываем для всех (старое поведение для совместимости)
      collectorsToAnimate = Array.from(this.activeCollectors);
      console.log(`CollectorManager: Playing hit animation for all collectors`);
    }
    
    // Проигрываем последовательность анимаций для выбранных коллекторов
    collectorsToAnimate.forEach(key => {
      const collectorSpine = this.collectorSpines[key];
      if (collectorSpine && collectorSpine.spine && collectorSpine.spine.state) {
        // Получаем текущую анимацию
        const currentTrack = collectorSpine.spine.state.tracks[0];
        const currentAnimation = currentTrack && currentTrack.animation ? currentTrack.animation.name : 'none';
        console.log(`CollectorManager: playHitAnimation for ${key}, current animation: "${currentAnimation}"`);
        
        // Проверяем наличие необходимых анимаций
        const hasTrainToMult = collectorSpine.spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'train_to_mult'
        );
        const hasWinMult = collectorSpine.spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'win_mult'
        );
        const hasDisableMult = collectorSpine.spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'disable_mult'
        );
        
        console.log(`CollectorManager: Animations for ${key} - train_to_mult: ${hasTrainToMult}, win_mult: ${hasWinMult}, disable_mult: ${hasDisableMult}`);
        
        if (hasTrainToMult) {
          // Получаем значение коллектора
          const totalValue = this.collectorValues[key] || 0;
          console.log(`CollectorManager: Playing animation sequence for ${key} with value ${totalValue}`);
          
          // Если коллектор сейчас играет shot, добавляем train_to_mult в очередь после shot
          if (currentAnimation === 'shot') {
            console.log(`CollectorManager: Collector ${key} is playing shot, will queue train_to_mult after shot completes`);
            
            // Сохраняем текущий listener для shot
            const currentTrackEntry = currentTrack;
            const originalListener = currentTrackEntry.listener;
            
            // Переопределяем complete listener для shot, чтобы после него запустить train_to_mult
            currentTrackEntry.listener = {
              event: originalListener && originalListener.event ? originalListener.event : undefined,
              complete: () => {
                // Вызываем оригинальный complete (если был), но не переключаемся на idle
                if (originalListener && originalListener.complete) {
                  // Не вызываем оригинальный complete, чтобы не переключиться на idle
                  // originalListener.complete();
                }
                
                // Теперь запускаем последовательность train_to_mult -> win_mult -> disable_mult
                // Очищаем трек 0 перед началом последовательности
                collectorSpine.spine.state.clearTrack(0);
                collectorSpine.spine.state.setEmptyAnimation(0, 0);
                
                // Создаем массив анимаций для последовательности
                const animations = [];
                
                // Добавляем train_to_mult
                animations.push({ name: 'train_to_mult', loop: false, delay: 0 });
                
                // Добавляем win_mult
                if (hasWinMult) {
                  animations.push({ name: 'win_mult', loop: false, delay: 0 });
                }
                
                // Добавляем disable_mult (если есть)
                if (hasDisableMult) {
                  animations.push({ name: 'disable_mult', loop: false, delay: 0 });
                }
                
                // Проигрываем последовательность используя простой подход как в basic_copy.html
                animations.forEach(({ name, loop, delay }, index) => {
                  if (index === 0) {
                    // Первая анимация (train_to_mult)
                    collectorSpine.spine.state.setAnimation(0, name, loop);
                    console.log(`CollectorManager: Playing "${name}" on track 0 for ${key} (after shot)`);
                  } else {
                    // Последующие анимации добавляем через addAnimation
                    const trackEntry = collectorSpine.spine.state.addAnimation(0, name, loop, delay);
                    
                    // Если это последняя анимация (disable_mult или win_mult), устанавливаем listener
                    if (index === animations.length - 1) {
                      if (trackEntry) {
                        trackEntry.listener = {
                          complete: () => {
                            console.log(`CollectorManager: Animation sequence completed for ${key}`);
                            
                            // Если это win_mult (последняя, если нет disable_mult), показываем win текст
                            if (name === 'win_mult' && !hasDisableMult) {
                              const totalValue = this.getTotalCollectorsValue();
                              console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                              this.showCollectorWinText();
                            }
                            
                            // Если это disable_mult, показываем win текст и остаемся в последнем состоянии
                            if (name === 'disable_mult') {
                              const totalValue = this.getTotalCollectorsValue();
                              console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                              this.showCollectorWinText();
                              console.log(`CollectorManager: Staying in final state of disable_mult for ${key}`);
                            }
                          }
                        };
                      }
                    } else if (name === 'win_mult') {
                      // Если win_mult не последняя, устанавливаем listener для показа win текста
                      if (trackEntry) {
                        trackEntry.listener = {
                          complete: () => {
                            const totalValue = this.getTotalCollectorsValue();
                            console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                            this.showCollectorWinText();
                          }
                        };
                      }
                    }
                    
                    console.log(`CollectorManager: Adding "${name}" on track 0 for ${key} (delay: ${delay})`);
                  }
                });
              }
            };
          } else {
            // Если коллектор не играет shot (уже в idle или другой анимации), сразу запускаем последовательность
            // Очищаем трек 0 перед началом последовательности
            collectorSpine.spine.state.clearTrack(0);
            collectorSpine.spine.state.setEmptyAnimation(0, 0);
            
            // Создаем массив анимаций для последовательности
            const animations = [];
            
            // Добавляем train_to_mult
            animations.push({ name: 'train_to_mult', loop: false, delay: 0 });
            
            // Добавляем win_mult
            if (hasWinMult) {
              animations.push({ name: 'win_mult', loop: false, delay: 0 });
            }
            
            // Добавляем disable_mult (если есть)
            if (hasDisableMult) {
              animations.push({ name: 'disable_mult', loop: false, delay: 0 });
            }
            
            // Проигрываем последовательность используя простой подход как в basic_copy.html
            animations.forEach(({ name, loop, delay }, index) => {
              if (index === 0) {
                // Первая анимация (train_to_mult)
                collectorSpine.spine.state.setAnimation(0, name, loop);
                console.log(`CollectorManager: Playing "${name}" on track 0 for ${key} (first)`);
              } else {
                // Последующие анимации добавляем через addAnimation
                const trackEntry = collectorSpine.spine.state.addAnimation(0, name, loop, delay);
                
                // Если это последняя анимация (disable_mult или win_mult), устанавливаем listener
                if (index === animations.length - 1) {
                  if (trackEntry) {
                    trackEntry.listener = {
                      complete: () => {
                        console.log(`CollectorManager: Animation sequence completed for ${key}`);
                        
                        // Если это win_mult (последняя, если нет disable_mult), показываем win текст
                        if (name === 'win_mult' && !hasDisableMult) {
                          const totalValue = this.getTotalCollectorsValue();
                          console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                          this.showCollectorWinText();
                        }
                        
                        // Если это disable_mult, показываем win текст и остаемся в последнем состоянии
                        if (name === 'disable_mult') {
                          const totalValue = this.getTotalCollectorsValue();
                          console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                          this.showCollectorWinText();
                          console.log(`CollectorManager: Staying in final state of disable_mult for ${key}`);
                        }
                      }
                    };
                  }
                } else if (name === 'win_mult') {
                  // Если win_mult не последняя, устанавливаем listener для показа win текста
                  if (trackEntry) {
                    trackEntry.listener = {
                      complete: () => {
                        const totalValue = this.getTotalCollectorsValue();
                        console.log(`CollectorManager: Showing win text ${totalValue} (sum of all collectors) for ${key}`);
                        this.showCollectorWinText();
                      }
                    };
                  }
                }
                
                console.log(`CollectorManager: Adding "${name}" on track 0 for ${key} (delay: ${delay})`);
              }
            });
          }
        } else {
          console.warn(`CollectorManager: train_to_mult animation not found for ${key}`);
        }
      } else {
        console.warn(`CollectorManager: Collector spine not available for ${key}`);
      }
    });
    console.log(`CollectorManager: playHitAnimation END`);
  }

  /**
   * Прикрепляет текст к коллектору через Spine slot
   * @param {SpineAnimation} collectorSpine - Spine анимация коллектора
   * @param {number} value - Значение для отображения (например, 5.25)
   * @param {string} key - Ключ коллектора для сохранения ссылки на спрайт текста
   */
  attachTextToCollector(collectorSpine, value, key) {
    if (!collectorSpine || !collectorSpine.spine) {
      console.warn('CollectorManager: Cannot attach text - collector spine not loaded');
      return;
    }

    // Ищем слот text_holder
    const textSlot = collectorSpine.spine.skeleton.findSlot('text_holder');
    if (!textSlot) {
      console.warn('CollectorManager: Slot "text_holder" not found in collector Spine');
      return;
    }

    // Удаляем предыдущий текст, если он был добавлен
    if (this.collectorTextSprites[key]) {
      try {
        collectorSpine.spine.removeSlotObject('text_holder');
      } catch (e) {
        // Игнорируем ошибки, если объекта уже нет
      }
    }

    // Форматируем значение (округляем и добавляем "х")
    // Если value = 0, показываем "0х" (как для монеток всегда показывается значение)
    const formattedValue = value > 0 ? `${Math.round(value)}х` : '0х';

    // Создаем текстовый спрайт (точно так же, как для монеток)
    const textSprite = this.aclonicaText.createText(formattedValue, {
      fontSize: 45,
      lineHeight: 52,
      color: '#FFFFFF',
      borderColor: '#6B0060',
      borderWidth: 4
    });

    // Центрируем текст (anchor в центре)
    textSprite.anchor.set(0.5);

    // Прикрепляем текст к слоту через addSlotObject (точно так же, как для монеток)
    collectorSpine.spine.addSlotObject('text_holder', textSprite);
    
    // Устанавливаем обновление альфы текста синхронно с альфой слота
    // Это нужно, чтобы текст наследовал альфу слота во время анимаций
    // Используем afterUpdateWorldTransforms, чтобы обновлять альфу после обновления скелета
    if (!collectorSpine._textAlphaUpdateSet) {
      collectorSpine._textAlphaUpdateSet = new Set();
      const originalAfterUpdate = collectorSpine.spine.afterUpdateWorldTransforms;
      collectorSpine.spine.afterUpdateWorldTransforms = () => {
        // Вызываем оригинальный afterUpdateWorldTransforms, если он был
        if (originalAfterUpdate) {
          originalAfterUpdate.call(collectorSpine.spine);
        }
        
        // Обновляем альфу для всех текстов этого коллектора
        collectorSpine._textAlphaUpdateSet.forEach(updateFn => updateFn());
      };
    }
    
    // Добавляем функцию обновления альфы для этого текста
    const updateTextAlpha = () => {
      if (textSlot && textSlot.color && textSprite) {
        textSprite.alpha = textSlot.color.a;
      }
    };
    collectorSpine._textAlphaUpdateSet.add(updateTextAlpha);
    
    // Обновляем альфу сразу после добавления
    updateTextAlpha();

    // Сохраняем ссылку на текстовый спрайт
    this.collectorTextSprites[key] = textSprite;

    console.log(`CollectorManager: Attached text "${formattedValue}" to collector via text_holder slot`);
  }

  /**
   * Получает сумму значений всех активных коллекторов
   * @returns {number} Сумма значений всех коллекторов
   */
  getTotalCollectorsValue() {
    let total = 0;
    this.activeCollectors.forEach(key => {
      if (this.collectorValues[key] !== undefined && this.collectorValues[key] !== null) {
        total += this.collectorValues[key];
      }
    });
    return total;
  }

  /**
   * Показывает win текст для коллектора (остается до начала нового спина)
   * @param {number} amount - Сумма выигрыша (если не указана, берется сумма всех коллекторов)
   */
  showCollectorWinText(amount) {
    // Если win текст уже показан, не показываем повторно
    if (this.winTextSprite) {
      return;
    }
    
    // Если amount не указан, используем сумму всех коллекторов
    if (amount === undefined || amount === null) {
      amount = this.getTotalCollectorsValue();
    }
    
    if (!this.miniWinText || !this.app) {
      console.warn('CollectorManager: miniWinText or app not set, cannot show win text');
      return;
    }

    // Удаляем предыдущий win текст, если есть
    this.hideCollectorWinText();

    const position = {
      x: this.config.resolution.width / 2,
      y: this.config.resolution.height / 2
    };
    
    // Создаем контейнер для win текста с подложкой
    const winTextGroup = new PIXI.Container();
    winTextGroup.x = position.x;
    winTextGroup.y = position.y;
    
    // Добавляем Ellipse подложку (позиция 0,0 относительно контейнера)
    if (this.ellipseTexture) {
      const ellipseSprite = new PIXI.Sprite(this.ellipseTexture);
      ellipseSprite.anchor.set(0.5);
      ellipseSprite.x = 0;
      ellipseSprite.y = 0;
      winTextGroup.addChild(ellipseSprite);
    }
    
    // Добавляем текст (тоже 0,0 относительно контейнера)
    const textValue = typeof amount === 'number' ? amount.toFixed(2) : amount;
    const textSprite = this.miniWinText.createGolden3DText(textValue, {
      fontSize: 120,
      padding: 40
    });
    textSprite.anchor.set(0.5);
    textSprite.x = 0;
    textSprite.y = 0;
    winTextGroup.addChild(textSprite);
    
    winTextGroup.zIndex = 400; // Выше всего
    this.app.stage.addChild(winTextGroup);
    
    // Анимация появления
    const startTime = Date.now();
    const duration = 600; // 600ms
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out back функция
      const easeOutBack = (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };
      
      const eased = easeOutBack(progress);
      
      winTextGroup.scale.set(eased);
      winTextGroup.alpha = progress;
      winTextGroup.rotation = -0.1 * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
    
    // Сохраняем ссылку на win текст контейнер
    this.winTextSprite = winTextGroup;
    console.log(`CollectorManager: Showing win text ${amount} with background`);
  }

  /**
   * Скрывает win текст коллектора (вызывается при начале нового спина)
   */
  hideCollectorWinText() {
    if (this.winTextSprite) {
      if (this.winTextSprite.parent) {
        this.app.stage.removeChild(this.winTextSprite);
      }
      this.winTextSprite.destroy({ children: true });
      this.winTextSprite = null;
      console.log('CollectorManager: Win text hidden');
    }
  }

  /**
   * Уничтожает все Spine коллекторы
   */
  destroy() {
    Object.values(this.collectorSpines).forEach(collectorSpine => {
      const container = collectorSpine.getContainer();
      if (container.parent) {
        container.parent.removeChild(container);
      }
    });
    this.collectorSpines = {};
    this.activeCollectors.clear();
  }
}

