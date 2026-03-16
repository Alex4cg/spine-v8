import { Container, Ticker, type DestroyOptions, type PointData } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

import CollectEffectSpine from '@/assets/spine/collect_effect/skeleton'
import { IndefiniteTween } from '@/gkit/tweens'

export type CollectEffectSkin = `gold` | `blue` | `red` | `green`

const TRACK_HIT = 0
const TRACK_START_EFFECT = 1
const TRACK_END_EFFECT = 2
const EFFECT_SCALE = 1.2
const BASE_ARC_HEIGHT = 300
const MIN_ARC_HEIGHT = 150
const MAX_ARC_HEIGHT = 500
const LATERAL_THRESHOLD = 0.3
const LATERAL_STRENGTH = 0.6

export default class CollectEffect extends Container {
  #activeSpines: Set<Spine> = new Set()
  #skin: CollectEffectSkin = `gold`

  constructor() {
    super()
    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    const deltaTime = Ticker.shared.deltaMS / 1000
    for (const spine of this.#activeSpines) {
      spine.update(deltaTime)
    }
  }

  // TODO use
  setSkin(skin: CollectEffectSkin) {
    this.#skin = skin
  }

  #createSpine(skin?: CollectEffectSkin): Spine {
    const spine = new Spine(CollectEffectSpine.spineData)
    spine.autoUpdate = false
    spine.scale.set(EFFECT_SCALE)
    spine.skeleton.setSkinByName(skin ?? this.#skin)
    spine.skeleton.setSlotsToSetupPose()

    return spine
  }

  playEffect(
    fromPoint: PointData,
    toPoint: PointData,
    skin?: CollectEffectSkin,
    skipEndEffect?: boolean
  ): IndefiniteTween {
    return new IndefiniteTween((stopTween) => {
      const spine = this.#createSpine(skin)

      this.addChild(spine)
      this.#activeSpines.add(spine)

      const fromLocal = spine.toLocal(fromPoint)
      const toLocal = spine.toLocal(toPoint)

      const dx = toLocal.x - fromLocal.x
      const dy = toLocal.y - fromLocal.y

      const distance = Math.sqrt((dx * dx) + (dy * dy))
      const dynamicArcHeight = Math.max(
        MIN_ARC_HEIGHT,
        Math.min(MAX_ARC_HEIGHT, BASE_ARC_HEIGHT + (distance * 0.2))
      )

      const absDx = Math.abs(dx)
      const lateralOffset = absDx < distance * LATERAL_THRESHOLD
        ? (Math.random() < 0.5 ? -1 : 1) * dynamicArcHeight * LATERAL_STRENGTH
        : 0

      const cp1 = spine.skeleton.findBone(`control_point_1`)
      if (cp1) {
        cp1.x = fromLocal.x
        cp1.y = -fromLocal.y
      }

      const cp1t = spine.skeleton.findBone(`control_point_1_t`)
      if (cp1t) {
        cp1t.x = fromLocal.x + (dx * 0.15) + lateralOffset
        cp1t.y = -(fromLocal.y - (dynamicArcHeight * 0.8))
      }

      const cp2 = spine.skeleton.findBone(`control_point_2`)
      if (cp2) {
        cp2.x = toLocal.x
        cp2.y = -toLocal.y
      }

      const cp2t = spine.skeleton.findBone(`control_point_2_t`)
      if (cp2t) {
        cp2t.x = toLocal.x - (dx * 0.15) + lateralOffset
        cp2t.y = -(toLocal.y - (dynamicArcHeight * 0.8))
      }

      spine.state.setAnimation(TRACK_HIT, `hit_coin`, false)
      spine.state.setAnimation(TRACK_START_EFFECT, `start_effect`, false)

      if (skipEndEffect) {
        spine.state.onceTrackCompleted(TRACK_HIT, () => {
          this.#activeSpines.delete(spine)
          this.removeChild(spine)
          spine.destroy()
          stopTween()
        })
      } else {
        spine.state.setAnimation(TRACK_END_EFFECT, `end_effect`, false)

        spine.state.onceTrackCompleted(TRACK_END_EFFECT, () => {
          this.#activeSpines.delete(spine)
          this.removeChild(spine)
          spine.destroy()
          stopTween()
        })
      }
    })
  }

  playHitEffect(
    fromPoint: PointData,
    toPoint: PointData,
    skin?: CollectEffectSkin
  ): IndefiniteTween {
    return new IndefiniteTween((stopTween) => {
      const spine = this.#createSpine(skin)

      this.addChild(spine)
      this.#activeSpines.add(spine)

      const fromLocal = spine.toLocal(fromPoint)
      const toLocal = spine.toLocal(toPoint)

      const dx = toLocal.x - fromLocal.x
      const dy = toLocal.y - fromLocal.y

      const distance = Math.sqrt((dx * dx) + (dy * dy))
      const dynamicArcHeight = Math.max(
        MIN_ARC_HEIGHT,
        Math.min(MAX_ARC_HEIGHT, BASE_ARC_HEIGHT + (distance * 0.2))
      )

      const absDx = Math.abs(dx)
      const lateralOffset = absDx < distance * LATERAL_THRESHOLD
        ? (Math.random() < 0.5 ? -1 : 1) * dynamicArcHeight * LATERAL_STRENGTH
        : 0

      const cp1 = spine.skeleton.findBone(`control_point_1`)
      if (cp1) {
        cp1.x = fromLocal.x
        cp1.y = -fromLocal.y
      }

      const cp1t = spine.skeleton.findBone(`control_point_1_t`)
      if (cp1t) {
        cp1t.x = fromLocal.x + (dx * 0.15) + lateralOffset
        cp1t.y = -(fromLocal.y - (dynamicArcHeight * 0.8))
      }

      const cp2 = spine.skeleton.findBone(`control_point_2`)
      if (cp2) {
        cp2.x = toLocal.x
        cp2.y = -toLocal.y
      }

      const cp2t = spine.skeleton.findBone(`control_point_2_t`)
      if (cp2t) {
        cp2t.x = toLocal.x - (dx * 0.15) + lateralOffset
        cp2t.y = -(toLocal.y - (dynamicArcHeight * 0.8))
      }

      spine.state.setAnimation(TRACK_HIT, `hit`, false)
      spine.state.setAnimation(TRACK_START_EFFECT, `start_effect`, false)
      spine.state.setAnimation(TRACK_END_EFFECT, `end_effect`, false)

      spine.state.onceTrackCompleted(TRACK_END_EFFECT, () => {
        this.#activeSpines.delete(spine)
        this.removeChild(spine)
        spine.destroy()
        stopTween()
      })
    })
  }

  reset() {
    for (const spine of this.#activeSpines) {
      this.removeChild(spine)
      spine.destroy()
    }
    this.#activeSpines.clear()
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    this.reset()
    super.destroy(options)
  }
}
