import { Container, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

import MultFrameSpine from '@/assets/spine/mult_frame/skeleton'
import fonts from '@/assets/fonts/bitmap.gen'
import { IndefiniteTween } from '@/gkit/tweens'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'

const TRACK_MAIN = 0

const TEXT_FILL_COLOR = 0xFFFFFF
const TEXT_STROKE_COLOR = 0x6B0060

export default class MultiplierFrame extends Container {
  #spine: Spine
  #multiplier: number
  #text: MultiShadowBitmapText
  #col: number
  #row: number

  constructor(col: number, row: number, multiplier: number) {
    super()

    this.#col = col
    this.#row = row
    this.#multiplier = multiplier

    this.#spine = this.addChild(new Spine(MultFrameSpine.spineData))
    this.#spine.autoUpdate = false

    this.#text = new MultiShadowBitmapText(
      `x${multiplier}`,
      {
        ...fonts.aclonicaRegular,
        fontSize: 50,
        fill: TEXT_FILL_COLOR
      },
      [
        { offsetX: -4, offsetY: 0, color: TEXT_STROKE_COLOR },
        { offsetX: 4, offsetY: 0, color: TEXT_STROKE_COLOR },
        { offsetX: 0, offsetY: -4, color: TEXT_STROKE_COLOR },
        { offsetX: 0, offsetY: 4, color: TEXT_STROKE_COLOR },
        { offsetX: -3, offsetY: -3, color: TEXT_STROKE_COLOR },
        { offsetX: 3, offsetY: -3, color: TEXT_STROKE_COLOR },
        { offsetX: -3, offsetY: 3, color: TEXT_STROKE_COLOR },
        { offsetX: 3, offsetY: 3, color: TEXT_STROKE_COLOR }
      ]
    )
    this.#text.setAnchor(0.5)

    const slotName = `text_holder`
    this.#spine.addSlotObject(slotName, this.#text, { followAttachmentTimeline: true })

    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    const deltaTime = Ticker.shared.deltaMS / 1000
    this.#spine.update(deltaTime)
  }

  get col() {
    return this.#col
  }

  get row() {
    return this.#row
  }

  get multiplier() {
    return this.#multiplier
  }

  getShowTween() {
    return new IndefiniteTween((stopTween) => {
      this.#spine.state.setAnimation(TRACK_MAIN, `start`, false)

      this.#spine.state.onceTrackCompleted(TRACK_MAIN, () => {
        this.#spine.state.setAnimation(TRACK_MAIN, `idle`, true)
        stopTween()
      })
    })
  }

  getHideTween() {
    return new IndefiniteTween((stopTween) => {
      this.alpha = 0
      stopTween()
    })
  }

  getActivateTween() {
    return new IndefiniteTween((stopTween) => {
      this.#spine.state.setAnimation(TRACK_MAIN, `activ`, false)

      this.#spine.state.onceTrackCompleted(TRACK_MAIN, () => {
        stopTween()
      })
    })
  }

  reset() {
    this.alpha = 1
    this.scale.set(1)
    this.#spine.state.setEmptyAnimations(0.01)
    this.#spine.state.clearTracks()
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    super.destroy(options)
  }
}
