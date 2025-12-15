# MiniWinText - Стилизованный текст выигрышей

## Обзор

`MiniWinText` - класс для генерации золотого 3D текста с градиентами, обводками и тенями. Используется для отображения сумм выигрышей в игре.

## Особенности

- **Стилизованный текст**: Градиент, обводка, тени из Figma
- **Кеширование текстур**: Оптимизация производительности
- **Canvas API**: Рендеринг через HTML5 Canvas
- **Шрифт Montserrat Extra Bold**: Используется с fallback на Arial Black

## Структура стилей

### Градиент
```
linear-gradient(180deg, #FFE8AA 19.44%, #FFFE18 46.94%, #FF7700 85.44%)
```
- Направление: сверху вниз (180deg)
- Три цвета: светло-желтый → ярко-желтый → оранжевый

### Обводка
- Цвет: `#91009E` (фиолетовый)
- Толщина: 3px
- Смещение вниз: 3px (эффект тени сверху)

### Тень
- Цвет: `rgba(45, 7, 0, 0.64)`
- Размытие: 11.3361px
- Смещение по Y: 8.50204px

## Использование

### Базовое создание текста

```javascript
const miniWinText = new MiniWinText();
const sprite = miniWinText.createGolden3DText("120.00");
```

### С настройками

```javascript
const sprite = miniWinText.createGolden3DText("120.00", {
  fontSize: 72,      // Размер шрифта
  padding: 30,       // Отступы вокруг текста
  useCache: true     // Использовать кеш
});
```

### Анимированный текст (для показа выигрышей)

```javascript
const sprite = miniWinText.createAnimatedGoldenText(120.00, { x: 960, y: 540 });
// sprite.scale.set(0) и sprite.alpha = 0 для анимации появления
```

## Методы

### `createGolden3DText(text, options)`

Создает спрайт с золотым текстом.

**Параметры:**
- `text` (string): Текст для отрисовки
- `options` (object): Настройки стиля
  - `fontSize` (number): Размер шрифта (по умолчанию 72)
  - `padding` (number): Отступы (по умолчанию 30)
  - `useCache` (boolean): Использовать кеш (по умолчанию true)

**Возвращает:** `PIXI.Sprite` - спрайт с текстом

### `createAnimatedGoldenText(value, position, options)`

Создает спрайт готовый к анимации (с начальными scale=0 и alpha=0).

**Параметры:**
- `value` (number|string): Значение для отображения
- `position` (object): Позиция {x, y}
- `options` (object): Опции стиля

**Возвращает:** `PIXI.Sprite` - спрайт готовый к анимации

## Интеграция с WinLineManager

`MiniWinText` используется в `WinLineManager` для показа сумм выигрышей:

1. **Общая сумма** (одновременный показ всех линий):
   - Позиция: центр игрового поля
   - Масштаб: 1.1 (на 10% больше)
   
2. **Индивидуальная сумма** (перебор линий):
   - Позиция: на уровне выигрышной линии
   - Масштаб: 1.0 (обычный размер)

## Анимация появления

В `WinLineManager.showWinText()`:
- Начальное состояние: `scale = 0.5`, `alpha = 0.5`
- Целевое состояние: `scale = targetScale` (1.0 или 1.1), `alpha = 1.0`
- Используется `requestAnimationFrame` для плавной анимации
- Приращение: 0.1 за кадр

## Примеры

### Показ выигрыша

```javascript
// В WinLineManager
const textValue = amount.toFixed(2); // "120.00"
const sprite = this.miniWinText.createGolden3DText(textValue);
sprite.x = 0;
sprite.y = 0;
sprite.anchor.set(0.5);
sprite.scale.set(1);
sprite.alpha = 1;
winTextGroup.addChild(sprite);
```

### Анимация счетчика (от 40 до 120)

```javascript
let currentValue = 40;
const targetValue = 120;
const duration = 3000; // 3 секунды
const startTime = Date.now();

const animateCounter = () => {
  const elapsed = Date.now() - startTime;
  const progress = Math.min(elapsed / duration, 1);
  currentValue = 40 + (targetValue - 40) * progress;
  
  // Обновляем текстуру
  const newSprite = miniWinText.createGolden3DText(currentValue.toFixed(2));
  // Заменяем старую текстуру...
  
  if (progress < 1) {
    requestAnimationFrame(animateCounter);
  }
};
```

## Технические детали

- **Canvas**: Создается временный canvas для каждого текста
- **Кеш**: Текстуры кешируются по ключу `golden_{text}_{fontSize}_{padding}`
- **Якорь**: Текст центрируется через `anchor.set(0.5)`
- **Смешивание**: Используется стандартное смешивание PixiJS

## Зависимости

- `PIXI` (PixiJS)
- Шрифт Montserrat (загружается через Google Fonts в `index.html`)

