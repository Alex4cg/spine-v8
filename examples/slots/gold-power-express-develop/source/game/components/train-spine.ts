import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { MiniSignal } from 'mini-signals'

import TrainSpineAsset from '@/assets/spine/train/skeleton'
import { IndefiniteTween, Tween } from '@/gkit/tweens'
import SmokeEmitter from '@/components/smoke-emitter'
import CoinEmitter, { BurstIntensity } from '@/components/coin-emitter'

const TRACK_IDLE = 0
const TRACK_PILES = 1
const TRACK_BG_SPEED = 2
const TRACK_LEVEL = 3
const TRACK_BLICK = 4
const TRACK_STEAM = 5
const TRACK_HIT = 6
const TRACK_TRAIL = 7
const TRACK_ACTIVE = 8

const HIT_TARGET_OFFSET_X = 40
const HIT_TARGET_OFFSET_Y = 0

const HIT_TARGET_OFFSET_X_MOBILE_PORTRAIT = 10
const HIT_TARGET_OFFSET_Y_MOBILE_PORTRAIT = 5

export default class TrainSpine extends Container {
  #spine: Spine
  #smokeEmitter: SmokeEmitter
  #coinEmitter1: CoinEmitter
  #coinEmitter2: CoinEmitter
  #currentLevel: 1 | 2 | 3 = 1
  #onTrainHit = new MiniSignal()
  #isMobilePortrait = false
  #cachedBounds: { x: number; y: number; width: number; height: number } | null = null

  constructor() {
    super()

    this.#smokeEmitter = new SmokeEmitter()
    this.addChild(this.#smokeEmitter)

    this.#spine = new Spine(TrainSpineAsset.spineData)
    this.#spine.autoUpdate = false
    this.addChild(this.#spine)

    this.#coinEmitter1 = new CoinEmitter(`left`)
    this.addChild(this.#coinEmitter1)

    this.#coinEmitter2 = new CoinEmitter(`right`)
    this.addChild(this.#coinEmitter2)

    this.#initBaseAnimations()
    this.#setupEventListeners()

    Ticker.shared.add(this.#onTick, this)
  }

  #initBaseAnimations() {
    this.#spine.state.setAnimation(TRACK_IDLE, `00_idle`, true)
    this.#spine.state.setAnimation(TRACK_PILES, `01_piles_of_gold`, true)
    this.#spine.state.setAnimation(TRACK_BG_SPEED, `02_bg_speed_effect`, true)
    this.#spine.state.setAnimation(TRACK_LEVEL, `level_1`, true)
    this.#spine.state.setAnimation(TRACK_TRAIL, `08_trail_track`, true)
  }

  #setupEventListeners() {
    this.#spine.state.addListener({
      event: (_entry, event) => {
        if (event.data.name === `train_hit`) {
          this.#triggerCoinBurst()
          this.#onTrainHit.dispatch()
        }
      }
    })
  }

  #triggerCoinBurst() {
    this.#coinEmitter1.burst(BurstIntensity.Medium)
    this.#coinEmitter2.burst(BurstIntensity.Medium)

    this.#coinEmitter1.emitFor(800)
    this.#coinEmitter2.emitFor(800)
  }

