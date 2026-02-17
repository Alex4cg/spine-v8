/**
 * CascadeManager - управление каскадным насыпанием символов
 */
import { Symbol } from './Symbol.js';
import { MiniWinManager } from './MiniWinManager.js';
import { SoundManager } from './SoundManager.js';

// Предопределённая сетка для первого раунда: [row][col] — одна строка кода = один горизонтальный ряд на экране
// Ни один тип символа не встречается 7+ раз; value % symbolTextures.length
const INITIAL_GRID_NO_WIN = [
  [0, 1, 2, 3, 4, 5],   // row 0 (верхний ряд)
  [6, 7, 0, 1, 2, 3],   // row 1
  [4, 5, 6, 7, 0, 1],   // row 2
  [2, 3, 4, 5, 6, 7],   // row 3
  [0, 1, 2, 3, 4, 5]    // row 4 (нижний ряд)
];

// Состояния игры для четкого управления фазами
const GAME_STATE = {
  IDLE: 'idle',                    // Ожидание, ничего не происходит
  SPINNING: 'spinning',            // Насыпание новых символов (основной спин)
  CHECKING_WINS: 'checking_wins',   // Проверка выигрышных комбинаций
  REMOVING_WINS: 'removing_wins',   // Удаление выигрышных символов
  COMPACTING: 'compacting',         // Уплотнение колонок (символы падают вниз)
  FILLING: 'filling',              // Досыпание новых символов сверху
  WAITING_LANDING: 'waiting_landing' // Ожидание приземления символов
};

export class CascadeManager {
  constructor(config) {
    this.config = config;
    this.container = config.container;
    /** Контейнер для оверлея Spine бомбы при показе выигрыша (без маски). Если задан — бомба при win рисуется поверх. */
    this.bombWinOverlayContainer = config.bombWinOverlayContainer != null ? config.bombWinOverlayContainer : null;
    /** Контейнер для тряски при взрыве бомбы (поле + символы). Если не задан — трясётся container. */
    this.shakeContainer = config.shakeContainer != null ? config.shakeContainer : config.container;
    this.symbolTextures = config.symbolTextures;
    this.gridPositions = config.gridPositions;
    
    // Константы из конфига
    this.GRID_COLS = config.gridCols;
    this.GRID_ROWS = config.gridRows;
    this.SYMBOL_SIZE = config.symbolSize;
    this.SYMBOL_TEXTURE_SIZE = config.symbolTextureSize;
    this.FALL_SPEED = config.fallSpeed;
    this.ROW_DELAY = config.rowDelay;
    this.COLUMN_DELAY = config.columnDelay;
    this.NEW_MATRIX_DELAY = config.newMatrixDelay || 0.1;
    this.OLD_ROW_DELAY = config.oldRowDelay || 0.15;
    this.OLD_COLUMN_DELAY = config.oldColumnDelay || 0.08;
    // Позиция начала сетки и высота поля для расчета позиции падения старых символов
    this.GRID_START_Y = config.gridStartY || 200;
    this.GRID_END_Y = this.GRID_START_Y + this.GRID_ROWS * this.SYMBOL_SIZE;
    
    this.grid = []; // grid[col][row] = Symbol
    this.isSpinning = false;
    this.oldSymbols = []; // Старые символы, которые падают вниз перед удалением
    this._winCheckTimerId = null; // Таймер разовой проверки выигрыша
    this._lastCreatedSymbol = null; // Последний созданный символ (для отслеживания приземления в режиме сценария)
    
    // Конфигурация выплат
    this.payoutsConfig = config.payoutsConfig || null;
    this.minSymbolsForWin = config.minSymbolsForWin || 5;
    
    // Управление фазами игры
    this.gameState = GAME_STATE.IDLE; // Текущее состояние игры
    this.winCheckProcessed = false; // Флаг для предотвращения повторной проверки
    this.winCheckPending = false; // Флаг для отслеживания ожидающей проверки выигрышей
    this.scatterHitAnimationsPlayed = false; // Флаг для предотвращения повторного проигрывания hit анимации скаттеров

    // Для отслеживания активных таймеров
    this.activeTimers = []; // Массив активных setTimeout

    // Масштаб поля при spin-win-bomb / cascade-win-bomb: медленное уменьшение до boom, затем баунс обратно
    this._fieldScaleDownActive = false;

    // Режим сценария (для сценария используйте ScenarioCascadeManager)
    this.scenarioMode = false;
    this.currentScenario = null; // Загруженный сценарий (массив шагов)
    this.currentScenarioStep = -1; // Текущий шаг сценария (-1 означает "еще не начали сценарий")
    
    // Флаг перехода в бонусную игру (устанавливается при scatterCount >= 4)
    this.bonusTransitionPending = false;
    this.activeChestsForBonus = []; // Массив цветов сундуков, получивших монетки
    /** Бонус из загруженного сценария (bonus-init) — без транзишена */
    this.isBonusFromScenario = false;
    /** Приращение мультипликатора жёлтого сундука за каждую бомбу (из bonus-init) */
    this.yellowChestMultiplierPerBomb = 1;
    /** Текущее значение счётчика фриспинов (обновляется при спине и при прилёте скатеров) */
    this.currentFreeSpinsRemaining = 0;

    // Spine-ассеты для анимации bounce при приземлении (алиасы PIXI.Assets)
    if (config.spineSkeletonAlias && config.spineAtlasAlias) {
      Symbol.spineSkeletonAlias = config.spineSkeletonAlias;
      Symbol.spineAtlasAlias = config.spineAtlasAlias;
    }
    
    // Spine-ассеты для бомбы (idle, bounce, boom)
    if (config.bombSpineSkeletonAlias && config.bombSpineAtlasAlias) {
      Symbol.bombSpineSkeletonAlias = config.bombSpineSkeletonAlias;
      Symbol.bombSpineAtlasAlias = config.bombSpineAtlasAlias;
    }
    
    // Spine-ассеты для скаттеров (idle, hit, idle_null, bounce, скины blue, gold, red)
    if (config.scatterSpineSkeletonAlias && config.scatterSpineAtlasAlias) {
      Symbol.scatterSpineSkeletonAlias = config.scatterSpineSkeletonAlias;
      Symbol.scatterSpineAtlasAlias = config.scatterSpineAtlasAlias;
    }

    // Подсветка рила в режиме интриги (Spine из spine/intrigue)
    this.intrigueSpineSkeletonAlias = config.intrigueSpineSkeletonAlias || null;
    this.intrigueSpineAtlasAlias = config.intrigueSpineAtlasAlias || null;
    this.intrigueHighlightContainer = config.intrigueHighlightContainer || null;
    this._intrigueSpine = null;
    this._intrigueFadeTimerId = null;
    this.INTRIGUE_FIRST_SHOW_DELAY = 0.5; // задержка перед первым появлением подсветки (сек)

    // MiniWinManager — показ мини винов и мини тотала (если передан fontManager)
    this.miniWinManager = null;
    if (config.fontManager && this.shakeContainer) {
      this.miniWinManager = new MiniWinManager({
        container: this.shakeContainer,
        gridPositions: this.gridPositions,
        gridCols: this.GRID_COLS,
        gridRows: this.GRID_ROWS,
        symbolSize: this.SYMBOL_SIZE,
        fontManager: config.fontManager
      });
    }

    // TotalWinDisplay — показ Total Win (накапливаемая сумма за серию каскадов)
    this.totalWinDisplay = config.totalWinDisplay || null;
    this._totalWinAmount = 0; // Накопленная сумма за текущую серию

    /** Колбэк при смене бонусного режима: (isBonus, activeChests, freeSpinsRemaining, yellowChestMultiplier) */
    this.onBonusModeChange = typeof config.onBonusModeChange === 'function' ? config.onBonusModeChange : null;
    /** Колбэк при загрузке бонусного сценария (bonus-init): (activeChests) — сундуки из activeChests уже на 3 уровне в начале бонуса */
    this.onBonusScenarioLoaded = typeof config.onBonusScenarioLoaded === 'function' ? config.onBonusScenarioLoaded : null;

    // По ивенту "boom" в анимации бомбы: звук взрыва, остановка scale-down, баунс масштаба в 1, тряска поля + boom_disappearance + scatter boom + опциональный config.onBombBoom. Единственный триггер обновления бонус-UI (мультипликатор/фриспины) — взрыв.
    Symbol.onBombBoomEvent = () => {
      SoundManager.playBomb();
      this._fieldScaleDownActive = false;
      this._scaleFieldBounceBack();
      this._shakeField(450, 12);
      requestAnimationFrame(() => this._startBombNeighborDisappearance());
      requestAnimationFrame(() => this._startScatterBoomAnimations());
      if (this.isBonusFromScenario) requestAnimationFrame(() => this._emitBonusUIUpdate());
      if (typeof config.onBombBoom === 'function') config.onBombBoom();
    };
    
    // Скаттеры под взрывом бомбы (для анимации boom)
    this._pendingBombScatters = null;

    // Инициализируем пустую сетку
    for (let col = 0; col < this.GRID_COLS; col++) {
      this.grid[col] = [];
      for (let row = 0; row < this.GRID_ROWS; row++) {
        this.grid[col][row] = null;
      }
    }
  }

