import { AnimatedSprite } from 'pixi.js'
import { Tween, stopTweenIfExist } from '@/gkit/tweens'

import winFrameAtlas from '@/assets/atlas/winframe/atlas.gen'

const WINFRAME_SCALE_X = 0.97

export default class WinFrame extends AnimatedSprite {
  #id: number
  #isPlayingWin: boolean = false
  #fadeTween: Tween | null = null
  #playToken = 0

  constructor(id: number) {
    super(winFrameAtlas.texturesWithPrefix(`winframe`))

    this.anchor.set(0.5)
    this.loop = false
    this.#id = id

    this.blendMode = `add`
    this.updateAnchor = false

    this.play()
    this.reset()

    this.animationSpeed = 0.5
  }

  get id() {
    return this.#id
  }

  get animationTime() {
    return (this.totalFrames / this.animationSpeed) * (1 / 60)
  }

  getWinTween() {
    const tween = Tween.wait({ duration: this.animationTime * 1000 })

    const playToken = ++this.#playToken

    tween.on(`start`, () => {
      if (this.#fadeTween) {
        stopTweenIfExist(this.#fadeTween)
        this.#fadeTween = null
      }

      this.alpha = 1
      this.#isPlayingWin = true
      this.gotoAndPlay(0)
    })

    tween.on(`complete`, () => {
      const fadeTween = Tween.to(this, { alpha: 0 }, { duration: 200 })
      this.#fadeTween = fadeTween

      fadeTween
        .on(`complete`, () => {
          if (this.#playToken !== playToken) {
            return
          }

          this.stop()
          this.#isPlayingWin = false
          this.#fadeTween = null
        })
        .start()
    })

    return tween
  }

  reset() {
    this.alpha = 0
    this.scale.set(WINFRAME_SCALE_X, 1)
    this.anchor.set(0.5)

    if (this.#fadeTween) {
      stopTweenIfExist(this.#fadeTween)
      this.#fadeTween = null
    }

    this.loop = false
    this.stop()
  }

  startLooping() {
    if (this.#fadeTween) {
      stopTweenIfExist(this.#fadeTween)
      this.#fadeTween = null
    }

    this.alpha = 1
    this.loop = true
    this.#isPlayingWin = true
    this.gotoAndPlay(0)
  }

  stopLooping() {
    this.loop = false
    this.#isPlayingWin = false

    const fadeTween = Tween.to(this, { alpha: 0 }, { duration: 200 })
    this.#fadeTween = fadeTween

    fadeTween
      .on(`complete`, () => {
        this.stop()
        this.#fadeTween = null
      })
      .start()
  }
}
