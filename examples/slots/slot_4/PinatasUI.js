/**
 * PinatasUI.js - Модуль для создания и управления UI пиньят
 */

/**
 * Создает HTML структуру для всех пиньят на основе конфигурации
 * @param {Object} config - Конфигурация из pinatas-config.json
 * @param {HTMLElement} controlsContainer - Контейнер для размещения UI
 */
export function createPinatasUI(config, controlsContainer) {
  if (!controlsContainer) {
    console.warn('⚠️ Контейнер для UI не найден');
    return;
  }
  
  config.pinatas.forEach((pinataConfig, index) => {
    // Создаем контейнер для пиньяты
    const pinataControls = document.createElement('div');
    pinataControls.className = 'pinata-controls';
    pinataControls.setAttribute('data-pinata-id', pinataConfig.id);
    if (index > 0) {
      pinataControls.style.marginLeft = '10px'; // Отступ между блоками слева направо
    }
    
    // Заголовок (уменьшенный)
    const title = document.createElement('h3');
    title.textContent = `${pinataConfig.name} (${pinataConfig.skin})`;
    title.style.cssText = 'color: white; font-size: 12px; margin-bottom: 8px; font-weight: 600;';
    pinataControls.appendChild(title);
    
    // Группа кнопок (вертикально)
    const buttonsGroup = document.createElement('div');
    buttonsGroup.className = 'animation-buttons-group';
    
    // Создаем кнопки на основе конфигурации
    config.animationButtons.forEach(buttonConfig => {
      const button = document.createElement('button');
      button.className = `animation-button ${buttonConfig.class}`;
      button.textContent = buttonConfig.label;
      button.setAttribute('data-pinata-id', pinataConfig.id);
      
      if (buttonConfig.animation) {
        button.setAttribute('data-animation', buttonConfig.animation);
      }
      if (buttonConfig.sequence) {
        button.setAttribute('data-sequence', buttonConfig.sequence);
      }
      
      buttonsGroup.appendChild(button);
    });
    
    pinataControls.appendChild(buttonsGroup);
    
    // Индикатор уровня убран для компактности
    
    controlsContainer.appendChild(pinataControls);
  });
}

/**
 * Обновляет индикатор уровня и соотношения для конкретной пиньяты
 * @param {number} pinataId - ID пиньяты
 * @param {Array} pinataManagers - Массив менеджеров пиньят
 */
export function updateLevelInfo(pinataId, pinataManagers) {
  const manager = pinataManagers[pinataId];
  if (!manager) return;
  
  const levelElement = document.querySelector(`.current-level[data-pinata-id="${pinataId}"]`);
  const ratioElement = document.querySelector(`.current-ratio[data-pinata-id="${pinataId}"]`);
  
  if (levelElement && ratioElement) {
    levelElement.textContent = manager.getCurrentLevel();
    ratioElement.textContent = manager.getCurrentRatioDisplay();
  }
}

/**
 * Настраивает автоматическое обновление индикаторов уровня при изменении уровня
 * @param {Array} pinataManagers - Массив менеджеров пиньят
 */
export function setupLevelInfoUpdaters(pinataManagers) {
  // Обновляем индикаторы при инициализации
  pinataManagers.forEach((manager, index) => {
    updateLevelInfo(index, pinataManagers);
  });
  
  // Перехватываем setLevel для обновления индикаторов
  pinataManagers.forEach((manager, index) => {
    const originalSetLevel = manager.setLevel.bind(manager);
    manager.setLevel = function(newLevel) {
      originalSetLevel(newLevel);
      updateLevelInfo(index, pinataManagers);
    };
  });
}

/**
 * Настраивает обработчики событий для всех кнопок анимаций
 * @param {Array} pinataManagers - Массив менеджеров пиньят
 * @param {Object} uiConfig - Конфигурация UI из pinatas-config.json
 */
export function setupAnimationButtons(pinataManagers, uiConfig) {
  const animationButtons = document.querySelectorAll('.animation-button');
  animationButtons.forEach(button => {
    button.addEventListener('click', () => {
      const pinataId = parseInt(button.dataset.pinataId);
      const manager = pinataManagers[pinataId];
      
      if (!manager) {
        console.warn(`⚠️ Менеджер для пиньяты ${pinataId} не найден`);
        return;
      }
      
      const animationName = button.dataset.animation;
      const sequence = button.dataset.sequence;
      
      if (sequence === 'idle-hit-idle') {
        // Последовательность из конфигурации
        manager.playAnimationSequence(
          uiConfig.testSequence.animations,
          uiConfig.testSequence.trackIndex,
          uiConfig.testSequence.startDelay
        );
      } else if (animationName) {
        manager.playOneshotAnimation(animationName, 0, 0.25);
      }
    });
  });
}

/**
 * Показывает контейнер с контролами
 * @param {HTMLElement} controlsContainer - Контейнер для отображения
 */
export function showControlsContainer(controlsContainer) {
  if (controlsContainer) {
    controlsContainer.style.display = 'flex';
  }
}
