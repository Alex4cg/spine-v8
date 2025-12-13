export class DebugPositionEditor {
  constructor(app, slotMachine) {
    this.app = app;
    this.slotMachine = slotMachine;
    this.currentElement = null;
    this.elements = {};
    this.panel = null;
    this.enabled = false;
    this.debugFilePath = slotMachine.config?.debug?.positionsFilePath || './debug_position/debug_positions.json';
    this.allSettings = null; // Кэш всех настроек
    
    this.init();
  }
  
  init() {
    console.log('DebugPositionEditor: Initializing...');
    
    // Создаем панель отладки
    this.createPanel();
    
    // Регистрируем элементы для отладки
    this.registerElements();
    
    console.log('DebugPositionEditor: Panel created, toggle button should be visible');
    
    // Загружаем сохраненные значения из файла после небольшой задержки
    // чтобы все элементы были готовы
    setTimeout(async () => {
      await this.loadSavedValues();
    }, 100);
  }
  
  createPanel() {
    // Убеждаемся, что body готов
    if (!document.body) {
      console.error('DebugPositionEditor: document.body not ready');
      setTimeout(() => this.createPanel(), 100);
      return;
    }
    
    // Создаем видимую кнопку для открытия панели
    this.toggleButton = document.createElement('button');
    this.toggleButton.textContent = '🔧 Debug';
    this.toggleButton.id = 'debug-toggle-button';
    this.toggleButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: 2px solid #45a049;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      transition: all 0.2s;
    `;
    this.toggleButton.addEventListener('mouseenter', () => {
      this.toggleButton.style.background = '#45a049';
    });
    this.toggleButton.addEventListener('mouseleave', () => {
      this.toggleButton.style.background = '#4CAF50';
    });
    this.toggleButton.addEventListener('click', () => {
      this.enabled = !this.enabled;
      this.panel.style.display = this.enabled ? 'block' : 'none';
      this.toggleButton.textContent = this.enabled ? '✕ Close' : '🔧 Debug';
      if (this.enabled) {
        this.updateElementList();
      }
    });
    document.body.appendChild(this.toggleButton);
    console.log('DebugPositionEditor: Toggle button added to DOM');
    
    // Создаем панель отладки
    this.panel = document.createElement('div');
    this.panel.id = 'debug-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    
    // Заголовок
    const title = document.createElement('div');
    title.textContent = '🔧 Position Debugger';
    title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;';
    this.panel.appendChild(title);
    
    // Выбор элемента
    const selectLabel = document.createElement('div');
    selectLabel.textContent = 'Select Element:';
    selectLabel.style.marginBottom = '5px';
    this.panel.appendChild(selectLabel);
    
    this.elementSelect = document.createElement('select');
    this.elementSelect.style.cssText = `
      width: 100%;
      padding: 5px;
      background: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      margin-bottom: 15px;
    `;
    this.elementSelect.addEventListener('change', (e) => {
      this.selectElement(e.target.value).catch(err => console.error('Error selecting element:', err));
    });
    this.panel.appendChild(this.elementSelect);
    
    // Контролы позиции и масштаба
    this.createControl('X Position:', 'x', -2000, 2000, 1, true);
    this.createControl('Y Position:', 'y', -2000, 2000, 1, true);
    this.createControl('Scale:', 'scale', 0.1, 5, 0.01, true);
    this.createControl('Z Index:', 'zIndex', 0, 1000, 1, true);
    
    // Кнопки действий
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 5px; margin-top: 10px;';
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = 'flex: 1; padding: 5px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;';
    resetBtn.addEventListener('click', () => this.resetCurrentElement());
    buttonContainer.appendChild(resetBtn);
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'flex: 1; padding: 5px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
    saveBtn.addEventListener('click', () => this.saveValues());
    buttonContainer.appendChild(saveBtn);
    
    this.panel.appendChild(buttonContainer);
    
    document.body.appendChild(this.panel);
  }
  
  createControl(label, property, min, max, step = 1, showArrows = false) {
    const container = document.createElement('div');
    container.style.marginBottom = '10px';
    
    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.marginBottom = '3px';
    container.appendChild(labelEl);
    
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'display: flex; gap: 5px; align-items: center;';
    
    // Кнопка уменьшения (стрелка влево)
    if (showArrows) {
      const decBtn = document.createElement('button');
      decBtn.textContent = '◄';
      decBtn.style.cssText = `
        padding: 4px 8px;
        background: #555;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        min-width: 30px;
      `;
      decBtn.addEventListener('click', () => {
        const currentValue = parseFloat(input.value);
        const newValue = Math.max(min, currentValue - step);
        input.value = newValue;
        const decimals = property === 'scale' ? 2 : 0;
        valueDisplay.textContent = newValue.toFixed(decimals);
        this.updateElementProperty(property, newValue);
      });
      inputContainer.appendChild(decBtn);
    }
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.style.cssText = 'flex: 1;';
    input.dataset.property = property;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = 'min-width: 60px; text-align: right; font-weight: bold;';
    valueDisplay.dataset.property = property;
    
    input.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      // Форматирование: для scale - 2 знака, для остального - целые числа
      const decimals = property === 'scale' ? 2 : 0;
      valueDisplay.textContent = value.toFixed(decimals);
      this.updateElementProperty(property, value);
    });
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(valueDisplay);
    
    // Кнопка увеличения (стрелка вправо)
    if (showArrows) {
      const incBtn = document.createElement('button');
      incBtn.textContent = '►';
      incBtn.style.cssText = `
        padding: 4px 8px;
        background: #555;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        min-width: 30px;
      `;
      incBtn.addEventListener('click', () => {
        const currentValue = parseFloat(input.value);
        const newValue = Math.min(max, currentValue + step);
        input.value = newValue;
        const decimals = property === 'scale' ? 2 : 0;
        valueDisplay.textContent = newValue.toFixed(decimals);
        this.updateElementProperty(property, newValue);
      });
      inputContainer.appendChild(incBtn);
    }
    
    container.appendChild(inputContainer);
    this.panel.appendChild(container);
    
    // Сохраняем ссылки на элементы
    if (!this.controls) this.controls = {};
    this.controls[property] = { input, valueDisplay };
  }
  
  registerElements() {
    // Регистрируем элементы для отладки
    this.elements = {
      'reelsContainer': {
        name: 'Reels Container (with Frame & Mask)',
        getElement: () => this.slotMachine.reelsContainer,
        defaultValues: { x: 0, y: 0, scale: 1, zIndex: 100 },
        // Дополнительные элементы для трансформации вместе с reelsContainer
        getRelatedElements: () => [
          this.slotMachine.gameMask,
          this.slotMachine.gameFrame
        ].filter(el => el !== null && el !== undefined)
      },
      'train': {
        name: 'Train Spine Container',
        getElement: () => {
          // Возвращаем контейнер поезда, а не сам спайн
          return this.slotMachine.spineAnimations.train?.getContainer();
        },
        defaultValues: { x: 960, y: 236, scale: 1, zIndex: 90 }
      },
      'logo': {
        name: 'Logo Spine Container',
        getElement: () => {
          // Возвращаем контейнер logo, а не сам спайн
          return this.slotMachine.spineAnimations.logo?.getContainer();
        },
        defaultValues: { x: 960, y: 275, scale: 1, zIndex: 250 }
      },
      'effectsContainer': {
        name: 'Effects Container',
        getElement: () => this.slotMachine.effectsContainer,
        defaultValues: { x: 0, y: 22, scale: 1, zIndex: 200 }
      },
      'spinButton': {
        name: 'Spin Button',
        getElement: () => {
          // Возвращаем контейнер кнопки (оба спрайта внутри)
          return this.slotMachine.spinButton?.getButton();
        },
        defaultValues: { 
          x: this.slotMachine.config?.spinButton?.position?.x || 960, 
          y: this.slotMachine.config?.spinButton?.position?.y || 1000, 
          scale: 1, 
          zIndex: this.slotMachine.config?.spinButton?.zIndex || 300 
        }
      }
    };
    
    // Регистрируем фоновые элементы
    if (this.slotMachine.bgElements) {
      const bgDefaults = {
        bg_desktop_reg: { x: 960, y: 540, scale: 1, zIndex: 10 },
        field: { x: 960, y: 540, scale: 1, zIndex: 95 },
        jp: { x: 960, y: 540, scale: 1, zIndex: 30 },
        top: { x: 960, y: 540, scale: 1, zIndex: 40 }
      };
      
      for (const [key, sprite] of Object.entries(this.slotMachine.bgElements)) {
        if (sprite) {
          this.elements[`bg_${key}`] = {
            name: `BG: ${key}`,
            getElement: () => sprite,
            defaultValues: bgDefaults[key] || { x: 960, y: 540, scale: 1, zIndex: 50 }
          };
        }
      }
    }
  }
  
  updateElementList() {
    // Перерегистрируем элементы (на случай если фоновые элементы загрузились позже)
    this.registerElements();
    
    this.elementSelect.innerHTML = '';
    
    for (const [key, elementInfo] of Object.entries(this.elements)) {
      const element = elementInfo.getElement();
      if (element) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = elementInfo.name;
        this.elementSelect.appendChild(option);
      }
    }
    
      // Выбираем первый элемент по умолчанию
      if (this.elementSelect.options.length > 0) {
        this.elementSelect.value = this.elementSelect.options[0].value;
        this.selectElement(this.elementSelect.value).catch(e => console.error('Error selecting element:', e));
      }
  }
  
  async selectElement(key) {
    const elementInfo = this.elements[key];
    if (!elementInfo) return;
    
    const element = elementInfo.getElement();
    if (!element) {
      console.warn(`Element ${key} not found`);
      return;
    }
    
    this.currentElement = { key, element, elementInfo };
    
    // Загружаем настройки из файла или localStorage
    await this.loadAllSettings();
    
    // Используем сохраненные значения или текущие значения элемента, или значения по умолчанию
    let values;
    if (this.allSettings && this.allSettings[key]) {
      values = this.allSettings[key];
    } else {
      // Fallback: проверяем localStorage
      const savedKey = `debug_${key}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          values = JSON.parse(saved);
        } catch (e) {
          console.warn(`Failed to parse saved values for ${key}:`, e);
          values = elementInfo.defaultValues;
        }
      } else {
        // Если нет сохраненных значений, используем текущие значения элемента
        values = {
          x: element.x,
          y: element.y,
          scale: element.scale ? element.scale.x : elementInfo.defaultValues.scale,
          zIndex: element.zIndex !== undefined ? element.zIndex : elementInfo.defaultValues.zIndex
        };
      }
    }
    
    // Применяем значения (поддерживаем обратную совместимость со старыми сохранениями)
    const scaleValue = values.scale !== undefined ? values.scale : (values.scaleX !== undefined ? values.scaleX : elementInfo.defaultValues.scale);
    const zIndexValue = values.zIndex !== undefined ? values.zIndex : (element.zIndex !== undefined ? element.zIndex : elementInfo.defaultValues.zIndex);
    
    element.x = values.x !== undefined ? values.x : elementInfo.defaultValues.x;
    element.y = values.y !== undefined ? values.y : elementInfo.defaultValues.y;
    element.scale.x = scaleValue;
    element.scale.y = scaleValue;
    element.zIndex = zIndexValue;
    
    // Для train контейнер уже на stage, просто убеждаемся что sortableChildren включен
    if (key === 'train') {
      // Убеждаемся, что stage имеет sortableChildren
      if (this.slotMachine.app.stage.sortableChildren !== undefined) {
        this.slotMachine.app.stage.sortableChildren = true;
      }
    }
    
    // Применяем трансформации к связанным элементам (mask и frame для reelsContainer)
    const relatedElements = elementInfo.getRelatedElements ? elementInfo.getRelatedElements() : [];
    if (relatedElements.length > 0) {
      // Сохраняем начальные позиции связанных элементов при первом выборе
      if (!this.relatedElementsInitialPositions) {
        this.relatedElementsInitialPositions = {};
      }
      if (!this.relatedElementsInitialPositions[key]) {
        this.relatedElementsInitialPositions[key] = relatedElements.map(el => ({
          x: el ? el.x : 0,
          y: el ? el.y : 0,
          scale: el && el.scale ? el.scale.x : 1
        }));
      }
      
      // Применяем трансформации
      const offsetX = values.x - elementInfo.defaultValues.x;
      const offsetY = values.y - elementInfo.defaultValues.y;
      
      relatedElements.forEach((related, index) => {
        if (related) {
          const initialPos = this.relatedElementsInitialPositions[key][index];
          related.x = initialPos.x + offsetX;
          related.y = initialPos.y + offsetY;
          
          if (related.scale) {
            related.scale.x = scaleValue;
            related.scale.y = scaleValue;
          }
        }
      });
    }
    
    // Обновляем контролы
    this.controls.x.input.value = element.x;
    this.controls.x.valueDisplay.textContent = element.x.toFixed(0);
    this.controls.y.input.value = element.y;
    this.controls.y.valueDisplay.textContent = element.y.toFixed(0);
    this.controls.scale.input.value = scaleValue;
    this.controls.scale.valueDisplay.textContent = scaleValue.toFixed(2);
    this.controls.zIndex.input.value = element.zIndex;
    this.controls.zIndex.valueDisplay.textContent = element.zIndex.toFixed(0);
    
    console.log(`Selected element ${key}, zIndex: ${element.zIndex}`);
  }
  
  updateElementProperty(property, value) {
    if (!this.currentElement) return;
    
    const { element, elementInfo } = this.currentElement;
    if (!element) return;
    
    // Получаем связанные элементы (mask и frame для reelsContainer)
    const relatedElements = elementInfo.getRelatedElements ? elementInfo.getRelatedElements() : [];
    
    if (property === 'x' || property === 'y') {
      element[property] = value;
      // Применяем ту же трансформацию к связанным элементам
      relatedElements.forEach(related => {
        if (related) {
          // Вычисляем смещение относительно начальной позиции
          const currentValue = element[property];
          const defaultValue = elementInfo.defaultValues[property];
          const offset = currentValue - defaultValue;
          
          // Применяем смещение к связанному элементу
          if (!this.relatedElementsInitialPositions) {
            this.relatedElementsInitialPositions = {};
          }
          const key = this.currentElement.key;
          if (!this.relatedElementsInitialPositions[key]) {
            this.relatedElementsInitialPositions[key] = relatedElements.map(el => ({
              x: el.x,
              y: el.y
            }));
          }
          const index = relatedElements.indexOf(related);
          const initialPos = this.relatedElementsInitialPositions[key][index];
          related[property] = initialPos[property] + offset;
        }
      });
    } else if (property === 'scale') {
      // Пропорциональное масштабирование
      element.scale.x = value;
      element.scale.y = value;
      // Применяем тот же масштаб к связанным элементам
      relatedElements.forEach(related => {
        if (related && related.scale) {
          related.scale.x = value;
          related.scale.y = value;
        }
      });
    } else if (property === 'zIndex') {
      element.zIndex = value;
      console.log(`Setting zIndex for ${this.currentElement.key} to ${value}`);
      
      // Обновляем сортировку в родительском контейнере
      if (element.parent) {
        if (element.parent.sortableChildren !== undefined) {
          element.parent.sortableChildren = true;
        }
        // Для элементов на stage используем глобальную сортировку
        if (element.parent === this.app.stage) {
          this.app.stage.sortChildren();
        } else {
          element.parent.sortChildren();
        }
      }
    }
  }
  
  resetCurrentElement() {
    if (!this.currentElement) return;
    
    const { elementInfo } = this.currentElement;
    const values = elementInfo.defaultValues;
    
    this.controls.x.input.value = values.x;
    this.controls.y.input.value = values.y;
    this.controls.scale.input.value = values.scale;
    this.controls.zIndex.input.value = values.zIndex;
    
    // Сбрасываем начальные позиции связанных элементов
    const relatedElements = elementInfo.getRelatedElements ? elementInfo.getRelatedElements() : [];
    if (relatedElements.length > 0 && this.relatedElementsInitialPositions) {
      const key = this.currentElement.key;
      if (this.relatedElementsInitialPositions[key]) {
        relatedElements.forEach((related, index) => {
          if (related) {
            const initialPos = this.relatedElementsInitialPositions[key][index];
            related.x = initialPos.x;
            related.y = initialPos.y;
            if (related.scale) {
              related.scale.x = values.scale;
              related.scale.y = values.scale;
            }
          }
        });
      }
    }
    
    this.updateElementProperty('x', values.x);
    this.updateElementProperty('y', values.y);
    this.updateElementProperty('scale', values.scale);
    this.updateElementProperty('zIndex', values.zIndex);
    
    // Обновляем отображение
    this.controls.x.valueDisplay.textContent = values.x.toFixed(0);
    this.controls.y.valueDisplay.textContent = values.y.toFixed(0);
    this.controls.scale.valueDisplay.textContent = values.scale.toFixed(2);
    this.controls.zIndex.valueDisplay.textContent = values.zIndex.toFixed(0);
  }
  
  async saveValues() {
    if (!this.currentElement) return;
    
    // Собираем текущие значения всех элементов
    const allCurrentSettings = {};
    
    for (const [key, elementInfo] of Object.entries(this.elements)) {
      const element = elementInfo.getElement();
      if (element) {
        const currentZIndex = element.zIndex !== undefined ? element.zIndex : elementInfo.defaultValues.zIndex;
        allCurrentSettings[key] = {
          x: element.x,
          y: element.y,
          scale: element.scale ? element.scale.x : 1,
          zIndex: currentZIndex
        };
        
        // Также сохраняем в localStorage для совместимости
        localStorage.setItem(`debug_${key}`, JSON.stringify(allCurrentSettings[key]));
      }
    }
    
    // Обновляем кэш
    this.allSettings = allCurrentSettings;
    
    // Скачиваем обновленный файл
    this.downloadSettingsFile(this.allSettings);
    
    console.log(`Saved all debug positions:`, this.allSettings);
    console.log('Settings file downloaded. Please save it to slots/slot_1/debug_positions.json');
    
    // Показываем уведомление
    const notification = document.createElement('div');
    notification.textContent = '✓ Saved! File downloaded';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #4CAF50;
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 18px;
      font-weight: bold;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }
  
  async loadSavedValues() {
    // Загружаем настройки из файла
    await this.loadAllSettings();
    
    // Применяем загруженные настройки к элементам
    for (const [key, elementInfo] of Object.entries(this.elements)) {
      const element = elementInfo.getElement();
      if (!element) continue;
      
      let values = null;
      
      // Сначала пробуем загрузить из файла
      if (this.allSettings && this.allSettings[key]) {
        values = this.allSettings[key];
        console.log(`Loaded saved values for ${key} from file:`, values);
      } else {
        // Fallback на localStorage (для обратной совместимости)
        const savedKey = `debug_${key}`;
        const saved = localStorage.getItem(savedKey);
        if (saved) {
          try {
            values = JSON.parse(saved);
            console.log(`Loaded saved values for ${key} from localStorage:`, values);
          } catch (e) {
            console.warn(`Failed to parse saved values for ${key}:`, e);
            continue;
          }
        }
      }
      
      if (values) {
        // СНАЧАЛА обрабатываем связанные элементы (до применения сдвига к основному элементу)
        const relatedElements = elementInfo.getRelatedElements ? elementInfo.getRelatedElements() : [];
        if (relatedElements.length > 0) {
          // Сохраняем начальные позиции связанных элементов ПЕРЕД применением сдвига к основному элементу
          if (!this.relatedElementsInitialPositions) {
            this.relatedElementsInitialPositions = {};
          }
          if (!this.relatedElementsInitialPositions[key]) {
            this.relatedElementsInitialPositions[key] = relatedElements.map(el => ({
              x: el ? el.x : 0,
              y: el ? el.y : 0,
              scale: el && el.scale ? el.scale.x : 1
            }));
          }
        }
        
        // Теперь применяем значения к основному элементу
        element.x = values.x;
        element.y = values.y;
        // Поддержка обратной совместимости: scale или scaleX/scaleY
        const scaleValue = values.scale !== undefined ? values.scale : 
                          (values.scaleX !== undefined ? values.scaleX : elementInfo.defaultValues.scale);
        element.scale.x = scaleValue;
        element.scale.y = scaleValue;
        
        if (values.zIndex !== undefined) {
          element.zIndex = values.zIndex;
          
          // Обновляем сортировку в родительском контейнере
          if (element.parent && element.parent.sortableChildren !== undefined) {
            element.parent.sortableChildren = true;
            element.parent.sortChildren();
          }
        }
        
        // Теперь применяем трансформации к связанным элементам
        if (relatedElements.length > 0) {
          // Применяем трансформации к связанным элементам
          const offsetX = values.x - elementInfo.defaultValues.x;
          const offsetY = values.y - elementInfo.defaultValues.y;
          
          relatedElements.forEach((related, index) => {
            if (related) {
              const initialPos = this.relatedElementsInitialPositions[key][index];
              related.x = initialPos.x + offsetX;
              related.y = initialPos.y + offsetY;
              
              if (related.scale) {
                related.scale.x = scaleValue;
                related.scale.y = scaleValue;
              }
            }
          });
        }
      }
    }
  }
  
  async loadAllSettings() {
    // Если уже загружены - возвращаем кэш
    if (this.allSettings !== null) {
      return this.allSettings;
    }
    
    try {
      // Пробуем загрузить из файла
      const response = await fetch(this.debugFilePath);
      if (response.ok) {
        this.allSettings = await response.json();
        console.log('Loaded debug positions from file:', this.debugFilePath);
        return this.allSettings;
      }
    } catch (e) {
      console.warn('Failed to load debug positions from file, trying localStorage:', e);
    }
    
    // Fallback: собираем из localStorage или используем значения по умолчанию
    this.allSettings = {};
    for (const [key, elementInfo] of Object.entries(this.elements)) {
      const savedKey = `debug_${key}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          this.allSettings[key] = JSON.parse(saved);
        } catch (e) {
          // Используем значения по умолчанию
          this.allSettings[key] = elementInfo.defaultValues;
        }
      } else {
        // Используем значения по умолчанию
        this.allSettings[key] = elementInfo.defaultValues;
      }
    }
    
    return this.allSettings;
  }
  
  downloadSettingsFile(settings) {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug_positions.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  destroy() {
    if (this.toggleButton) {
      this.toggleButton.remove();
    }
    if (this.panel) {
      this.panel.remove();
    }
  }
}

