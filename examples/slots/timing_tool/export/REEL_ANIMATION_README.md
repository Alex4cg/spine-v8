# reel_animation.json — парсинг и применение в игре

Краткий гайд для разработчика: как загрузить конфиг, что значат параметры и как по ним считать анимацию лент (падение символов с баунсом).

---

## 1. Откуда берётся файл

Файл экспортируется из **Timing Tool** (`bounce_canvas.html`) кнопкой **EXPORT_PACK**. Имя по умолчанию: `reel_animation.json`. Внутри — один объект с шестью ключами-пресетами:

| Ключ       | Назначение (примерное) |
|-----------|-------------------------|
| `regNorm` | Обычный режим, нормальная скорость |
| `regFast` | Обычный режим, быстрее |
| `regFfast`| Обычный режим, очень быстро |
| `bonNorm` | Бонусный режим, нормальная скорость |
| `bonFast` | Бонусный режим, быстрее |
| `bonFfast`| Бонусный режим, очень быстро |

В игре вы выбираете один пресет по контексту (режим игры + скорость) и дальше работаете с одним объектом параметров.

---

## 2. Парсинг

```javascript
// Загрузка (например при старте уровня)
const response = await fetch('path/to/reel_animation.json');
const pack = await response.json();

// Выбор пресета (пример: обычный режим, быстрая скорость)
const config = pack.regFast;
if (!config) {
  console.error('Preset regFast not found');
  return;
}
```

Один пресет — один объект со следующими полями (все числа, если не указано иное).

---

## 3. Параметры одного пресета

### 3.1. Сетка и тайминг

| Поле | Тип | Описание | Использование в коде |
|------|-----|----------|----------------------|
| `step` | number | Высота одного символа в px. `0` = без снаппинга (непрерывное движение). | Высота ячейки ленты, сдвиг по модулю `N * step` для бесшовного повтора. |
| `tapeLength` | number | Базовое число **линейных отрезков** на одну колонку. | Для колонки `col`: число отрезков = `tapeLength + col * extraLength`. |
| `extraLength` | number | Доп. отрезков на каждую следующую колонку. | См. формулу выше. |
| `reelStartDelayMs` | number | Задержка старта между колонками, мс. | Колонка `col` начинает анимацию в момент `col * reelStartDelayMs`. |
| `playfieldCols` | number (опц.) | Число колонок рилов. | Размер сетки, если не задаётся elsewhere. |
| `playfieldRows` | number (опц.) | Число строк рилов. | Размер сетки. |

### 3.2. Контейнеры (фазы анимации)

Анимация одной колонки состоит из трёх фаз по порядку: **Start** → **Linear** → **End**.

| Объект | Поля | Смысл |
|--------|------|--------|
| `containers.start` | `durationMs`, `rangePx` | Старт: длительность в мс, диапазон смещения по Y в px. Кривая задаётся в `startCurve`. |
| `containers.linear` | `durationMs`, `distancePx` | Линейная фаза: длительность **одного** отрезка (мс) и дистанция **одного** отрезка (px). |
| `containers.end` | `durationMs`, `rangePx` | Торможение: длительность в мс, диапазон в px. Кривая — `endCurve`. |

**Важно:** для колонки с индексом `col` длительность и дистанция **линейной** фазы зависят от числа отрезков:

- Число отрезков:  
  `n = tapeLength + col * extraLength`
- Длительность Linear для колонки `col`:  
  `linearDurationCol = n * containers.linear.durationMs`
- Дистанция Linear для колонки `col`:  
  `linearDistanceCol = n * containers.linear.distancePx`

**Ожидание ответа от бекенда.** В фазе Linear скорость постоянна (равномерное движение). Пресет задаёт фиксированное число отрезков `n`, но разработчик может **вклинить любое дополнительное количество отрезков**, пока идёт ожидание ответа от сервера: длительность и дистанция просто увеличиваются на `k * durationMs` и `k * distancePx` (k — число добавленных отрезков). Анимация не «ломается»: после прихода ответа фаза Linear продолжается с той же скоростью и затем штатно переходит в End. Удобно использовать Linear как фазу ожидания (пинг бекенда), не нарушая визуал.

Start и End для всех колонок одинаковые: берёте `containers.start.durationMs` / `containers.end.durationMs` и `rangePx` как масштаб для кривых.

### 3.3. Кривые Безье (startCurve, endCurve)

Оба поля — массивы ключевых точек кривой в координатах **(нормированное время t, смещение в px)**.

Формат одного ключа:

```json
{
  "t": 0,
  "value": 0,
  "in":  { "dx": 0.2, "dy": 0 },
  "out": { "dx": 0.2, "dy": 0 }
}
```

| Поле | Описание |
|------|----------|
| `t` | Нормированное время в фазе: 0 … 1. |
| `value` | Смещение по Y в пикселях в этой точке. |
| `in` | Входящий тангенс: `{ dx, dy }` — относительное смещение контрольной точки «до» ключа. |
| `out` | Исходящий тангенс: `{ dx, dy }` — относительное смещение контрольной точки «после» ключа. |

