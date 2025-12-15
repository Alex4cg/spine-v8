# CoinManager - Управление монетками и индикаторами

## Обзор

`CoinManager` - это класс, который управляет отображением Spine-монеток на игровом поле и индикаторами под рилами. Монетки заменяют обычные символы, когда в матрице появляется специальный символ-монетка (индекс 8).

## Основные концепции

### 1. Статичная матрица позиционирования

Монетки позиционируются не относительно движущихся символов на рилах, а относительно статичной сетки игрового поля. Это гарантирует точное позиционирование независимо от анимации рилов.

#### Структура матрицы

Игровое поле представляет собой сетку 3x3 (3 рила × 3 видимые позиции):

```
[0,0] [1,0] [2,0]  ← Верхний ряд (positionIndex = 2)
[0,1] [1,1] [2,1]  ← Средний ряд (positionIndex = 1)
[0,2] [1,2] [2,2]  ← Нижний ряд (positionIndex = 0)
```

Где:
- `reelIndex` (0, 1, 2) - номер рила (слева направо)
- `positionIndex` (0, 1, 2) - позиция на риле:
  - `0` = нижний видимый ряд (второй ряд в матрице)
  - `1` = средний ряд
  - `2` = верхний видимый ряд

#### Метод `getGridPosition(reelIndex, positionIndex)`

Вычисляет абсолютные координаты центра ячейки на основе статичной сетки:

```javascript
getGridPosition(reelIndex, positionIndex) {
  const startX = this.config.startPosition.x;
  const startY = this.config.startPosition.y;
  const symbolWidth = this.config.symbolSize.width;
  const symbolHeight = this.config.symbolSize.height;

  // Учитываем сдвиг от дебаггера (если reelsContainer сдвинут)
  const offsetX = this.reelsContainer ? this.reelsContainer.x : 0;
  const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;

  // Инвертируем positionIndex для Y:
  // Нижний (0) должен быть ниже на экране (больший Y)
  // Верхний (2) должен быть выше на экране (меньший Y)
  const maxPositionIndex = this.config.reels.symbolsPerReel - 1; // 2
  const invertedPositionIndex = maxPositionIndex - positionIndex;

  const x = startX + (reelIndex * symbolWidth) + (symbolWidth / 2) + offsetX;
  const y = startY + (invertedPositionIndex * symbolHeight) + (symbolHeight / 2) + offsetY;

  return { x, y };
}
```

**Важные особенности:**

1. **Синхронизация с дебаггером:** Позиции учитывают сдвиг `reelsContainer`, что позволяет монеткам следовать за игровым полем при его перемещении через `DebugPositionEditor`.

2. **Инверсия Y-координат:** В матрице `positionIndex = 0` соответствует нижнему ряду, но в экранных координатах меньший Y находится выше. Поэтому используется инверсия: `invertedPositionIndex = maxPositionIndex - positionIndex`.

3. **Центрирование:** Координаты вычисляются для центра ячейки, добавляя `symbolWidth/2` и `symbolHeight/2`.

#### Обновление позиций

При изменении позиции `reelsContainer` (через дебаггер) все монетки автоматически обновляют свои позиции:

```javascript
updateAllCoinPositions() {
  Object.keys(this.coinSpines).forEach(key => {
    const [reelIndex, positionIndex] = key.split('_').map(Number);
    const position = this.getGridPosition(reelIndex, positionIndex);
    const coinSpine = this.coinSpines[key];
    if (coinSpine) {
      coinSpine.setPosition(position.x, position.y);
    }
  });
}
```

Метод `syncWithReelsContainer(reelsContainer)` вызывается при инициализации для сохранения ссылки на контейнер рилов:

```javascript
syncWithReelsContainer(reelsContainer) {
  this.reelsContainer = reelsContainer;
  this.updateAllCoinPositions();
}
```

### 2. Подмена символов на Spine-монетки

Когда в матрице результатов появляется символ-монетка (индекс 8), соответствующий обычный символ визуально заменяется на Spine-анимацию монетки.

#### Процесс подмены

