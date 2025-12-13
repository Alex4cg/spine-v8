// WinLineManager.js
import { SpineAnimation } from './SpineAnimation.js';
import { MiniWinText } from './MiniWinText.js';

export class WinLineManager {
  constructor(config, app, stage) {
    this.config = config;
    this.app = app;
    this.stage = stage;
    this.spineAnimation = null; // Основной Spine (для одновременного показа)
    this.lineSpines = {}; // Объект с отдельными Spine для каждой линии {1: SpineAnimation, 2: SpineAnimation, ...}
    this.activeLines = []; // Массив номеров линий (1-5)
    this.isCycling = false; // Флаг перебора линий
    this.cycleIndex = 0;
    this.reelsContainer = null; // Ссылка на контейнер рилов для синхронизации позиции
    this.trackListeners = {}; // Слушатели событий треков
    this.currentCycleEntry = null; // Текущий TrackEntry для цикла
    this.winFrameAnimation = null; // Ссылка на WinFrameAnimation для синхронизации
    this.reels = null; // Ссылка на рилы для winframes
    this.miniWinText = null; // Экземпляр MiniWinText
    this.currentWinTextSprite = null; // Текущий контейнер с текстом и фоном
    this.winTextContainer = null; // Контейнер для текстов выигрышей
    this.lineWinAmount = 5.00; // Стоимость одной линии
    this.ellipseTexture = null; // Текстура Ellipse.png
  }
  
  /**
   * Устанавливает ссылку на WinFrameAnimation и рилы
   */
  setWinFrameAnimation(winFrameAnimation, reels) {
    this.winFrameAnimation = winFrameAnimation;
    this.reels = reels;
  }
  
  async init() {
    // Загружаем Spine винлайнов
    this.spineAnimation = new SpineAnimation(
      this.config,
      this.app,
      this.stage,
      'winline',
      null, // Без начальной анимации
      false
    );
    
    const loaded = await this.spineAnimation.load();
    if (!loaded) {
      console.warn('WinLineManager: Failed to load winline Spine');
      return false;
    }
    
    // Позиционируем винлайны
    const container = this.spineAnimation.getContainer();
    container.zIndex = 99; // Под символами (символы zIndex = 100)
    
    // Инициализируем MiniWinText
    this.miniWinText = new MiniWinText();
    
    // Загружаем текстуру Ellipse.png для фона под текстом
    try {
      this.ellipseTexture = await PIXI.Assets.load('./bg_png/Ellipse.png');
      console.log('WinLineManager: Ellipse texture loaded');
    } catch (error) {
      console.warn('WinLineManager: Failed to load Ellipse texture:', error);
    }
    
    // Создаем контейнер для текстов выигрышей
    this.winTextContainer = new PIXI.Container();
    this.winTextContainer.zIndex = 115; // Над винфреймами (110)
    this.winTextContainer.sortableChildren = true;
    this.stage.addChild(this.winTextContainer);
    
    console.log('WinLineManager: Initialized');
    
    return true;
  }
  
  /**
   * Получает Y позицию для линии по positionIndex (с учетом сдвига от дебаггера)
   */
  getLineYPosition(positionIndex) {
    if (!this.config || !this.config.startPosition) {
      return 0;
    }
    
    const startY = this.config.startPosition.y;
    const symbolHeight = this.config.symbolSize.height;
    // positionIndex: 0 = второй ряд, 1 = третий, 2 = четвертый
    const actualRowIndex = positionIndex; // 0, 1, 2
    
    // Учитываем сдвиг от дебаггера (если reelsContainer сдвинут)
    const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;
    
    return startY + (actualRowIndex * symbolHeight) + (symbolHeight / 2) + offsetY;
  }
  
  /**
   * Получает positionIndex для номера линии
   */
  getLinePositionIndex(lineNumber) {
    const lineMap = {
      1: 0, // Нижняя горизонталь (второй ряд)
      2: 1, // Средняя горизонталь (третий ряд)
      3: 2, // Верхняя горизонталь (четвертый ряд)
      4: 1, // Диагональ снизу-вверх (третий ряд)
      5: 1  // Диагональ сверху-вниз (третий ряд)
    };
    return lineMap[lineNumber] !== undefined ? lineMap[lineNumber] : 1;
  }
  
