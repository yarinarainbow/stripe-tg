const path = require('path');
const fs = require('fs');
const { Input } = require('telegraf');
const config = require('../config');

const PDF_PATH = path.join(__dirname, '..', '..', 'public', 'The Party Capsule.pdf');

/**
 * Try to add a user directly to a chat.
 * If the user is already a member, returns { added: true, alreadyMember: true }.
 * If added successfully, returns { added: true }.
 * If unable to add, falls back to creating a single-use invite link.
 *
 * @param {import('telegraf').Telegram} telegram
 * @param {string|number} chatId
 * @param {number} telegramId
 * @returns {Promise<{ added: boolean, alreadyMember?: boolean, inviteLink?: string|null }>}
 */
async function addUserToChat(telegram, chatId, telegramId) {
  // 1. Check if the user is already a member
  try {
    const member = await telegram.getChatMember(chatId, telegramId);
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      console.log(`ℹ️  User ${telegramId} is already a member of ${chatId}`);
      return { added: true, alreadyMember: true };
    }
  } catch (err) {
    // getChatMember can throw if user was never in the chat — that's fine
    console.log(`ℹ️  getChatMember for ${telegramId} in ${chatId}: ${err.message}`);
  }

  // 2. Try to unban (in case previously banned/left)
  try {
    await telegram.unbanChatMember(chatId, telegramId, { only_if_banned: true });
    console.log(`ℹ️  Unbanned user ${telegramId} in ${chatId} (only_if_banned)`);
  } catch (err) {
    console.log(`ℹ️  unbanChatMember for ${telegramId} in ${chatId}: ${err.message}`);
  }

  // 3. Try to approve a pending join request (if any)
  try {
    await telegram.approveChatJoinRequest(chatId, telegramId);
    console.log(`✅ Approved join request for ${telegramId} in ${chatId}`);
    return { added: true };
  } catch (err) {
    console.log(`ℹ️  approveChatJoinRequest for ${telegramId} in ${chatId}: ${err.message}`);
  }

  // 4. Check once more if the user is now a member (unban may have restored them)
  try {
    const member = await telegram.getChatMember(chatId, telegramId);
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      console.log(`✅ User ${telegramId} is now a member of ${chatId} after unban`);
      return { added: true };
    }
  } catch (err) {
    // ignore
  }

  // 5. Could not add directly → create a single-use invite link
  try {
    const invite = await telegram.createChatInviteLink(chatId, {
      member_limit: 1,
      name: `Invite for ${telegramId}`,
    });
    console.log(`🔗 Created single-use invite for ${telegramId} in ${chatId}`);
    return { added: false, inviteLink: invite.invite_link };
  } catch (err) {
    console.error(`❌ Failed to create invite link for ${chatId}:`, err.message);
    return { added: false, inviteLink: null };
  }
}

/**
 * Grant access to channels/chats after successful payment.
 *
 * @param {import('telegraf').Telegram} telegram – bot.telegram instance
 * @param {number}  telegramId  – Telegram user ID
 * @param {string}  tariffKey   – "level1" | "level2" | "course"
 */
async function grantAccess(telegram, telegramId, tariffKey) {
  // ─── Course: send PDF ────────────────────────────────────
  if (tariffKey === 'course') {
    return sendCourse(telegram, telegramId);
  }

  // ─── Club: add user to channels ──────────────────────────
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

  const results = [];

  for (const { chatId, label } of chats) {
    const result = await addUserToChat(telegram, chatId, telegramId);
    results.push({ label, ...result });
  }

  // ─── Build the message to send to the user ───────────────
  const addedDirectly = results.filter((r) => r.added);
  const withLinks = results.filter((r) => !r.added && r.inviteLink);
  const failed = results.filter((r) => !r.added && !r.inviteLink);

  let message = 'Спасибо за покупку 🤍\n\n';

  if (addedDirectly.length > 0) {
    const names = addedDirectly.map((r) => r.label).join(', ');
    message += `Вы добавлены в: ${names}\n\n`;
  }

  if (withLinks.length > 0) {
    message += 'Перейдите по одноразовой ссылке для входа:\n\n';
    for (const { label, inviteLink } of withLinks) {
      message += `${label}:\n${inviteLink}\n\n`;
    }
    message += '⚠️ Ссылка действует только один раз.\n\n';
  }

  if (failed.length > 0) {
    const names = failed.map((r) => r.label).join(', ');
    message += `⚠️ Не удалось создать приглашение для: ${names}. Пожалуйста, обратитесь в поддержку.\n\n`;
  }

  message += 'Старт клуба — 23 марта.';
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
