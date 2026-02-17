# Архитектура каскадного слота (slot_5)

Документ описывает **единственный принятый в проекте** способ организации кода: состояния, владение кнопкой спин, цикл каскада, связка PixiJS + Spine. При доработках и при работе с ИИ **следуйте этой схеме**, чтобы не смешивать подходы и не вносить баги.

---

## 1. Стек и роли

| Компонент | Роль |
|-----------|------|
| **PixiJS** | Рендер. Контейнеры (`PIXI.Container`), спрайты символов, позиции сетки. Игровой цикл — один `app.ticker` с вызовом `grid.update(deltaTime)`. |
| **Spine** | Анимации символов: **bounce** при приземлении, **win → disappearance** при удалении выигрышных. Один экземпляр Spine на символ создаётся по требованию, по завершении анимации удаляется. |
| **CascadeManager** | Владелец логики: состояния, сетка, спин, каскад (remove → compact → fill → check). Не владеет DOM. Управляет трансформациями поля (shake, scale) через `shakeContainer`. |
| **UIController** | Только UI: кнопка спин (DOM), инпуты задержек. Хранит таймер разблокировки кнопки; CascadeManager вызывает `_blockSpinButton()`, но **не** разблокирует кнопку сам. |
| **Symbol** | Один символ: PixiJS-контейнер + спрайт текстуры, опционально подмена на Spine для анимаций. Движение и колбэк приземления. Поддерживает бомбы (`isBomb`) и скаттеры (`isScatter`). |
| **MiniWinManager** | Показ мини-выигрышей (mini wins) и мини-тотала во время каскада. Работает внутри `shakeContainer`. |
| **TotalWinDisplay** | Показ накопительного Total Win за серию каскадов. Позиционируется относительно якоря, управляется через DebugMenu. |

---

## 2. Кнопка спин — кто что делает

- **Владелец кнопки (DOM и таймер):** `UIController.initSpinButton(spinButton, grid)`.
- При клике: кнопка **сразу** `disabled = true`, текст "SPINNING...". Очищается предыдущий таймер разблокировки.
- Вызывается `await grid.cascade()`. Блокировка кнопки на время спина делается **из CascadeManager**: при входе в `cascade()` и в `processCascade()` вызывается `grid._blockSpinButton()`, который в UIController ставит кнопку в disabled и **запускает таймер на 2 секунды** до разблокировки. То есть разблокирует кнопку **только UIController по таймеру**, не CascadeManager по завершении анимации.
- При ошибке в `cascade()` UIController в catch вызывает `grid.reset()` и сам ставит таймер разблокировки (2 сек).

**Важно:** Не добавлять разблокировку кнопки в конец `cascade()` или `processCascade()` — это приведёт к двойной разблокировке и рассинхрону. Только таймер в UIController.

**Ограничение:** Таймер разблокировки всегда 2 секунды от последнего вызова `_blockSpinButton()`. При длинной серии каскадов каждый вызов `processCascade()` снова вызывает `_blockSpinButton()`, то есть таймер сбрасывается. Кнопка разблокируется через 2 сек после **последнего** такого вызова, а не по факту перехода в IDLE. Если нужно разблокировать только по завершении всей цепочки — потребуется изменить контракт (например, callback из CascadeManager в UI при `_setIdle()`).

---

## 3. Состояния (CascadeManager)

Используется один набор состояний `GAME_STATE`:

| Состояние | Когда |
|-----------|--------|
| `IDLE` | Ожидание. Можно нажать спин. |
| `SPINNING` | Идёт основной спин: старые символы падают вниз, новые созданы и падают. |
| `WAITING_LANDING` | Символы падают; ждём приземления, после чего будет проверка выигрыша. |
| `CHECKING_WINS` | Выполняется проверка выигрышей (и возможный переход к remove/cascade). |
| `REMOVING_WINS` | Проигрываются win → disappearance на выигрышных символах. |
| `COMPACTING` | Уплотнение колонок (символы падают в пустоты). |
| `FILLING` | Досыпание новых символов сверху и их падение. |

