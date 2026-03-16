/* eslint-disable */
// @ts-nocheck
import AbstractAnimation from './abstract-animation'
import Group from './group'

import { events } from './core'

/**
 * An abstract class that holds common logic for animation containers.
 * Allows to compose tweens and / or containers.
 *
 * @abstract
 * @class
 * @memberof TWEEN
 * @extends TWEEN.AbstractAnimation
 */
export default class AbstractAnimationContainer extends AbstractAnimation {
  /**
   * An easier way to construct a container.
   *
   * @static
   * @param {...TWEEN.AbstractAnimation} [animations] - Animations to be added.
   * @returns {TWEEN.AbstractAnimationContainer} - Returns new instance of itself.
   */
  static of(...animations) {
    return new this(...animations)
  }

  /**
   * Creates an instance of AbstractAnimationContainer.
   *
   * @param {...TWEEN.AbstractAnimation} [animations] - Animations to be added.
   */
  constructor(...animations) {
    super()

    this._childrenGroup = new Group()
    this._animations = []
    this._childrenRepeatStartEvent = false

    animations.forEach((animation) => this.add(animation))
  }

  /**
   * Fired when this animation is started.
   * @event TWEEN.AbstractAnimationContainer#start
   */

  /**
   * Adds the passed animations to container.
   *
   * @param {...TWEEN.AbstractAnimation} [animations] - Animation to be added.
   * @returns {TWEEN.AbstractAnimationContainer} - Returns itself. It's useful for chaining.
   */
  add(...animations) {
    animations.forEach(this._tryToAddAnimation.bind(this))

    return this
  }

  remove(animation) {
    this._animations.splice(this._animations.indexOf(animation), 1)
  }

  _tryToAddAnimation(animation) {
    if (animation.isStarted()) {
      throw new Error(`Can't add started animation to container.`)
    }

    if (animation._duration === Infinity) {
      throw new Error(`Can't add Infinity Animation to container`)
    }

    animation._group.remove(animation)

    animation._group = this._childrenGroup
    this._animations.push(animation)
  }

  /**
   * @returns {TWEEN.AbstractAnimationContainer[]}
   */
  getAll() {
    return this._animations
  }

  setRepeatStartEvent(value = true) {
    this._childrenRepeatStartEvent = value
    this._repeatStartEvent = value
  }

  /**
   * Updates animations in container.
   *
   * @param {Number} [time] - Current time.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   */
  update(time) {
    if (!super.update(time)) {
      return false
    }

    if (time < this._startTime) {
      return true
    }

    if (!this._onStartEventFired) {
      this.emit(events.start)

      this._onStartEventFired = true
    } else if (this._onStartEventFired && this._repeatStartEvent) {
      this.emit(events.start)

      this._repeat = this._repeatCount
      this._repeatStartEvent = false
      this._childrenRepeatStartEvent = false
    }

    return true
  }
}
