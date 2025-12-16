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
    // Используем переданный экземпляр AclonicaText или создаем новый (для обратной совместимости)
    this.aclonicaText = aclonicaText || new AclonicaText();
    this.collectorTextSprites = {}; // Пул текстовых спрайтов: { "reelIndex_positionIndex": PIXI.Sprite }
    this.collectorValues = {}; // Значения коллекторов: { "reelIndex_positionIndex": number }
    this.collectorTextAlphaUpdaters = {}; // Функции обновления альфы: { "reelIndex_positionIndex": Function }
  }

  /**
   * Загружает конфигурацию коллектора из JSON файла
   */
  async loadConfig() {
    try {
      const response = await fetch('./collector_config.json');
      this.collectorConfig = await response.json();
      console.log('CollectorManager: Config loaded', this.collectorConfig);
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
      // Spine уже создан, обновляем позицию (на случай сдвига от дебаггера) и показываем
      const collectorSpine = this.collectorSpines[key];
      const position = this.getGridPosition(reelIndex, positionIndex);
      collectorSpine.setPosition(position.x, position.y);
      const container = collectorSpine.getContainer();
      container.visible = true;
      
      // Привязываем текст сразу после показа (как для монеток)
      this.attachTextToCollector(collectorSpine, totalValue, key);
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
      return;
    }

    // Проверяем наличие анимации появления
    const hasAppearAnimation = collectorSpine.spine.state.data.skeletonData.animations.some(
      anim => anim.name === 'appear' || anim.name === 'in' || anim.name === 'show'
    );

    if (hasAppearAnimation) {
      // Запускаем анимацию появления (однократно)
      const appearAnimName = collectorSpine.spine.state.data.skeletonData.animations.find(
        anim => anim.name === 'appear' || anim.name === 'in' || anim.name === 'show'
      )?.name || 'appear';
      
      const trackEntry = collectorSpine.spine.state.setAnimation(0, appearAnimName, false);

      if (trackEntry) {
        trackEntry.listener = {
          complete: () => {
            // После завершения появления запускаем shot (однократно)
            if (collectorSpine.spine && collectorSpine.spine.state) {
              collectorSpine.spine.state.clearTracks();
              const shotTrackEntry = collectorSpine.spine.state.setAnimation(0, 'shot', false);
              if (shotTrackEntry) {
                shotTrackEntry.listener = {
                  event: (entry, event) => {
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
                    // После завершения shot переключаемся на idle в цикле
                    if (collectorSpine.spine && collectorSpine.spine.state) {
                      collectorSpine.spine.state.setAnimation(0, 'idle', true);
                      console.log('CollectorManager: Shot animation completed, switched to idle');
                    }
                  }
                };
              }
              console.log('CollectorManager: Appear animation completed, switched to shot');
            }
          }
        };
      }
    } else {
      // Если анимации появления нет, сразу запускаем shot (однократно)
      // Очищаем трек перед установкой новой анимации
      collectorSpine.spine.state.clearTracks();
      const shotTrackEntry = collectorSpine.spine.state.setAnimation(0, 'shot', false);
      if (shotTrackEntry) {
        shotTrackEntry.listener = {
          event: (entry, event) => {
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
            // После завершения shot переключаемся на idle в цикле
            if (collectorSpine.spine && collectorSpine.spine.state) {
              collectorSpine.spine.state.setAnimation(0, 'idle', true);
              console.log('CollectorManager: Shot animation completed, switched to idle');
            }
          }
        };
      }
      console.log('CollectorManager: No appear animation, playing shot directly');
    }
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
          collectorSpine.spine.state.clearTracks();
          
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
   * Проигрывает анимацию реакции на удар монетки (train_to_mult)
   * Вызывается при событии collect_effect_hit
   */
  playHitAnimation() {
    // Проигрываем анимацию train_to_mult для всех активных коллекторов
    this.activeCollectors.forEach(key => {
      const collectorSpine = this.collectorSpines[key];
      if (collectorSpine && collectorSpine.spine && collectorSpine.spine.state) {
        // Проверяем наличие анимации train_to_mult
        const hasTrainToMult = collectorSpine.spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'train_to_mult'
        );
        
        if (hasTrainToMult) {
          // Получаем значение коллектора
          const totalValue = this.collectorValues[key] || 0;
          
          // Текст уже должен быть привязан при показе коллектора (как для монеток)
          // Просто проигрываем анимацию train_to_mult
          const trackEntry = collectorSpine.spine.state.setAnimation(0, 'train_to_mult', false);
          
          if (trackEntry) {
            trackEntry.listener = {
              complete: () => {
                // После завершения train_to_mult переключаемся на idle_mult в цикле
                if (collectorSpine.spine && collectorSpine.spine.state) {
                  // Проверяем наличие анимации idle_mult
                  const hasIdleMult = collectorSpine.spine.state.data.skeletonData.animations.some(
                    anim => anim.name === 'idle_mult'
                  );
                  
                  if (hasIdleMult) {
                    collectorSpine.spine.state.setAnimation(0, 'idle_mult', true);
                    console.log('CollectorManager: train_to_mult completed, switched to idle_mult');
                  } else {
                    // Если idle_mult нет, возвращаемся к обычному idle
                    collectorSpine.spine.state.setAnimation(0, 'shot', true);
                    console.log('CollectorManager: train_to_mult completed, switched to idle (idle_mult not found)');
                  }
                }
              }
            };
            console.log(`CollectorManager: Playing train_to_mult animation for collector at ${key} with value ${totalValue}`);
          } else {
            console.warn(`CollectorManager: Failed to play train_to_mult animation for collector at ${key}`);
          }
        } else {
          console.warn(`CollectorManager: train_to_mult animation not found for collector at ${key}`);
        }
      }
    });
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

