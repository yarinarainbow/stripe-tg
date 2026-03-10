const path = require('path');
const fs = require('fs');
const { Input } = require('telegraf');
const config = require('../config');

const PDF_PATH = path.join(__dirname, '..', '..', 'public', 'The Party Capsule.pdf');

/**
 * Generate single-use invite links and send them to the user.
 *
 * @param {import('telegraf').Telegram} telegram – bot.telegram instance
 * @param {number}  telegramId  – Telegram user ID to send links to
 * @param {string}  tariffKey   – "level1" | "level2" | "course"
 */
async function grantAccess(telegram, telegramId, tariffKey) {
  // ─── Course: send PDF ────────────────────────────────────
  if (tariffKey === 'course') {
    return sendCourse(telegram, telegramId);
  }

  // ─── Club: generate invite links ────────────────────────
  const chatMap = {
    level1: [
      { chatId: config.CHAT_ID_INFO, label: 'The Classy Club' },
    ],
    level2: [
      { chatId: config.CHAT_ID_INFO, label: 'The Classy Club' },
      { chatId: config.CHAT_ID_QUESTIONS, label: 'канал для вопросов и общения' },
    ],
  };

  const chats = chatMap[tariffKey];
  if (!chats) throw new Error(`Unknown tariff key: ${tariffKey}`);

  const links = [];

  for (const { chatId, label } of chats) {
    try {
      const invite = await telegram.createChatInviteLink(chatId, {
        member_limit: 1,
        name: `Invite for ${telegramId} – ${tariffKey}`,
      });
      links.push({ label, url: invite.invite_link });
    } catch (err) {
      console.error(
        `❌ Failed to create invite link for chat ${chatId}:`,
        err.message,
      );
      await telegram.sendMessage(
        telegramId,
        `⚠️ Не удалось создать приглашение для «${label}». ` +
          'Пожалуйста, обратитесь в поддержку.',
      );
    }
  }

  if (links.length === 0) return;

  let message = 'Спасибо за покупку 🤍\n\n';

  if (tariffKey === 'level1') {
    message += `Вот ссылка для входа в The Classy Club:\n${links[0].url}`;
  } else {
    const clubLink = links.find((l) => l.label === 'The Classy Club');
    const questionsLink = links.find((l) => l.label !== 'The Classy Club');
    if (clubLink) {
      message += `Вот ссылка для входа в The Classy Club:\n${clubLink.url}`;
    }
    if (questionsLink) {
      message += `\n\nСсылка на канал для вопросов и общения:\n${questionsLink.url}`;
    }
  }

  message += '\n\nСтарт клуба — 16 марта.';
  await telegram.sendMessage(telegramId, message);
}

/**
 * Send the PDF course to the user.
 */
async function sendCourse(telegram, telegramId) {
  if (!fs.existsSync(PDF_PATH)) {
    console.error('❌ PDF not found:', PDF_PATH);
    await telegram.sendMessage(
      telegramId,
      '⚠️ Произошла ошибка при отправке файла. Пожалуйста, обратитесь в поддержку.',
    );
    return;
  }

  await telegram.sendDocument(
    telegramId,
    Input.fromLocalFile(PDF_PATH),
    { caption: 'Спасибо за покупку 🤍\n\nВот ваш гайд The Party Capsule 💌' },
  );
}

module.exports = { grantAccess };
