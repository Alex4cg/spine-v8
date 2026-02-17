import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STEP = 0.25;
const MIN = 0.5, MAX = 20;

function roundStep(v) {
  const r = Math.round(v / STEP) * STEP;
  return Math.max(MIN, Math.min(MAX, Math.round(r * 100) / 100));
}

// Symbol hierarchy: lion > bull > bear > wolf > low at every count
// Each symbol increases every count (5,6,...,30) — need range >= 25*0.25 = 6.25 for 26 distinct values
// At count 5: low 0.50, wolf 0.75, bear 1, bull 1.25, lion 1.50
// At count 30: low 6.75, wolf 7.00, bear 10.25, bull 15, lion 20
const at5 = { h1_lion: 1.5, h2_bull: 1.25, h3_bear: 1, h4_wolf: 0.75, low: 0.5 };
const at30 = { h1_lion: 20, h2_bull: 15, h3_bear: 10.25, h4_wolf: 7, low: 6.75 };

const symbols = ['h1_lion', 'h2_bull', 'h3_bear', 'h4_wolf', 'l1_revolver', 'l2_bottle', 'l3_horseshoe', 'l4_cactus'];

const payouts = {};
for (let c = 5; c <= 30; c++) {
  const t = (c - 5) / 25;
  let desc;
  if (c === 5) desc = '5 одинаковых символов на поле';
  else if (c === 30) desc = '30 одинаковых символов на поле (весь экран для сетки 6x5)';
  else if (c === 17) desc = c + '+ одинаковых символов на поле (редкий случай)';
  else if (c >= 18) desc = c + '+ одинаковых символов на поле';
  else desc = c + ' одинаковых символов на поле';
  const row = { description: desc };
  for (const sym of symbols) {
    const key = sym.startsWith('l') ? 'low' : sym;
    const v0 = at5[key];
    const v1 = at30[key];
    row[sym] = roundStep(v0 + t * (v1 - v0));
  }
  payouts[String(c)] = row;
}

const data = {
  version: '1.0',
  description: 'Конфигурация выигрышных комбинаций для каскадной слот-игры 6x5',
  gameType: 'cascade',
  grid: { cols: 6, rows: 5 },
  winRules: { minSymbols: 7, description: 'Минимальное количество одинаковых символов на поле для выигрыша' },
  payouts
};

const outPath = path.join(__dirname, 'payouts.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Written', outPath);
