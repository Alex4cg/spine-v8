# Логика генерации сценариев (ScenarioGeneratorV3)

Документ описывает **логику генератора сценариев** (ScenarioGeneratorV3). Генератор работает пошагово: **насыпал → сохранил → нашёл выигрыши/бомбы → записал → досыпал → сохранил**. Создаётся последовательность шагов с полной информацией о сетке, выигрышных группах, разметке и выплатах. Включает логику работы бомбы.

---

## 0. Типы событий в сценарии

### Полный список событий

| Событие | Описание | Что происходит с матрицей |
|---------|----------|---------------------------|
| `spin` | Спин без выигрыша и без бомбы | Матрица не меняется, серия завершена |
| `spin-win` | Спин с выигрышем и без бомбы | Удаление выигрышных → уплотнение → досыпание → каскад |
| `spin-win-bomb` | Спин с выигрышем и с бомбой | Мультипликатор x5 к выплатам. Удаление выигрышных **и бомбы** → уплотнение → досыпание → каскад |
| `spin-bomb` | Спин с бомбой без выигрыша | Сетка ДО взрыва. Взрыв бомбы + 8 соседей → уплотнение → досыпание → событие `cascade`/`cascade-win` |
| `cascade` | Каскад без выигрыша | Матрица не меняется, серия завершена |
| `cascade-win` | Каскад с выигрышем | Удаление выигрышных → уплотнение → досыпание → проверка |
| `cascade-win-bomb` | Каскад с выигрышем и с бомбой | Мультипликатор x5 к выплатам. Удаление выигрышных **и бомбы** → уплотнение → досыпание → проверка |
| `cascade-bomb` | Каскад с бомбой без выигрыша | Сетка ДО взрыва. Взрыв бомбы + 8 соседей → уплотнение → досыпание → событие `cascade`/`cascade-win` |

### Логика событий с бомбой

**Если есть выигрыш + бомба:**
- Создаётся событие `spin-win-bomb` или `cascade-win-bomb` (не отдельное `bomb`).
- Бомба применяет мультипликатор x5 к выплатам.
- Бомба **удаляется вместе с выигрышными символами** (одним шагом).
- Матрица меняется из-за удаления выигрышных символов и бомбы.

**Если нет выигрыша + бомба:**
- Создаётся событие `spin-bomb` или `cascade-bomb` (сетка ДО взрыва).
- Событие содержит `bombPosition`, `explodedPositions`, `bombType: 'explode'`.
- После обработки взрыва создаётся событие `cascade` или `cascade-win` (сетка ПОСЛЕ взрыва и досыпания).
- CascadeManager обрабатывает взрыв, затем переходит к следующему шагу.

### Правила последовательности событий

- `spin` или `cascade` без `-win` всегда завершают серию.
- `spin-win` / `cascade-win` всегда имеют следующий шаг (каскад).
- `spin-win-bomb` / `cascade-win-bomb` всегда имеют следующий шаг (каскад).
- `spin-bomb` / `cascade-bomb` всегда имеют следующий шаг (`cascade` или `cascade-win` — состояние ПОСЛЕ взрыва).

---

## 1. Формат данных

### Сетка
- **Формат:** `grid[row][col]` — двумерный массив: `row` 0…4 (сверху вниз), `col` 0…5 (слева направо).
- **Значения:** `0`…`symbolCount-1` (типы символов), `8` (`BOMB_SYMBOL_TYPE`) — бомба, `-1` — пустая ячейка (после удаления).
- **Примечание:** В CascadeManager используется `grid[col][row]`; при загрузке сценария выполняется конвертация.

### Бомба
- **Тип символа:** `BOMB_SYMBOL_TYPE = 8` (отдельно от обычных 0–7).
- **Ограничение:** максимум **одна бомба** за одно насыпание (спин или досыпание).
- **Идентификация:** в сетке бомба — отдельный `symbolType`.

### Выигрышные группы
- **Минимум для выигрыша:** `minSymbolsForWin` (по умолчанию 7).
- **Группа:** все символы одного типа с количеством ≥ 7.
- **Структура группы:**
  ```javascript
  {
    symbolType: 0-7,
    count: 7+,
    groupId: 1, 2, 3...,
    symbolName: 'h1_lion'  // имя из symbolNames / payouts
  }
  ```

