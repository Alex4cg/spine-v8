import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Tween } from '@/gkit/tweens'

import IntrigueSpine from '@/assets/spine/intrigue/skeleton'

const TRACK_MAIN = 0

export default class IntrigueFrame extends Container {
  #spine: Spine
  #isActive = false
  #fadeTween: Tween | null = null

  constructor() {
    super()

    this.#spine = this.addChild(new Spine(IntrigueSpine.spineData))
    this.#spine.autoUpdate = false
    this.#spine.skeleton.setSkinByName(`default`)
    this.#spine.skeleton.setSlotsToSetupPose()
    this.visible = false
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

  play() {
    this.#isActive = true
    this.visible = true

    if (this.#fadeTween) {
      this.#fadeTween.stop()
      this.#fadeTween = null
    }

    this.#fadeTween = Tween.to(this, { alpha: 1 }, { duration: 300 })
    this.#fadeTween.start()

    this.#spine.state.setAnimation(TRACK_MAIN, `animation`, true)
  }

  hide() {
    this.#isActive = false

    if (this.#fadeTween) {
      this.#fadeTween.stop()
      this.#fadeTween = null
    }

    this.#fadeTween = Tween.to(this, { alpha: 0 }, { duration: 200 })
    this.#fadeTween.once(`complete`, () => {
      this.visible = false
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
