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

## 4. Чек-лист при добавлении нового Spine в проект

- [ ] Создание: `spine.Spine.from({ skeleton: alias, atlas: alias })`.
- [ ] Заглушка physics, если нужно: `skeleton.physics = { update: () => {}, updateGlobal: () => {} }`.
- [ ] Скин (если нужен): `setSkin()` + `setSlotsToSetupPose()`, иначе только `setSlotsToSetupPose()`.
- [ ] Не вызывать вручную `spineInstance.update(deltaTime)` (autoUpdate по умолчанию true).
- [ ] Позиция и масштаб: `x`, `y`, при необходимости `scale.set(sx, sy)`.
- [ ] Видимость поверх остального: высокий `zIndex`, после `addChild()` вызвать `stage.sortChildren()`.
- [ ] Запуск анимации: `state.setAnimation(0, animName, loop)`; при необходимости fallback на первую анимацию из `skeleton.data.animations`.
- [ ] По завершении анимации: в `entry.listener.complete` в `requestAnimationFrame` выполнить: `removeChild` → `state.clearTracks()` → `destroy({ children: true })`.

---

## 5. Ссылки на реализацию в проекте

- Создание и проигрывание transition: `CascadeManager.js` — метод `_playTransitionAnimation()`.
- Корректное уничтожение Spine: `CascadeManager.js` (listener `complete` у transition), `ScatterFlySystem.js` — `_cleanupSpineInstance` / отложенное уничтожение.
- Создание сундуков (скин, setup pose, physics): `ChestManager.js` — `createChest()`.
- Условие запуска transition (флаг, один раз): `index.html` — обновление `scatterFlySystem.config.onFlightComplete`.

---

*Документ составлен по опыту отладки Spine в slot_5 (переход в бонус, transition-анимация, boom сундуков).*
