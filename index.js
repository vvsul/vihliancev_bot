const crypto = require('crypto');
const dotenv = require('dotenv');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const https = require('https');

// Загрузка переменных окружения из .env файла
dotenv.config();

// Переменные окружения для авторизации
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// Подключение к MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB подключен'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Определение схем и моделей
const scheduleSchema = new mongoose.Schema({
  group: String,
  day: String,
  time: String,
  subject: String,
  location: String
});

const materialSchema = new mongoose.Schema({
  group: String,
  subject: String,
  title: String,
  description: String,
  fileId: String,
  date: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  userId: String,
  group: String
});

const announcementSchema = new mongoose.Schema({
  text: String,
  date: { type: Date, default: Date.now }
});

const Schedule = mongoose.model('Schedule', scheduleSchema);
const Material = mongoose.model('Material', materialSchema);
const User = mongoose.model('User', userSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);

// Создание и настройка бота
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let waitingForMaterial = false;
let targetGroup = null;
let adminMode = false;
let currentAdminChatId = null;

// Обработчик команды /menu
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Меню:', {
    reply_markup: {
      keyboard: [
        ['Посмотреть расписание', 'Полезные источники'],
        ['Посмотреть материалы', 'Изменить группу'],
        ['Наши ресурсы', 'Помощь']
      ],
      resize_keyboard: true
    }
  });
});

// Обработчик команды "Посмотреть расписание"
bot.onText(/Посмотреть расписание/, async (msg) => {
  const userId = msg.from.id;
  const user = await User.findOne({ userId });

  if (!user) {
    bot.sendMessage(userId, 'Пожалуйста, сначала установите вашу группу с помощью команды /start.', {
      reply_markup: {
        keyboard: [['Назад']],
        resize_keyboard: true
      }
    });
    return;
  }

  const schedules = await Schedule.find({ group: user.group });

  if (schedules.length === 0) {
    bot.sendMessage(userId, 'Расписание для вашей группы не найдено.', {
      reply_markup: {
        keyboard: [
          ['Посмотреть расписание', 'Полезные источники'],
          ['Посмотреть материалы', 'Изменить группу'],
          ['Наши ресурсы', 'Помощь']
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  let response = `Расписание для группы ${user.group}:\n\n`;
  schedules.forEach(schedule => {
    response += `День: ${schedule.day}\nВремя: ${schedule.time}\nПредмет: ${schedule.subject}\nМестоположение: ${schedule.location}\n\n`;
  });

  bot.sendMessage(userId, response, {
    reply_markup: {
      keyboard: [
        ['Посмотреть расписание', 'Полезные источники'],
        ['Посмотреть материалы', 'Изменить группу'],
        ['Наши ресурсы', 'Помощь']
      ],
      resize_keyboard: true
    }
  });
});

// Обработчик команды "Посмотреть материалы"
bot.onText(/Посмотреть материалы/, async (msg) => {
  const userId = msg.from.id;
  const user = await User.findOne({ userId });

  if (!user) {
    bot.sendMessage(userId, 'Пожалуйста, сначала установите вашу группу с помощью команды /start.', {
      reply_markup: {
        keyboard: [['Назад']],
        resize_keyboard: true
      }
    });
    return;
  }

  const materials = await Material.find({ group: user.group });

  if (materials.length === 0) {
    bot.sendMessage(userId, 'Учебные материалы для вашей группы не найдены.', {
      reply_markup: {
        keyboard: [
          ['Посмотреть расписание', 'Полезные источники'],
          ['Посмотреть материалы', 'Изменить группу'],
          ['Наши ресурсы', 'Помощь']
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  for (const material of materials) {
    if (material.fileId) {
      bot.sendDocument(userId, material.fileId, { caption: `Описание: ${material.description || 'Нет описания'}` });
    } else {
      bot.sendMessage(userId, `Описание: ${material.description || 'Нет описания'}`);
    }
  }
});

// Обработчик команды "Полезные источники"
bot.onText(/Полезные источники/, (msg) => {
  const chatId = msg.chat.id;
  const message = `
<b>Вот несколько полезных источников для вашей учебы:</b>
1. <a href="https://htmlbook.ru/">HTMLBook — изучение HTML и CSS</a>
2. <a href="https://gitverse.ru/">Gitverse — платформа для работы с исходным кодом</a>
3. <a href="https://github.com/">GitHub — хостинг для совместной разработки</a>
4. <a href="https://habr.com/ru/articles/">Habr — статьи и обсуждения на темы IT</a>
`;

  bot.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      keyboard: [
        ['Посмотреть расписание', 'Полезные источники'],
        ['Посмотреть материалы', 'Изменить группу'],
        ['Наши ресурсы', 'Помощь']
      ],
      resize_keyboard: true
    }
  });
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendPhoto(chatId, 'https://iimg.su/s/19/hkFAzjwWh08fm2FBKUxsNuOReAY9C8Rng2t4UKk7.png', {
    caption: 'Добро пожаловать в бота Михайловского профессионально-педагогического колледжа имени В.В.Арнаутова! 🎓🤖\nЭтот бот предоставляет следующие возможности:\n1. Просмотр расписания и учебных материалов.\n2. Полезные источники обучения на вашей специальности.\n3. Важные объявления для учащихся колледжа.'
  });

  bot.sendMessage(chatId, 'Меню:', {
    reply_markup: {
      keyboard: [
        ['Посмотреть расписание', 'Полезные источники'],
        ['Посмотреть материалы', 'Изменить группу'],
        ['Наши ресурсы', 'Помощь']
      ],
      resize_keyboard: true
    }
  });
});

// Кнопка "Изменить группу"
bot.onText(/Изменить группу/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Выберите вашу новую группу:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '11Т', callback_data: '11Т_changeGroup' }],
        [{ text: '21Т', callback_data: '21Т_changeGroup' }],
        [{ text: '31Т', callback_data: '31Т_changeGroup' }]
      ]
    }
  });
});

bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;

  if (data.endsWith('_changeGroup')) {
    const newGroup = data.replace('_changeGroup', '');

    try {
      await User.findOneAndUpdate({ userId }, { group: newGroup }, { upsert: true });
      bot.sendMessage(chatId, `Ваша группа успешно изменена на ${newGroup}.`);
    } catch (error) {
      console.error('Ошибка при обновлении группы пользователя:', error);
      bot.sendMessage(chatId, "Произошла ошибка при изменении группы. Попробуйте еще раз.");
    }
  }

  if (data === 'back_to_menu') {
    bot.sendMessage(chatId, 'Меню:', {
      reply_markup: {
        keyboard: [
          ['Посмотреть расписание', 'Полезные источники'],
          ['Посмотреть материалы', 'Изменить группу'],
          ['Наши ресурсы', 'Помощь']
        ],
        resize_keyboard: true
      }
    });
  }

  if (data.startsWith('dnwmppk_group')) {
    targetGroup = data.split('_')[2];
    waitingForMaterial = true;

    bot.sendMessage(chatId, `Пожалуйста, отправьте материал для группы ${targetGroup}. Это может быть текстовое сообщение, документ или вложение.`);
  }
});

// Команда /announcements
bot.onText(/\/announcements/, async (msg) => {
  const announcements = await Announcement.find().sort({ date: -1 });

  if (announcements.length === 0) {
    bot.sendMessage(msg.chat.id, 'Объявлений нет.');
    return;
  }

  const announcementsList = announcements.map(announcement => `${announcement.date.toLocaleString()} - ${announcement.text}`).join('\n\n');
  bot.sendMessage(msg.chat.id, `Объявления:\n${announcementsList}`);
});

// Кнопка "Наши ресурсы"
bot.onText(/Наши ресурсы/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Наши ресурсы:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Официальный сайт', url: 'https://mihppk.ru/' }],
        [{ text: 'Группа ВКонтакте', url: 'https://vk.com/mih_ppk_professionalitet' }],
        [{ text: 'Навигаторы Детства', url: 'https://vk.com/mihppk_nd' }],
        [{ text: 'Назад', callback_data: 'back_to_menu' }]
      ]
    }
  });
});

// Кнопка "Помощь"
bot.onText(/Помощь/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Контакты для связи:\n\n📞 Телефон: +7 (84463) 4-28-45\n📧 Email: info@mihppk.ru\n🏢 Адрес: ул. Гоголя, д. 29, Михайлвока, Россия', {
    reply_markup: {
      keyboard: [
        ['Посмотреть расписание', 'Полезные источники'],
        ['Посмотреть материалы', 'Изменить группу'],
        ['Наши ресурсы', 'Помощь']
      ],
      resize_keyboard: true
    }
  });
});

