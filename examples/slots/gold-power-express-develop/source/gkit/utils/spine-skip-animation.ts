import { TrackEntry } from '@esotericsoftware/spine-pixi-v8'

export interface AnimationData {
  instance: TrackEntry | null
  targetStart: number | null
  elapsed: number | null
  endTime: number | null
}

export default function setSkipToAnimation(animationData: AnimationData) {
  if (animationData.instance === null) {
    throw new Error(`Animation instance is null`)
  }

  animationData.endTime = animationData.instance.animationEnd
  const targetStart = animationData.instance.animationEnd * 0.95 // Start at 95% of the animation

  animationData.instance.trackTime = targetStart
  animationData.targetStart = targetStart
  animationData.elapsed = 0
}

export function resetAnimationData(animationData: AnimationData) {
  animationData.instance = null
  animationData.targetStart = null
  animationData.elapsed = null
  animationData.endTime = null
}
