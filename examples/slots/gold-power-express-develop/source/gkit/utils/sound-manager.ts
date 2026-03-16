import soundsSfx from '@/assets/sounds/sfx/sound.gen'
import soundsTheme from '@/assets/sounds/theme/sound.gen'

let sfxEnabled = true

export function playSfx(name: string, volume = 0.5): number {
  if (!sfxEnabled) return 0
  const id = soundsSfx.play(name)
  soundsSfx.volume(id, volume)

  return id
}

export function stopSfx(name: string) {
  soundsSfx.stop(name)
}

export function fadeSfx(name: string, from: number, to: number, duration: number) {
  soundsSfx.fade(name, from, to, duration)
}

export function setSfxEnabled(enabled: boolean) {
  sfxEnabled = enabled
}

export function muteSfx(muted: boolean) {
  soundsSfx.howl.mute(muted)
}

interface ThemeConfig {
  name: string
  volume: number
}

interface SoundThemeManagerProps {
  idleTheme: ThemeConfig
  baseTheme: ThemeConfig
  bonusTheme: ThemeConfig
  fadeDuration?: number
  idleTimeout?: number
}

type ThemeKey = `idle` | `base` | `bonus`

export class SoundThemeManager {
  #idleTheme: ThemeConfig
  #baseTheme: ThemeConfig
  #bonusTheme: ThemeConfig
  #fadeDuration: number
  #idleTimeout: number

  #idleSoundId: number | undefined
  #baseSoundId: number | undefined
  #bonusSoundId: number | undefined

  #currentTheme: ThemeKey = `idle`
  #enabled = true
  #inactivityTimer: number | undefined

  constructor(props: SoundThemeManagerProps) {
    this.#idleTheme = props.idleTheme
    this.#baseTheme = props.baseTheme
    this.#bonusTheme = props.bonusTheme
    this.#fadeDuration = props.fadeDuration ?? 3000
    this.#idleTimeout = props.idleTimeout ?? 10000
  }

  get currentTheme(): ThemeKey {
    return this.#currentTheme
  }

