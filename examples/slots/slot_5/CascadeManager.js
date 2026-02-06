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
    
    // Конфигурация выплат
    this.payoutsConfig = config.payoutsConfig || null;
    this.minSymbolsForWin = config.minSymbolsForWin || 5;
    
    // Управление фазами игры
    this.gameState = GAME_STATE.IDLE; // Текущее состояние игры
    this.winCheckProcessed = false; // Флаг для предотвращения повторной проверки
    this.winCheckPending = false; // Флаг для отслеживания ожидающей проверки выигрышей
    this.onIdleCallback = config.onIdle || null; // Разблокировка кнопки спин при переходе в IDLE

    // Для отслеживания активных таймеров
    this.activeTimers = []; // Массив активных setTimeout
    
    // Режим сценария
    this.scenarioMode = false; // Флаг режима сценария
    this.currentScenario = null; // Загруженный сценарий (массив шагов)
    this.currentScenarioStep = 0; // Текущий шаг сценария
    this.scenarioSymbolProvider = null; // Функция получения символа из сценария
    
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

  // Заполняет сетку случайными символами (спин, досыпание)
  fillRandom() {
    // Если режим сценария активен, используем данные из сценария
    let scenarioGrid = null;
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (step && step.event === 'spin' && step.grid) {
        scenarioGrid = this.convertScenarioGridToInternal(step.grid);
      }
    }

    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const position = this.gridPositions[col][row];
        
        // Используем символ из сценария или случайный
        let textureIndex;
        if (scenarioGrid && scenarioGrid[col][row] !== undefined) {
          textureIndex = scenarioGrid[col][row];
        } else {
          textureIndex = Math.floor(Math.random() * this.symbolTextures.length);
        }
        
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
    this.gameState = GAME_STATE.IDLE;
    this.onIdleCallback?.();
  }

  setOnIdleCallback(fn) {
    this.onIdleCallback = fn;
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

  // Создает новые символы для cascade (приватный метод)
  _createNewSymbols() {
    // Если режим сценария активен, используем данные из сценария
    let scenarioGrid = null;
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (step && step.grid) {
        scenarioGrid = this.convertScenarioGridToInternal(step.grid);
      }
    }

    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const position = this.gridPositions[col][row];
        
        // Используем символ из сценария или случайный
        let textureIndex;
        if (scenarioGrid && scenarioGrid[col][row] !== undefined) {
          textureIndex = scenarioGrid[col][row];
        } else {
          textureIndex = Math.floor(Math.random() * this.symbolTextures.length);
        }
        
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
      }
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
    
    // Если режим сценария, проверяем что текущий шаг - спин
    if (this.scenarioMode && this.currentScenario) {
      const step = this.getCurrentScenarioStep();
      if (!step) {
        console.warn('⚠️ [SCENARIO] Нет текущего шага сценария');
        return;
      }
      if (step.event !== 'spin') {
        console.warn(`⚠️ [SCENARIO] Текущий шаг не является спином (${step.event}), пропускаем`);
        return;
      }
      console.log(`📋 [SCENARIO] Начинаем спин из шага ${this.currentScenarioStep + 1}/${this.currentScenario.length}`);
    }
    
    // Устанавливаем флаг и состояние
    this.isSpinning = true;
    this.gameState = GAME_STATE.SPINNING;
    this.winCheckProcessed = false;
    this.winCheckPending = false;
    this.hasSpunOnce = true; // С этого момента разрешаем проверку выигрыша

    // Подготавливаем и запускаем падение старых символов
    const oldSymbolsMap = this._prepareOldSymbols();
    await this._startOldSymbolsFall(oldSymbolsMap);

    // Создаем новые символы (использует данные из сценария если режим активен)
    this._createNewSymbols();

    // Запускаем падение новых символов
    await this._startCascadeFall();

    // Сбрасываем флаг после запуска всех символов
    this.isSpinning = false;
    this.gameState = GAME_STATE.WAITING_LANDING;
    this.winCheckProcessed = false;
    this.winCheckPending = false;
    const timeMs = this._getTimeUntilLastSymbolLandsFirstSpinMs();
    this._scheduleWinCheck(timeMs);
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

  _onAllLanded() {
    if (!this.hasSpunOnce) return;
    if (this.gameState !== GAME_STATE.WAITING_LANDING && this.gameState !== GAME_STATE.IDLE) return;
    if (this.winCheckProcessed || this.winCheckPending) return;

    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;
    const DELAY_BEFORE_WIN_CHECK_MS = 150;
    setTimeout(async () => {
      this.winCheckPending = false;
      
      // Если режим сценария активен, проверяем следующий шаг
      if (this.scenarioMode && this.currentScenario) {
        const nextStepIndex = this.currentScenarioStep + 1;
        if (nextStepIndex < this.currentScenario.length) {
          const nextStep = this.currentScenario[nextStepIndex];
          
          // Если следующий шаг - каскад, переходим к нему и обрабатываем
          if (nextStep.event === 'cascade') {
            console.log(`📋 [SCENARIO] Переход к шагу каскада ${nextStepIndex + 1}/${this.currentScenario.length}`);
            // Обновляем шаг сценария перед обработкой каскада
            this.currentScenarioStep = nextStepIndex;
            
            // Проверяем выигрышные комбинации для текущего состояния
            const winningSymbols = this.findWinningCombinations();
            if (winningSymbols.length > 0) {
              this.gameState = GAME_STATE.REMOVING_WINS;
              console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов`);
              this.removeWinningSymbols(winningSymbols);
              await new Promise(resolve => setTimeout(resolve, 150));
              // processCascade будет использовать данные из текущего шага каскада
              this.processCascade().catch((err) => {
                console.error('❌ Ошибка при обработке каскада:', err);
                this._setIdle();
                this.winCheckProcessed = true;
                this.winCheckPending = false;
              });
            } else {
              // Нет выигрыша, но в сценарии есть каскад - используем его данные напрямую
              console.log('📋 [SCENARIO] Нет выигрыша, но есть шаг каскада в сценарии - применяем его');
              // processCascade будет использовать данные из текущего шага каскада
              this.processCascade().catch((err) => {
                console.error('❌ Ошибка при обработке каскада:', err);
                this._setIdle();
                this.winCheckProcessed = true;
                this.winCheckPending = false;
              });
            }
            return;
          }
        }
      }
      
      // Обычная логика проверки выигрыша
      const winningSymbols = this.findWinningCombinations();
      if (winningSymbols.length > 0) {
        this.gameState = GAME_STATE.REMOVING_WINS;
        console.log(`🎯 [REMOVING_WINS] Найдено ${winningSymbols.length} выигрышных символов`);
        this.removeWinningSymbols(winningSymbols);
        await new Promise(resolve => setTimeout(resolve, 150));
        this.processCascade().catch((err) => {
          console.error('❌ Ошибка при обработке каскада:', err);
          this._setIdle();
          this.winCheckProcessed = true;
          this.winCheckPending = false;
        });
      } else {
        console.log('✅ [IDLE] Выигрышных комбинаций не найдено, каскад завершен');
        
        // Если режим сценария, проверяем следующий шаг
        if (this.scenarioMode && this.currentScenario) {
          // Ищем следующий шаг спина (пропускаем все каскады)
          let nextSpinIndex = -1;
          for (let i = this.currentScenarioStep + 1; i < this.currentScenario.length; i++) {
            if (this.currentScenario[i].event === 'spin') {
              nextSpinIndex = i;
              break;
            }
          }
          
          if (nextSpinIndex >= 0) {
            // Есть следующий спин, переходим к нему
            this.currentScenarioStep = nextSpinIndex;
            console.log(`📋 [SCENARIO] Переход к следующему спину: шаг ${nextSpinIndex + 1}/${this.currentScenario.length}`);
          } else {
            // Сценарий завершен
            console.log('✅ [SCENARIO] Сценарий завершен');
            this.scenarioMode = false;
          }
        }
        
        this._setIdle();
        this.winCheckProcessed = false;
      }
    }, DELAY_BEFORE_WIN_CHECK_MS);
  }

  // Определяет выигрышные комбинации и возвращает массив выигрышных символов
  findWinningCombinations() {
    // Подсчитываем количество каждого типа символа на поле
    const symbolCounts = new Map(); // textureIndex -> массив символов
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        const symbol = this.grid[col][row];
        if (symbol) {
          const textureIndex = symbol.textureIndex;
          if (!symbolCounts.has(textureIndex)) {
            symbolCounts.set(textureIndex, []);
          }
          symbolCounts.get(textureIndex).push(symbol);
        }
      }
    }
    
    // Находим выигрышные комбинации (minSymbolsForWin+ одинаковых символов)
    const winningSymbols = [];
    for (const [textureIndex, symbols] of symbolCounts.entries()) {
      if (symbols.length >= this.minSymbolsForWin) {
        // Все эти символы - выигрышные
        winningSymbols.push(...symbols);
        console.log(`✅ Найдена выигрышная комбинация: ${symbols.length} символов типа ${textureIndex}`);
      }
    }
    
    return winningSymbols;
  }

  // Удаляет выигрышные символы с поля
  removeWinningSymbols(winningSymbols) {
    for (const symbol of winningSymbols) {
      // Удаляем символ из сетки
      if (symbol.col !== null && symbol.row !== null) {
        this.grid[symbol.col][symbol.row] = null;
      }
      // Уничтожаем визуальный объект
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
    for (const [col, rows] of emptyByColumn.entries()) {
      // Сортируем строки сверху вниз (от меньшего к большему)
      rows.sort((a, b) => a - b);
      
      for (const row of rows) {
        const position = this.gridPositions[col][row];
        
        // Используем символ из сценария или случайный
        let textureIndex;
        if (this.scenarioMode) {
          const scenarioSymbol = this.getNextScenarioSymbol(col, row, 'refill');
          if (scenarioSymbol !== null) {
            textureIndex = scenarioSymbol;
          } else {
            textureIndex = Math.floor(Math.random() * this.symbolTextures.length);
          }
        } else {
          textureIndex = Math.floor(Math.random() * this.symbolTextures.length);
        }
        
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
        
        // Добавляем в сетку
        this.grid[col][row] = symbol;
      }
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

  // Ждет фиксированное время для завершения анимации падения (простая версия)
  async waitForAllSymbolsToLand() {
    // Просто ждем фиксированное время, достаточное для завершения анимации
    // Максимальное время = время падения + задержки между колонками/строками
    // 5 строк * 112px / 800px/s = 0.7с падения + 0.5с задержки колонок + 0.8с задержки строк = ~2с
    const FALL_TIME = 2000; // 2 секунды достаточно для завершения всех анимаций
    await new Promise(resolve => setTimeout(resolve, FALL_TIME));
  }

  // Обрабатывает каскадный эффект после удаления выигрышных символов
  async processCascade() {
    // Проверяем, что мы не в процессе другого каскада
    if (this.gameState === GAME_STATE.COMPACTING || this.gameState === GAME_STATE.FILLING) {
      console.warn('⚠️ Каскад уже в процессе, пропускаем');
      return;
    }
    
    // ФАЗА: Уплотнение колонок
    this.gameState = GAME_STATE.COMPACTING;
    
    // Минимальная пауза перед уплотнением (только для завершения анимации удаления)
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Уплотняем колонки - символы начинают падать вниз
    const { hasMoved, emptySpots } = this.compactColumns();
    
    if (hasMoved || emptySpots.length > 0) {
      if (hasMoved) {
        console.log('⬇️ [COMPACTING] Запущено падение символов для заполнения пустот');
      }
      // Досыпание сразу после уплотнения, без ожидания приземления — оба процесса идут параллельно
      if (emptySpots.length > 0) {
        this.gameState = GAME_STATE.FILLING;
        console.log(`✨ [FILLING] Создано ${emptySpots.length} новых символов для заполнения пустот`);
        this.createNewSymbolsForEmptySpots(emptySpots);
        await this.startNewSymbolsFall(emptySpots);
      }
      this.gameState = GAME_STATE.WAITING_LANDING;
      this.winCheckProcessed = false;
      this.winCheckPending = false;
      const timeMs = this._getTimeUntilLastSymbolLandsAfterCascadeMs(hasMoved, emptySpots);
      this._scheduleWinCheck(timeMs);
    } else {
      // Если ничего не переместилось и нет пустых мест - каскад завершен
      // Если режим сценария, проверяем следующий шаг
      if (this.scenarioMode && this.currentScenario) {
        // Ищем следующий шаг спина (пропускаем все каскады)
        let nextSpinIndex = -1;
        for (let i = this.currentScenarioStep + 1; i < this.currentScenario.length; i++) {
          if (this.currentScenario[i].event === 'spin') {
            nextSpinIndex = i;
            break;
          }
        }
        
        if (nextSpinIndex >= 0) {
          // Есть следующий спин, переходим к нему
          this.currentScenarioStep = nextSpinIndex;
          console.log(`📋 [SCENARIO] Каскад завершен, переход к следующему спину: шаг ${nextSpinIndex + 1}/${this.currentScenario.length}`);
        } else {
          // Сценарий завершен
          console.log('✅ [SCENARIO] Сценарий завершен');
          this.scenarioMode = false;
        }
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
    
    // Находим первый шаг со спином
    let firstSpinIndex = 0;
    for (let i = 0; i < scenarioJson.length; i++) {
      if (scenarioJson[i].event === 'spin') {
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
      return null;
    }

    // Конвертируем сетку и получаем символ
    const internalGrid = this.convertScenarioGridToInternal(step.grid);
    return internalGrid[col][row] !== undefined ? internalGrid[col][row] : null;
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
   * Переходит к следующему шагу сценария
   * @returns {boolean} true если переход успешен, false если сценарий завершен
   */
  advanceScenarioStep() {
    if (!this.scenarioMode || !this.currentScenario) {
      return false;
    }
    
    if (this.currentScenarioStep + 1 < this.currentScenario.length) {
      this.currentScenarioStep++;
      return true;
    }
    
    // Сценарий завершен
    this.scenarioMode = false;
    console.log('✅ Сценарий завершен');
    return false;
  }
}
