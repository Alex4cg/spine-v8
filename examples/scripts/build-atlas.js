const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const sequenceName = 'winframe_60_fps';
const inputDir = path.join(__dirname, '..', 'slots', 'slot_1', 'seq', sequenceName);
const outputDir = path.join(__dirname, '..', 'slots', 'slot_1', 'atlas', sequenceName);

if (!fs.existsSync(inputDir)) {
  console.error(`❌ Папка не найдена: ${inputDir}`);
  process.exit(1);
}

const atlasBaseDir = path.join(__dirname, '..', 'slots', 'slot_1', 'atlas');
if (!fs.existsSync(atlasBaseDir)) {
  fs.mkdirSync(atlasBaseDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`📦 Создание атласа из: ${inputDir}`);
console.log(`📁 Выходная папка: ${outputDir}`);

try {
  const command = `npx free-tex-packer-cli "${inputDir}" -f json -o "${outputDir}" -n ${sequenceName} --width 2048 --height 2048`;
  console.log(`Выполняется: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log(`✅ Атлас создан: ${outputDir}/${sequenceName}.json`);
  console.log(`✅ Изображение: ${outputDir}/${sequenceName}.png`);
  console.log('✨ Готово!');
} catch (error) {
  console.error('❌ Ошибка при создании атласа:', error.message);
  process.exit(1);
}
