import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Цвета граней кубика Рубика
const COLORS = {
  WHITE: 0xffffff,
  YELLOW: 0xffd700,
  RED: 0xff0000,
  ORANGE: 0xff7700,
  BLUE: 0x0000ff,
  GREEN: 0x00ff00,
  BLACK: 0x000000
};

// Индексы граней
const FACE = {
  FRONT: 0,   // красный
  BACK: 1,    // оранжевый
  RIGHT: 2,   // синий
  LEFT: 3,    // зеленый
  UP: 4,      // белый
  DOWN: 5     // желтый
};

// Маппинг цветов на индексы граней
const FACE_COLORS = [
  COLORS.RED,     // FRONT
  COLORS.ORANGE,  // BACK
  COLORS.BLUE,    // RIGHT
  COLORS.GREEN,   // LEFT
  COLORS.WHITE,   // UP
  COLORS.YELLOW   // DOWN
];

// Класс для модели кубика Рубика
class RubiksCube {
  constructor() {
    // Массив 6 граней, каждая грань это массив 3x3 (9 элементов)
    this.faces = [];
    this.reset();
  }

  reset() {
    // Инициализация собранного кубика
    this.faces = [
      Array(9).fill(FACE.FRONT),   // FRONT - красный
      Array(9).fill(FACE.BACK),    // BACK - оранжевый
      Array(9).fill(FACE.RIGHT),   // RIGHT - синий
      Array(9).fill(FACE.LEFT),    // LEFT - зеленый
      Array(9).fill(FACE.UP),      // UP - белый
      Array(9).fill(FACE.DOWN)     // DOWN - желтый
    ];
  }

  // Получить цвет грани по позиции
  getFaceColor(face, row, col) {
    const index = row * 3 + col;
    return FACE_COLORS[this.faces[face][index]];
  }

  // Получить массив цветов для грани
  getFaceColors(face) {
    return this.faces[face].map(f => FACE_COLORS[f]);
  }

