import '@/gkit/spine-extension'
import '@/gkit/scalexy'
import '@/devtools'

import { createFacade, ui, type Expand } from '@clawbuster/facade'
import { AssetsLoader } from '@clawbuster/factory'

import { GAME_HEIGHT, GAME_WIDTH } from '@/const'
import type { DefaultState } from '@/types.ts'

const DEFAULT_STATE: Expand<DefaultState> = {
  freespins: 0,
  maxWin: false,
  coins: [],
  roundWinnings: 0,
  roundEnd: true,
  isInitial: true
}

ui.setDefaultState(DEFAULT_STATE)

createFacade({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  autospinsEnabled: false,
  loadGame: async (reportProgress, packs) => {
    const { lowResolution } = ui.screenProperties.value!

    await AssetsLoader({
      packs,
      reportProgress,
      lowResolution
    })

    await import(`./start.ts`)
  }
})
