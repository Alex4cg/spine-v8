// Функция создания дебаггера позиций
export function createDebugEditor(app, elements, config) {
  let enabled = false;
  let currentElement = null;
  let controls = {};
  let allSettings = null; // Кэш всех настроек
  const debugFilePath = './slots/slot_4/debug_positions.json';
  
  // Создаем кнопку переключения
  const toggleButton = document.createElement('button');
  toggleButton.id = 'debug-toggle-button';
  toggleButton.textContent = '🔧 Debug';
  toggleButton.addEventListener('click', () => {
    enabled = !enabled;
    panel.style.display = enabled ? 'block' : 'none';
    toggleButton.textContent = enabled ? '✕ Close' : '🔧 Debug';
    if (enabled) {
      updateElementList();
    }
  });
  document.body.appendChild(toggleButton);
  
  // Создаем панель
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  
  const title = document.createElement('div');
  title.textContent = '🔧 Position Debugger';
  title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;';
  panel.appendChild(title);
  
  // Выбор элемента
  const selectLabel = document.createElement('div');
  selectLabel.textContent = 'Select Element:';
  selectLabel.style.marginBottom = '5px';
  panel.appendChild(selectLabel);
  
  const elementSelect = document.createElement('select');
  elementSelect.addEventListener('change', async (e) => {
    await selectElement(e.target.value);
  });
  panel.appendChild(elementSelect);
  
  // Контролы
  createControl('X Position:', 'x', -2000, 2000, 1);
  createControl('Y Position:', 'y', -2000, 2000, 1);
  createControl('Scale:', 'scale', 0.1, 5, 0.01);
  createControl('Z Index:', 'zIndex', 0, 1000, 1);
  
  // Кнопки
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  
  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-btn';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => resetCurrentElement());
  buttonGroup.appendChild(resetBtn);
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => saveValues());
  buttonGroup.appendChild(saveBtn);
  
  panel.appendChild(buttonGroup);
  document.body.appendChild(panel);
  
  // Регистрируем элементы
  const elementList = {};
  
  // Динамически добавляем все пиньяты (pinata1, pinata2, pinata3, pinata4, ...)
  for (let i = 1; i <= 10; i++) {
    const pinataKey = `pinata${i}`;
    if (elements[pinataKey]) {
      // Вычисляем xOffset на основе номера пиньяты (примерно -150, -50, 50, 150 для 4 пиньят)
      const xOffset = (i - 1) * 100 - 150; // Для 4 пиньят: -150, -50, 50, 150
      elementList[pinataKey] = {
        name: `Pinata ${i}`,
        element: elements[pinataKey],
        defaultValues: { x: config.width / 2 + xOffset, y: config.height / 2, scale: 1, zIndex: 3 }
      };
    }
  }
  
  // Обратная совместимость: если есть старая pinata, добавляем её
  if (elements.pinata && !elements.pinata1) {
    elementList['pinata'] = {
      name: 'Pinata',
      element: elements.pinata,
      defaultValues: { x: config.width / 2, y: config.height / 2, scale: 1, zIndex: 3 }
    };
  }
  
  // Добавляем остальные элементы
  if (elements.bgSprite) {
    elementList['bg'] = {
      name: 'Background',
      element: elements.bgSprite,
      defaultValues: { x: 0, y: 0, scale: 1, zIndex: 0 }
    };
  }
  
  if (elements.topSprite) {
    elementList['top'] = {
      name: 'Top Sprite',
      element: elements.topSprite,
      defaultValues: { x: 0, y: 0, scale: 1, zIndex: 2 }
    };
  }
  
  function createControl(label, property, min, max, step) {
    const container = document.createElement('div');
    container.className = 'control-group';
    
    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    container.appendChild(labelEl);
    
    const row = document.createElement('div');
    row.className = 'control-row';
    
    const decBtn = document.createElement('button');
    decBtn.textContent = '◄';
    decBtn.addEventListener('click', () => {
      const input = controls[property].input;
      const value = Math.max(min, parseFloat(input.value) - step);
      input.value = value;
      updateProperty(property, value);
    });
    row.appendChild(decBtn);
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('input', (e) => {
      updateProperty(property, parseFloat(e.target.value));
    });
    row.appendChild(input);
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
    row.appendChild(valueDisplay);
    
    const incBtn = document.createElement('button');
    incBtn.textContent = '►';
    incBtn.addEventListener('click', () => {
      const input = controls[property].input;
      const value = Math.min(max, parseFloat(input.value) + step);
      input.value = value;
      updateProperty(property, value);
    });
    row.appendChild(incBtn);
    
    container.appendChild(row);
    panel.appendChild(container);
    
    controls[property] = { input, valueDisplay };
  }
  
  async function updateElementList() {
    // Обновляем ссылки на элементы
    // Обновляем элементы, если они были изменены
    // Динамически обновляем все пиньяты
    for (let i = 1; i <= 10; i++) {
      const pinataKey = `pinata${i}`;
      if (elements[pinataKey] && elementList[pinataKey]) {
        elementList[pinataKey].element = elements[pinataKey];
      }
    }
    // Обратная совместимость
    if (elements.pinata && elementList.pinata) {
      elementList.pinata.element = elements.pinata;
    }
    if (elements.bgSprite && elementList.bg) {
      elementList.bg.element = elements.bgSprite;
    }
    if (elements.topSprite && elementList.top) {
      elementList.top.element = elements.topSprite;
    }
    
    elementSelect.innerHTML = '';
    for (const [key, info] of Object.entries(elementList)) {
      if (info.element) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = info.name;
        elementSelect.appendChild(option);
      }
    }
    if (elementSelect.options.length > 0) {
      await selectElement(elementSelect.options[0].value);
    }
  }
  
  async function loadSavedValues() {
    // Загружаем настройки из файла
    await loadAllSettings();
    
    // Применяем загруженные настройки к элементам
    for (const [key, info] of Object.entries(elementList)) {
      const element = info.element;
      if (!element) continue;
      
      let values = null;
      
      // Сначала пробуем загрузить из файла
      if (allSettings && allSettings[key]) {
        values = allSettings[key];
        console.log(`Loaded saved values for ${key} from file:`, values);
      } else {
        // Fallback на localStorage
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
        // Применяем значения к элементу
        element.x = values.x !== undefined ? values.x : info.defaultValues.x;
        element.y = values.y !== undefined ? values.y : info.defaultValues.y;
        const scaleValue = values.scale !== undefined ? values.scale : info.defaultValues.scale;
        if (element.scale) {
          element.scale.x = scaleValue;
          element.scale.y = scaleValue;
        }
        if (values.zIndex !== undefined) {
          element.zIndex = values.zIndex;
          if (app.stage.sortableChildren !== undefined) {
            app.stage.sortableChildren = true;
            app.stage.sortChildren();
          }
        }
      }
    }
  }
  
  async function loadAllSettings() {
    // Если уже загружены - возвращаем кэш
    if (allSettings !== null) {
      return allSettings;
    }
    
    try {
      // Пробуем загрузить из файла
      const response = await fetch(debugFilePath);
      if (response.ok) {
        allSettings = await response.json();
        console.log('Loaded debug positions from file:', debugFilePath);
        return allSettings;
      }
    } catch (e) {
      console.warn('Failed to load debug positions from file, trying localStorage:', e);
    }
    
    // Fallback: собираем из localStorage или используем значения по умолчанию
    allSettings = {};
    for (const [key, info] of Object.entries(elementList)) {
      const savedKey = `debug_${key}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          allSettings[key] = JSON.parse(saved);
        } catch (e) {
          // Используем значения по умолчанию
          allSettings[key] = info.defaultValues;
        }
      } else {
        // Используем значения по умолчанию
        allSettings[key] = info.defaultValues;
      }
    }
    
    return allSettings;
  }

  async function selectElement(key) {
    const info = elementList[key];
    if (!info || !info.element) return;
    
    // Загружаем настройки из файла
    await loadAllSettings();
    
    currentElement = { key, info };
    const element = info.element;
    
    // Используем сохраненные значения из файла или localStorage, или текущие значения элемента
    let values;
    if (allSettings && allSettings[key]) {
      values = allSettings[key];
      console.log(`Loaded saved values for ${key} from file:`, values);
    } else {
      // Fallback на localStorage
      const saved = localStorage.getItem(`debug_${key}`);
      if (saved) {
        try {
          values = JSON.parse(saved);
          console.log(`Loaded saved values for ${key} from localStorage:`, values);
        } catch (e) {
          values = {
            x: element.x,
            y: element.y,
            scale: element.scale ? element.scale.x : info.defaultValues.scale,
            zIndex: element.zIndex !== undefined ? element.zIndex : info.defaultValues.zIndex
          };
        }
      } else {
        // Используем текущие значения элемента
        values = {
          x: element.x,
          y: element.y,
          scale: element.scale ? element.scale.x : info.defaultValues.scale,
          zIndex: element.zIndex !== undefined ? element.zIndex : info.defaultValues.zIndex
        };
      }
    }
    
    // Применяем значения
    element.x = values.x;
    element.y = values.y;
    if (element.scale) {
      element.scale.x = values.scale;
      element.scale.y = values.scale;
    }
    if (element.zIndex !== undefined) {
      element.zIndex = values.zIndex;
      app.stage.sortChildren();
    }
    
    // Обновляем контролы
    controls.x.input.value = element.x;
    controls.x.valueDisplay.textContent = element.x.toFixed(0);
    controls.y.input.value = element.y;
    controls.y.valueDisplay.textContent = element.y.toFixed(0);
    controls.scale.input.value = values.scale;
    controls.scale.valueDisplay.textContent = values.scale.toFixed(2);
    controls.zIndex.input.value = element.zIndex || 0;
    controls.zIndex.valueDisplay.textContent = (element.zIndex || 0).toFixed(0);
  }
  
  function updateProperty(property, value) {
    if (!currentElement) return;
    const element = currentElement.info.element;
    
    if (property === 'x' || property === 'y') {
      element[property] = value;
      controls[property].valueDisplay.textContent = value.toFixed(0);
    } else if (property === 'scale') {
      element.scale.x = value;
      element.scale.y = value;
      controls[property].valueDisplay.textContent = value.toFixed(2);
    } else if (property === 'zIndex') {
      element.zIndex = value;
      app.stage.sortChildren();
      controls[property].valueDisplay.textContent = value.toFixed(0);
    }
  }
  
  function resetCurrentElement() {
    if (!currentElement) return;
    const values = currentElement.info.defaultValues;
    const element = currentElement.info.element;
    
    element.x = values.x;
    element.y = values.y;
    if (element.scale) {
      element.scale.x = values.scale;
      element.scale.y = values.scale;
    }
    element.zIndex = values.zIndex;
    app.stage.sortChildren();
    
    controls.x.input.value = values.x;
    controls.x.valueDisplay.textContent = values.x.toFixed(0);
    controls.y.input.value = values.y;
    controls.y.valueDisplay.textContent = values.y.toFixed(0);
    controls.scale.input.value = values.scale;
    controls.scale.valueDisplay.textContent = values.scale.toFixed(2);
    controls.zIndex.input.value = values.zIndex;
    controls.zIndex.valueDisplay.textContent = values.zIndex.toFixed(0);
  }
  
  function saveValues() {
    // Собираем текущие значения всех элементов
    const settings = {};
    for (const [key, info] of Object.entries(elementList)) {
      if (info.element) {
        const element = info.element;
        const currentZIndex = element.zIndex !== undefined ? element.zIndex : info.defaultValues.zIndex;
        settings[key] = {
          x: element.x,
          y: element.y,
          scale: element.scale ? element.scale.x : 1,
          zIndex: currentZIndex
        };
        // Также сохраняем в localStorage для совместимости
        localStorage.setItem(`debug_${key}`, JSON.stringify(settings[key]));
      }
    }
    
    // Обновляем кэш
    allSettings = settings;
    
    // Скачиваем файл
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug_positions.json';
    a.click();
    URL.revokeObjectURL(url);
    
    // Уведомление
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
    
    console.log('Saved debug positions:', settings);
    console.log('Settings file downloaded. Please save it to slots/slot_4/debug_positions.json');
  }
  
  // Загружаем сохраненные значения из файла после небольшой задержки
  setTimeout(async () => {
    await loadSavedValues();
  }, 100);
  
  return { updateElementList };
}

