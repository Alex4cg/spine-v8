export enum IDBase {
  L1 = `L1`,
  L2 = `L2`,
  L3 = `L3`,
  L4 = `L4`,
  H1 = `H1`,
  H2 = `H2`,
  H3 = `H3`,
  H4 = `H4`,
  W = `W`,
}

export enum IDSpecial {
  Coin = `COIN`,
  Collector = `COL`,
  Jackpot = `JP`,
  Blank = `B`
}

export enum ItemKind {
  Fake = `fake`
}

export const COLORS_DATA = {
  fade: {
    color: 0x1a0a2e,
    alpha: 0.5
  }
}

export enum IDSpecialPack {
  BonusGame = `feature1`,
  GrandJackpot = `feature2`,
  Boosters = `feature3`
}

export type IdType = IDBase | IDSpecial | IDSpecialPack

export const TEXTURE_MAP = Object.freeze({
  [IDBase.L1]: `l1_watermelon`,
  [IDBase.L2]: `l2_grape`,
  [IDBase.L3]: `l3_lemon`,
  [IDBase.L4]: `l4_cherry`,
  [IDBase.H1]: `h1_diamond`,
  [IDBase.H2]: `h2_gold`,
  [IDBase.H3]: `h3_silver`,
  [IDBase.H4]: `h4_copper`,
  [IDBase.W]: `wild`,
  [IDSpecial.Coin]: `regular_coin_empty`,
  [IDSpecial.Collector]: `collector`,
  [IDSpecial.Jackpot]: `grand_coin`
}) as Readonly<Record<IDBase | IDSpecial, string>>

