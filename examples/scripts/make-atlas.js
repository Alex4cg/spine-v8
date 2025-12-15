const texturePacker = require('free-tex-packer-core');
const path = require('path');
const fs = require('fs');

function createAtlas(sequenceName) {
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
  
  console.log(`📦 Создание атласа 4096x2048 из: ${inputDir}`);
  console.log(`📁 Выходная папка: ${outputDir}`);
  
  const files = fs.readdirSync(inputDir)
    .filter(file => file.endsWith('.png'))
    .sort()
    .map(file => ({
      path: path.join(inputDir, file),
      contents: fs.readFileSync(path.join(inputDir, file))
    }));
  
  if (files.length === 0) {
    console.error(`❌ PNG файлы не найдены в: ${inputDir}`);
    process.exit(1);
  }
  
  console.log(`📄 Найдено ${files.length} файлов`);
  
  // Используем размеры как в Spine: 4096x2048
  const options = {
    textureName: sequenceName,
    width: 4096,
    height: 2048,
    padding: 2,
    allowRotation: true,  // Разрешаем поворот для лучшей упаковки
    detectIdentical: false,
    allowTrim: true,  // Разрешаем обрезку прозрачных краев
    trimMode: 'trim',  // Режим обрезки
    alphaThreshold: 0,  // Порог прозрачности для trim
    exporter: 'JsonHash',
    removeFileExtension: false,
    prependFolderName: false
  };
  
  texturePacker(files, options, (result, error) => {
    if (error) {
      console.error('❌ Ошибка:', error);
      process.exit(1);
    }
    
    if (!result || !Array.isArray(result)) {
      console.error('❌ Результат пустой или неверный формат');
      console.error('Результат:', result);
      process.exit(1);
    }
    
    // Результат - массив файлов: [{name: "file.json", buffer: Buffer}, {name: "file.png", buffer: Buffer}, ...]
    console.log(`\n📊 Получено файлов: ${result.length}`);
    console.log('Примеры файлов:', result.slice(0, 3).map(f => f.name));
    
    // Группируем файлы по атласам
    const atlases = {};
    result.forEach(file => {
      // Имя файла может быть: "winframe_60_fps.json", "winframe_60_fps.png" или "winframe_60_fps-2.json"
      const match = file.name.match(/^(.+?)(?:-(\d+))?\.(json|png)$/);
      if (match) {
        const baseName = match[1];
        const index = match[2] || '0';
        const ext = match[3];
        
        if (!atlases[index]) {
          atlases[index] = {};
        }
        atlases[index][ext] = {
          name: file.name,
          buffer: file.buffer
        };
      }
    });
    
    const atlasCount = Object.keys(atlases).length;
    console.log(`📦 Создано атласов: ${atlasCount}`);
    
    Object.keys(atlases).sort().forEach(index => {
      const atlas = atlases[index];
      const suffix = atlasCount > 1 ? `_${index}` : '';
      
      // Сохраняем JSON
      if (atlas.json) {
        const jsonPath = path.join(outputDir, `${sequenceName}${suffix}.json`);
        fs.writeFileSync(jsonPath, atlas.json.buffer);
        console.log(`✅ JSON создан: ${jsonPath}`);
      } else {
        console.log(`⚠️ JSON не найден для атласа ${index}`);
      }
      
      // Сохраняем PNG
      if (atlas.png) {
        const imagePath = path.join(outputDir, `${sequenceName}${suffix}.png`);
        fs.writeFileSync(imagePath, atlas.png.buffer);
        console.log(`✅ Изображение создано: ${imagePath}`);
      } else {
        console.log(`⚠️ PNG не найден для атласа ${index}`);
      }
    });
    
    if (atlasCount === 1) {
      console.log(`\n✅ Создан один атлас 4096x2048: ${sequenceName}.json`);
    } else {
      console.log(`\n⚠️ Создано ${atlasCount} атласов (файлы не поместились в один 4096x2048)`);
      console.log(`💡 Попробуйте уменьшить padding или разрешить rotation`);
    }
    
    console.log('\n✨ Готово!');
  });
}

const sequenceName = process.argv[2] || 'winframe_60_fps';
createAtlas(sequenceName);
