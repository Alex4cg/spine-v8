/* eslint-disable */
// @ts-nocheck
/**
 * Full list of built-in interpolations
 *
 * @example
 * import {Linear, Tween} from 'TWEEN'
 *
 * new Tween({x:0}).to({x:[0, 4, 8, 12, 15, 20, 30, 40, 20, 40, 10, 50]}, 1000).interpolation(Linear).start()
 *
 * @namespace TWEEN.Interpolation
 */


/**
 * @memberof TWEEN.Interpolation
 *
 * @param {Array} v
 * @param {Number} k
 *
 * @returns {Number}
 */
function linear(v, k) {
  let m = v.length - 1
  let f = m * k
  let i = Math.floor(f)
  let fn = utils.Linear

  if (k < 0) {
    return fn(v[0], v[1], f)
  }

  if (k > 1) {
    return fn(v[m], v[m - 1], m - f)
  }

  return fn(v[i], v[i + 1 > m ? m : i + 1], f - i)
}

/**
 * @memberof TWEEN.Interpolation
 *
 * @param {Array} v
 * @param {Number} k
 *
 * @returns {Number}
 */
function bezier(v, k) {
  let b = 0
  let n = v.length - 1
  let pw = Math.pow
  let bn = utils.Bernstein

  for (let i = 0; i <= n; i++) {
    b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i)
  }

  return b
}

/**
 * @memberof TWEEN.Interpolation
 *
 * @param {Array} v
 * @param {Number} k
 *
 * @returns {Number}
 */
function catmullRom(v, k) {
  let m = v.length - 1
  let f = m * k
  let i = Math.floor(f)
  let fn = utils.CatmullRom

  if (v[0] === v[m]) {
    if (k < 0) {
      i = Math.floor(f = m * (1 + k))
    }

    return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i)
  } else {
    if (k < 0) {
      return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0])
    }

    if (k > 1) {
      return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m])
    }

    return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i)
  }
}

const utils = {
  Linear(p0, p1, t) {
    return (p1 - p0) * t + p0
  },

  Bernstein(n, i) {
    let fc = utils.factorial

    return fc(n) / fc(i) / fc(n - i)
  },

  CatmullRom(p0, p1, p2, p3, t) {
    let v0 = (p2 - p0) * 0.5
    let v1 = (p3 - p1) * 0.5
    let t2 = t * t
    let t3 = t * t2

    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1
  },

  factorial: (function () {
    let a = [1]

    return function (n) {
      let s = 1

      if (a[n]) {
        return a[n]
      }

      for (let i = n; i > 1; i--) {
        s *= i
      }

      a[n] = s
      return s
    }
  })()
}

export {
  linear,
  bezier,
  catmullRom
}
