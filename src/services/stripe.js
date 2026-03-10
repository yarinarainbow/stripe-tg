const Stripe = require('stripe');
const config = require('../config');
const Order = require('../models/Order');

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

/**
 * Tariff definitions.
 * Each tariff maps to a price, label, and the chat IDs the user will receive.
 */
const TARIFFS = {
  level1: {
    name: 'Level 1',
    label: 'Level 1 — 25€',
    amount: config.PRICE_LEVEL1,
    chatIds: [config.CHAT_ID_INFO],
  },
  level2: {
    name: 'Level 2',
    label: 'Level 2 — 55€',
    amount: config.PRICE_LEVEL2,
    chatIds: [config.CHAT_ID_INFO, config.CHAT_ID_QUESTIONS],
  },
  course: {
    name: 'The Party Capsule',
    label: 'The Party Capsule — 15€',
    amount: config.PRICE_COURSE,
    chatIds: [],
  },
};

/**
 * Create a Stripe Checkout Session for the given tariff.
 *
 * @param {string}  tariffKey   – "level1" | "level2"
 * @param {number}  telegramId  – Telegram user ID (stored as client_reference_id)
 * @returns {Promise<string>}   – Checkout Session URL
 */
async function createCheckoutSession(tariffKey, telegramId) {
  const tariff = TARIFFS[tariffKey];
  if (!tariff) throw new Error(`Unknown tariff: ${tariffKey}`);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: String(telegramId),
    line_items: [
      {
        price_data: {
          currency: config.CURRENCY,
          product_data: {
            name: tariffKey === 'course'
              ? tariff.name
              : `The Classy Club — ${tariff.name}`,
            description: tariffKey === 'course'
              ? 'PDF-гайд The Party Capsule'
              : 'Доступ в закрытый клуб The Classy Club',
          },
          unit_amount: tariff.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tariff: tariffKey,
      telegramId: String(telegramId),
    },
    success_url: `${config.SERVER_URL}/success`,
    cancel_url: `${config.SERVER_URL}/cancel`,
  });

  // Persist a pending order
  await Order.create({
    telegramId,
    tariffName: tariffKey,
    stripeSessionId: session.id,
    amount: tariff.amount,
    currency: config.CURRENCY,
    status: 'pending',
  });

  return session.url;
}

module.exports = { stripe, TARIFFS, createCheckoutSession };
