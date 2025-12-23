// Данные загадок (парсинг из файла загадки.txt)
const RIDDLES_DATA = `Если часы показывают верное время только 2 раза в сутки то они: "Стоят"
Я от бабушки ушел я от дедушки ушел кто я: "Ник Вуйчич"
Кому ты написываешь: Спишь? - когда тебе скучно и одиноко. "Дима"
Карий, голубой, зеленый, Иногда от слез соленый, но у каждого из нас только шоколадный.... "глаз"
Гуси шли на водопой (один вслед за другим). Один гусь посмотрел вперёд – перед ним  10 голов Посмотрел назад – за ним 26 лап. Сколько гусей шло на водопой? "24"
Сказочный гном на ночь ставит свечу. На утро у него остается 1/5 свечи. Он может сделать 1 новую свечу из 5 остатков. Сколько ночей гном не будет страдать от геморроя если у него изначально есть 25 свечей "31"
Нет его у тети с мамой, А у папы с дядей есть, Про какой же орган явный, мы ведем сегодня речь? "кадык"
Если сядешь на него, Быстро ты вспотеешь, Но с усердием своим, Далеко доедешь. "Велосипед"`;

// Пути к изображениям для слайд-шоу
const SLIDESHOW_IMAGES = [
  'source/foto/00.png',
  'source/foto/01.png',
  'source/foto/02.png',
  'source/foto/03.png',
  'source/foto/04.png',
  'source/foto/05.png',
  'source/foto/06.png',
  'source/foto/07.png',
  'source/foto/08.png'
];

class QuizGame {
  constructor() {
    this.riddles = [];
    this.currentRiddleIndex = 0;
    this.wrongAnswersInRow = 0;
    this.hintLettersRevealed = 0;
    this.correctAnswersCount = 0;
    
    // DOM элементы
    this.quizScreen = document.getElementById('quiz-screen');
    this.jokeScreen = document.getElementById('joke-screen');
    this.slideshowScreen = document.getElementById('slideshow-screen');
    this.videoScreen = document.getElementById('video-screen');
    this.riddleText = document.getElementById('riddle-text');
    this.answerInput = document.getElementById('answer-input');
    this.hintContainer = document.getElementById('hint-container');
    this.hintText = document.getElementById('hint-text');
    this.messageText = document.getElementById('message-text');
    this.progressText = document.getElementById('progress-text');
    this.checkButton = document.getElementById('check-button');
    this.nextButton = document.getElementById('next-button');
    this.jokeImage = document.getElementById('joke-image');
    this.jokeText = document.getElementById('joke-text');
    this.slideshowImage = document.getElementById('slideshow-image');
    this.slideshowCounter = document.getElementById('slideshow-counter');
    this.slideshowCaptionText = document.querySelector('.slideshow-caption-text');
    this.prizeVideo = document.getElementById('prize-video');
    this.backgroundMusic = document.getElementById('background-music');
    this.soundToggle = document.getElementById('sound-toggle');
    this.soundIcon = document.getElementById('sound-icon');
    this.isSoundOn = true; // Состояние звука
    
    this.init();
  }
  
  init() {
    this.parseRiddles();
    this.setupEventListeners();
    this.checkImageSizes();
    this.showCurrentRiddle();
    // Настройка музыки (но не запуск)
    this.backgroundMusic.volume = 0.5; // Устанавливаем громкость 50%
  }
  
  // Запуск фоновой музыки
  startBackgroundMusic() {
    // Пытаемся запустить музыку
    // Многие браузеры требуют взаимодействия пользователя для автозапуска
    this.backgroundMusic.volume = 0.5; // Устанавливаем громкость 50%
    
    const playMusic = () => {
      this.backgroundMusic.play().catch(error => {
        console.log('Автозапуск музыки заблокирован браузером. Музыка запустится при первом взаимодействии.');
      });
    };
    
    // Пытаемся запустить сразу
    playMusic();
    
    // Также запускаем при первом взаимодействии пользователя
    const startOnInteraction = () => {
      playMusic();
      // Удаляем обработчики после первого запуска
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('keydown', startOnInteraction);
      this.answerInput.removeEventListener('focus', startOnInteraction);
    };
    
    document.addEventListener('click', startOnInteraction, { once: true });
    document.addEventListener('keydown', startOnInteraction, { once: true });
    this.answerInput.addEventListener('focus', startOnInteraction, { once: true });
  }
  