// Обработчик команды /admin
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Введите ваше ФИО:');
  bot.once('message', (msg) => {
    const name = msg.text;
    bot.sendMessage(chatId, 'Введите пароль:');
    bot.once('message', (msg) => {
      const password = msg.text;
      if (name === 'Васильев Владимир Николаевич' && password === '1683') {
        adminMode = true;
        currentAdminChatId = chatId;
        bot.sendMessage(chatId, 'Добро пожаловать в админ-панель!', {
          reply_markup: {
            keyboard: [
              ['Добавить расписание', 'Добавить материал'],
              ['Добавить объявление', 'Редактировать расписание'],
              ['Просмотреть статистику', 'Очистить материалы'],
              ['Назад']
            ],
            resize_keyboard: true
          }
        });
      } else {
        bot.sendMessage(chatId, 'Неверное имя или пароль.');
      }
    });
  });
});

// Обработчик кнопки "Добавить расписание"
bot.onText(/Добавить расписание/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    bot.sendMessage(chatId, 'Введите расписание в формате: группа, день, время, предмет, местоположение.');
    bot.once('message', async (msg) => {
      const [group, day, time, subject, location] = msg.text.split(', ');
      const newSchedule = new Schedule({ group, day, time, subject, location });
      await newSchedule.save();
      bot.sendMessage(chatId, 'Расписание успешно добавлено.');
    });
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

// Обработчик кнопки "Добавить материал"
bot.onText(/Добавить материал/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    bot.sendMessage(chatId, 'Выберите группу для отправки материала:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '11Т', callback_data: 'dnwmppk_group_11T' }],
          [{ text: '21Т', callback_data: 'dnwmppk_group_21Т' }],
          [{ text: '31Т', callback_data: 'dnwmppk_group_31Т' }]
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

// Обработка выбора группы для добавления материала
bot.on('callback_query', (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;

  if (adminMode && chatId === currentAdminChatId) {
    if (data.startsWith('dnwmppk_group_')) {
      targetGroup = data.split('_')[2];
      bot.sendMessage(chatId, `Введите описание для материала для группы ${targetGroup}, или отправьте сам материал (текст, документ, изображение, видео):`);
      waitingForMaterial = true;
    } else if (data.startsWith('clear_group_')) {
      const targetGroup = data.split('_')[2];
      Material.deleteMany({ group: targetGroup }).then(() => {
        bot.sendMessage(chatId, `Материалы для группы ${targetGroup} успешно удалены.`);
      }).catch((err) => {
        bot.sendMessage(chatId, 'Произошла ошибка при удалении материалов.');
        console.error(err);
      });
    }
  }
});

// Обработка материалов, отправляемых админом
bot.on('message', async (msg) => {
  if (waitingForMaterial && adminMode && msg.chat.id === currentAdminChatId) {
    let materialData = {
      group: targetGroup,
      description: 'Нет описания'
    };

    if (msg.text) {
      materialData.type = 'text';
      materialData.title = 'Текстовый материал';
      materialData.description = msg.text;
    } else if (msg.document) {
      materialData.type = 'document';
      materialData.title = msg.document.file_name;
      materialData.fileId = msg.document.file_id;
    } else if (msg.photo) {
      materialData.type = 'photo';
      materialData.title = 'Фотография';
      materialData.fileId = msg.photo[msg.photo.length - 1].file_id; // Берем последнюю (самую большую) фотографию
    } else if (msg.video) {
      materialData.type = 'video';
      materialData.title = 'Видео';
      materialData.fileId = msg.video.file_id;
    } else {
      bot.sendMessage(msg.chat.id, 'Тип материала не поддерживается.');
      return;
    }

    const newMaterial = new Material(materialData);
    await newMaterial.save();

    const users = await User.find({ group: targetGroup });
    users.forEach(user => {
      if (materialData.type === 'text') {
        bot.sendMessage(user.userId, `${materialData.title}:\n${materialData.description}`);
      } else {
        bot.sendMessage(user.userId, `${materialData.title}:`);
        if (materialData.type === 'document') {
          bot.sendDocument(user.userId, materialData.fileId);
        } else if (materialData.type === 'photo') {
          bot.sendPhoto(user.userId, materialData.fileId);
        } else if (materialData.type === 'video') {
          bot.sendVideo(user.userId, materialData.fileId);
        }
      }
    });

    bot.sendMessage(currentAdminChatId, `Материал успешно отправлен группе ${targetGroup}.`);
    waitingForMaterial = false;
    targetGroup = null;
  }
});

// Обработчик кнопки "Посмотреть материалы"
bot.onText(/Посмотреть материалы/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ userId: chatId });
  if (!user || !user.group) {
    bot.sendMessage(chatId, 'Сначала установите вашу группу с помощью команды /group.');
    return;
  }

  const materials = await Material.find({ group: user.group }).sort({ date: -1 });

  if (materials.length === 0) {
    bot.sendMessage(chatId, 'Для вашей группы материалов нет.');
    return;
  }

  for (const material of materials) {
    if (material.type === 'text') {
      bot.sendMessage(chatId, `${material.title}:\n${material.description}`);
    } else {
      bot.sendMessage(chatId, `${material.title}:`);
      if (material.type === 'document') {
        bot.sendDocument(chatId, material.fileId);
      } else if (material.type === 'photo') {
        bot.sendPhoto(chatId, material.fileId);
      } else if (material.type === 'video') {
        bot.sendVideo(chatId, material.fileId);
      }
    }
  }
});

