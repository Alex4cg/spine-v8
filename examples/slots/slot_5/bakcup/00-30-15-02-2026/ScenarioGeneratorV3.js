/**
 * ScenarioGeneratorV3 - простая и надежная версия генератора сценариев
 * Работает пошагово: насыпал → сохранил → нашел выигрыши/бомбы → записал → досыпал → сохранил
 */
export class ScenarioGeneratorV3 {
  constructor(config) {
    this.GRID_COLS = config.gridCols || 6;
    this.GRID_ROWS = config.gridRows || 5;
    this.minSymbolsForWin = config.minSymbolsForWin || 7;
    this.symbolCount = config.symbolCount || 8;
    this.payoutsConfig = config.payoutsConfig || null;
    
    this.symbolNames = config.symbolNames || [
      'h1_lion', 'h2_bull', 'h3_bear', 'h4_wolf',
      'l1_revolver', 'l2_bottle', 'l3_horseshoe', 'l4_cactus'
    ];
    
    this.BOMB_SYMBOL_TYPE = config.bombSymbolType || 8;
    this.bombMultiplier = config.bombMultiplier || 5;
    this.bombSpinChance = config.bombSpinChance ?? 0.9;   // ~8.8% на спине (+20%)
    this.bombRefillChance = config.bombRefillChance ?? 0.3;  // ~2.9% при досыпке (+20%)
    /** Шанс появления бомбы при досыпке внутри каскада (если не задан — используется bombRefillChance) */
    this.bombCascadeChance = config.bombCascadeChance !== undefined ? config.bombCascadeChance : this.bombRefillChance;
    
    /** Константы для скаттеров */
    this.SCATTER_BLUE = 9;
    this.SCATTER_GOLD = 10;
    this.SCATTER_RED = 11;
    this.SCATTER_SYMBOL_TYPES = [9, 10, 11];
    
    /** Параметры скаттеров (умеренная редкость, +10%) */
    this.scatterSpinChance = config.scatterSpinChance ?? 0.1;   // ~0.88% на спине
    this.scatterRefillChance = config.scatterRefillChance ?? 0.1;  // ~0.22% при досыпке
    /** Шанс при досыпке внутри каскада (если не задан — scatterRefillChance) */
    this.scatterCascadeChance = config.scatterCascadeChance !== undefined ? config.scatterCascadeChance : this.scatterRefillChance;
    this.scatterActivationCount = config.scatterActivationCount || 4;  // Минимум для активации
    
    /** Высоковолатильность: минимум спинов без выигрыша подряд перед разрешением выигрыша */
    this.minSimpleSpinsBeforeWin = config.minSimpleSpinsBeforeWin !== undefined ? config.minSimpleSpinsBeforeWin : 1;
    /** После минимума — вероятность спина без выигрыша (0.25 = 25% сухих, 75% с шансом на каскад; сухих в 2 раза меньше) */
    this.simpleSpinChance = config.simpleSpinChance !== undefined ? config.simpleSpinChance : 0.25;
    
    this.reset();
  }

  reset() {
    this.scenario = [];
  }

  /**
   * ШАГ 1: Генерирует случайное поле (насыпание символов)
   * @param {boolean} allowBomb - Разрешить генерацию бомбы
   * @param {boolean} allowScatter - Разрешить генерацию скаттеров
   */
  generateRandomGrid(allowBomb = true, allowScatter = true) {
    const grid = [];
    let bombPlaced = false;
    
    // Сначала заполняем все ячейки обычными символами
    for (let row = 0; row < this.GRID_ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        grid[row][col] = Math.floor(Math.random() * this.symbolCount);
      }
    }
    
    // Затем размещаем бомбу (если разрешена)
    if (allowBomb && Math.random() < this.bombSpinChance) {
      const bombRow = Math.floor(Math.random() * this.GRID_ROWS);
      const bombCol = Math.floor(Math.random() * this.GRID_COLS);
      grid[bombRow][bombCol] = this.BOMB_SYMBOL_TYPE;
      bombPlaced = true;
    }
    