  // Парсинг загадок из текста
  parseRiddles() {
    const lines = RIDDLES_DATA.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      // Ищем ответ в кавычках в конце строки
      // Формат может быть: "Вопрос: Ответ" или "Вопрос с двоеточием внутри. "Ответ""
      const match = line.match(/^(.+?)\s+"(.+)"$/);
      if (match) {
        this.riddles.push({
          question: match[1].trim(),
          answer: match[2].trim()
        });
        // Отладка для проверки парсинга
        if (index === 2) { // 3-я загадка (индекс 2)
          console.log('3-я загадка:', {
            question: match[1].trim(),
            answer: match[2].trim()
          });
        }
      } else {
        console.warn(`Не удалось распарсить строку ${index + 1}:`, line);
      }
    });
    
    console.log(`Загружено загадок: ${this.riddles.length}`);
  }
  
  // Проверка размеров изображений (1024x1024)
  async checkImageSizes() {
    const imagesToCheck = [...SLIDESHOW_IMAGES, 'source/foto/bg.png'];
    
    for (const imgPath of imagesToCheck) {
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            if (img.width !== 1024 || img.height !== 1024) {
              console.warn(`⚠️ ${imgPath}: ${img.width}x${img.height} (ожидается 1024x1024)`);
            } else {
              console.log(`✓ ${imgPath}: ${img.width}x${img.height}`);
            }
            resolve();
          };
          img.onerror = () => {
            console.error(`✗ Ошибка загрузки: ${imgPath}`);
            reject();
          };
          img.src = imgPath;
        });
      } catch (error) {
        console.error(`Ошибка при проверке ${imgPath}:`, error);
      }
    }
  }
  
  // Настройка обработчиков событий
  setupEventListeners() {
    this.checkButton.addEventListener('click', () => this.checkAnswer());
    this.nextButton.addEventListener('click', () => this.nextRiddle());
    this.soundToggle.addEventListener('click', () => this.toggleSound());
    this.answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.checkAnswer();
      }
    });
    
    // Обработчик завершения видео
    this.prizeVideo.addEventListener('ended', () => {
      this.showFinalMessage();
    });
  }
  
  // Переключение звука
  toggleSound() {
    this.isSoundOn = !this.isSoundOn;
    
    if (this.isSoundOn) {
      this.backgroundMusic.play().catch(error => {
        console.log('Не удалось включить музыку:', error);
      });
      this.soundIcon.textContent = '🔊';
      this.soundToggle.title = 'Выключить звук';
    } else {
      this.backgroundMusic.pause();
      this.soundIcon.textContent = '🔇';
      this.soundToggle.title = 'Включить звук';
    }
  }
  // Показать текущую загадку
  showCurrentRiddle() {
    if (this.currentRiddleIndex >= this.riddles.length) {
      this.startPrizeSequence();
      return;
    }
    
    const riddle = this.riddles[this.currentRiddleIndex];
    this.riddleText.textContent = riddle.question;
    this.answerInput.value = '';
    this.answerInput.focus();
    
    // Сброс состояния для новой загадки
    this.wrongAnswersInRow = 0;
    this.hintLettersRevealed = 0;
    this.hintContainer.classList.add('hidden');
    this.messageText.textContent = '';
    this.nextButton.classList.add('hidden');
    
    // Обновление прогресса
    this.progressText.textContent = `Загадка ${this.currentRiddleIndex + 1} из ${this.riddles.length}`;
  }
  
  // Нормализация ответа для сравнения
  normalizeAnswer(answer) {
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?;:]/g, '');
  }
  
  // Проверка ответа
  checkAnswer() {
    const userAnswer = this.answerInput.value.trim();
    if (!userAnswer) {
      this.showMessage('Пожалуйста, введите ответ!', 'error');
      return;
    }
    
    const currentRiddle = this.riddles[this.currentRiddleIndex];
    const normalizedUserAnswer = this.normalizeAnswer(userAnswer);
    const normalizedCorrectAnswer = this.normalizeAnswer(currentRiddle.answer);
    
    if (normalizedUserAnswer === normalizedCorrectAnswer) {
      // Правильный ответ
      this.correctAnswersCount++;
      this.wrongAnswersInRow = 0;
      this.hintLettersRevealed = 0;
      this.showMessage('Правильно! 🎉', 'success');
      
      // Если это последняя загадка, запускаем приз автоматически
      if (this.currentRiddleIndex === this.riddles.length - 1) {
        setTimeout(() => {
          this.startPrizeSequence();
        }, 1500);
      } else {
        this.nextButton.classList.remove('hidden');
      }
    } else {
      // Неправильный ответ
      this.wrongAnswersInRow++;
      this.showMessage('Неправильно. Попробуйте еще раз!', 'error');
      
      // Если 5 неправильных ответов подряд, начинаем показывать подсказки
      if (this.wrongAnswersInRow >= 5) {
        this.showHint();
      }
    }
  }
  
  // Показать подсказку (по буквам)
  showHint() {
    const currentRiddle = this.riddles[this.currentRiddleIndex];
    const answer = currentRiddle.answer;
    
    // Каждая неправильная попытка после 5-й открывает еще одну букву
    const lettersToReveal = Math.min(
      this.wrongAnswersInRow - 4, // Начинаем с 1 буквы после 5-й попытки
      answer.replace(/\s/g, '').length // Количество букв без пробелов
    );
    
    if (lettersToReveal > this.hintLettersRevealed) {
      this.hintLettersRevealed = lettersToReveal;
      
      // Формируем подсказку: показываем буквы по порядку (пробелы всегда видны)
      let hint = '';
      let letterIndex = 0; // Счетчик только для букв (без пробелов)
      
      for (let i = 0; i < answer.length; i++) {
        const char = answer[i];
        if (char === ' ') {
          hint += ' ';
        } else {
          if (letterIndex < this.hintLettersRevealed) {
            hint += char;
          } else {
            hint += '_';
          }
          letterIndex++;
        }
      }
      
      this.hintText.textContent = hint;
      this.hintContainer.classList.remove('hidden');
    }
  }
  
  // Переход к следующей загадке
  nextRiddle() {
    this.currentRiddleIndex++;
    this.showCurrentRiddle();
  }
  
  // Показать сообщение
  showMessage(text, type = 'info') {
    this.messageText.textContent = text;
    this.messageText.className = `message-text ${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        this.messageText.textContent = '';
        this.messageText.className = 'message-text';
      }, 2000);
    }
  }
  
  // Запуск призовой последовательности
  startPrizeSequence() {
    console.log('Запуск призовой последовательности');
    this.quizScreen.classList.add('hidden');
    this.startJokeSequence();
  }
  
  // Запуск шутки перед слайд-шоу
  startJokeSequence() {
    const jokes = [
      {
        image: 'source/foto/tiket.png',
        text: 'Сначала я хотел подарить тебе билеты в лучшие столицы мира, но потом подумал: "да ты наверное там уже была".'
      },
      {
        image: 'source/foto/bdsm.png',
        text: 'Потом я хотел подарить тебе какую то полезную игрушку, но подумал: "ой да у нее то точно они даааавноооо есть"'
      }
    ];
    
    // Предзагружаем все изображения
    const preloadImages = jokes.map(joke => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Продолжаем даже при ошибке
        img.src = joke.image;
      });
    });
    
    // Ждем загрузки всех изображений, затем показываем шутки
    Promise.all(preloadImages).then(() => {
      let currentJoke = 0;
      
      const showJoke = () => {
        if (currentJoke >= jokes.length) {
          // Шутки закончились, переходим к слайд-шоу
          this.jokeScreen.classList.add('hidden');
          this.slideshowScreen.classList.remove('hidden');
          this.startSlideshow();
          return;
        }
        
        // Запускаем музыку при показе первой шутки
        if (currentJoke === 0) {
          this.backgroundMusic.play().catch(error => {
            console.log('Не удалось запустить музыку:', error);
          });
        }
        
        // Скрываем текст сначала
        this.jokeText.classList.remove('visible');
        
        // Устанавливаем текст и изображение ДО показа экрана
        this.jokeText.textContent = jokes[currentJoke].text;
        this.jokeImage.src = jokes[currentJoke].image;
        
        // Показываем экран шутки
        this.jokeScreen.classList.remove('hidden');
        
        // Ждем следующего кадра рендеринга, чтобы браузер правильно позиционировал текст
        requestAnimationFrame(() => {
          // Еще один кадр для гарантии правильного позиционирования
          requestAnimationFrame(() => {
            // Теперь показываем текст - он уже на правильной позиции
            this.jokeText.classList.add('visible');
          });
        });
        
        currentJoke++;
        
        // Через 6 секунд показываем следующую шутку или переходим к слайд-шоу
        setTimeout(showJoke, 6000);
      };
      
      showJoke();
    });
  }
  
  // Запуск слайд-шоу
  startSlideshow() {
    // Скрываем текст сначала
    this.slideshowCaptionText.classList.remove('visible');
    
    // Показываем экран слайд-шоу
    this.slideshowScreen.classList.remove('hidden');
    
    // Ждем следующего кадра рендеринга, чтобы браузер правильно позиционировал текст
    requestAnimationFrame(() => {
      // Еще один кадр для гарантии правильного позиционирования
      requestAnimationFrame(() => {
        // Теперь показываем текст - он уже на правильной позиции
        this.slideshowCaptionText.classList.add('visible');
      });
    });
    
    let currentSlide = 0;
    const initialInterval = 2200; // Начальный интервал: 2.5 секунды
    const minInterval = 800; // Минимальный интервал: 0.8 секунды
    const acceleration = 200; // Ускорение: уменьшение на 180мс за каждый слайд
    
    const showSlide = () => {
      if (currentSlide >= SLIDESHOW_IMAGES.length) {
        // Слайд-шоу закончилось, переходим к видео
        this.slideshowScreen.classList.add('hidden');
        this.videoScreen.classList.remove('hidden');
        this.startVideo();
        return;
      }
      
      // Устанавливаем изображение (текст уже на месте в HTML)
      this.slideshowImage.src = SLIDESHOW_IMAGES[currentSlide];
      this.slideshowCounter.textContent = `${currentSlide + 1} / ${SLIDESHOW_IMAGES.length}`;
      
      // Вычисляем интервал для следующего слайда (уменьшаемся с каждым слайдом)
      const currentInterval = Math.max(
        initialInterval - (currentSlide * acceleration),
        minInterval
      );
      
      currentSlide++;
      setTimeout(showSlide, currentInterval);
    };
    
    showSlide();
  }
  
  // Запуск видео
  startVideo() {
    // Запускаем видео сразу
    this.prizeVideo.play().catch(error => {
      console.error('Ошибка воспроизведения видео:', error);
      // Некоторые браузеры требуют взаимодействия пользователя для автозапуска
      this.showMessage('Нажмите на видео для воспроизведения', 'info');
    });
    
    // Показываем поздравительное сообщение с задержкой в 4 секунды
    setTimeout(() => {
      this.showCongratulations();
    }, 4000);
  }
  
  // Финальное сообщение
  showFinalMessage() {
    const message = document.createElement('div');
    message.className = 'final-message';
    message.innerHTML = `
      <h2>Поздравляем! 🎉</h2>
      <p>Вы ответили правильно на ${this.correctAnswersCount} из ${this.riddles.length} загадок!</p>
      <p>Спасибо за участие в викторине!</p>
    `;
    this.videoScreen.appendChild(message);
  }
  
  // Поздравительное сообщение
  showCongratulations() {
    const message = document.createElement('div');
    message.className = 'final-message congratulations';
    message.innerHTML = `
      <h2>Диночка, поздравляю тебя с новым годом! 🎉</h2>
      <p>И дарю тебе то единственное, чего тебе не хватало для счастья:</p>
      <p class="prize-text">"уверенность в драке с гусем"</p>
      <p>Тренируйся, развивайся, и удачи в бою! 💪</p>
    `;
    this.videoScreen.appendChild(message);
  }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  new QuizGame();
});