  /**
   * Показывает текст выигрыша
   * @param {number} amount - Сумма выигрыша
   * @param {number|null} lineNumber - Номер линии (null = центр поля)
   */
  showWinText(amount, lineNumber = null) {
    // Удаляем предыдущий текст
    this.hideWinText();
    
    if (!this.miniWinText || !this.winTextContainer) {
      return;
    }
    
    // Учитываем сдвиг от дебаггера
    const offsetX = this.reelsContainer ? this.reelsContainer.x : 0;
    const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;
    
    const centerX = this.config.startPosition.x + (this.config.reels.count * this.config.symbolSize.width) / 2 + offsetX;
    let centerY;
    
    if (lineNumber === null) {
      // Одновременный показ - центр игрового поля
      const gameAreaHeight = this.config.reels.symbolsPerReel * this.config.symbolSize.height;
      centerY = this.config.startPosition.y + gameAreaHeight / 2 + offsetY;
    } else {
      // Перебор - на уровне линии (getLineYPosition уже учитывает offsetY)
      const positionIndex = this.getLinePositionIndex(lineNumber);
      centerY = this.getLineYPosition(positionIndex);
    }
    
    // Создаем один контейнер для текста и фона
    const winTextGroup = new PIXI.Container();
    winTextGroup.x = centerX;
    winTextGroup.y = centerY;
    winTextGroup.zIndex = 115;
    
    // Определяем целевой масштаб: 1.1 (на 10% больше) для общей суммы, 1.0 для отдельных линий
    const targetScale = lineNumber === null ? 1.1 : 1.0;
    
    // Добавляем Ellipse (позиция 0,0 относительно контейнера)
    if (this.ellipseTexture) {
      const ellipseSprite = new PIXI.Sprite(this.ellipseTexture);
      ellipseSprite.anchor.set(0.5);
      ellipseSprite.x = 0;
      ellipseSprite.y = 0;
      winTextGroup.addChild(ellipseSprite);
    }
    
    // Добавляем текст (тоже 0,0 относительно контейнера)
    // Используем createGolden3DText напрямую, так как анимируем контейнер, а не спрайт
    const textValue = typeof amount === 'number' ? amount.toFixed(2) : amount;
    const sprite = this.miniWinText.createGolden3DText(textValue);
    sprite.x = 0;
    sprite.y = 0;
    sprite.anchor.set(0.5); // Центрирование
    // Не устанавливаем scale(0) и alpha(0), так как анимируем контейнер
    sprite.scale.set(1);
    sprite.alpha = 1;
    winTextGroup.addChild(sprite);
    
    // Сохраняем ссылку на контейнер
    this.currentWinTextSprite = winTextGroup;
    
    // Анимируем сам контейнер
    // Начальное состояние: scale = 0.5, alpha = 0.5 (чтобы избежать мигания)
    winTextGroup.scale.set(0.5);
    winTextGroup.alpha = 0.5;
    
    // Простая анимация масштаба и альфы
    const showAnimation = () => {
      if (winTextGroup.scale.x < targetScale) {
        winTextGroup.scale.x += 0.1;
        winTextGroup.scale.y += 0.1;
        winTextGroup.alpha += 0.1;
        
        if (winTextGroup.scale.x >= targetScale) {
          winTextGroup.scale.set(targetScale);
          winTextGroup.alpha = 1;
        } else {
          requestAnimationFrame(showAnimation);
        }
      }
    };
    requestAnimationFrame(showAnimation);
    
    this.winTextContainer.addChild(winTextGroup);
    
    console.log(`WinLineManager: Showing win text ${amount.toFixed(2)} for line ${lineNumber || 'all'}`);
  }
  
  /**
   * Скрывает текст выигрыша и фон
   */
  hideWinText() {
    if (this.currentWinTextSprite && this.currentWinTextSprite.parent) {
      this.currentWinTextSprite.parent.removeChild(this.currentWinTextSprite);
      this.currentWinTextSprite = null;
    }
  }
  
