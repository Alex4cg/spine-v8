import { Container, Sprite } from 'pixi.js'
import { ui } from '@clawbuster/facade'
import { Chain, Parallel, Tween } from '@/gkit/tweens'
import mainAtlas from '@/assets/atlas/main/atlas.gen'
import { getDevtoolsValues, isTurboMode } from '@/devtools'
import fonts from '@/assets/fonts/bitmap.gen'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'

const MINI_WIN_CONFIG_STATIC = {
  fontSize: 90,
  fill: 0xFFDB2D,
  bgColor: 0x000000,
  bgAlpha: 0.7,
  bgPadding: { x: 40, y: 20 },
  bgRadius: 16
}

export default class MiniWin extends Container {
  #bgSprite: Sprite
  #winText: MultiShadowBitmapText
  #isShowing = false

  constructor() {
    super()

    this.#bgSprite = this.addChild(new Sprite(mainAtlas.getTexture(`miniWin_bg.png`)))
    this.#bgSprite.anchor.set(0.5)
    this.#bgSprite.scale.set(1)
    this.#bgSprite.position.set(0, 12)
    this.#bgSprite.alpha = 0

    this.#winText = this.addChild(new MultiShadowBitmapText(
      `0.00`,
      {
        ...fonts.montserratExtraBold,
        fontSize: MINI_WIN_CONFIG_STATIC.fontSize,
        fill: MINI_WIN_CONFIG_STATIC.fill,
        align: `center`
      },
      [
        { offsetX: 0, offsetY: 5, color: 0x9E5302 }
      ]
    ))

    this.#winText.setAnchor(0.5)
    this.#winText.alpha = 0

    this.visible = false
  }

  setWin(win: number) {
    this.#winText.setText(ui.formatCurrency(win, false, false))
  }

  getShowTween() {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { miniWinConfig } = devtoolsValues
    const animationDuration = turboMode ? Math.min(miniWinConfig.animationDuration, 100) : miniWinConfig.animationDuration

    return new Chain()
      .call(() => {
        this.visible = true
        this.#isShowing = true
        this.scale.set(0.5)
      })
      .add(
        new Parallel()
          .add(Tween.to(this.#bgSprite, { alpha: 1 }, { duration: animationDuration }))
          .add(Tween.to(this.#winText, { alpha: 1 }, { duration: animationDuration }))
          .add(Tween.to(this.scale, { x: 1, y: 1 }, { duration: animationDuration }))
      )
  }

  getHideTween() {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { miniWinConfig } = devtoolsValues
    const animationDuration = turboMode ? Math.min(miniWinConfig.animationDuration, 100) : miniWinConfig.animationDuration

    return new Chain()
      .add(
        new Parallel()
          .add(Tween.to(this.#bgSprite, { alpha: 0 }, { duration: animationDuration }))
          .add(Tween.to(this.#winText, { alpha: 0 }, { duration: animationDuration }))
          .add(Tween.to(this.scale, { x: 0.5, y: 0.5 }, { duration: animationDuration }))
      )
      .call(() => {
        this.visible = false
        this.#isShowing = false
      })
  }

  getFullAnimation(win: number, displayDuration?: number) {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { miniWinConfig } = devtoolsValues
    const duration = displayDuration
      ?? (turboMode
        ? Math.min(miniWinConfig.displayDuration, 500)
        : miniWinConfig.displayDuration)

    return new Chain()
      .call(() => this.setWin(win))
      .add(this.getShowTween())
      .wait(duration)
      .add(this.getHideTween())
  }
}