Проверка выигрыша (`_onAllLanded`) допустима только когда:
- в обычном режиме: `gameState === WAITING_LANDING || gameState === IDLE`;
- в режиме сценария: не должно быть `REMOVING_WINS`, `COMPACTING`, `FILLING`, `SPINNING`.

Дополнительно используются флаги `winCheckProcessed` и `winCheckPending`, чтобы не вызывать проверку выигрыша дважды.

**Важно:** Перед проверкой выигрыша вызывается `_findLastFallingSymbol()` — если есть падающие символы, проверка откладывается. Это предотвращает преждевременные проверки до полного приземления всех символов.

---

## 4. Цикл одного спина (cascade())

Вызов: из обработчика кнопки спин: `await grid.cascade()`.

Последовательность:

1. Если `isSpinning` — вызвать `reset()` (сброс таймеров и анимации), затем **продолжить** выполнение (return нет).
2. В режиме сценария: проверить, что текущий шаг — `spin` или `spin-win`; иначе выйти.
3. `isSpinning = true`, `gameState = SPINNING`, сброс `winCheckProcessed`/`winCheckPending`, `_blockSpinButton()`.
4. **Старые символы:** `_prepareOldSymbols()` (все текущие символы в `oldSymbols`, сетка обнулена, targetY внизу экрана), затем `await _startOldSymbolsFall(oldSymbolsMap)` — падение по колонкам с задержками, после чего задержка `NEW_MATRIX_DELAY`.
5. **Новые символы:** `_createNewSymbols()` — заполнение `grid[col][row]` новыми `Symbol`, для каждого вызывается `_setupLandedCallback(symbol)`.
6. **Падение новых:** `await _startCascadeFall()` — по колонкам с задержками вызывается `symbol.startFall()`.
7. `isSpinning = false`, `gameState = WAITING_LANDING`.
8. В обычном режиме: `_scheduleWinCheck(timeMs)` планирует вызов `_onAllLanded()` по таймеру. Кроме того, у **каждого** символа в колбэке приземления стоит `setTimeout(100, _onAllLanded)`. Срабатывает тот вызов, который выполнится первым; остальные отсекаются флагами `winCheckProcessed`/`winCheckPending`. В режиме сценария таймер не ставится — проверка только по колбэкам приземления.

Никакой другой код не должен менять порядок этих шагов или подменять их на «спин без старых символов» / «спин без таймера проверки» без явной необходимости и синхронизации с этим документом.

---

## 5. Приземление символа и проверка выигрыша

- В `Symbol.update(deltaTime)` при достижении `targetY`: `isFalling = false`, вызывается `onLandedCallback`, затем колбэк обнуляется.
- Колбэк задаётся в `_setupLandedCallback(symbol)`:
  - вызвать `symbol.showSpineAnimation()` (bounce);
  - через `setTimeout(100)` вызвать `this._onAllLanded()` (если ещё не `winCheckProcessed` и не `winCheckPending`).

Много символов приземляются в разное время; проверка выигрыша должна выполниться **один раз**. В обычном режиме возможны два источника вызова `_onAllLanded()`: таймер `_scheduleWinCheck(timeMs)` и колбэк приземления любого символа (с задержкой 100 ms). Первый сработавший вызов проходит, остальные отсекаются в начале `_onAllLanded()` по флагам `winCheckProcessed`/`winCheckPending`.

---

## 6. _onAllLanded() и что дальше