  /**
   * Создает отдельный Spine инстанс для линии
   */
  async createLineSpine(lineNumber) {
    if (this.lineSpines[lineNumber]) {
      return this.lineSpines[lineNumber]; // Уже создан
    }
    
    const lineSpine = new SpineAnimation(
      this.config,
      this.app,
      this.app.stage,
      'winline',
      null, // Без начальной анимации
      false
    );
    
    const loaded = await lineSpine.load();
    if (!loaded) {
      console.warn(`WinLineManager: Failed to load Spine for line ${lineNumber}`);
      return null;
    }
    
    // Позиционируем так же как основной (под символами)
    const container = lineSpine.getContainer();
    container.zIndex = 99; // Под символами (символы zIndex = 100)
    
    // Изначально скрываем
    container.visible = false;
    
    // Позиционируем если уже есть reelsContainer
    if (this.reelsContainer && this.slotMachine) {
      const sm = this.slotMachine;
      const centerX = sm.config.startPosition.x + sm.gameAreaWidth / 2 + this.reelsContainer.x;
      const centerY = sm.config.startPosition.y + sm.gameAreaHeight / 2 + this.reelsContainer.y;
      container.x = centerX;
      container.y = centerY;
    }
    
    this.lineSpines[lineNumber] = lineSpine;
    console.log(`WinLineManager: Created Spine instance for line ${lineNumber}`);
    
    return lineSpine;
  }
  
  /**
   * Синхронизирует позицию винлайнов с контейнером рилов
   */
  syncWithReelsContainer(reelsContainer, slotMachine) {
    this.reelsContainer = reelsContainer;
    this.slotMachine = slotMachine; // Сохраняем ссылку на slotMachine для вычисления центра поля
  }
  
  /**
   * Обновляет позицию винлайнов (вызывается при изменении позиции reelsContainer)
   * Винлайны должны быть позиционированы так, чтобы их 0,0 была в центре игрового поля
   */
  updatePosition(slotMachine) {
    const sm = slotMachine || this.slotMachine;
    if (!this.reelsContainer || !sm) {
      return;
    }
    
    // Центр поля = начальная позиция поля + половина ширины/высоты + сдвиг от дебаггера
    const centerX = sm.config.startPosition.x + sm.gameAreaWidth / 2 + this.reelsContainer.x;
    const centerY = sm.config.startPosition.y + sm.gameAreaHeight / 2 + this.reelsContainer.y;
    
    // Обновляем позицию основного Spine
    if (this.spineAnimation && this.spineAnimation.getContainer()) {
      const winlineContainer = this.spineAnimation.getContainer();
      winlineContainer.x = centerX;
      winlineContainer.y = centerY;
    }
    
    // Обновляем позицию всех отдельных Spine инстансов линий
    Object.values(this.lineSpines).forEach(lineSpine => {
      if (lineSpine && lineSpine.getContainer()) {
        const container = lineSpine.getContainer();
        container.x = centerX;
        container.y = centerY;
      }
    });
    
    // Обновляем позицию контейнера текстов выигрышей
    // Контейнер не нужно сдвигать, так как позиции текста рассчитываются относительно startPosition
    // Но если reelsContainer сдвигается, нужно учесть это для текстов
    // Пока оставляем как есть, так как тексты позиционируются относительно startPosition
  }
  
  /**
   * Очищает все треки
   */
  clearAllTracks() {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    // Удаляем все слушатели событий
    this.removeAllTrackListeners();
    
    // Полностью очищаем все треки
    for (let i = 0; i < 5; i++) {
      spine.state.clearTrack(i);
      spine.state.setEmptyAnimation(i, 0);
    }
  }
  
  /**
   * Очищает конкретный трек перед установкой новой анимации (как в train-test.html)
   */
  clearTrackBeforeAnimation(trackIndex) {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    // Очищаем трек (как в train-test.html)
    spine.state.clearTrack(trackIndex);
    spine.state.setEmptyAnimation(trackIndex, 0);
  }
  
