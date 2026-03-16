import { COLS, ROWS, SAFE_ZONE_WIDTH } from '@/const'

export const FIELD_BG_WIDTH = 906
export const FIELD_BG_HEIGHT = 498
export const SLOT_Y_OFFSET_DESKTOP = 30
export const SLOT_Y_OFFSET_MOBILE = 10
export const INDICATOR_Y_OFFSET = 10

export const SHOW_GRID_DEBUG = false

export const GRID_INSET_X = 0
export const GRID_INSET_Y = 0

export const GRID_WIDTH = FIELD_BG_WIDTH - (GRID_INSET_X * 2)
export const GRID_HEIGHT = FIELD_BG_HEIGHT - (GRID_INSET_Y * 2)

export const ITEM_H_GAP = GRID_WIDTH / COLS
export const ITEM_V_GAP = GRID_HEIGHT / ROWS

export const FIELD_TOP_OFFSET = 260
export const ITEM_TOP_OFFSET = FIELD_TOP_OFFSET + GRID_INSET_Y + (ITEM_V_GAP * 0.5)
export const FIELD_FRAME_TOP_OFFSET = 206
export const FIELD_LEFT_OFFSET = (SAFE_ZONE_WIDTH * 0.5) - (FIELD_BG_WIDTH * 0.5) + GRID_INSET_X + (ITEM_H_GAP * 0.5)

export function rowY(row: number, top = ITEM_TOP_OFFSET) {
  return Math.round(top + (row * ITEM_V_GAP))
}

export function columnX(col: number, left = FIELD_LEFT_OFFSET) {
  return Math.round(left + (col * ITEM_H_GAP))
}
