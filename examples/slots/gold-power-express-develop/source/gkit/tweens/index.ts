import Tween from './tween'
import IndefiniteTween from "./indefinite-tween"
import Chain from './chain'
import Parallel from './parallel'

import {
  remove,
  getAll,
  removeAll,
  update,
  setTimeSource,
  setDefaultTimeSource,
  events
} from './core'

import {
  endTweenIfExist,
  stopTweenIfExist,
  createKeyframesEasing
} from '@/gkit/tweens/utils'

/**
 * @namespace TWEEN
 */

export {
  Tween,
  IndefiniteTween,
  Chain,
  Parallel,
  remove,
  events,
  getAll,
  removeAll,
  update,
  setTimeSource,
  setDefaultTimeSource,
  endTweenIfExist,
  stopTweenIfExist,
  createKeyframesEasing
}

export * from './ease'
export * as Ease from './ease'
export * from './interpolation'
