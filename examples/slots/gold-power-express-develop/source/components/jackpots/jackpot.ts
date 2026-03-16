import { Container, Sprite, Ticker, type DestroyOptions } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { JackpotTypes } from '@/const'
import { Tween, endTweenIfExist } from '@/gkit/tweens'
import mainAtlas from '@/assets/atlas/main/atlas.gen'
import JpEffectSpine from '@/assets/spine/jp_effect/skeleton'

const TRACK_MAIN = 0

const getTextureByType = (type: JackpotTypes) => {
  switch (type) {
    case JackpotTypes.Grand:
      return mainAtlas.getTexture(`grand`)
    case JackpotTypes.Major:
      return mainAtlas.getTexture(`major`)
    case JackpotTypes.Midi:
      return mainAtlas.getTexture(`midi`)
    case JackpotTypes.Mini:
      return mainAtlas.getTexture(`mini`)
    default:
      return mainAtlas.getTexture(`grand`)
  }
}

const getSkinByType = (type: JackpotTypes) => {
  switch (type) {
    case JackpotTypes.Grand:
      return `grand`
    case JackpotTypes.Major:
      return `major`
    case JackpotTypes.Midi:
      return `midi`
    case JackpotTypes.Mini:
      return `mini`
    default:
      return `grand`
  }
}

export default class Jackpot extends Container {
  #sprite: Sprite
  #effectSpine: Spine
  #stopTween?: Tween
  #type: JackpotTypes

  constructor(type: JackpotTypes) {
    super()

    this.#type = type

    this.#sprite = this.addChild(new Sprite(getTextureByType(type)))
    this.#sprite.anchor.set(0.5)
    this.#sprite.scale.set(1 / 3)

    this.#effectSpine = this.addChild(new Spine(JpEffectSpine.spineData))
    this.#effectSpine.autoUpdate = false
    this.#effectSpine.skeleton.setSkinByName(getSkinByType(type))
    this.#effectSpine.skeleton.setSlotsToSetupPose()
    this.#effectSpine.visible = false

    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    if (this.#effectSpine.visible) {
      const deltaTime = Ticker.shared.deltaMS / 1000
      this.#effectSpine.update(deltaTime)
    }
  }

  get jackpotType() {
    return this.#type
  }

  active(repeat = false) {
    endTweenIfExist(this.#stopTween)
    this.#effectSpine.alpha = 1
    this.#effectSpine.visible = true
    this.#effectSpine.state.setAnimation(TRACK_MAIN, `animation`, repeat)

    if (!repeat) {
      this.#effectSpine.state.addListener({
        complete: () => {
          this.#effectSpine.visible = false
          this.#effectSpine.state.clearTracks()
          this.#effectSpine.state.clearListeners()
        }
      })
    }
  }

  stop() {
    endTweenIfExist(this.#stopTween)
    this.#effectSpine.state.clearListeners()

    this.#stopTween = Tween.fromTo(
      this.#effectSpine,
      { alpha: this.#effectSpine.alpha },
      { alpha: 0 },
      { duration: 200 }
    )

    this.#stopTween.once(`complete`, () => {
      this.#effectSpine.visible = false
      this.#effectSpine.state.clearTracks()
      this.#effectSpine.alpha = 1
    })

    this.#stopTween.start()
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)
    endTweenIfExist(this.#stopTween)
    super.destroy(options)
  }
}
