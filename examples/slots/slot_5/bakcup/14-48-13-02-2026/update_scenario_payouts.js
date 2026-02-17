import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const payoutsPath = path.join(__dirname, 'payouts.json');
const scenarioPath = path.join(__dirname, 'scenario', 'scenario_defolt.json');

const payoutsData = JSON.parse(fs.readFileSync(payoutsPath, 'utf8'));
const payoutsTable = payoutsData.payouts;

function getPayout(count, symbolName) {
  let c = Math.max(5, Math.min(30, Number(count)));
  const countStr = String(c);
  if (!(countStr in payoutsTable)) return undefined;
  const row = payoutsTable[countStr];
  if (row[symbolName] !== undefined) return row[symbolName];
  // fallback: use nearest lower count key
  const keys = Object.keys(row).filter(k => k !== 'description' && /^\d+$/.test(k));
  const numKeys = Object.keys(payoutsTable)
    .filter(k => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
  const lower = numKeys.filter(n => n <= c);
  const useKey = lower.length ? String(lower[lower.length - 1]) : '5';
  return payoutsTable[useKey][symbolName];
}

const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

for (const step of scenario) {
  const groups = step.winningGroups || [];
  if (groups.length === 0) {
    step.payouts = [];
    step.totalPayout = 0;
    continue;
  }
  let total = 0;
  const newPayouts = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const count = g.count;
    const symbolName = g.symbolName;
    const payout = getPayout(count, symbolName);
    const value = payout !== undefined ? payout : 0;
    newPayouts.push({
      symbolType: g.symbolType,
      symbolName,
      count,
      payout: value
    });
    total += value;
  }
  step.payouts = newPayouts;
  const mult = step.multiplier || 1;
  step.totalPayout = Math.round(total * mult * 100) / 100;
}

// Формат как в scenario_2026-02-11T21-20-43.json: один шаг — одна строка, отступ 2 пробела
const lines = scenario.map(step => '  ' + JSON.stringify(step));
const output = '[\n' + lines.join(',\n') + '\n]';
fs.writeFileSync(scenarioPath, output, 'utf8');
console.log('Updated', scenarioPath);
