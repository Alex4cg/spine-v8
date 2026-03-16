import {
  Application,
  Container,
  Ticker,
  EventEmitter,
  type ContainerChild,
  type Renderer
} from 'pixi.js'

import { MiniSignal } from 'mini-signals'
import { ui } from '@clawbuster/facade'

import { SAFE_ZONE_HEIGHT, SAFE_ZONE_WIDTH, GAME_HEIGHT, GAME_WIDTH } from '@/const'
import { update as updateTweens, setTimeSource } from '@/gkit/tweens'
import {
  OrientationType,
  type Foundations,
  type onResizeProps,
  type ScreenOrientation,
  type ScreenRect,
  type ScreenSize
} from '@/types'

class Game {
  app!: Application
  renderer!: Renderer
  root!: Container

  // safe zone containers
  stage!: Container
  fitByHeight!: Container
  fitByWidth!: Container
  fullSizeByOrientationRatioScale!: Container

  // safe zone full size containers
  fullSizeStage!: Container
  fullSizeFitByHeight!: Container
  fullSizeFitByWidth!: Container

  ticker!: Ticker
  time = 0

  #width: number = GAME_WIDTH
  #height: number = GAME_HEIGHT

  #safeWidth: number = SAFE_ZONE_WIDTH
  #safeHeight: number = SAFE_ZONE_HEIGHT

  #minFPS: number = 30

  onResize = new MiniSignal<[onResizeProps]>()
  onEnterFrame = new MiniSignal()

  async create(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    safeWidth: number,
    safeHeight: number,
    backgroundColor: number = 0x000000
  ): Promise<void> {
    this.time = 0

    this.#width = width
    this.#height = height

    this.#safeHeight = safeHeight
    this.#safeWidth = safeWidth

    this.app = new Application()

    await this.app.init({
      width,
      height,
      canvas,
      antialias: false, // performance trick
      resolution: Math.min(window.devicePixelRatio, 2),
      powerPreference: `high-performance`,
      backgroundColor
    })

    // eslint-disable-next-line
    // @ts-ignore
    globalThis.__PIXI_APP__ = this.app

    setTimeSource(() => this.time * 1000)

    this.app.ticker.add(this.update, this)
    this.ticker = this.app.ticker
    this.ticker.minFPS = this.#minFPS

    this.renderer = this.app.renderer

    this.root = this.app.stage
    this.root.name = `root`

    this.stage = this.root.addChild(new Container())
    this.stage.name = `stage`

    this.fitByHeight = this.root.addChild(new Container())
    this.fitByHeight.label = `FIT_BY_HEIGHT`

    this.fitByWidth = this.root.addChild(new Container())
    this.fitByWidth.label = `FIT_BY_WIDTH`

    this.fullSizeStage = this.root.addChild(new Container())
    this.fullSizeStage.label = `FULL_SIZE_STAGE`

    this.fullSizeFitByHeight = this.root.addChild(new Container())
    this.fullSizeFitByHeight.label = `FULL_SIZE_FIT_BY_HEIGHT`

    this.fullSizeFitByWidth = this.root.addChild(new Container())
    this.fullSizeFitByWidth.label = `FULL_SIZE_FIT_BY_WIDTH`

    this.fullSizeByOrientationRatioScale = this.root.addChild(new Container())
    this.fullSizeByOrientationRatioScale.label = `FULL_SIZE_BY_ORIENTATION_RATIO_SCALE`
  }