    // Затем размещаем скаттеры (если разрешены)
    if (allowScatter) {
      for (let row = 0; row < this.GRID_ROWS; row++) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          // Пропускаем ячейку с бомбой
          if (grid[row][col] === this.BOMB_SYMBOL_TYPE) continue;
          
          // С шансом scatterSpinChance размещаем скаттер случайного типа
          if (Math.random() < this.scatterSpinChance) {
            const scatterTypes = [this.SCATTER_BLUE, this.SCATTER_GOLD, this.SCATTER_RED];
            grid[row][col] = scatterTypes[Math.floor(Math.random() * scatterTypes.length)];
          }
        }
      }
    }
    
    return grid;
  }

  /**
   * ШАГ 2: Подсчитывает количество каждого типа символа (игнорируя бомбы и скаттеры)
   */
  countSymbols(grid) {
    const counts = new Map();
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        if (symbol !== this.BOMB_SYMBOL_TYPE && 
            !this.SCATTER_SYMBOL_TYPES.includes(symbol) && 
            symbol >= 0) {
          counts.set(symbol, (counts.get(symbol) || 0) + 1);
        }
      }
    }
    return counts;
  }

  /**
   * ШАГ 3: Находит выигрышные группы (7+ одинаковых символов)
   */
  findWinningGroups(grid) {
    const counts = this.countSymbols(grid);
    const groups = [];
    let groupId = 1;
    
    for (const [symbolType, count] of counts.entries()) {
      if (count >= this.minSymbolsForWin) {
        groups.push({
          symbolType,
          count,
          groupId: groupId++,
          symbolName: this.symbolNames[symbolType] || `symbol_${symbolType}`
        });
      }
    }
    
    return groups.sort((a, b) => a.symbolType - b.symbolType);
  }

  /**
   * ШАГ 4: Создает разметку групп на сетке
   * @param {Array} grid - Сетка символов
   * @param {Array} winningGroups - Выигрышные группы
   * @param {Array|null} explodedPositions - Позиции взрыва бомбы (опционально, для пометки скаттеров)
   */
  createGroupMarkup(grid, winningGroups, explodedPositions = null) {
    const markup = [];
    const symbolToGroupId = new Map();
    
    for (const group of winningGroups) {
      symbolToGroupId.set(group.symbolType, group.groupId);
    }
    
    // Создаём Set позиций взрыва для быстрой проверки
    const explodePositionsSet = explodedPositions ? new Set(
      explodedPositions.map(pos => `${pos.row},${pos.col}`)
    ) : null;
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      markup[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        const posKey = `${row},${col}`;
        
        // Если это позиция взрыва и символ - скаттер, помечаем значением -2
        if (explodePositionsSet && explodePositionsSet.has(posKey) && 
            this.SCATTER_SYMBOL_TYPES.includes(symbol)) {
          markup[row][col] = -2;  // Скаттер под взрывом, не удалять
        } else {
          markup[row][col] = symbolToGroupId.get(symbol) || 0;
        }
      }
    }
    
    return markup;
  }

  /**
   * Подсчитывает все скаттеры на поле
   * @param {Array} grid - Сетка символов
   * @returns {Object} Объект с информацией о скаттерах
   */
  countScatters(grid) {
    let total = 0;
    let blue = 0;
    let gold = 0;
    let red = 0;
    const positions = [];
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        if (symbol === this.SCATTER_BLUE) {
          total++;
          blue++;
          positions.push({ row, col, type: this.SCATTER_BLUE });
        } else if (symbol === this.SCATTER_GOLD) {
          total++;
          gold++;
          positions.push({ row, col, type: this.SCATTER_GOLD });
        } else if (symbol === this.SCATTER_RED) {
          total++;
          red++;
          positions.push({ row, col, type: this.SCATTER_RED });
        }
      }
    }
    
    return {
      total,
      blue,
      gold,
      red,
      positions
    };
  }

  /**
   * Находит все позиции скаттеров на поле
   * @param {Array} grid - Сетка символов
   * @returns {Set} Set строк вида "row,col"
   */
  findScatterPositions(grid) {
    const positions = new Set();
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        if (this.SCATTER_SYMBOL_TYPES.includes(symbol)) {
          positions.add(`${row},${col}`);
        }
      }
    }
    
    return positions;
  }

  /**
   * ШАГ 5: Находит позицию первой бомбы (для типа события и bombPosition в событии)
   */
  findBombPosition(grid) {
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        if (grid[row][col] === this.BOMB_SYMBOL_TYPE) {
          return { row, col };
        }
      }
    }
    return null;
  }

  /**
   * Находит все позиции бомб на сетке (по документу: максимум одна за насыпание; метод для гарантии удаления всех при взрыве)
   */
  findAllBombPositions(grid) {
    const positions = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        if (grid[row][col] === this.BOMB_SYMBOL_TYPE) {
          positions.push({ row, col });
        }
      }
    }
    return positions;
  }

  /**
   * Подсчёт бомб в сетке (для проверки «не более одной» при досыпке)
   */
  countBombs(grid) {
    return this.findAllBombPositions(grid).length;
  }

  /**
   * ШАГ 6: Находит 8 соседних позиций вокруг бомбы
   */
  findBombNeighbors(row, col) {
    const neighbors = [];
    const directions = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];
    
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < this.GRID_ROWS && 
          newCol >= 0 && newCol < this.GRID_COLS) {
        neighbors.push({ row: newRow, col: newCol });
      }
    }
    
    return neighbors;
  }

  /**
   * ШАГ 7: Находит все позиции выигрышных символов из групп
   */
  findWinningPositionsFromGroups(grid, winningGroups) {
    const winning = new Set();
    
    for (const group of winningGroups) {
      const symbolType = group.symbolType;
      for (let row = 0; row < this.GRID_ROWS; row++) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          if (grid[row][col] === symbolType) {
            winning.add(`${row},${col}`);
          }
        }
      }
    }
    
    return winning;
  }

  /**
   * ШАГ 8: Удаляет символы (помечает как -1), скаттеры не удаляются
   */
  removeSymbols(grid, positions) {
    const next = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      next[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        const posKey = `${row},${col}`;
        const symbol = grid[row][col];
        // Скаттеры не удаляются
        if (positions.has(posKey) && !this.SCATTER_SYMBOL_TYPES.includes(symbol)) {
          next[row][col] = -1;
        } else {
          next[row][col] = grid[row][col];
        }
      }
    }
    return next;
  }

  /**
   * ШАГ 9: Уплотняет колонки - символы падают вниз
   */
  compactColumns(grid) {
    const compacted = [];
    const emptySpots = [];
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      const symbolsInColumn = [];
      // Собираем символы снизу вверх
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col] >= 0) {
          symbolsInColumn.push(grid[row][col]);
        }
      }
      
      // Размещаем символы снизу вверх
      let symbolIndex = 0;
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (symbolIndex < symbolsInColumn.length) {
          compacted[row] = compacted[row] || [];
          compacted[row][col] = symbolsInColumn[symbolIndex++];
        } else {
          compacted[row] = compacted[row] || [];
          compacted[row][col] = -1;
          emptySpots.push({ row, col });
        }
      }
    }
    
    return { grid: compacted, emptySpots };
  }

  /**
   * ШАГ 10: Заполняет пустые места (досыпание).
   * @param {boolean} isCascadeRefill - true при досыпке внутри каскада (используется bombCascadeChance и scatterCascadeChance)
   */
  fillEmptySpots(grid, emptySpots, getNextSymbol, bombAlreadyUsed, isCascadeRefill = false) {
    const filled = grid.map(row => row.slice());
    
    // Сортируем: сначала по колонке, потом по ряду
    emptySpots.sort((a, b) => {
      if (a.col !== b.col) return a.col - b.col;
      return a.row - b.row;
    });
    
    let hasBombAfterCompact = this.countBombs(grid) > 0;
    const bombChance = isCascadeRefill ? this.bombCascadeChance : this.bombRefillChance;
    const scatterChance = isCascadeRefill ? this.scatterCascadeChance : this.scatterRefillChance;
    
    for (let i = 0; i < emptySpots.length; i++) {
      const { row, col } = emptySpots[i];
      // По документу: максимум одна бомба за досыпание — не добавляем, если уже есть бомба или уже поставили
      const mayAddBomb = !bombAlreadyUsed && !hasBombAfterCompact && Math.random() < bombChance;
      if (mayAddBomb) {
        filled[row][col] = this.BOMB_SYMBOL_TYPE;
        bombAlreadyUsed = true;
        hasBombAfterCompact = true; // чтобы в этой же итерации больше не ставить
      } else if (Math.random() < scatterChance) {
        const scatterTypes = [this.SCATTER_BLUE, this.SCATTER_GOLD, this.SCATTER_RED];
        filled[row][col] = scatterTypes[Math.floor(Math.random() * scatterTypes.length)];
      } else {
        filled[row][col] = getNextSymbol(i);
      }
    }
    
    // Гарантия по документу: не более одной бомбы в сетке — лишние заменяем на обычный символ
    const bombCount = this.countBombs(filled);
    if (bombCount > 1) {
      const bombs = this.findAllBombPositions(filled);
      for (let b = 1; b < bombs.length; b++) {
        const { row, col } = bombs[b];
        filled[row][col] = getNextSymbol(emptySpots.length + b);
      }
    }
    
    return { grid: filled, bombUsed: bombAlreadyUsed };
  }

  /**
   * ШАГ 11: Рассчитывает выплаты по таблице payouts (из payouts.json)
   */
  calculatePayouts(winningGroups) {
    const payoutsTable = this._getPayoutsTable();
    if (!payoutsTable) {
      return { payouts: [], totalPayout: 0 };
    }

    const payouts = [];
    let totalPayout = 0;

    for (const group of winningGroups) {
      if (group.symbolType === this.BOMB_SYMBOL_TYPE) continue;

      const count = group.count;
      const symbolName = group.symbolName;
      if (!symbolName) continue;

      const payout = this._getPayoutForCountAndSymbol(payoutsTable, count, symbolName);
      if (payout !== undefined && payout !== null) {
        payouts.push({
          symbolType: group.symbolType,
          symbolName: group.symbolName,
          count: group.count,
          payout
        });
        totalPayout += payout;
      }
    }

    return { payouts, totalPayout };
  }

  /**
   * Возвращает таблицу выплат: либо payoutsConfig.payouts, либо сам payoutsConfig
   */
  _getPayoutsTable() {
    if (!this.payoutsConfig) return null;
    return this.payoutsConfig.payouts || this.payoutsConfig;
  }

  /**
   * Ищет выплату для count символов и имени символа.
   * Если точного count нет (например 31), используется ближайший меньший ключ (30).
   */
  _getPayoutForCountAndSymbol(payoutsTable, count, symbolName) {
    const keys = Object.keys(payoutsTable).filter(k => k !== 'description' && /^\d+$/.test(k));
    if (keys.length === 0) return undefined;

    const numKeys = keys.map(Number).sort((a, b) => a - b);
    let countStr = String(count);
    if (!(countStr in payoutsTable)) {
      const lower = numKeys.filter(n => n <= count);
      countStr = lower.length ? String(lower[lower.length - 1]) : String(numKeys[0]);
    }

    const row = payoutsTable[countStr];
    if (!row || typeof row !== 'object') return undefined;
    const payout = row[symbolName];
    return typeof payout === 'number' ? payout : undefined;
  }

  /**
   * ШАГ 12: Создает событие из текущего состояния сетки.
   * Гарантия по документу: в событии не более одной бомбы — лишние заменяются на обычный символ.
   */
  createEvent(grid, eventType, winningGroups, bombPosition, bombAlreadyUsed) {
    // Нормализация: не более одной бомбы в сетке события (на случай сбоя в цепочке генерации)
    const gridToUse = grid.map(row => row.slice());
    const allBombs = this.findAllBombPositions(gridToUse);
    if (allBombs.length > 1) {
      for (let b = 1; b < allBombs.length; b++) {
        gridToUse[allBombs[b].row][allBombs[b].col] = Math.floor(Math.random() * this.symbolCount);
      }
      bombPosition = allBombs.length > 0 ? { ...allBombs[0] } : null;
    }
    
    const { payouts, totalPayout } = this.calculatePayouts(winningGroups);
    
    let groupMarkup;
    let explodedPositions = null;
    
    if (bombPosition && winningGroups.length === 0) {
      const neighbors = this.findBombNeighbors(bombPosition.row, bombPosition.col);
      explodedPositions = [
        { row: bombPosition.row, col: bombPosition.col },
        ...neighbors
      ];
    }
    
    groupMarkup = this.createGroupMarkup(gridToUse, winningGroups, explodedPositions);
    
    const event = {
      event: eventType,
      grid: gridToUse.map(row => row.slice()),
      groupMarkup: groupMarkup.map(row => row.slice()),
      winningGroups: winningGroups.map(g => ({ ...g })),
      payouts: payouts.map(p => ({ ...p })),
      totalPayout: totalPayout
    };
    
    // Добавляем информацию о бомбе если есть
    if (bombPosition) {
      if (winningGroups.length > 0) {
        // Бомба с выигрышем - multiplier
        event.bombType = 'multiplier';
        event.bombPosition = { ...bombPosition };
        event.multiplier = this.bombMultiplier;
        event.totalPayout = totalPayout * this.bombMultiplier;
      } else {
        // Бомба без выигрыша - explode
        event.bombType = 'explode';
        event.bombPosition = { ...bombPosition };
        event.explodedPositions = explodedPositions;
      }
    }
    
    // Добавляем полную информацию о скаттерах во все события
    const scatterInfo = this.countScatters(gridToUse);
    if (scatterInfo.total > 0) {
      event.scatterCount = scatterInfo.total;
      event.scatterBlue = scatterInfo.blue;
      event.scatterGold = scatterInfo.gold;
      event.scatterRed = scatterInfo.red;
      event.scatterActivated = scatterInfo.total >= this.scatterActivationCount;
      // Позиции скаттеров для отладки (опционально)
      event.scatterPositions = scatterInfo.positions.map(p => ({ ...p }));
    }
    
    return event;
  }

  /**
   * Создает событие активации скаттеров
   * @param {Array} grid - Сетка символов
   * @returns {Object} Событие scatter-activation
   */
  createScatterActivationEvent(grid) {
    const scatterInfo = this.countScatters(grid);
    
    return {
      event: 'scatter-activation',
      grid: grid.map(row => row.slice()),
      scatterCount: scatterInfo.total,
      scatterBlue: scatterInfo.blue,
      scatterGold: scatterInfo.gold,
      scatterRed: scatterInfo.red,
      scatterPositions: scatterInfo.positions.map(p => ({ ...p }))
    };
  }

  /**
   * ОСНОВНОЙ МЕТОД: Генерирует один спин и все каскады
   */
  generateSpinWithCascades(getSpinGrid, getRefillSymbol) {
    const steps = [];
    let currentGrid = getSpinGrid();
    let bombAlreadyUsed = false;
    
    // ШАГ 1: Насыпали начальное поле - сохраняем
    let winningGroups = this.findWinningGroups(currentGrid);
    let bombPosition = this.findBombPosition(currentGrid);
    
    // Определяем тип события спина
    let spinEventType;
    if (winningGroups.length > 0 && bombPosition) {
      spinEventType = 'spin-win-bomb';
    } else if (winningGroups.length > 0) {
      spinEventType = 'spin-win';
    } else if (bombPosition) {
      spinEventType = 'spin-bomb';
    } else {
      spinEventType = 'spin';
    }
    
    // Сохраняем событие спина
    const spinEvent = this.createEvent(currentGrid, spinEventType, winningGroups, bombPosition, bombAlreadyUsed);
    steps.push(spinEvent);
    
    // Если спин без выигрыша и без бомбы - завершение
    if (winningGroups.length === 0 && !bombPosition) {
      return steps;
    }
    
    // ШАГ 2: Обрабатываем спин
    
    // Если есть бомба без выигрыша - обрабатываем взрыв (удаляем ВСЕ бомбы и их соседей — по документу макс. 1, но на случай сбоя)
    if (bombPosition && winningGroups.length === 0) {
      const allBombs = this.findAllBombPositions(currentGrid);
      const explodePositions = new Set();
      for (const bomb of allBombs) {
        explodePositions.add(`${bomb.row},${bomb.col}`);
        this.findBombNeighbors(bomb.row, bomb.col).forEach(pos => explodePositions.add(`${pos.row},${pos.col}`));
      }
      currentGrid = this.removeSymbols(currentGrid, explodePositions);
      bombAlreadyUsed = true;
    }
    
    // Если есть выигрыш - удаляем выигрышные символы
    if (winningGroups.length > 0) {
      const winningPositions = this.findWinningPositionsFromGroups(currentGrid, winningGroups);
      const allBombs = this.findAllBombPositions(currentGrid);
      for (const bomb of allBombs) {
        winningPositions.add(`${bomb.row},${bomb.col}`);
      }
      if (allBombs.length > 0) bombAlreadyUsed = true;
      currentGrid = this.removeSymbols(currentGrid, winningPositions);
    }
    
    // ШАГ 3: Уплотняем колонки
    const { grid: compacted, emptySpots } = this.compactColumns(currentGrid);
    
    // ШАГ 4: Досыпаем символы
    const { grid: filled, bombUsed } = this.fillEmptySpots(
      compacted, 
      emptySpots, 
      (refillIndex) => getRefillSymbol(0, refillIndex),
      bombAlreadyUsed
    );
    bombAlreadyUsed = bombUsed;
    currentGrid = filled;
    
    // ШАГ 5: Проверяем состояние после досыпания
    winningGroups = this.findWinningGroups(currentGrid);
    bombPosition = this.findBombPosition(currentGrid);
    
    // Если после обработки спина нет выигрыша и нет бомбы - создаем событие cascade и завершаем
    // Информация о скаттерах (включая флаг активации) уже включена в событие через createEvent
    if (winningGroups.length === 0 && !bombPosition) {
      const cascadeEvent = this.createEvent(currentGrid, 'cascade', [], null, bombAlreadyUsed);
      steps.push(cascadeEvent);
      return steps;
    }
    
    // ШАГ 6: Цикл каскадов (продолжаем если есть выигрыш или бомба)
    let cascadeStepIndex = 1;
    
    while (true) {
      // Определяем тип события каскада
      let cascadeEventType;
      if (winningGroups.length > 0 && bombPosition) {
        cascadeEventType = 'cascade-win-bomb';
      } else if (winningGroups.length > 0) {
        cascadeEventType = 'cascade-win';
      } else if (bombPosition) {
        cascadeEventType = 'cascade-bomb';
      } else {
        cascadeEventType = 'cascade';
      }
      
      // Сохраняем событие каскада
      const cascadeEvent = this.createEvent(currentGrid, cascadeEventType, winningGroups, bombPosition, bombAlreadyUsed);
      steps.push(cascadeEvent);
      
      // Если нет выигрыша и нет бомбы - завершение каскада
      // Информация о скаттерах (включая флаг активации) уже включена в событие через createEvent
      if (winningGroups.length === 0 && !bombPosition) {
        break;
      }
      
      // Обрабатываем каскад
      
      // Если есть бомба без выигрыша - обрабатываем взрыв (удаляем ВСЕ бомбы и их соседей)
      if (bombPosition && winningGroups.length === 0) {
        const allBombs = this.findAllBombPositions(currentGrid);
        const explodePositions = new Set();
        for (const bomb of allBombs) {
          explodePositions.add(`${bomb.row},${bomb.col}`);
          this.findBombNeighbors(bomb.row, bomb.col).forEach(pos => explodePositions.add(`${pos.row},${pos.col}`));
        }
        currentGrid = this.removeSymbols(currentGrid, explodePositions);
        bombAlreadyUsed = true;
      }
      
      // Если есть выигрыш - удаляем выигрышные символы (и все бомбы)
      if (winningGroups.length > 0) {
        const winningPositions = this.findWinningPositionsFromGroups(currentGrid, winningGroups);
        const allBombs = this.findAllBombPositions(currentGrid);
        for (const bomb of allBombs) {
          winningPositions.add(`${bomb.row},${bomb.col}`);
        }
        if (allBombs.length > 0) bombAlreadyUsed = true;
        currentGrid = this.removeSymbols(currentGrid, winningPositions);
      }
      
      // Уплотняем колонки
      const { grid: compacted2, emptySpots: emptySpots2 } = this.compactColumns(currentGrid);
      
      // Досыпаем символы. Предыдущая бомба уже сработала и удалена — на экране 0 бомб, разрешаем снова одну за этот досып (не «1 бомба на всю серию»).
      const { grid: filled2, bombUsed: bombUsed2 } = this.fillEmptySpots(
        compacted2,
        emptySpots2,
        (refillIndex) => getRefillSymbol(cascadeStepIndex, refillIndex),
        false,  // каждый досып в каскаде — новый шанс на бомбу (макс. 1 на экране, но за серию каскадов бомб может быть несколько)
        true
      );
      bombAlreadyUsed = bombUsed2;
      currentGrid = filled2;
      
      // Проверяем новое состояние
      winningGroups = this.findWinningGroups(currentGrid);
      bombPosition = this.findBombPosition(currentGrid);
      
      cascadeStepIndex++;
    }
    
    return steps;
  }

  /**
   * Генерирует сетку без выигрышей и без бомб (для простого spin)
   */
  generateGridWithoutWinsAndBombs(maxAttempts = 100) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const grid = this.generateRandomGrid(false); // Без бомбы
      const winningGroups = this.findWinningGroups(grid);
      
      // Если нет выигрышей - подходит
      if (winningGroups.length === 0) {
        return grid;
      }
    }
    
    // Если не удалось сгенерировать за maxAttempts попыток - возвращаем случайную
    return this.generateRandomGrid(false);
  }

  /**
   * Генерирует полный сценарий (высоковолатильный: несколько сухих спинов, потом шанс на каскад с выплатой)
   */
  generateScenario(spinCount) {
    this.reset();
    
    // Счётчик сухих спинов подряд: сначала гарантируем minSimpleSpinsBeforeWin, потом simpleSpinChance
    let simpleSpinsCount = 0;
    
    for (let i = 0; i < spinCount; i++) {
      let getSpinGrid;
      const mustBeSimple =
        simpleSpinsCount < this.minSimpleSpinsBeforeWin ||
        (i === spinCount - 1 && simpleSpinsCount === 0) ||
        Math.random() < this.simpleSpinChance;
      
      if (mustBeSimple) {
        getSpinGrid = () => this.generateGridWithoutWinsAndBombs();
        simpleSpinsCount++;
      } else {
        getSpinGrid = () => this.generateRandomGrid();
        simpleSpinsCount = 0;
      }
      
      const steps = this.generateSpinWithCascades(
        getSpinGrid,
        (cascadeStepIndex, refillIndex) => Math.floor(Math.random() * this.symbolCount)
      );
      this.scenario.push(...steps);
    }
    
    return this.scenario;
  }

  /**
   * Находит выигрышные позиции из сетки (для совместимости с интерфейсом)
   */
  findWinningPositions(grid) {
    const counts = this.countSymbols(grid);
    const winning = new Set();
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        // Игнорируем бомбы при поиске выигрышных позиций
        if (symbol !== this.BOMB_SYMBOL_TYPE && counts.get(symbol) >= this.minSymbolsForWin) {
          winning.add(`${row},${col}`);
        }
      }
    }
    
    return winning;
  }

  /**
   * Форматирует сценарий в компактный JSON (каждое событие на одной строке)
   */
  formatCompactJSON(scenario = null) {
    const data = scenario || this.scenario;
    const lines = ['['];
    for (let i = 0; i < data.length; i++) {
      const eventJson = JSON.stringify(data[i]);
      lines.push(`  ${eventJson}${i < data.length - 1 ? ',' : ''}`);
    }
    lines.push(']');
    return lines.join('\n');
  }

  /**
   * Экспортирует сценарий в JSON формат (для совместимости с интерфейсом)
   */
  exportToJSON() {
    return this.formatCompactJSON();
  }

  /**
   * Скачивает сценарий как JSON файл (для совместимости с интерфейсом)
   */
  downloadScenario(filename = 'scenario.json') {
    const content = this.exportToJSON();
    
    // Добавляем расширение если его нет
    if (!filename.endsWith('.json')) {
      filename += '.json';
    }
    
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Путь по умолчанию: scenario/имя_файла
    // Браузер сохранит в Downloads, но имя файла будет указывать на нужную папку
    a.download = filename.startsWith('scenario/') ? filename : `scenario/${filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