- Проверки: `hasSpunOnce`, допустимый `gameState`, не `winCheckProcessed` и не `winCheckPending`.
- Установить `gameState = CHECKING_WINS`, `winCheckProcessed = true`, `winCheckPending = true`.
- Через `setTimeout(DELAY_BEFORE_WIN_CHECK_MS)` (100–150 ms):
  - `winCheckPending = false`;
  - получить список выигрышных символов: в режиме сценария — `_getWinningSymbolsFromScenario()`, иначе — `findWinningCombinations()`;
  - если есть следующий шаг сценария `cascade`/`cascade-win` — `_handleScenarioWinCheck(winningSymbols)`;
  - иначе если есть выигрыш — `_handleWin(winningSymbols)`;
  - иначе — завершение каскада: при сценарии при необходимости `_handleScenarioNoWin()`, затем `_setIdle()`, `winCheckProcessed = false`.

---

## 7. Удаление выигрышей и цикл каскада

- **_handleWin(winningSymbols):** задержка 700 ms, `gameState = REMOVING_WINS`, затем `await _removeWinningSymbolsWithWinAnimation(winningSymbols)`, затем `await processCascade()`.
- **_removeWinningSymbolsWithWinAnimation:** для каждого символа обнулить ячейку `grid[col][row]`, вызвать `symbol.showWinAnimation(onComplete)`; в onComplete — `symbol.destroy()`, подсчёт завершённых; когда все — resolve Promise.

**processCascade():**

1. Защита: если уже `COMPACTING` или `FILLING` — выйти.
2. `gameState = COMPACTING`, `_blockSpinButton()`.
3. `await _processCascadeCompacting()` → вызывается `compactColumns()`: по колонкам символы сдвигаются вниз в сетке, тем, кто переместился, выставляется новая targetY и `startFall()`, для них ставится `_setupLandedCallback` если ещё не было. Возвращается `{ hasMoved, emptySpots }`.
4. Если есть `emptySpots`: `await _processCascadeFilling(emptySpots)` — создаются новые символы в пустых ячейках, ставится колбэк приземления, запускается падение, `gameState = WAITING_LANDING`. Иначе — `_processCascadeCompactingOnly(hasMoved)` (только WAITING_LANDING; если никто не двигался — сразу запланировать проверку выигрыша).
5. В обычном режиме: `_scheduleWinCheck(timeMs)` с рассчитанным временем до приземления последнего символа.
6. Когда все приземлятся — снова вызовется `_onAllLanded()` и при наличии выигрыша цикл повторится (remove → processCascade → …). Если выигрышей нет — `_setIdle()`.

Не смешивать с другими способами «досыпки» или «уплотнения» (например, не вводить второй путь уплотнения без вызова `compactColumns()` и без перехода в те же состояния).

---

## 8. Symbol и Spine

- **Сетка данных:** `grid[col][row]` — экземпляр `Symbol`. Координаты ячеек — `gridPositions[col][row]` из конфига (центр ячейки).
- **Symbol:** `cellContainer` (PIXI.Container) — позиция задаётся так, что центр контейнера в `(currentX, currentY)`: `cellContainer.x = currentX - SYMBOL_SIZE/2`, `cellContainer.y = currentY - SYMBOL_SIZE/2`. Внутри: спрайт текстуры (основной вид), опционально экземпляр Spine.
- **Типы символов:**
  - **Обычные символы:** `textureIndex` 0-7
  - **Бомба:** `textureIndex = 8`, `isBomb = true`. Имеет постоянный Spine-экземпляр для idle-анимации. При взрыве удаляет соседние символы.
  - **Скаттеры:** `textureIndex` 9-11 (blue, gold, red), `isScatter = true`. Не участвуют в выигрышных комбинациях, служат для активации бонусной функции (фриспины).
- **Spine:** алиасы скелета/атласа задаются из конфига CascadeManager: `Symbol.spineSkeletonAlias`, `Symbol.spineAtlasAlias`. Используются сценарии:
  - **Приземление:** `showSpineAnimation()` — временно подменить вид на Spine, проиграть анимацию `bounce`, по завершении убрать Spine и вернуть текстуру. Вызывается из `onLandedCallback`.
  - **Выигрыш:** `showWinAnimation(onComplete)` — скрыть текстуру, проиграть Spine `win` → `disappearance`, в конце вызвать onComplete (символ потом уничтожается, текстуру не восстанавливаем).
  - **Бомба (win):** при выигрыше с бомбой создаётся отдельный Spine-экземпляр в `bombWinOverlayContainer` (без маски) для показа анимации выигрыша с мультипликатором. Оригинальный бомба-символ скрывается.
