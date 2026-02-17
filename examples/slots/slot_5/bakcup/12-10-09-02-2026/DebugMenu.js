// Модуль для создания раскрывающегося меню настроек
const DEBUG_POSITIONS_PATH = './debug_positions.json';

export function createDebugMenu(app, elements, config) {
  let currentElement = null;
  let positionControls = {};
  const elementList = {};
  let elementSelect = null;
  let updateElementListFn = null;
  let allSettings = null;
  
  // Создаем кнопку переключения
  const toggleButton = document.createElement('button');
  toggleButton.id = 'controls-toggle-button';
  toggleButton.textContent = '🔧 Настройки';
  document.body.appendChild(toggleButton);
  
  // Создаем панель настроек
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'controls';
  
  // Функция создания поля ввода
  function createInputField(id, labelText, defaultValue = 0) {
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.style.cssText = 'display: block; margin-bottom: 5px;';
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.min = '0';
    input.max = '2';
    input.step = '0.01';
    input.value = defaultValue;
    input.style.cssText = 'width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; background: white; color: black; margin-bottom: 10px;';
    
    controlsPanel.appendChild(label);
    controlsPanel.appendChild(input);
    
    return input;
  }
  
  // Создаем поля ввода для задержек
  createInputField('row-delay-input', 'Row Delay (сек):');
  createInputField('column-delay-input', 'Column Delay (сек):');
  createInputField('new-matrix-delay-input', 'New Matrix Delay (сек):');
  
  // Секция Old Matrix
  const oldMatrixDiv = document.createElement('div');
  oldMatrixDiv.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);';
  
  const oldMatrixLabel = document.createElement('label');
  oldMatrixLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
  oldMatrixLabel.textContent = 'Old Matrix:';
  oldMatrixDiv.appendChild(oldMatrixLabel);
  
  // Создаем поля для Old Matrix напрямую в oldMatrixDiv
  const oldRowLabel = document.createElement('label');
  oldRowLabel.setAttribute('for', 'old-row-delay-input');
  oldRowLabel.style.cssText = 'display: block; margin-bottom: 5px;';
  oldRowLabel.textContent = 'Old Row Delay (сек):';
  
  const oldRowInput = document.createElement('input');
  oldRowInput.type = 'number';
  oldRowInput.id = 'old-row-delay-input';
  oldRowInput.min = '0';
  oldRowInput.max = '2';
  oldRowInput.step = '0.01';
  oldRowInput.style.cssText = 'width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; background: white; color: black; margin-bottom: 10px;';
  
  const oldColumnLabel = document.createElement('label');
  oldColumnLabel.setAttribute('for', 'old-column-delay-input');
  oldColumnLabel.style.cssText = 'display: block; margin-bottom: 5px;';
  oldColumnLabel.textContent = 'Old Column Delay (сек):';
  
  const oldColumnInput = document.createElement('input');
  oldColumnInput.type = 'number';
  oldColumnInput.id = 'old-column-delay-input';
  oldColumnInput.min = '0';
  oldColumnInput.max = '2';
  oldColumnInput.step = '0.01';
  oldColumnInput.style.cssText = 'width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; background: white; color: black;';
  
  oldMatrixDiv.appendChild(oldRowLabel);
  oldMatrixDiv.appendChild(oldRowInput);
  oldMatrixDiv.appendChild(oldColumnLabel);
  oldMatrixDiv.appendChild(oldColumnInput);
  
  controlsPanel.appendChild(oldMatrixDiv);
  
  // Секция скорости падения
  const fallSpeedDiv = document.createElement('div');
  fallSpeedDiv.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);';
  const fallSpeedLabel = document.createElement('label');
  fallSpeedLabel.setAttribute('for', 'fall-speed-input');
  fallSpeedLabel.style.cssText = 'display: block; margin-bottom: 5px;';
  fallSpeedLabel.textContent = 'Скорость падения (px/s):';
  const fallSpeedInput = document.createElement('input');
  fallSpeedInput.type = 'number';
  fallSpeedInput.id = 'fall-speed-input';
  fallSpeedInput.min = '100';
  fallSpeedInput.max = '3000';
  fallSpeedInput.step = '50';
  fallSpeedInput.style.cssText = 'width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; background: white; color: black;';
  fallSpeedDiv.appendChild(fallSpeedLabel);
  fallSpeedDiv.appendChild(fallSpeedInput);
  controlsPanel.appendChild(fallSpeedDiv);
  
  // Секция для управления позицией элементов (если переданы app и elements)
  let debugOverlayElements = [];
  let symbolDebugOverlayCallback = null;
  
  if (app && elements) {
    const positionDivider = document.createElement('div');
    positionDivider.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(255,255,255,0.5);';
    
    const positionTitle = document.createElement('div');
    positionTitle.textContent = '🔧 Position Debugger';
    positionTitle.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;';
    positionDivider.appendChild(positionTitle);
    
    // Галки: скрыть/показать
    const visibilityRow = document.createElement('div');
    visibilityRow.style.cssText = 'margin-bottom: 12px; font-size: 11px;';
    
    const labelStyle = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px; cursor: pointer;';
    
    const checkDebugOverlay = document.createElement('label');
    checkDebugOverlay.style.cssText = labelStyle;
    const inputDebugOverlay = document.createElement('input');
    inputDebugOverlay.id = 'debug-overlay-checkbox';
    inputDebugOverlay.type = 'checkbox';
    inputDebugOverlay.checked = true;
    inputDebugOverlay.addEventListener('change', () => {
      const visible = inputDebugOverlay.checked;
      debugOverlayElements.forEach(el => { if (el) el.visible = visible; });
      if (symbolDebugOverlayCallback) symbolDebugOverlayCallback(visible);
      saveCheckboxesToStorage();
    });
    checkDebugOverlay.appendChild(inputDebugOverlay);
    checkDebugOverlay.appendChild(document.createTextNode('Настроечные: зеленые квадраты символов, рамка поля, индексы'));
    visibilityRow.appendChild(checkDebugOverlay);
    
    let inputGidRef = null;
    if (elements.gidSprite) {
      const checkGid = document.createElement('label');
      checkGid.style.cssText = labelStyle;
      const inputGid = document.createElement('input');
      inputGid.id = 'gid-visible-checkbox';
      inputGid.type = 'checkbox';
      inputGid.checked = true;
      inputGidRef = inputGid;
      inputGid.addEventListener('change', () => {
        elements.gidSprite.visible = inputGid.checked;
        saveCheckboxesToStorage();
      });
      checkGid.appendChild(inputGid);
      checkGid.appendChild(document.createTextNode('Текстура Gid'));
      visibilityRow.appendChild(checkGid);
    }
    
    function saveCheckboxesToStorage() {
      const cb = {
        debugOverlay: !!document.getElementById('debug-overlay-checkbox')?.checked,
        gidVisible: !!document.getElementById('gid-visible-checkbox')?.checked
      };
      localStorage.setItem('debug_checkboxes', JSON.stringify(cb));
    }
    
    positionDivider.appendChild(visibilityRow);
    
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
    
    // Регистрируем элементы
    if (elements.bgSprite) {
      elementList['bg'] = {
        name: 'Background',
        element: elements.bgSprite,
        defaultValues: { x: 0, y: 0, scale: 1, zIndex: 0 }
      };
    }
    
    if (elements.gidSprite) {
      elementList['gid'] = {
        name: 'Gid',
        element: elements.gidSprite,
        defaultValues: { 
          x: config.width / 2, 
          y: config.height / 2, 
          scale: 1, 
          zIndex: 10 
        }
      };
    }

    if (elements.fieldRegularSprite) {
      elementList['fieldRegular'] = {
        name: 'Field Regular',
        element: elements.fieldRegularSprite,
        defaultValues: { x: 0, y: 0, scale: 1, zIndex: 25 }
      };
    }
    
    if (elements.gameFieldContainer) {
      elementList['gameField'] = {
        name: 'Game Field',
        element: elements.gameFieldContainer,
        defaultValues: { 
          x: 0, 
          y: 0, 
          scale: 1, 
          zIndex: 50 
        }
      };
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
      app.stage.sortChildren();
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
          const el = info.element;
          settings[key] = {
            x: el.x ?? info.defaultValues.x,
            y: el.y ?? info.defaultValues.y,
            scale: el.scale ? el.scale.x : info.defaultValues.scale,
            zIndex: el.zIndex !== undefined ? el.zIndex : info.defaultValues.zIndex
          };
          localStorage.setItem(`debug_${key}`, JSON.stringify(settings[key]));
        }
      }
      const debugOverlayEl = document.getElementById('debug-overlay-checkbox');
      const gidVisibleEl = document.getElementById('gid-visible-checkbox');
      settings.checkboxes = {
        debugOverlay: debugOverlayEl ? debugOverlayEl.checked : true,
        gidVisible: gidVisibleEl ? gidVisibleEl.checked : true
      };
      localStorage.setItem('debug_checkboxes', JSON.stringify(settings.checkboxes));
      allSettings = settings;
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debug_positions.json';
      a.click();
      URL.revokeObjectURL(url);
      const notification = document.createElement('div');
      notification.textContent = '✓ Saved! Replace slot_5/debug_positions.json with downloaded file.';
      notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:16px 24px;border-radius:8px;z-index:10001;font-size:12px;';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2500);
    }
    
    // Функция выбора элемента
    function selectElement(key) {
      const info = elementList[key];
      if (!info || !info.element) return;
      
      currentElement = { key, info };
      const element = info.element;
      
      // Обновляем контролы
      positionControls.x.input.value = element.x || 0;
      positionControls.x.valueDisplay.textContent = (element.x || 0).toFixed(0);
      positionControls.y.input.value = element.y || 0;
      positionControls.y.valueDisplay.textContent = (element.y || 0).toFixed(0);
      const scaleValue = element.scale ? (element.scale.x || 1) : 1;
      positionControls.scale.input.value = scaleValue;
      positionControls.scale.valueDisplay.textContent = scaleValue.toFixed(2);
      const zIndexValue = element.zIndex !== undefined ? element.zIndex : info.defaultValues.zIndex;
      positionControls.zIndex.input.value = zIndexValue;
      positionControls.zIndex.valueDisplay.textContent = zIndexValue.toFixed(0);
    }
    
    // Функция обновления свойства
    function updateProperty(property, value) {
      if (!currentElement) return;
      const element = currentElement.info.element;
      
      if (property === 'x' || property === 'y') {
        element[property] = value;
        positionControls[property].valueDisplay.textContent = value.toFixed(0);
      } else if (property === 'scale') {
        if (element.scale) {
          element.scale.x = value;
          element.scale.y = value;
        }
        positionControls[property].valueDisplay.textContent = value.toFixed(2);
      } else if (property === 'zIndex') {
        element.zIndex = value;
        app.stage.sortChildren();
        positionControls[property].valueDisplay.textContent = value.toFixed(0);
      }
      // Автосохранение в localStorage при изменении
      const key = currentElement.key;
      const saved = { x: element.x, y: element.y, scale: element.scale ? element.scale.x : 1, zIndex: element.zIndex };
      localStorage.setItem(`debug_${key}`, JSON.stringify(saved));
    }
    
    function applyValuesToElement(element, values, defaultValues) {
      if (!element) return;
      element.x = values.x !== undefined ? values.x : defaultValues.x;
      element.y = values.y !== undefined ? values.y : defaultValues.y;
      const scaleVal = values.scale !== undefined ? values.scale : defaultValues.scale;
      if (element.scale) {
        element.scale.x = scaleVal;
        element.scale.y = scaleVal;
      }
      if (values.zIndex !== undefined) element.zIndex = values.zIndex;
    }
    
    async function loadAllSettings() {
      if (allSettings !== null) return allSettings;
      try {
        const response = await fetch(DEBUG_POSITIONS_PATH);
        if (response.ok) {
          allSettings = await response.json();
          console.log('Loaded debug positions from', DEBUG_POSITIONS_PATH);
          return allSettings;
        }
      } catch (e) {
        console.warn('Failed to load debug_positions.json, using localStorage or defaults:', e);
      }
      allSettings = {};
      for (const [key, info] of Object.entries(elementList)) {
        const raw = localStorage.getItem(`debug_${key}`);
        if (raw) {
          try {
            allSettings[key] = JSON.parse(raw);
          } catch (_) {
            allSettings[key] = info.defaultValues;
          }
        } else {
          allSettings[key] = info.defaultValues;
        }
      }
      const cbRaw = localStorage.getItem('debug_checkboxes');
      if (cbRaw) {
        try {
          allSettings.checkboxes = JSON.parse(cbRaw);
        } catch (_) {
          allSettings.checkboxes = { debugOverlay: true, gidVisible: true };
        }
      } else {
        allSettings.checkboxes = { debugOverlay: true, gidVisible: true };
      }
      return allSettings;
    }
    
    async function loadSavedValues() {
      await loadAllSettings();
      for (const [key, info] of Object.entries(elementList)) {
        const values = allSettings[key];
        if (!values || !info.element) continue;
        applyValuesToElement(info.element, values, info.defaultValues);
      }
      if (app.stage.sortableChildren) app.stage.sortChildren();
      if (currentElement && positionControls.x) {
        const el = currentElement.info.element;
        positionControls.x.input.value = el.x ?? 0;
        positionControls.x.valueDisplay.textContent = (el.x ?? 0).toFixed(0);
        positionControls.y.input.value = el.y ?? 0;
        positionControls.y.valueDisplay.textContent = (el.y ?? 0).toFixed(0);
        const scaleVal = el.scale ? el.scale.x : 1;
        positionControls.scale.input.value = scaleVal;
        positionControls.scale.valueDisplay.textContent = scaleVal.toFixed(2);
        positionControls.zIndex.input.value = el.zIndex ?? 0;
        positionControls.zIndex.valueDisplay.textContent = (el.zIndex ?? 0).toFixed(0);
      }
      let cb = allSettings.checkboxes;
      if (!cb) {
        try {
          const raw = localStorage.getItem('debug_checkboxes');
          cb = raw ? JSON.parse(raw) : null;
        } catch (_) {}
      }
      if (cb) {
        const inpOverlay = document.getElementById('debug-overlay-checkbox');
        if (inpOverlay) {
          inpOverlay.checked = cb.debugOverlay !== false;
          inpOverlay.dispatchEvent(new Event('change'));
        }
        const inpGid = document.getElementById('gid-visible-checkbox');
        if (inpGid) {
          inpGid.checked = cb.gidVisible !== false;
          inpGid.dispatchEvent(new Event('change'));
        }
      }
    }
    
    // Обновляем список элементов в селекторе
    updateElementListFn = function() {
      if (!elementSelect) return;
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
        selectElement(elementSelect.options[0].value);
      }
    };
    
    updateElementListFn();
    controlsPanel.appendChild(positionDivider);
    
    // Секция выбора сценариев
    const scenarioDivider = document.createElement('div');
    scenarioDivider.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(255,255,255,0.5);';
    
    const scenarioTitle = document.createElement('div');
    scenarioTitle.textContent = '📋 Scenario Loader';
    scenarioTitle.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;';
    scenarioDivider.appendChild(scenarioTitle);
    
    // Селектор сценариев
    const scenarioSelectLabel = document.createElement('div');
    scenarioSelectLabel.textContent = 'Select Scenario:';
    scenarioSelectLabel.style.cssText = 'margin-bottom: 5px; font-size: 11px;';
    scenarioDivider.appendChild(scenarioSelectLabel);
    
    const scenarioSelect = document.createElement('select');
    scenarioSelect.id = 'scenario-select';
    scenarioSelect.style.cssText = 'width: 100%; padding: 4px; margin-bottom: 10px; background: white; color: black; border-radius: 3px;';
    scenarioDivider.appendChild(scenarioSelect);
    
    // Информация о текущем сценарии
    const scenarioInfo = document.createElement('div');
    scenarioInfo.id = 'scenario-info';
    scenarioInfo.style.cssText = 'font-size: 10px; color: #aaa; margin-bottom: 10px; min-height: 30px;';
    scenarioInfo.textContent = 'No scenario loaded';
    scenarioDivider.appendChild(scenarioInfo);
    
    // Кнопка загрузки
    const loadScenarioBtn = document.createElement('button');
    loadScenarioBtn.textContent = 'Load Scenario';
    loadScenarioBtn.style.cssText = 'width: 100%; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    loadScenarioBtn.addEventListener('click', async () => {
      const selectedFile = scenarioSelect.value;
      if (!selectedFile) {
        alert('Please select a scenario file');
        return;
      }
      
      try {
        const response = await fetch(`./scenario/${selectedFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load scenario: ${response.statusText}`);
        }
        const scenarioData = await response.json();
        
        // Вызываем callback для загрузки сценария в CascadeManager
        if (window.loadScenarioCallback) {
          window.loadScenarioCallback(scenarioData);
          scenarioInfo.textContent = `Loaded: ${selectedFile} (${scenarioData.length} steps)`;
          scenarioInfo.style.color = '#4CAF50';
        } else {
          console.warn('loadScenarioCallback not set');
        }
      } catch (error) {
        console.error('Error loading scenario:', error);
        alert(`Error loading scenario: ${error.message}`);
        scenarioInfo.textContent = `Error: ${error.message}`;
        scenarioInfo.style.color = '#f44336';
      }
    });
    scenarioDivider.appendChild(loadScenarioBtn);
    
    controlsPanel.appendChild(scenarioDivider);
    
    // Загружаем список сценариев
    async function loadScenarioList() {
      try {
        // Сценарий по умолчанию
        const defaultScenario = 'scenario_2026-02-06T14-19-52.json';
        
        // Список известных файлов сценариев для проверки
        const knownScenarios = [
          defaultScenario
        ];
        
        // Очищаем селектор
        scenarioSelect.innerHTML = '<option value="">-- Select scenario --</option>';
        
        // Проверяем какие файлы существуют
        const foundScenarios = [];
        for (const fileName of knownScenarios) {
          try {
            const response = await fetch(`./scenario/${fileName}`, { method: 'HEAD' });
            if (response.ok) {
              foundScenarios.push(fileName);
            }
          } catch (e) {
            // Файл не найден, пропускаем
          }
        }
        
        // Добавляем найденные сценарии в селектор
        for (const fileName of foundScenarios) {
          const option = document.createElement('option');
          option.value = fileName;
          // Форматируем имя для отображения
          const displayName = fileName.replace('.json', '').replace(/^scenario_/, '').replace(/_/g, ' ');
          option.textContent = displayName;
          scenarioSelect.appendChild(option);
        }
        
        if (foundScenarios.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No scenarios found';
          option.disabled = true;
          scenarioSelect.appendChild(option);
        } else {
          // Автоматически загружаем сценарий по умолчанию
          // Проверяем, существует ли файл по умолчанию
          const scenarioToLoad = foundScenarios.includes(defaultScenario) 
            ? defaultScenario 
            : foundScenarios[0]; // Если файл по умолчанию не найден, загружаем первый доступный
          
          try {
            const response = await fetch(`./scenario/${scenarioToLoad}`);
            if (response.ok) {
              const scenarioData = await response.json();
              if (window.loadScenarioCallback) {
                window.loadScenarioCallback(scenarioData);
                // Устанавливаем выбранный сценарий в селекторе
                scenarioSelect.value = scenarioToLoad;
                console.log(`✅ Автоматически загружен сценарий по умолчанию: ${scenarioToLoad}`);
              }
            }
          } catch (e) {
            console.warn(`⚠️ Не удалось автоматически загрузить сценарий ${scenarioToLoad}:`, e);
          }
        }
      } catch (error) {
        console.warn('Error loading scenario list:', error);
      }
    }
    
    // Загружаем список сценариев при инициализации
    // Вызов будет выполнен из index.html после установки loadScenarioCallback
    // loadScenarioList();
    
    // Экспортируем функцию для вызова извне
    window.loadDefaultScenario = loadScenarioList;
    
    // Загружаем сохранённые настройки после того как все элементы (в т.ч. gameField) добавлены
    setTimeout(async () => {
      await loadAllSettings();
      await loadSavedValues();
    }, 150);
  }
  
  // Добавляем панель в body
  document.body.appendChild(controlsPanel);
  
  // Логика переключения
  let isOpen = false;
  
  toggleButton.addEventListener('click', () => {
    isOpen = !isOpen;
    controlsPanel.style.display = isOpen ? 'block' : 'none';
    toggleButton.textContent = isOpen ? '✕ Закрыть' : '🔧 Настройки';
  });
  
  return {
    toggleButton,
    controlsPanel,
    addElement: (key, name, element, defaultValues) => {
      elementList[key] = { name, element, defaultValues };
      if (allSettings && allSettings[key]) {
        const info = elementList[key];
        applyValuesToElement(info.element, allSettings[key], info.defaultValues);
      }
      if (updateElementListFn) {
        updateElementListFn();
      }
    },
    setDebugOverlay: (arr) => {
      debugOverlayElements = arr || [];
    },
    setSymbolDebugOverlay: (callback) => {
      symbolDebugOverlayCallback = callback;
      const input = document.getElementById('debug-overlay-checkbox');
      if (input && symbolDebugOverlayCallback) symbolDebugOverlayCallback(!!input.checked);
    },
    updateScenarioInfo: (info) => {
      const scenarioInfo = document.getElementById('scenario-info');
      if (scenarioInfo) {
        scenarioInfo.textContent = info;
      }
    }
  };
}
