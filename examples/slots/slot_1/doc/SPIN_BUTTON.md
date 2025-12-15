# SpinButton - Графическая кнопка спин

## Обзор

`SpinButton` - графическая кнопка для запуска спинов, реализованная на PixiJS спрайтах с поддержкой различных состояний.

## Состояния

1. **default**: Обычное состояние
2. **hover**: Наведение мыши
3. **pressed**: Нажатие
4. **disabled**: Неактивное состояние (во время спина)

## Структура

### Компоненты

```
container (Container)
  ├── button (Sprite)          # Интерактивный спрайт (default/hover/pressed)
  └── disabledButton (Sprite)  # Отдельный спрайт для disabled
```

### Текстуры

- `spin_default.png` - Обычное состояние
- `spin_hover.png` - Наведение
- `spin_pressed.png` - Нажатие
- `spin_disabled.png` - Неактивное состояние

## Использование

### Инициализация

```javascript
const spinButton = new SpinButton(config, app, onSpinClick);
```

**Параметры:**
- `config` - Конфигурация игры (с `spinButton` настройками)
- `app` - PixiJS приложение
- `onSpinClick` - Callback при клике

### Конфигурация

```javascript
spinButton: {
  textures: {
    default: './ui/spn_btn/spin_default.png',
    hover: './ui/spn_btn/spin_hover.png',
    pressed: './ui/spn_btn/spin_pressed.png',
    disabled: './ui/spn_btn/spin_disabled.png'
  },
  position: { x: 960, y: 850 },
  zIndex: 200
}
```

## Управление состоянием

### Программное управление

```javascript
// Включить кнопку
spinButton.setEnabled(true);

// Отключить кнопку
spinButton.setEnabled(false);
```

### Автоматическое переключение

Кнопка автоматически отключается при спин и включается после завершения через `setEnabled()`.

## Взаимодействие

### Обработка событий

```javascript
// Mouse events на button спрайте
this.button.on('pointerdown', () => {
  if (!this.isDisabled) {
    this.setState('pressed');
  }
});

this.button.on('pointerup', () => {
  if (!this.isDisabled) {
    this.setState('hover');
    this.onSpinClick();
  }
});

this.button.on('pointerenter', () => {
  if (!this.isDisabled) {
    this.setState('hover');
  }
});

this.button.on('pointerleave', () => {
  if (!this.isDisabled) {
    this.setState('default');
  }
});
```

## Реализация disabled состояния

### Два спрайта

Для правильного отображения disabled состояния используются два отдельных спрайта:

1. **button**: Показывает default/hover/pressed (интерактивный)
2. **disabledButton**: Показывает disabled (неинтерактивный)

### Переключение видимости

```javascript
setEnabled(enabled) {
  this.isDisabled = !enabled;
  
  if (this.isDisabled) {
    // Показываем disabled спрайт, скрываем интерактивный
    this.button.visible = false;
    this.disabledButton.visible = true;
  } else {
    // Показываем интерактивный спрайт, скрываем disabled
    this.button.visible = true;
    this.disabledButton.visible = false;
  }
}
```

## Позиционирование

Текстуры позиционированы с общим центром, поэтому они могут заменять друг друга без визуального сдвига.

```javascript
// Оба спрайта в одной позиции (0, 0 относительно контейнера)
this.button.anchor.set(0.5);
this.disabledButton.anchor.set(0.5);
```

## Интеграция с SlotMachine

```javascript
// Создание кнопки
this.spinButton = new SpinButton(this.config, this.app, () => {
  this.spin();
});

// Получение контейнера для добавления на stage
const buttonContainer = this.spinButton.getContainer();
this.app.stage.addChild(buttonContainer);

// Управление состоянием
async spin() {
  this.spinButton.setEnabled(false); // Отключаем при спине
  // ... логика спина ...
}

onAllReelsStopped() {
  this.spinButton.setEnabled(true); // Включаем после завершения
}
```

## Методы

### `getContainer()`

Возвращает контейнер кнопки для добавления на stage.

**Возвращает:** `PIXI.Container`

### `setEnabled(enabled)`

Включает/отключает кнопку.

**Параметры:**
- `enabled` (boolean): Включена ли кнопка

### `setState(state)`

Устанавливает визуальное состояние (только для интерактивного спрайта).

**Параметры:**
- `state` (string): 'default', 'hover', 'pressed'

## Технические детали

### Event mode

```javascript
this.button.eventMode = 'static';      // Интерактивный
this.disabledButton.eventMode = 'none'; // Неинтерактивный
```

### Cursor

```javascript
this.button.cursor = 'pointer';        // Указатель для интерактивного
this.disabledButton.cursor = 'not-allowed'; // Запрет для disabled
```

## Файловая структура

```
ui/spn_btn/
  ├── spin_default.png
  ├── spin_hover.png
  ├── spin_pressed.png
  └── spin_disabled.png
```

## Особенности

1. **Два спрайта**: Для правильного отображения disabled без конфликтов с hover
2. **Общий центр**: Текстуры с общим центром для бесшовной замены
3. **Автоматическое управление**: Отключение/включение через `setEnabled()`
4. **Event handling**: Полная поддержка mouse events

