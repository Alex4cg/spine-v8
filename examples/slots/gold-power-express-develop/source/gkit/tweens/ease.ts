/* eslint-disable */
// @ts-nocheck

/**
 * Full list of built-in easings
 *
 * @example
 * import {Tween, quadInOut} from 'TWEEN';
 *
 * new Tween({x:0}).to({x:100}, 1000).easing(quadInOut).start();
 *
 * @namespace TWEEN.Ease
 */

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function none(k) {
  return k
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quadIn(k) {
  return Math.pow(k, 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quadOut(k) {
  return k * (2 - k)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quadInOut(k) {
  if ((k *= 2) < 1) {
    return 0.5 * Math.pow(k, 2)
  }

  return -0.5 * (--k * (k - 2) - 1)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function cubicIn(k) {
  return Math.pow(k, 3)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function cubicOut(k) {
  return --k * k * k + 1
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function cubicInOut(k) {
  if ((k *= 2) < 1) {
    return 0.5 * Math.pow(k, 3)
  }

  return 0.5 * ((k -= 2) * k * k + 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quartIn(k) {
  return Math.pow(k, 4)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quartOut(k) {
  return 1 - --k * k * k * k
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quartInOut(k) {
  if ((k *= 2) < 1) {
    return 0.5 * Math.pow(k, 4)
  }

  return -0.5 * ((k -= 2) * k * k * k - 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quintIn(k) {
  return Math.pow(k, 5)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quintOut(k) {
  return --k * k * k * k * k + 1
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function quintInOut(k) {
  if ((k *= 2) < 1) {
    return 0.5 * Math.pow(k, 5)
  }

  return 0.5 * ((k -= 2) * k * k * k * k + 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function sineIn(k) {
  return 1 - Math.cos((k * Math.PI) / 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function sineOut(k) {
  return Math.sin((k * Math.PI) / 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function sineInOut(k) {
  return 0.5 * (1 - Math.cos(Math.PI * k))
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function expoIn(k) {
  return k === 0 ? 0 : Math.pow(1024, k - 1)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function expoOut(k) {
  return k === 1 ? 1 : 1 - Math.pow(2, -10 * k)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function expoInOut(k) {
  if (k === 0) {
    return 0
  }

  if (k === 1) {
    return 1
  }

  if ((k *= 2) < 1) {
    return 0.5 * Math.pow(1024, k - 1)
  }

  return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function circIn(k) {
  return 1 - Math.sqrt(1 - k * k)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function circOut(k) {
  return Math.sqrt(1 - --k * k)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function circInOut(k) {
  if ((k *= 2) < 1) {
    return -0.5 * (Math.sqrt(1 - k * k) - 1)
  }

  return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function elasticIn(k) {
  if (k === 0) {
    return 0
  }

  if (k === 1) {
    return 1
  }

  return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function elasticOut(k) {
  if (k === 0) {
    return 0
  }

  if (k === 1) {
    return 1
  }

  return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function elasticInOut(k) {
  if (k === 0) {
    return 0
  }

  if (k === 1) {
    return 1
  }

  k *= 2

  if (k < 1) {
    return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
  }

  return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function backIn(k) {
  const s = 1.70158

  return k * k * ((s + 1) * k - s)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function backOut(k) {
  const s = 1.70158

  return --k * k * ((s + 1) * k + s) + 1
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function backInOut(k) {
  const s = 1.70158 * 1.525

  if ((k *= 2) < 1) {
    return 0.5 * (k * k * ((s + 1) * k - s))
  }

  return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function bounceIn(k) {
  return 1 - bounceOut(1 - k)
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function bounceOut(k) {
  let x = 2.75
  let y = 7.5625

  if (k < 1 / x) {
    return y * k * k
  } else if (k < 2 / x) {
    return y * (k -= 1.5 / x) * k + 0.75
  } else if (k < 2.5 / x) {
    return y * (k -= 2.25 / x) * k + 0.9375
  } else {
    return y * (k -= 2.625 / x) * k + 0.984375
  }
}

/**
 * @memberof TWEEN.Ease
 * @param {Number} k
 * @returns {Number}
 */
function bounceInOut(k) {
  if (k < 0.5) {
    return bounceIn(k * 2) * 0.5
  }

  return bounceOut(k * 2 - 1) * 0.5 + 0.5
}

export {
  none,
  quadIn,
  quadOut,
  quadInOut,
  cubicIn,
  cubicOut,
  cubicInOut,
  quartIn,
  quartOut,
  quartInOut,
  quintIn,
  quintOut,
  quintInOut,
  sineIn,
  sineOut,
  sineInOut,
  expoIn,
  expoOut,
  expoInOut,
  circIn,
  circOut,
  circInOut,
  elasticIn,
  elasticOut,
  elasticInOut,
  backIn,
  backOut,
  backInOut,
  bounceIn,
  bounceOut,
  bounceInOut
}
