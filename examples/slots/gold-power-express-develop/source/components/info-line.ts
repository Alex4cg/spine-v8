import { BitmapText, Container } from 'pixi.js'
import { launchParams, ui, ruleSettings } from '@clawbuster/facade'

import { IndefiniteTween, Parallel, Tween } from '@/gkit/tweens'

import i18n from '@/assets/i18n/text.json'
import fonts from '@/assets/fonts/bitmap.gen'

const ACCENT_COLOR = 0xFFD600
const MAX_ROUND_SHOWING_AMOUNT = 3

enum InfoLineMode {
  Default,
  FreeSpins,
  TotalWin
}

export default class InfoLine extends Container {
  #mode = InfoLineMode.Default
  #baseContainer: Container
  #totalWinContainer: Container

  #accumulativeWin: number = 0

  #winText: InfoText
  #winUpTo: InfoText
  #lastWin: InfoText
  #totalWinText: InfoText

  #lastWinShowingAmount = 0

  constructor() {
    super()

    this.#baseContainer = this.addChild(new Container())

    const maxWinValue = ruleSettings.maxWin || 5000

    this.#winUpTo = this.#baseContainer.addChild(new InfoText(`${i18n.robotoCondensedBold.infoLine.winUpTo}`))
    this.#winUpTo.setValue(`x${maxWinValue.toLocaleString(`en-US`).replace(/,/g, ` `)}`)

    this.#winText = this.#baseContainer.addChild(new InfoText(`${i18n.robotoCondensedBold.infoLine.win}:`))
    this.#winText.alpha = 0

    const lastWinFontSize = launchParams.language === `ru-RU` ? 28 : 32
    this.#lastWin = this.#baseContainer.addChild(new InfoText(
      `${i18n.robotoCondensedBold.infoLine.lastWin}:`,
      lastWinFontSize
    ))
    this.#lastWin.alpha = 0

    this.#totalWinContainer = this.addChild(new Container())

    let totalWinText = i18n.freeSpinsModal?.title?.total || `TOTAL WIN`
    let totalWinSize = 40

    if (launchParams.language === `ru-RU`) {
      totalWinSize = 35
      totalWinText = totalWinText.replace(/\n/g, ` `)
    }

    this.#totalWinText = this.#totalWinContainer.addChild(
      new InfoText(`${totalWinText}:`, totalWinSize, 0xffffff)
    )

    this.#totalWinContainer.visible = false

    this.reset()
  }

  getChangeToFreeSpinsModeTween(duration: number) {
    return this.hideInfo(duration).once(`complete`, () => {
      if (!this.#accumulativeWin) {
        this.#baseContainer.visible = false
      }

      this.#mode = InfoLineMode.FreeSpins
    })
  }

  getChangeToBaseModeTween(duration: number) {
    return this.showInfo(duration)
      .once(`start`, () => {
        this.#baseContainer.visible = true
      })
      .once(`complete`, () => {
        this.reset()

        this.#totalWinContainer.visible = false
        this.#mode = InfoLineMode.Default
      })
  }

  getChangeToTotalWinTween(initValue = 0) {
    return new IndefiniteTween((stopTween) => {
      this.#baseContainer.visible = false
      this.#totalWinContainer.visible = true
      this.#mode = InfoLineMode.TotalWin

      this.setTotalWin(initValue)
      stopTween()
    })
  }

  setTotalWin(value: number) {
    this.#totalWinText.setValue(`${ui.formatCurrency(value, false, false)}`)
  }

  setWin(value: number) {
    if (this.#mode !== InfoLineMode.Default) {
      return
    }

    const number = ui.formatCurrency(value, false, false)

    this.#accumulativeWin = value
    this.#lastWinShowingAmount = 0
    this.#winText.setValue(number)

    const hideTween = this.#winUpTo.alpha
      ? Tween.to(this.#winUpTo, { alpha: 0 }, { duration: 50 })
      : Tween.to(this.#lastWin, { alpha: 0 }, { duration: 50 })

    const showTween = Tween.to(this.#winText, { alpha: 1 }, { duration: 50 })

    const mainParallel = new Parallel()

    mainParallel
      .add(hideTween, showTween)
      .start()
  }

  addWin(value: number) {
    this.setWin(this.#accumulativeWin + value)
  }

  getRatchetTween(multiplier: number) {
    return new IndefiniteTween((stopTween) => {
      const endValue = Number(ui.formatCurrency(ui.bet.value! * multiplier, false, false, false))

      const time = 5000

      Tween
        .to(this.#totalWinText, { valueNumber: this.#totalWinText.valueNumber + endValue }, { duration: time })
        .once(`complete`, stopTween)
        .start()
    })
  }

  showLastWinState() {
    const mainParallel = new Parallel()

    this.#lastWin.setValue(this.#winText.value)

    mainParallel
      .add(Tween.to(this.#winText, { alpha: 0 }, { duration: 50 }))
      .add(Tween.to(this.#lastWin, { alpha: 1 }, { duration: 50 }))
      .start()
  }

  showWinUpToState() {
    const mainParallel = new Parallel()

    mainParallel
      .add(Tween.to(this.#lastWin, { alpha: 0 }, { duration: 50 }))
      .add(Tween.to(this.#winUpTo, { alpha: 1 }, { duration: 50 }))
      .start()
  }

  endRound() {
    if (this.#mode !== InfoLineMode.Default) {
      return
    }

    if (this.#winUpTo.alpha) {
      return
    }

    if (this.#lastWinShowingAmount === MAX_ROUND_SHOWING_AMOUNT) {
      this.#lastWinShowingAmount = 0

      this.showWinUpToState()

      return
    }

    if (this.#lastWinShowingAmount < MAX_ROUND_SHOWING_AMOUNT) {
      this.#lastWinShowingAmount++

      if (!this.#lastWin.alpha) {
        this.showLastWinState()
      }
    }
  }

  reset() {
    this.#mode = InfoLineMode.Default
    this.#accumulativeWin = 0
    this.#lastWinShowingAmount = 0

    this.#winUpTo.alpha = 1
    this.#winText.alpha = 0
    this.#lastWin.alpha = 0

    this.#baseContainer.visible = true
    this.#totalWinContainer.visible = false
  }

  showInfo(duration: number = 50) {
    return Tween.to(this.#baseContainer, { alpha: 1 }, { duration })
  }

  hideInfo(duration: number = 50) {
    return Tween.to(this.#baseContainer, { alpha: 0 }, { duration })
  }

  get isWinEnabled() {
    return this.#winText.alpha
  }

  get value() {
    return this.#accumulativeWin
  }

  get isWinShowing() {
    return this.#baseContainer.alpha === 1
  }

  get mode() {
    return this.#mode
  }
}

class InfoText extends Container {
  #mainText: BitmapText
  #valueText: BitmapText
  #value = 0

  constructor(text: string, fontSize = 32, valueColor?: number) {
    super()

    this.#mainText = this.addChild(new BitmapText({
      text: text,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize
      }
    }))

    this.#mainText.anchor.set(0, 0.5)

    this.#valueText = this.addChild(new BitmapText({
      text: `0`,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize,
        fill: valueColor ?? ACCENT_COLOR
      }
    }))

    this.#valueText.anchor.set(0, 0.5)
    this.#valueText.x = this.#mainText.width + 7

    this.#update()
  }

  setValue(value: string) {
    this.#value = Number(value.replace(/[^\d.-]/g, ``)) || 0

    this.#valueText.text = value

    this.#update()
  }

  set valueNumber(value: number) {
    this.#value = value

    this.setValue(String(Math.trunc(value)))
  }

  get valueNumber() {
    return this.#value
  }

  get value() {
    return this.#valueText.text
  }

  #update() {
    this.pivot.x = (this.#mainText.width + this.#valueText.width + 7) / 2
  }
}
