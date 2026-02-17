# ScatterFlySystem - Система перелётов скаттеров

Готовая система для создания визуальных перелётов от символов к целевым объектам (сундукам) с поддержкой множественных одновременных перелётов, Spine-анимаций, частиц и взрывов.

## Возможности

- Spine-монетка с выбором скина по цвету
- Параболическая траектория (дуга)
- Trail-частицы с изолированным additive blending
- Spine-взрыв в точке приземления
- Конкурентно-безопасная архитектура (много перелётов одновременно)
- Fallback на Graphics если Spine недоступен
- Безопасное удаление Spine-объектов (без render corruption)

## Требуемые ассеты

```
spine/
├── coin_p/
│   ├── skeleton.json
│   ├── skeleton.atlas
│   └── skeleton.png
│   # Скины: blue, gold, red
│   # Анимация: animation (loop)
│
└── explosion/
    ├── skeleton.json
    ├── skeleton.atlas
    └── skeleton.png
    # Анимация: animation (one-shot)
```

## Быстрый старт

### 1. Импорт

```javascript
import { ScatterFlySystem } from './ScatterFlySystem.js';
```

### 2. Создание и инициализация

```javascript
const scatterFlySystem = new ScatterFlySystem(app, {
  flyDuration: 0.45,
  onFlightComplete: (chestColor) => {
    // Вызывается при приземлении
    playJumpOnAll({ [chestColor]: chests[chestColor] });
  }
});

scatterFlySystem.setChests(chests); // { blue, yellow, red }
await scatterFlySystem.init();
```

### 3. Подключение к Symbol

```javascript
Symbol.onScatterShot = (symbol) => {
  scatterFlySystem.startFlightFromScatter(symbol);
};
```

### 4. Update в ticker

```javascript
app.ticker.add(() => {
  const deltaTime = app.ticker.deltaMS / 1000;
  scatterFlySystem.update(deltaTime);
});
```

## Конфигурация

### Основные параметры

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `flyDuration` | 0.45 | Длительность перелёта (сек) |
| `baseArcHeight` | 80 | Базовая высота дуги (px) |
| `maxDistance` | 500 | Макс. расстояние для нормализации дуги |
| `coinScale` | 0.66 | Масштаб Spine-монетки |
| `explosionScale` | 0.7 | Масштаб Spine-взрыва |
| `chestOffsetX` | 30 | Офсет точки приземления по X |
| `chestOffsetY` | 20 | Офсет точки приземления по Y |
| `onFlightComplete` | null | Колбэк `(chestColor) => void` |

### Параметры частиц

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `trailEmitInterval` | 0.003 | Интервал спавна частиц (сек) |
| `trailParticleLifetime` | 0.25 | Время жизни частицы (сек) |
| `trailParticleStartScale` | 1.05 | Начальный масштаб |
| `trailParticleEndScale` | 0.21 | Конечный масштаб |
| `trailParticleStartAlpha` | 0.9 | Начальная прозрачность |
| `trailParticleEndAlpha` | 0 | Конечная прозрачность |
| `trailParticleSpeed` | 15 | Скорость разлёта |
| `trailParticleSize` | 17 | Размер текстуры частицы |

## API

### Методы

```javascript
// Установка целей (сундуков)
setChests(chests: { blue, yellow, red })

// Инициализация (async, загружает ассеты)
async init()

// Запуск перелёта от символа
startFlightFromScatter(symbol)

// Обновление (вызывать каждый кадр)
update(deltaTime: number)

// Ручной запуск взрыва
playExplosion(x, y, onComplete?)

// Очистка системы
destroy()
```

### Требования к Symbol

Система ожидает объект `symbol` с полями:
- `isScatter: boolean`
- `scatterType: 'blue' | 'gold' | 'red'`
- `cellContainer: PIXI.Container` (для глобальных координат)
- `SYMBOL_SIZE: number`
- Fallback: `currentX`, `currentY`

### Маппинг цветов

| scatterType | chestColor |
|-------------|------------|
| `blue` | `blue` |
| `gold` | `yellow` |
| `red` | `red` |

## Архитектура

### Поток выполнения

```
Symbol.shot event
       │
       ▼
startFlightFromScatter()
       │
       ├─► Захват координат (toGlobal)
       ├─► requestAnimationFrame (defer)
       │
       ▼
_createFlight()
       │
       ├─► Создать Spine-монетку (или fallback Graphics)
       ├─► Рассчитать arcHeight по расстоянию
       ├─► Добавить в activeFlights[]
       │
       ▼
update() каждый кадр
       │
       ├─► Обновить позицию по параболе
       ├─► Emit trail-частицы
       ├─► Render частиц в RenderTexture
       │
       ▼
При t >= 1 (приземление)
       │
       ├─► playExplosion()
       ├─► onFlightComplete(chestColor)
       └─► Cleanup монетки
```

