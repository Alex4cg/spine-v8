/* eslint-disable */
// @ts-nocheck
export function stopTweenIfExist(tween) {
  if (tween !== null && tween !== undefined) {
    tween.stop()
  }
}

export function endTweenIfExist(tween) {
  if (tween !== null && tween !== undefined) {
    tween.end()
  }
}

/**
 * @param keyframes - config object.
 * Transition between progress points is LINEAR
 * @returns {function(*): number}
 *
 * Example:
 *  const winGroupLightEasing = createKeyframesEasing({
 *      progress: 0,
 *      value: 0,
 *  }, {
 *      progress: 0.3,
 *      value: 1,
 *  }, {
 *      progress: 0.8,
 *      value: 1,
 *  }, {
 *      progress: 1,
 *      value: 0,
 *  })
 */

export const createKeyframesEasing = (...keyframes) => function (progress) {
  let previousKeyframe; let
    nextKeyframe

  for (const keyframe of keyframes) {
    if (keyframe.progress < progress) {
      previousKeyframe = keyframe
    } else {
      nextKeyframe = keyframe
      break
    }
  }

  if (!previousKeyframe) {
    previousKeyframe = keyframes[0]
  }
  if (!nextKeyframe) {
    nextKeyframe = keyframes[keyframes.length - 1]
  }

  const nextRelProgress = nextKeyframe.progress - previousKeyframe.progress
  const relativeProgress = progress - previousKeyframe.progress
  const nextValueWeight = nextRelProgress ? relativeProgress / nextRelProgress : 1

  return nextKeyframe.value * nextValueWeight + previousKeyframe.value * (1 - nextValueWeight)
}
