import {
  Container,
  BitmapText,
  type FillInput,
  type ColorSource,
  type TextStyleAlign
} from 'pixi.js'

export interface Style {
  fontSize: number
  fontFamily: string
  fill?: FillInput
  align?: TextStyleAlign
}

export interface Shadow {
  offsetX: number
  offsetY: number
}

export interface CustomShadow {
  offsetX: number
  offsetY: number
  color?: FillInput
  fontSize?: number
  alpha?: number
}

enum Layers {
  Shadow = 0,
  Main = 1
}

export default class MultiShadowBitmapText extends Container {
  #mainText: BitmapText
  #shadows: BitmapText[] = []
  #defaultSize
  #size
  #containerWrapper: Container

  constructor(text: string, style: Style, shadow: CustomShadow[])
  constructor(text: string, style: Style, shadow: Shadow[], shadowColor: FillInput)
  constructor(text: string, style: Style, shadow: Shadow[] | CustomShadow[], shadowColor?: FillInput) {
    super()

    this.#defaultSize = style.fontSize
    this.#size = this.#defaultSize

    const containerWrapper = this.addChild(new Container())
    this.#containerWrapper = containerWrapper

    const mainText = containerWrapper.addChild(new BitmapText({
      text,
      style: {
        ...style,
        fill: 0xFFFFFF
      }
    }))

    if (style.fill !== undefined) {
      mainText.tint = style.fill as ColorSource
    }

    mainText.zIndex = Layers.Main
    mainText.anchor.set(0.5)

    this.#mainText = mainText

    for (const shadowData of shadow) {
      const fillColor = `color` in shadowData ? shadowData.color : shadowColor
      const fontSize = `fontSize` in shadowData ? shadowData.fontSize : style.fontSize

      const shadowText = containerWrapper.addChild(new BitmapText({
        text,
        style: {
          ...style,
          fontSize,
          fill: fillColor
        }
      }))

      const shadowAlpha = `alpha` in shadowData ? shadowData.alpha : 1

      shadowText.alpha = shadowAlpha || 1

      shadowText.position.set(shadowData.offsetX, shadowData.offsetY)
      shadowText.anchor.set(0.5)
      shadowText.zIndex = Layers.Shadow

      this.#shadows.push(shadowText)
    }
  }

  setAnchor(anchorX: number, anchorY?: number) {
    if (anchorY === undefined) {
      this.#mainText.anchor.set(anchorX)

      for (const shadow of this.#shadows) {
        shadow.anchor.set(anchorX)
      }
    } else {
      this.#mainText.anchor.set(anchorX, anchorY)

      for (const shadow of this.#shadows) {
        shadow.anchor.set(anchorX, anchorY)
      }
    }
  }

  setText(text: string) {
    this.#mainText.text = text

    for (const shadow of this.#shadows) {
      shadow.text = text
    }
  }

  setSize(size: number) {
    this.#size = size
    this.#containerWrapper.scale.set(size / this.#defaultSize)
  }

  get size() {
    return this.#size
  }

  changeMainColor(color: number) {
    this.#mainText.tint = color
  }
}
