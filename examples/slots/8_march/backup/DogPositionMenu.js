// Облегчённое меню позиционирования — только Position Debugger
const DEBUG_POSITIONS_PATH = './debug_positions.json';

export function createDogPositionMenu(app, config) {
  let currentElement = null;
  const positionControls = {};
  const elementList = {};
  let elementSelect = null;
  let updateElementListFn = null;
  let allSettings = null;
  let debugContainers = []; // контейнеры собаки для отладки — показывать/скрывать галкой

  loadAllSettings().catch(e => console.warn('Failed to load settings on init:', e));

  const toggleButton = document.createElement('button');
  toggleButton.id = 'controls-toggle-button';
  toggleButton.textContent = '🔧 Позиции собаки';
  toggleButton.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10001; background: rgba(0,0,0,0.7); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 12px;';
  document.body.appendChild(toggleButton);

  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'controls';
  controlsPanel.style.cssText = 'position: fixed; top: 50px; right: 20px; z-index: 10000; background: rgba(0,0,0,0.85); padding: 12px; border-radius: 8px; color: white; font-size: 12px; min-width: 220px; display: none;';

  function applyValuesToElement(element, values, defaultValues) {
    if (!element) return;
    const x = values.x !== undefined ? values.x : defaultValues.x;
    const y = values.y !== undefined ? values.y : defaultValues.y;
    element.x = x;
    element.y = y;
    const scaleVal = values.scale !== undefined ? values.scale : defaultValues.scale;
    if (element.scale) {
      element.scale.x = scaleVal;
      element.scale.y = scaleVal;
    }
    if (values.zIndex !== undefined) element.zIndex = values.zIndex;
  }

  function getDisplayPosition(info) {
    const el = info.element;
    if (!el) return { x: 0, y: 0 };
    return { x: el.x || 0, y: el.y || 0 };
  }

  async function loadAllSettings(forceReload = false) {
    if (allSettings !== null && !forceReload) return allSettings;
    try {
      const response = await fetch(DEBUG_POSITIONS_PATH);
      if (response.ok) {
        allSettings = await response.json();
        return allSettings;
      }
    } catch (e) {
      console.warn('Failed to load debug_positions.json:', e);
    }
    allSettings = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('debug_') && key !== 'debug_checkboxes') {
        const elementKey = key.replace('debug_', '');
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            allSettings[elementKey] = JSON.parse(raw);
          } catch (_) {}
        }
      }
    }
    for (const [key, info] of Object.entries(elementList)) {
      if (!allSettings[key]) allSettings[key] = info.defaultValues;
    }
    const cbRaw = localStorage.getItem('debug_checkboxes');
    allSettings.checkboxes = cbRaw ? (() => { try { return JSON.parse(cbRaw); } catch { return {}; } })() : {};
    if (allSettings.checkboxes.debugContainersVisible === undefined) {
      allSettings.checkboxes.debugContainersVisible = true;
    }
    return allSettings;
  }

  async function loadSavedValues() {
    await loadAllSettings();
    for (const [key, info] of Object.entries(elementList)) {
      const values = allSettings[key];
      if (!values || !info.element) continue;
      applyValuesToElement(info.element, values, info.defaultValues);
      if (info.element.parent?.sortableChildren) info.element.parent.sortChildren();
    }
    if (app?.stage?.sortableChildren) app.stage.sortChildren();
    if (currentElement && positionControls.x) {
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
    const cb = allSettings?.checkboxes;
    if (cb) {
      const inp = document.getElementById('debug-containers-visible-checkbox');
      if (inp) {
        inp.checked = cb.debugContainersVisible !== false;
        inp.dispatchEvent(new Event('change'));
      }
    }
  }

  const positionTitle = document.createElement('div');
  positionTitle.textContent = 'Позиции Spine собаки';
  positionTitle.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #4CAF50;';
  controlsPanel.appendChild(positionTitle);

  // Галка: показать/скрыть контейнеры для отладки
  const visibilityLabel = document.createElement('label');
  visibilityLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 12px; cursor: pointer; font-size: 11px;';
  const inputDebugVisible = document.createElement('input');
  inputDebugVisible.id = 'debug-containers-visible-checkbox';
  inputDebugVisible.type = 'checkbox';
  inputDebugVisible.checked = true;
  inputDebugVisible.addEventListener('change', () => {
    const visible = inputDebugVisible.checked;
    debugContainers.forEach(c => { if (c) c.visible = visible; });
    localStorage.setItem('debug_checkboxes', JSON.stringify({
      ...(JSON.parse(localStorage.getItem('debug_checkboxes') || '{}')),
      debugContainersVisible: visible
    }));
  });
  visibilityLabel.appendChild(inputDebugVisible);
  visibilityLabel.appendChild(document.createTextNode('Показать контейнеры для отладки'));
  controlsPanel.appendChild(visibilityLabel);

  const selectLabel = document.createElement('div');
  selectLabel.textContent = 'Элемент:';
  selectLabel.style.cssText = 'margin-bottom: 5px; font-size: 11px;';
  controlsPanel.appendChild(selectLabel);

  elementSelect = document.createElement('select');
  elementSelect.style.cssText = 'width: 100%; padding: 6px; margin-bottom: 12px; background: white; color: black; border-radius: 4px; border: 1px solid #555;';
  elementSelect.addEventListener('change', (e) => selectElement(e.target.value));
  controlsPanel.appendChild(elementSelect);

  function createPositionControl(label, property, min, max, step) {
    const container = document.createElement('div');
    container.style.cssText = 'margin-bottom: 8px;';
    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; margin-bottom: 2px;';
    container.appendChild(labelEl);
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 5px;';
    const decBtn = document.createElement('button');
    decBtn.textContent = '◄';
    decBtn.style.cssText = 'width: 24px; height: 24px; padding: 0; border: 1px solid #555; background: rgba(255,255,255,0.15); color: white; cursor: pointer; border-radius: 3px; font-size: 10px;';
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
    input.addEventListener('input', (e) => updateProperty(property, parseFloat(e.target.value)));
    row.appendChild(input);
    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = 'min-width: 45px; text-align: right; font-size: 11px;';
    row.appendChild(valueDisplay);
    const incBtn = document.createElement('button');
    incBtn.textContent = '►';
    incBtn.style.cssText = 'width: 24px; height: 24px; padding: 0; border: 1px solid #555; background: rgba(255,255,255,0.15); color: white; cursor: pointer; border-radius: 3px; font-size: 10px;';
    incBtn.addEventListener('click', () => {
      const input = positionControls[property].input;
      const value = Math.min(max, parseFloat(input.value) + step);
      input.value = value;
      updateProperty(property, value);
    });
    row.appendChild(incBtn);
    container.appendChild(row);
    controlsPanel.appendChild(container);
    positionControls[property] = { input, valueDisplay };
  }

  createPositionControl('X:', 'x', -2000, 2000, 1);
  createPositionControl('Y:', 'y', -2000, 2000, 1);
  createPositionControl('Scale:', 'scale', 0.1, 5, 0.01);
  createPositionControl('Z Index:', 'zIndex', 0, 1000, 1);

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 8px; margin-top: 10px;';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.style.cssText = 'padding: 6px 12px; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;';
  resetBtn.addEventListener('click', () => resetCurrentElement());
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;';
  saveBtn.addEventListener('click', () => saveValues());
  buttonRow.appendChild(resetBtn);
  buttonRow.appendChild(saveBtn);
  controlsPanel.appendChild(buttonRow);

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
    const inp = document.getElementById('debug-containers-visible-checkbox');
    settings.checkboxes = {
      debugContainersVisible: inp ? inp.checked : true
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
    notification.textContent = 'Сохранено в debug_positions.json';
    notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:12px 20px;border-radius:8px;z-index:10002;font-size:12px;';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
  }

  function selectElement(key) {
    const info = elementList[key];
    if (!info || !info.element) return;
    currentElement = { key, info };
    const element = info.element;
    const pos = getDisplayPosition(info);
    positionControls.x.input.value = pos.x;
    positionControls.x.valueDisplay.textContent = pos.x.toFixed(0);
    positionControls.y.input.value = pos.y;
    positionControls.y.valueDisplay.textContent = pos.y.toFixed(0);
    const scaleValue = element.scale ? (element.scale.x || 1) : 1;
    positionControls.scale.input.value = scaleValue;
    positionControls.scale.valueDisplay.textContent = scaleValue.toFixed(2);
    positionControls.zIndex.input.value = element.zIndex ?? info.defaultValues.zIndex;
    positionControls.zIndex.valueDisplay.textContent = (element.zIndex ?? info.defaultValues.zIndex).toFixed(0);
  }

  function updateProperty(property, value) {
    if (!currentElement) return;
    const info = currentElement.info;
    const element = info.element;
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
      if (element.parent?.sortableChildren) element.parent.sortChildren();
      positionControls[property].valueDisplay.textContent = value.toFixed(0);
    }
    const pos = getDisplayPosition(currentElement.info);
    localStorage.setItem(`debug_${currentElement.key}`, JSON.stringify({
      x: pos.x, y: pos.y,
      scale: element.scale ? element.scale.x : 1,
      zIndex: element.zIndex
    }));
  }

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

  document.body.appendChild(controlsPanel);

  let isOpen = false;
  toggleButton.addEventListener('click', async () => {
    isOpen = !isOpen;
    controlsPanel.style.display = isOpen ? 'block' : 'none';
    toggleButton.textContent = isOpen ? '✕ Закрыть' : '🔧 Позиции собаки';
    if (isOpen && allSettings === null) {
      await loadAllSettings();
      await loadSavedValues();
    }
  });

  return {
    addElement: async (key, name, element, defaultValues, options = {}) => {
      elementList[key] = { name, element, defaultValues };
      if (!options.skipVisibilityToggle) {
        debugContainers.push(element);
      }
      if (allSettings === null) await loadAllSettings();
      if (allSettings && allSettings[key]) {
        applyValuesToElement(element, allSettings[key], defaultValues);
      }
      const cb = allSettings?.checkboxes;
      element.visible = options.skipVisibilityToggle ? true : (cb?.debugContainersVisible !== false);
      if (updateElementListFn) updateElementListFn();
    },
    reloadAllSettings: async () => {
      allSettings = null;
      await loadAllSettings(true);
      await loadSavedValues();
      const cb = allSettings?.checkboxes;
      debugContainers.forEach(c => {
        if (c) c.visible = cb?.debugContainersVisible !== false;
      });
    },
    getSettings: () => allSettings
  };
}
