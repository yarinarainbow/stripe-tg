require('dotenv').config();

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
};

module.exports = {
  // Telegram
  BOT_TOKEN: required('BOT_TOKEN'),
  CHAT_ID_INFO: required('CHAT_ID_INFO'),
  CHAT_ID_QUESTIONS: required('CHAT_ID_QUESTIONS'),

  // Stripe
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),
  PRICE_LEVEL1: Number(process.env.PRICE_LEVEL1) || 2500,  // 25.00 EUR in cents
  PRICE_LEVEL2: Number(process.env.PRICE_LEVEL2) || 5500,  // 55.00 EUR in cents
  PRICE_COURSE: Number(process.env.PRICE_COURSE) || 1500,  // 15.00 EUR in cents
  CURRENCY: process.env.CURRENCY || 'eur',

  // MongoDB
  MONGO_URI: required('MONGO_URI'),

  // Server
  PORT: Number(process.env.PORT) || 3000,
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
};