  // Поворот грани по часовой стрелке (90 градусов)
  rotateFaceClockwise(face) {
    const grid = [
      [this.faces[face][0], this.faces[face][1], this.faces[face][2]],
      [this.faces[face][3], this.faces[face][4], this.faces[face][5]],
      [this.faces[face][6], this.faces[face][7], this.faces[face][8]]
    ];

    // Поворот матрицы 3x3 по часовой стрелке
    const rotated = [
      [grid[2][0], grid[1][0], grid[0][0]],
      [grid[2][1], grid[1][1], grid[0][1]],
      [grid[2][2], grid[1][2], grid[0][2]]
    ];

    // Записать обратно
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.faces[face][row * 3 + col] = rotated[row][col];
      }
    }
  }

  // Поворот грани против часовой стрелки
  rotateFaceCounterClockwise(face) {
    // Поворот 3 раза по часовой = поворот против часовой
    for (let i = 0; i < 3; i++) {
      this.rotateFaceClockwise(face);
    }
  }

  // Поворот правой грани (R)
  rotateR(clockwise = true) {
    if (clockwise) {
      // Сохранить края соседних граней
      const temp = [
        this.faces[FACE.UP][2], this.faces[FACE.UP][5], this.faces[FACE.UP][8],
        this.faces[FACE.BACK][0], this.faces[FACE.BACK][3], this.faces[FACE.BACK][6],
        this.faces[FACE.DOWN][2], this.faces[FACE.DOWN][5], this.faces[FACE.DOWN][8],
        this.faces[FACE.FRONT][2], this.faces[FACE.FRONT][5], this.faces[FACE.FRONT][8]
      ];

      // Переместить края
      this.faces[FACE.UP][2] = temp[9];
      this.faces[FACE.UP][5] = temp[10];
      this.faces[FACE.UP][8] = temp[11];
      this.faces[FACE.BACK][0] = temp[5];
      this.faces[FACE.BACK][3] = temp[4];
      this.faces[FACE.BACK][6] = temp[3];
      this.faces[FACE.DOWN][2] = temp[0];
      this.faces[FACE.DOWN][5] = temp[1];
      this.faces[FACE.DOWN][8] = temp[2];
      this.faces[FACE.FRONT][2] = temp[6];
      this.faces[FACE.FRONT][5] = temp[7];
      this.faces[FACE.FRONT][8] = temp[8];

      this.rotateFaceClockwise(FACE.RIGHT);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateR(true);
      this.rotateR(true);
      this.rotateR(true);
    }
  }

  // Поворот левой грани (L)
  rotateL(clockwise = true) {
    if (clockwise) {
      const temp = [
        this.faces[FACE.UP][0], this.faces[FACE.UP][3], this.faces[FACE.UP][6],
        this.faces[FACE.FRONT][0], this.faces[FACE.FRONT][3], this.faces[FACE.FRONT][6],
        this.faces[FACE.DOWN][0], this.faces[FACE.DOWN][3], this.faces[FACE.DOWN][6],
        this.faces[FACE.BACK][2], this.faces[FACE.BACK][5], this.faces[FACE.BACK][8]
      ];

      this.faces[FACE.UP][0] = temp[9];
      this.faces[FACE.UP][3] = temp[10];
      this.faces[FACE.UP][6] = temp[11];
      this.faces[FACE.FRONT][0] = temp[0];
      this.faces[FACE.FRONT][3] = temp[1];
      this.faces[FACE.FRONT][6] = temp[2];
      this.faces[FACE.DOWN][0] = temp[3];
      this.faces[FACE.DOWN][3] = temp[4];
      this.faces[FACE.DOWN][6] = temp[5];
      this.faces[FACE.BACK][2] = temp[8];
      this.faces[FACE.BACK][5] = temp[7];
      this.faces[FACE.BACK][8] = temp[6];

      this.rotateFaceClockwise(FACE.LEFT);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateL(true);
      this.rotateL(true);
      this.rotateL(true);
    }
  }

  // Поворот верхней грани (U)
  rotateU(clockwise = true) {
    if (clockwise) {
      const temp = [
        this.faces[FACE.FRONT][0], this.faces[FACE.FRONT][1], this.faces[FACE.FRONT][2],
        this.faces[FACE.RIGHT][0], this.faces[FACE.RIGHT][1], this.faces[FACE.RIGHT][2],
        this.faces[FACE.BACK][0], this.faces[FACE.BACK][1], this.faces[FACE.BACK][2],
        this.faces[FACE.LEFT][0], this.faces[FACE.LEFT][1], this.faces[FACE.LEFT][2]
      ];

      this.faces[FACE.FRONT][0] = temp[9];
      this.faces[FACE.FRONT][1] = temp[10];
      this.faces[FACE.FRONT][2] = temp[11];
      this.faces[FACE.RIGHT][0] = temp[0];
      this.faces[FACE.RIGHT][1] = temp[1];
      this.faces[FACE.RIGHT][2] = temp[2];
      this.faces[FACE.BACK][0] = temp[3];
      this.faces[FACE.BACK][1] = temp[4];
      this.faces[FACE.BACK][2] = temp[5];
      this.faces[FACE.LEFT][0] = temp[6];
      this.faces[FACE.LEFT][1] = temp[7];
      this.faces[FACE.LEFT][2] = temp[8];

      this.rotateFaceClockwise(FACE.UP);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateU(true);
      this.rotateU(true);
      this.rotateU(true);
    }
  }

  // Поворот нижней грани (D)
  rotateD(clockwise = true) {
    if (clockwise) {
      const temp = [
        this.faces[FACE.FRONT][6], this.faces[FACE.FRONT][7], this.faces[FACE.FRONT][8],
        this.faces[FACE.LEFT][6], this.faces[FACE.LEFT][7], this.faces[FACE.LEFT][8],
        this.faces[FACE.BACK][6], this.faces[FACE.BACK][7], this.faces[FACE.BACK][8],
        this.faces[FACE.RIGHT][6], this.faces[FACE.RIGHT][7], this.faces[FACE.RIGHT][8]
      ];

      this.faces[FACE.FRONT][6] = temp[3];
      this.faces[FACE.FRONT][7] = temp[4];
      this.faces[FACE.FRONT][8] = temp[5];
      this.faces[FACE.LEFT][6] = temp[6];
      this.faces[FACE.LEFT][7] = temp[7];
      this.faces[FACE.LEFT][8] = temp[8];
      this.faces[FACE.BACK][6] = temp[9];
      this.faces[FACE.BACK][7] = temp[10];
      this.faces[FACE.BACK][8] = temp[11];
      this.faces[FACE.RIGHT][6] = temp[0];
      this.faces[FACE.RIGHT][7] = temp[1];
      this.faces[FACE.RIGHT][8] = temp[2];

      this.rotateFaceClockwise(FACE.DOWN);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateD(true);
      this.rotateD(true);
      this.rotateD(true);
    }
  }

  // Поворот передней грани (F)
  rotateF(clockwise = true) {
    if (clockwise) {
      const temp = [
        this.faces[FACE.UP][6], this.faces[FACE.UP][7], this.faces[FACE.UP][8],
        this.faces[FACE.RIGHT][0], this.faces[FACE.RIGHT][3], this.faces[FACE.RIGHT][6],
        this.faces[FACE.DOWN][2], this.faces[FACE.DOWN][1], this.faces[FACE.DOWN][0],
        this.faces[FACE.LEFT][2], this.faces[FACE.LEFT][5], this.faces[FACE.LEFT][8]
      ];

      this.faces[FACE.UP][6] = temp[9];
      this.faces[FACE.UP][7] = temp[10];
      this.faces[FACE.UP][8] = temp[11];
      this.faces[FACE.RIGHT][0] = temp[0];
      this.faces[FACE.RIGHT][3] = temp[1];
      this.faces[FACE.RIGHT][6] = temp[2];
      this.faces[FACE.DOWN][2] = temp[3];
      this.faces[FACE.DOWN][1] = temp[4];
      this.faces[FACE.DOWN][0] = temp[5];
      this.faces[FACE.LEFT][2] = temp[8];
      this.faces[FACE.LEFT][5] = temp[7];
      this.faces[FACE.LEFT][8] = temp[6];

      this.rotateFaceClockwise(FACE.FRONT);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateF(true);
      this.rotateF(true);
      this.rotateF(true);
    }
  }

  // Поворот задней грани (B)
  rotateB(clockwise = true) {
    if (clockwise) {
      const temp = [
        this.faces[FACE.UP][0], this.faces[FACE.UP][1], this.faces[FACE.UP][2],
        this.faces[FACE.LEFT][0], this.faces[FACE.LEFT][3], this.faces[FACE.LEFT][6],
        this.faces[FACE.DOWN][6], this.faces[FACE.DOWN][7], this.faces[FACE.DOWN][8],
        this.faces[FACE.RIGHT][2], this.faces[FACE.RIGHT][5], this.faces[FACE.RIGHT][8]
      ];

      this.faces[FACE.UP][0] = temp[3];
      this.faces[FACE.UP][1] = temp[4];
      this.faces[FACE.UP][2] = temp[5];
      this.faces[FACE.LEFT][0] = temp[8];
      this.faces[FACE.LEFT][3] = temp[7];
      this.faces[FACE.LEFT][6] = temp[6];
      this.faces[FACE.DOWN][6] = temp[9];
      this.faces[FACE.DOWN][7] = temp[10];
      this.faces[FACE.DOWN][8] = temp[11];
      this.faces[FACE.RIGHT][2] = temp[2];
      this.faces[FACE.RIGHT][5] = temp[1];
      this.faces[FACE.RIGHT][8] = temp[0];

      this.rotateFaceClockwise(FACE.BACK);
    } else {
      // Поворот против часовой = 3 поворота по часовой
      this.rotateB(true);
      this.rotateB(true);
      this.rotateB(true);
    }
  }

  // Перемешивание кубика
  scramble(moves = 25) {
    const movesList = ['R', 'L', 'U', 'D', 'F', 'B', "R'", "L'", "U'", "D'", "F'", "B'"];
    const sequence = [];
    
    for (let i = 0; i < moves; i++) {
      const move = movesList[Math.floor(Math.random() * movesList.length)];
      sequence.push(move);
      this.applyMove(move);
    }
    
    return sequence;
  }

  // Применить ход по нотации
  applyMove(move) {
    switch (move) {
      case 'R': this.rotateR(true); break;
      case "R'": this.rotateR(false); break;
      case 'L': this.rotateL(true); break;
      case "L'": this.rotateL(false); break;
      case 'U': this.rotateU(true); break;
      case "U'": this.rotateU(false); break;
      case 'D': this.rotateD(true); break;
      case "D'": this.rotateD(false); break;
      case 'F': this.rotateF(true); break;
      case "F'": this.rotateF(false); break;
      case 'B': this.rotateB(true); break;
      case "B'": this.rotateB(false); break;
    }
  }
}

