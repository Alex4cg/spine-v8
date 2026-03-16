import { Container, Sprite, Texture, Ticker, type DestroyOptions } from 'pixi.js'

import mainAtlas from '@/assets/atlas/main/atlas.gen'

const COIN_FRAME_COUNT = 17

const DEG_TO_RAD = Math.PI / 180
const NORMAL_SPREAD_DEG = 30
const BURST_SPREAD_DEG = 60
const DEFAULT_EMIT_DURATION = 1500

export type EmitterDirection = `left` | `right`

interface CoinParticle {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  startScale: number
  endScale: number
  rotationSpeed: number
  frameTime: number
  currentFrame: number
  active: boolean
}

function lerp(a: number, b: number, t: number): number {
  return a + ((b - a) * t)
}

function randomRange(min: number, max: number): number {
  return min + (Math.random() * (max - min))
}

export enum BurstIntensity {
  Small = `small`,
  Medium = `medium`,
  Large = `large`,
  Huge = `huge`
}

interface BurstConfig {
  particleCount: number
  spreadDeg: number
  speedMultiplier: number
}

export default class CoinEmitter extends Container {
  #textures: Texture[] = []
  #particles: CoinParticle[] = []
  #pool: Sprite[] = []
  #timeSinceEmit = 0
  #isEmitting = false
  #emitTimer = 0
  #baseAngle: number
  #startSpeed = 420
  #gravity = 900
  #lifetimeMin = 0.5
  #lifetimeMax = 0.8
  #scaleStart = 0.5
  #scaleEnd = 0.3
  #rotationSpeedMin = -5
  #rotationSpeedMax = 5
  #animationFps = 30
  #maxParticles = 2000
  #emissionRate = 0.008

  static readonly EMISSION_RATES: Record<number, number> = {
    1: 0.008,
    2: 0.006,
    3: 0.004
  }

  static readonly BURST_CONFIGS: Record<BurstIntensity, BurstConfig> = {
    [BurstIntensity.Small]: {
      particleCount: 30,
      spreadDeg: BURST_SPREAD_DEG,
      speedMultiplier: 0.8
    },
    [BurstIntensity.Medium]: {
      particleCount: 60,
      spreadDeg: BURST_SPREAD_DEG,
      speedMultiplier: 1.0
    },
    [BurstIntensity.Large]: {
      particleCount: 90,
      spreadDeg: BURST_SPREAD_DEG,
      speedMultiplier: 1.2
    },
    [BurstIntensity.Huge]: {
      particleCount: 120,
      spreadDeg: BURST_SPREAD_DEG,
      speedMultiplier: 1.4
    }
  }

  constructor(direction: EmitterDirection) {
    super()

    this.#baseAngle = direction === `left` ? -Math.PI * 0.75 : -Math.PI * 0.25
    this.#loadTextures()

    Ticker.shared.add(this.#onTick, this)
  }

  #loadTextures() {
    for (let i = 0; i < COIN_FRAME_COUNT; i++) {
      const frameName = i.toString().padStart(2, `0`)
      const texture = mainAtlas.getTexture(`coin_gold/${frameName}.png`)
      this.#textures.push(texture)
    }
  }

  #acquireSprite(): Sprite {
    const sprite = this.#pool.pop()
    if (sprite) {
      sprite.visible = true

      return sprite
    }

    const newSprite = new Sprite(this.#textures[0])
    newSprite.anchor.set(0.5)
    this.addChild(newSprite)

    return newSprite
  }

