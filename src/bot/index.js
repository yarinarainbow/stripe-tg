const path = require('path');
const fs = require('fs');
const { Telegraf, Input } = require('telegraf');
const config = require('../config');
const User = require('../models/User');
const { createCheckoutSession, TARIFFS } = require('../services/stripe');
const { mainMenuKeyboard, tariffKeyboard, paymentKeyboard } = require('./keyboards');

const bot = new Telegraf(config.BOT_TOKEN);

// ─── Paths to local images in /public ────────────────────
const IMG_DIR = path.join(__dirname, '..', '..', 'public');
const IMG_START  = path.join(IMG_DIR, 'start.JPG');
const IMG_LEVEL1 = path.join(IMG_DIR, 'level1.JPG');
const IMG_LEVEL2 = path.join(IMG_DIR, 'level2.JPG');
// Use a course image if it exists, otherwise fall back to start image
const IMG_COURSE = fs.existsSync(path.join(IMG_DIR, 'course.JPG'))
  ? path.join(IMG_DIR, 'course.JPG')
  : IMG_START;

// ─── Texts ───────────────────────────────────────────────

const MAIN_GREETING =
  'Добро пожаловать! 🤍\n\n' +
  'Здесь вы можете приобрести доступ к закрытому клубу или PDF-гайд.\n\n' +
  'Выберите продукт ниже 👇';

const CLUB_GREETING =
  '✨ The Classy Club\n\n' +
  'закрытое пространство современной классики и продуманного гардероба\n\n' +
  'Клуб длится 1 месяц.\n' +
  'В течение этого времени внутри вас ждёт:\n\n' +
  '• 3–4 материала в неделю\n' +
  '• готовые весенние образы\n' +
  '• стилизация и цветовые сочетания\n' +
  '• подборки европейских и украинских брендов\n' +
  '• 6–8 обзоров актуальных коллекций\n\n' +
  '📍 Старт — 23 марта\n' +
  '⏳ Вход закрывается — 22 марта\n\n' +
  'Выберите формат участия ниже 👇';

const TARIFF_TEXT = {
  level1:
    '✨ Level 1\n\n' +
    'Самостоятельный формат.\n\n' +
    'Включает:\n\n' +
    '• полный доступ к закрытому каналу\n' +
    '• все материалы сезона\n' +
    '• обзоры брендов\n' +
    '• подборки и стилизации\n' +
    '• формулы образов\n\n' +
    'Формат самостоятельной работы\n' +
    'без личной обратной связи.\n\n' +
    'Стоимость — 25€',

  level2:
    '✨ Level 2\n\n' +
    'Формат с поддержкой.\n\n' +
    'Включает всё из Level 1 +\n\n' +
    '• доступ к закрытому чату\n' +
    '• возможность задавать вопросы\n' +
    '• мои ответы в течение сезона\n\n' +
    'Стоимость — 55€',

  course:
    '📄 The Party Capsule\n\n' +
    'PDF-гайд по созданию капсульного гардероба для вечеринок и мероприятий.\n\n' +
    'После оплаты файл придёт прямо сюда в чат 💌\n\n' +
    'Стоимость — 15€',
};

// ─── /start ──────────────────────────────────────────────
bot.start(async (ctx) => {
  try {
    await User.findOneAndUpdate(
      { telegramId: ctx.from.id },
      {
        telegramId: ctx.from.id,
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || null,
      },
      { upsert: true, new: true },
    );

    await ctx.replyWithPhoto(Input.fromLocalFile(IMG_START), {
      caption: MAIN_GREETING,
      ...mainMenuKeyboard(),
    });
  } catch (err) {
    console.error('❌ /start error:', err);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// ─── Main menu → Club ────────────────────────────────────
bot.action('menu_club', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: Input.fromLocalFile(IMG_START),
        caption: CLUB_GREETING,
      },
      tariffKeyboard(),
    );
  } catch (err) {
    console.error('❌ menu_club error:', err);
  }
});

// ─── Tariff selection (Level 1 / Level 2 / Course) ──────
bot.action(/^tariff_(level1|level2|course)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tariffKey = ctx.match[1];

    const paymentUrl = await createCheckoutSession(tariffKey, ctx.from.id);

    let imgPath;
    let backAction;

    if (tariffKey === 'level1') {
      imgPath = IMG_LEVEL1;
      backAction = 'back_to_club';
    } else if (tariffKey === 'level2') {
      imgPath = IMG_LEVEL2;
      backAction = 'back_to_club';
    } else {
      imgPath = IMG_COURSE;
      backAction = 'back_to_main';
    }

    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: Input.fromLocalFile(imgPath),
        caption: TARIFF_TEXT[tariffKey],
      },
      paymentKeyboard(paymentUrl, backAction),
    );
  } catch (err) {
    console.error('❌ Tariff callback error:', err);
    await ctx.reply('Не удалось создать ссылку для оплаты. Попробуйте ещё раз /start.');
  }
});

// ─── Back → Main menu ────────────────────────────────────
bot.action('back_to_main', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: Input.fromLocalFile(IMG_START),
        caption: MAIN_GREETING,
      },
      mainMenuKeyboard(),
    );
  } catch (err) {
    console.error('❌ back_to_main error:', err);
    await ctx.reply('Произошла ошибка. Попробуйте /start.');
  }
});

// ─── Back → Club tariffs ─────────────────────────────────
bot.action('back_to_club', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: Input.fromLocalFile(IMG_START),
        caption: CLUB_GREETING,
      },
      tariffKeyboard(),
    );
  } catch (err) {
    console.error('❌ back_to_club error:', err);
    await ctx.reply('Произошла ошибка. Попробуйте /start.');
  }
});

module.exports = bot;
