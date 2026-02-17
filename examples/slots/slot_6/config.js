/**
 * Конфигурация игры Slot 6
 */

export const CONFIG = {
  // Размеры
  SYMBOL_SIZE: 80,              // Размер символа (квадрата) в пикселях
  SYMBOL_SPACING: 10,            // Расстояние между символами
  STACK_ROWS: 4,                 // Количество строк в стеке
  STACK_COLS: 3,                 // Количество колонок в стеке
  FIELD_SIZE: 3,                 // Количество символов на игровом поле
  
  // Позиции элементов (относительно центра экрана)
  POSITIONS: {
    // Центр экрана (базовая точка)
    CENTER_X: 400,
    CENTER_Y: 400,
    
    // Игровое поле (3 символа в ряд, горизонтально)
    FIELD_Y: 400,                // Y позиция игрового поля
    FIELD_START_X: 400 - 80,     // X позиция первого символа (центр - размер/2 - spacing)
    
    // Верхний стек (4x3 сетка над полем)
    STACK_START_Y: 200,          // Y позиция верхнего ряда стека
    STACK_START_X: 400 - 80,     // X позиция первой колонки стека
    
    // Область множителей (слева от поля)
    MULTIPLIERS_X: 150,          // X позиция области множителей
    MULTIPLIERS_START_Y: 350,    // Y позиция первого множителя
    
    // Результат (под игровым полем)
    RESULT_X: 400,
    RESULT_Y: 500
  },
  
  // Цвета символов
  COLORS: {
    BLANK: 0x888888,             // Серый - пустышка
    WIN: 0x00FF00,               // Зеленый - выигрыш
    MULTIPLIER: 0xFFFF00,        // Желтый - множитель
    SELECTION_FRAME: 0xFF0000,   // Красный - рамка выбора
    BACKGROUND: 0x1a1a1a,        // Темно-серый фон
    TEXT: 0xFFFFFF               // Белый текст
  },
  
  // Типы символов
  SYMBOL_TYPES: {
    BLANK: 0,                    // Пустышка
    WIN_MIN: 1,                  // Минимальный ID выигрышного символа
    WIN_MAX: 10,                 // Максимальный ID выигрышного символа
    MULTIPLIER_MIN: 11,          // Минимальный ID множителя
    MULTIPLIER_MAX: 20           // Максимальный ID множителя (x2-x11)
  },
  
  // Вероятности символов (сумма должна быть ~1.0)
  PROBABILITIES: {
    BLANK: 0.30,                 // 30% пустышек
    WIN: 0.60,                   // 60% выигрышей (равномерно распределены между 1-10)
    MULTIPLIER: 0.10             // 10% множителей (равномерно распределены между 11-20)
  },
  
  // Базовая ставка для расчета выигрышей
  BASE_BET: 1,
  
  // Визуализация
  VISUALIZATION: {
    STEP_DELAY: 500,             // Задержка между шагами в мс
    FRAME_THICKNESS: 3,           // Толщина красной рамки выбора
    MULTIPLIER_SPACING: 30,      // Расстояние между множителями в списке
    TEXT_SIZE: 24                // Размер текста
  },
  
  // Генерация сценария
  GENERATION: {
    DEFAULT_SPIN_COUNT: 10,      // Количество спинов по умолчанию
    RANDOM_SELECTION: true        // Случайный выбор символа (true) или всегда первый (false)
  }
};

/**
 * Определяет тип символа по его ID
 * @param {number} symbolId - ID символа
 * @returns {'blank' | 'win' | 'multiplier'}
 */
export function getSymbolType(symbolId) {
  if (symbolId === CONFIG.SYMBOL_TYPES.BLANK) {
    return 'blank';
  }
  if (symbolId >= CONFIG.SYMBOL_TYPES.WIN_MIN && symbolId <= CONFIG.SYMBOL_TYPES.WIN_MAX) {
    return 'win';
  }
  if (symbolId >= CONFIG.SYMBOL_TYPES.MULTIPLIER_MIN && symbolId <= CONFIG.SYMBOL_TYPES.MULTIPLIER_MAX) {
    return 'multiplier';
  }
  return 'blank'; // По умолчанию пустышка
}

/**
 * Получает значение выигрыша для символа
 * @param {number} symbolId - ID символа (1-10)
 * @returns {number} - Сумма выигрыша
 */
export function getWinAmount(symbolId) {
  if (symbolId >= CONFIG.SYMBOL_TYPES.WIN_MIN && symbolId <= CONFIG.SYMBOL_TYPES.WIN_MAX) {
    return symbolId * CONFIG.BASE_BET;
  }
  return 0;
}

/**
 * Получает значение множителя для символа
 * @param {number} symbolId - ID символа (11+)
 * @returns {number} - Значение множителя
 */
export function getMultiplierValue(symbolId) {
  if (symbolId >= CONFIG.SYMBOL_TYPES.MULTIPLIER_MIN && symbolId <= CONFIG.SYMBOL_TYPES.MULTIPLIER_MAX) {
    return symbolId - CONFIG.SYMBOL_TYPES.MULTIPLIER_MIN + 2; // 11 = x2, 12 = x3, ...
  }
  return 0;
}

/**
 * Генерирует случайный символ согласно вероятностям
 * @returns {number} - ID символа
 */
export function generateRandomSymbol() {
  const rand = Math.random();
  
  if (rand < CONFIG.PROBABILITIES.BLANK) {
    return CONFIG.SYMBOL_TYPES.BLANK;
  }
  
  if (rand < CONFIG.PROBABILITIES.BLANK + CONFIG.PROBABILITIES.WIN) {
    // Равномерное распределение между WIN_MIN и WIN_MAX
    const winRange = CONFIG.SYMBOL_TYPES.WIN_MAX - CONFIG.SYMBOL_TYPES.WIN_MIN + 1;
    return CONFIG.SYMBOL_TYPES.WIN_MIN + Math.floor(Math.random() * winRange);
  }
  
  // Множители
  const multiplierRange = CONFIG.SYMBOL_TYPES.MULTIPLIER_MAX - CONFIG.SYMBOL_TYPES.MULTIPLIER_MIN + 1;
  return CONFIG.SYMBOL_TYPES.MULTIPLIER_MIN + Math.floor(Math.random() * multiplierRange);
}

/**
 * Вычисляет итоговый выигрыш с учетом множителей
 * @param {number} winAmount - Базовая сумма выигрыша
 * @param {number[]} multipliers - Массив множителей
 * @returns {number} - Итоговый выигрыш
 */
export function calculateTotalWin(winAmount, multipliers) {
  if (multipliers.length === 0) {
    return winAmount;
  }
  
  const totalMultiplier = multipliers.reduce((acc, mult) => acc * mult, 1);
  return winAmount * totalMultiplier;
}
