# Система перелётов скаттеров (ScatterFlySystem)

## Общая архитектура

При выпадении скаттера на игровом поле и срабатывании события `shot` из Spine-анимации, запускается перелёт монетки от скаттера к соответствующему сундуку.

```
┌─────────────┐     shot event      ┌──────────────────┐
│   Scatter   │ ─────────────────▶  │ ScatterFlySystem │
│  (Symbol)   │                     │                  │
└─────────────┘                     └────────┬─────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────┐
│                         Flight                                  │
│  ┌─────────────┐  ┌─────────────────┐                         │
│  │ coinSprite  │  │ trailEmitter    │                         │
│  │ (монетка)   │  │ (шлейф частиц)  │                         │
│  └─────────────┘  └─────────────────┘                         │
└────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────┐
                                    │    Chest    │
                                    │  (сундук)   │
                                    └─────────────┘
```

## Файлы системы

| Файл | Описание |
|------|----------|
| `ScatterFlySystem.js` | Основной модуль системы перелётов |
| `Symbol.js` | Символы, включая скаттеры (событие `shot`) |
| `index.html` | Инициализация и конфигурация |

## Классы

### 1. ScatterFlySystem (экспортируемый класс)

Главный класс управления перелётами.

```javascript
import { ScatterFlySystem } from './ScatterFlySystem.js';

const system = new ScatterFlySystem(app, {
  flyDuration: 0.4,           // Длительность перелёта (сек)
  baseArcHeight: 80,          // Базовая высота дуги (px)
  maxDistance: 500,           // Макс. расстояние для нормализации
  coinScale: 0.5,             // Масштаб монетки
  trailConfig: {...},         // Конфиг шлейфа частиц
  onFlightComplete: (color) => {...}  // Колбэк завершения
});
```

**Методы:**
- `init()` — асинхронная инициализация
- `setChests(chests)` — установка ссылок на сундуки
- `loadCoinSequences(...)` — загрузка секвенций монеток
- `startFlightFromScatter(symbol)` — запуск перелёта от скаттера
- `update(deltaTime)` — обновление (вызывать каждый кадр)
- `playExplosion(x, y)` — воспроизведение взрыва
- `destroy()` — уничтожение системы

### 2. Flight (внутренний класс)

Представляет один активный перелёт.

**Состав:**
- `coinSprite` — летящая монетка (`Sprite` или `AnimatedSprite`)
- `trailEmitter` — эмиттер шлейфа частиц
- Траектория: параболическая дуга

**Жизненный цикл:**
1. Создание → монетка и шлейф появляются в начальной точке
2. Полёт → монетка движется по дуге, шлейф следует
3. Приземление → монетка скрывается, взрыв воспроизводится
4. Очистка → шлейф догорает, перелёт уничтожается

### 3. TrailParticleEmitter (внутренний класс)

Эмиттер частиц для шлейфа за монеткой.

```javascript
// Конфигурация шлейфа
trailConfig: {
  frequency: 0.005,              // Интервал спавна (сек)
  lifetime: { min: 0.15, max: 0.25 },  // Время жизни частицы
  scale: { start: 0.4, end: 0.1 },     // Масштаб (начало → конец)
  speed: { start: 10, end: 30 },       // Скорость разлёта
  alpha: { start: 1, end: 0 },         // Прозрачность
  maxParticles: 300                    // Макс. количество
}
```

## Траектория перелёта

### Параболическая дуга

Перелёт движется по параболической дуге от скаттера к сундуку.

```
        ╭───────╮
       ╱         ╲      arcHeight
      ╱           ╲        ↕
     ╱             ╲
    ●               ●
  START            END
(scatter)        (chest)
```

**Формула высоты дуги:**
```javascript
// t = прогресс от 0 до 1
const arcProgress = -4 * arcHeight * t * (t - 1);
```

**Зависимость от расстояния:**
- Чем **меньше** расстояние → **круче** дуга
- Чем **больше** расстояние → **положе** дуга

```javascript
const normalizedDistance = distance / maxDistance;
const arcHeight = baseArcHeight * (1.5 - normalizedDistance);
```

### Перпендикулярное смещение

