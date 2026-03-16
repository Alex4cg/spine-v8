import type TrainSpine from '@/game/components/train-spine'

const IDLE_VARIANT_SWITCH_CYCLES = 3
const BLICK_CHANCE = 0.3
const STEAM_CHANCE = 0.4

const LEVEL_2_THRESHOLD = 6
const LEVEL_3_THRESHOLD = 13

export default class TrainAnimationManager {
  #train: TrainSpine
  #idleCycleCount = 0
  #collectedCoinsCount = 0
  #isProcessing = false
  #pendingQueue: Array<() => void> = []

  constructor(train: TrainSpine) {
    this.#train = train
  }

  onSpin() {
    this.#idleCycleCount++

    if (this.#idleCycleCount >= IDLE_VARIANT_SWITCH_CYCLES) {
      this.#idleCycleCount = 0
      this.#train.switchIdleVariant()
    }

    const blickRoll = Math.random()
    if (blickRoll < BLICK_CHANCE) {
      this.#train.playBlick()
    }

    const steamRoll = Math.random()
    if (steamRoll < STEAM_CHANCE) {
      this.#train.playSteam()
    }
  }

  async onBonusTrigger() {
    const levelUpTween = this.#train.levelUp()

    await new Promise<void>((resolve) => {
      levelUpTween.once(`complete`, () => {
        resolve()
      })
      levelUpTween.start()
    })
  }

  async onCoinsCollected(coinCount: number) {
    if (this.#isProcessing) {
      await new Promise<void>((resolve) => {
        this.#pendingQueue.push(resolve)
      })
    }

    this.#isProcessing = true

    try {
      this.#collectedCoinsCount += coinCount

      const previousLevel = this.#train.currentLevel
      let targetLevel: 1 | 2 | 3 = 1

      if (this.#collectedCoinsCount >= LEVEL_3_THRESHOLD) {
        targetLevel = 3
      } else if (this.#collectedCoinsCount >= LEVEL_2_THRESHOLD) {
        targetLevel = 2
      }

      const shouldLevelUp = targetLevel > previousLevel

      if (shouldLevelUp) {
        const levelUpTween = this.#train.levelUp()

        await new Promise<void>((resolve) => {
          levelUpTween.once(`complete`, () => {
            resolve()
          })
          levelUpTween.start()
        })
      }
    } finally {
      this.#isProcessing = false

      const nextResolve = this.#pendingQueue.shift()
      if (nextResolve) {
        nextResolve()
      }
    }
  }

  getCollectedCoinsCount() {
    return this.#collectedCoinsCount
  }

  reset() {
    this.#idleCycleCount = 0
    this.#collectedCoinsCount = 0
  }
}
