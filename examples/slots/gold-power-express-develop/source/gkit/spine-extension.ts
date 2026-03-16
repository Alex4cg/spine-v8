import { AnimationState, TrackEntry, Animation, EventTimeline } from '@esotericsoftware/spine-pixi-v8'

// eslint-disable-next-line
declare module '@esotericsoftware/spine-pixi-v8' {
  interface AnimationState {
    onceTrackCompleted(trackIndex: number, callback: () => void): void
    getAnimationByName(animationName: string): Animation | null
    getEventTime(animationName: string, eventName: string): number
  }

  interface Animation {
    /**
   * Get time until certain event will fire
   * If there are several event fire keyframes earliest will be returned
   *
   * @param eventName - The name of the event to search for.
   * @returns The time (in seconds) until the event occurs,
   *          or `Infinity` if the event does not exist in the animation.
   *
   * @example
   * ```ts
   * const time = animation.getTimeUntilEvent(`detach`)
   *
   * if (time !== Infinity) {
   *   console.log(`Event 'detach' happens at: ${time}s`)
   * }
   * ```
   */
    getTimeUntilEvent(eventName: string): number
  }
}

AnimationState.prototype.onceTrackCompleted = function onceTrackCompleted(trackIndex, callback) {
  const listener = {
    complete: (entry: TrackEntry) => {
      if (entry.trackIndex === trackIndex) {
        callback()

        this.removeListener(listener)
      }
    }
  }

  this.addListener(listener)
}

AnimationState.prototype.getAnimationByName = function getAnimationByName(animationName) {
  const animation = this.data.skeletonData.findAnimation(animationName)

  return animation
}

AnimationState.prototype.getEventTime = function getEventTime(animationName: string, eventName: string) {
  const animation = this.getAnimationByName(animationName)

  if (!animation) {
    throw new Error(`Animation ${animationName} not found`)
  }

  let eventTime = 0

  for (const timeline of animation.timelines) {
    if (timeline instanceof EventTimeline) {
      for (const event of timeline.events) {
        if (event.data.name === eventName) {
          eventTime = event.time / this.timeScale
        }
      }
    }
  }

  return eventTime
}

Animation.prototype.getTimeUntilEvent = function getTimeUntilEvent(eventName: string) {
  for (const timeline of this.timelines) {
    if (timeline instanceof EventTimeline) {
      for (const event of timeline.events) {
        if (event.data.name === eventName) {
          return event.time
        }
      }
    }
  }

  return Infinity
}
