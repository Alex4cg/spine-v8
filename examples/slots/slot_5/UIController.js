/**
 * Контроллер для управления UI элементами
 */
import { CONFIG, loadDelays, saveDelay } from './config.js';

export class UIController {
  /**
   * Инициализирует поля ввода задержек и устанавливает обработчики событий
   * @param {Object} callbacks - Объект с колбэками для обновления значений в CascadeManager
   * @returns {Object} Объект с текущими значениями задержек
   */
  static initDelayInputs(callbacks = {}) {
    // Загружаем значения из localStorage
    const delays = loadDelays();
    
    // Получаем элементы ввода
    const rowDelayInput = document.getElementById('row-delay-input');
    const columnDelayInput = document.getElementById('column-delay-input');
    const newMatrixDelayInput = document.getElementById('new-matrix-delay-input');
    const oldRowDelayInput = document.getElementById('old-row-delay-input');
    const oldColumnDelayInput = document.getElementById('old-column-delay-input');
    const fallSpeedInput = document.getElementById('fall-speed-input');
    
    // Устанавливаем начальные значения
    rowDelayInput.value = delays.rowDelay;
    columnDelayInput.value = delays.columnDelay;
    newMatrixDelayInput.value = delays.newMatrixDelay;
    oldRowDelayInput.value = delays.oldRowDelay;
    oldColumnDelayInput.value = delays.oldColumnDelay;
    if (fallSpeedInput) fallSpeedInput.value = delays.fallSpeed;
    
    // Создаем объект для хранения текущих значений
    const currentDelays = {
      rowDelay: delays.rowDelay,
      columnDelay: delays.columnDelay,
      newMatrixDelay: delays.newMatrixDelay,
      oldRowDelay: delays.oldRowDelay,
      oldColumnDelay: delays.oldColumnDelay,
      fallSpeed: delays.fallSpeed
    };
    
    // Обработчик для Row Delay
    rowDelayInput.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 2) {
        currentDelays.rowDelay = newValue;
        saveDelay(CONFIG.STORAGE_KEYS.ROW_DELAY, newValue);
        if (callbacks.onRowDelayChange) {
          callbacks.onRowDelayChange(newValue);
        }
      }
    });
    
    // Обработчик для Column Delay
    columnDelayInput.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 2) {
        currentDelays.columnDelay = newValue;
        saveDelay(CONFIG.STORAGE_KEYS.COLUMN_DELAY, newValue);
        if (callbacks.onColumnDelayChange) {
          callbacks.onColumnDelayChange(newValue);
        }
      }
    });
    
    // Обработчик для New Matrix Delay
    newMatrixDelayInput.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 2) {
        currentDelays.newMatrixDelay = newValue;
        saveDelay(CONFIG.STORAGE_KEYS.NEW_MATRIX_DELAY, newValue);
        if (callbacks.onNewMatrixDelayChange) {
          callbacks.onNewMatrixDelayChange(newValue);
        }
      }
    });
    
    // Обработчик для Old Row Delay
    oldRowDelayInput.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 2) {
        currentDelays.oldRowDelay = newValue;
        saveDelay(CONFIG.STORAGE_KEYS.OLD_ROW_DELAY, newValue);
        if (callbacks.onOldRowDelayChange) {
          callbacks.onOldRowDelayChange(newValue);
        }
      }
    });
    
    // Обработчик для Old Column Delay
    oldColumnDelayInput.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 2) {
        currentDelays.oldColumnDelay = newValue;
        saveDelay(CONFIG.STORAGE_KEYS.OLD_COLUMN_DELAY, newValue);
        if (callbacks.onOldColumnDelayChange) {
          callbacks.onOldColumnDelayChange(newValue);
        }
      }
    });
    
    // Обработчик для скорости падения
    if (fallSpeedInput) {
      fallSpeedInput.addEventListener('input', (e) => {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue) && newValue >= 100 && newValue <= 3000) {
          currentDelays.fallSpeed = newValue;
          saveDelay(CONFIG.STORAGE_KEYS.FALL_SPEED, newValue);
          if (callbacks.onFallSpeedChange) {
            callbacks.onFallSpeedChange(newValue);
          }
        }
      });
    }
    
    return currentDelays;
  }

  /**
   * Инициализирует обработчик кнопки спин
   * @param {HTMLElement} spinButton - Элемент кнопки спин
   * @param {CascadeManager} grid - Экземпляр CascadeManager
   */
  static initSpinButton(spinButton, grid) {
    spinButton.onclick = async (e) => {
      // Если режим сценария активен, проверяем что есть шаг спина
      if (grid.scenarioMode && grid.currentScenario) {
        const step = grid.getCurrentScenarioStep();
        if (!step || step.event !== 'spin') {
          console.warn('⚠️ Нет доступного шага спина в сценарии');
          return;
        }
      }
      
      // Обновляем текст кнопки сразу
      spinButton.textContent = 'SPINNING...';
      
      try {
        // Если анимация уже идет - явно сбрасываем её перед началом новой
        if (grid.isSpinning) {
          console.log('🔄 Анимация активна, сбрасываем и запускаем заново...');
          grid.reset();
          // Небольшая задержка для гарантированного завершения сброса
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Запускаем новую анимацию (использует данные из сценария если режим активен)
        await grid.cascade();
        
        // После завершения cascade() анимация уже должна быть завершена
        spinButton.textContent = 'SPIN';
        
      } catch (error) {
        console.error('Ошибка при выполнении каскада:', error);
        // При ошибке сбрасываем состояние
        grid.reset();
        spinButton.textContent = 'SPIN';
      }
    };
  }
}
