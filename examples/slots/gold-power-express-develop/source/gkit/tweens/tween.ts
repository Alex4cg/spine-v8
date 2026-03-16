/* eslint-disable */
// @ts-nocheck
import AbstractAnimation from './abstract-animation'

import { none } from './ease'
import { linear } from './interpolation'

import { events, now } from './core'

/**
 * It tweens properties of objects.
 *
 * @class
 * @memberof TWEEN
 * @extends TWEEN.AbstractAnimation
 */
export default class Tween extends AbstractAnimation {
  /**
   * An easier way to call the Tween.
   *
   * @param {Object} [target] - Object that will be animated.
   * @param {Object} [to] - Object that represents the final values of the tween.
   * @param {Object} [options] - Object with an additional properties of the tween.
   *
   * @returns {TWEEN.Tween} Returns new tween instance.
   *
   * @example Tween.fromTo(target, {x:0}, {x:200}, {duration: 2000, repeat: 5})
   */
  static fromTo(target, from, to, options) {
    const tween = new this(target).to(to, options)

    tween._valuesStart = Object.create(from)

    return tween
  }

  /**
   * An easier way calling constructor only applies the `to` value.
   *
   * @param {Object} [target] - Object that will be animated.
   * @param {Object} [to] - Object that represents the final values of the tween.
   * @param {Object} [options] - Object with an additional properties of the tween.
   *
   * @returns {TWEEN.Tween} Returns new tween instance.
   *
   * @example Tween.to(target, {x:200}, {duration: 2000, repeat: 5})
   */
  static to(target, to, options) {
    return new this(target).to(to, options)
  }

  /**
   * Adds a function call to this empty tween.
   *
   * @param {Function} fn - Function that will be executed.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   */
  static call(fn) {
    return new this({}).to({}, { duration: 0 }).on(events.complete, fn)
  }

  /**
   * Create waiting tween that does nothing
   *
   * @param [options] - Object with an additional properties of the tween.
   * @returns - Returns itself. It's useful for chaining.
   */
  static wait(options) {
    return new this({}).to({}, options)
  }

  /**
   * An easier way to call the Tween.
   *
   * @param {Object} [target] - Object that will be animated.
   * @param {Object} [to] - Object that represents the final values of the tween.
   * @param {Object} [options] - Object with an additional properties of the tween.
   *
   * @returns {TWEEN.Tween} Returns new tween instance.
   *
   * @example Tween.fromTo(target, {x:0}, {x:200}, {duration: 2000, repeat: 5})
   */
  static from(target, from, options) {
    const to = {}

    for (const key of Object.keys(from)) {
      to[key] = target[key]
      target[key] = from[key]
    }

    const tween = new this(target).to(to, options)

    tween._valuesStart = Object.create(from)

    return tween
  }

  /**
   * Creates new instance of Tween.
   *
   * @param {Object} [target] - Object that will be tweened.
   *
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   */
  constructor(target = {}) {
    super()

    this._target = target

    this._pauseStart = null
    this._isPaused = false

    this._valuesStart = {}
    this._valuesEnd = {}
    this._valuesStartRepeat = {}

    this._easingFunction = none
    this._interpolationFunction = linear

    this._duration = 1000

    this._reversed = false
    this._yoyo = false

    return this
  }

  /**
   * Fired when this Tween is stopped.
   * @event TWEEN.Tween#stop
   */

  /**
   * Fired when this Tween is started.
   * @event TWEEN.Tween#start
   */

  /**
   * Fired when this Tween is updated.
   * @event TWEEN.Tween#update
   */

  /**
   * Fired when this Tween is repeated.
   * @event TWEEN.Tween#repeat
   */

  /**
   * Fired when this Tween is completed.
   * @event TWEEN.Tween#complete
   */

  /**
   * Sets target value and duration.
   *
   * @param {Object} to - Target end values.
   * @param {Object} options - Allows to set the tween playback settings (duration, easing, delay, etc.).
   *
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   *
   * @example let tween = new Tween({x:0}).to({x:100}, {duration: 2000})
   */
  to(to = {}, options = {}) {
    this._valuesEnd = Object.create(to)

    options.easing && this.easing(options.easing)
    options.interpolation && this.interpolation(options.interpolation)
    options.repeat && this.repeat(options.repeat)
    options.repeatDelay && this.repeatDelay(options.repeatDelay)
    options.yoyo && this.yoyo(options.yoyo)
    options.delay && this.delay(options.delay)
    options.duration !== undefined && this.duration(options.duration)

    return this
  }

  /**
   * Start the tweening
   *
   * @param {Number|String} [time] - Setting manual time instead of current browser timestamp or like `+1000` relative to current timestamp.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.start()
   */
  start(time?) {
    super.start(time)

    this._isPaused = false

    if (this._onStartEventFired) {

      if (this._repeatDelayTime !== undefined) {
        this._startTime = time + this._repeatDelayTime
      } else {
        this._startTime = time + this._delayTime
      }

      for (const property in this._valuesStartRepeat) {

        if (typeof (this._valuesEnd[property]) === 'string') {
          this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property])
        }

        if (this._yoyo) {
          let tmp = this._valuesStartRepeat[property]

          this._valuesStartRepeat[property] = this._valuesEnd[property]
          this._valuesEnd[property] = tmp
        }

        this._valuesStart[property] = this._valuesStartRepeat[property]

      }