### Разметка групп (groupMarkup)
- **Формат:** `groupMarkup[row][col]`, размерность как у сетки.
- **Значения:** `0` — не выигрышный, `1+` — номер группы выигрышных символов.
- **Назначение:** по разметке находятся все позиции каждой выигрышной группы.

---

## 2. Пошаговая логика генератора

Общий принцип: **насыпал → сохранил матрицу → нашёл выигрыши и бомбы → записал позиции и результаты → досыпал → сохранил**.

### Шаг 1: Генерация поля (спин)

**Метод:** `generateRandomGrid(allowBomb = true)`

- Для каждой ячейки `grid[row][col]` — случайное число от `0` до `symbolCount-1`.
- **Бомба:** с вероятностью `bombSpinChance` (3%) одна ячейка заменяется на бомбу (`8`). Максимум одна бомба за спин.
- Возвращает сетку `[row][col]`.

### Шаг 2: Подсчёт символов

**Метод:** `countSymbols(grid)`

- Обход всей сетки, подсчёт количества каждого типа символа.
- Бомба (`BOMB_SYMBOL_TYPE`) **не учитывается**.
- Возвращает `Map<symbolType, count>`.

### Шаг 3: Поиск выигрышных групп

**Метод:** `findWinningGroups(grid)`

- Использует `countSymbols(grid)`.
- Для каждого типа с `count >= minSymbolsForWin` создаётся группа с уникальным `groupId` и `symbolName` из `symbolNames[symbolType]`.
- Группы сортируются по `symbolType`.
- Группа — **все** символы данного типа на поле (7+), бомба не участвует.

### Шаг 4: Разметка групп

**Метод:** `createGroupMarkup(grid, winningGroups)`

- Строится маппинг `symbolType → groupId`.
- Для каждой ячейки: если символ в выигрышной группе → `markup[row][col] = groupId`, иначе `0`.

### Шаг 5: Позиция бомбы

**Метод:** `findBombPosition(grid)`

- Поиск ячейки с `BOMB_SYMBOL_TYPE`. Возврат `{ row, col }` или `null`.

### Шаг 6: Соседи бомбы

**Метод:** `findBombNeighbors(row, col)`

- Все 8 соседних ячеек (включая диагонали) с проверкой границ. Возврат `[{row, col}, ...]`.

### Шаг 7: Позиции выигрышных символов по группам

**Метод:** `findWinningPositionsFromGroups(grid, winningGroups)`

- Для каждой группы по `symbolType` собираются все ячейки с этим типом в сетке.
- Возвращает `Set` строк `"row,col"`.

### Шаг 8: Удаление символов

**Метод:** `removeSymbols(grid, positions)`

- `positions` — `Set("row,col")`.
- Для каждой позиции в сетке ставится `-1`, остальное копируется. Возвращается новая сетка.

### Шаг 9: Уплотнение колонок

**Метод:** `compactColumns(grid)`

- Для каждой колонки: сбор непустых символов снизу вверх, размещение снизу вверх; сверху — `-1` и запись в `emptySpots`.
- **Результат:** `{ grid: compacted, emptySpots: [{row, col}, ...] }`.
- Логика совпадает с `CascadeManager.compactColumns()`.

### Шаг 10: Заполнение пустых мест

**Метод:** `fillEmptySpots(grid, emptySpots, getNextSymbol, bombAlreadyUsed)`

- Сортировка `emptySpots`: сначала по `col`, затем по `row`.
- Для каждого пустого места: если можно (нет бомбы после уплотнения и бомба ещё не использована) — с вероятностью `bombRefillChance` подставляется бомба; иначе — `getNextSymbol(refillIndex)`.
- Максимум одна бомба за досыпание. Возврат `{ grid: filled, bombUsed }`.

### Шаг 11: Расчёт выплат

**Методы:** `calculatePayouts(winningGroups)`, `_getPayoutsTable()`, `_getPayoutForCountAndSymbol(payoutsTable, count, symbolName)`