Дуга строится смещением по перпендикуляру к линии полёта:

```javascript
// Направление полёта
const dirX = dx / distance;
const dirY = dy / distance;

// Перпендикуляр (поворот на 90°)
const perpX = -dirY;
const perpY = dirX;

// Позиция на дуге
const x = baseX + perpX * arcProgress;
const y = baseY + perpY * arcProgress;
```

## Маппинг цветов

| Тип скаттера | Цвет сундука |
|--------------|--------------|
| `blue`       | `blue`       |
| `gold`       | `yellow`     |
| `red`        | `red`        |

## Событие shot в Symbol.js

Скаттер генерирует событие `shot` во время анимации `hit`:

```javascript
// Symbol.js - playScatterHitAnimation()
hitEntry.listener = {
  event: (entry, event) => {
    if (event.data.name === 'shot') {
      if (Symbol.onScatterShot) {
        Symbol.onScatterShot(this);  // Вызов колбэка
      }
    }
  }
};
```

## Инициализация в index.html

```javascript
// 1. Создание системы
scatterFlySystem = new ScatterFlySystem(app, {
  flyDuration: 0.4,
  baseArcHeight: 80,
  maxDistance: 500,
  coinScale: 0.5,
  onFlightComplete: (chestColor) => {
    playJumpOnAll({ [chestColor]: chests[chestColor] });
  }
});

// 2. Установка сундуков
scatterFlySystem.setChests(chests);

// 3. Инициализация
await scatterFlySystem.init();

// 4. Загрузка секвенций монеток (опционально)
await scatterFlySystem.loadCoinSequences('./particles/coins_big/', ...);

// 5. Подключение колбэка
Symbol.onScatterShot = (symbol) => {
  scatterFlySystem.startFlightFromScatter(symbol);
};

// 6. Обновление в ticker
app.ticker.add((ticker) => {
  const deltaTime = ticker.deltaMS / 1000;
  scatterFlySystem.update(deltaTime);
});
```

## Структура ассетов

```
slots/slot_5/
└── particles/
    └── coins_big/           # (опционально)
        ├── blue/
        │   ├── coin_0000.png
        │   ├── coin_0001.png
        │   └── ... (30 кадров)
        ├── gold/
        │   └── ... (30 кадров)
        └── red/
            └── ... (30 кадров)
```

## Fallback-режимы

### Монетка (если секвенция не загружена)
Создаётся программная текстура — цветной круг с бликами.

## Диаграмма последовательности

```
Symbol          ScatterFlySystem       Flight          Chest
  │                    │                  │               │
  │  shot event        │                  │               │
  ├───────────────────▶│                  │               │
  │                    │  create Flight   │               │
  │                    ├─────────────────▶│               │
  │                    │                  │               │
  │                    │    update()      │               │
  │                    ├─────────────────▶│               │
  │                    │  (каждый кадр)   │               │
  │                    │                  │               │
  │                    │   t >= 1         │               │
  │                    │◀─────────────────┤               │
  │                    │                  │               │
  │                    │  playExplosion() │               │
  │                    ├──────────────────┼───────────────│
  │                    │                  │               │
  │                    │  onFlightComplete│               │
  │                    ├──────────────────┼──────────────▶│
  │                    │                  │   playJump()  │
  │                    │                  │               │
```

## Отладка

### Консольные сообщения

| Сообщение | Значение |
|-----------|----------|
| `✅ [ScatterFlySystem] Инициализирован` | Система готова |
| `📦 Создана fallback-текстура` | Секвенция не найдена |
| `🚀 Перелёт: red (x, y) → red (x, y)` | Перелёт запущен |
| `💥 Взрыв в (x, y)` | Взрыв воспроизводится |
| `✅ Перелёт завершён` | Перелёт окончен |

### Типичные проблемы

| Проблема | Причина | Решение |
|----------|---------|---------|
| Монетка не анимируется | Секвенция не загружена | Проверить путь к файлам или использовать fallback |
| Неверная конечная точка | Сундук перемещён | Позиция берётся в момент shot |
| Перелёт не запускается | Нет события shot | Проверить анимацию hit в Spine скаттера |
