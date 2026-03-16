import { Container, Ticker } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

import game from '@/game/game'
import { GameMode } from './background'

import BgDesktopSpine from '@/assets/spine/background/desktop/skeleton'
import BgMobileSpine from '@/assets/spine/background/mobile/skeleton'
import bgAtlas from '@/assets/atlas/background/atlas.gen'

export default class BackgroundSpineLayer extends Container {
  #desktopSpine: Spine
  #mobileSpine: Spine
  #currentSpine: Spine | null = null
  #desktopOffsetX = 0
  #desktopOffsetY = 0
  #mobileOffsetX = 0
  #mobileOffsetY = 0
  #isMobile = false
  #mode = GameMode.Base
  #imageWidth = 1920
  #imageHeight = 1080

  constructor() {
    super()

    this.#desktopSpine = new Spine(BgDesktopSpine.spineData)
    this.#desktopSpine.autoUpdate = false
    this.#desktopSpine.visible = false
    this.addChild(this.#desktopSpine)

    this.#mobileSpine = new Spine(BgMobileSpine.spineData)
    this.#mobileSpine.autoUpdate = false
    this.#mobileSpine.visible = false
    this.addChild(this.#mobileSpine)

    game.onResize.add((options) => this.#onResize(options))
    Ticker.shared.add(this.#onTick, this)
  }

  setOffsets(params: {
    desktop?: { x?: number, y?: number }
    mobile?: { x?: number, y?: number }
  }) {
    if (params.desktop) {
      if (params.desktop.x !== undefined) this.#desktopOffsetX = params.desktop.x
      if (params.desktop.y !== undefined) this.#desktopOffsetY = params.desktop.y
    }

    if (params.mobile) {
      if (params.mobile.x !== undefined) this.#mobileOffsetX = params.mobile.x
      if (params.mobile.y !== undefined) this.#mobileOffsetY = params.mobile.y
    }

    this.#alignCurrentSpineToBottomRight()
  }

  #onTick() {
    if (this.#currentSpine) {
      this.#currentSpine.update(Ticker.shared.deltaMS / 1000)
    }
  }

  #switchSpine(isMobile: boolean) {
    if (this.#currentSpine) {
      this.#currentSpine.visible = false
    }

    this.#isMobile = isMobile
    this.#currentSpine = isMobile ? this.#mobileSpine : this.#desktopSpine

    if (this.#currentSpine) {
      this.#currentSpine.visible = true
      this.#playCurrentAnimation()
      this.#alignCurrentSpineToBottomRight()
    }
  }

  #playCurrentAnimation() {
    if (!this.#currentSpine) return

    const animationName = this.#mode === GameMode.FreeSpin ? `fs` : `regular`
    this.#currentSpine.state.setAnimation(0, animationName, true)
    this.#alignCurrentSpineToBottomRight()
  }

  #alignCurrentSpineToBottomRight() {
    if (!this.#currentSpine) return

    this.#currentSpine.update(0)

    const bounds = this.#currentSpine.getLocalBounds()
    const offsetX = this.#isMobile ? this.#mobileOffsetX : this.#desktopOffsetX
    const offsetY = this.#isMobile ? this.#mobileOffsetY : this.#desktopOffsetY

    this.#currentSpine.x = -(bounds.x + bounds.width) + offsetX
    this.#currentSpine.y = -(bounds.y + bounds.height) + offsetY
  }

  setMode(mode: GameMode) {
    if (this.#mode === mode) {
      return
    }

    this.#mode = mode
    this.#playCurrentAnimation()
  }

  #onResize(options: { mobile: boolean, viewport: { width: number, height: number }, isMobilePortrait?: boolean }) {
    const { mobile } = options
    const isMobilePortrait = Boolean(options.isMobilePortrait)

    if (mobile) {
      const texture = bgAtlas.getTexture(`bg_reg_mobile`)
      this.#imageWidth = texture.width
      this.#imageHeight = texture.height
    } else {
      const texture = bgAtlas.getTexture(`bg_reg.png`)
      this.#imageWidth = texture.width
      this.#imageHeight = texture.height
    }

    if (this.#isMobile !== mobile || !this.#currentSpine) {
      this.#switchSpine(mobile)
    }

    if (mobile) {
      if (isMobilePortrait) {
        const aspectRatio = this.#calcAspectRatio(options.viewport.width, options.viewport.height)
        const scale = aspectRatio.width > aspectRatio.height
          ? options.viewport.width / this.#imageWidth
          : options.viewport.height / this.#imageHeight

        this.scale.set(scale)

        this.x = options.viewport.width
        this.y = options.viewport.height

        const deltaX = ((this.#imageWidth * scale) - options.viewport.width)
        this.x += deltaX / 2
      } else {
        const aspectRatio = this.#calcAspectRatio(options.viewport.width, options.viewport.height)
        const scale = aspectRatio.width > aspectRatio.height
          ? options.viewport.width / this.#imageWidth
          : options.viewport.height / this.#imageHeight

        this.scale.set(scale)

        this.x = options.viewport.width
        this.y = options.viewport.height

        const deltaX = ((this.#imageWidth * scale) - options.viewport.width)
        this.x += deltaX / 2
      }
    } else {
      const aspectRatio = this.#calcAspectRatio(options.viewport.width, options.viewport.height)
      const scale = aspectRatio.width > aspectRatio.height
        ? options.viewport.width / this.#imageWidth
        : options.viewport.height / this.#imageHeight

      this.scale.set(scale)

      this.x = options.viewport.width
      this.y = options.viewport.height

      const deltaX = ((this.#imageWidth * scale) - options.viewport.width)
      this.x += deltaX / 2
    }

    this.#alignCurrentSpineToBottomRight()
  }

  #calcAspectRatio(width: number, height: number) {
    return {
      width: width / this.#imageWidth,
      height: height / this.#imageHeight
    }
  }
}