- Таблица выплат берётся из `payoutsConfig.payouts` или из самого `payoutsConfig`.
- Для каждой группы (кроме бомбы): по `count` и `symbolName` ищется выплата в таблице (ключи `"7"`, `"8"`, …; имена символов: `h1_lion`, `h2_bull`, `h3_bear`, `h4_wolf`, `l1_revolver`, `l2_bottle`, `l3_horseshoe`, `l4_cactus`).
- Если точного `count` нет (например 31), используется ближайший меньший ключ (например 30).
- **Результат:** `{ payouts: [...], totalPayout: number }`.

### Шаг 12: Создание события

**Метод:** `createEvent(grid, eventType, winningGroups, bombPosition, bombAlreadyUsed)`

- Строятся `groupMarkup`, `payouts`, `totalPayout` через `createGroupMarkup` и `calculatePayouts`.
- Формируется объект события: `event`, `grid`, `groupMarkup`, `winningGroups`, `payouts`, `totalPayout`.
- Если есть бомба:
  - при выигрыше: `bombType: 'multiplier'`, `bombPosition`, `multiplier`, `totalPayout *= multiplier`;
  - без выигрыша: `bombType: 'explode'`, `bombPosition`, `explodedPositions` (бомба + 8 соседей).

---

## 3. Генерация одного спина с каскадами

**Метод:** `generateSpinWithCascades(getSpinGrid, getRefillSymbol)`

### 3.1. Начальное поле и первый шаг

1. `currentGrid = getSpinGrid()`.
2. `winningGroups = findWinningGroups(currentGrid)`, `bombPosition = findBombPosition(currentGrid)`.
3. Тип события спина:
   - выигрыш + бомба → `spin-win-bomb`;
   - выигрыш → `spin-win`;
   - только бомба → `spin-bomb`;
   - иначе → `spin`.
4. В массив шагов добавляется `createEvent(currentGrid, spinEventType, winningGroups, bombPosition, …)`.
5. Если нет выигрыша и нет бомбы — возврат (один шаг `spin`).

### 3.2. Обработка после спина

- **Бомба без выигрыша:** удаляются бомба и соседи (`removeSymbols` по `explodedPositions`), `bombAlreadyUsed = true`.
- **Выигрыш (с бомбой или без):** `winningPositions = findWinningPositionsFromGroups(...)`; при наличии бомбы в позиции удаления добавляется ячейка бомбы. Затем `currentGrid = removeSymbols(currentGrid, winningPositions)`.
- Уплотнение: `compactColumns(currentGrid)`.
- Досыпание: `fillEmptySpots(..., getRefillSymbol(0, refillIndex), bombAlreadyUsed)`.
- Обновление: `currentGrid = filled`, пересчёт `winningGroups` и `bombPosition` на новой сетке.

### 3.3. Завершение или цикл каскадов

- Если после досыпания нет выигрыша и нет бомбы — добавляется шаг `cascade` с текущей сеткой и возврат.
- Иначе запускается цикл каскадов.

### 3.4. Цикл каскадов

На каждой итерации:

1. Тип каскада: выигрыш+бомба → `cascade-win-bomb`, выигрыш → `cascade-win`, только бомба → `cascade-bomb`, иначе → `cascade`.
2. В шаги добавляется `createEvent(currentGrid, cascadeEventType, winningGroups, bombPosition, …)`.
3. Если нет выигрыша и нет бомбы — выход из цикла.
4. Обработка:
   - бомба без выигрыша: удаление бомбы и соседей;
   - выигрыш: удаление выигрышных (при наличии бомбы — бомба тоже в множестве удаления).
5. Уплотнение и досыпание (`compactColumns`, `fillEmptySpots` с `getRefillSymbol(cascadeStepIndex, refillIndex)`).
6. Обновление `currentGrid`, `winningGroups`, `bombPosition`, увеличение `cascadeStepIndex`.

**Результат:** массив шагов сценария для одного спина.

---

## 4. Генерация полного сценария

**Метод:** `generateScenario(spinCount)`