      if (this._yoyo) {
        this._reversed = !this._reversed
      }

      return this
    }

    this._onStartEventFired = false

    for (let property in this._valuesEnd) {
      // Check if an Array was provided as property value
      if (this._valuesEnd[property] instanceof Array) {
        if (this._valuesEnd[property].length === 0) {
          continue
        }

        // Create a local copy of the Array with the start value at the front
        this._valuesEnd[property] = [this._target[property]].concat(this._valuesEnd[property])
      }

      // If `to()` specifies a property that doesn't exist in the source object,
      // we should not set that property in the object
      if (this._target[property] === undefined) {
        continue
      }

      // Save the starting value, but only once.
      if (typeof (this._valuesStart[property]) === 'undefined') {
        this._valuesStart[property] = this._target[property]
      }

      if ((this._valuesStart[property] instanceof Array) === false) {
        this._valuesStart[property] *= 1.0 // Ensures we're using numbers, not strings
      }

      this._valuesStartRepeat[property] = this._valuesStart[property] || 0

    }

    return this
  }

  /**
   * Stops the tweening.
   *
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.stop()
   */
  stop() {
    if (!this._isPlaying) {
      this._onStartEventFired = false

      return this
    }

    this._group.remove(this)

    this._isPlaying = false
    this._isPaused = false

    this.emit(events.stop, this._target)

    return this
  }

  /**
   * Pauses the tweening.
   *
   * @param {Number} [time] - Setting manual time instead of current browser timestamp.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.pause()
   */
  pause(time) {
    if (this._isPaused || !this._isPlaying) {
      return this
    }

    this._group.remove(this)

    this._isPaused = true

    this._pauseStart = (time === undefined) ?
      now() :
      time

    return this
  }

  /**
   * State of paused of this Tween.
   *
   * @returns {Boolean} - When Tween is paused returns `true`.
   * @example tween.isPaused()
   */
  isPaused() {
    return this._isPaused
  }

  /**
   * Resumes the tweening if it paused.
   *
   * @param {Number} [time] - Setting manual time instead of current browser timestamp.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.resume()
   */
  resume(time) {
    if (!this._isPaused || !this._isPlaying) {
      return this
    }

    this._group.add(this)

    this._isPaused = false

    this._startTime += (time === undefined ? now() : time) - this._pauseStart
    this._pauseStart = 0

    return this
  }

  /**
   * Sets tween duration.
   *
   * @param {Number} amount - Duration is milliseconds.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.duration(2000)
   */
  duration(amount) {
    this._duration = amount

    return this
  }

  /**
   * Ends the tween.
   *
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.end()
   */
  end() {
    this.update(Infinity)

    return this
  }

  /**
   * Set `yoyo` state (enables reverse in repeat).
   *
   * @param {Boolean} yoyo - Enables alternate direction for repeat.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.yoyo(true)
   */
  yoyo(yoyo) {
    this._yoyo = yoyo

    return this
  }

  /**
   * Set easing.
   *
   * @param {Function} easingFunction - Easing function.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.easing(Ease.Linear)
   */
  easing(easingFunction) {
    this._easingFunction = easingFunction

    return this
  }

  /**
   * Set interpolation.
   *
   * @param {Function} _interpolationFunction - Interpolation function.
   * @returns {TWEEN.Tween} - Returns itself. It's useful for chaining.
   * @example tween.interpolation(Interpolation.Bezier)
   */
  interpolation(interpolationFunction) {
    this._interpolationFunction = interpolationFunction

    return this
  }

  /**
   * Updates initial object to target value by given `time`.
   *
   * @param {Number} [time]  - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   * @example tween.update(100)
   */
  update(time) {
    if (!super.update(time) || this._isPaused) {
      return false
    }

    if (time < this._startTime) {
      return true
    }

    if (!this._onStartEventFired) {
      this._onStartEventFired = true

      this.emit(events.start)
    } else if (this._onStartEventFired && this._repeatStartEvent) {
      this._repeatStartEvent = false
      this._repeat = this._repeatCount

      this.emit(events.start)
    }

    let property, elapsed, value

    elapsed = (time - this._startTime) / this._duration
    elapsed = (this._duration === 0 || elapsed > 1) ? 1 : elapsed

    value = this._easingFunction(elapsed)

    for (property in this._valuesEnd) {
      if (this._valuesStart[property] === undefined) {
        continue
      }

      let start = this._valuesStart[property] || 0
      let end = this._valuesEnd[property]

      if (end instanceof Array) {

        this._target[property] = this._interpolationFunction(end, value)

      } else {

        if (typeof (end) === 'string') {
          end = (end.charAt(0) === '+' || end.charAt(0) === '-')
            ? start + parseFloat(end)
            : parseFloat(end)
        }

        if (typeof (end) === 'number') {
          this._target[property] = start + (end - start) * value
        }

      }
    }

    this.emit(events.update, this._target, elapsed)

    if (elapsed === 1) {

      if (this._repeat > 0) {

        if (isFinite(this._repeat)) {
          this._repeat--
        }

        this.start(time)
        this.emit(events.repeat, this._target)

        return true

      } else {

        this._isPlaying = false

        this.emit(events.complete, this._target)

        return false
      }
    }

    return true
  }
}
