# Spine + PixiJS: типичные проблемы и решения

Документ описывает проблемы со Spine в контексте PixiJS (spine-pixi), с которыми сталкивались в проекте, и как их решали. Предназначен для передачи ИИ или разработчикам при работе со Spine в похожих проектах.

---

## 1. Анимация не проигрывается / не видна

### Проблема
Spine-экземпляр создаётся, добавляется на сцену, анимация вызывается через `state.setAnimation()`, но на экране ничего не происходит.

### Причины и решения

#### 1.1. Ручной вызов `update()` при включённом autoUpdate

**Симптом:** В консоли предупреждение:
```text
You are calling update on a Spine instance that has autoUpdate set to true. This is probably not what you want.
```

**Причина:** У экземпляра Spine по умолчанию `autoUpdate = true`. PixiJS ticker уже обновляет его. Дополнительный вызов `spineInstance.update(deltaTime)` в своём `update()` или в ticker приводит к двойному обновлению и предупреждению.

**Решение:** Не вызывать `update()` вручную для Spine. Удалить из кода что-то вроде:
```javascript
// НЕПРАВИЛЬНО
app.ticker.add(() => {
  transitionSpine.update(app.ticker.deltaMS / 1000);
});
```
или
```javascript
// НЕПРАВИЛЬНО
if (this._transitionSpine) {
  this._transitionSpine.update(deltaTime);
}
```

Spine сам обновляется через сцену PixiJS.

#### 1.2. Не вызван `setSlotsToSetupPose()`

**Причина:** После создания экземпляра или смены скина слоты должны быть приведены к setup pose, иначе отображение может быть некорректным или пустым.

**Решение:** После создания и (при необходимости) установки скина вызывать:
```javascript
spineInstance.skeleton.setSlotsToSetupPose();
```

Пример (как у сундуков и transition в проекте):
```javascript
const spineInstance = spine.Spine.from({ skeleton: alias, atlas: atlasAlias });
if (skin) {
  spineInstance.skeleton.setSkin(skin);
  spineInstance.skeleton.setSlotsToSetupPose();
} else {
  spineInstance.skeleton.setSlotsToSetupPose();
}
```

#### 1.3. Нет заглушки для `skeleton.physics`

**Причина:** Часть скелетов экспортируется без physics. Обращение к `skeleton.physics` может приводить к ошибкам или неожиданному поведению.

**Решение:** После создания экземпляра проверять и при необходимости задавать заглушку:
```javascript
if (!spineInstance.skeleton.physics) {
  spineInstance.skeleton.physics = {
    update: () => {},
    updateGlobal: () => {}
  };
}
```

#### 1.4. Неверное имя анимации

**Причина:** В коде жёстко задано имя анимации (например `'transition'`), а в skeleton.json оно другое.

**Решение:**
- Проверить в skeleton.json раздел `animations` и использовать точное имя.
- Иметь fallback на первую доступную анимацию:
```javascript
let entry = spineInstance.state.setAnimation(0, 'transition', false);
if (!entry) {
  const animations = spineInstance.skeleton?.data?.animations;
  if (animations?.length > 0) {
    entry = spineInstance.state.setAnimation(0, animations[0].name, false);
  }
}
```

#### 1.5. Низкий zIndex или не вызывается `sortChildren()`

**Причина:** Spine добавлен на сцену, но перекрыт другими объектами.

**Решение:** Задать высокий `zIndex` и после добавления вызвать сортировку:
```javascript
spineInstance.zIndex = 99999;
stage.addChild(spineInstance);
stage.sortChildren();
```

---

## 2. Ошибка при уничтожении Spine

### Проблема
После завершения анимации или при удалении Spine из сцены в консоли:
```text
Uncaught TypeError: Cannot read properties of null (reading 'drawOrder')
```
и/или сцена «ломается».

### Причина
Spine уничтожается в неправильном порядке или без очистки состояния. Рендер пытается обратиться к уже уничтоженным или обнулённым данным.

### Решение: строгий порядок уничтожения

