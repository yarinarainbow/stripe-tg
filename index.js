import TelegramBot from "node-telegram-bot-api";
import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pdfPath = path.join(__dirname, "pdf/The Party Capsule.pdf");

console.log("🚀 Telegram-бот і сервер стартують...");
console.log("✅ SERVER_URL:", process.env.SERVER_URL);
console.log("✅ STRIPE_WEBHOOK_SECRET:", process.env.STRIPE_WEBHOOK_SECRET ? "OK" : "❌ Відсутній!");
console.log("✅ STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "OK" : "❌ Відсутній!");
console.log("✅ TELEGRAM_TOKEN:", process.env.TELEGRAM_TOKEN ? "OK" : "❌ Відсутній!");
console.log("📄 PDF шлях:", pdfPath);
console.log("================================");

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  console.log("📩 Отримано виклик /webhook");

  const sig = req.headers["stripe-signature"];
  console.log("🔑 Stripe-Signature:", sig ? "Отримано" : "❌ Відсутній");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ Stripe webhook підпис перевірено!");
  } catch (err) {
    console.error("❌ ПОМИЛКА ПІДПИСУ Stripe webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("📦 Отримано подію:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const chatId = session.metadata?.chatId;

    console.log("💰 Оплата успішна!");
    console.log("🧠 chatId з metadata:", chatId);
    console.log("📧 Email покупця:", session.customer_details?.email || "—");
    console.log("💵 Сума:", session.amount_total / 100, session.currency.toUpperCase());
    console.log("📂 Шлях до PDF:", pdfPath);

    // Спробуємо отримати chatId з metadata або з URL
    let finalChatId = chatId;
    
    if (!chatId) {
      console.error("❌ Відсутній chatId у metadata!");
      console.log("🔍 Вся metadata:", JSON.stringify(session.metadata, null, 2));
      console.log("🔍 Шукаємо chatId в URL...");
      const successUrl = session.success_url || "";
      try {
        const urlParams = new URL(successUrl).searchParams;
        finalChatId = urlParams.get("chatId");
        console.log("🔍 chatId з URL:", finalChatId);
      } catch (e) {
        console.error("❌ Помилка парсингу URL:", e.message);
      }
    }
    
    if (!finalChatId) {
      console.error("❌ Не вдалося знайти chatId!");
      return res.sendStatus(200);
    }
    
    console.log("✅ Використовуємо chatId:", finalChatId);

    if (!fs.existsSync(pdfPath)) {
      console.error("❌ Файл PDF не знайдено за шляхом:", pdfPath);
      console.log("📁 Поточна директорія:", __dirname);
      console.log("📁 Вміст директорії:", fs.readdirSync(__dirname));
      return res.sendStatus(200);
    }

    console.log("📤 Надсилаємо PDF користувачу...");
    console.log("📤 chatId:", finalChatId);
    
    bot
      .sendDocument(finalChatId, pdfPath, {
        caption: "✅ Дякую за оплату! 💌\nОсь твій The Party Capsule",
      })
      .then(() => console.log("🎉 PDF успішно надіслано користувачу!"))
      .catch((err) => {
        console.error("❌ Помилка надсилання PDF:", err);
        console.error("❌ Деталі помилки:", JSON.stringify(err, null, 2));
      });
    } else {
      console.log("⚠️ Інший тип події:", event.type);
    }

  res.sendStatus(200);
});

app.use(express.json());

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`👤 Новий користувач: ${chatId} (${msg.from?.username || "no username"})`);

  const amount = parseInt(process.env.PAYMENT_AMOUNT) || 5000; // в центах/копійках

  try {
    console.log("🛠 Створюємо Stripe checkout сесію...");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "The Party Capsule",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.SERVER_URL}/success?chatId=${chatId}`,
      cancel_url: `${process.env.SERVER_URL}/cancel`,
      metadata: { chatId: String(chatId) },
    });

    console.log("✅ Сесію створено успішно!");
    console.log("🔗 Посилання на оплату:", session.url);

    await bot.sendMessage(
      chatId,
      `Привіт 👋\nНатисни кнопку нижче, щоб оплатити «The Party Capsule». Після оплати я надішлю PDF-файл прямо сюди в чат 💌`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💳 Оплатити",
                url: session.url,
              },
            ],
          ],
        },
      }
    );
  } catch (err) {
    console.error("❌ Помилка створення Stripe сесії:", err);
    await bot.sendMessage(chatId, "⚠️ Помилка при створенні платежу, спробуйте пізніше.");
  }
});

app.get("/success", (req, res) => {
  console.log("✅ success_url відкрито користувачем");
  res.send("✅ Оплата пройшла успішно! Можете закрити сторінку і повернутись у Telegram.");
});

app.get("/cancel", (req, res) => {
  console.log("❌ cancel_url відкрито користувачем");
  res.send("❌ Оплату скасовано. Ви можете спробувати ще раз у Telegram.");
});

app.get("/test-pdf", (req, res) => {
  res.send({
    pdfPath: pdfPath,
    exists: fs.existsSync(pdfPath),
    dir: __dirname,
    files: fs.readdirSync(__dirname).join(", "),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Сервер запущено на порту ${PORT}`);
  console.log(`🌐 Webhook endpoint: ${process.env.SERVER_URL}/webhook`);
});
