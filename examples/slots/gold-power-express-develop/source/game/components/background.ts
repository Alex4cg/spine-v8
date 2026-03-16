import { Container, Sprite } from 'pixi.js'

import game from '@/game/game'

import bgAtlas from '@/assets/atlas/background/atlas.gen'
import { Tween } from '@/gkit/tweens'

export enum GameMode {
  Base = `BASE`,
  FreeSpin = `FREE_SPIN`,
}

export default class Background extends Container {
  #mode = GameMode.Base
  #mainBg: Sprite
  #topBg: Sprite
  #imageHeight: number
  #imageWidth: number

  constructor() {
    super()

    const bg = this.addChild(new Sprite(bgAtlas.getTexture(`bg_reg.png`)))
    bg.anchor.set(1)

    this.#mainBg = bg

    const topBg = this.addChild(new Sprite(bgAtlas.getTexture(`bg_fs.png`)))
    topBg.anchor.set(1)
    topBg.alpha = 0
    topBg.visible = false

    this.#topBg = topBg

    this.#imageHeight = bg.height
    this.#imageWidth = bg.width

    game.onResize.add((options) => this.#onResize(options))
  }

  setMode(mode: GameMode) {
    if (this.#mode === mode) {
      return
    }

    this.#mode = mode
  }

  getChangeToFreeSpinsModeTween(duration: number) {
    return Tween
      .to(this.#topBg, { alpha: 1 }, { duration })
      .once(`start`, () => {
        this.#topBg.visible = true
        this.setMode(GameMode.FreeSpin)
      })
  }

  getChangeToBaseModeTween(duration: number) {
    return Tween
      .to(this.#topBg, { alpha: 0 }, { duration })
      .once(`start`, () => {
        this.setMode(GameMode.Base)
      })
      .once(`complete`, () => {
        this.#topBg.visible = false
      })
  }

  restore(isFreeSpins: boolean) {
    if (isFreeSpins) {
      this.#topBg.alpha = 1
      this.#topBg.visible = true
      this.setMode(GameMode.FreeSpin)
    } else {
      this.#topBg.alpha = 0
      this.#topBg.visible = false
      this.setMode(GameMode.Base)
    }
  }

  #onResize(options: { mobile: boolean, viewport: { width: number, height: number }, isMobilePortrait?: boolean }) {
    const { mobile } = options
    const isMobilePortrait = Boolean(options.isMobilePortrait)

    if (mobile) {
      this.#mainBg.texture = bgAtlas.getTexture(`bg_reg_mobile`)
      this.#topBg.texture = bgAtlas.getTexture(`bg_fs_mobile`)
    } else {
      this.#mainBg.texture = bgAtlas.getTexture(`bg_reg.png`)
      this.#topBg.texture = bgAtlas.getTexture(`bg_fs.png`)
    }

    this.#imageHeight = this.#mainBg.height
    this.#imageWidth = this.#mainBg.width

    if (mobile) {
      if (isMobilePortrait) {
        const aspectRation = this.#calcAspectRation(options.viewport.width, options.viewport.height)
        const scale = aspectRation.width > aspectRation.height
          ? options.viewport.width / this.#imageWidth
          : options.viewport.height / this.#imageHeight

        this.scale.set(scale)

        this.x = options.viewport.width
        this.y = options.viewport.height

        const deltaX = (this.width - options.viewport.width)
        this.x += deltaX / 2
      } else {
        const aspectRation = this.#calcAspectRation(options.viewport.width, options.viewport.height)
        const scale = aspectRation.width > aspectRation.height
          ? options.viewport.width / this.#imageWidth
          : options.viewport.height / this.#imageHeight

        this.scale.set(scale)

        this.x = options.viewport.width
        this.y = options.viewport.height

        const deltaX = (this.width - options.viewport.width)
        this.x += deltaX / 2
      }
    } else {
      const aspectRation = this.#calcAspectRation(options.viewport.width, options.viewport.height)
      const scale = aspectRation.width > aspectRation.height
        ? options.viewport.width / this.#imageWidth
        : options.viewport.height / this.#imageHeight

      this.scale.set(scale)

      this.x = options.viewport.width
      this.y = options.viewport.height

      const deltaX = (this.width - options.viewport.width)
      this.x += deltaX / 2
    }
  }

  #calcAspectRation(width: number, height: number) {
    return {
      width: width / this.#imageWidth,
      height: height / this.#imageHeight
    }
  }
}
