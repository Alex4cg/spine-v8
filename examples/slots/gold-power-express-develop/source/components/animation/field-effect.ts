import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import FieldEffectSpine from '@/assets/spine/field_effect/skeleton'

const TRACK_MAIN = 0

export default class FieldEffect extends Container {
  #spine: Spine
  #isActive = false

  constructor() {
    super()

    this.#spine = this.addChild(new Spine(FieldEffectSpine.spineData))
    this.#spine.autoUpdate = false
    this.#spine.skeleton.setSkinByName(`default`)
    this.#spine.skeleton.setSlotsToSetupPose()
    this.visible = false

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
    this.#spine.state.setAnimation(TRACK_MAIN, `animation`, true)
  }

  hide() {
    this.#isActive = false
    this.visible = false
    this.#spine.state.clearTracks()
    this.#spine.skeleton.setToSetupPose()
  }

  reset() {
    this.hide()
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    super.destroy(options)
  }
}