// Обработчик кнопки "Очистить материалы"
bot.onText(/Очистить материалы/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    bot.sendMessage(chatId, 'Выберите группу для удаления материалов:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '11Т', callback_data: 'clear_group_11T' }],
          [{ text: '21Т', callback_data: 'clear_group_21Т' }],
          [{ text: '31Т', callback_data: 'clear_group_31Т' }]
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

// Обработчик кнопки "Добавить объявление"
bot.onText(/Добавить объявление/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    bot.sendMessage(chatId, 'Введите текст объявления:');
    
    // Используем bot.on('message') с проверкой флага для ввода текста объявления
    const onMessageListener = (msg) => {
      if (msg.chat.id === chatId && adminMode) {
        const announcement = msg.text;
        if (!announcement) {
          bot.sendMessage(chatId, 'Текст объявления не может быть пустым.');
          return;
        }

        // Отправка объявления всем пользователям
        User.find({}).then(users => {
          users.forEach(user => {
            bot.sendMessage(user.userId, `📢 *Объявление* 📢\n\n${announcement}`, { parse_mode: 'Markdown' });
          });
        }).catch(err => {
          bot.sendMessage(chatId, 'Произошла ошибка при отправке объявления.');
          console.error(err);
        });

        bot.sendMessage(chatId, 'Объявление успешно отправлено всем пользователям.');

        // Убираем слушатель, чтобы предотвратить множественные вызовы
        bot.removeListener('message', onMessageListener);
      }
    };

    // Устанавливаем слушатель на ввод текста объявления
    bot.on('message', onMessageListener);
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

// Обработчик кнопки "Редактировать расписание"
bot.onText(/Редактировать расписание/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    bot.sendMessage(chatId, 'Введите параметры для поиска расписания в формате: группа, день.');
    bot.once('message', async (msg) => {
      const [group, day] = msg.text.split(', ');

      // Ищем расписание по заданной группе и дню
      const schedule = await Schedule.findOne({ group, day });
      if (!schedule) {
        bot.sendMessage(chatId, 'Расписание не найдено. Попробуйте снова.');
        return;
      }

      bot.sendMessage(chatId, `Текущее расписание: ${schedule.time}, ${schedule.subject}, ${schedule.location}\nВведите новое расписание в формате: время, предмет, местоположение.`);
      bot.once('message', async (msg) => {
        const [time, subject, location] = msg.text.split(', ');

        // Обновляем расписание
        schedule.time = time;
        schedule.subject = subject;
        schedule.location = location;
        await schedule.save();

        bot.sendMessage(chatId, 'Расписание успешно обновлено.');
      });
    });
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

// Обработчик кнопки "Назад"
bot.onText(/Назад/, (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    adminMode = false;
    currentAdminChatId = null;
    bot.sendMessage(chatId, 'Вы вышли из админ-панели.', {
      reply_markup: {
        keyboard: [
          ['Посмотреть расписание', 'Полезные источники'],
          ['Посмотреть материалы', 'Изменить группу'],
          ['Наши ресурсы', 'Помощь']
        ],
        resize_keyboard: true
      }
    });
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }

// Обработчик кнопки "Просмотреть статистику"
bot.onText(/Просмотреть статистику/, async (msg) => {
  const chatId = msg.chat.id;
  if (adminMode && chatId === currentAdminChatId) {
    try {
      const stats = await User.aggregate([
        { $group: { _id: "$group", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      let statsMessage = '📊 Статистика по группам:\n\n';
      stats.forEach(stat => {
        statsMessage += `Группа ${stat._id}: ${stat.count} участников\n`;
      });

      bot.sendMessage(chatId, statsMessage);
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при получении статистики.');
    }
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой функции.');
  }
});

});




