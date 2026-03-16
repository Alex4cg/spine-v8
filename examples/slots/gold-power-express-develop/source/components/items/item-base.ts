import { Container, Sprite } from 'pixi.js'
import { Spine, type TrackEntry } from '@esotericsoftware/spine-pixi-v8'

import game from '@/game/game'
import { IDBase, IDSpecial, TEXTURE_MAP } from './const'
import { IndefiniteTween } from '@/gkit/tweens'
import type { AnimationData } from '@/gkit/utils/spine-skip-animation'
import itemsAtlas from '@/assets/atlas/items/atlas.gen'

const BLUR_SYMBOLS = new Set<IDBase>([
  IDBase.H1,
  IDBase.H2,
  IDBase.H3,
  IDBase.H4,
  IDBase.L1,
  IDBase.L2,
  IDBase.L3,
  IDBase.L4
])

export const DEFAULT_SCALE = 1
const SPINE_DEFAULT_SCALE = 1
const SPINE_ANIMATION_SKIP_TIME = 0.2

export default class ItemBase extends Container {
  public mainSpine: Spine | null = null
  public mainSprite: Sprite | null = null
  public id: IDBase | IDSpecial
  #linkOnEnterFrame
  public isPooling: boolean = false
  public isHided: boolean = false
  public skipWinAnimation: boolean = false
  public winAnimationEntryLink: TrackEntry | null = null
  public activeAnimationByTracks: Record<string, AnimationData> = {
    0: {
      targetStart: null,
      elapsed: null,
      instance: null,
      endTime: null
    }
  }

  constructor(id: IDBase | IDSpecial) {
    super()

    this.id = id

    const sprite = this.addChild(new Sprite(itemsAtlas.getTexture(this.getStaticTexturePath())))
    sprite.anchor.set(0.5)
    sprite.scale.set(1 / 2)
    sprite.roundPixels = true
    this.mainSprite = sprite

    this.#linkOnEnterFrame = game.onEnterFrame.add((dt: number) => this.onEnterFrame(dt))
  }

  getStaticTexturePath() {
    return `static/${TEXTURE_MAP[this.id]}.png`
  }

  getBlurTexturePath() {
    if (BLUR_SYMBOLS.has(this.id as IDBase)) {
      return `blur/${TEXTURE_MAP[this.id]}_blur.png`
    }

    return `blur/${TEXTURE_MAP[this.id]}.png`
  }

  setStaticTexture() {
    if (!this.mainSprite || !BLUR_SYMBOLS.has(this.id as IDBase)) {
      return
    }

    this.mainSprite.texture = itemsAtlas.getTexture(this.getStaticTexturePath())
  }

  setBlurTexture() {
    if (!this.mainSprite || !BLUR_SYMBOLS.has(this.id as IDBase)) {
      return
    }

    this.mainSprite.texture = itemsAtlas.getTexture(this.getBlurTexturePath())
  }

  onEnterFrame(dt: number) {
    if (!this.visible || !this.parent) return

    if (this.mainSpine && this.mainSpine.state.timeScale > 0) {
      for (const trackIndex in this.activeAnimationByTracks) {
        if (this.activeAnimationByTracks[trackIndex].instance && this.activeAnimationByTracks[trackIndex].targetStart) {
          const animationData = this.activeAnimationByTracks[trackIndex]

          if (animationData.elapsed === null) {
            animationData.elapsed = 0
          }

          animationData.elapsed += dt

          const newTime = animationData.targetStart! + (
            (animationData.elapsed / SPINE_ANIMATION_SKIP_TIME)
            * (animationData.endTime! - animationData.targetStart!)
          )

          animationData.instance!.trackTime = Math.min(newTime, animationData.endTime!)
        }
      }

      this.mainSpine.update(dt)
    }
  }

  reset() {
    this.position.set(0, 0)
    this.alpha = 1
    this.visible = true

    if (this.mainSprite) {
      this.mainSprite.visible = true
    }

    this.setStaticTexture()

    if (this.mainSpine) {
      this.mainSpine.alpha = 1
      this.mainSpine.tint = 0xffffff
      this.mainSpine.pivot.set(0, 0)
      this.mainSpine.position.set(0, 0)
      this.mainSpine.state.setEmptyAnimations(0.1)
      this.mainSpine.skeleton.setToSetupPose()
      this.mainSpine.scale.set(SPINE_DEFAULT_SCALE)
    }

    this.scale.set(DEFAULT_SCALE)
    this.zIndex = 0
    this.isHided = false
  }

  getWinTween() {
    if (!this.mainSpine) {
      return new IndefiniteTween((stopTween) => stopTween())
    }

    return new IndefiniteTween((stopTween) => {
      const animation = this.mainSpine!.state.setAnimation(0, `win`, false)

      this.winAnimationEntryLink = animation

      this.mainSpine!.state.onceTrackCompleted(0, () => {
        this.activeAnimationByTracks[0].targetStart = null
        this.activeAnimationByTracks[0].endTime = null
        this.activeAnimationByTracks[0].elapsed = null
        this.activeAnimationByTracks[0].instance = null

        stopTween()
      })
    })
  }

  destroy(options = { children: true }) {
    game.onEnterFrame.detach(this.#linkOnEnterFrame)

    super.destroy(options)
  }
}
