import { Container, Sprite, Texture, Ticker, type DestroyOptions } from 'pixi.js'

import mainAtlas from '@/assets/atlas/main/atlas.gen'
import emitterConfig from '@/assets/atlas/emitter.json'

interface Particle {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  startAlpha: number
  endAlpha: number
  rotationSpeed: number
}

function lerp(a: number, b: number, t: number): number {
  return a + ((b - a) * t)
}

function randomRange(min: number, max: number): number {
  return min + (Math.random() * (max - min))
}

function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export default class SmokeEmitter extends Container {
  #texture: Texture
  #particles: Particle[] = []
  #pool: Sprite[] = []
  #timeSinceEmit = 0
  #isEmitting = true
  #frequency: number
  #lifetimeMin: number
  #lifetimeMax: number
  #speedStart: number
  #speedEnd: number
  #accelerationX: number
  #accelerationY: number
  #maxSpeed: number
  #startRotationMin: number
  #startRotationMax: number
  #rotationSpeedMin: number
  #rotationSpeedMax: number
  #alphaStart: number
  #alphaEnd: number
  #scaleStart: number
  #scaleEnd: number
  #spawnRadius: number
  #maxParticles: number

  constructor() {
    super()

    this.#texture = mainAtlas.getTexture(`m_smoke.png`)

    const cfg = emitterConfig as Record<string, unknown>

    this.#frequency = (cfg.frequency as number) ?? 0.02
    this.#lifetimeMin = ((cfg.lifetime as { min?: number })?.min) ?? 0.8
    this.#lifetimeMax = ((cfg.lifetime as { max?: number })?.max) ?? 1.5
    this.#speedStart = ((cfg.speed as { start?: number })?.start) ?? 30
    this.#speedEnd = ((cfg.speed as { end?: number })?.end) ?? 30
    this.#accelerationX = ((cfg.acceleration as { x?: number })?.x) ?? -600
    this.#accelerationY = ((cfg.acceleration as { y?: number })?.y) ?? 500
    this.#maxSpeed = (cfg.maxSpeed as number) ?? 300
    this.#startRotationMin = ((cfg.startRotation as { min?: number })?.min) ?? -100
    this.#startRotationMax = ((cfg.startRotation as { max?: number })?.max) ?? 5
    this.#rotationSpeedMin = ((cfg.rotationSpeed as { min?: number })?.min) ?? 0
    this.#rotationSpeedMax = ((cfg.rotationSpeed as { max?: number })?.max) ?? 1
    this.#alphaStart = ((cfg.alpha as { start?: number })?.start) ?? 1
    this.#alphaEnd = ((cfg.alpha as { end?: number })?.end) ?? 0
    this.#scaleStart = ((cfg.scale as { start?: number })?.start) ?? 1
    this.#scaleEnd = ((cfg.scale as { end?: number })?.end) ?? 1
    this.#spawnRadius = ((cfg.spawnCircle as { r?: number })?.r) ?? 30
    this.#maxParticles = (cfg.maxParticles as number) ?? 1000

    Ticker.shared.add(this.#onTick, this)
  }

  #onTick() {
    const dt = Ticker.shared.deltaMS / 1000

    if (this.#isEmitting) {
      this.#timeSinceEmit += dt

      while (this.#timeSinceEmit >= this.#frequency && this.#particles.length < this.#maxParticles) {
        this.#timeSinceEmit -= this.#frequency
        this.#spawnParticle()
      }
    }

    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p = this.#particles[i]

      p.life -= dt

      if (p.life <= 0) {
        this.#releaseSprite(p.sprite)
        const last = this.#particles[this.#particles.length - 1]
        this.#particles[i] = last
        this.#particles.pop()
        continue
      }

      p.vx += this.#accelerationX * dt
      p.vy += this.#accelerationY * dt

      const speed = Math.sqrt((p.vx * p.vx) + (p.vy * p.vy))
      if (speed > this.#maxSpeed) {
        const ratio = this.#maxSpeed / speed
        p.vx *= ratio
        p.vy *= ratio
      }

      p.sprite.x += p.vx * dt
      p.sprite.y += p.vy * dt

      p.sprite.rotation += p.rotationSpeed * dt

      const lifeProgress = 1 - (p.life / p.maxLife)
      p.sprite.alpha = lerp(p.startAlpha, p.endAlpha, lifeProgress)
      const scale = lerp(this.#scaleStart, this.#scaleEnd, lifeProgress)
      p.sprite.scale.set(scale)
    }
  }

  #acquireSprite(): Sprite {
    const sprite = this.#pool.pop()
    if (sprite) {
      sprite.visible = true
      sprite.texture = this.#texture

      return sprite
    }

    const newSprite = new Sprite(this.#texture)
    newSprite.anchor.set(0.5)
    this.addChild(newSprite)

    return newSprite
  }

  #releaseSprite(sprite: Sprite) {
    sprite.visible = false
    sprite.x = 0
    sprite.y = 0
    sprite.rotation = 0
    sprite.alpha = 0
    sprite.scale.set(1)
    this.#pool.push(sprite)
  }

  #spawnParticle() {
    const sprite = this.#acquireSprite()

    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * this.#spawnRadius
    sprite.x = Math.cos(angle) * radius
    sprite.y = Math.sin(angle) * radius

    const dirAngle = degToRad(randomRange(this.#startRotationMin, this.#startRotationMax))
    const speed = randomRange(this.#speedStart, this.#speedEnd)
    const vx = Math.cos(dirAngle) * speed
    const vy = Math.sin(dirAngle) * speed

    const lifetime = randomRange(this.#lifetimeMin, this.#lifetimeMax)
    const rotationSpeed = randomRange(this.#rotationSpeedMin, this.#rotationSpeedMax)

    sprite.alpha = this.#alphaStart
    sprite.scale.set(this.#scaleStart)

    this.#particles.push({
      sprite,
      vx,
      vy,
      life: lifetime,
      maxLife: lifetime,
      startAlpha: this.#alphaStart,
      endAlpha: this.#alphaEnd,
      rotationSpeed
    })
  }

  start() {
    this.#isEmitting = true
  }

  stop() {
    this.#isEmitting = false
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
