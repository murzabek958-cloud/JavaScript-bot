require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const os = require("os");

const { parseUserMessage, generateSlidesPlan } = require("./gemini");
const { generateAllHTML } = require("./htmlGen");
const { renderAllSlides, closeBrowser } = require("./renderer");
const { buildPresentation } = require("./slideBuilder");
const { hasFreeAccess, useFree, usePaid, getUserStats } = require("./db");
const { safeDelete, logError } = require("./utils");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Төлем бағасы (Telegram Stars)
const PRICE_STARS = 50; // ~100₸

// Өңделіп жатқан пайдаланушылар
const processing = new Set();

// Күтудегі пайдаланушылар (төлемден кейін жасау үшін)
const pending = new Map(); // userId → parsedData

// ─── Статус жаңарту ───────────────────────────────────────────────────────────
async function updateStatus(chatId, msgId, text) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "Markdown",
    });
  } catch (_) {}
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "Досым";
  const stats = getUserStats(msg.from.id);

  bot.sendMessage(msg.chat.id,
    `👋 Сәлем, *${name}*!\n\n` +
    `🎨 Маған кез келген тақырыпты жаз — кәсіби презентация жасаймын.\n\n` +
    `*Мысалдар:*\n` +
    `_Қазақ хандығы туралы 10 слайд, тарихи стиль_\n` +
    `_Жасанды интеллект, 8 слайд, қараңғы cinematic_\n` +
    `_Climate change presentation, 6 slides, minimal_\n\n` +
    `🎁 *Тегін:* ${stats.freeLeft} презентация қалды\n` +
    `⭐ *Төлемді:* ${PRICE_STARS} Stars (~100₸)`,
    { parse_mode: "Markdown" }
  );
});

// ─── /stats ───────────────────────────────────────────────────────────────────
bot.onText(/\/stats/, (msg) => {
  const stats = getUserStats(msg.from.id);
  bot.sendMessage(msg.chat.id,
    `📊 *Сіздің статистика:*\n\n` +
    `🎁 Тегін қалды: *${stats.freeLeft}* / 2\n` +
    `📊 Жалпы презентация: *${stats.totalPresentations}*\n` +
    `⭐ Жұмсалған Stars: *${stats.totalPaid}*`,
    { parse_mode: "Markdown" }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *Қалай пайдалануға болады?*\n\n` +
    `Кәдімгі хабарлама жаз:\n\n` +
    `• _Ғарыш зерттеулері, 8 слайд_\n` +
    `• _Dark cinematic style, blockchain_\n` +
    `• _Ұлы Жібек жолы, тарихи стиль_\n\n` +
    `*Бот өзі анықтайды:*\n` +
    `✅ Тақырып\n` +
    `✅ Слайд саны (айтпасаң — 8)\n` +
    `✅ Стиль және көңіл-күй\n` +
    `✅ Тіл (қаз/орыс/ағыл)\n\n` +
    `*Бағасы:*\n` +
    `🎁 Айына 2 тегін\n` +
    `⭐ ${PRICE_STARS} Stars = 1 презентация`,
    { parse_mode: "Markdown" }
  );
});

// ─── НЕГІЗГІ ӨҢДЕУШІ ──────────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text.trim();

  if (processing.has(userId)) {
    bot.sendMessage(chatId, `⏳ Алдыңғы презентация жасалуда, күте тұрыңыз...`);
    return;
  }

  processing.add(userId);
  let statusMsg = null;

  try {
    // ── 1) Хабарламаны парсинг ─────────────────────────────────────────────
    statusMsg = await bot.sendMessage(chatId,
      `🧠 *Түсінуде...*`,
      { parse_mode: "Markdown" }
    );

    const parsed = await parseUserMessage(userMessage);
    const { topic, slide_count, language, user_preferences } = parsed;

    const langLabel = language === "kazakh" ? "🇰🇿 Қазақша"
      : language === "russian" ? "🇷🇺 Орысша" : "🇬🇧 English";

    // ── 2) Тегін лимит тексеру ─────────────────────────────────────────────
    if (hasFreeAccess(userId)) {
      await updateStatus(chatId, statusMsg.message_id,
        `✅ *Түсіндім!*\n\n` +
        `📌 *Тақырып:* ${topic}\n` +
        `🗂 *Слайд:* ${slide_count}\n` +
        `🌐 *Тіл:* ${langLabel}\n` +
        (user_preferences ? `💬 *Стиль:* ${user_preferences}\n` : "") +
        `\n🎁 *Тегін презентация жасалуда...*`
      );

      await createPresentation(chatId, userId, statusMsg.message_id, parsed, true);

    } else {
      // ── Төлем сұрату ──────────────────────────────────────────────────────
      pending.set(userId, parsed);

      await updateStatus(chatId, statusMsg.message_id,
        `✅ *Түсіндім!*\n\n` +
        `📌 *Тақырып:* ${topic}\n` +
        `🗂 *Слайд:* ${slide_count}\n` +
        `🌐 *Тіл:* ${langLabel}\n\n` +
        `🎁 Тегін лимит таусылды.\n` +
        `⭐ Төлем: *${PRICE_STARS} Stars* (~100₸)`
      );

      await bot.sendInvoice(
        chatId,
        `🎨 Презентация: ${topic}`,
        `${slide_count} слайд · кәсіби дизайн · 2 минутта дайын`,
        `pptx_${userId}_${Date.now()}`,
        "",
        "XTR",
        [{ label: "1 презентация", amount: PRICE_STARS }]
      );
    }

  } catch (err) {
    logError("bot:message", err);
    if (statusMsg) {
      await updateStatus(chatId, statusMsg.message_id,
        `❌ *Қате:* \`${err.message?.slice(0, 150)}\`\n\nҚайта жазып көріңіз.`
      );
    }
  } finally {
    processing.delete(userId);
  }
});

