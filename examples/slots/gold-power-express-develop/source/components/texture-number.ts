import { Container, Sprite, Texture, type DestroyOptions } from 'pixi.js'
import { ui } from '@clawbuster/facade'

import numbersAtlas from '@/assets/atlas/numbers/atlas.gen'
import { Tween } from '@/gkit/tweens'

type DigitChar = `0` | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9` | `.` | `x`

const DIGIT_TEXTURES_MAP: Readonly<Record<DigitChar, Texture>> = Object.freeze({
  0: numbersAtlas.getTexture(`wins/0.png`),
  1: numbersAtlas.getTexture(`wins/1.png`),
  2: numbersAtlas.getTexture(`wins/2.png`),
  3: numbersAtlas.getTexture(`wins/3.png`),
  4: numbersAtlas.getTexture(`wins/4.png`),
  5: numbersAtlas.getTexture(`wins/5.png`),
  6: numbersAtlas.getTexture(`wins/6.png`),
  7: numbersAtlas.getTexture(`wins/7.png`),
  8: numbersAtlas.getTexture(`wins/8.png`),
  9: numbersAtlas.getTexture(`wins/9.png`),
  x: numbersAtlas.getTexture(`wins/x.png`),
  '.': numbersAtlas.getTexture(`wins/dot.png`)
})

const MULTIPLIER_DIGIT_TEXTURES_MAP: Readonly<Record<DigitChar, Texture>> = Object.freeze({
  0: numbersAtlas.getTexture(`multiplayer-label/0.png`),
  1: numbersAtlas.getTexture(`multiplayer-label/1.png`),
  2: numbersAtlas.getTexture(`multiplayer-label/2.png`),
  3: numbersAtlas.getTexture(`multiplayer-label/3.png`),
  4: numbersAtlas.getTexture(`multiplayer-label/4.png`),
  5: numbersAtlas.getTexture(`multiplayer-label/5.png`),
  6: numbersAtlas.getTexture(`multiplayer-label/6.png`),
  7: numbersAtlas.getTexture(`multiplayer-label/7.png`),
  8: numbersAtlas.getTexture(`multiplayer-label/8.png`),
  9: numbersAtlas.getTexture(`multiplayer-label/9.png`),
  x: numbersAtlas.getTexture(`multiplayer-label/x.png`),
  '.': numbersAtlas.getTexture(`multiplayer-label/dot.png`)
})

const DIGIT_HEIGHT = 100

export class Digit extends Sprite {
  public digit: DigitChar
  #texturePack

  constructor(texturePack: Partial<Record<DigitChar, Texture>>) {
    super(texturePack[`0`])

    this.#texturePack = texturePack

    this.digit = `0`
  }

  setDigit(digit: DigitChar) {
    if (typeof this.#texturePack[digit] === `undefined`) {
      throw new Error(`Digit "${digit}" not found`)
    }

    this.digit = digit

    this.#updateTexture()
  }

  #updateTexture() {
    this.texture = this.#texturePack[this.digit]!
  }
}

export class _Number extends Container {
  public sprites: Digit[] = []
  #number: string = ``
  #texturePack
  #defaultSize: number
  #additionalOffset: number
  #punctuationLowering: number

  constructor(
    texturePack: Partial<Record<DigitChar, Texture>>,
    defaultSize = DIGIT_HEIGHT,
    additionalOffset = 0,
    punctuationLowering = 1
  ) {
    super()

    this.#texturePack = texturePack
    this.#defaultSize = defaultSize
    this.#additionalOffset = additionalOffset
    this.#punctuationLowering = punctuationLowering
  }

  get number() {
    return this.#number
  }

  set number(n: string) {
    this.#number = n

    const digits = n.split(``) as DigitChar[]

    let totalWidth = 0

    for (let i = 0; i < digits.length; i++) {
      let dSprite = this.sprites[i]

      if (!dSprite) {
        dSprite = this.addChild(new Digit(this.#texturePack))
        dSprite.y = -0.5 * this.#defaultSize
        this.sprites[i] = dSprite
      }

      dSprite.setDigit(digits[i])

      if (digits[i] === `x` || digits[i] === `.`) {
        const t = this.#punctuationLowering
        const yDefault = -0.5 * this.#defaultSize
        const yLowered = (this.#defaultSize * 0.5) - dSprite.height
        dSprite.y = (yDefault * (1 - t)) + (yLowered * t)
      } else {
        dSprite.y = -0.5 * this.#defaultSize
      }

      dSprite.visible = true
      totalWidth += dSprite.width
    }

    let x = (-totalWidth * 0.5) + (this.#additionalOffset * digits.length * 0.5)

    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i]
      sprite.visible = i < digits.length

      if (sprite.visible) {
        sprite.x = x
        x += sprite.width - this.#additionalOffset
      }
    }
  }
}

interface TextureNumberOptions {
  showX?: boolean
  alignX?: `left` | `right`
  defaultValue?: number
  showOnInit?: boolean
}

export default class TextureNumber extends Container {
  #value = 0
  #defaultValue
  #numbersContainer: _Number
  #isFormatting = true
  #isTruncate = true
  #isPostConvertValue = false
  #wrappedContainer: Container
  #numbersShadow: Sprite
  #size: number = DIGIT_HEIGHT
  #showX: boolean
  #alignX: `left` | `right`
  #showOnInit: boolean

  constructor(options: TextureNumberOptions = {}) {
    super()

    this.#showX = options.showX ?? false
    this.#alignX = options.alignX ?? `left`
    this.#defaultValue = options.defaultValue ?? 0
    this.#showOnInit = options.showOnInit ?? true

    this.#wrappedContainer = this.addChild(new Container())

    const shadow = new Sprite(Texture.EMPTY)
    shadow.anchor.set(0.5)
    shadow.scale.set(2)
    shadow.alpha = 0
    shadow.visible = false

    this.#numbersShadow = this.#wrappedContainer.addChild(shadow)

    this.#wrappedContainer.alpha = this.#showOnInit ? 1 : 0

    this.#numbersContainer = this.#wrappedContainer.addChild(new _Number(DIGIT_TEXTURES_MAP))
    this.#numbersContainer.position.set(0, 0)
    this.#numbersContainer.pivot.set(-(this.#numbersContainer.width / 2), -(this.#size / 2))
  }

  get value() {
    return this.#value
  }

  set value(value) {
    this.#value = value

    const formattedValue = this.#getFormattingValue()

    if (this.#showX) {
      this.#numbersContainer.number = this.#alignX === `left` ? `x${formattedValue}` : `${formattedValue}x`
    } else {
      this.#numbersContainer.number = formattedValue
    }

    this.#numbersContainer.x = -this.#numbersContainer.width * 0.5
    this.#numbersContainer.y = -this.#numbersContainer.height * 0.5
    this.#numbersContainer.pivot.x = -(this.#numbersContainer.width / 2)
  }

  #getFormattingValue() {
    const value = this.#isTruncate ? Math.trunc(this.#value) : this.#value

    return `${this.#isFormatting ? ui.formatCurrency(value, false, !this.#isPostConvertValue) : value}`
  }

  setFormattingSettings({ formatting = true, trunc = true, postConvertValue = false }) {
    this.#isFormatting = formatting
    this.#isTruncate = trunc
    this.#isPostConvertValue = postConvertValue
  }

  setSize(size: number) {
    this.#size = size
    this.#wrappedContainer.scale.set(size / DIGIT_HEIGHT)
    this.#numbersContainer.pivot.y = -(size / 2)
  }

  get size() {
    return this.#size
  }

  reset() {
    if (this.#showX) {
      this.#numbersContainer.number = this.#alignX === `left` ? `x${this.#defaultValue}` : `${this.#defaultValue}x`
    } else {
      this.#numbersContainer.number = `${this.#defaultValue}`
    }

    this.#wrappedContainer.alpha = this.#showOnInit ? 1 : 0
    this.#numbersContainer.pivot.y = -(this.#size / 2)
  }

  playInAnimation() {
    Tween.to(this.#numbersContainer, { alpha: 1 }, { duration: 250 }).start()
  }

  playOutAnimation(duration: number = 250) {
    Tween.to(this.#numbersContainer, { alpha: 0 }, { duration }).start()
  }

  enableShadow() {
    this.#numbersShadow.visible = true
  }

  disableShadow() {
    this.#numbersShadow.visible = false
  }

  getShowShadowTween(duration: number) {
    return Tween.to(this.#numbersShadow, { alpha: 1 }, { duration })
  }

  getHideShadowTween(duration: number) {
    return Tween.to(this.#numbersShadow, { alpha: 0 }, { duration })
  }

  setSizeByAnimation(size: number, duration: number) {
    return Tween.to(this.#wrappedContainer,
      { scaleX: size / DIGIT_HEIGHT, scaleY: size / DIGIT_HEIGHT },
      { duration: duration * 1000 }
    )
  }

  setVisible(value: boolean) {
    this.#numbersContainer.visible = value
  }

  destroy(options: DestroyOptions = { children: true }): void {
    super.destroy(options)
  }
}

export class MultiplierLabel extends Sprite {
  #value: number
  #textLabel: _Number
  #showTextLabel: boolean

  constructor(showTextLabel = true) {
    super(Texture.EMPTY)

    const label = new _Number(MULTIPLIER_DIGIT_TEXTURES_MAP, 175, 15, 0.15)
    label.number = `1x`
    this.#value = 1

    this.#textLabel = this.addChild(label)
    this.#textLabel.position.set(-2, 25)
    this.#showTextLabel = showTextLabel
    this.#textLabel.alpha = showTextLabel ? 1 : 0
  }

  get value() {
    return this.#value
  }

  set value(value: number) {
    this.#value = value
    this.#textLabel.number = `${value}x`
  }

  setSize(size: number) {
    this.#textLabel.scale.set(size / DIGIT_HEIGHT)
  }

  playInAnimation() {
    Tween.to(this.#textLabel, { alpha: 1 }, { duration: 250 }).start()
  }

  playOutAnimation(duration: number = 250) {
    Tween.to(this.#textLabel, { alpha: 0 }, { duration }).start()
  }

  reset() {
    this.#textLabel.alpha = this.#showTextLabel ? 1 : 0
    this.value = 1
  }

  destroy() {
    super.destroy({ children: true })
  }
}
