import { Container } from 'pixi.js'
import { ui } from '@clawbuster/facade'

import { Chain, Parallel, Tween } from '@/gkit/tweens'
import { rowY } from '@/game/components/field-layout'
import fonts from '@/assets/fonts/bitmap.gen'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'

export default class LineWinPopup extends Container {
  #text: MultiShadowBitmapText

  constructor() {
    super()

    this.sortableChildren = true

    this.#text = this.addChild(new MultiShadowBitmapText(
      `0.00`,
      {
        ...fonts.montserratExtraBold,
        fontSize: 53,
        fill: 0xFFDB2D,
        align: `center`
      },
      [
        { offsetX: 0, offsetY: 6, color: 0x9E5302 }
      ]
    ))

    this.#text.setAnchor(0.5)
    this.#text.alpha = 0
    this.#text.scale.set(0)
    this.#text.zIndex = 0
  }

  getTween(win: number, rowIndex: number, isCommon: boolean) {
    const mainChain = new Chain()

    const showParallel = new Parallel()

    const showNumbersTween = Tween.fromTo(
      this.#text,
      { scaleX: 0, scaleY: 0, alpha: 0 },
      { scaleX: 1, scaleY: 1, alpha: 1 },
      { duration: 200 }
    ).on(`start`, () => {
      this.#text.setText(ui.formatCurrency(win, false, false))

      if (isCommon) {
        this.y = rowY(1)
        this.#text.setSize(80)
      } else {
        this.y = rowY(rowIndex) - 15
        this.#text.setSize(61)
      }
    })

    const pauseTween = Tween.to({}, {}, { duration: 800 })

    showParallel.add(showNumbersTween, pauseTween)

    mainChain.add(showParallel)

    const hideParallel = new Parallel()

    const hideNumbersTween = Tween.to(
      this.#text,
      { scaleX: 0, scaleY: 0, alpha: 0 },
      { duration: 200 }
    ).on(`complete`, () => {
      this.#text.setText(`0.00`)
    })

    hideParallel.add(hideNumbersTween)

    mainChain.add(hideParallel)

    return mainChain
  }

  reset() {
    this.#text.setText(`0.00`)
    this.#text.alpha = 0
    this.#text.scale.set(0)
  }
}
