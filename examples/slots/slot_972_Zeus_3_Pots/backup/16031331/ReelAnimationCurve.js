/**
 * Обёртка над профилем из Timing Tool (reel_animation/*.json).
 * Использует длительности фаз, step и bezier-кривые старта/конца.
 */

export class ReelAnimationCurve {
  /**
   * @param {object} profile - профиль, экспортированный из Timing Tool (например hw_normal_speed.json).
   * @param {number} [reelIndex=0] - индекс рила (колонки) для расчёта tapeLength/extraLength.
   */
  constructor(profile, reelIndex = 0) {
    this.step = profile.step || 100;
    this.reelStartDelayMs = profile.reelStartDelayMs || 0;
    this.tapeLength = profile.tapeLength || 0;
    this.extraLength = profile.extraLength || 0;
    this.reelIndex = reelIndex;

    const containers = profile.containers || {};
    const start = containers.start || {};
    const linear = containers.linear || {};
    const end = containers.end || {};

    // Число отрезков для этого рила по спецификации Timing Tool:
    // n = tapeLength + col * extraLength
    const n = this.tapeLength + this.reelIndex * this.extraLength;

    this.startDuration = start.durationMs || 0;
    this.linearDuration = (linear.durationMs || 0) * n;
    this.endDuration = end.durationMs || 0;

    // Линейная дистанция для конкретной колонки (с учётом tapeLength/extraLength)
    this.linearDistance = (linear.distancePx || this.step) * n;
    this.startRange = start.rangePx || 0;
    this.endRange = end.rangePx || 0;

    // Безье-ключи, приходящие из Timing Tool
    this.startCurve = Array.isArray(profile.startCurve) ? profile.startCurve : [];
    this.endCurve = Array.isArray(profile.endCurve) ? profile.endCurve : [];

    this.totalDuration = this.startDuration + this.linearDuration + this.endDuration;

    // Предрасчитанные опорные смещения для старта/конца,
    // чтобы понимать реальное количество step, которое
    // проходит центр окна (учитывая overshoot по безье).
    this.startOffset = this.startCurve.length > 0
      ? this.evaluateStartBezier(1)
      : this.startRange;

    if (this.endCurve.length > 0) {
      const endBase = this.evaluateEndBezier(0);
      const endVal = this.evaluateEndBezier(1);
      this.endDelta = endVal - endBase;
    } else {
      this.endDelta = this.endRange;
    }
  }

  /**
   * Возвращает общее время спина для одного рила.
   */
  getDurationMs() {
    return this.totalDuration;
  }

  /**
   * Кубический bezier по ключам Timing Tool.
   * curve: [{ t, value, in:{dx,dy}, out:{dx,dy} }, ...], t ∈ [0,1].
   * Возвращает value(tNorm).
   */
  static evaluateCurve(curve, tNorm) {
    if (!Array.isArray(curve) || curve.length === 0) return 0;

    const t = Math.max(0, Math.min(1, tNorm));

    if (curve.length === 1) {
      return curve[0].value || 0;
    }

    // найти сегмент [k0, k1], в который попадает t
    let k0 = curve[0];
    let k1 = curve[curve.length - 1];

    for (let i = 0; i < curve.length - 1; i += 1) {
      const a = curve[i];
      const b = curve[i + 1];
      if (t >= a.t && t <= b.t) {
        k0 = a;
        k1 = b;
        break;
      }
    }

    const t0 = k0.t;
    const t1 = k1.t;
    if (t1 - t0 === 0) {
      return k0.value || 0;
    }

    const s = (t - t0) / (t1 - t0);

    const v0 = k0.value || 0;
    const v1 = k1.value || 0;
    const out = k0.out || {};
    const inn = k1.in || {};

    const p0y = v0;
    const p1y = v0 + (out.dy || 0);
    const p2y = v1 + (inn.dy || 0);
    const p3y = v1;

    const u = 1 - s;
    const uu = u * u;
    const uuu = uu * u;
    const ss = s * s;
    const sss = ss * s;

    return (
      uuu * p0y +
      3 * uu * s * p1y +
      3 * u * ss * p2y +
      sss * p3y
    );
  }

  evaluateStartBezier(t) {
    return ReelAnimationCurve.evaluateCurve(this.startCurve, t);
  }

  evaluateEndBezier(t) {
    return ReelAnimationCurve.evaluateCurve(this.endCurve, t);
  }

  /**
   * Вычислить смещение (в пикселях) для времени tMs от начала спина.
   * Ноль соответствует «стартовой» позиции символа.
   *
   * Модель:
   * - старт: кривая displacement из startCurve (если есть) или простой ease на startRange;
   * - linear: движение на linearDistance;
   * - end: кривая displacement из endCurve (если есть) или простой ease на endRange.
   */
  getOffsetAt(tMs) {
    const t = Math.max(0, Math.min(this.totalDuration, tMs));

    // фаза старта
    if (t <= this.startDuration && this.startDuration > 0) {
      const n = t / this.startDuration;
      if (this.startCurve.length > 0) {
        // значения кривой считаем абсолютным смещением
        return this.evaluateStartBezier(n);
      }
      // fallback: ease на диапазон startRange
      const e = n * n * (3 - 2 * n); // smoothstep
      return -this.startRange * (1 - e);
    }

    // после старта
    const afterStartOffset = this.startCurve.length > 0
      ? this.evaluateStartBezier(1)
      : 0;
    const tAfterStart = t - this.startDuration;

    // линейная фаза
    if (tAfterStart <= this.linearDuration && this.linearDuration > 0) {
      const n = tAfterStart / this.linearDuration;
      return afterStartOffset + this.linearDistance * n;
    }

    // после линейной части
    const afterLinearOffset = afterStartOffset + this.linearDistance;
    const tAfterLinear = tAfterStart - this.linearDuration;

    if (tAfterLinear <= this.endDuration && this.endDuration > 0) {
      const n = tAfterLinear / this.endDuration;
      if (this.endCurve.length > 0) {
        const endBase = this.evaluateEndBezier(0);
        const endVal = this.evaluateEndBezier(n);
        return afterLinearOffset + (endVal - endBase);
      }
      const e = n * n * (3 - 2 * n); // smoothstep
      const overshoot = this.endRange * (1 - e);
      return afterLinearOffset + overshoot;
    }

    // конец анимации
    if (this.endCurve.length > 0) {
      const endBase = this.evaluateEndBezier(0);
      const endVal = this.evaluateEndBezier(1);
      return afterLinearOffset + (endVal - endBase);
    }
    return afterLinearOffset;
  }
}