// Класс для 3D визуализации кубика
class CubeVisualization {
  constructor(container, cubeModel) {
    this.container = container;
    this.cubeModel = cubeModel;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = new THREE.Vector2();
    this.cubes = []; // Массив всех маленьких кубиков
    this.faceGroups = []; // Группы кубиков для каждой грани
    this.isRotating = false;
    this.animationDuration = 300; // миллисекунды
    this.animationStartTime = null;
    this.currentRotation = null;

    this.init();
  }

  init() {
    // Создание сцены
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Камера
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Рендерер
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Орбитальные контролы
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 15;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    directionalLight1.castShadow = true;
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, -5);
    this.scene.add(directionalLight2);

    // Raycaster для определения кликов
    this.raycaster = new THREE.Raycaster();

    // Создание кубика
    this.buildCube();

    // Обработчики событий
    this.setupEventListeners();

    // Анимационный цикл
    this.animate();
  }

  // Создание 3D модели кубика
  buildCube() {
    const size = 0.95; // Размер маленького кубика
    const gap = 0.05; // Промежуток между кубиками
    const spacing = size + gap;

    // Очистить старые кубики
    this.cubes.forEach(cube => {
      this.scene.remove(cube);
      if (cube.geometry) cube.geometry.dispose();
      if (cube.material) {
        if (Array.isArray(cube.material)) {
          cube.material.forEach(mat => mat.dispose());
        } else {
          cube.material.dispose();
        }
      }
    });
    this.cubes = [];

    // Создать 27 маленьких кубиков (3x3x3)
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Определить какие грани должны быть видимыми
          const visibleFaces = {
            right: x === 1 ? FACE.RIGHT : null,
            left: x === -1 ? FACE.LEFT : null,
            top: y === 1 ? FACE.UP : null,
            bottom: y === -1 ? FACE.DOWN : null,
            front: z === 1 ? FACE.FRONT : null,
            back: z === -1 ? FACE.BACK : null
          };

          // Создать геометрию кубика с цветными гранями
          const geometry = new THREE.BoxGeometry(size, size, size);
          const materials = [];

          // Определить цвета граней на основе позиции в кубике
          const faceIndex = (face, x, y, z) => {
            if (face === FACE.RIGHT) {
              const row = 1 - y;
              const col = z + 1;
              return row * 3 + col;
            } else if (face === FACE.LEFT) {
              const row = 1 - y;
              const col = 2 - z;
              return row * 3 + col;
            } else if (face === FACE.UP) {
              const row = 2 - z;
              const col = x + 1;
              return row * 3 + col;
            } else if (face === FACE.DOWN) {
              const row = z + 1;
              const col = x + 1;
              return row * 3 + col;
            } else if (face === FACE.FRONT) {
              const row = 1 - y;
              const col = x + 1;
              return row * 3 + col;
            } else if (face === FACE.BACK) {
              const row = 1 - y;
              const col = 2 - x;
              return row * 3 + col;
            }
            return 0;
          };

          for (let i = 0; i < 6; i++) {
            let color = COLORS.BLACK;
            
            if (i === 0 && visibleFaces.right !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.right, 
                Math.floor(faceIndex(visibleFaces.right, x, y, z) / 3),
                faceIndex(visibleFaces.right, x, y, z) % 3);
            } else if (i === 1 && visibleFaces.left !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.left,
                Math.floor(faceIndex(visibleFaces.left, x, y, z) / 3),
                faceIndex(visibleFaces.left, x, y, z) % 3);
            } else if (i === 2 && visibleFaces.top !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.top,
                Math.floor(faceIndex(visibleFaces.top, x, y, z) / 3),
                faceIndex(visibleFaces.top, x, y, z) % 3);
            } else if (i === 3 && visibleFaces.bottom !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.bottom,
                Math.floor(faceIndex(visibleFaces.bottom, x, y, z) / 3),
                faceIndex(visibleFaces.bottom, x, y, z) % 3);
            } else if (i === 4 && visibleFaces.front !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.front,
                Math.floor(faceIndex(visibleFaces.front, x, y, z) / 3),
                faceIndex(visibleFaces.front, x, y, z) % 3);
            } else if (i === 5 && visibleFaces.back !== null) {
              color = this.cubeModel.getFaceColor(visibleFaces.back,
                Math.floor(faceIndex(visibleFaces.back, x, y, z) / 3),
                faceIndex(visibleFaces.back, x, y, z) % 3);
            }

            materials.push(new THREE.MeshStandardMaterial({ color }));
          }

          const cube = new THREE.Mesh(geometry, materials);
          cube.position.set(x * spacing, y * spacing, z * spacing);
          cube.userData = { x, y, z, visibleFaces, originalPosition: new THREE.Vector3(x * spacing, y * spacing, z * spacing) };
          
          this.cubes.push(cube);
          this.scene.add(cube);

          // Запомнить к каким граням принадлежит кубик (для анимации)
          if (!cube.userData.faceIndices) cube.userData.faceIndices = [];
          if (x === 1) cube.userData.faceIndices.push(FACE.RIGHT);
          if (x === -1) cube.userData.faceIndices.push(FACE.LEFT);
          if (y === 1) cube.userData.faceIndices.push(FACE.UP);
          if (y === -1) cube.userData.faceIndices.push(FACE.DOWN);
          if (z === 1) cube.userData.faceIndices.push(FACE.FRONT);
          if (z === -1) cube.userData.faceIndices.push(FACE.BACK);
        }
      }
    }
  }

  // Обновление визуализации после изменения модели
  updateVisualization() {
    this.buildCube();
  }

  // Определение грани по клику
  getFaceFromIntersection(intersect) {
    const cube = intersect.object;
    const normal = intersect.face.normal;
    const { x, y, z } = cube.userData;

    // Определить какая грань была кликнута по нормали
    if (normal.x > 0.5) return { face: FACE.RIGHT, x, y, z };
    if (normal.x < -0.5) return { face: FACE.LEFT, x, y, z };
    if (normal.y > 0.5) return { face: FACE.UP, x, y, z };
    if (normal.y < -0.5) return { face: FACE.DOWN, x, y, z };
    if (normal.z > 0.5) return { face: FACE.FRONT, x, y, z };
    if (normal.z < -0.5) return { face: FACE.BACK, x, y, z };

    return null;
  }

  // Анимация поворота грани
  async animateFaceRotation(face, clockwise = true) {
    if (this.isRotating) return;
    
    this.isRotating = true;
    this.currentRotation = { face, clockwise };
    
    // Создать временную группу для анимации
    const tempGroup = new THREE.Group();
    const faceCubes = [];
    
    // Найти все кубики, принадлежащие этой грани
    this.cubes.forEach(cube => {
      if (cube.userData.faceIndices && cube.userData.faceIndices.includes(face)) {
        // Сохранить текущую позицию относительно группы
        const worldPos = cube.position.clone();
        cube.position.sub(tempGroup.position);
        tempGroup.add(cube);
        faceCubes.push({ cube, originalWorldPos: worldPos });
      }
    });
    
    this.scene.add(tempGroup);
    
    const startTime = Date.now();
    const targetAngle = clockwise ? Math.PI / 2 : -Math.PI / 2;
    const axis = this.getRotationAxis(face);
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.animationDuration, 1);
      
      // Easing функция
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const angle = targetAngle * easeProgress;
      
      tempGroup.rotation.setFromAxisAngle(axis, angle);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Обновить модель кубика
        this.applyRotationToModel(face, clockwise);
        
        // Вернуть кубики в сцену и перестроить визуализацию
        faceCubes.forEach(({ cube }) => {
          tempGroup.remove(cube);
        });
        this.scene.remove(tempGroup);
        
        this.updateVisualization();
        
        this.isRotating = false;
        this.currentRotation = null;
      }
    };
    
    animate();
  }

  // Получить ось вращения для грани
  getRotationAxis(face) {
    switch (face) {
      case FACE.RIGHT:
      case FACE.LEFT:
        return new THREE.Vector3(1, 0, 0);
      case FACE.UP:
      case FACE.DOWN:
        return new THREE.Vector3(0, 1, 0);
      case FACE.FRONT:
      case FACE.BACK:
        return new THREE.Vector3(0, 0, 1);
      default:
        return new THREE.Vector3(0, 1, 0);
    }
  }

  // Применить поворот к модели
  applyRotationToModel(face, clockwise) {
    const moves = {
      [FACE.RIGHT]: clockwise ? 'R' : "R'",
      [FACE.LEFT]: clockwise ? 'L' : "L'",
      [FACE.UP]: clockwise ? 'U' : "U'",
      [FACE.DOWN]: clockwise ? 'D' : "D'",
      [FACE.FRONT]: clockwise ? 'F' : "F'",
      [FACE.BACK]: clockwise ? 'B' : "B'"
    };

    this.cubeModel.applyMove(moves[face]);
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    // Клик по грани
    this.renderer.domElement.addEventListener('click', (event) => {
      // Проверить, не кликнули ли по UI элементам
      const target = event.target;
      if (target.tagName === 'BUTTON' || target.closest('#controls') || target.closest('#info')) {
        return;
      }
      
      if (this.isRotating) return;
      
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.cubes);

      if (intersects.length > 0) {
        const faceInfo = this.getFaceFromIntersection(intersects[0]);
        if (faceInfo) {
          this.animateFaceRotation(faceInfo.face, true);
        }
      }
    });

    // Управление с клавиатуры
    window.addEventListener('keydown', (event) => {
      if (this.isRotating) return;
      
      const key = event.key.toLowerCase();
      const isShift = event.shiftKey;

      switch (key) {
        case 'r':
          this.animateFaceRotation(FACE.RIGHT, !isShift);
          break;
        case 'l':
          this.animateFaceRotation(FACE.LEFT, !isShift);
          break;
        case 'u':
          this.animateFaceRotation(FACE.UP, !isShift);
          break;
        case 'd':
          this.animateFaceRotation(FACE.DOWN, !isShift);
          break;
        case 'f':
          this.animateFaceRotation(FACE.FRONT, !isShift);
          break;
        case 'b':
          this.animateFaceRotation(FACE.BACK, !isShift);
          break;
        case 'arrowright':
          this.animateFaceRotation(FACE.RIGHT, true);
          break;
        case 'arrowleft':
          this.animateFaceRotation(FACE.LEFT, true);
          break;
        case 'arrowup':
          this.animateFaceRotation(FACE.UP, true);
          break;
        case 'arrowdown':
          this.animateFaceRotation(FACE.DOWN, true);
          break;
      }
    });

    // Изменение размера окна
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Анимационный цикл
  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Перемешивание с анимацией
  async scrambleAnimated(moves = 20) {
    if (this.isRotating) {
      console.log('Already rotating, skipping scramble');
      return;
    }
    
    console.log(`Starting scramble with ${moves} moves`);
    this.isRotating = true;
    
    try {
      // Применить перемешивание к модели
      const sequence = this.cubeModel.scramble(moves);
      console.log('Scramble sequence:', sequence);
      
      // Перестроить визуализацию без анимации для скорости
      this.updateVisualization();
      
      // Обновить статус
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = `Перемешано ${moves} ходов`;
      }
    } catch (error) {
      console.error('Error during scramble:', error);
    } finally {
      this.isRotating = false;
    }
  }

  getFaceFromMove(move) {
    const faceMap = {
      'R': FACE.RIGHT, "R'": FACE.RIGHT,
      'L': FACE.LEFT, "L'": FACE.LEFT,
      'U': FACE.UP, "U'": FACE.UP,
      'D': FACE.DOWN, "D'": FACE.DOWN,
      'F': FACE.FRONT, "F'": FACE.FRONT,
      'B': FACE.BACK, "B'": FACE.BACK
    };
    return faceMap[move] || FACE.FRONT;
  }

  // Сброс кубика
  reset() {
    if (this.isRotating) {
      console.log('Cannot reset while rotating');
      return;
    }
    
    console.log('Resetting cube');
    this.cubeModel.reset();
    this.updateVisualization();
    
    // Обновить статус
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = 'Кубик сброшен';
      setTimeout(() => {
        statusEl.textContent = 'Готов к использованию';
      }, 2000);
    }
  }
}

// Инициализация приложения
let visualization = null;

// Дождаться полной загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const cubeModel = new RubiksCube();
  visualization = new CubeVisualization(container, cubeModel);

  // Обработчики кнопок
  const btnScramble = document.getElementById('btn-scramble');
  const btnReset = document.getElementById('btn-reset');
  
  if (btnScramble) {
    btnScramble.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Scramble button clicked');
      if (visualization) {
        visualization.scrambleAnimated(20);
      }
    });
  } else {
    console.error('btn-scramble button not found');
  }
  
  if (btnReset) {
    btnReset.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Reset button clicked');
      if (visualization) {
        visualization.reset();
      }
    });
  } else {
    console.error('btn-reset button not found');
  }

  // Обновление статуса
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = 'Готов к использованию';
  }
});