  init() {
    this.#idleSoundId = soundsTheme.play(this.#idleTheme.name)
    soundsTheme.loop(this.#idleSoundId, true)
    soundsTheme.volume(this.#idleSoundId, this.#idleTheme.volume)
    this.#currentTheme = `idle`
  }

  setEnabled(enabled: boolean) {
    if (this.#enabled === enabled) return
    this.#enabled = enabled

    if (!this.#enabled) {
      this.#clearIdleTimer()
      this.#stopAll()
    } else {
      this.#restoreCurrentTheme()
    }
  }

  mute(muted: boolean) {
    soundsTheme.howl.mute(muted)
  }

  playIdleTheme() {
    if (!this.#enabled) return
    if (this.#currentTheme === `idle`) return
    this.#switchTo(`idle`)
  }

  playBaseTheme() {
    if (!this.#enabled) return
    if (this.#currentTheme === `base` || this.#currentTheme === `bonus`) return
    this.#switchTo(`base`)
  }

  playBonusTheme() {
    if (!this.#enabled) return
    if (this.#currentTheme === `bonus`) return
    this.#switchTo(`bonus`)
  }

  fadeOutTheme(to = 0, ms = 2000) {
    const { id, config } = this.#getActiveSoundData()
    if (id === undefined) return
    soundsTheme.fade(id, config.volume, to, ms)
  }

  fadeInTheme(from = 0, ms = 2000) {
    const { id, config } = this.#getActiveSoundData()
    if (id === undefined) return
    soundsTheme.fade(id, from, config.volume, ms)
  }

  scheduleIdleSwitch() {
    this.#clearIdleTimer()
    if (this.#currentTheme === `bonus`) return
    this.#inactivityTimer = window.setTimeout(() => {
      this.playIdleTheme()
    }, this.#idleTimeout)
  }

  clearIdleTimer() {
    this.#clearIdleTimer()
  }

  #switchTo(theme: ThemeKey) {
    const config = this.#getConfigByKey(theme)
    const newId = soundsTheme.play(config.name)
    soundsTheme.loop(newId, true)
    soundsTheme.volume(newId, 0)
    soundsTheme.fade(newId, 0, config.volume, this.#fadeDuration)

    this.#fadeOutAndStop(this.#idleSoundId, theme === `idle` ? undefined : this.#idleTheme.volume)
    this.#fadeOutAndStop(this.#baseSoundId, theme === `base` ? undefined : this.#baseTheme.volume)
    this.#fadeOutAndStop(this.#bonusSoundId, theme === `bonus` ? undefined : this.#bonusTheme.volume)

    if (theme === `idle`) this.#idleSoundId = newId
    else if (theme === `base`) this.#baseSoundId = newId
    else this.#bonusSoundId = newId

    this.#currentTheme = theme
  }

  #fadeOutAndStop(soundId: number | undefined, fromVolume?: number) {
    if (soundId === undefined || fromVolume === undefined) return
    soundsTheme.fade(soundId, fromVolume, 0, this.#fadeDuration)
    const toStop = soundId
    setTimeout(() => soundsTheme.stop(toStop), this.#fadeDuration)
  }

  #stopAll() {
    if (this.#idleSoundId !== undefined) {
      soundsTheme.stop(this.#idleSoundId)
      this.#idleSoundId = undefined
    }
    if (this.#baseSoundId !== undefined) {
      soundsTheme.stop(this.#baseSoundId)
      this.#baseSoundId = undefined
    }
    if (this.#bonusSoundId !== undefined) {
      soundsTheme.stop(this.#bonusSoundId)
      this.#bonusSoundId = undefined
    }
  }

  #restoreCurrentTheme() {
    const config = this.#getConfigByKey(this.#currentTheme)
    const newId = soundsTheme.play(config.name)
    soundsTheme.loop(newId, true)
    soundsTheme.volume(newId, config.volume)

    if (this.#currentTheme === `idle`) this.#idleSoundId = newId
    else if (this.#currentTheme === `base`) this.#baseSoundId = newId
    else this.#bonusSoundId = newId
  }

  #getConfigByKey(key: ThemeKey): ThemeConfig {
    switch (key) {
      case `idle`: return this.#idleTheme
      case `base`: return this.#baseTheme
      case `bonus`: return this.#bonusTheme
    }

    throw new Error(`Unknown theme key: ${key}`)
  }

  #getActiveSoundData(): { id: number | undefined; config: ThemeConfig } {
    switch (this.#currentTheme) {
      case `idle`: return { id: this.#idleSoundId, config: this.#idleTheme }
      case `base`: return { id: this.#baseSoundId, config: this.#baseTheme }
      case `bonus`: return { id: this.#bonusSoundId, config: this.#bonusTheme }
    }

    throw new Error(`Unknown current theme: ${this.#currentTheme}`)
  }

  #clearIdleTimer() {
    if (this.#inactivityTimer !== undefined) {
      clearTimeout(this.#inactivityTimer)
      this.#inactivityTimer = undefined
    }
  }
}

let themeManager: SoundThemeManager | null = null

function bindEvents() {
  window.addEventListener(`button-click-sound`, () => {
    playSfx(`play_button`, 0.5)
  })
}

const soundManager = {
  init(config?: SoundThemeManagerProps) {
    themeManager = new SoundThemeManager(config ?? {
      idleTheme: { name: `idle_theme`, volume: 0.15 },
      baseTheme: { name: `base_theme`, volume: 0.15 },
      bonusTheme: { name: `bonus_theme`, volume: 0.15 }
    })
    themeManager.init()
    bindEvents()
  },

  get themeManager(): SoundThemeManager {
    return themeManager!
  },

  onSpinStart(isFreeSpins = false) {
    themeManager?.clearIdleTimer()
    if (!isFreeSpins) {
      themeManager?.playBaseTheme()
    }
    playSfx(isFreeSpins ? `bgreel_spin` : `reels_spin`, isFreeSpins ? 0.28 : 0.7)
  },

  onSpinEnd() {
    themeManager?.scheduleIdleSwitch()
  },

  onBonusGameStart() {
    themeManager?.clearIdleTimer()
    themeManager?.playBonusTheme()
  },

  onBonusGameEnd() {
    themeManager?.clearIdleTimer()
    themeManager?.playIdleTheme()
  },

  fadeOutTheme(to = 0, ms = 2000) {
    themeManager?.fadeOutTheme(to, ms)
  },

  fadeInTheme(from = 0, ms = 2000) {
    themeManager?.fadeInTheme(from, ms)
  },

  muteTheme(muted: boolean) {
    themeManager?.mute(muted)
  },

  muteSfx
}

export default soundManager
