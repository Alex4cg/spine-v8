/**
 * Контроллер для управления UI элементами
 */
import { CONFIG, loadDelays, saveDelay } from './config.js';
import { SoundManager } from './SoundManager.js';

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
    let spinButtonTimer = null;
    
    spinButton.onclick = async (e) => {
      SoundManager.playClick();
      // Блокируем кнопку сразу при начале спина
      spinButton.disabled = true;
      spinButton.textContent = 'SPINNING...';
      
      // Очищаем предыдущий таймер если есть
      if (spinButtonTimer) {
        clearTimeout(spinButtonTimer);
        spinButtonTimer = null;
      }
      
      // Если режим сценария активен, перед спином переходим на следующий шаг если сейчас spin/cascade
      if (grid.scenarioMode && grid.currentScenario) {
        // Если currentScenarioStep = -1, это первое нажатие - устанавливаем первый спин
        if (grid.currentScenarioStep < 0) {
          const firstSpinIndex = grid.findNextSpinStep();
          if (firstSpinIndex < 0) {
            console.warn('⚠️ Нет доступного шага спина в сценарии');
            spinButtonTimer = setTimeout(() => {
              spinButton.disabled = false;
              spinButton.textContent = 'SPIN';
              spinButtonTimer = null;
            }, 2000);
            return;
          }
          grid.currentScenarioStep = firstSpinIndex;
          console.log(`📋 [SCENARIO] Первое нажатие: переход на шаг ${firstSpinIndex + 1}/${grid.currentScenario.length} (${grid.currentScenario[firstSpinIndex].event})`);
        } else {
          const currentStep = grid.getCurrentScenarioStep();
          if (currentStep && (currentStep.event === 'spin' || currentStep.event === 'bomb' || currentStep.event === 'cascade')) {
            // Мы на шаге ожидания спина — по нажатию переходим на следующий шаг и крутим спин (закольцовывание)
            const nextIndex = (grid.currentScenarioStep + 1) % grid.currentScenario.length;
            grid.currentScenarioStep = nextIndex;
            console.log(`📋 [SCENARIO] Нажатие спин: переход на шаг ${nextIndex + 1}/${grid.currentScenario.length}`);
          } else if (!currentStep || (currentStep.event !== 'spin' && currentStep.event !== 'spin-win' && currentStep.event !== 'bomb' && currentStep.event !== 'bomb-win')) {
            const nextSpinIndex = grid.findNextSpinStep();
            if (nextSpinIndex < 0) {
              // Закольцовывание: переходим на начало
              grid.currentScenarioStep = 0;
              console.log(`📋 [SCENARIO] Закольцовывание: переход к шагу 1/${grid.currentScenario.length}`);
            } else {
              grid.currentScenarioStep = nextSpinIndex;
              console.log(`📋 [SCENARIO] Переход к спину: шаг ${nextSpinIndex + 1}/${grid.currentScenario.length}`);
            }
          }
        }
      }
      
      try {
        // Если анимация уже идет - явно сбрасываем её перед началом новой
        if (grid.isSpinning) {
          console.log('🔄 Анимация активна, сбрасываем и запускаем заново...');
          grid.reset();
          // Небольшая задержка для гарантированного завершения сброса
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Запускаем новую анимацию (использует данные из сценария если режим активен)
        // Блокировка кнопки происходит в CascadeManager через _blockSpinButton() при начале спина
        await grid.cascade();
        
      } catch (error) {
        console.error('Ошибка при выполнении каскада:', error);
        // При ошибке сбрасываем состояние
        grid.reset();
        // Очищаем таймер и разблокируем кнопку через таймер
        if (spinButtonTimer) {
          clearTimeout(spinButtonTimer);
          spinButtonTimer = null;
        }
        // Разблокируем через таймер для единообразия
        spinButtonTimer = setTimeout(() => {
          spinButton.disabled = false;
          spinButton.textContent = 'SPIN';
          spinButtonTimer = null;
        }, 2000);
      }
    };
    
    // Сохраняем ссылку на таймер для использования в CascadeManager
    grid._spinButtonTimer = () => spinButtonTimer;
    grid._blockSpinButton = () => {
      if (spinButtonTimer) {
        clearTimeout(spinButtonTimer);
        spinButtonTimer = null;
      }
      spinButton.disabled = true;
      spinButton.textContent = 'SPINNING...';
      spinButtonTimer = setTimeout(() => {
        spinButton.disabled = false;
        spinButton.textContent = 'SPIN';
        spinButtonTimer = null;
      }, 2000);
    };
  }
}