- В `Symbol.update(deltaTime)` обновляется движение к `targetY` и при необходимости обновление Spine (physics/world transform). Создавать/уничтожать Spine только в `showSpineAnimation` / `showWinAnimation` / `hideSpineAnimation` / `destroy`, не в update.

---

## 9. Асинхронность и таймеры

- **Основной поток каскада:** `async/await`. Ожидаются: `_startOldSymbolsFall`, `_startCascadeFall`, `_removeWinningSymbolsWithWinAnimation`, `_processCascadeCompacting`, `_processCascadeFilling`.
- **Задержки и отложенная проверка:** только `setTimeout`. Все идентификаторы таймеров, которые управляют логикой каскада/проверки, должны попадать в `activeTimers`, чтобы `reset()` мог их очистить.
- **Проверка «все приземлились»:** в обычном режиме — один таймер `_scheduleWinCheck(timeMs)`; в сценарии — через колбэк приземления. Не дублировать проверку и по таймеру, и по каждому приземлению без защиты флагами.

---

## 10. Режим сценария (ScenarioCascadeManager)

- Наследник CascadeManager. Сетка и анимации те же; меняется источник выигрышей и продвижение по шагам.
- Шаги сценария: `event` — `spin` | `spin-win` | `spin-bomb` | `cascade` | `cascade-win` | `cascade-bomb` | `cascade-win-bomb`. Выигрышные символы берутся из текущего шага: `winningGroups` + `groupMarkup` (см. `_getWinningSymbolsFromScenario()`).
- **События с бомбами:**
  - `spin-bomb` / `cascade-bomb`: взрыв бомбы без выигрыша. Бомба определяется через `bombType: 'explode'` и `explodedPositions` в шаге сценария.
  - `cascade-win-bomb`: выигрыш с бомбой. Сначала показывается win-анимация бомбы с мультипликатором, затем взрыв соседних символов.
- Кнопка спин при сценарии может сдвигать `currentScenarioStep` (например, переход на следующий шаг при ожидании спина) перед вызовом `grid.cascade()`. Логика перехода — в UIController и в методах сценария (`_handleScenarioWinCheck`, `_handleScenarioNoWin`, `findNextSpinStep`).
- **Важно:** При обработке `cascade-bomb` после выигрыша сначала выполняется `processCascade()` (уплотнение и досыпание), затем применяется сетка из сценария (`_applyScenarioGridAfterFill()`), и только потом происходит взрыв бомбы.

При добавлении новых типов шагов или источников выигрыша сохранять: один источник правды для «кто выигрышный» на текущем шаге и один цикл remove → compact → fill → check.

---

## 11. Трансформации поля (shake и scale)

- **shakeContainer:** контейнер для тряски при взрыве бомбы. Передаётся в конструктор CascadeManager. Обычно это `gameFieldContainer`, который содержит поле, символы и другие элементы игрового поля.
- **_shakeField(durationMs, intensity):** тряска поля при взрыве бомбы. Применяет случайные смещения к `shakeContainer` с заданной интенсивностью и длительностью.
- **_startFieldScaleDown(durationMs, minScale):** медленное уменьшение масштаба поля перед взрывом бомбы (для `spin-win-bomb` / `cascade-win-bomb`). Устанавливает pivot в центр контейнера и анимирует scale до `minScale`.
- **_scaleFieldBounceBack(durationMs, shakeDurationMs):** возврат масштаба к 1 с баунсом после взрыва. Вызывается по событию `boom` от бомбы. После окончания тряски сбрасывает pivot, чтобы избежать конфликтов с `_shakeField`.
- Все элементы, добавленные в `shakeContainer` (включая лейблы сундуков), автоматически наследуют трансформации при взрыве.

