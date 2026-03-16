import { Spine } from '@esotericsoftware/spine-pixi-v8'
import ItemBase from './item-base'
import { IDSpecial } from './const'
import { IndefiniteTween } from '@/gkit/tweens'
import CollectorSpine from '@/assets/spine/coin_collector/skeleton'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'
import fonts from '@/assets/fonts/bitmap.gen'

const TEXT_FILL_COLOR = 0xFFFFFF
const TEXT_STROKE_COLOR = 0x6B0060

export default class ItemCollector extends ItemBase {
  #multiplierText: MultiShadowBitmapText
  #multiplierValue: number = 0

  constructor() {
    super(IDSpecial.Collector)

    const spineData = CollectorSpine.spineData
    const mainSpine = this.addChild(new Spine(spineData))
    mainSpine.autoUpdate = false
    mainSpine.skeleton.setSkinByName(`default`)
    mainSpine.skeleton.setSlotsToSetupPose()

    this.mainSpine = mainSpine

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    this.#multiplierText = new MultiShadowBitmapText(
      ``,
      {
        ...fonts.aclonicaRegular,
        fontSize: 72,
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
    this.#multiplierText.setAnchor(0.5)

    const slotName = `text_holder`
    this.mainSpine.addSlotObject(slotName, this.#multiplierText, { followAttachmentTimeline: true })

    this.playIdle()
  }

  get multiplier() {
    return this.#multiplierValue
  }

  playIdle() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(1, `idle`, true)
    }
  }

  playStart() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `start`, false)
      this.mainSpine.state.addAnimation(1, `idle`, true, 0)

      this.mainSpine.state.onceTrackCompleted(2, () => {
        this.mainSpine!.state.clearTrack(2)
      })
    }
  }

  playIdleWithMultiplier() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(1, `idle_mult`, true)
    }
  }

  setInitialMultiplier(multiplier: number) {
    this.#multiplierValue = multiplier
    this.#multiplierText.setText(multiplier > 0 ? `${multiplier}x` : ``)
  }

  setMultiplier(multiplier: number) {
    this.#multiplierValue = multiplier
    this.#multiplierText.setText(multiplier > 0 ? `${multiplier}x` : ``)

    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `train_to_mult`, false)
    }
  }

  applyMultiplier(multiplier: number) {
    this.#multiplierValue = this.#multiplierValue + multiplier
    this.#multiplierText.setText(this.#multiplierValue > 0 ? `${this.#multiplierValue}x` : ``)

    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `train_to_mult`, false)
    }
  }

  getShotTween() {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `hit`, false)

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getCollectTween(multiplier: number) {
    return new IndefiniteTween((stopTween) => {
      this.#multiplierValue = multiplier
      this.#multiplierText.setText(multiplier > 0 ? `${multiplier}x` : ``)

      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `train_to_mult`, false)

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          this.playIdleWithMultiplier()
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  override reset(): void {
    super.reset()

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    if (this.mainSpine) {
      this.mainSpine.skeleton.setSkinByName(`default`)
      this.mainSpine.skeleton.setSlotsToSetupPose()
      this.mainSpine.skeleton.setSlotsToSetupPose()
      this.mainSpine.state.setEmptyAnimations(0.01)
      this.mainSpine.state.clearTracks()
    }

    this.#multiplierValue = 0
    this.#multiplierText.setText(``)

    this.playIdle()
  }
}
