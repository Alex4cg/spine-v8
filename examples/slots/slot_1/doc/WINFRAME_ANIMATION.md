# WinFrameAnimation - Анимация выигрышных рамок

## Обзор

`WinFrameAnimation` управляет анимированными рамками, которые подсвечивают выигрышные символы. Использует атлас текстур и спрайтовый пул для оптимизации.

## Особенности

- **Атлас текстур**: 60 кадров анимации в одном атласе
- **Спрайтовый пул**: Переиспользование спрайтов для 9 позиций
- **Статическое позиционирование**: Позиции относительно игрового поля, не зависят от движения рилов
- **Z-индексы**: Отрисовка над символами (zIndex = 110)

## Структура

### Спрайтовый пул

Создается 9 спрайтов (3 рила × 3 видимых символа):

```javascript
spritePool = {
  '0_0': AnimatedSprite, // Рил 0, позиция 0
  '0_1': AnimatedSprite, // Рил 0, позиция 1
  '0_2': AnimatedSprite, // Рил 0, позиция 2
  '1_0': AnimatedSprite, // Рил 1, позиция 0
  // ... и так далее
}
```

### Маппинг линий

Линии 1-5 соответствуют позициям на поле:

```javascript
static LINE_POSITIONS = {
  1: [[0, 1], [1, 1], [2, 1]], // Третий ряд (средний)
  2: [[0, 0], [1, 0], [2, 0]], // Второй ряд (нижний)
  3: [[0, 2], [1, 2], [2, 2]], // Верхняя горизонталь
  4: [[0, 0], [1, 1], [2, 2]], // Диагональ снизу-вверх
  5: [[0, 2], [1, 1], [2, 0]]  // Диагональ сверху-вниз
};
```

## Использование

### Инициализация

```javascript
const winFrameAnimation = new WinFrameAnimation(config, app, stage);
await winFrameAnimation.init();
winFrameAnimation.createSpritePool(reels);
```

### Показ на линиях

```javascript
// Показать на одной линии
winFrameAnimation.playOnLine(reels, lineNumber);

// Показать на нескольких линиях
winFrameAnimation.playOnLines(reels, lineNumbers);
```

### Остановка

```javascript
winFrameAnimation.stop(); // Скрывает все спрайты
```

## Конфигурация

```javascript
winFrameAnimation: {
  enabled: true,
  atlasPath: './win_frame/win_frame.json',
  frameCount: 60,
  zIndex: 110 // Над символами
}
```

## Позиционирование

### Статическое позиционирование

Позиции рассчитываются относительно `config.startPosition` и `config.symbolSize`:

```javascript
sprite.x = startX + reelIndex * symbolWidth + symbolWidth / 2;
sprite.y = startY + positionIndex * symbolHeight + symbolHeight / 2;
```

**Важно:** Позиции статичны и не обновляются при движении рилов. Топ-символы (для визуального движения) не влияют на позицию winframes.

## Анимация

### Параметры

- **Количество кадров**: 60
- **Loop**: false (не зациклена)
- **Скорость**: 1.0 (нормальная)

### Управление

```javascript
// Показ и запуск анимации
sprite.visible = true;
sprite.gotoAndPlay(0);

// Скрытие
sprite.visible = false;
```

## Интеграция с WinLineManager

Winframes синхронизируются с винлайнами:

```javascript
// В WinLineManager
this.winFrameAnimation = winFrameAnimation;
this.reels = reels;

// При одновременном показе
if (this.winFrameAnimation && this.reels && this.activeLines.length > 0) {
  this.winFrameAnimation.playOnLines(this.reels, this.activeLines);
}

// При переборе линий
if (this.winFrameAnimation && this.reels) {
  this.winFrameAnimation.playOnLine(this.reels, lineNumber);
}

// При завершении линии
if (this.winFrameAnimation) {
  this.winFrameAnimation.stop();
}
```

## Методы

### `init()`

Загружает атлас текстур.

### `createSpritePool(reels)`

Создает спрайтовый пул из 9 позиций.

**Параметры:**
- `reels` (Array): Массив рилов для расчета позиций

### `playOnLine(reels, lineNumber)`

Показывает winframes на одной линии.

**Параметры:**
- `reels` (Array): Массив рилов
- `lineNumber` (number): Номер линии (1-5)

### `playOnLines(reels, lineNumbers)`

Показывает winframes на нескольких линиях.

**Параметры:**
- `reels` (Array): Массив рилов
- `lineNumbers` (Array): Массив номеров линий

### `stop()`

Скрывает все winframes.

### `hideAllSprites()`

Скрывает все спрайты в пуле.

### `destroySpritePool()`

Уничтожает спрайтовый пул и освобождает ресурсы.

## Технические детали

### Создание спрайта

```javascript
const sprite = new PIXI.AnimatedSprite(textures);
sprite.anchor.set(0.5);
sprite.loop = false;
sprite.animationSpeed = 1.0;
sprite.zIndex = 110;
sprite.visible = false;
```

### Позиция индекса

`positionIndex` (0, 1, 2) соответствует видимым позициям символов:
- 0 = второй ряд (нижний)
- 1 = третий ряд (средний)
- 2 = четвертый ряд (верхний)

## Файловая структура

```
atlas/
  └── winframe_60_fps/
      ├── winframe_60_fps.json
      └── winframe_60_fps.png
```

Атлас содержит 60 кадров анимации winframe.

## Оптимизация

1. **Спрайтовый пул**: Переиспользование спрайтов вместо создания новых
2. **Статическое позиционирование**: Не требуется обновление позиций каждый кадр
3. **Атлас текстур**: Все кадры в одном файле для быстрой загрузки

## Z-индексы

- **Winframes**: `zIndex = 110` (над символами, символы zIndex = 100)
- **Winlines**: `zIndex = 99` (под символами)
- **Мини-вин тексты**: `zIndex = 115` (над winframes)

