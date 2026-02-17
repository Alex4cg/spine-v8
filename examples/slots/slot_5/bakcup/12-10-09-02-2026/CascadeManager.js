/**
 * CascadeManager - управление каскадным насыпанием символов
 */
import { Symbol } from './Symbol.js';

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
    this.hasSpunOnce = false; // Не проверять выигрыш до первого спина
    this._winCheckTimerId = null; // Таймер разовой проверки выигрыша
    this._lastCreatedSymbol = null; // Последний созданный символ (для отслеживания приземления в режиме сценария)
    
    // Конфигурация выплат
    this.payoutsConfig = config.payoutsConfig || null;
    this.minSymbolsForWin = config.minSymbolsForWin || 5;
    
    // Управление фазами игры
    this.gameState = GAME_STATE.IDLE; // Текущее состояние игры
    this.winCheckProcessed = false; // Флаг для предотвращения повторной проверки
    this.winCheckPending = false; // Флаг для отслеживания ожидающей проверки выигрышей

    // Для отслеживания активных таймеров
    this.activeTimers = []; // Массив активных setTimeout
    
    // Режим сценария (для сценария используйте ScenarioCascadeManager)
    this.scenarioMode = false;
    this.currentScenario = null; // Загруженный сценарий (массив шагов)
    this.currentScenarioStep = 0; // Текущий шаг сценария

    // Spine-ассеты для анимации bounce при приземлении (алиасы PIXI.Assets)
    if (config.spineSkeletonAlias && config.spineAtlasAlias) {
      Symbol.spineSkeletonAlias = config.spineSkeletonAlias;
      Symbol.spineAtlasAlias = config.spineAtlasAlias;
    }
    
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

  // Устанавливает колбэк на символ для проверки выигрыша после приземления
  _setupLandedCallback(symbol) {
    if (!symbol) return;
    symbol.onLandedCallback = () => {
      // Подмена текстуры на Spine, проигрывание bounce (по завершении — возврат текстуры)
      if (typeof symbol.showSpineAnimation === 'function') {
        symbol.showSpineAnimation();
      }
      // Небольшая задержка перед проверкой выигрыша, чтобы символы успели визуально приземлиться
      setTimeout(() => {
        if (!this.winCheckProcessed && !this.winCheckPending) {
          this._onAllLanded();
        }
      }, 100); // 100мс задержка для завершения анимации приземления
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
    if (this.scenarioMode) {
      const scenarioSymbol = this.getNextScenarioSymbol(col, row, context);
      if (scenarioSymbol !== null) {
        return scenarioSymbol;
      }
      // Если не удалось получить символ из сценария, используем случайный
      console.warn(`⚠️ [SCENARIO] Не удалось получить символ из сценария для col=${col}, row=${row}, context=${context}, используем случайный`);
    }
    return Math.floor(Math.random() * this.symbolTextures.length);
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
    
    // В режиме сценария сохраняем ссылку на последний символ
    // Колбэк уже установлен для всех символов выше
    if (this.scenarioMode && !this._lastCreatedSymbol) {
      console.warn(`⚠️ [SCENARIO] Режим сценария активен, но последний символ не найден!`);
    }
  }

  // Запускает падение новых символов в cascade (приватный метод)
  async _startCascadeFall() {
    const startColumnSymbols = async (col) => {
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (!this.isSpinning) {
          return;
        }
        
        const symbol = this.grid[col][row];
        if (symbol) {
          symbol.startFall();
        }
        
        if (row > 0 && this.ROW_DELAY > 0) {
          await new Promise((resolve) => {
            const timerId = setTimeout(() => {
              const index = this.activeTimers.indexOf(timerId);
              if (index > -1) {
                this.activeTimers.splice(index, 1);
              }
              resolve();
            }, this.ROW_DELAY * 1000);
            this.activeTimers.push(timerId);
          });
        }
      }
    };
    
    const columnPromises = [];
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      const columnPromise = new Promise((resolve) => {
        const delay = col * this.COLUMN_DELAY * 1000;
        
        const timerId = setTimeout(async () => {
          const index = this.activeTimers.indexOf(timerId);
          if (index > -1) {
            this.activeTimers.splice(index, 1);
          }
          
          if (!this.isSpinning) {
            resolve();
            return;
          }
          
          await startColumnSymbols(col);
          resolve();
        }, delay);
        
        this.activeTimers.push(timerId);
      });
      
      columnPromises.push(columnPromise);
    }
    
    await Promise.all(columnPromises);
  }

  // Каскадное насыпание - символы падают сверху (упрощенная версия)
  async cascade() {
    // Если уже идет анимация - сбрасываем её и начинаем новую
    if (this.isSpinning) {
      console.log('🔄 CascadeManager: Анимация уже идет, сбрасываем и начинаем заново');
      this.reset();
    }
    
    // Если режим сценария, проверяем что текущий шаг - спин (spin или spin-win)
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (!step) {
        console.warn('⚠️ [SCENARIO] Нет текущего шага сценария');
        return;
      }
      if (step.event !== 'spin' && step.event !== 'spin-win') {
        console.warn(`⚠️ [SCENARIO] Текущий шаг не является спином (${step.event}), пропускаем`);
        return;
      }
      console.log(`📋 [SCENARIO] Начинаем спин из шага ${this.currentScenarioStep + 1}/${this.currentScenario.length} (${step.event})`);
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
    this.hasSpunOnce = true; // С этого момента разрешаем проверку выигрыша

    // Подготавливаем и запускаем падение старых символов
    const oldSymbolsMap = this._prepareOldSymbols();
    await this._startOldSymbolsFall(oldSymbolsMap);

    // Создаем новые символы (использует данные из сценария если режим активен)
    this._createNewSymbols();

    // Запускаем падение новых символов (isSpinning должен быть true для прохождения проверок)
    await this._startCascadeFall();

    // Сбрасываем флаг и устанавливаем состояние ПОСЛЕ запуска падения
    // чтобы колбэк мог правильно проверить состояние
    this.isSpinning = false;
    this._setWaitingLandingState();
    
    // Колбэк уже установлен для всех символов в _createNewSymbols()
    
    // В обычном режиме используем таймер
    if (!this.scenarioMode) {
      const timeMs = this._getTimeUntilLastSymbolLandsFirstSpinMs();
      this._scheduleWinCheck(timeMs);
    }
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

  // Обрабатывает переход к каскаду в режиме сценария
  async _handleScenarioWinCheck(winningSymbols) {
    const nextStepIndex = this.currentScenarioStep + 1;
    if (nextStepIndex >= this.currentScenario.length) return;

    const REMOVE_DELAY_BEFORE_MS = 700;
    if (winningSymbols.length > 0) {
      if (REMOVE_DELAY_BEFORE_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, REMOVE_DELAY_BEFORE_MS));
      }
      this.gameState = GAME_STATE.REMOVING_WINS;
      console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов (win → disappearance)`);
      await this._removeWinningSymbolsWithWinAnimation(winningSymbols);
    } else {
      console.log('📋 [SCENARIO] Нет выигрыша, но есть шаг каскада в сценарии - применяем его');
    }
    // Переводим сценарий только после окончания вин-анимаций
    this.currentScenarioStep = nextStepIndex;
    console.log(`📋 [SCENARIO] Переход к шагу ${nextStepIndex + 1}/${this.currentScenario.length}`);

    const nextStep = this.currentScenario[nextStepIndex];
    if (nextStep.event === 'spin') {
      this._setIdle();
      this.winCheckProcessed = false;
      return;
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
    const REMOVE_DELAY_BEFORE_MS = 700;
    if (REMOVE_DELAY_BEFORE_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, REMOVE_DELAY_BEFORE_MS));
    }
    this.gameState = GAME_STATE.REMOVING_WINS;
    console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов (win → disappearance)`);
    await this._removeWinningSymbolsWithWinAnimation(winningSymbols);
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
    if (!this.hasSpunOnce) return;
    
    // Проверка состояния
    if (this.scenarioMode) {
      if (this.gameState === GAME_STATE.REMOVING_WINS || 
          this.gameState === GAME_STATE.COMPACTING || 
          this.gameState === GAME_STATE.FILLING ||
          this.gameState === GAME_STATE.SPINNING) {
        return;
      }
    } else {
      if (this.gameState !== GAME_STATE.WAITING_LANDING && this.gameState !== GAME_STATE.IDLE) {
        return;
      }
    }
    
    if (this.winCheckProcessed || this.winCheckPending) return;
    
    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;
    
    // Небольшая задержка перед проверкой выигрыша, чтобы символы успели визуально приземлиться
    const DELAY_BEFORE_WIN_CHECK_MS = this.scenarioMode ? 100 : 150;
    
    setTimeout(async () => {
      this.winCheckPending = false;
      
      // В режиме сценария выигрыши только из сценария; findWinningCombinations() не вызываем вообще.
      let winningSymbols;
      if (this.scenarioMode && this.currentScenario) {
        const fromScenario = this._getWinningSymbolsFromScenario();
        winningSymbols = Array.isArray(fromScenario) ? fromScenario : [];
      } else {
        winningSymbols = this.findWinningCombinations();
      }
      
      // Если режим сценария активен, проверяем следующий шаг
      if (this.scenarioMode && this.currentScenario) {
        const nextStepIndex = this.currentScenarioStep + 1;
        if (nextStepIndex < this.currentScenario.length) {
          const nextStep = this.currentScenario[nextStepIndex];
          
          // Если следующий шаг - каскад (cascade или cascade-win), переходим к нему
          if (nextStep.event === 'cascade' || nextStep.event === 'cascade-win') {
            await this._handleScenarioWinCheck(winningSymbols);
            return;
          }
        }
      }
      
      // Обычная логика проверки выигрыша
      if (winningSymbols.length > 0) {
        await this._handleWin(winningSymbols);
      } else {
        console.log('✅ [IDLE] Выигрышных комбинаций не найдено, каскад завершен');
        if (this.scenarioMode) {
          const curStep = this.getCurrentScenarioStep();
          if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin')) {
            // На шаге cascade/spin дальше только по нажатию спин — не двигаем сценарий
          } else {
            this._handleScenarioNoWin();
          }
        }
        this._setIdle();
        this.winCheckProcessed = false;
      }
    }, DELAY_BEFORE_WIN_CHECK_MS);
  }

  // Получает выигрышные символы из сценария на основе winningGroups и groupMarkup
  _getWinningSymbolsFromScenario() {
    if (!this.scenarioMode || !this.currentScenario) {
      return null; // Вернуть null для обычного режима
    }
    
    const step = this.getCurrentScenarioStep();
    if (!step) return [];
    if (step.event === 'cascade' || step.event === 'spin') return []; // без -win выигрыша нет
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
    
    return winningSymbols;
  }

  // Определяет выигрышные комбинации — ОТКЛЮЧЕНО: выигрыш только по сценарию (минимум 7 символов по payouts).
  findWinningCombinations() {
    return [];
  }

  /**
   * Запускает win-анимацию (win → disappearance) на выигрышных символах, по завершении удаляет их
   * и сразу разрешает Promise — уплотнение/досыпка по сценарию запускаются без паузы.
   */
  _removeWinningSymbolsWithWinAnimation(winningSymbols) {
    return new Promise((resolve) => {
      if (!winningSymbols || winningSymbols.length === 0) {
        resolve();
        return;
      }
      let pending = winningSymbols.length;
      const onOneComplete = () => {
        pending--;
        if (pending === 0) {
          console.log('🗑️ Win-анимации завершены, запуск уплотнения/досыпки');
          resolve();
        }
      };
      for (const symbol of winningSymbols) {
        const col = symbol.col;
        const row = symbol.row;
        if (col !== null && row !== null) {
          this.grid[col][row] = null;
        }
        if (typeof symbol.showWinAnimation === 'function') {
          symbol.showWinAnimation(() => {
            symbol.destroy();
            onOneComplete();
          });
        } else {
          symbol.destroy();
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
  async startNewSymbolsFall(emptySpots) {
    if (emptySpots.length === 0) {
      return;
    }
    
    // Группируем пустые места по колонкам
    const emptyByColumn = new Map();
    for (const spot of emptySpots) {
      if (!emptyByColumn.has(spot.col)) {
        emptyByColumn.set(spot.col, []);
      }
      emptyByColumn.get(spot.col).push(spot.row);
    }
    
    // Запускаем падение для каждой колонки с задержками
    const columnPromises = [];
    
    for (const [col, rows] of emptyByColumn.entries()) {
      // Сортируем строки сверху вниз (от меньшего к большему)
      rows.sort((a, b) => a - b);
      
      const columnPromise = new Promise((resolve) => {
        // Задержка перед началом колонки: col * COLUMN_DELAY
        const delay = col * this.COLUMN_DELAY * 1000;
        
        const timerId = setTimeout(async () => {
          const index = this.activeTimers.indexOf(timerId);
          if (index > -1) {
            this.activeTimers.splice(index, 1);
          }
          
          // Запускаем падение символов в колонке снизу вверх (от нижней строки к верхней)
          for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const symbol = this.grid[col][row];
            if (symbol) {
              symbol.startFall();
            }
            
            // Задержка ROW_DELAY между строками в колонке
            if (i > 0 && this.ROW_DELAY > 0) {
              await new Promise((resolveRow) => {
                const rowTimerId = setTimeout(() => {
                  const idx = this.activeTimers.indexOf(rowTimerId);
                  if (idx > -1) {
                    this.activeTimers.splice(idx, 1);
                  }
                  resolveRow();
                }, this.ROW_DELAY * 1000);
                this.activeTimers.push(rowTimerId);
              });
            }
          }
          
          resolve();
        }, delay);
        
        this.activeTimers.push(timerId);
      });
      
      columnPromises.push(columnPromise);
    }
    
    // Ждем завершения запуска всех колонок
    await Promise.all(columnPromises);
  }

  // Обрабатывает уплотнение колонок в каскаде
  async _processCascadeCompacting() {
    // Минимальная пауза перед уплотнением (только для завершения анимации удаления)
    // В режиме сценария пропускаем задержку
    if (!this.scenarioMode) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Уплотняем колонки
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
    // Проверяем, что мы не в процессе другого каскада
    if (this.gameState === GAME_STATE.COMPACTING || this.gameState === GAME_STATE.FILLING) {
      console.warn('⚠️ Каскад уже в процессе, пропускаем');
      return;
    }
    
    this.gameState = GAME_STATE.COMPACTING;
    
    // Блокируем кнопку спин на 2 секунды при начале каскада
    if (this._blockSpinButton) {
      this._blockSpinButton();
    }
    
    const { hasMoved, emptySpots } = await this._processCascadeCompacting();
    
    if (hasMoved || emptySpots.length > 0) {
      if (emptySpots.length > 0) {
        await this._processCascadeFilling(emptySpots);
      } else {
        this._processCascadeCompactingOnly(hasMoved);
      }
      
      // В обычном режиме используем таймер
      if (!this.scenarioMode) {
        const timeMs = this._getTimeUntilLastSymbolLandsAfterCascadeMs(hasMoved, emptySpots);
        this._scheduleWinCheck(timeMs);
      }
    } else {
      // Если ничего не переместилось и нет пустых мест - каскад завершен
      if (this.scenarioMode) {
        const curStep = this.getCurrentScenarioStep();
        if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin')) {
          // Уже на cascade/spin — без спина никуда не идём
          this._setIdle();
          this.winCheckProcessed = true;
          return;
        }
        const nextStepIndex = this.currentScenarioStep + 1;
        if (nextStepIndex < this.currentScenario.length) {
          const nextStep = this.currentScenario[nextStepIndex];
          if (nextStep.event === 'spin' || nextStep.event === 'cascade') {
            this.currentScenarioStep = nextStepIndex;
            this._setIdle();
            this.winCheckProcessed = true;
            return;
          }
        }
        this._handleScenarioNoWin();
      }
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
    
    this.currentScenario = scenarioJson;
    this.scenarioMode = true;
    
    // Находим первый шаг со спином (spin или spin-win)
    let firstSpinIndex = 0;
    for (let i = 0; i < scenarioJson.length; i++) {
      if (scenarioJson[i].event === 'spin' || scenarioJson[i].event === 'spin-win') {
        firstSpinIndex = i;
        break;
      }
    }
    
    this.currentScenarioStep = firstSpinIndex;
    
    console.log(`✅ Сценарий загружен: ${scenarioJson.length} шагов, начинаем с шага ${firstSpinIndex + 1} (${scenarioJson[firstSpinIndex].event})`);
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
    
    if (symbol === null) {
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
    return this.currentScenario[this.currentScenarioStep] || null;
  }

  /**
   * Находит следующий доступный шаг спина в сценарии
   * @returns {number} Индекс следующего спина или -1 если не найден
   */
  findNextSpinStep() {
    if (!this.scenarioMode || !this.currentScenario) {
      return -1;
    }
    
    // Ищем следующий шаг спина (spin или spin-win), пропускаем все каскады
    for (let i = this.currentScenarioStep + 1; i < this.currentScenario.length; i++) {
      const event = this.currentScenario[i].event;
      if (event === 'spin' || event === 'spin-win') {
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
  _handleScenarioNoWin() {
    if (!this.scenarioMode || !this.currentScenario) {
      return;
    }
    
    // Ищем следующий спин после текущего шага (который может быть каскадом)
    const nextSpinIndex = this.findNextSpinStep();
    
    if (nextSpinIndex >= 0) {
      this.currentScenarioStep = nextSpinIndex;
      console.log(`📋 [SCENARIO] Каскад завершен, переход к следующему спину: шаг ${nextSpinIndex + 1}/${this.currentScenario.length}`);
    } else {
      console.log('✅ [SCENARIO] Сценарий завершен');
      this.scenarioMode = false;
    }
    // ВАЖНО: _setIdle() должен вызываться ПОСЛЕ этого метода для разблокировки кнопки
  }

}
