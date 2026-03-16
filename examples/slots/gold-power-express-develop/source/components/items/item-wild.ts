import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { IndefiniteTween } from '@/gkit/tweens'
import WildSpine from '@/assets/spine/wild/skeleton'
import ItemBase from './item-base'
import { IDBase } from './const'

export default class ItemWild extends ItemBase {
  constructor() {
    super(IDBase.W)
    const spineData = WildSpine.spineData
    const mainSpine = this.addChild(new Spine(spineData))
    mainSpine.autoUpdate = false
    mainSpine.skeleton.setSkinByName(`default`)
    mainSpine.skeleton.setSlotsToSetupPose()

    this.mainSpine = mainSpine

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    this.playIdle()
  }

  playIdle() {
    if (this.mainSpine) {
      this.mainSpine.state.setAnimation(1, `idle`, true)
    }
  }

  getWinTween() {
    return new IndefiniteTween((stopTween) => {
      if (!this.mainSpine) {
        stopTween()

        return
      }

      this.mainSpine.state.setAnimation(2, `win`, false)
      this.mainSpine.state.onceTrackCompleted(2, () => {
        this.mainSpine!.state.clearTrack(2)
        this.playIdle()
        stopTween()
      })
    })
  }

  override reset(): void {
    super.reset()

    if (this.mainSprite) {
      this.mainSprite.visible = false
    }

    if (this.mainSpine) {
      this.mainSpine.skeleton.setSkinByName(`default`)
      this.mainSpine.skeleton.setSlotsToSetupPose()
      this.mainSpine.state.setEmptyAnimations(0.01)
      this.mainSpine.state.clearTracks()
    }

    this.playIdle()
  }
}
