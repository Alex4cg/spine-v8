/**
 * Конфигурация каскадной слот-игры
 */
export const CONFIG = {
  // Размеры приложения (под размер текстуры bg_scale.png)
  APP_WIDTH: 722,
  APP_HEIGHT: 1283,
  
  // Конфигурация сетки
  GRID: {
    COLS: 6,              // Количество колонок
    ROWS: 5,              // Количество рядов
    SYMBOL_SIZE: 112,     // Размер ячейки (контейнера) в пикселях
    SYMBOL_TEXTURE_SIZE: 112, // Размер текстуры символа в пикселях
    START_Y: 200,         // Отступ сверху для начала сетки
    FALL_SPEED: 800       // Скорость падения символов (пикселей в секунду)
  },
  
  // Задержки анимации (значения по умолчанию)
  DELAYS: {
    ROW: 0.21,            // Задержка между символами в колонке (сек)
    COLUMN: 0.11,         // Задержка между колонками (сек)
    NEW_MATRIX: 0.1,     // Пауза перед стартом новой матрицы (сек)
    OLD_ROW: 0.15,        // Задержка между строками для старых символов (сек)
    OLD_COLUMN: 0.08      // Задержка между колонками для старых символов (сек)
  },
  
  // Пути и файлы текстур (только с индексами)
  ASSETS: {
    SYMBOL_TEXTURES_PATH: './sym_st/',
    SYMBOL_TEXTURE_FILES: [
      'h1_lion.png',        // индекс 0
      'h2_bull.png',        // индекс 1
      'h3_bear.png',        // индекс 2
      'h4_wolf.png',        // индекс 3
      'l1_revolver.png',    // индекс 4
      'l2_bottle.png',      // индекс 5
      'l3_horseshoe.png',   // индекс 6
      'l4_cactus.png',      // индекс 7
      'bomb_regular.png',   // Бомба (индекс 8)
      '+1fs_blue.png',      // Скаттер синий (индекс 9)
      '+1fs_gold.png',      // Скаттер золотой (индекс 10)
      '+1fs_red.png',       // Скаттер красный (индекс 11)
    ],
    PAYOUTS_PATH: './payouts.json'
  },
  
  // Стили шрифтов (FontManager)
  FONTS: {
    STYLES: {
      win_amount: {
        fontFamily: 'The Bomb Sound',
        fontSize: 56.192,
        fontWeight: 400,
        twoLayer: true,
        layer1Color: '#FFFF00',
        layer1BorderColor: '#2D1B0E',
        layer1BorderWidth: 2,
        layer2Color: '#DE6400',
        layer2BorderColor: '#49051E',
        layer2BorderWidth: 10,
        layerOffsetY: 4
      },
      x20: {
        fontFamily: 'GAMERIA',
        fontSize: 65,
        fontWeight: 400,
        color: '#FFFFFF',
        borderColor: '#4D0000',
        borderWidth: 10,
        lineHeight: 65  // 100% как в Figma
      },
      x2000: {
        fontFamily: 'GAMERIA',
        fontSize: 37,
        fontWeight: 400,
        color: '#FFFFFF',
        borderColor: '#150604',
        borderWidth: 8  // как у X20, чтобы обводка выглядела соразмерно
      }
    }
  },

  // Ключи для localStorage
  STORAGE_KEYS: {
    ROW_DELAY: 'rowDelay',
    COLUMN_DELAY: 'columnDelay',
    NEW_MATRIX_DELAY: 'newMatrixDelay',
    OLD_ROW_DELAY: 'oldRowDelay',
    OLD_COLUMN_DELAY: 'oldColumnDelay',
    FALL_SPEED: 'fallSpeed'
  }
};

/**
 * Загружает значения задержек из localStorage или возвращает значения по умолчанию
 * @returns {Object} Объект с задержками
 */
export function loadDelays() {
  return {
    rowDelay: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.ROW_DELAY)) || CONFIG.DELAYS.ROW,
    columnDelay: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.COLUMN_DELAY)) || CONFIG.DELAYS.COLUMN,
    newMatrixDelay: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.NEW_MATRIX_DELAY)) || CONFIG.DELAYS.NEW_MATRIX,
    oldRowDelay: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.OLD_ROW_DELAY)) || CONFIG.DELAYS.OLD_ROW,
    oldColumnDelay: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.OLD_COLUMN_DELAY)) || CONFIG.DELAYS.OLD_COLUMN,
    fallSpeed: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.FALL_SPEED)) || CONFIG.GRID.FALL_SPEED
  };
}

/**
 * Сохраняет значение задержки в localStorage
 * @param {string} key - Ключ задержки (из STORAGE_KEYS)
 * @param {number} value - Значение для сохранения
 */
export function saveDelay(key, value) {
  if (key === CONFIG.STORAGE_KEYS.FALL_SPEED) {
    if (!isNaN(value) && value >= 100 && value <= 3000) {
      localStorage.setItem(key, value.toString());
    }
    return;
  }
  if (value >= 0 && value <= 2 && !isNaN(value)) {
    localStorage.setItem(key, value.toString());
  }
}