  /**
   * Сбрасывает слоты к setup pose для возврата винлайнов в невидимое состояние
   */
  resetSlotsToSetupPose() {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    // Сбрасываем слоты к setup pose (в setup pose все винлайны невидимы)
    spine.skeleton.setSlotsToSetupPose();
    
    // Обновляем мировые трансформации после сброса
    if (spine.skeleton.physics) {
      spine.skeleton.updateWorldTransform(spine.skeleton.physics.update);
    }
  }
  
  /**
   * Удаляет все слушатели событий треков
   */
  removeAllTrackListeners() {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    // Удаляем слушатели через события state
    for (let trackIndex in this.trackListeners) {
      const listener = this.trackListeners[trackIndex];
      if (listener && spine.state) {
        // Удаляем слушатель через removeListener если есть такой метод
        // Иначе просто очищаем объект
      }
    }
    this.trackListeners = {};
  }
  
  /**
   * Добавляет слушатель завершения анимации на треке
   */
  addTrackEndListener(trackIndex, callback) {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    const track = spine.state.tracks[trackIndex];
    
    if (!track) {
      return;
    }
    
    // Создаем обработчик события завершения трека
    const listener = () => {
      // Проверяем, что трек действительно завершился (не loop)
      if (track && track.loop === false && track.trackEnd >= track.trackTime) {
        callback();
      }
    };
    
    // Сохраняем слушатель для последующего удаления
    this.trackListeners[trackIndex] = listener;
    
    // Используем события Spine для отслеживания завершения анимации
    // Spine не имеет прямого события trackEnd, поэтому используем polling
    // или устанавливаем loop = false и проверяем trackTime
  }
  
  /**
   * Показывает винлайны (сначала все вместе, потом по очереди после завершения анимаций)
   * @param {Array<number>} lineNumbers - Массив номеров линий (1-5)
   */
  async showWinLines(lineNumbers) {
    if (!this.spineAnimation || !this.spineAnimation.spine || !lineNumbers || lineNumbers.length === 0) {
      return;
    }
    
    // Очищаем предыдущие таймеры и слушатели
    this.stopCycling();
    this.removeAllTrackListeners();
    
    // Скрываем все отдельные Spine инстансы линий
    Object.values(this.lineSpines).forEach(lineSpine => {
      if (lineSpine && lineSpine.getContainer()) {
        lineSpine.getContainer().visible = false;
      }
    });
    
    this.activeLines = [...lineNumbers]; // Копируем массив
    this.cycleIndex = 0;
    
    // Создаем отдельные Spine инстансы для каждой линии (для перебора)
    for (const lineNumber of lineNumbers) {
      await this.createLineSpine(lineNumber);
    }
    
    // Этап 1: Показываем все линии вместе синхронно на разных треках (loop = false)
    this.showAllLinesTogether();
  }
  
