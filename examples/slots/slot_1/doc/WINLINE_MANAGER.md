# WinLineManager - Менеджер выигрышных линий

## Обзор

`WinLineManager` управляет отображением выигрышных линий (winlines), их анимацией и показом сумм выигрышей. Интегрируется с Spine анимациями, winframes и мини-вином текстом.

## Основные функции

1. **Отображение винлайнов**: Spine анимации выигрышных линий
2. **Одновременный показ**: Все линии одновременно
3. **Последовательный перебор**: Циклический показ линий по одной
4. **Мини-вин тексты**: Показ сумм выигрышей с анимацией
5. **Синхронизация с winframes**: Подсветка выигрышных символов

## Структура

### Компоненты

- **Основной Spine**: Для одновременного показа всех линий
- **Отдельные Spine**: Индивидуальные инстансы для каждой линии (циклический перебор)
- **MiniWinText**: Класс для стилизованного текста выигрышей
- **WinFrameAnimation**: Ссылка на анимацию winframes для синхронизации

### Конфигурация

```javascript
spine: {
  winline: {
    enabled: true,
    skeletonPath: './spine/winline/skeleton.json',
    atlasPath: './spine/winline/atlas.json',
    position: { x: 960, y: 540 },
    scale: 1,
    zIndex: 99 // Под символами
  }
}
```

## Логика отображения

### 1. Одновременный показ (showAllLinesTogether)

Когда есть несколько выигрышных линий:

1. Все линии играют одновременно на разных треках
2. Показывается общая сумма выигрыша (центр поля, масштаб 1.1)
3. Показываются winframes на всех линиях
4. После завершения всех анимаций → переход к перебору

### 2. Последовательный перебор (startCycling)

Циклический показ линий по одной:

1. Скрывается общая сумма
2. Показывается первая линия на отдельном Spine инстансе
3. Показывается индивидуальная сумма (на уровне линии, масштаб 1.0)
4. Показываются winframes на текущей линии
5. После завершения → переход к следующей линии
6. Цикл повторяется до нажатия спин

### 3. Сброс (hideAllLines)

При нажатии на спин:

1. Останавливается перебор
2. Скрываются все линии
3. Скрывается текст выигрыша
4. Останавливаются winframes
5. Очищаются треки и сбрасываются слоты в setup pose

## Позиционирование винлайнов

Винлайны синхронизируются с контейнером рилов (`reelsContainer`) для получения сдвига от дебаггера:

```javascript
syncWithReelsContainer(reelsContainer, slotMachine) {
  this.reelsContainer = reelsContainer;
  this.updatePosition();
  
  // Добавляем winline в relatedElements для дебаггера
  if (slotMachine.debugEditor) {
    slotMachine.debugEditor.addRelatedElement('reelsContainer', 'winline', this.spineAnimation.getContainer());
  }
}
```

### Маппинг линий на позиции

Линии 1-5 соответствуют разным позициям на поле:

```javascript
getLinePositionIndex(lineNumber) {
  const lineMap = {
    1: 1, // Третий ряд (средний)
    2: 0, // Второй ряд (нижний)
    3: 2, // Верхняя горизонталь (четвертый ряд)
    4: 1, // Диагональ снизу-вверх (третий ряд)
    5: 1  // Диагональ сверху-вниз (третий ряд)
  };
  return lineMap[lineNumber];
}
```

## Мини-вин тексты

### Показ общей суммы

```javascript
showWinText(totalAmount, null); // lineNumber = null
// Позиция: центр игрового поля
// Масштаб: 1.1 (на 10% больше)
```

### Показ индивидуальной суммы

```javascript
showWinText(lineAmount, lineNumber);
// Позиция: на уровне линии
// Масштаб: 1.0 (обычный размер)
```

### Структура элемента

```
winTextGroup (Container)
  ├── ellipseSprite (Sprite) - фон Ellipse.png
  └── textSprite (Sprite) - стилизованный текст
```

### Анимация появления

- Начальное состояние: `scale = 0.5`, `alpha = 0.5`
- Целевое состояние: `scale = targetScale` (1.0 или 1.1), `alpha = 1.0`
- Приращение: 0.1 за кадр через `requestAnimationFrame`

## Интеграция с WinFrameAnimation

Винфреймы синхронизируются с винлайнами:

```javascript
// При одновременном показе
if (this.winFrameAnimation && this.reels) {
  this.winFrameAnimation.playOnLines(this.reels, this.activeLines);
}

// При переборе
if (this.winFrameAnimation && this.reels) {
  this.winFrameAnimation.playOnLine(this.reels, lineNumber);
}

// При завершении линии
if (this.winFrameAnimation) {
  this.winFrameAnimation.stop();
}
```

## Управление треками Spine

### Очистка треков

Перед установкой новой анимации трек очищается:

```javascript
clearTrackBeforeAnimation(trackIndex) {
  const trackEntry = this.spineAnimation.spine.state.getCurrent(trackIndex);
  if (trackEntry) {
    this.spineAnimation.spine.state.setEmptyAnimation(trackIndex, 0);
  }
  this.spineAnimation.spine.state.setEmptyAnimation(trackIndex, 0);
}
```

### Сброс в setup pose

Все слоты сбрасываются в setup pose (невидимое состояние):

```javascript
resetSlotsToSetupPose() {
  if (this.spineAnimation && this.spineAnimation.spine) {
    this.spineAnimation.spine.skeleton.setSlotsToSetupPose();
  }
}
```

## События анимации

Используется `TrackEntry.listener.complete` для определения завершения анимации:

```javascript
trackEntry.listener = {
  complete: (entry) => {
    // Переход к следующей линии
    this.showLineInCycle();
  }
};
```

## Z-индексы

- **Winlines**: `zIndex = 99` (под символами, символы zIndex = 100)
- **Winframes**: `zIndex = 110` (над символами)
- **Мини-вин тексты**: `zIndex = 115` (над winframes)

## Использование в SlotMachine

```javascript
// Инициализация
this.winLineManager = new WinLineManager(this.config, this.app, this.app.stage);
await this.winLineManager.init();
this.winLineManager.syncWithReelsContainer(this.reelsContainer, this);
this.winLineManager.setWinFrameAnimation(this.winFrameAnimation, this.reels);

// При остановке всех рилов
if (this.winLineManager && winLines && winLines.length > 0) {
  this.winLineManager.showLines(winLines);
}

// При нажатии на спин
if (this.winLineManager) {
  this.winLineManager.hideAllLines();
}
```

## Конфигурация сценариев

В `scenario.json` линии указываются в массиве `winLines`:

```json
{
  "matrix": [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  "winLines": [1, 2, 3, 4, 5]
}
```

Линии не определяются автоматически - они указываются в сценарии.

## Особенности реализации

1. **Индивидуальные Spine инстансы**: Для циклического перебора каждая линия использует свой Spine инстанс
2. **Сброс слотов**: Все слоты сбрасываются в setup pose перед новой анимацией
3. **Синхронизация позиций**: Винлайны получают сдвиг от дебаггера через `reelsContainer`
4. **Управление видимостью**: Контейнеры показываются/скрываются через `visible = true/false`

