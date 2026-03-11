const mongoose = require('mongoose');
const config = require('./config');
const bot = require('./bot');
const { createServer } = require('./server/webhook');

async function main() {
  // ─── 1. Connect to MongoDB ───────────────────────────────
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }

  // ─── 2. Start the Express webhook server ─────────────────
  // Start the webhook server FIRST so Railway sees a healthy app
  const app = createServer(bot);
  app.listen(config.PORT, () => {
    console.log(`🌐 Webhook server listening on port ${config.PORT}`);
    console.log(`   Stripe webhook URL: ${config.SERVER_URL}/webhook`);
  });

  // ─── 3. Launch the Telegram bot (long-polling) ───────────
  try {
    await bot.launch();
    console.log('🤖 Telegram bot started (polling)');
  } catch (err) {
    console.error('❌ bot.launch() failed:', err.message);
    console.error(err);
    // Don't exit — the webhook server is still running
    // and can process Stripe payments
  }

  // ─── Graceful shutdown ───────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down…`);
    bot.stop(signal);
    mongoose.connection.close();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
