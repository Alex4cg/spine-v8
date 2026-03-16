import type { IDBase, IDSpecial } from '@/components/items/const'

export const GameEvents = {
  EmulateClick: `emulateClick`,
  ReelStop: `reel_stop`
} as const

export type ReelStopPayload = {
  barIndex: number
  ids: (IDBase | IDSpecial)[]
}