  // Заполняет сетку предопределённой раскладкой без выигрыша (первый экран)
  fillInitialNoWin() {
    const numTextures = this.symbolTextures.length;
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const position = this.gridPositions[col][row];
        const textureIndex = INITIAL_GRID_NO_WIN[row][col] % numTextures;
        const symbol = new Symbol(
          position.x,
          position.y,
          textureIndex,
          this.container,
          this.symbolTextures,
          this.SYMBOL_SIZE,
          this.SYMBOL_TEXTURE_SIZE,
          this.FALL_SPEED,
          col,
          row
        );
        symbol.setPosition(position.x, position.y);
        this.grid[col][row] = symbol;
      }
    }
  }

  // Сброс текущей анимации
  reset() {
    if (!this.isSpinning) {
      return; // Нечего сбрасывать
    }
    
    console.log('🔄 CascadeManager: Сброс текущей анимации');
    
    // Останавливаем все активные таймеры
    for (const timerId of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers = [];
    if (this._winCheckTimerId) {
      clearTimeout(this._winCheckTimerId);
      this._winCheckTimerId = null;
    }

    // Останавливаем все падающие символы и перемещаем их в финальную позицию
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        if (this.grid[col][row]) {
          const symbol = this.grid[col][row];
          if (symbol.isFalling) {
            // Немедленно останавливаем падение
            symbol.currentY = symbol.targetY;
            symbol.cellContainer.y = symbol.currentY - this.SYMBOL_SIZE / 2;
            symbol.isFalling = false;
          }
        }
      }
    }
    
    // Удаляем все существующие символы
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        if (this.grid[col][row]) {
          this.grid[col][row].destroy();
          this.grid[col][row] = null;
        }
      }
    }
    
    // Удаляем старые символы, которые падают вниз
    for (const symbol of this.oldSymbols) {
      if (symbol) {
        symbol.destroy();
      }
    }
    this.oldSymbols = [];

    if (this.miniWinManager) {
      this.miniWinManager.clear();
    }

    this._hideIntrigueHighlight();

    // Сбрасываем флаги и состояние
    this.isSpinning = false;
    this._setIdle();
    this.winCheckProcessed = false;
    this.winCheckPending = false;
  }

  _setIdle() {
    if (this.gameState === GAME_STATE.IDLE) {
      return;
    }
    this.gameState = GAME_STATE.IDLE;
    // Кнопка разблокируется через таймер в UIController, не через callback
  }

  // Устанавливает состояние ожидания приземления символов
  _setWaitingLandingState() {
    this.gameState = GAME_STATE.WAITING_LANDING;
    this.winCheckProcessed = false;
    this.winCheckPending = false;
  }

  // Подсчитывает скаттеров (textureIndex 9, 10, 11) в колонке colIndex из step.grid сценария
  _countScattersInColumn(step, colIndex) {
    if (!step || !step.grid || colIndex < 0 || colIndex >= this.GRID_COLS) return 0;
    let count = 0;
    for (let row = 0; row < this.GRID_ROWS; row++) {
      const textureIndex = step.grid[row][colIndex];
      if (textureIndex === 9 || textureIndex === 10 || textureIndex === 11) count++;
    }
    return count;
  }

  // Интрига для колонки col: сумма скаттеров в колонках 0..col-1 >= 3
  _shouldColumnHaveIntrigue(step, col) {
    if (!step || !step.grid || col <= 0) return false;
    let cumulative = 0;
    for (let c = 0; c < col; c++) {
      cumulative += this._countScattersInColumn(step, c);
      if (cumulative >= 3) return true;
    }
    return false;
  }

  // Возвращает эффективные задержки с учётом режима интриги по колонке.
  // Обычный режим: ROW_DELAY, COLUMN_DELAY. Режим интриги: rowDelay ×5, columnDelay = (GRID_ROWS - 1) * rowDelay.
  _getEffectiveDelays(col = null) {
    if (col === null) {
      return { rowDelay: this.ROW_DELAY, columnDelay: this.COLUMN_DELAY };
    }
    const hasIntrigue = this._intrigueForColumn && this._intrigueForColumn[col];
    const rowDelay = hasIntrigue ? this.ROW_DELAY * 1.5 : this.ROW_DELAY;
    const columnDelay = hasIntrigue ? (this.GRID_ROWS - 1) * rowDelay : this.COLUMN_DELAY;
    return { rowDelay, columnDelay };
  }

  // Подсветка рила в режиме интриги: показать на колонке col, проявляем контейнер через прозрачность
  _showIntrigueHighlight(col) {
    if (!this.intrigueHighlightContainer || !this.intrigueSpineSkeletonAlias || !this.intrigueSpineAtlasAlias) return;
    if (typeof spine === 'undefined') return;
    // Отменяем предыдущую анимацию затухания
    if (this._intrigueFadeTimerId != null) {
      clearTimeout(this._intrigueFadeTimerId);
      this._intrigueFadeTimerId = null;
    }
    if (!this._intrigueSpine) {
      try {
        this._intrigueSpine = spine.Spine.from({
          skeleton: this.intrigueSpineSkeletonAlias,
          atlas: this.intrigueSpineAtlasAlias
        });
        this._intrigueSpine.state.setAnimation(0, 'loop', true);
        this._intrigueSpine.zIndex = 1;
        this.intrigueHighlightContainer.addChild(this._intrigueSpine);
      } catch (e) {
        console.warn('⚠️ [INTRIGUE] Не удалось создать Spine подсветки:', e);
        return;
      }
    }
    const centerRow = Math.floor(this.GRID_ROWS / 2);
    const pos = this.gridPositions[col]?.[centerRow];
    if (pos) {
      this._intrigueSpine.x = pos.x;
      this._intrigueSpine.y = pos.y;
    }
    this.intrigueHighlightContainer.alpha = 0;
    this.intrigueHighlightContainer.visible = true;
    // Проявляем контейнер через прозрачность при каждом переключении (0 -> 1 за ~150 ms)
    const fadeDurationMs = 150;
    const fadeSteps = 10;
    const fadeInterval = fadeDurationMs / fadeSteps;
    let step = 0;
    const container = this.intrigueHighlightContainer;
    const fade = () => {
      step++;
      container.alpha = Math.min(1, step / fadeSteps);
      if (step < fadeSteps && container.visible) {
        this._intrigueFadeTimerId = setTimeout(fade, fadeInterval);
      } else {
        this._intrigueFadeTimerId = null;
      }
    };
    this._intrigueFadeTimerId = setTimeout(fade, fadeInterval);
  }

  _hideIntrigueHighlight() {
    if (this._intrigueFadeTimerId != null) {
      clearTimeout(this._intrigueFadeTimerId);
      this._intrigueFadeTimerId = null;
    }
    if (this.intrigueHighlightContainer) {
      this.intrigueHighlightContainer.visible = false;
      this.intrigueHighlightContainer.alpha = 1;
    }
  }

  // Задержка в секундах с добавлением таймера в activeTimers для reset()
  _delay(sec) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        const idx = this.activeTimers.indexOf(id);
        if (idx > -1) this.activeTimers.splice(idx, 1);
        resolve();
      }, sec * 1000);
      this.activeTimers.push(id);
    });
  }

  // Устанавливает колбэк на символ для проверки выигрыша после приземления
  _setupLandedCallback(symbol) {
    if (!symbol) return;
    symbol.onLandedCallback = () => {
      SoundManager.playLanding();
      // Подмена текстуры на Spine, проигрывание bounce при приземлении (бомба, скаттер, обычные символы)
      if (typeof symbol.showSpineAnimation === 'function') {
        symbol.showSpineAnimation('bounce');
      }
      // Небольшая задержка перед проверкой выигрыша, чтобы символы успели визуально приземлиться
      setTimeout(() => {
        if (!this.winCheckProcessed && !this.winCheckPending) {
          this._onAllLanded();
        }
      }, 50); // 50мс задержка для завершения анимации приземления
    };
  }

  // Находит последний падающий символ (самый нижний в самой правой колонке)
  _findLastFallingSymbol() {
    for (let col = this.GRID_COLS - 1; col >= 0; col--) {
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        const symbol = this.grid[col][row];
        if (symbol && symbol.isFalling) {
          return symbol;
        }
      }
    }
    return null;
  }

  setFallSpeed(value) {
    this.FALL_SPEED = value;
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        if (this.grid[col][row]) this.grid[col][row].fallSpeed = value;
      }
    }
    for (const symbol of this.oldSymbols) {
      if (symbol) symbol.fallSpeed = value;
    }
  }

  // Подготавливает старые символы для падения (приватный метод)
  _prepareOldSymbols() {
    this.oldSymbols = [];
    const oldSymbolsMap = new Map();
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        if (this.grid[col][row]) {
          const symbol = this.grid[col][row];
          symbol.targetY = this.GRID_END_Y + 200;
          symbol.isFalling = false;
          this.oldSymbols.push(symbol);
          oldSymbolsMap.set(`${col},${row}`, symbol);
          this.grid[col][row] = null;
        }
      }
    }
    
    return oldSymbolsMap;
  }

  // Запускает падение старых символов с задержками (приватный метод)
  async _startOldSymbolsFall(oldSymbolsMap) {
    if (this.oldSymbols.length === 0) {
      return;
    }
    
    // Таймер удаления: 2 секунды для всех старых символов
    const cleanupTimerId = setTimeout(() => {
      for (const symbol of this.oldSymbols) {
        if (symbol) {
          symbol.destroy();
        }
      }
      this.oldSymbols = [];
      
      const index = this.activeTimers.indexOf(cleanupTimerId);
      if (index > -1) {
        this.activeTimers.splice(index, 1);
      }
    }, 2000);
    
    this.activeTimers.push(cleanupTimerId);
    
    // Запускаем колонки параллельно
    const oldColumnPromises = [];
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      const columnPromise = new Promise((resolve) => {
        const delay = col * this.OLD_COLUMN_DELAY * 1000;
        
        const timerId = setTimeout(async () => {
          const index = this.activeTimers.indexOf(timerId);
          if (index > -1) {
            this.activeTimers.splice(index, 1);
          }
          
          if (!this.isSpinning) {
            resolve();
            return;
          }
          
          // Запускаем падение в колонке снизу вверх
          for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
            if (!this.isSpinning) {
              resolve();
              return;
            }
            
            const symbol = oldSymbolsMap.get(`${col},${row}`);
            if (symbol) {
              symbol.isFalling = true;
            }
            
            if (row > 0 && this.OLD_ROW_DELAY > 0) {
              await new Promise((resolveRow) => {
                const rowTimerId = setTimeout(() => {
                  const idx = this.activeTimers.indexOf(rowTimerId);
                  if (idx > -1) {
                    this.activeTimers.splice(idx, 1);
                  }
                  resolveRow();
                }, this.OLD_ROW_DELAY * 1000);
                this.activeTimers.push(rowTimerId);
              });
            }
          }
          
          resolve();
        }, delay);
        
        this.activeTimers.push(timerId);
      });
      
      oldColumnPromises.push(columnPromise);
    }
    
    // Запускаем падение старых символов (не ждем их завершения)
    Promise.all(oldColumnPromises).catch(() => {
      // Игнорируем ошибки, если был вызван reset()
    });
    
    // Задержка перед началом падения новых символов
    if (this.NEW_MATRIX_DELAY > 0) {
      await new Promise((resolve) => {
        const timerId = setTimeout(() => {
          const index = this.activeTimers.indexOf(timerId);
          if (index > -1) {
            this.activeTimers.splice(index, 1);
          }
          resolve();
        }, this.NEW_MATRIX_DELAY * 1000);
        this.activeTimers.push(timerId);
      });
    }
  }

  // Получает индекс символа из сценария или случайный
  _getSymbolIndex(col, row, context = 'spin') {
    // Используем данные из сценария
    const scenarioSymbol = this.getNextScenarioSymbol(col, row, context);
    if (scenarioSymbol !== null && scenarioSymbol !== undefined) {
      return scenarioSymbol;
    }
    // Если не удалось получить символ из сценария, это ошибка
    console.error(`❌ [SCENARIO] Не удалось получить символ из сценария для col=${col}, row=${row}, context=${context}`);
    return 0; // Fallback на первый символ вместо случайного
  }

  // Создает новые символы для cascade (приватный метод)
  _createNewSymbols() {
    this._lastCreatedSymbol = null;
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const position = this.gridPositions[col][row];
        const textureIndex = this._getSymbolIndex(col, row, 'spin');
        
        const symbol = new Symbol(
          position.x,
          position.y,
          textureIndex,
          this.container,
          this.symbolTextures,
          this.SYMBOL_SIZE,
          this.SYMBOL_TEXTURE_SIZE,
          this.FALL_SPEED,
          col,
          row
        );
        
        symbol.targetX = position.x;
        symbol.targetY = position.y;
        this.grid[col][row] = symbol;
        
        // Устанавливаем колбэк для каждого символа при приземлении
        this._setupLandedCallback(symbol);
        
        // Последний символ - колонка 5, ряд 0 (последний по порядку создания)
        if (col === this.GRID_COLS - 1 && row === 0) {
          this._lastCreatedSymbol = symbol;
        }
      }
    }
    
    // Сохраняем ссылку на последний символ для отслеживания приземления
    if (!this._lastCreatedSymbol) {
      console.warn(`⚠️ [SCENARIO] Последний символ не найден!`);
    }
  }

  // Запускает падение новых символов в cascade (приватный метод)
  // Параллельные колонки, задержки по сценарию (интрига от 3+ скаттеров в cols 0..col-1)
  async _startCascadeFall() {
    this._intrigueForColumn = new Array(this.GRID_COLS).fill(false);
    this._intrigueHighlightShownThisPhase = false;
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (step && step.grid) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          this._intrigueForColumn[col] = this._shouldColumnHaveIntrigue(step, col);
        }
      }
    }

    const startColumnSymbols = async (col) => {
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (!this.isSpinning) return;
        const symbol = this.grid[col][row];
        if (symbol) symbol.startFall();
        if (row > 0) {
          const { rowDelay } = this._getEffectiveDelays(col);
          if (rowDelay > 0) {
            await this._delay(rowDelay);
          }
        }
      }
    };

    const columnPromises = [];
    for (let col = 0; col < this.GRID_COLS; col++) {
      let delayMs = 0;
      for (let c = 0; c < col; c++) {
        delayMs += this._getEffectiveDelays(c).columnDelay * 1000;
      }
      const columnPromise = new Promise((resolve) => {
        const timerId = setTimeout(async () => {
          const idx = this.activeTimers.indexOf(timerId);
          if (idx > -1) this.activeTimers.splice(idx, 1);
          if (!this.isSpinning) {
            this._hideIntrigueHighlight();
            resolve();
            return;
          }
          // Подсветка рила в режиме интриги: первое появление — задержка 0.5 сек, подсвечиваем колонку
          if (this._intrigueForColumn[col]) {
            if (!this._intrigueHighlightShownThisPhase) {
              await this._delay(this.INTRIGUE_FIRST_SHOW_DELAY);
              this._intrigueHighlightShownThisPhase = true;
            }
            this._showIntrigueHighlight(col);
          } else {
            this._hideIntrigueHighlight();
          }
          await startColumnSymbols(col);
          resolve();
        }, delayMs);
        this.activeTimers.push(timerId);
      });
      columnPromises.push(columnPromise);
    }
    await Promise.all(columnPromises);
    this._hideIntrigueHighlight();
  }

  // Каскадное насыпание - символы падают сверху (упрощенная версия)
  async cascade() {
    // Если уже идет анимация - сбрасываем её и начинаем новую
    if (this.isSpinning) {
      console.log('🔄 CascadeManager: Анимация уже идет, сбрасываем и начинаем заново');
      this.reset();
    }
    
    if (this.scenarioMode && this.currentScenario && this.currentScenarioStep >= 0) {
      // Проверяем что текущий шаг - спин (spin или spin-win)
      const step = this.getCurrentScenarioStep();
      if (!step) {
        console.warn('⚠️ [SCENARIO] Нет текущего шага сценария');
        return;
      }
      if (step.event !== 'spin' && step.event !== 'spin-win' && step.event !== 'spin-win-bomb' && 
          step.event !== 'spin-bomb') {
        console.warn(`⚠️ [SCENARIO] Текущий шаг не является спином (${step.event}), пропускаем`);
        return;
      }
      console.log(`📋 [SCENARIO] Начинаем спин из шага ${this.currentScenarioStep + 1}/${this.currentScenario.length} (${step.event})`);
      
      // Уменьшаем счётчик фриспинов при начале спина в бонусной игре
      if (this.isBonusFromScenario) {
        if (this.currentFreeSpinsRemaining > 0) {
          this.currentFreeSpinsRemaining -= 1;
          // Обновляем UI сразу после уменьшения
          this._emitBonusUIUpdate();
        }
      }
      
      // Проверяем условие перехода в бонус сразу при начале спина
      this._checkAndSetBonusFlag();
    }
    
    // Сброс Total Win при начале нового спина
    this.resetTotalWin();
    if (this.totalWinDisplay) {
      this.totalWinDisplay.hide();
    }

    // Устанавливаем флаг и состояние
    this.isSpinning = true;
    this.gameState = GAME_STATE.SPINNING;
    this.winCheckProcessed = false;
    this.winCheckPending = false;
    
    // Блокируем кнопку спин на 2 секунды при начале спина
    if (this._blockSpinButton) {
      this._blockSpinButton();
    }

    SoundManager.playSpin();

    // Подготавливаем и запускаем падение старых символов
    const oldSymbolsMap = this._prepareOldSymbols();
    await this._startOldSymbolsFall(oldSymbolsMap);

    // Создаем новые символы (использует данные из сценария)
    this._createNewSymbols();

    // Запускаем падение новых символов (isSpinning должен быть true для прохождения проверок)
    await this._startCascadeFall();

    // Сбрасываем флаг и устанавливаем состояние ПОСЛЕ запуска падения
    // чтобы колбэк мог правильно проверить состояние
    this.isSpinning = false;
    this._setWaitingLandingState();
    
    // Колбэк уже установлен для всех символов в _createNewSymbols()
    // В режиме сценария проверка выигрыша происходит через колбэки приземления
  }

  // Время до приземления последнего символа при первом спине (мс)
  _getTimeUntilLastSymbolLandsFirstSpinMs() {
    const lastCol = this.GRID_COLS - 1;
    const lastRow = 0;
    const startDelaySec = lastCol * this.COLUMN_DELAY + (this.GRID_ROWS - 1) * this.ROW_DELAY;
    const fallDistance = this.gridPositions[lastCol][lastRow].y + this.SYMBOL_SIZE / 2;
    const fallTimeSec = fallDistance / this.FALL_SPEED;
    return (startDelaySec + fallTimeSec) * 1000;
  }

  // Время до приземления последнего символа после каскада (уплотнение и/или досыпание), мс
  _getTimeUntilLastSymbolLandsAfterCascadeMs(hasMoved, emptySpots) {
    let maxTimeSec = 0;
    if (hasMoved) {
      const fallDist = this.gridPositions[0][this.GRID_ROWS - 1].y - this.gridPositions[0][0].y;
      maxTimeSec = Math.max(maxTimeSec, fallDist / this.FALL_SPEED);
    }
    if (emptySpots.length > 0) {
      const emptyByColumn = new Map();
      for (const spot of emptySpots) {
        if (!emptyByColumn.has(spot.col)) emptyByColumn.set(spot.col, []);
        emptyByColumn.get(spot.col).push(spot.row);
      }
      let refillMaxSec = 0;
      for (const [col, rows] of emptyByColumn.entries()) {
        rows.sort((a, b) => a - b);
        const topRow = rows[0];
        const startDelaySec = col * this.COLUMN_DELAY + (rows.length - 1) * this.ROW_DELAY;
        const fallDistance = this.gridPositions[col][topRow].y + this.SYMBOL_SIZE / 2;
        const fallTimeSec = fallDistance / this.FALL_SPEED;
        refillMaxSec = Math.max(refillMaxSec, startDelaySec + fallTimeSec);
      }
      maxTimeSec = Math.max(maxTimeSec, refillMaxSec);
    }
    return maxTimeSec * 1000;
  }

  _scheduleWinCheck(ms) {
    if (this._winCheckTimerId) {
      clearTimeout(this._winCheckTimerId);
      this._winCheckTimerId = null;
    }
    const timerId = setTimeout(() => {
      this._winCheckTimerId = null;
      this._onAllLanded();
    }, ms);
    this._winCheckTimerId = timerId;
    this.activeTimers.push(timerId);
  }

  /** Затемняет символы, не входящие в вин-комбинацию; при dimmed=false снимает затемнение со всех.
   *  Также поднимает z-index скаттер-символов во время показа выигрышей, чтобы они были поверх затемнённых.
   */
  _setNonWinningSymbolsDimmed(winningSymbols, dimmed) {
    const winSet = new Set(winningSymbols || []);
    let parentContainer = null;
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const symbol = this.grid[col][row];
        if (symbol && typeof symbol.setDimmed === 'function') {
          symbol.setDimmed(dimmed ? !winSet.has(symbol) : false);
        }
        // Поднимаем z-index скаттеров во время показа выигрышей
        if (symbol && typeof symbol.setWinDisplayZIndex === 'function') {
          symbol.setWinDisplayZIndex(dimmed);
        }
        // Сохраняем ссылку на родительский контейнер для пересортировки
        if (!parentContainer && symbol && typeof symbol.getParentContainer === 'function') {
          parentContainer = symbol.getParentContainer();
        }
      }
    }
    
    // Принудительно пересортировать контейнер символов после изменения z-index
    if (parentContainer && typeof parentContainer.sortChildren === 'function') {
      parentContainer.sortChildren();
    }
  }

  // Обрабатывает переход к каскаду в режиме сценария
  async _handleScenarioWinCheck(winningSymbols) {
    const winStep = this.getCurrentScenarioStep();
    console.log(`🔍 [DEBUG] _handleScenarioWinCheck: текущий шаг = ${this.currentScenarioStep + 1}, событие = ${winStep?.event || 'N/A'}`);
    
    // Проверяем условие перехода в бонус и устанавливаем флаг (но продолжаем выполнение каскада)
    this._checkAndSetBonusFlag();
    
    const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;

    const REMOVE_DELAY_BEFORE_MS = 150; // +50мс чтобы верхний правый угол успел приземлиться до win/boom
    const clusterCount = winStep?.winningGroups?.length ?? 0;
    const hasBomb = !!(winStep?.bombType === 'multiplier' && winStep?.bombPosition);
    const isMultiClusterNoBomb = clusterCount >= 2 && !hasBomb;

    if (winningSymbols.length > 0) {
      // Для мини тотала с бомбой (показ "база × эффективный множитель"): в области видимости ветки hasBomb
      let displayBase, displayMult, displayTotal;
      // Обновление Total Win при выигрыше
      if (winStep) {
        // Базовая выплата: в сценарии для шагов с бомбой totalPayout уже = base * multiplier, поэтому base = totalPayout / multiplier
        const bombMult = winStep.multiplier || 1;
        const basePayout = bombMult !== 1 ? (winStep.totalPayout || 0) / bombMult : (winStep.totalPayout || 0);
        // В бонусной игре с активным жёлтым: эффективный множитель = мультипликатор жёлтого сундука + множитель бомбы (суммируются)
        const hasYellowBonus = this.isBonusFromScenario && Array.isArray(this.activeChestsForBonus) && this.activeChestsForBonus.includes('yellow');
        const effectiveMult = (hasYellowBonus && winStep.multiplier != null)
          ? (winStep.yellowChestMultiplier ?? 0) + (winStep.multiplier || 1)
          : bombMult;
        const stepTotalPayout = basePayout * effectiveMult;
        displayBase = basePayout;
        displayMult = effectiveMult;
        displayTotal = stepTotalPayout;

        // Прибавляем к накопленной сумме за серию
        this.addToTotalWin(stepTotalPayout);
        
        // Показываем Total Win с текущим накопленным значением (сумма за серию) с задержкой 1 секунда
        if (this.totalWinDisplay) {
          setTimeout(() => {
            this.totalWinDisplay.show(this.getTotalWin());
          }, 1000);
        }
      }

      if (this.miniWinManager && !isMultiClusterNoBomb) {
        this.miniWinManager.showMiniWins(winStep, { multiClusterNoBomb: false, bombScenario: hasBomb });
      }
      this._setNonWinningSymbolsDimmed(winningSymbols, true);
      this._snapSymbolsToGrid();
      if (REMOVE_DELAY_BEFORE_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, REMOVE_DELAY_BEFORE_MS));
      }
      this.gameState = GAME_STATE.REMOVING_WINS;
      console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов (win → disappearance)`);

      if (this.miniWinManager && isMultiClusterNoBomb) {
        // Сценарий 2: ждём завершения мини винов + мини тотала и удаления символов
        await Promise.all([
          this.miniWinManager.showMiniWinsAndTotalForMultiCluster(winStep),
          this._removeWinningSymbolsWithWinAnimation(winningSymbols, {})
        ]);
      } else if (this.miniWinManager && hasBomb) {
        // Сценарий 3: мини тотал с бомбой — показываем база × эффективный множитель (жёлтый + бомба = например 30)
        const displayOpts = (displayBase != null && displayMult != null && displayTotal != null)
          ? { displayBase, displayMult, displayTotal }
          : null;
        await Promise.all([
          this.miniWinManager.showMiniWinsAndTotalWithBomb(winStep, 2000, displayOpts),
          this._removeWinningSymbolsWithWinAnimation(winningSymbols, { useBombScenario: true })
        ]);
      } else {
        // 1 кластер без бомбы: каскад стартует сразу после removal, минивин работает автономно (исчезновение накладывается на досыпание)
        await this._removeWinningSymbolsWithWinAnimation(winningSymbols, {});
        // clear() не вызываем — минивин завершится сам, следующий showMiniWins сделает clear при необходимости
      }
      this._setNonWinningSymbolsDimmed([], false);
    } else {
      console.log('📋 [SCENARIO] Нет выигрыша, но есть шаг каскада в сценарии - применяем его');
    }
    // Переводим сценарий только после окончания вин-анимаций
    console.log(`🔍 [DEBUG] _handleScenarioWinCheck: переход с шага ${this.currentScenarioStep + 1} на шаг ${nextStepIndex + 1}`);
    console.log(`[Bonus] Флаг перед переходом к следующему шагу: ${this.bonusTransitionPending}`);
    this.currentScenarioStep = nextStepIndex;
    console.log(`📋 [SCENARIO] Переход к шагу ${nextStepIndex + 1}/${this.currentScenario.length}, событие = ${this.getCurrentScenarioStep()?.event}`);
    console.log(`[Bonus] Флаг после перехода к следующему шагу: ${this.bonusTransitionPending}`);

    const nextStep = this.currentScenario[nextStepIndex];

    // Если следующий шаг - cascade, проверяем переход в бонус за шаг до spin
    if (nextStep.event === 'cascade') {
      const transitionStarted = await this._checkBonusTransitionBeforeSpin();
      if (transitionStarted) {
        return; // Переход запущен, прерываем выполнение
      }
    }
    
    // Если следующий шаг - spin и установлен флаг перехода в бонус, запускаем переход
    if ((nextStep.event === 'spin' || nextStep.event === 'spin-bomb' || nextStep.event === 'spin-win-bomb') && this.bonusTransitionPending) {
      console.log('[Bonus] ✅ Обнаружен переход к spin после выигрыша, запуск перехода в бонус');
      await this._triggerBonusTransition();
      return; // Прерываем сценарий, следующий спин не придет от текущего сценария
    }

    if (nextStep.event === 'spin' || nextStep.event === 'spin-bomb' || nextStep.event === 'spin-win-bomb') {
      this._setIdle();
      this.winCheckProcessed = false;
      return;
    }

    // Задержка перед досыпанием (MINI_WIN_DISPLAY.md)
    const DELAY_BEFORE_CASCADE_MS = 250;
    if (DELAY_BEFORE_CASCADE_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BEFORE_CASCADE_MS));
    }
    if (this.miniWinManager) {
      this.miniWinManager.clear();
    }

    // Запускаем каскад (уплотнение + досыпание)
    try {
      await this.processCascade();
    } catch (err) {
      console.error('❌ Ошибка при обработке каскада:', err);
      this._setIdle();
      this.winCheckProcessed = true;
      this.winCheckPending = false;
    }
  }

  // Обрабатывает выигрыш и запускает каскад
  async _handleWin(winningSymbols) {
    this._setNonWinningSymbolsDimmed(winningSymbols, true);
    this._snapSymbolsToGrid();
    const REMOVE_DELAY_BEFORE_MS = 150;
    if (REMOVE_DELAY_BEFORE_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, REMOVE_DELAY_BEFORE_MS));
    }
    this.gameState = GAME_STATE.REMOVING_WINS;
    console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов (win → disappearance)`);
    await this._removeWinningSymbolsWithWinAnimation(winningSymbols);
    this._setNonWinningSymbolsDimmed([], false);
    // Запускаем каскад
    try {
      await this.processCascade();
    } catch (err) {
      console.error('❌ Ошибка при обработке каскада:', err);
      this._setIdle();
      this.winCheckProcessed = true;
      this.winCheckPending = false;
    }
  }

  _onAllLanded() {
    
    // Проверка состояния (только режим сценария)
    if (this.gameState === GAME_STATE.REMOVING_WINS || 
        this.gameState === GAME_STATE.COMPACTING || 
        this.gameState === GAME_STATE.FILLING ||
        this.gameState === GAME_STATE.SPINNING) {
      return;
    }
    
    if (false) { // Удалено: режим без сценария больше не поддерживается
      if (this.gameState !== GAME_STATE.WAITING_LANDING && this.gameState !== GAME_STATE.IDLE) {
        return;
      }
    }
    
    if (this.winCheckProcessed || this.winCheckPending) return;
    
    // Применяем сетку из сценария после досыпания (особенно важно после взрыва бомбы)
    if (this.scenarioMode && this.gameState === GAME_STATE.WAITING_LANDING) {
      this._applyScenarioGridAfterFill();
    }
    
    // Проверяем условие перехода в бонус и устанавливаем флаг (но продолжаем выполнение каскада)
    const flagWasSet = this._checkAndSetBonusFlag();
    if (flagWasSet) {
      console.log(`[Bonus] ✅ Флаг установлен на шаге ${this.currentScenarioStep + 1}, текущий scatterCount: ${this.getCurrentScenarioStep()?.scatterCount}`);
    }
    
    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;
    // Сбрасываем флаг проигрывания анимации скаттеров для новой проверки выигрыша
    this.scatterHitAnimationsPlayed = false;
    
    // Небольшая задержка перед проверкой выигрыша, чтобы символы успели визуально приземлиться
    const DELAY_BEFORE_WIN_CHECK_MS = 50;
    
    setTimeout(async () => {
      this.winCheckPending = false;
      
      // Выигрыши только из сценария
      let winningSymbols = [];
      if (this.currentScenario) {
        console.log(`🔍 [DEBUG] _onAllLanded: текущий шаг = ${this.currentScenarioStep + 1}, событие = ${this.getCurrentScenarioStep()?.event || 'N/A'}`);
        const fromScenario = this._getWinningSymbolsFromScenario();
        winningSymbols = Array.isArray(fromScenario) ? fromScenario : [];
        console.log(`🔍 [DEBUG] _onAllLanded: найдено выигрышных символов = ${winningSymbols.length}`);
      }
      
      // Проверяем текущий шаг на spin-bomb или cascade-bomb ДО проверки следующего шага
      if (this.currentScenario) {
        const curStep = this.getCurrentScenarioStep();
        if (curStep && (curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb') && 
            curStep.bombType === 'explode' && curStep.explodedPositions) {
          console.log(`💣 [${curStep.event.toUpperCase()}] Обработка взрыва бомбы на шаге ${this.currentScenarioStep + 1}`);
          await this._handleBombExplode(curStep);
          // После взрыва переходим к следующему шагу (cascade или cascade-win) - закольцовывание
          const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
          const nextStepAfterBomb = this.currentScenario[nextStepIndex];
          // Следующий шаг может быть cascade, cascade-win, cascade-win-bomb или ещё один cascade-bomb/spin-bomb (уплотнение и досыпание всегда нужны)
          if (nextStepAfterBomb.event === 'cascade' || nextStepAfterBomb.event === 'cascade-win' ||
              nextStepAfterBomb.event === 'cascade-win-bomb' || nextStepAfterBomb.event === 'cascade-bomb' ||
              nextStepAfterBomb.event === 'spin-bomb') {
            this.currentScenarioStep = nextStepIndex;
            console.log(`💣 [${curStep.event.toUpperCase()}] Переход к шагу ${nextStepIndex + 1} (${nextStepAfterBomb.event}), запуск уплотнения и досыпания`);
            await this.processCascade();
          } else {
            console.warn(`⚠️ [${curStep.event.toUpperCase()}] Ожидалось событие cascade/cascade-win/cascade-bomb после взрыва, получено: ${nextStepAfterBomb.event}`);
            this._setIdle();
            this.winCheckProcessed = false;
          }
          return;
        }
      }
      
      // Проверяем следующий шаг только для обработки cascade-bomb ДО перехода
      // Обычные каскады обрабатываются через _handleScenarioWinCheck, который сам переходит к следующему шагу
      if (this.currentScenario) {
        const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
        const nextStep = this.currentScenario[nextStepIndex];
        
        // Обрабатываем событие cascade-bomb (explode режим) если это следующий шаг
        if (nextStep.event === 'cascade-bomb' && nextStep.bombType === 'explode') {
          await this._handleBombExplode(nextStep);
          // После взрыва переходим к следующему шагу (закольцовывание)
          const stepAfterBombIndex = (nextStepIndex + 1) % this.currentScenario.length;
          this.currentScenarioStep = stepAfterBombIndex;
          const stepAfterBomb = this.currentScenario[stepAfterBombIndex];
          if (stepAfterBomb.event === 'cascade-win' || stepAfterBomb.event === 'cascade-win-bomb') {
            const winningSymbolsAfterBomb = this._getWinningSymbolsFromScenario();
            if (Array.isArray(winningSymbolsAfterBomb) && winningSymbolsAfterBomb.length > 0) {
              await this._handleScenarioWinCheck(winningSymbolsAfterBomb);
            } else {
              await this.processCascade();
            }
          } else if (stepAfterBomb.event === 'cascade' || stepAfterBomb.event === 'cascade-bomb' || stepAfterBomb.event === 'spin-bomb') {
            await this.processCascade();
          } else {
            this._setIdle();
            this.winCheckProcessed = false;
          }
          return;
        }
      }
      
      // Логика проверки выигрыша
      if (winningSymbols.length > 0) {
        // В режиме сценария используем _handleScenarioWinCheck для правильного перехода к следующему шагу
        if (this.scenarioMode) {
          await this._handleScenarioWinCheck(winningSymbols);
          // Hit анимация скаттеров НЕ вызывается здесь: после досыпки при приземлении
          // сработает следующий _onAllLanded, и hit проиграется один раз в ветке «нет выигрыша»
        } else {
          await this._handleWin(winningSymbols);
        }
      } else {
        console.log('✅ [IDLE] Выигрышных комбинаций не найдено, каскад завершен');
        const curStep = this.getCurrentScenarioStep();
        console.log(`[Bonus] 🔍 Проверка в else ветке: curStep=${curStep ? curStep.event : 'null'}, currentScenarioStep=${this.currentScenarioStep + 1}, флаг=${this.bonusTransitionPending}`);
        
        // ВАЖНО: Если флаг установлен, это гарантирует переход в бонус
        // Проверяем переход ПЕРВЫМ ДЕЛОМ, до любых других действий
        if (this.bonusTransitionPending) {
          console.log(`[Bonus] ✅✅✅ Флаг установлен (${this.bonusTransitionPending}), проверяем переход в бонус ✅✅✅`);
          const transitionStarted = await this._checkBonusTransitionBeforeSpin();
          if (transitionStarted) {
            return; // Переход запущен, прерываем выполнение
          }
        }
        
        if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin' || curStep.event === 'spin-win-bomb' || 
            curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb' || curStep.event === 'cascade-win-bomb')) {
          console.log(`[Bonus] 🔍 Попали в условие для ${curStep.event}`);
          // На шаге cascade/spin/spin-win-bomb/spin-bomb/cascade-bomb/cascade-win-bomb дальше только по нажатию спин — не двигаем сценарий
          
          // Проигрываем hit анимацию для скаттеров в следующих случаях:
          // 1. Спин без выигрыша (текущий шаг - spin)
          if (curStep.event === 'spin') {
            console.log(`[Bonus] 🔍 Текущий шаг - spin, проигрываем hit анимации`);
            this._playScatterHitAnimations();
          }
          // 2. Последний каскад (текущий шаг - cascade без выигрыша, следующий - spin)
          else if (curStep.event === 'cascade') {
            // Проверяем следующий шаг для обычной логики
            const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
            const nextStep = this.currentScenario[nextStepIndex];
            if (nextStep && nextStep.event === 'spin') {
              // Если флаг НЕ установлен, проигрываем обычные hit анимации
              if (!this.bonusTransitionPending) {
                console.log('[Bonus] ⚠️ Флаг НЕ установлен, проигрываем обычные hit анимации');
                this._playScatterHitAnimations();
              } else {
                console.log('[Bonus] ✅ Флаг установлен, hit анимации будут проиграны в _triggerBonusTransition()');
              }
            }
          } else {
            console.log(`[Bonus] ⚠️ Текущий шаг не spin и не cascade (${curStep.event}), не проигрываем hit анимации`);
          }
        } else {
          await this._handleScenarioNoWin();
        }
        this._setIdle();
        this.winCheckProcessed = false;
      }
    }, DELAY_BEFORE_WIN_CHECK_MS);
  }

  /**
   * Проигрывает анимацию hit для всех скаттеров на поле
   * Защита от повторных вызовов: вызывается только один раз за проверку выигрыша
   */
  _playScatterHitAnimations() {
    // Если анимация уже была проиграна в текущей проверке выигрыша, игнорируем вызов
    if (this.scatterHitAnimationsPlayed) {
      return;
    }
    
    // Устанавливаем флаг, что анимация проиграна
    this.scatterHitAnimationsPlayed = true;
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const symbol = this.grid[col][row];
        if (symbol && symbol.isScatter && symbol.playScatterHitAnimation) {
          symbol.playScatterHitAnimation();
        }
      }
    }
  }

  // Получает выигрышные символы из сценария на основе winningGroups и groupMarkup
  _getWinningSymbolsFromScenario() {
    if (!this.scenarioMode || !this.currentScenario) {
      return null; // Вернуть null для обычного режима
    }
    
    const step = this.getCurrentScenarioStep();
    if (!step) return [];
    // События без выигрыша: cascade, spin, spin-bomb, cascade-bomb (бомба с выигрышем имеет выигрышные группы)
    if (step.event === 'cascade' || step.event === 'spin' || step.event === 'spin-bomb' || step.event === 'cascade-bomb') return []; // без -win выигрыша нет
    // Примечание: spin-win-bomb и cascade-win-bomb имеют выигрышные группы, поэтому не возвращаем []
    if (!step.winningGroups || step.winningGroups.length === 0) return [];

    if (!step.groupMarkup) {
      console.warn('⚠️ [SCENARIO] groupMarkup отсутствует в шаге, выигрышей по сценарию нет');
      return [];
    }
    
    const winningSymbols = [];
    const groupMarkup = step.groupMarkup; // [row][col] = groupId
    
    // Для каждой выигрышной группы находим символы
    for (const winningGroup of step.winningGroups) {
      const groupId = winningGroup.groupId;
      const symbolType = winningGroup.symbolType;
      
      // Находим все позиции с этим groupId в groupMarkup
      for (let row = 0; row < this.GRID_ROWS; row++) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          if (groupMarkup[row][col] === groupId) {
            const symbol = this.grid[col][row];
            if (symbol && symbol.textureIndex === symbolType) {
              winningSymbols.push(symbol);
            }
          }
        }
      }
    }

    // spin-win-bomb / cascade-win-bomb: бомба удаляется вместе с выигрышными (multiplier)
    if ((step.event === 'spin-win-bomb' || step.event === 'cascade-win-bomb') &&
        step.bombType === 'multiplier' && step.bombPosition) {
      const col = step.bombPosition.col;
      const row = step.bombPosition.row;
      if (col >= 0 && col < this.GRID_COLS && row >= 0 && row < this.GRID_ROWS) {
        const bombSymbol = this.grid[col][row];
        if (bombSymbol && winningSymbols.indexOf(bombSymbol) === -1) {
          winningSymbols.push(bombSymbol);
        }
      }
    }
    
    return winningSymbols;
  }

  // Определяет выигрышные комбинации — ОТКЛЮЧЕНО: выигрыш только по сценарию (минимум 7 символов по payouts).
  findWinningCombinations() {
    return [];
  }

  /** Выравнивает все символы по статичной матрице — сценарий задаёт конечные позиции. */
  _snapSymbolsToGrid() {
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const symbol = this.grid[col]?.[row];
        if (symbol && this.gridPositions[col]?.[row]) {
          const pos = this.gridPositions[col][row];
          symbol.isFalling = false;
          if (typeof symbol.setPosition === 'function') {
            symbol.setPosition(pos.x, pos.y);
          }
        }
      }
    }
  }

  /**
   * Запускает win-анимацию (win → disappearance) на выигрышных символах, по завершении удаляет их
   * и сразу разрешает Promise — уплотнение/досыпка по сценарию запускаются без паузы.
   * @param {Object[]} winningSymbols
   * @param {Object} [opts] - useBombScenario: true для spin-win-bomb/cascade-win-bomb (2×win + big_start→big_boom)
   */
  _removeWinningSymbolsWithWinAnimation(winningSymbols, opts = {}) {
    return new Promise((resolve) => {
      if (!winningSymbols || winningSymbols.length === 0) {
        resolve();
        return;
      }
      const useBombScenario = opts.useBombScenario === true;
      if (useBombScenario) {
        this._startFieldScaleDown(2000, 0.92);
      }
      const animOpts = useBombScenario ? { doubleWin: true, useBigBomb: true } : {};
      const bombSymbol = useBombScenario ? winningSymbols.find(s => s.isBomb) : null;
      const others = bombSymbol ? winningSymbols.filter(s => s !== bombSymbol) : winningSymbols;
      let pending = winningSymbols.length;
      const onOneComplete = () => {
        pending--;
        if (pending === 0) {
          if (useBombScenario) SoundManager.playWin();
          console.log('🗑️ Win-анимации завершены, запуск уплотнения/досыпки');
          resolve();
        }
      };
      for (const symbol of others) {
        const col = symbol.col;
        const row = symbol.row;
        if (col !== null && row !== null) {
          this.grid[col][row] = null;
        }
        if (typeof symbol.showWinAnimation === 'function') {
          symbol.showWinAnimation(() => {
            symbol.destroy();
            onOneComplete();
          }, animOpts);
        } else {
          symbol.destroy();
          onOneComplete();
        }
      }
      if (bombSymbol && this.bombWinOverlayContainer) {
        const col = bombSymbol.col;
        const row = bombSymbol.row;
        if (col !== null && row !== null) {
          this.grid[col][row] = null;
        }
        if (bombSymbol.bombSpineInstance) {
          bombSymbol.bombSpineInstance.visible = false;
        }
        const multiplierText = (this.getCurrentScenarioStep()?.multiplier != null)
          ? `x${this.getCurrentScenarioStep().multiplier}` : 'x5';
        const overlaySpine = Symbol.createBombSpineOverlayInstance(multiplierText);
        if (overlaySpine) {
          const globalPos = new PIXI.Point();
          bombSymbol.cellContainer.getGlobalPosition(globalPos);
          this.bombWinOverlayContainer.visible = true;
          const localPos = this.bombWinOverlayContainer.toLocal(globalPos);
          overlaySpine.x = localPos.x + this.SYMBOL_SIZE / 2;
          overlaySpine.y = localPos.y + this.SYMBOL_SIZE / 2;
          this.bombWinOverlayContainer.addChild(overlaySpine);
          Symbol.playBombWinAnimationOnSpine(overlaySpine, () => {
            if (this.bombWinOverlayContainer.children.includes(overlaySpine)) {
              this.bombWinOverlayContainer.removeChild(overlaySpine);
            }
            if (overlaySpine.destroy && !overlaySpine.destroyed) {
              try { if (overlaySpine.state) overlaySpine.state.clearTracks(); } catch (e) {}
              overlaySpine.destroy();
            }
            this.bombWinOverlayContainer.visible = false;
            bombSymbol.destroy();
            onOneComplete();
          });
        } else {
          if (typeof bombSymbol.showWinAnimation === 'function') {
            bombSymbol.showWinAnimation(() => {
              bombSymbol.destroy();
              onOneComplete();
            }, animOpts);
          } else {
            bombSymbol.destroy();
            onOneComplete();
          }
        }
      } else if (bombSymbol) {
        const col = bombSymbol.col;
        const row = bombSymbol.row;
        if (col !== null && row !== null) {
          this.grid[col][row] = null;
        }
        if (typeof bombSymbol.showWinAnimation === 'function') {
          bombSymbol.showWinAnimation(() => {
            bombSymbol.destroy();
            onOneComplete();
          }, animOpts);
        } else {
          bombSymbol.destroy();
          onOneComplete();
        }
      }
    });
  }

  // Удаляет выигрышные символы с поля (без анимации)
  removeWinningSymbols(winningSymbols) {
    for (const symbol of winningSymbols) {
      if (symbol.col !== null && symbol.row !== null) {
        this.grid[symbol.col][symbol.row] = null;
      }
      symbol.destroy();
    }
    console.log(`🗑️ Удалено ${winningSymbols.length} выигрышных символов`);
  }

  /** Запускает boom_disappearance у символов-соседей бомбы (по ивенту "boom"). Вызывается из Symbol.onBombBoomEvent. */
  _startBombNeighborDisappearance() {
    if (!this._pendingBombNeighborSymbols || this._pendingBombNeighborSymbols.length === 0) return;
    const neighbors = this._pendingBombNeighborSymbols;
    const onComplete = this._pendingBombNeighborOnComplete;
    this._pendingBombNeighborSymbols = null;
    this._pendingBombNeighborOnComplete = null;
    for (const sym of neighbors) {
      if (sym && typeof sym.showBoomDisappearance === 'function') {
        sym.showBoomDisappearance(onComplete);
      } else if (typeof onComplete === 'function') {
        onComplete();
      }
    }
  }

  /** Запускает boom анимацию на скаттерах, попавших под взрыв бомбы. Вызывается из Symbol.onBombBoomEvent. */
  _startScatterBoomAnimations() {
    if (!this._pendingBombScatters || this._pendingBombScatters.length === 0) return;
    const scatters = this._pendingBombScatters;
    this._pendingBombScatters = null;
    console.log(`💥 [BOMB] Проигрываем boom анимацию на ${scatters.length} скаттерах`);
    for (const scatter of scatters) {
      if (scatter && typeof scatter.playScatterBoomAnimation === 'function') {
        scatter.playScatterBoomAnimation();
      }
    }
  }

  /**
   * Тряска игрового поля (контейнера с символами). Вызывается при взрыве бомбы.
   * @param {number} durationMs - длительность в мс
   * @param {number} intensity - амплитуда смещения в пикселях
   */
  _shakeField(durationMs = 400, intensity = 10) {
    const container = this.shakeContainer || this.container;
    if (!container) return;
    const baseX = container.x;
    const baseY = container.y;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        container.x = baseX;
        container.y = baseY;
        return;
      }
      const decay = 1 - elapsed / durationMs;
      const offsetX = (Math.random() - 0.5) * 2 * intensity * decay;
      const offsetY = (Math.random() - 0.5) * 2 * intensity * decay;
      container.x = baseX + offsetX;
      container.y = baseY + offsetY;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /**
   * Устанавливает pivot контейнера в центр поля (в локальных координатах) и позицию в мировые координаты центра.
   * Сохраняет pivot в this._fieldScalePivotX/Y для сброса после баунса.
   */
  _setFieldPivotToCenter(container) {
    const bounds = container.getLocalBounds();
    const px = bounds.x + bounds.width / 2;
    const py = bounds.y + bounds.height / 2;
    const scale = (container.scale && container.scale.x != null) ? container.scale.x : 1;
    const worldCenterX = container.x + px * scale;
    const worldCenterY = container.y + py * scale;
    container.pivot.set(px, py);
    container.position.set(worldCenterX, worldCenterY);
    this._fieldScalePivotX = px;
    this._fieldScalePivotY = py;
  }

  /** Сбрасывает pivot в (0,0) и восстанавливает позицию верхнего левого угла (после баунса). */
  _resetFieldPivot(container) {
    const px = this._fieldScalePivotX ?? 0;
    const py = this._fieldScalePivotY ?? 0;
    const scale = (container.scale && container.scale.x != null) ? container.scale.x : 1;
    const worldCenterX = container.x;
    const worldCenterY = container.y;
    container.pivot.set(0, 0);
    container.position.set(worldCenterX - px * scale, worldCenterY - py * scale);
    this._fieldScalePivotX = null;
    this._fieldScalePivotY = null;
  }

  /** Медленно уменьшает масштаб поля относительно центра (для spin-win-bomb / cascade-win-bomb). По событию boom вызывается _scaleFieldBounceBack(). */
  _startFieldScaleDown(durationMs = 2000, minScale = 0.92) {
    const container = this.shakeContainer || this.container;
    if (!container) return;
    this._fieldScaleDownActive = true;
    this._setFieldPivotToCenter(container);
    const start = performance.now();
    const baseScale = (container.scale && container.scale.x != null) ? container.scale.x : 1;
    const tick = () => {
      if (!this._fieldScaleDownActive) return;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        container.scale.set(minScale);
        return;
      }
      const t = elapsed / durationMs;
      const s = baseScale + (minScale - baseScale) * t;
      container.scale.set(s);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Easing easeOutBack с усиленным перелётом (для баунса масштаба — ощутимее вылет за 1). */
  _easeOutBack(t) {
    const c1 = 2.6;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * Возвращает масштаб поля к 1 с баунсом. Сброс pivot делаем после окончания тряски (450ms),
   * чтобы _shakeField не перезаписал position «центром» — иначе поле слетает.
   */
  _scaleFieldBounceBack(durationMs = 450, shakeDurationMs = 450) {
    const container = this.shakeContainer || this.container;
    if (!container) return;
    const startScale = (container.scale && container.scale.x != null) ? container.scale.x : 1;
    if (startScale >= 0.99) {
      if (this._fieldScalePivotX != null) this._resetFieldPivot(container);
      container.scale.set(1);
      return;
    }
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        container.scale.set(1);
        const resetAfterShake = () => {
          if (this._fieldScalePivotX != null) this._resetFieldPivot(container);
        };
        setTimeout(resetAfterShake, shakeDurationMs + 20);
        return;
      }
      const t = elapsed / durationMs;
      const eased = this._easeOutBack(t);
      const s = startScale + (1 - startScale) * eased;
      container.scale.set(s);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /**
   * Обрабатывает взрыв бомбы (explode режим) - удаляет бомбу и соседей согласно explodedPositions
   * @param {Object} step - Шаг сценария с событием spin-bomb, cascade-bomb или bomb и bombType === 'explode'
   */
  async _handleBombExplode(step) {
    if (!step || (step.event !== 'bomb' && step.event !== 'spin-bomb' && step.event !== 'cascade-bomb') ||
        step.bombType !== 'explode' || !step.explodedPositions) {
      console.warn(`⚠️ [BOMB] Некорректные параметры для взрыва бомбы:`, step);
      return;
    }
    // Тряска поля и звук взрыва — по ивенту "boom" в анимации бомбы (Symbol.onBombBoomEvent)

    const symbolsToRemove = [];
    const scattersUnderExplosion = [];
    
    // Собираем все символы для удаления (бомба + соседи)
    // Важно: в сценарии используется формат [row][col], в CascadeManager - [col][row]
    // Проверяем groupMarkup для пропуска скаттеров (помечены значением -2)
    for (const pos of step.explodedPositions) {
      const col = pos.col;
      const row = pos.row;
      if (col >= 0 && col < this.GRID_COLS && row >= 0 && row < this.GRID_ROWS) {
        // Проверяем groupMarkup: если значение -2, это скаттер под взрывом (не удаляем, но собираем для анимации boom)
        if (step.groupMarkup && step.groupMarkup[row] && step.groupMarkup[row][col] === -2) {
          const scatterSymbol = this.grid[col][row];
          if (scatterSymbol && scatterSymbol.isScatter) {
            scattersUnderExplosion.push(scatterSymbol);
          }
          continue; // Пропускаем скаттер при удалении
        }
        
        const symbol = this.grid[col][row];
        if (symbol) {
          symbolsToRemove.push(symbol);
        }
      }
    }
    
    // Сохраняем скаттеры под взрывом для анимации boom (вызовется по ивенту "boom")
    this._pendingBombScatters = scattersUnderExplosion.length > 0 ? scattersUnderExplosion : null;
    
    if (symbolsToRemove.length === 0) {
      console.warn('⚠️ [BOMB] Нет символов для удаления при взрыве бомбы');
      return;
    }
    
    console.log(`💣 [BOMB] Взрыв бомбы: удаление ${symbolsToRemove.length} символов`);
    this._snapSymbolsToGrid();
    const REMOVE_DELAY_BEFORE_MS = 150;
    if (REMOVE_DELAY_BEFORE_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, REMOVE_DELAY_BEFORE_MS));
    }
    this.gameState = GAME_STATE.REMOVING_WINS;

    const bombSymbol = symbolsToRemove.find(s => s.isBomb);
    const neighborSymbols = symbolsToRemove.filter(s => !s.isBomb);

    await new Promise((resolve) => {
      let pending = symbolsToRemove.length;
      const onOneComplete = () => {
        pending--;
        if (pending === 0) {
          // Уничтожаем в следующем кадре, чтобы не ломать SpinePipe (slotBatches) во время рендера
          requestAnimationFrame(() => {
            for (const s of symbolsToRemove) {
              try {
                if (s.cellContainer && s.cellContainer.parent) {
                  s.cellContainer.parent.removeChild(s.cellContainer);
                }
                s.destroy();
              } catch (e) {}
            }
            console.log(`💣 [BOMB] Символы удалены, готово к уплотнению и досыпанию`);
            resolve();
          });
        }
      };

      for (const symbol of symbolsToRemove) {
        const col = symbol.col;
        const row = symbol.row;
        if (col !== null && row !== null) this.grid[col][row] = null;
      }

      if (bombSymbol) {
        this._pendingBombNeighborSymbols = neighborSymbols;
        this._pendingBombNeighborOnComplete = onOneComplete;
        if (typeof bombSymbol.showWinAnimation === 'function') {
          bombSymbol.showWinAnimation(onOneComplete);
        } else {
          bombSymbol.destroy();
          onOneComplete();
        }
      } else {
        this._pendingBombNeighborSymbols = null;
        this._pendingBombNeighborOnComplete = null;
        for (const sym of neighborSymbols) {
          if (sym && typeof sym.showBoomDisappearance === 'function') {
            sym.showBoomDisappearance(onOneComplete);
          } else {
            if (sym) try { sym.destroy(); } catch (e) {}
            onOneComplete();
          }
        }
      }
    });
  }

  // Уплотняет колонки - символы падают вниз, заполняя пустоты
  compactColumns() {
    let hasMoved = false;
    const emptySpots = []; // Массив пустых мест для каждой колонки: [{col, row}, ...]
    
    // Для каждой колонки
    for (let col = 0; col < this.GRID_COLS; col++) {
      // Находим все символы в колонке (снизу вверх)
      const symbolsInColumn = [];
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[col][row]) {
          symbolsInColumn.push({ symbol: this.grid[col][row], oldRow: row });
        }
      }
      
      // Очищаем колонку
      for (let row = 0; row < this.GRID_ROWS; row++) {
        this.grid[col][row] = null;
      }
      
      // Размещаем символы снизу вверх
      for (let i = 0; i < symbolsInColumn.length; i++) {
        const newRow = this.GRID_ROWS - 1 - i;
        const { symbol, oldRow } = symbolsInColumn[i];
        
        // Обновляем позицию символа в сетке
        symbol.col = col;
        symbol.row = newRow;
        this.grid[col][newRow] = symbol;
        
        // Если позиция изменилась - запускаем падение
        if (oldRow !== newRow) {
          const newPosition = this.gridPositions[col][newRow];
          symbol.targetX = newPosition.x;
          symbol.targetY = newPosition.y;
          // Устанавливаем колбэк для символа при приземлении (если еще не установлен)
          if (!symbol.onLandedCallback) {
            this._setupLandedCallback(symbol);
          }
          // Символ уже находится на своей текущей позиции, просто запускаем падение
          symbol.startFall();
          hasMoved = true;
        } else {
          // Если позиция не изменилась, убеждаемся что символ точно на месте
          const position = this.gridPositions[col][newRow];
          symbol.setPosition(position.x, position.y);
        }
      }
      
      // Определяем пустые места вверху колонки
      const filledRows = symbolsInColumn.length;
      for (let row = 0; row < this.GRID_ROWS - filledRows; row++) {
        emptySpots.push({ col, row });
      }
    }
    
    return { hasMoved, emptySpots };
  }

  // Создает новые символы сверху для заполнения пустых мест
  createNewSymbolsForEmptySpots(emptySpots) {
    if (emptySpots.length === 0) {
      return false;
    }
    
    // Группируем пустые места по колонкам
    const emptyByColumn = new Map();
    for (const spot of emptySpots) {
      if (!emptyByColumn.has(spot.col)) {
        emptyByColumn.set(spot.col, []);
      }
      emptyByColumn.get(spot.col).push(spot.row);
    }
    
    // Создаем новые символы для каждой колонки
    this._lastCreatedSymbol = null;
    const columns = Array.from(emptyByColumn.entries());
    columns.sort((a, b) => a[0] - b[0]); // Сортируем колонки по порядку
    
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const [col, rows] = columns[colIdx];
      // Сортируем строки сверху вниз (от меньшего к большему)
      rows.sort((a, b) => a - b);
      
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const position = this.gridPositions[col][row];
        const textureIndex = this._getSymbolIndex(col, row, 'refill');
        
        // Создаем новый символ сверху экрана
        const symbol = new Symbol(
          position.x,  // X позиция правильная (центр колонки)
          position.y,  // Y будет использован как targetY, но символ начнет сверху
          textureIndex, 
          this.container,
          this.symbolTextures,
          this.SYMBOL_SIZE,
          this.SYMBOL_TEXTURE_SIZE,
          this.FALL_SPEED,
          col,
          row
        );
        
        // Устанавливаем целевую позицию
        symbol.targetX = position.x;
        symbol.targetY = position.y;
        // Символ уже создан сверху (currentY = -SYMBOL_SIZE/2 в конструкторе)
        
        // Устанавливаем колбэк для символа при приземлении
        this._setupLandedCallback(symbol);
        
        // Добавляем в сетку
        this.grid[col][row] = symbol;
        
        // Последний символ - последняя колонка, последний ряд в этой колонке
        if (colIdx === columns.length - 1 && rowIdx === rows.length - 1) {
          this._lastCreatedSymbol = symbol;
        }
      }
    }
    
    // В режиме сценария сохраняем ссылку на последний символ
    // Колбэк будет установлен после завершения startNewSymbolsFall()
    if (this.scenarioMode && this._lastCreatedSymbol) {
      console.log(`🎯 [SCENARIO] Последний символ определен (refill) (col: ${this._lastCreatedSymbol.col}, row: ${this._lastCreatedSymbol.row}), колбэк будет установлен после запуска падения`);
    } else if (this.scenarioMode && emptySpots.length > 0) {
      console.warn(`⚠️ [SCENARIO] Режим сценария активен при досыпании, но последний символ не найден!`);
    }
    
    return true;
  }

  // Запускает падение новых символов с задержками
  // Параллельные колонки, задержки по сценарию (интрига при scatterCount < 4)
  async startNewSymbolsFall(emptySpots) {
    if (emptySpots.length === 0) return;

    this._intrigueForColumn = new Array(this.GRID_COLS).fill(false);
    this._intrigueHighlightShownThisPhase = false;
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (step) {
        if (step.scatterCount >= 4) {
          // Без интриги — уже fill(false)
        } else if (step.grid) {
          for (let col = 0; col < this.GRID_COLS; col++) {
            this._intrigueForColumn[col] = this._shouldColumnHaveIntrigue(step, col);
          }
        }
      }
    }

    const emptyByColumn = new Map();
    for (const spot of emptySpots) {
      if (!emptyByColumn.has(spot.col)) {
        emptyByColumn.set(spot.col, []);
      }
      emptyByColumn.get(spot.col).push(spot.row);
    }

    const columnPromises = [];
    for (const [col, rows] of emptyByColumn.entries()) {
      rows.sort((a, b) => a - b);
      let delayMs = 0;
      for (let c = 0; c < col; c++) {
        delayMs += this._getEffectiveDelays(c).columnDelay * 1000;
      }
      const columnPromise = new Promise((resolve) => {
        const timerId = setTimeout(async () => {
          const idx = this.activeTimers.indexOf(timerId);
          if (idx > -1) this.activeTimers.splice(idx, 1);
          // Подсветка рила в режиме интриги при досыпке: первое появление — задержка 0.5 сек
          if (this._intrigueForColumn[col]) {
            if (!this._intrigueHighlightShownThisPhase) {
              await this._delay(this.INTRIGUE_FIRST_SHOW_DELAY);
              this._intrigueHighlightShownThisPhase = true;
            }
            this._showIntrigueHighlight(col);
          } else {
            this._hideIntrigueHighlight();
          }
          for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const symbol = this.grid[col][row];
            if (symbol) symbol.startFall();
            if (i > 0) {
              const { rowDelay } = this._getEffectiveDelays(col);
              if (rowDelay > 0) await this._delay(rowDelay);
            }
          }
          resolve();
        }, delayMs);
        this.activeTimers.push(timerId);
      });
      columnPromises.push(columnPromise);
    }
    await Promise.all(columnPromises);
    this._hideIntrigueHighlight();
  }

  // Обрабатывает уплотнение колонок в каскаде
  async _processCascadeCompacting() {
    // Уплотняем колонки (задержка не нужна в режиме сценария)
    const { hasMoved, emptySpots } = this.compactColumns();
    
    if (hasMoved) {
      console.log('⬇️ [COMPACTING] Запущено падение символов для заполнения пустот');
    }
    
    return { hasMoved, emptySpots };
  }

  // Обрабатывает досыпание новых символов в каскаде
  async _processCascadeFilling(emptySpots) {
    if (emptySpots.length === 0) return false;
    
    this.gameState = GAME_STATE.FILLING;
    console.log(`✨ [FILLING] Создано ${emptySpots.length} новых символов для заполнения пустот`);
    this.createNewSymbolsForEmptySpots(emptySpots);
    await this.startNewSymbolsFall(emptySpots);
    
    this._setWaitingLandingState();
    
    // Колбэк уже установлен для всех символов в createNewSymbolsForEmptySpots()
    
    return true;
  }

  // Обрабатывает только уплотнение без досыпания
  _processCascadeCompactingOnly(hasMoved) {
    this._setWaitingLandingState();
    
    // Колбэки уже установлены для всех падающих символов в compactColumns()
    // Если нет падающих символов, сразу проверяем выигрыш
    if (!hasMoved) {
      setTimeout(() => {
        if (!this.winCheckProcessed && !this.winCheckPending) {
          this._onAllLanded();
        }
      }, 0);
    }
  }

  // Обрабатывает каскадный эффект после удаления выигрышных символов
  async processCascade() {
    console.log(`🔄 [CASCADE] processCascade вызван, текущее состояние: ${this.gameState}`);
    // Проверяем, что мы не в процессе другого каскада
    if (this.gameState === GAME_STATE.COMPACTING || this.gameState === GAME_STATE.FILLING) {
      console.warn('⚠️ Каскад уже в процессе, пропускаем');
      return;
    }
    
    // Если мы в состоянии REMOVING_WINS (после взрыва бомбы), это нормально - продолжаем
    // Если мы в состоянии SPINNING, это тоже нормально - продолжаем после спина
    
    console.log(`🔄 [CASCADE] Устанавливаем состояние COMPACTING`);
    this.gameState = GAME_STATE.COMPACTING;

    SoundManager.playCascade();

    // Блокируем кнопку спин на 2 секунды при начале каскада
    if (this._blockSpinButton) {
      this._blockSpinButton();
    }
    
    const { hasMoved, emptySpots } = await this._processCascadeCompacting();
    console.log(`🔄 [CASCADE] Уплотнение завершено: hasMoved=${hasMoved}, emptySpots=${emptySpots.length}`);
    
    if (hasMoved || emptySpots.length > 0) {
      if (emptySpots.length > 0) {
        console.log(`🔄 [CASCADE] Запуск досыпания ${emptySpots.length} символов`);
        await this._processCascadeFilling(emptySpots);
      } else {
        console.log(`🔄 [CASCADE] Только уплотнение, без досыпания`);
        this._processCascadeCompactingOnly(hasMoved);
      }
      
      // В режиме сценария проверка выигрыша происходит через колбэки приземления
    } else {
      // Если установлен флаг перехода в бонус, не переходить к следующему шагу
      // (каскад уже завершен, переход в бонус будет запущен в _handleScenarioNoWin() или _handleScenarioWinCheck())
      if (this.bonusTransitionPending) {
        return;
      }
      
      // Если ничего не переместилось и нет пустых мест - каскад завершен
      // В режиме сценария переход к следующему шагу происходит в _onAllLanded(), а не здесь
      const curStep = this.getCurrentScenarioStep();
      if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin' || curStep.event === 'spin-win-bomb' || 
          curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb' || curStep.event === 'cascade-win-bomb')) {
        // Уже на cascade/spin/spin-win-bomb/spin-bomb/cascade-bomb/cascade-win-bomb — без спина никуда не идём
        // Переход к следующему шагу произойдет в _onAllLanded() после проверки выигрыша
        this._setIdle();
        this.winCheckProcessed = true;
        return;
      }
      // Если текущий шаг не является каскадом или спином, переходим к следующему спину
      await this._handleScenarioNoWin();
      this._setIdle();
      this.winCheckProcessed = true;
    }
  }

  /** Включить/выключить отладочные элементы у всех символов (зелёные рамки и индексы на падающих символах) */
  setSymbolDebugOverlayVisible(visible) {
    Symbol.debugOverlayVisible = visible;
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const symbol = this.grid[col][row];
        if (symbol && symbol.setDebugOverlayVisible) symbol.setDebugOverlayVisible(visible);
      }
    }
    for (const symbol of this.oldSymbols) {
      if (symbol && symbol.setDebugOverlayVisible) symbol.setDebugOverlayVisible(visible);
    }
  }

  // Обновление всех символов
  update(deltaTime) {
    // Обновляем символы в сетке
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        if (this.grid[col][row]) {
          this.grid[col][row].update(deltaTime);
        }
      }
    }
    
    // Обновляем старые символы, которые падают вниз
    for (const symbol of this.oldSymbols) {
      if (symbol) {
        symbol.update(deltaTime);
      }
    }
    
    // Spine обновляется автоматически (autoUpdate = true), не нужно обновлять вручную
    
    // Проверка выигрыша выполняется по таймеру (_scheduleWinCheck), не в update
  }

  // ========== МЕТОДЫ РАБОТЫ СО СЦЕНАРИЯМИ ==========

  /**
   * Загружает сценарий и устанавливает режим сценария
   * @param {Array} scenarioJson - Массив шагов сценария
   */
  loadScenario(scenarioJson) {
    if (!Array.isArray(scenarioJson) || scenarioJson.length === 0) {
      console.warn('⚠️ Некорректный сценарий:', scenarioJson);
      return false;
    }

    // Сброс бонусного состояния при загрузке обычного сценария
    this.isBonusFromScenario = false;
    this.yellowChestMultiplierPerBomb = 1;
    this.currentFreeSpinsRemaining = 0;
    if (typeof Symbol !== 'undefined' && Symbol.useScatterFsSkins !== undefined) Symbol.useScatterFsSkins = false;
    this._removeBonusBackground();
    if (this.onBonusModeChange) this.onBonusModeChange(false, null, 0, 0);
    
    this.currentScenario = scenarioJson;
    this.scenarioMode = true;
    
    const firstStep = scenarioJson[0];
    const isBonusInit = firstStep && firstStep.event === 'bonus-init' && firstStep.isBonus === true;
    
    if (isBonusInit) {
      this.isBonusFromScenario = true;
      if (typeof Symbol !== 'undefined' && Symbol.useScatterFsSkins !== undefined) Symbol.useScatterFsSkins = true;
      this.activeChestsForBonus = Array.isArray(firstStep.activeChests) ? [...firstStep.activeChests] : [];
      this.yellowChestMultiplierPerBomb = typeof firstStep.yellowChestMultiplierPerBomb === 'number'
        ? firstStep.yellowChestMultiplierPerBomb : 1;
      this.currentScenarioStep = 0;
      if (this.onBonusScenarioLoaded) this.onBonusScenarioLoaded(this.activeChestsForBonus);
      this._addBackgroundLayer().catch(err => console.warn('[Bonus] Ошибка добавления фона:', err));
      const firstSpinStep = scenarioJson[1];
      const freeSpins = firstSpinStep?.freeSpinsRemaining ?? 0;
      // Инициализируем текущий счётчик фриспинов из первого шага спина
      this.currentFreeSpinsRemaining = freeSpins;
      const yellowMult = firstSpinStep?.yellowChestMultiplier ?? 0;
      if (this.onBonusModeChange) this.onBonusModeChange(true, this.activeChestsForBonus, freeSpins, yellowMult);
      console.log(`✅ Бонусный сценарий загружен: ${scenarioJson.length} шагов, activeChests=${this.activeChestsForBonus.join(',')}, первый спин — шаг 2`);
    } else {
      this.currentScenarioStep = -1;
      console.log(`✅ Сценарий загружен: ${scenarioJson.length} шагов. Текущий шаг: -1 (ожидание первого нажатия)`);
    }
    
    this._setIdle();
    this.winCheckProcessed = false;
    this.winCheckPending = false;
    
    return true;
  }

  /**
   * Устанавливает текущий шаг сценария
   * @param {number} stepIndex - Индекс шага
   */
  setScenarioStep(stepIndex) {
    if (!this.currentScenario || stepIndex < 0 || stepIndex >= this.currentScenario.length) {
      return false;
    }
    this.currentScenarioStep = stepIndex;
    return true;
  }

  /**
   * Конвертирует сетку из формата сценария [row][col] в формат CascadeManager [col][row]
   * @param {Array<Array<number>>} scenarioGrid - Сетка из сценария [row][col]
   * @returns {Array<Array<number>>} Сетка в формате [col][row]
   */
  convertScenarioGridToInternal(scenarioGrid) {
    const internalGrid = [];
    for (let col = 0; col < this.GRID_COLS; col++) {
      internalGrid[col] = [];
      for (let row = 0; row < this.GRID_ROWS; row++) {
        internalGrid[col][row] = scenarioGrid[row][col];
      }
    }
    return internalGrid;
  }

  /**
   * Получает символ из текущего шага сценария
   * @param {number} col - Колонка
   * @param {number} row - Строка
   * @param {string} context - Контекст: 'spin', 'cascade', 'refill'
   * @returns {number|null} Индекс текстуры символа или null если нет данных
   */
  getNextScenarioSymbol(col, row, context = 'spin') {
    if (!this.scenarioMode || !this.currentScenario) {
      return null;
    }

    // Используем текущий шаг сценария
    // При обработке каскада currentScenarioStep уже установлен на шаг каскада
    // поэтому для 'refill' используем текущий шаг (который является каскадом)
    const stepIndex = this.currentScenarioStep;
    const step = this.currentScenario[stepIndex];
    
    if (!step || !step.grid) {
      console.warn(`⚠️ [SCENARIO] Шаг ${stepIndex} не найден или не имеет grid`);
      return null;
    }

    // Конвертируем сетку и получаем символ
    const internalGrid = this.convertScenarioGridToInternal(step.grid);
    const symbol = internalGrid[col][row] !== undefined ? internalGrid[col][row] : null;
    
    // Логируем бомбы для отладки
    if (symbol === 8) {
      console.log(`💣 [SCENARIO] Бомба найдена в col=${col}, row=${row}, context=${context}, stepIndex=${stepIndex}`);
    }
    
    if (symbol === null || symbol === undefined) {
      console.warn(`⚠️ [SCENARIO] Символ не найден для col=${col}, row=${row} в шаге ${stepIndex}`);
    }
    
    return symbol;
  }

  /**
   * Получает текущий шаг сценария
   * @returns {Object|null} Текущий шаг или null
   */
  getCurrentScenarioStep() {
    if (!this.scenarioMode || !this.currentScenario) {
      return null;
    }
    // Если currentScenarioStep = -1, это означает "еще не начали сценарий"
    if (this.currentScenarioStep < 0) {
      return null;
    }
    return this.currentScenario[this.currentScenarioStep] || null;
  }

  /**
   * Применяет сетку из сценария после досыпания, чтобы убедиться, что сетка точно соответствует сценарию
   * Это особенно важно после взрыва бомбы, когда уплотнение и досыпание могут не точно соответствовать сценарию
   */
  _applyScenarioGridAfterFill() {
    if (!this.scenarioMode || !this.currentScenario) {
      return;
    }

    const step = this.getCurrentScenarioStep();
    if (!step || !step.grid) {
      return;
    }

    console.log(`🔧 [SCENARIO] Применение сетки из сценария после досыпания (шаг ${this.currentScenarioStep + 1})`);
    
    // Конвертируем сетку из формата сценария [row][col] в формат CascadeManager [col][row]
    const internalGrid = this.convertScenarioGridToInternal(step.grid);
    
    // Применяем сетку из сценария
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const expectedSymbol = internalGrid[col][row];
        const currentSymbol = this.grid[col][row];
        
        // Если символ не соответствует сценарию, заменяем его
        if (currentSymbol && currentSymbol.textureIndex !== expectedSymbol) {
          console.log(`🔧 [SCENARIO] Замена символа в col=${col}, row=${row}: ${currentSymbol.textureIndex} → ${expectedSymbol}`);
          // Удаляем старый символ
          if (currentSymbol.sprite) {
            currentSymbol.sprite.destroy();
          }
          if (currentSymbol.spine) {
            currentSymbol.spine.destroy();
          }
          
          // Создаем новый символ из сценария
          const position = this.gridPositions[col][row];
          const symbol = new Symbol(
            position.x,
            position.y,
            expectedSymbol,
            this.container,
            this.symbolTextures,
            this.SYMBOL_SIZE,
            this.SYMBOL_TEXTURE_SIZE,
            this.FALL_SPEED,
            col,
            row
          );
          
          symbol.targetX = position.x;
          symbol.targetY = position.y;
          symbol.setPosition(position.x, position.y);
          
          // Устанавливаем колбэк для символа
          this._setupLandedCallback(symbol);
          
          // Заменяем в сетке
          this.grid[col][row] = symbol;
        } else if (!currentSymbol && expectedSymbol !== undefined && expectedSymbol !== null) {
          // Если символа нет, но он должен быть в сценарии, создаем его
          console.log(`🔧 [SCENARIO] Создание отсутствующего символа в col=${col}, row=${row}: ${expectedSymbol}`);
          const position = this.gridPositions[col][row];
          const symbol = new Symbol(
            position.x,
            position.y,
            expectedSymbol,
            this.container,
            this.symbolTextures,
            this.SYMBOL_SIZE,
            this.SYMBOL_TEXTURE_SIZE,
            this.FALL_SPEED,
            col,
            row
          );
          
          symbol.targetX = position.x;
          symbol.targetY = position.y;
          symbol.setPosition(position.x, position.y);
          
          // Устанавливаем колбэк для символа
          this._setupLandedCallback(symbol);
          
          // Добавляем в сетку
          this.grid[col][row] = symbol;
        }
      }
    }
  }

  /**
   * Находит следующий доступный шаг спина в сценарии
   * @returns {number} Индекс следующего спина или -1 если не найден
   */
  findNextSpinStep() {
    if (!this.scenarioMode || !this.currentScenario) {
      return -1;
    }
    
    // Если currentScenarioStep = -1, ищем первый спин с начала сценария
    const startIndex = this.currentScenarioStep < 0 ? 0 : this.currentScenarioStep + 1;
    
    // Ищем следующий шаг спина (spin, spin-win, spin-win-bomb, spin-bomb), пропускаем все каскады
    // Сначала ищем от startIndex до конца
    for (let i = startIndex; i < this.currentScenario.length; i++) {
      const event = this.currentScenario[i].event;
      if (event === 'spin' || event === 'spin-win' || event === 'spin-win-bomb' || 
          event === 'spin-bomb') {
        return i;
      }
    }
    
    // Если не нашли, ищем с начала до startIndex (закольцовывание)
    for (let i = 0; i < startIndex; i++) {
      const event = this.currentScenario[i].event;
      if (event === 'spin' || event === 'spin-win' || event === 'spin-win-bomb' || 
          event === 'spin-bomb') {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Обрабатывает завершение каскада без выигрыша в сценарии
   * Переходит к следующему спину в сценарии
   * ВСЕГДА должна вызываться перед _setIdle() чтобы разблокировать кнопку
   * @private
   */
  async _handleScenarioNoWin() {
    if (!this.scenarioMode || !this.currentScenario) {
      return;
    }
    
    console.log(`[Bonus] _handleScenarioNoWin вызван, bonusTransitionPending: ${this.bonusTransitionPending}`);
    
    // Проверяем переход в бонус за шаг до spin (один раз)
    const transitionStarted = await this._checkBonusTransitionBeforeSpin();
    if (transitionStarted) {
      return; // Переход запущен, прерываем выполнение
    }
    
    // Ищем следующий спин после текущего шага (который может быть каскадом)
    const nextSpinIndex = this.findNextSpinStep();
    
    if (nextSpinIndex >= 0) {
      this.currentScenarioStep = nextSpinIndex;
      console.log(`📋 [SCENARIO] Каскад завершен, переход к следующему спину: шаг ${nextSpinIndex + 1}/${this.currentScenario.length}`);
    } else {
      // Закольцовывание: если не нашли спин, переходим на начало
      this.currentScenarioStep = 0;
      console.log(`📋 [SCENARIO] Каскад завершен, закольцовывание: переход к шагу 1/${this.currentScenario.length}`);
    }
    // ВАЖНО: _setIdle() должен вызываться ПОСЛЕ этого метода для разблокировки кнопки
  }

  // Total Win методы — накопление суммы за серию каскадов
  /**
   * Обнуляет накопленную сумму Total Win
   */
  resetTotalWin() {
    this._totalWinAmount = 0;
  }

  /**
   * Прибавляет выплату к накопленной сумме Total Win
   * @param {number} amount - Сумма для прибавления
   */
  addToTotalWin(amount) {
    const n = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    this._totalWinAmount += n;
  }

  /**
   * Возвращает текущую накопленную сумму Total Win
   * @returns {number} Накопленная сумма за серию
   */
  getTotalWin() {
    return this._totalWinAmount;
  }

  // ========== МЕТОДЫ ПЕРЕХОДА В БОНУСНУЮ ИГРУ ==========

  /**
   * Проверка условия перехода в бонус из текущего шага сценария
   * Устанавливает флаг bonusTransitionPending если scatterCount >= 4
   * @returns {boolean} true если флаг был установлен, false иначе
   */
  _checkAndSetBonusFlag() {
    console.log(`[Bonus] 🔍 Проверка флага: scenarioMode=${this.scenarioMode}, currentScenario=${!!this.currentScenario}, currentStep=${this.currentScenarioStep + 1}`);
    if (!this.scenarioMode || !this.currentScenario) {
      console.log(`[Bonus] ⚠️ Проверка пропущена: scenarioMode=${this.scenarioMode}, currentScenario=${!!this.currentScenario}`);
      return false;
    }
    const step = this.getCurrentScenarioStep();
    if (!step) {
      console.log(`[Bonus] ⚠️ Шаг не найден на индексе ${this.currentScenarioStep}`);
      return false;
    }
    console.log(`[Bonus] 🔍 Проверка шага ${this.currentScenarioStep + 1}: event=${step.event}, scatterCount=${step.scatterCount}, флаг=${this.bonusTransitionPending}`);
    // Проверяем scatterCount из текущего шага сценария
    if (step.scatterCount >= 4) {
      if (!this.bonusTransitionPending) {
        this.bonusTransitionPending = true;
        console.log(`[Bonus] ✅ Обнаружено ${step.scatterCount} скаттеров на шаге ${this.currentScenarioStep + 1}, установлен флаг перехода в бонус`);
      } else {
        console.log(`[Bonus] ℹ️ Флаг уже установлен (шаг ${this.currentScenarioStep + 1}, scatterCount: ${step.scatterCount})`);
      }
      return true;
    } else {
      console.log(`[Bonus] ⚠️ scatterCount=${step.scatterCount} < 4, флаг не установлен`);
    }
    return false;
  }

  /**
   * Проверяет, нужно ли запустить переход в бонус (за шаг до spin)
   * Вызывается когда текущий шаг - это последний каскад перед spin
   * @returns {boolean} true если переход запущен, false иначе
   */
  async _checkBonusTransitionBeforeSpin() {
    console.log(`[Bonus] 🔍 _checkBonusTransitionBeforeSpin вызван: шаг=${this.currentScenarioStep + 1}, флаг=${this.bonusTransitionPending}`);
    
    if (!this.scenarioMode || !this.currentScenario) {
      console.log(`[Bonus] ⚠️ Проверка пропущена: scenarioMode=${this.scenarioMode}, currentScenario=${!!this.currentScenario}`);
      return false;
    }
    
    const curStep = this.getCurrentScenarioStep();
    if (!curStep) {
      console.log(`[Bonus] ⚠️ Шаг не найден на индексе ${this.currentScenarioStep}`);
      return false;
    }
    
    console.log(`[Bonus] 🔍 Текущий шаг: ${this.currentScenarioStep + 1}, event=${curStep.event}`);
    
    // Проверяем только если текущий шаг - cascade и следующий - spin
    if (curStep.event !== 'cascade') {
      console.log(`[Bonus] ⚠️ Текущий шаг не cascade (${curStep.event}), пропускаем`);
      return false;
    }
    
    const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
    const nextStep = this.currentScenario[nextStepIndex];
    
    console.log(`[Bonus] 🔍 Следующий шаг: ${nextStepIndex + 1}, event=${nextStep?.event}`);
    
    if (!nextStep || nextStep.event !== 'spin') {
      console.log(`[Bonus] ⚠️ Следующий шаг не spin (${nextStep?.event}), пропускаем`);
      return false;
    }
    
    // Если флаг установлен, запускаем переход
    if (this.bonusTransitionPending) {
      console.log(`[Bonus] ✅✅✅ Обнаружен переход к spin (шаг ${nextStepIndex + 1}) после cascade (шаг ${this.currentScenarioStep + 1}), запуск перехода в бонус ✅✅✅`);
      await this._triggerBonusTransition();
      return true;
    } else {
      console.log(`[Bonus] ⚠️ Флаг НЕ установлен (${this.bonusTransitionPending}), переход не запускается`);
    }
    
    return false;
  }

  /**
   * Главный метод перехода в бонус (вызывается после завершения всех каскадов)
   * Флаг bonusTransitionPending гарантирует переход - он может быть снят только transition анимацией
   */
  async _triggerBonusTransition() {
    console.log('[Bonus] 🚀🚀🚀 ЗАПУСК ПЕРЕХОДА В БОНУС после завершения каскадов 🚀🚀🚀');
    console.log('[Bonus] Текущий шаг:', this.currentScenarioStep + 1, 'Флаг:', this.bonusTransitionPending);
    
    // ВАЖНО: Флаг установлен - переход гарантирован, не проверяем условия повторно
    
    // 0. Запустить hit анимации скаттеров для запуска перелетов монеток (если еще не запущены)
    if (!this.scatterHitAnimationsPlayed) {
      console.log('[Bonus] Запуск hit анимаций скаттеров для перелетов монеток');
      this._playScatterHitAnimations();
      // Даем время на запуск перелетов
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 1. Дождаться перелета монеток и hit анимаций сундуков
    // Если флаг установлен, это гарантирует переход в бонус
    // После перелетов монетки попадают в сундуки и запускаются boom анимации
    console.log('[Bonus] Ожидание завершения перелетов монеток...');
    await this._waitForCoinFlights();
    console.log('[Bonus] Перелеты завершены, запускаем transition');
    
    // 2. Запускаем transition сразу после начала boom анимаций сундуков
    console.log('[Bonus] 🎬 Запуск transition после начала boom анимаций сундуков');
    
    // 3. Transition анимация и новый фон одновременно
    console.log('[Bonus] Запуск transition и добавление фона...');
    await Promise.all([
      this._playTransitionAnimation(),
      this._addBackgroundLayer()
    ]);
    console.log('[Bonus] Transition и фон завершены');
    
    // 5. Загрузка нового сценария (пока дефолтный)
    await this._loadFreeSpinScenario();
  }

  /**
   * Ожидание завершения всех перелетов монеток и получение активных сундуков
   */
  async _waitForCoinFlights() {
    // Проверяем, есть ли активные перелеты через ScatterFlySystem
    // Если ScatterFlySystem доступен через config или как свойство
    if (this.config.scatterFlySystem) {
      const scatterFlySystem = this.config.scatterFlySystem;
      console.log('[Bonus] Ожидание завершения перелетов монеток...');
      
      // Максимальное время ожидания (10 секунд) для защиты от бесконечного цикла
      const maxWaitTime = 10000;
      const startTime = Date.now();
      
      // Ждем пока все перелеты завершатся
      while (scatterFlySystem.activeFlights && scatterFlySystem.activeFlights.length > 0) {
        if (Date.now() - startTime > maxWaitTime) {
          console.warn('[Bonus] Превышено максимальное время ожидания перелетов');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Получаем активные сундуки и сохраняем их
      if (typeof scatterFlySystem.getActiveChestsAndClear === 'function') {
        this.activeChestsForBonus = scatterFlySystem.getActiveChestsAndClear();
        console.log('[Bonus] Активные сундуки для boom анимации:', this.activeChestsForBonus);
      } else {
        console.warn('[Bonus] Метод getActiveChestsAndClear не найден в ScatterFlySystem');
      }
    } else {
      console.warn('[Bonus] ScatterFlySystem не найден в config');
    }
    
    // Дополнительная задержка для завершения всех анимаций (hit анимации сундуков после перелетов)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ВАЖНО: Если флаг установлен, это гарантирует переход в бонус
    // Флаг может снять только transition анимация
    console.log('[Bonus] Перелеты и hit анимации сундуков завершены, флаг bonusTransitionPending:', this.bonusTransitionPending);
    
    // Если флаг установлен, boom анимации уже начались в onCoinArrival
    // Запускаем transition сразу после начала boom анимаций
    if (this.bonusTransitionPending) {
      console.log('[Bonus] 🎬 Boom анимации сундуков начались, запускаем transition и фон');
      // Не ждем завершения boom анимаций, запускаем transition сразу
      Promise.all([
        this._playTransitionAnimation(),
        this._addBackgroundLayer()
      ]).then(() => {
        console.log('[Bonus] Transition и фон завершены');
      }).catch(err => {
        console.error('[Bonus] Ошибка при запуске transition/фона:', err);
      });
    }
  }

  /**
   * Ожидание завершения всех boom анимаций сундуков
   * Boom анимации запускаются автоматически в onCoinArrival() когда флаг bonusTransitionPending установлен
   */
  async _waitForChestBoomAnimations() {
    console.log('[Bonus] Ожидание завершения всех boom анимаций сундуков...');
    
    try {
      const { waitForAllBoomAnimations } = await import('./ChestManager.js');
      await waitForAllBoomAnimations();
      console.log('[Bonus] Все boom анимации сундуков завершены');
      
      // Дополнительная задержка для завершения всех анимаций
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('[Bonus] Ошибка при ожидании boom анимаций сундуков:', error);
    }
  }

  /**
   * Проигрывание Spine transition анимации
   */
  async _playTransitionAnimation() {
    console.log('[Bonus] Запуск transition анимации');
    
    if (typeof spine === 'undefined') {
      console.warn('[Bonus] Spine не доступен, пропускаем transition анимацию');
      return;
    }

    const TRANSITION_SKELETON_ALIAS = 'transitionSkeleton';
    const TRANSITION_ATLAS_ALIAS = 'transitionAtlas';

    try {
      // Проверяем что ассеты загружены
      const skeletonAsset = PIXI.Assets.get(TRANSITION_SKELETON_ALIAS);
      const atlasAsset = PIXI.Assets.get(TRANSITION_ATLAS_ALIAS);
      
      if (!skeletonAsset || !atlasAsset) {
        console.log('[Bonus] Загрузка transition ассетов...');
        await PIXI.Assets.load([
          { alias: TRANSITION_SKELETON_ALIAS, src: './spine/transition/skeleton.json' },
          { alias: TRANSITION_ATLAS_ALIAS, src: './spine/transition/skeleton.atlas' }
        ]);
        console.log('[Bonus] Transition ассеты загружены');
      }

      // Создаем экземпляр Spine
      const transitionSpine = spine.Spine.from({
        skeleton: TRANSITION_SKELETON_ALIAS,
        atlas: TRANSITION_ATLAS_ALIAS
      });
      
      // Устанавливаем scale 120%
      transitionSpine.scale.set(1.2, 1.2);

      if (!transitionSpine) {
        console.error('[Bonus] ❌ Не удалось создать Spine экземпляр transition');
        return;
      }

      if (!transitionSpine.skeleton.physics) {
        transitionSpine.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {}
        };
      }

      // Устанавливаем setup pose
      transitionSpine.skeleton.setSlotsToSetupPose();

      // Позиционируем по центру экрана
      const centerX = this.config.appWidth / 2 || 361;
      const centerY = this.config.appHeight / 2 || 641.5;
      transitionSpine.x = centerX;
      transitionSpine.y = centerY;
      transitionSpine.zIndex = 99999; // Максимальный zIndex, поверх всего

      // Добавляем на сцену
      const stage = this.config.app?.stage;
      if (!stage) {
        console.error('[Bonus] ❌ Не удалось найти stage для transition анимации');
        return;
      }
      
      stage.addChild(transitionSpine);
      stage.sortChildren();
      
      // Сохраняем ссылку
      this._transitionSpine = transitionSpine;
      
      // Spine обновляется автоматически (autoUpdate = true по умолчанию)
      // НЕ нужно вызывать update вручную!

      // Проигрываем анимацию "transition"
      return new Promise((resolve) => {
        const animations = transitionSpine.skeleton?.data?.animations;
        const animNames = animations?.map(a => a.name) || [];
        
        // Пробуем найти анимацию "transition"
        let animName = 'transition';
        let entry = transitionSpine.state?.setAnimation(0, animName, false);
        
        if (!entry && animNames.length > 0) {
          // Если не нашли, пробуем первую доступную анимацию
          animName = animNames[0];
          console.log(`[Bonus] Анимация "transition" не найдена, пробуем "${animName}"`);
          entry = transitionSpine.state?.setAnimation(0, animName, false);
        }
        
        if (!entry) {
          console.error('[Bonus] ❌ Не удалось запустить анимацию');
          if (transitionSpine.parent) {
            transitionSpine.parent.removeChild(transitionSpine);
          }
          transitionSpine.destroy({ children: true });
          this._transitionSpine = null;
          resolve();
          return;
        }

        console.log(`[Bonus] ✅ Анимация "${animName}" запущена`);

        entry.listener = {
          complete: () => {
            console.log('[Bonus] ✅ Transition анимация завершена');
            // Правильное удаление Spine (как в ScatterFlySystem)
            requestAnimationFrame(() => {
              if (transitionSpine && transitionSpine.parent) {
                transitionSpine.parent.removeChild(transitionSpine);
              }
              if (transitionSpine && transitionSpine.state) {
                transitionSpine.state.clearTracks();
              }
              if (transitionSpine && !transitionSpine.destroyed) {
                transitionSpine.destroy({ children: true });
              }
              this._transitionSpine = null;
              resolve();
            });
          }
        };
      });
    } catch (error) {
      console.error('[Bonus] ❌ Ошибка при проигрывании transition анимации:', error);
      console.error('[Bonus] Детали ошибки:', error.message, error.stack);
      // Очищаем ссылку на transition при ошибке
      this._transitionSpine = null;
      // Возвращаем resolved Promise чтобы не блокировать дальнейшее выполнение
      return Promise.resolve();
    }
  }

  /**
   * Добавление нового фона поверх текущего (не замена!)
   */
  async _addBackgroundLayer() {
    const stage = this.config.app?.stage;
    if (!stage) {
      console.error('[Bonus] Stage не найден');
      return;
    }

    this._removeBonusBackground();

    try {
      const newBgTexture = await PIXI.Assets.load('./png/bg_fs_scale.png');
      
      const newBgSprite = new PIXI.Sprite(newBgTexture);
      newBgSprite.width = this.config.appWidth || 722;
      newBgSprite.height = this.config.appHeight || 1283;
      newBgSprite.x = 0;
      newBgSprite.y = 0;
      newBgSprite.zIndex = 5; // Поверх старого фона (0), но под игровыми элементами (10+)
      
      stage.addChild(newBgSprite);
      stage.sortChildren();
      
      this._newBgSprite = newBgSprite;
      console.log('[Bonus] Новый фон добавлен, zIndex:', newBgSprite.zIndex);
    } catch (error) {
      console.error('[Bonus] Ошибка при добавлении фона:', error);
    }
  }

  _removeBonusBackground() {
    if (this._newBgSprite && this._newBgSprite.parent) {
      this._newBgSprite.parent.removeChild(this._newBgSprite);
      this._newBgSprite.destroy({ children: true });
      this._newBgSprite = null;
      console.log('[Bonus] Бонусный фон удалён');
    }
  }

  _emitBonusUIUpdate() {
    if (!this.onBonusModeChange || !this.isBonusFromScenario) return;
    const step = this.getCurrentScenarioStep();
    // Используем текущее значение счётчика фриспинов вместо значения из шага сценария
    const freeSpins = this.currentFreeSpinsRemaining;
    const yellowMult = step?.yellowChestMultiplier ?? 0;
    this.onBonusModeChange(true, this.activeChestsForBonus, freeSpins, yellowMult);
  }

  /**
   * Увеличение счётчика фриспинов при прилёте скатера в индикатор
   */
  incrementFreeSpins() {
    if (!this.isBonusFromScenario) return;
    this.currentFreeSpinsRemaining += 1;
    this._emitBonusUIUpdate();
  }

  /**
   * Загрузка нового сценария (пока дефолтный, вместо фриспин)
   */
  async _loadFreeSpinScenario() {
    try {
      // TODO: Заменить на загрузку фриспин сценария когда будет реализован
      // Пока загружаем дефолтный сценарий
      const response = await fetch('./scenario/scenario_defolt.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const defaultScenario = await response.json();
      
      if (!Array.isArray(defaultScenario) || defaultScenario.length === 0) {
        throw new Error('Дефолтный сценарий пуст или имеет неверный формат');
      }
      
      this.loadScenario(defaultScenario);
      this.currentScenarioStep = -1;
      this.bonusTransitionPending = false;
      this.activeChestsForBonus = [];
      this.currentFreeSpinsRemaining = 0;
      this._setIdle();
      console.log('[Bonus] Загружен дефолтный сценарий (временно вместо фриспин)');
    } catch (error) {
      console.error('[Bonus] Ошибка при загрузке дефолтного сценария:', error);
      // В случае ошибки просто сбрасываем флаг и переводим в IDLE
      this.bonusTransitionPending = false;
      this.activeChestsForBonus = [];
      this.currentFreeSpinsRemaining = 0;
      this._setIdle();
    }
  }

}
