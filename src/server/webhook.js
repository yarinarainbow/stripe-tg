const express = require('express');
const config = require('../config');
const { stripe } = require('../services/stripe');
const { grantAccess } = require('../services/access');
const Order = require('../models/Order');

/**
 * Create and configure the Express app that handles Stripe webhooks.
 *
 * @param {import('telegraf').Telegraf} bot – Telegraf bot instance
 * @returns {import('express').Express}
 */
function createServer(bot) {
  const app = express();

  // ─── Request logging (debug) ─────────────────────────────
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.url}`);
    next();
  });

  // ─── Stripe Webhook ──────────────────────────────────────
  // IMPORTANT: The webhook route MUST use raw body parsing.
  // Do NOT apply express.json() globally before this route.
  app.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];

      let event;

      // 1. Verify webhook signature
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          config.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        console.error('⚠️  Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // 2. Handle the event
      console.log(`📩 Stripe event received: ${event.type}`);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const telegramId = Number(session.client_reference_id);
        const tariffKey = session.metadata?.tariff;

        if (!telegramId || !tariffKey) {
          console.error('⚠️  Missing telegramId or tariff in session:', session.id);
          return res.status(400).send('Missing metadata');
        }

        console.log(
          `✅ Payment completed – tgId: ${telegramId}, tariff: ${tariffKey}, session: ${session.id}`,
        );

        try {
          // 3. Mark order as completed
          await Order.findOneAndUpdate(
            { stripeSessionId: session.id },
            { status: 'completed' },
          );

          // 4. Grant access (generate invite links & message the user)
          await grantAccess(bot.telegram, telegramId, tariffKey);
        } catch (err) {
          console.error('❌ Post-payment processing error:', err);
        }
      }

      // Acknowledge receipt of the event
      res.json({ received: true });
    },
  );

  // ─── Utility routes ──────────────────────────────────────
  // These are the success/cancel redirect URLs from Stripe Checkout.
  app.get('/success', (_req, res) => {
    res.send(
      '<h1>✅ Спасибо за оплату!</h1><p>Вернитесь в Telegram-бот — там вас ждут ссылки.</p>',
    );
  });

  app.get('/cancel', (_req, res) => {
    res.send(
      '<h1>❌ Оплата отменена</h1><p>Вы можете вернуться в бот и попробовать ещё раз.</p>',
    );
  });

  // Simple health-check
  app.get('/', (_req, res) => {
    res.send('ya-sell-bot webhook server is running 🚀');
  });

  return app;
}

module.exports = { createServer };
