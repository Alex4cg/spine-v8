import type AbstractAnimation from '@/gkit/tweens/abstract-animation'
import Group from './group'

const globalGroup = new Group()

let now: () => void

const remove = (tween: AbstractAnimation) => globalGroup.remove(tween)
const getAll = () => globalGroup.getAll()
const removeAll = () => globalGroup.removeAll()
const update = (time: number, preserve: boolean) => globalGroup.update(time, preserve)
const setTimeSource = (timeSource: () => void) => { now = timeSource }
const setDefaultTimeSource = () => { now = () => performance.now() }

setDefaultTimeSource()

const events = Object.freeze({
  start: `start`,
  stop: `stop`,
  complete: `complete`,
  update: `update`,
  repeat: `repeat`
} as const)

export {
  globalGroup,
  remove,
  removeAll,
  getAll,
  update,
  events,
  now,
  setTimeSource,
  setDefaultTimeSource
}
