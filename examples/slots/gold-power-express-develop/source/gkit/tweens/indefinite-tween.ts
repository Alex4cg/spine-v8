/* eslint-disable */
// @ts-nocheck

import AbstractAnimation from './abstract-animation'
import { events } from './core'

/**
 * Allows to wrap non-tween operations in Tween.
 *
 * @class
 * @memberof TWEEN
 * @extends TWEEN.AbstractAnimation
 */
export default class IndefiniteTween extends AbstractAnimation {

  /**
   * Creates an instance of IndefiniteTween.
   *
   * @param {Function} fn - Function to be executed by Tween. It's first argument should be a callback.
   * @param {...args} [args] - If passed adds arguments to function that to be executed.
   * @memberof IndefiniteTween
   */
  constructor(fn: (stopTween: () => void) => void, args?) {
    super()

    this._fn = fn
    this._args = args

    this._isExecuting = false

    return this
  }

  /**
   * Fired when this Tween is started.
   * @event TWEEN.IndefiniteTween#start
   */

  /**
   * Fired when this Tween is updated.
   * @event TWEEN.IndefiniteTween#update
   */

  /**
   * Fired when this Tween is repeated.
   * @event TWEEN.IndefiniteTween#repeat
   */

  /**
   * Fired when this Tween is completed.
   * @event TWEEN.IndefiniteTween#complete
   */

  /**
   * Starts the animation.
   *
   * @param {Number|String} [time] - Setting manual time instead of current browser timestamp or like `+1000` relative to current timestamp.
   * @returns {TWEEN.IndefiniteTween} - Returns itself. It's useful for chaining.
   */
  start(time?) {
    super.start(time)

    this._isExecuting = false

    return this
  }

  /**
   * Updates current animation.
   *
   * @param {Number} [time] - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   */
  update(time) {
    if (time === Infinity) {
      throw new Error(`You can't immediately complete tween with time Infinity. Use callback to complete tween`)
    }

    if (!super.update(time)) {
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

      this.emit(events.start)
    }

    this.emit(events.update)

    if (!this._isExecuting) {
      this._execute(time)
    }

    return true
  }

  _execute(time) {
    this._isExecuting = true

    this._fn(this._onExecuteCallback.bind(this, time), this._args)
  }

  _onExecuteCallback(time) {
    this._isExecuting = false

    if (!this.isPlaying()) {
      return
    }

    if (!this._repeat) {
      this._isPlaying = false

      this._group.remove(this)

      this.emit(events.complete)

      return
    }

    if (isFinite(this._repeat)) {
      this._repeat--
    }

    if (this._repeatDelayTime !== undefined) {
      this._startTime = time + this._repeatDelayTime
    } else {
      this._startTime = time + this._delayTime
    }

    this.emit(events.repeat)
  }

  end() {
    throw new Error(`You can't immediately complete tween. You can complete tween only inside callback function`)
  }
}
