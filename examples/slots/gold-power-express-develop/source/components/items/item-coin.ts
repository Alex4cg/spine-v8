import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Skin } from '@esotericsoftware/spine-core'
import ItemBase from './item-base'
import { IDSpecial } from './const'
import { IndefiniteTween, Tween, cubicInOut } from '@/gkit/tweens'
import type { PointData } from 'pixi.js'
import { MultiplierLabel } from '@/components/texture-number'
import { JackpotTypes } from '@/const'
import CoinSpine from '@/assets/spine/coin/skeleton'

const COIN_SKIN_BY_JACKPOT = Object.freeze({
  [JackpotTypes.Grand]: `grand`,
  [JackpotTypes.Major]: `major`,
  [JackpotTypes.Midi]: `midi`,
  [JackpotTypes.Mini]: `mini`
})

export default class ItemCoin extends ItemBase {
  private multiplierLabel: MultiplierLabel
  private isJackpot: boolean = false

  constructor(id: IDSpecial.Coin | IDSpecial.Jackpot = IDSpecial.Coin) {
    super(id)

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    this.isJackpot = id === IDSpecial.Jackpot

    const spineData = CoinSpine.spineData
    const mainSpine = this.addChild(new Spine(spineData))
    mainSpine.autoUpdate = false

    this.mainSpine = mainSpine
    this.#applyCombinedSkin(`regular`)

    this.multiplierLabel = this.addChild(new MultiplierLabel(true))
    this.multiplierLabel.setSize(60)

    const slotName = `text_holder`
    this.mainSpine.addSlotObject(slotName, this.multiplierLabel, { followAttachmentTimeline: true })

    this.playIdle()
  }

  get multiplier() {
    return this.multiplierLabel.value
  }

  playIdle() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(1, `idle`, true)
    }
  }

  playStart() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `start`, false)
      this.mainSpine.state.addAnimation(1, `idle`, true, 0)

      this.mainSpine.state.onceTrackCompleted(2, () => {
        this.mainSpine!.state.clearTrack(2)
      })
    }
  }

  setInitialMultiplier(multiplier: number) {
    this.multiplierLabel.value = multiplier
  }

  setMultiplier(multiplier: number) {
    this.multiplierLabel.value = multiplier

    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `hit`, false)
    }
  }

  applyMultiplier(multiplier: number) {
    this.multiplierLabel.value = this.multiplierLabel.value + multiplier

    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(2, `hit`, false)
    }
  }

  getSpawnTween(multiplier: number) {
    return new IndefiniteTween((stopTween: () => void) => {
      this.multiplierLabel.value = multiplier

      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `hit`, false)
        this.mainSpine.state.setAnimation(1, `idle`, true)

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getCollectTween() {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `disappearance`, false)

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          this.visible = false
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getShotTween() {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `shot`, false)

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getDisappearanceTween(onStartFlight?: () => void) {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `disappearance`, false)

        this.mainSpine.state.addListener({
          event: (_entry, event) => {
            if (event.data.name === `start_flight`) {
              onStartFlight?.()
            }
          }
        })

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          this.visible = false
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getApplyJpTween(onStartFlight?: () => void) {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `apply_jp`, false)

        this.mainSpine.state.addListener({
          event: (_entry, event) => {
            if (event.data.name === `text_holder_on`) {
              this.multiplierLabel.alpha = 1

              const textHolderSlot = this.mainSpine?.skeleton.findSlot(`text_holder`)
              if (textHolderSlot) {
                const skin = this.mainSpine?.skeleton.skin
                const slotIndex = textHolderSlot.data.index
                const attachment = skin?.getAttachment(slotIndex, `text_holder`)
                if (attachment) {
                  textHolderSlot.setAttachment(attachment)
                }
              }
            }

            if (event.data.name === `start_flight`) {
              onStartFlight?.()
            }
          }
        })

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          this.visible = false
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  getApplyGrandTween(onStartFlight?: () => void, moveTarget?: PointData) {
    return new IndefiniteTween((stopTween) => {
      if (this.mainSpine) {
        this.mainSpine.state.setAnimation(2, `apply_grand`, false)

        this.mainSpine.state.addListener({
          event: (_entry, event) => {
            if (event.data.name === `text_holder_on`) {
              this.multiplierLabel.alpha = 1

              const textHolderSlot = this.mainSpine?.skeleton.findSlot(`text_holder`)
              if (textHolderSlot) {
                const skin = this.mainSpine?.skeleton.skin
                const slotIndex = textHolderSlot.data.index
                const attachment = skin?.getAttachment(slotIndex, `text_holder`)
                if (attachment) {
                  textHolderSlot.setAttachment(attachment)
                }
              }
            }

            if (event.data.name === `start_move` && moveTarget) {
              const localTarget = this.parent
                ? this.parent.toLocal(moveTarget)
                : moveTarget
              Tween.to(
                this.position,
                { x: localTarget.x, y: localTarget.y },
                { duration: 800, easing: cubicInOut }
              ).start()
            }

            if (event.data.name === `apply_grand`) {
              onStartFlight?.()
            }
          }
        })

        this.mainSpine.state.onceTrackCompleted(2, () => {
          this.mainSpine!.state.clearTrack(2)
          this.visible = false
          stopTween()
        })
      } else {
        stopTween()
      }
    })
  }

  #applyCombinedSkin(skinName: string) {
    if (!this.mainSpine) return

    const skeletonData = this.mainSpine.skeleton.data
    const defaultSkin = skeletonData.findSkin(`default`)
    const namedSkin = skeletonData.findSkin(skinName)

    const combined = new Skin(`combined`)
    if (defaultSkin) combined.addSkin(defaultSkin)
    if (namedSkin) combined.addSkin(namedSkin)

    this.mainSpine.skeleton.setSkin(combined)
    this.mainSpine.skeleton.setSlotsToSetupPose()
  }

  get isJackpotCoin() {
    return this.isJackpot
  }

  setSkinByJackpotType(jackpotType: JackpotTypes) {
    if (this.mainSpine) {
      this.#applyCombinedSkin(COIN_SKIN_BY_JACKPOT[jackpotType])
      this.multiplierLabel.alpha = 0
      this.isJackpot = true

      const textHolderSlot = this.mainSpine.skeleton.findSlot(`text_holder`)
      if (textHolderSlot) {
        textHolderSlot.setAttachment(null)
      }
    }
  }

  setRegularSkin() {
    if (this.mainSpine) {
      this.#applyCombinedSkin(`regular`)
      this.multiplierLabel.alpha = 1
      this.isJackpot = false
    }
  }

  override reset(): void {
    super.reset()

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    this.isJackpot = this.id === IDSpecial.Jackpot

    if (this.mainSpine) {
      this.#applyCombinedSkin(`regular`)
      this.mainSpine.state.setEmptyAnimations(0.01)
      this.mainSpine.state.clearTracks()
    }

    this.multiplierLabel.value = 1
    this.multiplierLabel.alpha = 1
    this.isJackpot = false

    this.playIdle()
  }
}
