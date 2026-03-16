import { Container, Graphics, Text } from 'pixi.js'
import { Parallel, Tween, backOut, backIn } from '@/gkit/tweens'
import game from '@/game/game'
import { ui } from '@clawbuster/facade'
import type { onResizeProps } from '@/types'
import { getDevtoolsValues, isTurboMode } from '@/devtools'

export default class BonusTransitionModal extends Container {
  #overlay: Graphics
  #titleText: Text
  #subtitleText: Text
  #isVisible = false
  #onContinueCallback: (() => void) | null = null

  constructor() {
    super()

    this.visible = false
    this.alpha = 0

    this.#overlay = this.addChild(new Graphics())
    this.#overlay.rect(-2000, -2000, 4000, 4000)
    this.#overlay.fill({ color: 0x000000, alpha: 0.7 })
    this.#overlay.eventMode = `static`
    this.#overlay.cursor = `pointer`
    this.#overlay.on(`pointerdown`, () => this.#onContinue())

    this.#titleText = this.addChild(new Text({
      text: `BONUS GAME`,
      style: {
        fontFamily: `Arial Black, Arial Bold, Arial`,
        fontSize: 72,
        fontWeight: `bold`,
        fill: 0xFFD700,
        stroke: { color: 0x8B4513, width: 4 },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          angle: Math.PI / 4,
          distance: 4
        }
      }
    }))
    this.#titleText.anchor.set(0.5)
    this.#titleText.y = -50

    this.#subtitleText = this.addChild(new Text({
      text: `Click to Continue`.toUpperCase(),
      style: {
        fontFamily: `Arial`,
        fontSize: 32,
        fill: 0xFFFFFF
      }
    }))
    this.#subtitleText.anchor.set(0.5)
    this.#subtitleText.y = 50

    this.#startPulseAnimation()

    game.onResize.add((options) => this.#onResize(options))
  }

  #startPulseAnimation() {
    game.onEnterFrame.add(() => {
      if (this.#isVisible && this.#subtitleText.alpha === 1) {
        // TODO Start pulse only when fully visible
      }
    })
  }

  #onContinue() {
    if (!this.#isVisible) return

    // console.log('>>> Bonus transition modal: Continue clicked')

    if (this.#onContinueCallback) {
      this.#onContinueCallback()
    }
  }

  show(): Promise<void> {
    return new Promise((resolve) => {
      const devtoolsValues = getDevtoolsValues()
      const turboMode = isTurboMode()
      const { bonusTransitionConfig } = devtoolsValues
      const showDuration = turboMode ? Math.min(bonusTransitionConfig.showDuration, 100) : bonusTransitionConfig.showDuration
      const titleScaleDuration = turboMode ? Math.min(bonusTransitionConfig.titleScaleDuration, 150) : bonusTransitionConfig.titleScaleDuration

      this.#onContinueCallback = () => {
        this.hide().then(resolve)
      }

      this.visible = true
      this.#isVisible = true

      const showTween = new Parallel()
      showTween.add(
        Tween.to(this, { alpha: 1 }, { duration: showDuration }),
        Tween.fromTo(
          this.#titleText,
          { scaleX: 0.5, scaleY: 0.5 },
          { scaleX: 1, scaleY: 1 },
          { duration: titleScaleDuration, easing: backOut }
        )
      )

      showTween.start()
    })
  }

  hide(): Promise<void> {
    return new Promise((resolve) => {
      const devtoolsValues = getDevtoolsValues()
      const turboMode = isTurboMode()
      const { bonusTransitionConfig } = devtoolsValues
      const hideDuration = turboMode ? Math.min(bonusTransitionConfig.hideDuration, 100) : bonusTransitionConfig.hideDuration

      this.#isVisible = false

      const hideTween = new Parallel()
      hideTween.add(
        Tween.to(this, { alpha: 0 }, { duration: hideDuration }),
        Tween.to(
          this.#titleText,
          { scaleX: 0.5, scaleY: 0.5 },
          { duration: hideDuration, easing: backIn }
        )
      )

      hideTween.once(`complete`, () => {
        this.visible = false
        this.#titleText.scale.set(1)
        resolve()
      })

      hideTween.start()
    })
  }

  setTotalWinMode(totalWin: number) {
    this.#titleText.text = `TOTAL WIN\n\n`
    const formattedWin = ui.formatCurrency(totalWin, false, false, false)
    this.#subtitleText.text = `${formattedWin} ${ui.getCurrencySign(true)}\n\n\n${`Click to Continue`.toUpperCase()}`
  }

  #onResize(options: onResizeProps) {
    this.x = options.viewport.width / 2
    this.y = options.viewport.height / 2
  }

  setBonusEntryMode() {
    this.#titleText.text = `BONUS GAME`
    this.#subtitleText.text = `Click to Continue`.toUpperCase()
  }
}