1. **Обнаружение монеток:** После остановки всех рилов (`onAllReelsStopped`) проверяется матрица результатов:

```javascript
// currentMatrix[position][reelIndex]
// position: 0 = верхний видимый, 1 = средний, 2 = нижний видимый
// В сетке: positionIndex 0 = нижний, 1 = средний, 2 = верхний
for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
  // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
  if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
    this.coinManager.showCoin(reelIndex, 0, 'regular');
  }
  // Проверяем средний (currentMatrix[1]) -> positionIndex 1
  if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
    this.coinManager.showCoin(reelIndex, 1, 'regular');
  }
  // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
  if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
    this.coinManager.showCoin(reelIndex, 2, 'regular');
  }
}
```

2. **Создание/показ Spine-монетки:** Метод `showCoin(reelIndex, positionIndex, skin)`:

```javascript
async showCoin(reelIndex, positionIndex, skin = 'regular') {
  const key = `${reelIndex}_${positionIndex}`;

  // Если Spine еще не создан - создаем
  if (!this.coinSpines[key]) {
    const position = this.getGridPosition(reelIndex, positionIndex);
    
    const coinSpine = new SpineAnimation(
      this.config,
      this.app,
      this.container,
      'coin',
      'idle',
      true // зациклено
    );

    await coinSpine.load();
    
    // Устанавливаем скин ('regular', 'mini', 'midi', 'major', 'grand')
    coinSpine.spine.skeleton.setSkinByName(skin);
    
    // Устанавливаем позицию на основе статичной сетки
    coinSpine.setPosition(position.x, position.y);
    
    // Устанавливаем zIndex (над символами, но под winframes)
    const container = coinSpine.getContainer();
    container.zIndex = 105; // Символы = 100, монетки = 105, winframes = 110
    
    this.coinSpines[key] = coinSpine;
  }

  // Запускаем анимацию idle в цикле
  const coinSpine = this.coinSpines[key];
  coinSpine.spine.state.setAnimation(0, 'idle', true);
  coinSpine.getContainer().visible = true;
  
  this.activeCoins.add(key);
}
```

**Особенности:**

- **Sprite Pooling:** Spine-монетки создаются один раз и переиспользуются. При повторном показе монетки на той же позиции не создается новый объект, а обновляется существующий.

- **Скины:** Поддерживаются разные скины монеток: `'regular'`, `'mini'`, `'midi'`, `'major'`, `'grand'` для визуального различия номиналов.

- **Анимация:** Все монетки играют анимацию `'idle'` в цикле.

- **Z-индекс:** Монетки имеют `zIndex = 105`, что помещает их над символами (100), но под winframes (110).

#### Скрытие монеток

Монетки скрываются при новом спине:

```javascript
hideAllCoins() {
  this.activeCoins.forEach(key => {
    const [reelIndex, positionIndex] = key.split('_').map(Number);
    this.hideCoin(reelIndex, positionIndex);
  });
}

hideCoin(reelIndex, positionIndex) {
  const key = `${reelIndex}_${positionIndex}`;
  if (this.coinSpines[key]) {
    const container = this.coinSpines[key].getContainer();
    container.visible = false;
    this.activeCoins.delete(key);
  }
}
```

### 3. Логика подсветки индикаторами

Под каждым рилом расположен статичный индикатор (лампочка), который загорается, когда на этом риле останавливается монетка.

#### Инициализация индикаторов

Индикаторы создаются один раз при инициализации `CoinManager`:

```javascript
async initIndicators() {
  // Создаем индикатор для каждого рила
  for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
    const position = this.getIndicatorPosition(reelIndex);
    
    const indicatorSpine = new SpineAnimation(
      this.config,
      this.app,
      this.indicatorsContainer, // Отдельный контейнер на stage
      'coin_indicator',
      null,
      false
    );

    await indicatorSpine.load();
    
    // Устанавливаем статичную позицию относительно контейнера
    indicatorSpine.setPosition(position.x, position.y);
    
    // Устанавливаем zIndex
    const container = indicatorSpine.getContainer();
    container.zIndex = 104; // Под монетками (105), но над символами (100)
    
    // ВРЕМЕННО: показываем все индикаторы с анимацией idle для настройки позиций
    container.visible = true;
    indicatorSpine.spine.state.setAnimation(0, 'idle', true);
    
    this.coinIndicators[reelIndex] = indicatorSpine;
  }
}
```

