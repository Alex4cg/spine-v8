import { Container } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import WinlineSpine from '@/assets/spine/winline/skeleton'
import { Chain, Parallel, Tween, stopTweenIfExist, endTweenIfExist } from '@/gkit/tweens'

const LINE_SKINS = [
  `1`,
  `2`,
  `3`,
  `4`,
  `5`
]

export default class WinLines extends Container {
  #spines: Spine[] = []
  #fadeTween: Tween | null = null
  #playToken = 0
  #currentSpine: Spine | null = null
  #loopingChain: Chain | null = null

  constructor() {
    super()

    for (let i = 0; i < 5; i++) {
      const spine = new Spine(WinlineSpine.spineData)
      spine.autoUpdate = true
      spine.alpha = 0
      spine.visible = false
      spine.skeleton.setSkinByName(LINE_SKINS[i])
      spine.skeleton.setToSetupPose()

      this.#spines.push(spine)
      this.addChild(spine)
    }
  }

  showAllLines(lineIndices: number[]) {
    const playToken = ++this.#playToken
    const chain = new Chain()
    const validSpines: Spine[] = []

    for (const lineIndex of lineIndices) {
      if (lineIndex >= 0 && lineIndex < this.#spines.length) {
        validSpines.push(this.#spines[lineIndex])
      }
    }

    if (validSpines.length === 0) {
      return Tween.wait({ duration: 0 })
    }

    const fadeInParallel = new Parallel()

    for (const spine of validSpines) {
      fadeInParallel.add(
        Tween.to(spine, { alpha: 1 }, { duration: 150 })
          .on(`start`, () => {
            spine.state.setAnimation(0, `animation`, false)
            spine.visible = true
          })
      )
    }

    chain.add(fadeInParallel)
    chain.add(Tween.wait({ duration: 500 }))

    const fadeOutParallel = new Parallel()

    for (const spine of validSpines) {
      fadeOutParallel.add(
        Tween.to(spine, { alpha: 0 }, { duration: 150 })
          .on(`complete`, () => {
            if (this.#playToken !== playToken) {
              return
            }
            spine.visible = false
            spine.state.clearTracks()
          })
      )
    }

    chain.add(fadeOutParallel)

    return chain
  }

  showLine(lineIndex: number) {
    if (lineIndex < 0 || lineIndex >= this.#spines.length) {
      return Tween.wait({ duration: 0 })
    }

    const spine = this.#spines[lineIndex]
    const playToken = ++this.#playToken

    const chain = new Chain()

    chain.add(
      Tween.to(spine, { alpha: 1 }, { duration: 150 })
        .on(`start`, () => {
          if (this.#fadeTween) {
            stopTweenIfExist(this.#fadeTween)
            this.#fadeTween = null
          }

          if (this.#currentSpine && this.#currentSpine !== spine) {
            this.#currentSpine.visible = false
            this.#currentSpine.alpha = 0
            this.#currentSpine.state.clearTracks()
          }

          this.#currentSpine = spine
          spine.state.setAnimation(0, `animation`, false)
          spine.visible = true
        })
    )

    chain.add(Tween.wait({ duration: 500 }))

    chain.add(
      Tween.to(spine, { alpha: 0 }, { duration: 150 })
        .on(`complete`, () => {
          if (this.#playToken !== playToken) {
            return
          }
          spine.visible = false
          spine.state.clearTracks()
          this.#fadeTween = null
        })
    )

    return chain
  }

  showAllLinesLooping(lineIndices: number[]) {
    this.stopLooping()

    const validSpines: Spine[] = []
    for (const lineIndex of lineIndices) {
      if (lineIndex >= 0 && lineIndex < this.#spines.length) {
        validSpines.push(this.#spines[lineIndex])
      }
    }

    if (validSpines.length === 0) {
      return
    }

    for (const spine of validSpines) {
      spine.visible = true
      spine.alpha = 1
      spine.state.setAnimation(0, `animation`, true)
    }

    const loopChain = new Chain()
    loopChain.repeat(Infinity)
    loopChain.add(Tween.wait({ duration: 1000 }))
    loopChain.on(`start`, () => {
      for (const spine of validSpines) {
        if (!spine.visible) {
          spine.visible = true
          spine.alpha = 1
          spine.state.setAnimation(0, `animation`, true)
        }
      }
    })

    this.#loopingChain = loopChain
    loopChain.start()
  }

  stopLooping() {
    if (this.#loopingChain) {
      endTweenIfExist(this.#loopingChain)
      this.#loopingChain = null
    }
  }

  hideAllLines() {
    for (const spine of this.#spines) {
      spine.visible = false
      spine.alpha = 0
      spine.state.clearTracks()
    }
  }

  reset() {
    this.stopLooping()

    for (const spine of this.#spines) {
      spine.visible = false
      spine.alpha = 0
      spine.state.clearTracks()
    }

    this.#currentSpine = null

    if (this.#fadeTween) {
      stopTweenIfExist(this.#fadeTween)
      this.#fadeTween = null
    }
  }
}