Использовать такой порядок (как в ScatterFlySystem и в transition в CascadeManager):

1. Убрать объект из родителя.
2. Очистить треки анимации.
3. Вызвать `destroy()`.

Желательно выполнять это в следующем кадре через `requestAnimationFrame`, чтобы не уничтожать объект во время обхода списка детей или во время рендера:

```javascript
entry.listener = {
  complete: () => {
    requestAnimationFrame(() => {
      if (spineInstance && spineInstance.parent) {
        spineInstance.parent.removeChild(spineInstance);
      }
      if (spineInstance && spineInstance.state) {
        spineInstance.state.clearTracks();
      }
      if (spineInstance && !spineInstance.destroyed) {
        spineInstance.destroy({ children: true });
      }
    });
  }
};
```

Кратко:
- Сначала `removeChild` — объект перестаёт участвовать в отрисовке.
- Потом `clearTracks` — останавливаем анимации и сбрасываем состояние.
- В конце `destroy({ children: true })` — освобождаем ресурсы.

Нельзя вызывать только `destroy()` без предварительных шагов — это и приводит к ошибке `drawOrder` и поломке сцены.

---

## 3. Когда запускать «разовую» Spine-анимацию (например, transition)

### Проблема
Transition (или другая разовая анимация) должна проигрываться не при каждом событии (например, не при каждом перелёте монетки), а только при определённом условии (например, при поднятом флаге бонуса).

### Ошибки
- Запуск transition по каждому перелёту монетки.
- Запуск transition из сложной цепочки сценария, которая не всегда выполняется (например, только при «текущий шаг = cascade, следующий = spin»), из-за чего transition вообще не вызывается.

### Решение в данном проекте
Transition и boom сундуков привязаны к флагу `bonusTransitionPending`:

- В callback при прилёте монетки (например `onFlightComplete`) проверять флаг и запускать transition только если он установлен.
- Запускать transition один раз: при первом срабатывании callback с установленным флагом (через локальную переменную `transitionStarted`).
- При необходимости перед запуском ещё раз проверить флаг (например, не сбросился ли он за время `setTimeout`).

Пример идеи (псевдокод):
```javascript
let transitionStarted = false;
scatterFlySystem.config.onFlightComplete = (chestColor) => {
  const bonusTransitionPending = grid?.bonusTransitionPending ?? false;

  if (bonusTransitionPending && !transitionStarted) {
    transitionStarted = true;
    setTimeout(() => {
      if (grid?.bonusTransitionPending) {
        grid._playTransitionAnimation();
        grid._addBackgroundLayer();
      }
    }, 1000);
  }

  onCoinArrival(chests, chestColor, bonusTransitionPending);
  playLabelActive(chestColor);
};
```

Важно: и boom на сундуках, и transition должны срабатывать только при установленном флаге бонуса, а не при каждом перелёте.

---

## 4. Несколько Spine-экземпляров одного скелета мерцают / показывают чужие кадры

### Проблема

При наличии нескольких одновременно видимых Spine-экземпляров, созданных из **одного** `SkeletonData` (один и тот же алиас в `Spine.from()`), анимации «мешают» друг другу:

- Все монетки, кроме **последней**, показывают неверные кадры секвенций.
- При добавлении новой монетки предыдущая «ломается».
- Симптом исчезает, если на экране остаётся только одна монетка.
- Последняя созданная/обновлённая монетка всегда выглядит правильно.

### Причина: общий `attachment.uvs` (shared Float32Array)

`Spine.from({ skeleton, atlas })` кэширует `SkeletonData` по ключу `"${skeleton}-${atlas}-${scale}"`. Все экземпляры с одинаковым ключом **разделяют один `SkeletonData`** — а значит, одни и те же объекты `Attachment`.

У каждого `Attachment` есть свойство `uvs` — это `Float32Array`, в которую вычисляются UV-координаты текущего кадра секвенции. Метод `attachment.updateRegion()` **перезаписывает этот массив in-place**:

```javascript
// spine-pixi.js ~строка 700
attachment.region = region;
attachment.updateRegion();  // → перезаписывает attachment.uvs
```