  #releaseSprite(sprite: Sprite) {
    sprite.visible = false
    sprite.x = 0
    sprite.y = 0
    sprite.rotation = 0
    sprite.scale.set(1)
    this.#pool.push(sprite)
  }

  #onTick() {
    const dt = Ticker.shared.deltaMS / 1000

    if (this.#isEmitting && this.#emitTimer > 0) {
      this.#emitTimer -= dt
      if (this.#emitTimer <= 0) {
        this.#isEmitting = false
      }
    }

    if (this.#isEmitting) {
      this.#timeSinceEmit += dt

      while (this.#timeSinceEmit >= this.#emissionRate && this.#particles.length < this.#maxParticles) {
        this.#timeSinceEmit -= this.#emissionRate
        this.#spawnParticle()
      }
    }

    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p = this.#particles[i]

      p.life -= dt

      if (p.life <= 0) {
        this.#releaseSprite(p.sprite)
        this.#particles.splice(i, 1)
        continue
      }

      p.vy += this.#gravity * dt
      p.sprite.x += p.vx * dt
      p.sprite.y += p.vy * dt
      p.sprite.rotation += p.rotationSpeed * dt

      const lifeProgress = 1 - (p.life / p.maxLife)
      const scale = lerp(p.startScale, p.endScale, lifeProgress)
      p.sprite.scale.set(scale)
      p.frameTime += dt

      const frameDuration = 1 / this.#animationFps
      if (p.frameTime >= frameDuration) {
        p.frameTime -= frameDuration
        p.currentFrame = (p.currentFrame + 1) % COIN_FRAME_COUNT
        p.sprite.texture = this.#textures[p.currentFrame]
      }
    }
  }

  #spawnParticle(spreadDeg: number = NORMAL_SPREAD_DEG, speedMultiplier: number = 1.0) {
    const startFrame = Math.floor(Math.random() * COIN_FRAME_COUNT)
    const sprite = this.#acquireSprite()
    sprite.texture = this.#textures[startFrame]

    const halfSpread = spreadDeg * DEG_TO_RAD
    const dirAngle = this.#baseAngle + randomRange(-halfSpread, halfSpread)

    const speedVariation = randomRange(0.85, 1.15)
    const speed = this.#startSpeed * speedMultiplier * speedVariation

    const vx = Math.cos(dirAngle) * speed
    const vy = Math.sin(dirAngle) * speed

    const lifetime = randomRange(this.#lifetimeMin, this.#lifetimeMax)
    const rotationSpeed = randomRange(this.#rotationSpeedMin, this.#rotationSpeedMax)

    sprite.x = 0
    sprite.y = 0
    sprite.rotation = 0
    sprite.scale.set(this.#scaleStart)

    this.#particles.push({
      sprite,
      vx,
      vy,
      life: lifetime,
      maxLife: lifetime,
      startScale: this.#scaleStart,
      endScale: this.#scaleEnd,
      rotationSpeed,
      frameTime: 0,
      currentFrame: startFrame,
      active: true
    })
  }

  emitFor(durationMs: number = DEFAULT_EMIT_DURATION) {
    this.#isEmitting = true
    this.#emitTimer = durationMs / 1000
    this.#timeSinceEmit = 0
  }

  start() {
    this.#isEmitting = true
    this.#emitTimer = 0
  }

  stop() {
    this.#isEmitting = false
    this.#emitTimer = 0
  }

  setEmissionRate(rate: number) {
    this.#emissionRate = rate
  }

  setLevelEmissionRate(level: 1 | 2 | 3) {
    this.#emissionRate = CoinEmitter.EMISSION_RATES[level] ?? 0.008
  }

  burst(intensity: BurstIntensity = BurstIntensity.Medium) {
    const config = CoinEmitter.BURST_CONFIGS[intensity]
    const actualCount = Math.min(config.particleCount, this.#maxParticles - this.#particles.length)

    for (let i = 0; i < actualCount; i++) {
      this.#spawnParticle(config.spreadDeg, config.speedMultiplier)
    }
  }

  static getIntensityByCoinsCollected(coinsCount: number): BurstIntensity {
    if (coinsCount <= 1) return BurstIntensity.Small
    if (coinsCount === 2) return BurstIntensity.Medium
    if (coinsCount === 3) return BurstIntensity.Large

    return BurstIntensity.Huge
  }

  reset() {
    this.stop()

    for (const p of this.#particles) {
      this.#releaseSprite(p.sprite)
    }

    this.#particles = []
    this.#timeSinceEmit = 0
  }

  override destroy(options?: DestroyOptions) {
    Ticker.shared.remove(this.#onTick, this)

    for (const p of this.#particles) {
      p.sprite.destroy()
    }
    this.#particles = []

    for (const s of this.#pool) {
      s.destroy()
    }
    this.#pool = []

    super.destroy(options)
  }
}
