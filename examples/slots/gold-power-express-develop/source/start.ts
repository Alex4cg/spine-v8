import game from '@/game/game'
import Slot from '@/game/slot'
import { GAME_HEIGHT, GAME_WIDTH, SAFE_ZONE_HEIGHT, SAFE_ZONE_WIDTH } from '@/const'
import { ui } from '@clawbuster/facade'

game
  .create(ui.viewport, GAME_WIDTH, GAME_HEIGHT, SAFE_ZONE_WIDTH, SAFE_ZONE_HEIGHT)
  .then(() => {
    game.addChild(new Slot())
  })