### Параболическая траектория

```javascript
// Базовая позиция (линейная интерполяция)
const baseX = startX + (endX - startX) * t;
const baseY = startY + (endY - startY) * t;

// Вектор направления
const dirX = dx / distance;
const dirY = dy / distance;

// Перпендикуляр
const perpX = -dirY;
const perpY = dirX;

// Высота дуги (парабола)
const arcProgress = -4 * arcHeight * t * (t - 1);

// Финальная позиция
x = baseX + perpX * arcProgress;
y = baseY + perpY * arcProgress;
```

Дуга адаптивная: чем меньше расстояние — тем круче дуга.

### Изолированный additive для частиц

Частицы рендерятся в отдельную `RenderTexture`, затем отображаются на сцене через `Sprite` с `blendMode: "normal"`. Это даёт:
- Частицы светятся друг на друга (additive)
- Не "прожигают" фон сцены

```javascript
// Структура
particleContainer  → рендерится в → particleRenderTexture
                                            │
                                            ▼
                                     particleSprite (blendMode: normal)
                                            │
                                            ▼
                                        container (на сцене)
```

### Z-порядок

| Элемент | zIndex |
|---------|--------|
| Частицы (particleSprite) | -1 |
| Монетка | 100 |
| Взрыв | 10000 |

### Безопасное удаление Spine

Удаление Spine-объектов во время render cycle вызывает crash (`slotBatches` undefined). Решение — deferred destroy:

```javascript
_deferredDestroy(instance) {
  instance.visible = false;
  
  requestAnimationFrame(() => {
    instance.parent?.removeChild(instance);
    
    requestAnimationFrame(() => {
      instance.state?.clearTracks();
      instance.destroy();
    });
  });
}
```

Также важно: `startFlightFromScatter` откладывает создание через `requestAnimationFrame`, т.к. вызывается из Spine event callback.

## Интеграция с существующим проектом

### Пример index.html

```javascript
import { ScatterFlySystem } from './ScatterFlySystem.js';
import { Symbol } from './Symbol.js';
import { createAllChests, playJumpOnAll } from './ChestManager.js';

// После создания chests:
const scatterFlySystem = new ScatterFlySystem(app, {
  flyDuration: 0.45,
  coinScale: 0.66,
  explosionScale: 0.7,
  chestOffsetX: 30,
  chestOffsetY: 20,
  onFlightComplete: (chestColor) => {
    playJumpOnAll({ [chestColor]: chests[chestColor] });
  }
});

scatterFlySystem.setChests(chests);
await scatterFlySystem.init();

// Подключение к Symbol
Symbol.onScatterShot = (symbol) => {
  scatterFlySystem.startFlightFromScatter(symbol);
};

// В ticker
app.ticker.add(() => {
  const deltaTime = app.ticker.deltaMS / 1000;
  scatterFlySystem.update(deltaTime);
});
```

### Требования к Symbol.js

В анимации `hit` скаттера должен быть Spine event `shot`:

```javascript
// Symbol.js - playScatterHitAnimation()
const hitEntry = this.scatterSpineInstance.state.setAnimation(0, 'hit', false);
hitEntry.listener = {
  event: (entry, event) => {
    if (event.data.name === 'shot') {
      if (Symbol.onScatterShot) {
        Symbol.onScatterShot(this);
      }
    }
  }
};
```

## Тестирование

### Ручной тест из консоли

```javascript
window.testFlight = () => {
  const fakeSymbol = {
    isScatter: true,
    scatterType: 'blue', // или 'gold', 'red'
    currentX: 300,
    currentY: 400
  };
  scatterFlySystem.startFlightFromScatter(fakeSymbol);
};

testFlight();
```

### Нагрузочный тест

```javascript
// 10 перелётов подряд
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    testFlight();
  }, i * 100);
}
```

## Troubleshooting

| Проблема | Причина | Решение |
|----------|---------|---------|
| `slotBatches undefined` | Модификация сцены во время Spine callback | Используется `requestAnimationFrame` |
| Монетка вылетает не из центра | Не учтён offset родителя | Используется `toGlobal()` |
| Частицы "прожигают" фон | Additive на всю сцену | RenderTexture изоляция |
| Spine не создаётся | Ассеты не загружены | Проверить `await init()` |
| Взрыв не в том месте | Offset сундука | Настроить `chestOffsetX/Y` |

## Адаптация под другую игру

1. Заменить пути к ассетам в `_ensureAssetsLoaded()`
2. Настроить `_resolveChestColor()` под свой маппинг
3. Адаптировать требования к `symbol` в `startFlightFromScatter()`
4. Настроить цвета частиц в `_createParticleTextures()`
5. Подобрать масштабы и тайминги в конфиге