В методе `transformAttachments()` каждый Spine-экземпляр сохраняет **ссылку** на этот массив:

```javascript
// spine-pixi.js ~строка 12475
cacheData.uvs = attachment.uvs;  // ССЫЛКА, не копия!
```

В итоге, когда в рендер-фазе вызывается `_applyState()` для экземпляра B, он перезаписывает `attachment.uvs` своим кадром — и все `cacheData.uvs` всех предыдущих экземпляров теперь указывают на **чужой кадр**.

Именно поэтому **последний** обработанный экземпляр всегда корректен — он записал своё значение последним.

### Решение: уникальный атлас-алиас для каждого независимого экземпляра

Нужно, чтобы у каждого «слота» (позиции на экране) был свой `SkeletonData`. Это достигается регистрацией **разных алиасов** для атласа (или скелетона) — тогда cacheKey в `Spine.from()` будет разным, и каждый вызов создаст **отдельный** `SkeletonData` с отдельными объектами `Attachment`.

Важно: PIXI.Assets кэширует файл по URL — файл скачается один раз. Но `readSkeletonData()` (парсер) вызывается для каждого уникального cacheKey → создаются **новые** объекты Attachment с **новыми** `uvs` Float32Array.

```javascript
const TOTAL_REELS = 9;

// Один skeleton.json, но отдельный алиас атласа на каждый слот
PIXI.Assets.add({ alias: 'coinSkeleton', src: './spine/coin/skeleton.json' });
for (let i = 0; i < TOTAL_REELS; i++) {
  // Все указывают на тот же файл, но алиасы разные →
  // разные cacheKey → разные SkeletonData → изолированные attachment.uvs
  PIXI.Assets.add({ alias: `coinAtlas_${i}`, src: './spine/coin/skeleton.atlas' });
}
await PIXI.Assets.load(['coinSkeleton', ...Array.from({length: TOTAL_REELS}, (_, i) => `coinAtlas_${i}`)]);

// Фабрика для слота i: использует уникальный алиас → изолированный SkeletonData
function makeSpineForSlot(slotIndex) {
  const c = spine.Spine.from({ skeleton: 'coinSkeleton', atlas: `coinAtlas_${slotIndex}` });
  if (!c.skeleton.physics) c.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
  c.state.data.defaultMix = 0;
  return c;
}
```

Если в одном слоте могут одновременно присутствовать несколько типов монеток (overlay + scroll[0] + scroll[1]), для каждого типа нужен **свой** алиас:

```javascript
const SLOTS_PER_REEL = 3; // overlay, scroll0, scroll1
for (let i = 0; i < TOTAL_REELS * SLOTS_PER_REEL; i++) {
  PIXI.Assets.add({ alias: `coinAtlas_${i}`, src: './spine/coin/skeleton.atlas' });
}

// Фабрики для рила с индексом reelIdx:
const factory = {
  createOverlayCoin: () => makeSpineForSlot(reelIdx * 3 + 0),
  createScrollCoin:  (slot) => makeSpineForSlot(reelIdx * 3 + 1 + Math.min(slot, 1)),
};
```

### Правило

> Никогда не показывайте одновременно два Spine-экземпляра с одинаковым `skeleton-atlas-scale` кэш-ключом, если они содержат **секвенционные** (sequence) анимации. Всегда давайте каждому независимому «слоту» свой алиас атласа.

---

## 5. Правильный порядок запуска анимации overlay-монетки (start → idle)

### Проблема

Overlay Spine-монетка показывает `start`, но после него `idle` не запускается корректно, или запускается с задержкой / ломается при наличии нескольких монеток.

### Рабочий паттерн (проверен на практике)

Порядок шагов **критичен**:

1. Создать экземпляр.
2. Применить скин (`setSkin` + `setSlotsToSetupPose`).
3. Задать позицию.
4. **`addChild` — добавить на сцену ДО запуска анимации.**
5. `clearTracks()`.
6. `setAnimation(0, 'start', false)`.
7. Добавить listener для перехода в `idle` после завершения `start`.

