/* eslint-disable */
// @ts-nocheck
import AbstractAnimationContainer from './abstract-animation-container'
import Tween from './tween'

import { events } from './core'

/**
 * Allow to compose animations into parallel.
 * Animations tha put in parallel plays together.
 *
 * @class
 * @memberof TWEEN
 * @extends TWEEN.AbstractAnimationContainer
 */
export default class Parallel extends AbstractAnimationContainer {
  /**
   * Fired when this Parallel is started.
   * @event TWEEN.Parallel#start
   */

  /**
   * Fired when this Parallel is updated.
   * @event TWEEN.Parallel#update
   */

  /**
   * Fired when this Parallel is completed.
   * @event TWEEN.Parallel#complete
   */

  /**
   * Fired when this Parallel is repeated.
   * @event TWEEN.Parallel#repeat
   */

  /**
   * Creates an instance of Parallel
   *
   * @param {AbstractAnimation[]|AbstractAnimation} [tweens] - Animations or Array of Animations to be added.
   * @returns {TWEEN.Parallel} - Returns itself. It's useful for chaining.
   */
  constructor(...animations) {
    super(...animations)

    this._delayOffset = null

    return this
  }

  /**
   * Adds a function call to this chain.
   *
   * @param {Function} fn - Function that will be executed.
   * @returns {TWEEN.Chain} - Returns itself. It's useful for chaining.
   */
  call(fn) {
    this.add(new Tween().duration(0).on(events.complete, fn))

    return this
  }

  /**
   * Starts the animations in parallel.
   *
   * @param {Number|String} [time] - Setting manual time instead of current browser timestamp or like `+1000` relative to current timestamp.
   * @returns {TWEEN.Parallel} - Returns itself. It's useful for chaining.
   * @example parallel.start()
   */
  start(time?) {
    super.start(time)

    if (this._onStartEventFired) {

      if (this._repeatDelayTime !== undefined) {
        this._startTime = time + this._repeatDelayTime
      } else {
        this._startTime = time + this._delayTime
      }
    }

    let delay = 0

    this._animations.forEach((animation) => {


      if (this._childrenRepeatStartEvent) {
        animation.setRepeatStartEvent()
      }

      animation.start(this._startTime + delay)

      if (this._delayOffset > 0) {
        delay += this._delayOffset
      }

    })

    return this
  }

  /**
   * Set delay time between animations.
   *
   * @param {Number} amount - Duration of delay / wait in milliseconds.
   * @returns {TWEEN.Parallel} - Returns itself. It's useful for chaining.
   */
  delayOffset(amount) {
    this._delayOffset = amount

    return this
  }

  /**
   * Updates animations in parallel.
   *
   * @param {Number} [time] - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   * @example parallel.update()
   */
  update(time) {
    if (!super.update(time)) {
      return false
    }

    let active = false

    this._animations.forEach((animation) => {
      if (animation.update(time)) {
        active = true
      }
    })

    if (!active) {
      if (this._repeat > 0) {

        if (isFinite(this._repeat)) {
          this._repeat--
        }

        this._childrenRepeatStartEvent = true
        this.start(time)
        this.emit(events.repeat)

        return true

      } else {
        this._isPlaying = false

        this.emit(events.complete)

        return false
      }
    } else {
      if (time === Infinity) {
        for (const animation of this._animations) {
          if (animation.isPlaying()) {
            animation.end()
          }
        }
      }

      this.emit(events.update)
    }

    return true
  }

  end() {
    this.update(Infinity)

    return this
  }
}
