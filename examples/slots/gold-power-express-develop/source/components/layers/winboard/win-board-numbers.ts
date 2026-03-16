import { Container } from 'pixi.js'
import { Tween } from '@/gkit/tweens'
import { ui } from '@clawbuster/facade'
import fonts from '@/assets/fonts/bitmap.gen'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'

const DEFAULT_FONT_SIZE = 96

export default class WinBoardNumbers extends Container {
  #value = 0
  #textWithShadow: MultiShadowBitmapText
  #textWithoutShadow: MultiShadowBitmapText
  #isFormatting = true
  #isTruncate = true
  #isPostConvertValue = false

  constructor() {
    super()

    const baseStyle = {
      ...fonts.montserratExtraBold,
      fontSize: DEFAULT_FONT_SIZE,
      fill: 0xFFDB2D,
      align: `center` as const
    }

    this.#textWithShadow = this.addChild(new MultiShadowBitmapText(
      `0.00`,
      baseStyle,
      [
        { offsetX: 0, offsetY: 5, color: 0x9E5302 }
      ]
    ))

    this.#textWithShadow.setAnchor(0.5)

    this.#textWithoutShadow = this.addChild(new MultiShadowBitmapText(
      `0.00`,
      baseStyle,
      []
    ))

    this.#textWithoutShadow.setAnchor(0.5)
    this.#textWithoutShadow.visible = false
  }

  get value() {
    return this.#value
  }

  set value(value: number) {
    this.#value = value
    const text = this.#getFormattingValue()
    this.#textWithShadow.setText(text)
    this.#textWithoutShadow.setText(text)
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
    this.#textWithShadow.setSize(size)
    this.#textWithoutShadow.setSize(size)
  }

  enableShadow() {
    this.#textWithShadow.visible = true
    this.#textWithoutShadow.visible = false
  }

  disableShadow() {
    this.#textWithShadow.visible = false
    this.#textWithoutShadow.visible = true
  }

  getShowShadowTween() {
    return Tween.to({}, {}, { duration: 0 })
  }

  getHideShadowTween() {
    return Tween.to({}, {}, { duration: 0 })
  }
}
