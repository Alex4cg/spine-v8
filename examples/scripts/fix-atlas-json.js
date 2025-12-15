const fs = require('fs');
const path = require('path');

const atlasDir = path.join(__dirname, '..', 'slots', 'slot_1', 'atlas', 'winframe_60_fps');
const files = fs.readdirSync(atlasDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(atlasDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Преобразуем buffer из объекта с массивом байтов в строку JSON
  if (data.buffer && data.buffer.data && Array.isArray(data.buffer.data)) {
    const jsonString = Buffer.from(data.buffer.data).toString('utf8');
    fs.writeFileSync(filePath, jsonString);
    console.log(`✅ Исправлен: ${file}`);
  }
});

console.log('✨ Готово!');

