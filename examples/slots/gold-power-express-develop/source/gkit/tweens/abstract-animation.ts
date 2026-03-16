/* eslint-disable */
// @ts-nocheck
import EventEmitter from 'eventemitter3'

import { globalGroup, now } from './core'

let _id = 0 // Unique ID

/**
 * An abstract class that holds common logic for animations.
 * @abstract
 * @class
 * @memberof TWEEN
 */
export default class AbstractAnimation extends EventEmitter {
  constructor() {
    super()

    this._id = _id++
    this._group = globalGroup

    this._startTime = null
    this._delayTime = 0
    this._repeatDelayTime = undefined

    this._repeat = 0
    this._repeatCount = 0
    this._repeatStartEvent = false

    this._isPlaying = false

    this._onStartEventFired = false
  }

  /**
   * Add a listener for a given event.
   *
   * @param {(String|Symbol)} event The event name.
   * @param {Function} fn The listener function.
   * @param {*} [context=this] The context to invoke the listener with.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  on(event, fn, context?) {
    super.on(event, fn, context)

    return this
  }

  /**
   * Add a one-time listener for a given event.
   *
   * @param {(String|Symbol)} event The event name.
   * @param {Function} fn The listener function.
   * @param {*} [context=this] The context to invoke the listener with.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  once(event, listener, context?) {
    super.once(event, listener, context)

    return this
  }

  /**
   * Remove the listeners of a given event.
   *
   * @param {(String|Symbol)} event The event name.
   * @param {Function} fn Only remove the listeners that match this function.
   * @param {*} context Only remove the listeners that have this context.
   * @param {Boolean} once Only remove one-time listeners.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  off(event, listener, context, once) {
    super.off(event, listener, context, once)

    return this
  }

  /**
   * Starts the animation.
   * @param {Number|String} [time] - Setting manual time instead of current browser timestamp or like `+1000` relative to current timestamp.
   */
  start(time) {
    this._group.add(this)

    this._startTime = time !== undefined
      ? typeof time === 'string'
        ? now() + parseFloat(time)
        : time
      : now()

    this._startTime += this._delayTime

    this._isPlaying = true
  }

  setRepeatStartEvent(value = true) {
    this._repeatStartEvent = value
  }

  /**
   * Set delay time of animation.
   * @param {Number} amount - Duration of delay / wait in milliseconds.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  delay(amount) {
    this._delayTime = amount

    return this
  }

  /**
   * Sets how many times animation is repeating.
   * @param {Number} times - The times of repeat.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  repeat(times) {
    this._repeatCount = times
    this._repeat = this._repeatCount

    return this
  }

  /**
   * Sets delay of animation between repeats.
   * @param {Number} amount - Duration of delay / wait in milliseconds.
   * @returns {TWEEN.AbstractAnimation} - Returns itself. It's useful for chaining.
   */
  repeatDelay(amount) {
    this._repeatDelayTime = amount

    return this
  }

  /**
   * State of playing of tween.
   * @returns {Boolean} - When animation is playing returns `true`.
   */
  isPlaying() {
    return this._isPlaying
  }

  /**
   * State of started of animation.
   * @returns {Boolean} - If animation is started returns `true`.
   */
  isStarted() {
    return this._onStartEventFired
  }

  /**
   * Updates the animation progress by given `time`.
   * @param {Number} [time] - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   */
  update(time) {
    time = time !== undefined ? time : now()

    if (!this._isPlaying) {
      return false
    }

    return true
  }
}
