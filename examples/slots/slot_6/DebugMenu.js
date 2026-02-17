// Модуль для создания раскрывающегося меню настроек для slot_6
const DEBUG_POSITIONS_PATH = './debug_positions.json';

export function createDebugMenu(app, elements, config) {
  let currentElement = null;
  let positionControls = {};
  const elementList = {};
  let elementSelect = null;
  let updateElementListFn = null;
  let allSettings = null;
  
  // Загружаем настройки при инициализации (асинхронно, не блокируем создание UI)
  loadAllSettings().catch(e => console.warn('Failed to load settings on init:', e));
  
  // Создаем кнопку переключения
  const toggleButton = document.createElement('button');
  toggleButton.id = 'debug-toggle-button';
  toggleButton.textContent = '🔧 Debug';
  toggleButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  document.body.appendChild(toggleButton);
  
  // Создаем панель настроек
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'debug-panel';
  controlsPanel.style.cssText = `
    position: fixed;
    top: 50px;
    right: 10px;
    width: 280px;
    max-height: calc(100vh - 70px);
    overflow-y: auto;
    background: rgba(26, 26, 46, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    padding: 15px;
    z-index: 9999;
    display: none;
    color: white;
    font-size: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;
  document.body.appendChild(controlsPanel);
  
  // Переключение видимости панели
  let isPanelVisible = false;
  toggleButton.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    controlsPanel.style.display = isPanelVisible ? 'block' : 'none';
  });
  
  // Функция применения значений к элементу
  function applyValuesToElement(element, values, defaultValues, options = {}) {
    if (!element) return;
    // Используем значения из values, если они есть, иначе из defaultValues
    let x = values && values.x !== undefined ? values.x : (defaultValues ? defaultValues.x : 0);
    let y = values && values.y !== undefined ? values.y : (defaultValues ? defaultValues.y : 0);
    if (options.worldToLocalParent) {
      const parent = options.worldToLocalParent;
      x = x - (parent.x || 0);
      y = y - (parent.y || 0);
    }
    element.x = x;
    element.y = y;
    const scaleVal = values && values.scale !== undefined ? values.scale : (defaultValues ? defaultValues.scale : 1);
    if (element.scale) {
      element.scale.x = scaleVal;
      element.scale.y = scaleVal;
    }
    if (values && values.zIndex !== undefined) {
      element.zIndex = values.zIndex;
    } else if (defaultValues && defaultValues.zIndex !== undefined) {
      element.zIndex = defaultValues.zIndex;
    }
  }
  
  // Функция получения позиции элемента
  function getDisplayPosition(info) {
    const el = info.element;
    if (!el) return { x: 0, y: 0 };
    if (info.parentKey && elementList[info.parentKey] && elementList[info.parentKey].element) {
      const parent = elementList[info.parentKey].element;
      return { x: (el.x || 0) + (parent.x || 0), y: (el.y || 0) + (parent.y || 0) };
    }
    return { x: el.x || 0, y: el.y || 0 };
  }
  
  // Функции загрузки настроек
  async function loadAllSettings(forceReload = false) {
    if (allSettings !== null && !forceReload) {
      console.log('loadAllSettings: Using cached settings');
      return allSettings;
    }
    
    // Пытаемся загрузить из файла
    try {
      const response = await fetch(DEBUG_POSITIONS_PATH);
      if (response.ok) {
        allSettings = await response.json();
        console.log('loadAllSettings: Successfully loaded debug positions from', DEBUG_POSITIONS_PATH);
        console.log('loadAllSettings: Loaded settings:', allSettings);
        // Если файл загружен успешно, не перезаписываем значения из localStorage
        return allSettings;
      } else {
        console.warn('loadAllSettings: File not found or not ok, status:', response.status);
      }
    } catch (e) {
      console.warn('loadAllSettings: Failed to load debug_positions.json:', e.message);
    }
    
    // Если файл не загрузился, используем localStorage
    console.log('loadAllSettings: Falling back to localStorage');
    allSettings = {};
    // Загружаем все настройки из localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('debug_') && key !== 'debug_checkboxes') {
        const elementKey = key.replace('debug_', '');
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            allSettings[elementKey] = JSON.parse(raw);
          } catch (_) {
            if (elementList[elementKey]) {
              allSettings[elementKey] = elementList[elementKey].defaultValues;
            }
          }
        }
      }
    }
    // Для элементов из elementList, которых нет в localStorage, используем defaultValues
    // НО только если файл не был загружен (чтобы не перезаписывать значения из файла)
    for (const [key, info] of Object.entries(elementList)) {
      if (!allSettings[key] && info.defaultValues) {
        allSettings[key] = info.defaultValues;
      }
    }
    console.log('loadAllSettings: Final settings from localStorage/defaults:', allSettings);
    return allSettings;
  }
  
  async function loadSavedValues() {
    await loadAllSettings();
    console.log('loadSavedValues: Applying settings to', Object.keys(elementList).length, 'elements');
    console.log('loadSavedValues: Available settings keys:', Object.keys(allSettings));
    console.log('loadSavedValues: All settings:', JSON.stringify(allSettings, null, 2));
    
    // Сначала применяем значения к элементам без parentKey
    for (const [key, info] of Object.entries(elementList)) {
      if (info.parentKey) continue;
      if (!info.element) {
        console.warn(`loadSavedValues: Element ${key} has no element reference`);
        continue;
      }
      const values = allSettings[key];
      if (!values) {
        console.log(`loadSavedValues: No saved values for ${key}, using defaults:`, info.defaultValues);
        if (info.defaultValues) {
          applyValuesToElement(info.element, null, info.defaultValues);
        }
        continue;
      }
      console.log(`loadSavedValues: Applying saved values to ${key}:`, values, 'defaults:', info.defaultValues);
      applyValuesToElement(info.element, values, info.defaultValues);
      console.log(`loadSavedValues: ✓ Applied to ${key} - x=${info.element.x}, y=${info.element.y}, scale=${info.element.scale?.x}, zIndex=${info.element.zIndex}`);
    }
    
    // Затем применяем значения к элементам с parentKey
    for (const [key, info] of Object.entries(elementList)) {
      if (!info.parentKey) continue;
      if (!info.element) continue;
      const values = allSettings[key];
      if (!values) continue;
      const parentEl = elementList[info.parentKey] && elementList[info.parentKey].element;
      console.log(`loadSavedValues: Applying to ${key} (with parent ${info.parentKey}):`, values);
      applyValuesToElement(info.element, values, info.defaultValues, parentEl ? { worldToLocalParent: parentEl } : {});
    }
    
    if (app && app.stage && app.stage.sortableChildren) app.stage.sortChildren();
    if (currentElement && positionControls && positionControls.x) {
      const pos = getDisplayPosition(currentElement.info);
      positionControls.x.input.value = pos.x;
      positionControls.x.valueDisplay.textContent = pos.x.toFixed(0);
      positionControls.y.input.value = pos.y;
      positionControls.y.valueDisplay.textContent = pos.y.toFixed(0);
      const el = currentElement.info.element;
      const scaleVal = el.scale ? el.scale.x : 1;
      positionControls.scale.input.value = scaleVal;
      positionControls.scale.valueDisplay.textContent = scaleVal.toFixed(2);
      positionControls.zIndex.input.value = el.zIndex ?? 0;
      positionControls.zIndex.valueDisplay.textContent = (el.zIndex ?? 0).toFixed(0);
    }
    console.log('loadSavedValues: ✓ All values applied');
  }
  
  if (app && elements) {
    const positionDivider = document.createElement('div');
    positionDivider.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);';
    
    const positionTitle = document.createElement('div');
    positionTitle.textContent = '🔧 Position Debugger';
    positionTitle.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;';
    positionDivider.appendChild(positionTitle);
    
    // Селектор элементов
    const selectLabel = document.createElement('div');
    selectLabel.textContent = 'Select Element:';
    selectLabel.style.cssText = 'margin-bottom: 5px; font-size: 11px;';
    positionDivider.appendChild(selectLabel);
    
    elementSelect = document.createElement('select');
    elementSelect.style.cssText = 'width: 100%; padding: 4px; margin-bottom: 15px; background: white; color: black; border-radius: 3px;';
    elementSelect.addEventListener('change', (e) => {
      selectElement(e.target.value);
    });
    positionDivider.appendChild(elementSelect);
    
    // Функция обновления списка элементов
    updateElementListFn = () => {
      elementSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '-- Select --';
      elementSelect.appendChild(option);
      for (const [key, info] of Object.entries(elementList)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = info.name;
        elementSelect.appendChild(option);
      }
    };
    
    // Функция выбора элемента
    function selectElement(key) {
      if (!key || !elementList[key]) {
        currentElement = null;
        return;
      }
      currentElement = {
        key,
        info: elementList[key]
      };
      const pos = getDisplayPosition(currentElement.info);
      const el = currentElement.info.element;
      const scaleVal = el.scale ? el.scale.x : 1;
      const zIndexVal = el.zIndex ?? 0;
      
      if (positionControls.x) {
        positionControls.x.input.value = pos.x;
        positionControls.x.valueDisplay.textContent = pos.x.toFixed(0);
        positionControls.y.input.value = pos.y;
        positionControls.y.valueDisplay.textContent = pos.y.toFixed(0);
        positionControls.scale.input.value = scaleVal;
        positionControls.scale.valueDisplay.textContent = scaleVal.toFixed(2);
        positionControls.zIndex.input.value = zIndexVal;
        positionControls.zIndex.valueDisplay.textContent = zIndexVal.toFixed(0);
      }
    }
    
    // Функция создания контрола позиции
    function createPositionControl(label, property, min, max, step) {
      const container = document.createElement('div');
      container.style.cssText = 'margin-bottom: 10px;';
      
      const labelEl = document.createElement('div');
      labelEl.textContent = label;
      labelEl.style.cssText = 'font-size: 11px; margin-bottom: 3px;';
      container.appendChild(labelEl);
      
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 5px;';
      
      const decBtn = document.createElement('button');
      decBtn.textContent = '◄';
      decBtn.style.cssText = 'width: 25px; height: 25px; padding: 0; border: 1px solid #ccc; background: rgba(255,255,255,0.2); color: white; cursor: pointer; border-radius: 3px;';
      decBtn.addEventListener('click', () => {
        const input = positionControls[property].input;
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
      input.style.cssText = 'flex: 1;';
      input.addEventListener('input', (e) => {
        updateProperty(property, parseFloat(e.target.value));
      });
      row.appendChild(input);
      
      const valueDisplay = document.createElement('span');
      valueDisplay.style.cssText = 'min-width: 50px; text-align: right; font-size: 11px;';
      row.appendChild(valueDisplay);
      
      const incBtn = document.createElement('button');
      incBtn.textContent = '►';
      incBtn.style.cssText = 'width: 25px; height: 25px; padding: 0; border: 1px solid #ccc; background: rgba(255,255,255,0.2); color: white; cursor: pointer; border-radius: 3px;';
      incBtn.addEventListener('click', () => {
        const input = positionControls[property].input;
        const value = Math.min(max, parseFloat(input.value) + step);
        input.value = value;
        updateProperty(property, value);
      });
      row.appendChild(incBtn);
      
      container.appendChild(row);
      positionDivider.appendChild(container);
      
      positionControls[property] = { input, valueDisplay };
    }
    
    // Создаем контролы позиции
    createPositionControl('X Position:', 'x', -2000, 2000, 1);
    createPositionControl('Y Position:', 'y', -2000, 2000, 1);
    createPositionControl('Scale:', 'scale', 0.1, 5, 0.01);
    createPositionControl('Z Index:', 'zIndex', 0, 1000, 1);
    
    // Функция обновления свойства
    function updateProperty(property, value) {
      if (!currentElement) return;
      const element = currentElement.info.element;
      const info = currentElement.info;
      
      if (property === 'x' || property === 'y') {
        if (info.parentKey && elementList[info.parentKey] && elementList[info.parentKey].element) {
          const parent = elementList[info.parentKey].element;
          element[property] = value - (parent[property] || 0);
        } else {
          element[property] = value;
        }
      } else if (property === 'scale') {
        if (element.scale) {
          element.scale.x = value;
          element.scale.y = value;
        }
      } else if (property === 'zIndex') {
        element.zIndex = value;
      }
      
      if (app && app.stage && app.stage.sortableChildren) app.stage.sortChildren();
      
      positionControls[property].valueDisplay.textContent = 
        property === 'scale' ? value.toFixed(2) : value.toFixed(0);
    }
    
    // Кнопки Reset и Save
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = 'padding: 6px 12px; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; cursor: pointer; font-size: 11px;';
    resetBtn.addEventListener('click', () => resetCurrentElement());
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    saveBtn.addEventListener('click', () => saveValues());
    
    buttonRow.appendChild(resetBtn);
    buttonRow.appendChild(saveBtn);
    positionDivider.appendChild(buttonRow);
    
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
      if (app && app.stage && app.stage.sortableChildren) app.stage.sortChildren();
      positionControls.x.input.value = values.x;
      positionControls.x.valueDisplay.textContent = values.x.toFixed(0);
      positionControls.y.input.value = values.y;
      positionControls.y.valueDisplay.textContent = values.y.toFixed(0);
      positionControls.scale.input.value = values.scale;
      positionControls.scale.valueDisplay.textContent = values.scale.toFixed(2);
      positionControls.zIndex.input.value = values.zIndex;
      positionControls.zIndex.valueDisplay.textContent = values.zIndex.toFixed(0);
    }
    
    function saveValues() {
      const settings = {};
      for (const [key, info] of Object.entries(elementList)) {
        if (info.element) {
          const pos = getDisplayPosition(info);
          settings[key] = {
            x: pos.x,
            y: pos.y,
            scale: info.element.scale ? info.element.scale.x : info.defaultValues.scale,
            zIndex: info.element.zIndex !== undefined ? info.element.zIndex : info.defaultValues.zIndex
          };
          localStorage.setItem(`debug_${key}`, JSON.stringify(settings[key]));
        }
      }
      allSettings = settings;
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debug_positions.json';
      a.click();
      URL.revokeObjectURL(url);
      const notification = document.createElement('div');
      notification.textContent = '✓ Saved! Replace slot_6/debug_positions.json with downloaded file.';
      notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:16px 24px;border-radius:8px;z-index:10001;font-size:12px;';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    
    controlsPanel.appendChild(positionDivider);
    
    // Инициализация списка элементов
    updateElementListFn();
    
    // Загружаем сохраненные значения
    loadSavedValues().catch(e => console.warn('Failed to load saved values:', e));
  }
  
  return {
    toggleButton,
    controlsPanel,
    addElement: async (key, name, element, defaultValues, parentKey = null) => {
      elementList[key] = { name, element, defaultValues, parentKey };
      // Загружаем настройки если еще не загружены
      if (allSettings === null) {
        await loadAllSettings();
      }
      // Применяем сохраненные значения, если они есть, иначе дефолтные
      const savedValues = allSettings && allSettings[key];
      const parentEl = parentKey && elementList[parentKey] && elementList[parentKey].element;
      if (savedValues) {
        console.log(`addElement: Applying saved values to ${key}:`, savedValues);
        applyValuesToElement(element, savedValues, defaultValues, parentEl ? { worldToLocalParent: parentEl } : {});
        console.log(`addElement: Applied to ${key} - x=${element.x}, y=${element.y}, scale=${element.scale?.x}, zIndex=${element.zIndex}`);
      } else if (defaultValues) {
        // Если сохраненных значений нет, применяем дефолтные
        console.log(`addElement: Using defaults for ${key}:`, defaultValues);
        applyValuesToElement(element, null, defaultValues, parentEl ? { worldToLocalParent: parentEl } : {});
      }
      if (updateElementListFn) {
        updateElementListFn();
      }
    },
    reloadAllSettings: async () => {
      allSettings = null;
      await loadAllSettings(true);
      await loadSavedValues();
    }
  };
}