  /**
   * Показывает все линии одновременно на разных треках (без зацикливания)
   */
  showAllLinesTogether() {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    const spine = this.spineAnimation.spine;
    const totalTracks = this.activeLines.length;
    
    // Показываем основной Spine и скрываем все отдельные Spine инстансы
    if (this.spineAnimation.getContainer()) {
      this.spineAnimation.getContainer().visible = true;
    }
    // Скрываем все отдельные Spine инстансы (они используются только для перебора)
    Object.values(this.lineSpines).forEach(lineSpine => {
      if (lineSpine && lineSpine.getContainer()) {
        lineSpine.getContainer().visible = false;
      }
    });
    
    // Сбрасываем слоты к setup pose перед показом
    this.resetSlotsToSetupPose();
    
    // Запускаем все анимации без зацикливания
    // Каждый трек очищается перед установкой анимации (как в train-test.html)
    const trackEntries = [];
    this.activeLines.forEach((lineNumber, index) => {
      const animationName = `animation${lineNumber}`;
      const animation = spine.state.data.skeletonData.animations.find(a => a.name === animationName);
      if (animation) {
        // Очищаем трек перед установкой новой анимации (как в train-test.html)
        this.clearTrackBeforeAnimation(index);
        // Запускаем анимацию БЕЗ зацикливания и сохраняем TrackEntry
        const trackEntry = spine.state.setAnimation(index, animationName, false); // loop = false
        if (trackEntry) {
          trackEntries.push({ entry: trackEntry, index, lineNumber });
        }
        console.log(`WinLineManager: Showing line ${lineNumber} on track ${index} (one-shot)`);
      } else {
        console.warn(`WinLineManager: Animation "${animationName}" not found`);
      }
    });
    
    // Если одна линия - сразу запускаем цикл (она будет играть раз за разом)
    if (totalTracks === 1) {
      console.log(`WinLineManager: Single line ${this.activeLines[0]} - starting cycle immediately`);
      // Для одной линии тоже нужен цикл - она должна играть раз за разом
      // Запускаем цикл сразу (пропускаем одновременный показ)
      this.startCycling();
      return;
    }
    
    console.log(`WinLineManager: Showing all ${this.activeLines.length} lines together (will cycle after completion)`);
    
    // Показываем winframes для всех линий одновременно (один цикл)
    if (this.winFrameAnimation && this.reels && this.activeLines.length > 0) {
      this.winFrameAnimation.playOnLines(this.reels, this.activeLines);
    }
    
    // Показываем общую сумму в центре игрового поля
    const totalAmount = this.activeLines.length * this.lineWinAmount;
    this.showWinText(totalAmount, null); // null = центр поля
    
    // Отслеживаем завершение всех анимаций через события TrackEntry
    const completedTracks = new Set();
    
    // Устанавливаем слушатели завершения для каждого TrackEntry
    trackEntries.forEach(({ entry, index, lineNumber }) => {
      if (!entry) return;
      
      // Устанавливаем слушатель завершения для каждого трека
      entry.listener = {
        complete: (completedEntry) => {
          if (this.isCycling) {
            return; // Уже начался перебор
          }
          
          // Отмечаем трек как завершенный
          if (!completedTracks.has(index)) {
            completedTracks.add(index);
            console.log(`WinLineManager: Track ${index} (line ${lineNumber}) completed (${completedTracks.size}/${totalTracks})`);
            
            // Если все треки завершились, начинаем перебор
            if (completedTracks.size >= totalTracks && !this.isCycling) {
              console.log(`WinLineManager: All tracks completed, starting cycle`);
              // Очищаем слушатели перед запуском цикла
              trackEntries.forEach(({ entry: e }) => {
                if (e && e.listener) {
                  e.listener = null;
                }
              });
              // Останавливаем winframes перед перебором
              if (this.winFrameAnimation) {
                this.winFrameAnimation.stop();
              }
              // Скрываем общий текст перед перебором
              this.hideWinText();
              this.startCycling();
            }
          }
        }
      };
    });
  }
  
  /**
   * Начинает перебор линий по очереди (после завершения всех одновременных анимаций)
   */
  startCycling() {
    if (this.activeLines.length === 0) {
      return; // Нет линий
    }
    
    if (this.isCycling) {
      return; // Уже в процессе перебора
    }
    
    this.isCycling = true;
    this.cycleIndex = 0;
    
    // Сбрасываем слоты к setup pose перед началом перебора
    // чтобы скрыть все линии перед показом по очереди
    this.resetSlotsToSetupPose();
    
    // Начинаем перебор сразу (без задержки)
    // Для одиночной линии - цикл повторов, для множественных - перебор по очереди
    console.log(`WinLineManager: Starting infinite cycle through ${this.activeLines.length} line(s)`);
    this.showLineInCycle();
  }
  