  private update() {
    const delta = Math.min(this.ticker.deltaTime / 60, 1 / this.#minFPS)

    this.time += delta

    updateTweens(this.time * 1000, false)

    this.onEnterFrame.dispatch(delta)
  }

  public addChild(...children: ContainerChild[]): Container<ContainerChild> {
    return this.stage.addChild(...children)
  }

  setRendererSize(
    viewport: ScreenSize, safeRect: ScreenRect, mobile: boolean, desktop: boolean, orientation: ScreenOrientation
  ) {
    this.renderer.resize(viewport.width, viewport.height)

    const safeRectRatioScale = this.calcRatioScale(safeRect.width, safeRect.height, true)

    this.stage.scale.set(safeRectRatioScale)
    this.stage.y = safeRect.y + ((safeRect.height - (this.#safeHeight * this.stage.scale.y)) * 0.5)
    this.stage.x = safeRect.x + ((safeRect.width - (this.#safeWidth * this.stage.scale.x)) * 0.5)

    const stageFitByHeightRatioScale = viewport.height / this.#safeHeight
    this.fitByHeight.scale.set(stageFitByHeightRatioScale)
    this.fitByHeight.y = (viewport.height - (this.#safeHeight * this.fitByHeight.scale.y)) * 0.5
    this.fitByHeight.x = (viewport.width - (this.#safeWidth * this.fitByHeight.scale.x)) * 0.5

    const stageFitByWidthRatioScale = viewport.width / this.#safeWidth
    this.fitByWidth.scale.set(stageFitByWidthRatioScale)
    this.fitByWidth.y = (viewport.height - (this.#safeHeight * this.fitByWidth.scale.y)) * 0.5
    this.fitByWidth.x = (viewport.width - (this.#safeWidth * this.fitByWidth.scale.x)) * 0.5

    const fullSizeRatioScale = this.calcRatioScale(viewport.width, viewport.height)

    this.fullSizeStage.scale.set(fullSizeRatioScale)
    this.fullSizeStage.y = (viewport.height - (this.#height * this.fullSizeStage.scale.y)) * 0.5
    this.fullSizeStage.x = (viewport.width - (this.#width * this.fullSizeStage.scale.x)) * 0.5

    const fullSizeFitByHeightRatioScale = viewport.height / this.#height

    this.fullSizeFitByHeight.scale.set(fullSizeFitByHeightRatioScale)
    this.fullSizeFitByHeight.y = (viewport.height - (this.#height * this.fullSizeFitByHeight.scale.y)) * 0.5
    this.fullSizeFitByHeight.x = (viewport.width - (this.#width * this.fullSizeFitByHeight.scale.x)) * 0.5

    const fullSizeFitByWidthRatioScale = viewport.width / this.#width
    this.fullSizeFitByWidth.scale.set(fullSizeFitByWidthRatioScale)
    this.fullSizeFitByWidth.y = (viewport.height - (this.#height * this.fullSizeFitByWidth.scale.y)) * 0.5
    this.fullSizeFitByWidth.x = (viewport.width - (this.#width * this.fullSizeFitByWidth.scale.x)) * 0.5

    const isMobilePortrait = mobile && orientation === OrientationType.Portrait

    const horizontalFactor = viewport.width / (isMobilePortrait ? SAFE_ZONE_HEIGHT : SAFE_ZONE_WIDTH)
    const verticalFactor = viewport.height / (isMobilePortrait ? SAFE_ZONE_WIDTH : SAFE_ZONE_HEIGHT)

    const orientationRatioScale = Math.min(horizontalFactor, verticalFactor)
    this.fullSizeByOrientationRatioScale.scale.set(orientationRatioScale)
    this.fullSizeByOrientationRatioScale.y = (viewport.height - (this.#height * orientationRatioScale)) * 0.5
    this.fullSizeByOrientationRatioScale.x = (viewport.width - (this.#width * orientationRatioScale)) * 0.5

    const foundations: Foundations = {
      containers: {
        root: this.root,
        stage: this.stage,
        fitByHeight: this.fitByHeight,
        fitByWidth: this.fitByWidth,
        fullSizeStage: this.fullSizeStage,
        fullSizeFitByHeight: this.fullSizeFitByHeight,
        fullSizeFitByWidth: this.fullSizeFitByWidth,
        fullSizeByOrientationRatioScale: this.fullSizeByOrientationRatioScale
      },
      scales: {
        stage: safeRectRatioScale,
        fitByHeight: stageFitByHeightRatioScale,
        fitByWidth: stageFitByWidthRatioScale,
        fullSizeStage: fullSizeRatioScale,
        fullSizeFitByHeight: fullSizeFitByHeightRatioScale,
        fullSizeFitByWidth: fullSizeFitByWidthRatioScale,
        fullSizeByOrientationRatioScale: orientationRatioScale
      }
    }

    const mobilePortraitRatioScale = Math.max(
      viewport.width / this.#height,
      viewport.height / this.#width
    )

    const result = {
      viewport,
      safeRect,
      mobile,
      desktop,
      orientation,
      verticalFactor,
      orientationRatioScale,
      safeRectRatioScale,
      fullSizeRatioScale,
      mobilePortraitRatioScale,
      foundations
    }

    this.onResize.dispatch(result)
  }

  calcRatioScale(width: number, height: number, isSafeRatio: boolean = false) {
    const targetWidth = isSafeRatio ? this.#safeWidth : this.#width
    const targetHeight = isSafeRatio ? this.#safeHeight : this.#height

    const ratioScale = Math.min((width / targetWidth), height / targetHeight)

    return ratioScale
  }

  calcCoverRationScale(width: number, height: number, isSafeRatio: boolean = false) {
    const targetWidth = isSafeRatio ? this.#safeWidth : this.#width
    const targetHeight = isSafeRatio ? this.#safeHeight : this.#height

    const ratioScale = Math.max((width / targetWidth), height / targetHeight)

    return ratioScale
  }

  subscribeOnResize() {
    ui.screenProperties.bind(({ viewportSize, safeViewportRect, mobile, desktop, orientation }) => {
      this.setRendererSize(viewportSize, safeViewportRect, mobile, desktop, orientation)
    })
  }

  get width() {
    return this.#width
  }

  get height() {
    return this.#height
  }

  get safeWidth() {
    return this.#safeWidth
  }

  get safeHeight() {
    return this.#safeHeight
  }
}

export default new Game()
export const eventBus = new EventEmitter()