#### Позиционирование индикаторов

Индикаторы находятся в отдельном контейнере `coinIndicatorsContainer`, который позиционируется непосредственно на `stage` (не в `reelsContainer`, чтобы избежать обрезки маской):

```javascript
getIndicatorPosition(reelIndex) {
  const symbolWidth = this.config.symbolSize.width;

  // X: центр рила (относительно контейнера индикаторов)
  const x = (reelIndex * symbolWidth) + (symbolWidth / 2);
  
  // Y = 0 (позиция контейнера настраивается через дебаггер)
  const y = 0;

  return { x, y };
}
```

Позиция контейнера `coinIndicatorsContainer` настраивается через `DebugPositionEditor` один раз (по умолчанию: x: 507, y: 832), после чего все 3 индикатора имеют одинаковую Y-координату (0 относительно контейнера), но разные X-координаты (центры рилов).

#### Логика активации индикаторов

После остановки всех рилов, для каждого рила проверяется наличие монеток, и активируется соответствующий индикатор:

```javascript
for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
  let hasCoin = false;
  
  // Проверяем все позиции на наличие монетки (индекс 8)
  if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
    hasCoin = true;
  }
  if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
    hasCoin = true;
  }
  if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
    hasCoin = true;
  }
  
  // Показываем или скрываем индикатор под рилом
  if (hasCoin) {
    this.coinManager.showIndicator(reelIndex);
  } else {
    this.coinManager.hideIndicator(reelIndex);
  }
}
```

#### Анимация индикаторов

Индикаторы имеют две анимации:

1. **`in`** - анимация появления (проигрывается один раз)
2. **`idle`** - анимация в цикле (после завершения `in`)

```javascript
showIndicator(reelIndex) {
  const indicator = this.coinIndicators[reelIndex];
  const container = indicator.getContainer();
  container.visible = true;

  // Запускаем анимацию появления (in), затем переключаемся на idle
  const trackEntry = indicator.spine.state.setAnimation(0, 'in', false);
  
  if (trackEntry) {
    trackEntry.listener = {
      complete: () => {
        // После завершения 'in' переключаемся на 'idle' в цикле
        indicator.spine.state.setAnimation(0, 'idle', true);
      }
    };
  }
}
```

#### Скрытие индикаторов

Индикаторы скрываются резко (без анимации) при нажатии кнопки спин:

```javascript
hideIndicator(reelIndex) {
  if (this.coinIndicators[reelIndex]) {
    const container = this.coinIndicators[reelIndex].getContainer();
    container.visible = false;
  }
}

hideAllIndicators() {
  Object.keys(this.coinIndicators).forEach(reelIndex => {
    this.hideIndicator(Number(reelIndex));
  });
}
```

## Структура данных

### Пул монеток

```javascript
this.coinSpines = {}; // { "reelIndex_positionIndex": SpineAnimation }
this.activeCoins = new Set(); // Активные ключи монеток
```

Ключ формируется как строка `"reelIndex_positionIndex"`, например `"0_1"` для среднего символа на первом риле.

### Пул индикаторов

```javascript
this.coinIndicators = {}; // { "reelIndex": SpineAnimation }
```

Ключ - это индекс рила (0, 1, 2).

## Интеграция с SlotMachine

### Инициализация