1. `reset()` — очистка сценария.
2. Для каждого из `spinCount` спинов:
   - **Гарантия хотя бы одного простого spin:** если простой `spin` ещё не был и (это последний спин или `Math.random() < 0.3`), то `getSpinGrid = () => generateGridWithoutWinsAndBombs()`, иначе `getSpinGrid = () => generateRandomGrid()`.
   - `generateGridWithoutWinsAndBombs()`: до `maxAttempts` раз генерируется сетка без бомбы (`generateRandomGrid(false)`); подходит первая без выигрышей (`findWinningGroups` пустой).
   - Вызов `generateSpinWithCascades(getSpinGrid, (cascadeStepIndex, refillIndex) => Math.floor(Math.random() * symbolCount))`.
   - Все полученные шаги добавляются в общий сценарий.
3. Возврат полного массива шагов.

---

## 5. Структура событий с бомбой

### spin-win-bomb / cascade-win-bomb

```javascript
{
  event: 'spin-win-bomb',  // или 'cascade-win-bomb'
  bombType: 'multiplier',
  bombPosition: { row, col },
  multiplier: 5,
  grid: number[][],        // сетка до удаления выигрышных и бомбы
  winningGroups: [...],
  groupMarkup: number[][],
  payouts: [...],          // выплаты до умножения
  totalPayout: number      // выплаты после умножения (×5)
}
```

Бомба удаляется **вместе** с выигрышными символами в одном шаге.

### spin-bomb / cascade-bomb

```javascript
{
  event: 'spin-bomb',  // или 'cascade-bomb'
  bombType: 'explode',
  bombPosition: { row, col },
  explodedPositions: [{ row, col }, ...],  // бомба + до 8 соседей
  grid: number[][],    // сетка ДО взрыва
  winningGroups: [],
  groupMarkup: number[][],
  payouts: [],
  totalPayout: 0
}
```

Следующий шаг в сценарии — всегда `cascade` или `cascade-win` с сеткой **ПОСЛЕ** взрыва и досыпания.

---

## 6. Выплаты (payouts)

- Источник: `payoutsConfig` (например из `payouts.json`). Таблица: `payoutsConfig.payouts` или сам объект с ключами `"5"`, `"6"`, … `"30"` и именами символов.
- Имена символов в таблице должны совпадать с `symbolNames` генератора: `h1_lion`, `h2_bull`, `h3_bear`, `h4_wolf`, `l1_revolver`, `l2_bottle`, `l3_horseshoe`, `l4_cactus`.
- Для каждого выигрыша по группе берётся выплата по `count` и `symbolName`; при отсутствии точного `count` используется ближайший меньший ключ.
- В каждом шаге с выигрышем заполняются `payouts` и `totalPayout`; при бомбе-множителе `totalPayout` уже с учётом ×5.

---

## 7. Важные детали реализации

### Порядок заполнения пустых мест
- Сначала по колонке (0→5), затем по ряду (0→4). Совпадает с порядком в CascadeManager.

### Уплотнение колонок
- Совпадает с `CascadeManager.compactColumns()`: сбор снизу вверх, размещение снизу вверх.

### Выигрышные группы
- Все символы одного типа 7+ на поле (без учёта соседства). Бомба не участвует в группах.

### Бомба
- Максимум одна бомба за одно насыпание. При выигрыше с бомбой — бомба удаляется вместе с выигрышными (multiplier). При взрыве — бомба + до 8 соседей, затем уплотнение и досыпание.

### Формат сетки
- Генератор: `grid[row][col]`. CascadeManager: `grid[col][row]`; при загрузке сценария выполняется конвертация.

---

## 8. Использование сценария в CascadeManager

- При загрузке: конвертация `grid[row][col]` → `grid[col][row]`.
- Для `spin-win-bomb` и `cascade-win-bomb`: в список символов на удаление добавляется и бомба по `bombPosition` (CascadeManager удаляет выигрышные и бомбу одним шагом).
- Для `spin-bomb` и `cascade-bomb`: по `explodedPositions` удаляются бомба и соседи, затем переход к следующему шагу (`cascade`/`cascade-win`).

---

При изменении логики генератора обновите этот документ и проверьте согласованность с CascadeManager (уплотнение, порядок заполнения, обработка бомбы).
