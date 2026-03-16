import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Tween } from '@/gkit/tweens'

import CoinIndicatorReelSpine from '@/assets/spine/coin_indicator_reel/skeleton'

const TRACK_MAIN = 0

export default class CoinIndicatorReel extends Container {
  #spine: Spine
  #isActive = false
  #fadeTween: Tween | null = null

  constructor() {
    super()

    this.#spine = this.addChild(new Spine(CoinIndicatorReelSpine.spineData))
    this.#spine.autoUpdate = false
    this.#spine.skeleton.setSkinByName(`default`)
    this.#spine.skeleton.setSlotsToSetupPose()
    this.alpha = 0

    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    const deltaTime = Ticker.shared.deltaMS / 1000
    this.#spine.update(deltaTime)
  }

  get isActive() {
    return this.#isActive
  }

  playIn() {
    this.#isActive = true

    if (this.#fadeTween) {
      this.#fadeTween.stop()
      this.#fadeTween = null
    }

    this.#fadeTween = Tween.to(this, { alpha: 1 }, { duration: 250 })
    this.#fadeTween.start()

    this.#spine.state.setAnimation(TRACK_MAIN, `in`, false)
    this.#spine.state.addAnimation(TRACK_MAIN, `idle`, true, 0)
  }

  playIdle() {
    this.#isActive = true
    this.#spine.state.setAnimation(TRACK_MAIN, `idle`, true)
  }

  hide() {
    this.#isActive = false

    if (this.#fadeTween) {
      this.#fadeTween.stop()
      this.#fadeTween = null
    }

    this.#fadeTween = Tween.to(this, { alpha: 0 }, { duration: 200 })
    this.#fadeTween.once(`complete`, () => {
      this.#spine.state.clearTracks()
      this.#spine.skeleton.setToSetupPose()
    })
    this.#fadeTween.start()
  }

  reset() {
    this.hide()
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    super.destroy(options)
  }
}
