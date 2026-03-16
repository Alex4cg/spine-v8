import { type AudioSpriteAsset } from '@clawbuster/factory'

const soundSets: Record<string, string[]> = {}

export function playRandomSoundFromSet(sounds: AudioSpriteAsset, setName: string, soundPath: string, volume = 0.7) {
  if (!soundSets[setName]) soundSets[setName] = sounds.spritesWithPrefix(soundPath)
  const id = sounds.play(soundSets[setName][Math.floor(Math.random() * soundSets[setName].length)])
  sounds.volume(id, volume)

  return id
}

export function playSoundSetBySequence(sounds: AudioSpriteAsset, setName: string, soundPath: string, volume = 0.7) {
  if (!soundSets[setName]?.length) soundSets[setName] = sounds.spritesWithPrefix(soundPath)
  const id = sounds.play(soundSets[setName][0])
  sounds.volume(id, volume)
  soundSets[setName] = soundSets[setName].slice(1)

  return id
}