// ─── ТӨЛЕМ РАСТАУ ─────────────────────────────────────────────────────────────
bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on("successful_payment", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const stars  = msg.successful_payment.total_amount;

  const parsed = pending.get(userId);
  pending.delete(userId);

  if (!parsed) {
    bot.sendMessage(chatId, `✅ Төлем қабылданды! Хабарлама жазыңыз.`);
    return;
  }

  usePaid(userId, stars);

  const statusMsg = await bot.sendMessage(chatId,
    `⭐ *Төлем қабылданды!*\n\n_Презентация жасалуда..._`,
    { parse_mode: "Markdown" }
  );

  await createPresentation(chatId, userId, statusMsg.message_id, parsed, false);
});

// ─── ПРЕЗЕНТАЦИЯ ЖАСАУ ────────────────────────────────────────────────────────
async function createPresentation(chatId, userId, msgId, parsed, isFree) {
  const { topic, slide_count, language, user_preferences } = parsed;
  let tmpFile = null;

  try {
    // 1) Слайд жоспары
    await updateStatus(chatId, msgId,
      `🎨 *1/4 — Art Director жұмыста...*\n_Слайд жоспары жасалуда..._`
    );
    const slides = await generateSlidesPlan(topic, slide_count, language, user_preferences);

    // 2) HTML фондар
    await updateStatus(chatId, msgId,
      `🖌 *2/4 — Дизайн жасалуда...*\n_${slides.length} слайдқа HTML/CSS фон..._`
    );
    const htmlList = await generateAllHTML(slides);

    // 3) Скриншоттар
    await updateStatus(chatId, msgId,
      `📸 *3/4 — Рендерлеуде...*\n_Puppeteer скриншот алуда..._`
    );
    const renderedList = await renderAllSlides(htmlList);

    // 4) PPTX жинау
    await updateStatus(chatId, msgId,
      `📦 *4/4 — PPTX жинауда...*`
    );
    tmpFile = path.join(os.tmpdir(), `pptx_${Date.now()}.pptx`);
    await buildPresentation(slides, renderedList, tmpFile);

    // 5) Жіберу
    if (isFree) useFree(userId);
    const stats = getUserStats(userId);

    await bot.sendDocument(chatId, tmpFile, {
      caption:
        `🎨 *${escMd(topic)}*\n\n` +
        `🗂 ${slides.length} слайд\n` +
        `🤖 Gemini Art Director\n\n` +
        `🎁 Тегін қалды: ${stats.freeLeft} / 2`,
      parse_mode: "Markdown",
    });

    await bot.deleteMessage(chatId, msgId);

  } catch (err) {
    logError("createPresentation", err);
    await updateStatus(chatId, msgId,
      `❌ *Қате:* \`${err.message?.slice(0, 150)}\`\n\nҚайта жазып көріңіз.`
    );
  } finally {
    safeDelete(tmpFile);
  }
}

// ─── Polling қателері ─────────────────────────────────────────────────────────
bot.on("polling_error", (err) => logError("polling", err));

// ─── Процесс жабылғанда браузерді жабу ───────────────────────────────────────
process.on("SIGINT",  async () => { await closeBrowser(); process.exit(0); });
process.on("SIGTERM", async () => { await closeBrowser(); process.exit(0); });

// ─── MarkdownV2 экрандау ──────────────────────────────────────────────────────
function escMd(text) {
  return (text || "").replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

console.log("🤖 Бот іске қосылды!");