```javascript
// Создаем контейнер для монеток
this.spineContainer = new PIXI.Container();
this.spineContainer.zIndex = 105;
this.app.stage.addChild(this.spineContainer);

// Создаем отдельный контейнер для индикаторов (на stage, не в reelsContainer)
this.coinIndicatorsContainer = new PIXI.Container();
this.coinIndicatorsContainer.x = 507; // По умолчанию
this.coinIndicatorsContainer.y = 832; // По умолчанию
this.coinIndicatorsContainer.zIndex = 104;
this.app.stage.addChild(this.coinIndicatorsContainer);

// Создаем CoinManager
this.coinManager = new CoinManager(
  this.config,
  this.app,
  this.spineContainer,
  this.coinIndicatorsContainer
);

// Синхронизируем с reelsContainer для учета сдвига от дебаггера
this.coinManager.syncWithReelsContainer(this.reelsContainer);

// Инициализируем статичные индикаторы
await this.coinManager.initIndicators();
```

### Обработка спина

```javascript
async spin() {
  // Скрываем все монетки и индикаторы перед новым спином
  if (this.coinManager) {
    this.coinManager.hideAllCoins();
    this.coinManager.hideAllIndicators();
  }
  
  // ... логика спина ...
}

async onAllReelsStopped() {
  // ... получение матрицы результатов ...
  
  // Показываем монетки и индикаторы
  if (this.coinManager && currentMatrix) {
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      let hasCoin = false;
      
      // Проверяем наличие монеток и показываем их
      // ...
      
      // Показываем или скрываем индикатор
      if (hasCoin) {
        this.coinManager.showIndicator(reelIndex);
      } else {
        this.coinManager.hideIndicator(reelIndex);
      }
    }
  }
}
```

## Z-индексы

Порядок отрисовки элементов (от нижнего к верхнему):

- **Символы:** `zIndex = 100`
- **Индикаторы:** `zIndex = 104`
- **Монетки:** `zIndex = 105`
- **Winframes:** `zIndex = 110`
- **Winlines:** `zIndex = 99` (под символами)

## Настройка через DebugPositionEditor

### Элементы, доступные для настройки

1. **`coinIndicatorsContainer`** - контейнер с индикаторами
   - Позиция X, Y настраивается один раз для всех индикаторов
   - Значения по умолчанию: x: 507, y: 832

2. **`reelsContainer`** - при перемещении автоматически обновляются позиции всех монеток (через `syncWithReelsContainer`)

### Временная подсветка всех индикаторов

Для облегчения настройки позиций, при инициализации все индикаторы временно показываются с анимацией `idle`. После настройки эту логику можно убрать, установив `container.visible = false` по умолчанию.

## Примеры использования

### Сценарий с монетками

В файле `matrix/scenario.json` монетка обозначается индексом `8`:

```json
{
  "matrix": [[0, 3, 6], [8, 5, 0], [1, 4, 7]],
  "winLines": []
}
```

Здесь монетка находится на среднем ряду (`currentMatrix[1]`) первого рила (`reelIndex = 0`), что соответствует `positionIndex = 1` в статичной сетке.

### Множественные монетки

```json
{
  "matrix": [[8, 3, 6], [8, 5, 0], [1, 8, 7]],
  "winLines": []
}
```

В этом случае монетки появятся:
- Верхний ряд, первый рил (`reelIndex=0, positionIndex=2`)
- Средний ряд, первый рил (`reelIndex=0, positionIndex=1`)
- Нижний ряд, третий рил (`reelIndex=2, positionIndex=0`)

И индикаторы загорятся под первым и третьим рилами.

## Технические детали

### Синхронизация с дебаггером

При перемещении `reelsContainer` через `DebugPositionEditor`, все монетки должны обновиться. Это реализовано через:

1. Сохранение ссылки на `reelsContainer` в `CoinManager`
2. Вызов `updateAllCoinPositions()` при изменении позиции `reelsContainer`
3. Пересчет позиций всех монеток с учетом новых `offsetX` и `offsetY`

Индикаторы не требуют синхронизации, так как они находятся в отдельном контейнере, который позиционируется независимо.

### Производительность

- **Sprite Pooling:** Spine-монетки и индикаторы создаются один раз и переиспользуются
- **Статичное позиционирование:** Позиции вычисляются на основе фиксированной сетки, не требуется отслеживание движущихся символов
- **Минимальные обновления:** При скрытии/показе используется только `visible`, без пересоздания объектов

