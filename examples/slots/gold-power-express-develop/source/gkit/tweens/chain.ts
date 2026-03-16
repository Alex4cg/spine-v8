/* eslint-disable */
// @ts-nocheck
import AbstractAnimationContainer from './abstract-animation-container'
import Tween from './tween'

import { events } from './core'

/**
 * Allows to compose animations into chains.
 * Animations in chains plays one after another.
 *
 * @class
 * @memberof TWEEN
 * @extends TWEEN.AbstractAnimationContainer
 */
export default class Chain extends AbstractAnimationContainer {
  /**
   * Fired when this Chain is started.
   *
   * @event TWEEN.Chain#start
   */

  /**
   * Fired when this Chain is updated.
   *
   * @event TWEEN.Chain#update
   */

  /**
   * Fired when this Chain is completed.
   *
   * @event TWEEN.Chain#complete
   */

  /**
   * Fired when this Chain is repeated.
   *
   * @event TWEEN.Chain#repeat
   */

  /**
   * Creates an instance of Chain.
   *
   * @param {...TWEEN.AbstractAnimation} [animation] - Animations to be added.
   * @returns {TWEEN.Chain} - Returns itself. It's useful for chaining.
   */
  constructor(...animations) {
    super(...animations)

    this._currentAnimationIndex = 0

    return this
  }

  /**
   * Adds a wait period to this chain.
   *
   * @param {Number} amount - Duration of delay / wait in milliseconds.
   * @returns {TWEEN.Chain} - Returns itself. It's useful for chaining.
   */
  wait(duration) {
    this.add(new Tween().duration(duration))

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
   * Updates current animation in chain.
   *
   * @param {Number} [time] - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   * @example chain.update(100)
   */
  update(time) {
    if (!super.update(time)) {
      return false
    }


    if (time === Infinity && this._isPlaying) {
      for (let i = this._currentAnimationIndex; i < this._animations.length; i++) {
        this._animations[i].start(0)
        this._animations[i].end()
      }

      this.emit(events.complete)

      this._isPlaying = false
      this._childrenRepeatStartEvent = false
      this.setRepeatStartEvent(false)

      return false
    }

    const current = this._animations[this._currentAnimationIndex] || null

    if (current !== null && current.update(time)) {
      this.emit(events.update)

      return true
    }

    const next = this._animations[this._currentAnimationIndex + 1] || null

    if (next !== null) {
      this._currentAnimationIndex++

      if (this._childrenRepeatStartEvent) {
        next.setRepeatStartEvent()
      }

      next.start(time)

      return true
    }

    if (this._repeat > 0) {
      if (isFinite(this._repeat)) {
        this._repeat--
      }

      this._childrenRepeatStartEvent = true

      this.start(time)
      this.emit(events.repeat)

      return true
    }

    this._isPlaying = false

    this.emit(events.complete)

    return false
  }

  /**
   * Starts the chain.
   *
   * @param {Number|String} [time] - Setting manual time instead of current browser timestamp or like `+1000` relative to current timestamp.
   * @returns {TWEEN.Chain} - Returns itself. It's useful for chaining.
   * @example chain.start()
   */
  start(time?) {
    super.start(time)

    if (this._onStartEventFired) {
      if (this._repeatDelayTime !== undefined) {
        this._startTime = time + this._repeatDelayTime
      } else {
        this._startTime = time + this._delayTime
      }

      this._currentAnimationIndex = 0

      if (this._childrenRepeatStartEvent) {
        this._animations[this._currentAnimationIndex].setRepeatStartEvent()
      }

      this._animations[this._currentAnimationIndex].start(this._startTime)
    } else {
      const current = this._animations[this._currentAnimationIndex]
      current && current.start(this._startTime)

    }

    return this
  }

  end() {
    this.update(Infinity)

    return this
  }
}