```javascript
// 1–3: создание, скин, позиция
const coin = coinFactory.createOverlayCoin();
applyCoinMetaToSpine(coin, meta);
coin.x = cx;
coin.y = cy;

// 4: сначала addChild!
overlayContainer.addChild(coin);

// 5–7: затем анимация
coin.state.clearTracks();
coin.state.setAnimation(0, 'start', false);

const listener = {
  complete: (trackEntry) => {
    if (trackEntry.animation?.name === 'start') {
      coin.state.removeListener(listener);
      if (!coin.destroyed) {
        coin.state.clearTracks();
        coin.state.setAnimation(0, 'idle', true);
      }
    }
  }
};
coin.state.addListener(listener);
```

**Не делать так:** запускать анимацию до `addChild`, или пропускать `clearTracks()`, или играть сразу `idle` без `start` (если `start` существует в скелетоне).

---

## 6. Обработка Spine-ивентов (события из анимации)

Spine может генерировать именованные события в середине анимации (например, `shot`, `train_hit`, `collect_effect_hit`). Их правильно слушать через `state.addListener()`.

**Правило:** добавлять listener **после** `state.setAnimation()`, чтобы экземпляр был уже привязан к рендер-пайпу.

```javascript
coin.state.setAnimation(0, 'hit', false);

const listener = {
  event: (entry, event) => {
    if (event?.data?.name === 'shot' && entry.trackIndex === 0) {
      // Spine-ивент «shot» сработал в нужный момент анимации
      doSomething();
    }
  },
  complete: (entry) => {
    if (entry.animation?.name === 'hit') {
      coin.state.removeListener(listener); // обязательно снимаем
      coin.state.setAnimation(0, 'idle', true);
    }
  }
};
coin.state.addListener(listener);
```

**Не делать:** вешать listener до `setAnimation` или забывать снимать его в `complete` (иначе listener живёт вечно и срабатывает на будущих анимациях).

---

## 7. Чек-лист при добавлении нового Spine в проект

- [ ] Создание: `spine.Spine.from({ skeleton: alias, atlas: alias })`.
- [ ] Заглушка physics, если нужно: `skeleton.physics = { update: () => {}, updateGlobal: () => {} }`.
- [ ] Скин (если нужен): `setSkin()` + `setSlotsToSetupPose()`, иначе только `setSlotsToSetupPose()`.
- [ ] Не вызывать вручную `spineInstance.update(deltaTime)` (autoUpdate по умолчанию true).
- [ ] Позиция и масштаб: `x`, `y`, при необходимости `scale.set(sx, sy)`.
- [ ] Видимость поверх остального: высокий `zIndex`, после `addChild()` вызвать `stage.sortChildren()`.
- [ ] Запуск анимации: `state.setAnimation(0, animName, loop)`; при необходимости fallback на первую анимацию из `skeleton.data.animations`.
- [ ] По завершении анимации: в `entry.listener.complete` в `requestAnimationFrame` выполнить: `removeChild` → `state.clearTracks()` → `destroy({ children: true })`.

---

## 8. Ссылки на реализацию в проекте

- Создание и проигрывание transition: `CascadeManager.js` — метод `_playTransitionAnimation()`.
- Корректное уничтожение Spine: `CascadeManager.js` (listener `complete` у transition), `ScatterFlySystem.js` — `_cleanupSpineInstance` / отложенное уничтожение.
- Создание сундуков (скин, setup pose, physics): `ChestManager.js` — `createChest()`.
- Условие запуска transition (флаг, один раз): `index.html` — обновление `scatterFlySystem.config.onFlightComplete`.
- Изоляция sequence-анимаций через уникальные атлас-алиасы: `slot_972_Zeus_3_Pots/zeusMain.js` + `ZeusReel.js` + `ZeusSlotManager.js`.

---

*Документ составлен по опыту отладки Spine в slot_5 (переход в бонус, transition-анимация, boom сундуков) и slot_972_Zeus_3_Pots (изоляция sequence attachment.uvs для множественных монеток).*
