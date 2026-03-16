/* eslint-disable */
// @ts-nocheck
import { now } from './core'

/**
 * A way to store animations and animation container.
 *
 * @class
 * @memberof TWEEN
 */
export default class Group {

  /**
   * Creates an instance of Group.
   *
   * @memberof Group
   */
  constructor() {

    /**
     * Holds references for all animations of this Group.
     *
     * @member {Object}
     * @private
     */
    this._animations = {}

    /**
     * Holds references for all animations of this Group that added during update.
     * @member {Object}
     * @private
     */
    this._animationsAddedDuringUpdate = {}
  }

  /**
   * Returns all members of this animation group.
   *
   * @returns {TWEEN.AbstractAnimation[]}
   */
  getAll() {
    return Object.keys(this._animations)
      .map((tweenId) => this._animations[tweenId])
  }

  /**
   * Remove all animations of this Group.
   */
  removeAll() {
    this._animations = {}
  }

  /**
   * Add animation to the group.
   *
   * @param {TWEEN.AbstractAnimation} animation - Animation that will be added.
   */
  add(animation) {
    this._animations[animation._id] = animation
    this._animationsAddedDuringUpdate[animation._id] = animation
  }

  /**
   * Remove animation from the group.
   *
   * @param {TWEEN.AbstractAnimation} animation - Animation that will be removed.
   */
  remove(animation) {
    delete this._animations[animation._id]
    delete this._animationsAddedDuringUpdate[animation._id]
  }

  /**
   * Updates all animations in the group.
   *
   * @param {Number} [time] - Current time.
   * @param {Boolean} preserve - If `preserve` flag is set then animations won't be removed from group after their completion.
   * @returns {Boolean} - Returns `false` when done (nothing to animate).
   */
  update(time?: number, preserve?: boolean) {
    let animationIds = Object.keys(this._animations)

    if (animationIds.length === 0) {
      return false
    }

    time = time !== undefined ? time : now()

    // Tweens are updated in "batches". If you add a new animation during an
    // update, then the new animation will be updated in the next batch.
    // If you remove a animation during an update, it may or may not be updated.
    // However, if the removed animation was added during the current batch,
    // then it will not be updated.
    while (animationIds.length > 0) {
      this._animationsAddedDuringUpdate = {}

      for (let i = 0; i < animationIds.length; i++) {

        let animation = this._animations[animationIds[i]]

        if (animation && animation.update(time) === false) {
          if (!preserve) {
            delete this._animations[animationIds[i]]
          }
        }
      }

      animationIds = Object.keys(this._animationsAddedDuringUpdate)
    }

    return true
  }
}
