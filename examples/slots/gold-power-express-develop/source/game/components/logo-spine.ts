import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

import LogoSpineAsset from '@/assets/spine/logo/skeleton'

export default class LogoSpine extends Container {
  #spine: Spine

  constructor() {
    super()

    this.#spine = new Spine(LogoSpineAsset.spineData)
    this.#spine.autoUpdate = false
    this.addChild(this.#spine)

    this.#spine.state.setAnimation(0, `idle`, true)

    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    this.#spine.update(Ticker.shared.deltaMS / 1000)
  }

  alignTopCenter(x: number, y: number) {
    this.#spine.update(0)

    const bounds = this.#spine.getLocalBounds()

    this.#spine.x = x - (bounds.x + (bounds.width * 0.5))
    this.#spine.y = y - bounds.y
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    super.destroy(options)
  }
}