## 12. Контейнеры и оверлеи

- **bombWinOverlayContainer:** отдельный контейнер для Spine-анимации бомбы при выигрыше (без маски игрового поля). Создаётся поверх `gameFieldContainer`, zIndex = 150. Используется для показа win-анимации бомбы с текстом мультипликатора, когда оригинальный бомба-символ скрыт маской или должен быть скрыт во время анимации.
- **gameFieldContainer:** основной контейнер игрового поля. Содержит поле, символы, маску, bombWinOverlayContainer. Является `shakeContainer` для трансформаций при взрыве.

## 13. Игровой цикл

В `index.html` (или главном скрипте): один тик приложения, в нём вызывается `grid.update(deltaTime)`. Внутри CascadeManager в `update()` вызывается `symbol.update(deltaTime)` для каждого символа в `grid` и для каждого в `oldSymbols`. Другой логики в тикере не должно быть (обновление Spine уже внутри Symbol.update).

---

## 14. Известные ограничения и риски

- **Кнопка спин:** разблокировка по фиксированному таймеру (2 сек от последнего `_blockSpinButton()`), а не по фактическому переходу в IDLE. При очень длинных каскадах или, наоборот, очень коротком спине кнопка может разблокироваться не в тот момент. См. п. 2.
- **Два триггера проверки в обычном режиме:** и таймер `_scheduleWinCheck`, и колбэк приземления каждого символа (через 100 ms) могут вызвать `_onAllLanded()`. Кто первый — зависит от таймингов. Защита флагами корректна, но при изменении задержек или скорости падения стоит проверять, что проверка не срабатывает слишком рано (до приземления последнего символа).
- **Таймеры в activeTimers:** после срабатывания таймера его id остаётся в массиве до следующего `reset()`. Для очистки при reset() этого достаточно; при добавлении другой логики очистки это учитывать.

---

## 15. Что не делать

- Не разблокировать кнопку спин из CascadeManager по завершении анимации — только через UIController (таймер).
- Не вызывать проверку выигрыша без проверки `gameState` и флагов `winCheckProcessed`/`winCheckPending`.
- Не вводить второй механизм «все приземлились» (например, счётчик приземлений) без отключения таймерной проверки и без учёта в этом документе.
- Не смешивать координаты: сетка — всегда `grid[col][row]`, позиции — `gridPositions[col][row]`; у Symbol центр в `(currentX, currentY)`, контейнер позиционируется как центр минус половина размера.
- Не создавать Spine в Symbol вне перечисленных методов (showSpineAnimation, showWinAnimation, hideSpineAnimation) и не забывать уничтожать экземпляр и очищать state при destroy.
- Не вызывать `_onAllLanded()` без предварительной проверки `_findLastFallingSymbol()` — это может привести к преждевременным проверкам выигрыша до приземления всех символов.
- Не добавлять элементы, которые должны наследовать трансформации поля при взрыве, напрямую в `app.stage` — добавляйте их в `shakeContainer` (обычно `gameFieldContainer`).

## 16. Дополнительные компоненты

- **ChestManager:** управление сундуками (red, blue, yellow) и их реакциями на прилёт монет (`onCoinArrival`) и взрывы бомб (`playJumpOnAll`). Сундуки имеют уровни и анимации hit/hit_up/idle/jump.
- **ScatterFlySystem:** система перелётов монет от скаттеров к сундукам. Активируется при событии `shot` от скаттера, вызывает `onCoinArrival` по завершении перелёта.
- **Лейблы сундуков (chest_label):** Spine-экземпляры с скинами red/blue/yellow, показывают анимацию `active` при прилёте монеты, по умолчанию играют `idle`. Добавляются в `gameFieldContainer` для наследования трансформаций при взрыве.

При изменении архитектуры обновите этот файл и при запросах к ИИ указывайте: «действуй по CASCADE_ARCHITECTURE.md».