- **startCurve** интерполируется за время `containers.start.durationMs` (горизонтальная ось — время 0…1, вертикальная — `value` в px).
- **endCurve** — за время `containers.end.durationMs`, так же.

Кривая между двумя ключами `i` и `i+1` — кубический Безье по четырём точкам:
- P0 = (t_i, value_i)
- P1 = P0 + (out_i.dx, out_i.dy)
- P2 = P3 − (in_{i+1}.dx, in_{i+1}.dy)  где P3 = (t_{i+1}, value_{i+1})
- P3 = (t_{i+1}, value_{i+1})

По параметру `u` от 0 до 1 на отрезке считаете позицию на кривой и получаете `(t, value)`. Для времени `elapsedMs` в фазе: нормализуете в `t = elapsedMs / durationMs`, находите нужный отрезок ключей и по `t` получаете `value` в пикселях.

---

## 4. Порядок применения в коде

### 4.1. Тайминг одной колонки

Для колонки `col` (индекс 0, 1, 2, …):

1. **Старт во времени:**  
   `startTimeMs = col * config.reelStartDelayMs`

2. **Длительности фаз:**
   - Start: `config.containers.start.durationMs`
   - Linear: `n = config.tapeLength + col * config.extraLength`, затем  
     `linearDurationMs = n * config.containers.linear.durationMs`
   - End: `config.containers.end.durationMs`

3. **Смещения по Y (пиксели):**
   - Start: интерполяция по `config.startCurve` за время Start (результат — смещение в конце старта).
   - Linear: равномерное движение на `linearDistanceCol` px за `linearDurationMs`.
   - End: интерполяция по `config.endCurve` за время End.

4. **Общая длительность колонки:**  
   `totalDurationMs = startDuration + linearDurationMs + endDuration`

### 4.2. Позиция по времени (псевдокод)

Пусть для колонки `col` прошло время `elapsedMs` с момента её старта (`startTimeMs`).

- Если `elapsedMs < 0` — анимация ещё не началась (позиция = начальная).
- Если `elapsedMs <= startDuration`:  
  нормализовать `elapsedMs` в `t = elapsedMs / startDuration`, по `startCurve` получить `value` → смещение Start.
- Иначе вычесть `startDuration`, работать с линейной фазой:  
  если `elapsedMs - startDuration <= linearDurationMs` — линейная интерполяция от конца Start до конца Linear.
- Иначе перейти к фазе End:  
  оставшееся время нормализовать в `t` и по `endCurve` получить смещение End.

Итоговая позиция по Y = сумма смещений (Start + Linear + End) на текущий момент. При `step > 0` для отрисовки ленты обычно берут позицию по модулю `(N * step)` (N — число символов в пуле).

### 4.3. Снаппинг (step)

Если `config.step > 0`, финальные позиции после цикла должны быть кратны `step`, чтобы лента визуально зацикливалась. В редакторе ключи и высота Linear уже выровнены под step; в игре достаточно использовать те же значения из JSON и не округлять промежуточные кадры (можно округлять только финальную отрисовку по модулю step).

---

## 5. Пример загрузки и доступа к полям

```javascript
// Загрузка пака
const pack = await (await fetch('export/reel_animation.json')).json();

// Выбор пресета
const presetKey = 'regFast'; // или regNorm, bonNorm и т.д.
const c = pack[presetKey];
if (!c) throw new Error('Preset ' + presetKey + ' not found');

// Параметры сетки
const cols = c.playfieldCols ?? 5;
const rows = c.playfieldRows ?? 4;
const step = c.step;
const reelStartDelayMs = c.reelStartDelayMs;

// Длительности для колонки 0
const startDur = c.containers.start.durationMs;
const n0 = c.tapeLength + 0 * c.extraLength;
const linearDur0 = n0 * c.containers.linear.durationMs;
const endDur = c.containers.end.durationMs;

// Дистанция Linear для колонки 2
const col = 2;
const n = c.tapeLength + col * c.extraLength;
const linearDistancePx = n * c.containers.linear.distancePx;
const linearDurationMs = n * c.containers.linear.durationMs;

// Кривые — массив ключей { t, value, in: { dx, dy }, out: { dx, dy } }
const startCurve = c.startCurve;
const endCurve = c.endCurve;
```

Дальше в игровом цикле для каждой колонки считаете `elapsedMs` от её `startTimeMs`, по фазам (Start → Linear → End) получаете смещение в пикселях и применяете к позиции символов/ленты.

---

## 6. Краткая сводка формул

| Что | Формула |
|-----|--------|
| Старт колонки `col` | `startTimeMs = col * reelStartDelayMs` |
| Число отрезков колонки `col` | `n = tapeLength + col * extraLength` |
| Длительность Linear, колонка `col` | `n * containers.linear.durationMs` |
| Дистанция Linear, колонка `col` | `n * containers.linear.distancePx` |
| Start / End длительность | `containers.start.durationMs`, `containers.end.durationMs` |
| Смещение Start/End | Интерполяция по `startCurve` / `endCurve` при t ∈ [0, 1] за соответствующее durationMs |
