const { Markup } = require('telegraf');

/**
 * Main menu – /start screen with all products.
 */
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✨ The Classy Club', 'menu_club')],
    // [Markup.button.callback('📄 The Party Capsule — 15€', 'tariff_course')],
  ]);
}

/**
 * Club tariff selection.
 */
function tariffKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Level 1 — 25€', 'tariff_level1')],
    [Markup.button.callback('Level 2 — 55€', 'tariff_level2')],
    [Markup.button.callback('← Назад', 'back_to_main')],
  ]);
}

/**
 * Inline keyboard with a Stripe payment URL button + back.
 *
 * @param {string} url      – Stripe Checkout Session URL
 * @param {string} backAction – callback_data for the back button
 */
function paymentKeyboard(url, backAction = 'back_to_club') {
  return Markup.inlineKeyboard([
    [Markup.button.url('Оплатить', url)],
    [Markup.button.callback('← Назад', backAction)],
  ]);
}

module.exports = { mainMenuKeyboard, tariffKeyboard, paymentKeyboard };