  /**
   * Показывает текущую линию в цикле перебора через отдельный Spine инстанс
   */
  showLineInCycle() {
    if (!this.isCycling || this.activeLines.length === 0) {
      return;
    }
    
    const lineNumber = this.activeLines[this.cycleIndex];
    const lineSpine = this.lineSpines[lineNumber];
    
    if (!lineSpine || !lineSpine.spine) {
      console.warn(`WinLineManager: Spine for line ${lineNumber} not found`);
      return;
    }
    
    // Скрываем все линии
    Object.entries(this.lineSpines).forEach(([num, spine]) => {
      if (spine && spine.getContainer()) {
        spine.getContainer().visible = false;
        // Останавливаем анимацию на всех
        if (spine.spine) {
          spine.spine.state.clearTracks();
        }
      }
    });
    
    // Скрываем основной Spine (для одновременного показа)
    if (this.spineAnimation && this.spineAnimation.getContainer()) {
      this.spineAnimation.getContainer().visible = false;
    }
    
    // Показываем текущую линию
    const container = lineSpine.getContainer();
    container.visible = true;
    
    const spine = lineSpine.spine;
    const animationName = `animation${lineNumber}`;
    
    // Запускаем анимацию на треке 0 (без зацикливания)
    spine.state.clearTrack(0);
    const trackEntry = spine.state.setAnimation(0, animationName, false);
    
    if (!trackEntry) {
      console.warn(`WinLineManager: Failed to set animation "${animationName}" for line ${lineNumber}`);
      return;
    }
    
    console.log(`WinLineManager: Cycling - showing line ${lineNumber} (${this.cycleIndex + 1}/${this.activeLines.length})`);
    
    // Показываем winframes для текущей линии (один цикл)
    if (this.winFrameAnimation && this.reels) {
      this.winFrameAnimation.playOnLine(this.reels, lineNumber);
    }
    
    // Показываем стоимость текущей линии на уровне линии
    this.showWinText(this.lineWinAmount, lineNumber);
    
    // Устанавливаем слушатель завершения
    this.currentCycleEntry = trackEntry;
    trackEntry.listener = {
      complete: (entry) => {
        if (!this.isCycling || entry !== this.currentCycleEntry) {
          return;
        }
        
        console.log(`WinLineManager: Line ${lineNumber} completed, switching to next line`);
        
        // Останавливаем winframes при завершении линии
        if (this.winFrameAnimation) {
          this.winFrameAnimation.stop();
        }
        
        // Скрываем текст текущей линии
        this.hideWinText();
        
        // Переходим к следующей линии (циклически)
        this.cycleIndex = (this.cycleIndex + 1) % this.activeLines.length;
        
        // Показываем следующую линию (бесконечный цикл)
        if (this.isCycling) {
          requestAnimationFrame(() => {
            if (this.isCycling) {
              this.showLineInCycle();
            }
          });
        }
      }
    };
  }
  
  /**
   * Останавливает перебор и скрывает все линии
   */
  hideAllLines() {
    // Останавливаем все таймеры и слушатели
    this.stopCycling();
    this.removeAllTrackListeners();
    
    // Останавливаем winframes
    if (this.winFrameAnimation) {
      this.winFrameAnimation.stop();
    }
    
    // Скрываем текст выигрыша
    this.hideWinText();
    
    // Сбрасываем состояние
    this.activeLines = [];
    this.cycleIndex = 0;
    this.isCycling = false;
    this.currentCycleEntry = null;
    
    // Скрываем основной Spine и очищаем треки
    if (this.spineAnimation) {
      if (this.spineAnimation.getContainer()) {
        this.spineAnimation.getContainer().visible = false;
      }
      if (this.spineAnimation.spine) {
        this.clearAllTracks();
        this.resetSlotsToSetupPose();
      }
    }
    
    // Скрываем все отдельные Spine инстансы линий
    Object.values(this.lineSpines).forEach(lineSpine => {
      if (lineSpine) {
        if (lineSpine.getContainer()) {
          lineSpine.getContainer().visible = false;
        }
        if (lineSpine.spine) {
          lineSpine.spine.state.clearTracks();
        }
      }
    });
    
    console.log('WinLineManager: All lines hidden');
  }
  
  /**
   * Останавливает перебор (вызывается при новом спине)
   */
  stopCycling() {
    this.isCycling = false;
  }
  
  /**
   * Получает контейнер для дебаггера
   */
  getContainer() {
    return this.spineAnimation ? this.spineAnimation.getContainer() : null;
  }
  
  /**
   * Получает экземпляр SpineAnimation (для доступа к setPosition и т.д.)
   */
  getSpineAnimation() {
    return this.spineAnimation;
  }
}