  #onTick() {
    this.#spine.update(Ticker.shared.deltaMS / 1000)
    this.#updateEmitterPositions()
  }

  #updateEmitterPositions() {
    const smokeBone = this.#spine.skeleton.findBone(`place_holder_emitter_1`)
    if (smokeBone) {
      this.#smokeEmitter.position.set(
        this.#spine.x + smokeBone.worldX,
        this.#spine.y + smokeBone.worldY
      )
    }

    const goldBone1 = this.#spine.skeleton.findBone(`place_holder_emitter_gold_1`)
    if (goldBone1) {
      this.#coinEmitter1.position.set(
        this.#spine.x + goldBone1.worldX,
        this.#spine.y + goldBone1.worldY
      )
    }

    const goldBone2 = this.#spine.skeleton.findBone(`place_holder_emitter_gold_2`)
    if (goldBone2) {
      this.#coinEmitter2.position.set(
        this.#spine.x + goldBone2.worldX,
        this.#spine.y + goldBone2.worldY
      )
    }
  }

  get onTrainHit() {
    return this.#onTrainHit
  }

  get currentLevel() {
    return this.#currentLevel
  }

  playHit(): IndefiniteTween {
    return new IndefiniteTween((stopTween) => {
      this.#spine.state.setAnimation(TRACK_HIT, `07_hit`, false)

      this.#spine.state.onceTrackCompleted(TRACK_HIT, () => {
        this.#spine.state.clearTrack(TRACK_HIT)
        stopTween()
      })
    })
  }

  playActive() {
    this.#spine.state.setAnimation(TRACK_ACTIVE, `06_active`, false)

    this.#spine.state.onceTrackCompleted(TRACK_ACTIVE, () => {
      this.#spine.state.clearTrack(TRACK_ACTIVE)
    })
  }

  playBlick() {
    this.#spine.state.setAnimation(TRACK_BLICK, `03_blick_add`, false)

    this.#spine.state.onceTrackCompleted(TRACK_BLICK, () => {
      this.#spine.state.clearTrack(TRACK_BLICK)
    })
  }

  playSteam() {
    const steamAnim = Math.random() > 0.5 ? `04_steam_1` : `05_steam_2`
    this.#spine.state.setAnimation(TRACK_STEAM, steamAnim, false)

    this.#spine.state.onceTrackCompleted(TRACK_STEAM, () => {
      this.#spine.state.clearTrack(TRACK_STEAM)
    })
  }

  setLevel(level: 1 | 2 | 3) {
    if (level === this.#currentLevel) return

    this.#currentLevel = level
    const animName = `level_${level}` as const

    const entry = this.#spine.state.setAnimation(TRACK_LEVEL, animName, true)
    if (entry) {
      entry.mixDuration = 0.33
    }

    this.#coinEmitter1.setLevelEmissionRate(level)
    this.#coinEmitter2.setLevelEmissionRate(level)
  }

  levelUp(): IndefiniteTween {
    return new IndefiniteTween((stopTween) => {
      if (this.#currentLevel >= 3) {
        Promise.resolve().then(() => {
          stopTween()
        })

        return
      }

      this.#spine.state.setAnimation(TRACK_HIT, `06_active`, false)

      const animationDuration = 1000
      Tween.to({}, {}, { duration: animationDuration }).once(`complete`, () => {
        this.#spine.state.clearTrack(TRACK_HIT)

        const newLevel = Math.min(this.#currentLevel + 1, 3) as 1 | 2 | 3
        this.setLevel(newLevel)

        stopTween()
      }).start()
    })
  }

  switchIdleVariant() {
    const currentAnim = this.#spine.state.getCurrent(TRACK_IDLE)
    const nextIdle = currentAnim?.animation?.name === `00_idle` ? `00_idle_2` : `00_idle`

    const entry = this.#spine.state.setAnimation(TRACK_IDLE, nextIdle, true)
    if (entry) {
      entry.mixDuration = 0.5
    }
  }

  #ensureCachedBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.#cachedBounds) {
      this.#spine.update(0)
      const bounds = this.#spine.getLocalBounds()
      this.#cachedBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    }

    return this.#cachedBounds
  }

  alignTopCenter(x: number, y: number) {
    const bounds = this.#ensureCachedBounds()

    this.#spine.x = x - (bounds.x + (bounds.width * 0.5))
    this.#spine.y = y - bounds.y
  }

  alignCenter(x: number, y: number) {
    const bounds = this.#ensureCachedBounds()

    this.#spine.x = x - (bounds.x + (bounds.width * 0.5))
    this.#spine.y = y - (bounds.y + (bounds.height * 0.5))
  }

  getGlobalPosition() {
    return this.#spine.toGlobal({ x: 0, y: 0 })
  }

  getHitTargetPosition() {
    const pos = this.#spine.toGlobal({ x: 0, y: 0 })

    const offsetX = this.#isMobilePortrait ? HIT_TARGET_OFFSET_X_MOBILE_PORTRAIT : HIT_TARGET_OFFSET_X
    const offsetY = this.#isMobilePortrait ? HIT_TARGET_OFFSET_Y_MOBILE_PORTRAIT : HIT_TARGET_OFFSET_Y

    return {
      x: pos.x + offsetX,
      y: pos.y + offsetY
    }
  }

  setMobilePortrait(value: boolean) {
    this.#isMobilePortrait = value
  }

  getBoneWorldPosition(boneName: string): { x: number; y: number } | null {
    const bone = this.#spine.skeleton.findBone(boneName)
    if (!bone) {
      return null
    }

    return this.#spine.toGlobal({ x: bone.worldX, y: bone.worldY })
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    this.#onTrainHit.detachAll()
    super.destroy(options)
  }
}
