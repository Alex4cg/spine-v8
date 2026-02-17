/**
 * ScenarioGenerator - генератор сценариев каскадного слота без анимации
 * Чистая логика: выигрыш 7+, удаление, уплотнение по колонкам, досыпание col 0→5, row 0→4
 */
export class ScenarioGenerator {
  constructor(config) {
    this.GRID_COLS = config.gridCols || 6;
    this.GRID_ROWS = config.gridRows || 5;
    this.minSymbolsForWin = config.minSymbolsForWin || 7;
    this.symbolCount = config.symbolCount || 8; // Количество типов символов (0-7)
    this.payoutsConfig = config.payoutsConfig || null;
    
    // Маппинг индексов символов на имена для выплат
    this.symbolNames = config.symbolNames || [
      'h1_diamond', 'h2_gold', 'h3_silver', 'h4_copper',
      'l1_watermelon', 'l2_grape', 'l3_lemon', 'l4_cherry'
    ];
    
    // Сетка: grid[row][col] для удобства (как в сценариях)
    this.grid = [];
    this.scenario = [];
    this.randomSeed = null; // Для воспроизводимости (опционально)
    
    this.reset();
  }

  reset() {
    // Инициализируем пустую сетку
    this.grid = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        this.grid[row][col] = 0;
      }
    }
    this.scenario = [];
  }

  /**
   * Генерирует случайное поле (спин)
   * @returns {number[][]} Сетка [row][col]
   */
  generateRandomGrid() {
    const grid = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        grid[row][col] = Math.floor(Math.random() * this.symbolCount);
      }
    }
    return grid;
  }

  /**
   * Подсчитывает количество каждого типа символа
   * @param {number[][]} grid - Сетка [row][col]
   * @returns {Map<number, number>} Map: symbolType -> count
   */
  countSymbols(grid) {
    const counts = new Map();
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        counts.set(symbol, (counts.get(symbol) || 0) + 1);
      }
    }
    return counts;
  }

  /**
   * Находит выигрышные позиции (7+ одинаковых символов)
   * @param {number[][]} grid - Сетка [row][col]
   * @returns {Set<string>} Set позиций "row,col" которые нужно удалить
   */
  findWinningPositions(grid) {
    const counts = this.countSymbols(grid);
    const winning = new Set();
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        if (counts.get(symbol) >= this.minSymbolsForWin) {
          winning.add(`${row},${col}`);
        }
      }
    }
    
    return winning;
  }

  /**
   * Находит группы выигрышных символов
   * @param {number[][]} grid - Сетка [row][col]
   * @returns {Array<{symbolType: number, count: number, groupId: number, symbolName: string}>}
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
    
    return groups.sort((a, b) => a.symbolType - b.symbolType); // Сортируем по типу символа
  }

  /**
   * Создает разметку групп на сетке
   * @param {number[][]} grid - Сетка [row][col]
   * @param {Array} winningGroups - Массив групп выигрышных символов
   * @returns {number[][]} Разметка: 0 = не уничтожен, 1+ = номер группы
   */
  createGroupMarkup(grid, winningGroups) {
    const markup = [];
    const symbolToGroupId = new Map();
    
    // Создаем маппинг: symbolType -> groupId
    for (const group of winningGroups) {
      symbolToGroupId.set(group.symbolType, group.groupId);
    }
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      markup[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        markup[row][col] = symbolToGroupId.get(symbol) || 0;
      }
    }
    
    return markup;
  }

  /**
   * Рассчитывает выплаты для групп выигрышных символов
   * @param {Array} winningGroups - Массив групп выигрышных символов
   * @returns {{payouts: Array, totalPayout: number}}
   */
  calculatePayouts(winningGroups) {
    if (!this.payoutsConfig || !this.payoutsConfig.payouts) {
      return { payouts: [], totalPayout: 0 };
    }
    
    const payouts = [];
    let totalPayout = 0;
    
    for (const group of winningGroups) {
      const countStr = group.count.toString();
      const payoutForCount = this.payoutsConfig.payouts[countStr];
      
      if (payoutForCount && payoutForCount[group.symbolName] !== undefined) {
        const payout = payoutForCount[group.symbolName];
        payouts.push({
          groupId: group.groupId,
          symbolType: group.symbolType,
          symbolName: group.symbolName,
          count: group.count,
          payout: payout
        });
        totalPayout += payout;
      }
    }
    
    return { payouts, totalPayout };
  }

  /**
   * Удаляет выигрышные символы (помечает как -1)
   * @param {number[][]} grid - Сетка [row][col]
   * @param {Set<string>} winningPositions - Позиции для удаления
   * @returns {number[][]} Новая сетка с удаленными символами (-1)
   */
  removeWinningSymbols(grid, winningPositions) {
    const next = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      next[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        next[row][col] = winningPositions.has(`${row},${col}`) ? -1 : grid[row][col];
      }
    }
    return next;
  }

  /**
   * Уплотняет колонки - символы "падают" вниз, пустоты остаются сверху
   * Логика совпадает с CascadeManager.compactColumns()
   * @param {number[][]} grid - Сетка [row][col] с удаленными символами (-1)
   * @returns {{grid: number[][], emptySpots: Array<{row: number, col: number}>}}
   */
  compactColumns(grid) {
    const compacted = [];
    const emptySpots = [];
    
    // Инициализируем пустую сетку
    for (let row = 0; row < this.GRID_ROWS; row++) {
      compacted[row] = [];
    }
    
    // Для каждой колонки
    for (let col = 0; col < this.GRID_COLS; col++) {
      // Собираем все непустые символы снизу вверх (row 4, 3, 2, 1, 0)
      const symbolsInColumn = [];
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col] >= 0) {
          symbolsInColumn.push(grid[row][col]);
        }
      }
      
      // Размещаем символы снизу вверх (как в CascadeManager: newRow = GRID_ROWS - 1 - i)
      const filledRows = symbolsInColumn.length;
      for (let i = 0; i < symbolsInColumn.length; i++) {
        const newRow = this.GRID_ROWS - 1 - i; // Снизу вверх: row 4, 3, 2, ...
        compacted[newRow][col] = symbolsInColumn[i];
      }
      
      // Пустые места сверху колонки
      for (let row = 0; row < this.GRID_ROWS - filledRows; row++) {
        compacted[row][col] = -1;
        emptySpots.push({ row, col });
      }
    }
    
    return { grid: compacted, emptySpots };
  }

  /**
   * Заполняет пустые места новыми символами
   * Порядок: колонки 0→5, внутри колонки ряды 0→4
   * @param {number[][]} grid - Сетка после уплотнения
   * @param {Array<{row: number, col: number}>} emptySpots - Пустые места
   * @param {Function} getNextSymbol - Функция получения следующего символа (index) => symbol
   * @returns {number[][]} Сетка с заполненными пустотами
   */
  fillEmptySpots(grid, emptySpots, getNextSymbol) {
    // Сортируем пустые места: сначала по колонке, потом по ряду
    const sorted = emptySpots.sort((a, b) => {
      if (a.col !== b.col) return a.col - b.col;
      return a.row - b.row;
    });
    
    const filled = grid.map(row => row.slice());
    let index = 0;
    
    for (const { row, col } of sorted) {
      filled[row][col] = getNextSymbol(index);
      index++;
    }
    
    return filled;
  }

  /**
   * Один шаг каскада: удаление → уплотнение → досыпание
   * @param {number[][]} grid - Текущая сетка
   * @param {Function} getNextSymbol - Функция получения символа для досыпания
   * @returns {{grid: number[][], hasWin: boolean}}
   */
  stepCascade(grid, getNextSymbol) {
    const winning = this.findWinningPositions(grid);
    
    if (winning.size === 0) {
      return { grid: grid.map(row => row.slice()), hasWin: false };
    }
    
    // Удаляем выигрышные символы
    const afterRemove = this.removeWinningSymbols(grid, winning);
    
    // Уплотняем колонки
    const { grid: compacted, emptySpots } = this.compactColumns(afterRemove);
    
    // Заполняем пустые места
    const filled = this.fillEmptySpots(compacted, emptySpots, getNextSymbol);
    
    // Проверяем, есть ли новый выигрыш
    const newWinning = this.findWinningPositions(filled);
    const hasWin = newWinning.size > 0;
    
    return { grid: filled, hasWin };
  }

  /**
   * Генерирует один спин и все каскады до завершения
   * Структура событий:
   * - spin: спин без выигрыша (завершает серию)
   * - spin-win: спин с выигрышем (за ним обязательно cascade или cascade-win)
   * - cascade: каскад без выигрыша (завершает серию)
   * - cascade-win: каскад с выигрышем (за ним обязательно cascade или cascade-win)
   * @param {Function} getSpinGrid - Функция генерации начального поля спина
   * @param {Function} getRefillSymbol - Функция получения символа для досыпания (stepIndex, refillIndex) => symbol
   * @returns {Array} Массив шагов сценария с информацией о группах и выплатах
   */
  generateSpinWithCascades(getSpinGrid, getRefillSymbol) {
    const steps = [];
    
    // Генерируем начальное поле спина
    const spinGrid = getSpinGrid();
    const winningGroups = this.findWinningGroups(spinGrid);
    const groupMarkup = this.createGroupMarkup(spinGrid, winningGroups);
    const { payouts, totalPayout } = this.calculatePayouts(winningGroups);
    
    // Определяем тип события спина: spin-win если есть выигрыш, иначе spin
    const spinEvent = winningGroups.length > 0 ? 'spin-win' : 'spin';
    
    steps.push({
      event: spinEvent,
      grid: spinGrid.map(row => row.slice()),
      winningGroups: winningGroups.map(g => ({ ...g })),
      groupMarkup: groupMarkup.map(row => row.slice()),
      payouts: payouts.map(p => ({ ...p })),
      totalPayout
    });
    
    // Если спин без выигрыша - серия завершена
    if (winningGroups.length === 0) {
      return steps;
    }
    
    // Обрабатываем каскады пока есть выигрыш
    let currentGrid = spinGrid;
    let cascadeStepIndex = 0;
    
    while (true) {
      const { grid: nextGrid, hasWin } = this.stepCascade(
        currentGrid,
        (refillIndex) => getRefillSymbol(cascadeStepIndex, refillIndex)
      );
      
      // Определяем группы и выплаты для каскада
      const cascadeWinningGroups = this.findWinningGroups(nextGrid);
      const cascadeGroupMarkup = this.createGroupMarkup(nextGrid, cascadeWinningGroups);
      const cascadePayouts = this.calculatePayouts(cascadeWinningGroups);
      
      // Определяем тип события каскада: cascade-win если есть выигрыш, иначе cascade
      const cascadeEvent = cascadeWinningGroups.length > 0 ? 'cascade-win' : 'cascade';
      
      steps.push({
        event: cascadeEvent,
        grid: nextGrid.map(row => row.slice()),
        winningGroups: cascadeWinningGroups.map(g => ({ ...g })),
        groupMarkup: cascadeGroupMarkup.map(row => row.slice()),
        payouts: cascadePayouts.payouts.map(p => ({ ...p })),
        totalPayout: cascadePayouts.totalPayout
      });
      
      // Если каскад без выигрыша - серия завершена
      if (cascadeWinningGroups.length === 0) {
        break;
      }
      
      // Продолжаем каскады если есть выигрыш
      currentGrid = nextGrid;
      cascadeStepIndex++;
    }
    
    return steps;
  }

  /**
   * Генерирует полный сценарий из N спинов
   * @param {number} spinCount - Количество спинов
   * @returns {Array} Полный сценарий
   */
  generateScenario(spinCount) {
    this.reset();
    
    const scenario = [];
    
    for (let spinIndex = 0; spinIndex < spinCount; spinIndex++) {
      const steps = this.generateSpinWithCascades(
        () => this.generateRandomGrid(),
        (cascadeStepIndex, refillIndex) => Math.floor(Math.random() * this.symbolCount)
      );
      
      scenario.push(...steps);
    }
    
    this.scenario = scenario;
    return scenario;
  }

  /**
   * Экспортирует сценарий в JSON строку (формат: строка на шаг)
   * @returns {string} JSON строка
   */
  exportToJSON() {
    // Формат: один шаг на строку, все поля компактно
    const lines = this.scenario.map(step => {
      const gridStr = JSON.stringify(step.grid);
      const groupMarkupStr = JSON.stringify(step.groupMarkup);
      const winningGroupsStr = JSON.stringify(step.winningGroups);
      const payoutsStr = JSON.stringify(step.payouts);
      return `  {"event": "${step.event}", "grid": ${gridStr}, "groupMarkup": ${groupMarkupStr}, "winningGroups": ${winningGroupsStr}, "payouts": ${payoutsStr}, "totalPayout": ${step.totalPayout}}`;
    });
    return `[\n${lines.join(',\n')}\n]`;
  }

  /**
   * Сохраняет сценарий в файл (через download)
   * @param {string} filename - Имя файла (будет автоматически добавлен путь scenario/)
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
