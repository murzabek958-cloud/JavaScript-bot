require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const os = require("os");

const { generatePresentation } = require("./gemini");
const { buildPresentation } = require("./slideBuilder");
const { detectLanguage, clampSlideCount, safeDelete, logError } = require("./utils");

// ─── Инициализация ────────────────────────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// ─── Прогресс хабарламасын жаңарту ───────────────────────────────────────────
async function updateStatus(chatId, msgId, text) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "Markdown",
    });
  } catch (_) {
    // Хабарлама өзгермесе Telegram қате береді — елемейміз
  }
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "Пайдаланушы";
  bot.sendMessage(
    msg.chat.id,
    `👋 Сәлем, *${name}*\\!\n\n` +
    `🎨 Мен кез келген тақырыпта бірегей *PowerPoint презентация* жасаймын\\.\n\n` +
    `Әр презентация — әртүрлі композиция, түс палитрасы және макет\\.\n\n` +
    `📌 *Пайдалану:*\n` +
    `/present тақырып саны\n\n` +
    `📝 *Мысалдар:*\n` +
    `/present Жасанды интеллект 10\n` +
    `/present Climate Change 8\n` +
    `/present Машинное обучение 7\n\n` +
    `ℹ️ Слайд саны: 5\\-тен 20\\-ға дейін`,
    { parse_mode: "MarkdownV2" }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📖 *Командалар:*\n\n` +
    `/start — Ботты іске қосу\n` +
    `/present <тақырып> <слайд саны> — Презентация жасау\n` +
    `/help — Көмек\n\n` +
    `💡 *Ерекшеліктер:*\n` +
    `• Тілді автоматты анықтайды\n` +
    `• Gemini AI сурет генерациялайды\n` +
    `• Сурет сәтсіз болса — геометриялық визуал\n` +
    `• Әр жолы бірегей композиция`,
    { parse_mode: "Markdown" }
  );
});

// ─── /present ─────────────────────────────────────────────────────────────────
bot.onText(/\/present (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();

  // Тақырып + слайд санын бөлу
  const parts = input.match(/^(.*?)\s+(\d+)$/);
  let topic, slideCount;

  if (parts) {
    topic = parts[1].trim();
    slideCount = clampSlideCount(parts[2]);
  } else {
    topic = input;
    slideCount = 8;
  }

  const lang = detectLanguage(topic);
  const langLabel = lang === "kazakh" ? "🇰🇿 Қазақша" : lang === "russian" ? "🇷🇺 Орысша" : "🇬🇧 English";

  // Бастапқы статус хабарламасы
  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ *Дайындалуда...*\n\n` +
    `📌 *Тақырып:* ${topic}\n` +
    `🗂 *Слайд саны:* ${slideCount}\n` +
    `🌐 *Тіл:* ${langLabel}\n\n` +
    `_1/3 — Gemini композиция жасауда..._`,
    { parse_mode: "Markdown" }
  );

  const msgId = statusMsg.message_id;
  let tmpFile = null;

  try {
    // ── 1-қадам: Gemini контент + композиция ─────────────────────────────
    const presentationData = await generatePresentation(topic, slideCount, lang);

    // ── 2-қадам: Слайдтарды салу ──────────────────────────────────────────
    await updateStatus(chatId, msgId,
      `⏳ *Дайындалуда...*\n\n` +
      `📌 *Тақырып:* ${topic}\n\n` +
      `_2/3 — Слайдтар мен суреттер жасалуда..._\n` +
      `_(бұл 30\\-60 секунд алуы мүмкін)_`
    );

    tmpFile = path.join(os.tmpdir(), `pptx_${Date.now()}.pptx`);
    await buildPresentation(presentationData, tmpFile);

    // ── 3-қадам: Файл жіберу ──────────────────────────────────────────────
    await updateStatus(chatId, msgId,
      `✅ *Дайын\\!*\n\n📎 _Файл жіберілуде..._`
    );

    const caption =
      `🎨 *${escapeMarkdown(presentationData.presentation_title)}*\n\n` +
      `🗂 ${presentationData.slides.length} слайд\n` +
      `🎨 Палитра: \`${presentationData.palette}\`\n` +
      `🤖 Gemini AI генерациялады`;

    await bot.sendDocument(chatId, tmpFile, {
      caption,
      parse_mode: "Markdown",
    });

    await bot.deleteMessage(chatId, msgId);

  } catch (err) {
    logError("bot:/present", err);

    // Қандай қате болса да — хабарлама жіберіледі
    await updateStatus(chatId, msgId,
      `❌ *Қате орын алды*\n\n` +
      `\`${err.message?.slice(0, 200)}\`\n\n` +
      `Қайта көріңіз немесе тақырыпты өзгертіп байқаңыз.`
    );
  } finally {
    // Уақытша файлды қауіпсіз өшіру
    safeDelete(tmpFile);
  }
});

// ─── Белгісіз хабарламалар ────────────────────────────────────────────────────
bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(
      msg.chat.id,
      `💡 Презентация жасау үшін:\n\n` +
      `/present <тақырып> <слайд саны>\n\n` +
      `Мысалы:\n/present Жасанды интеллект 8`
    );
  }
});

// ─── Polling қателерін өңдеу ──────────────────────────────────────────────────
bot.on("polling_error", (err) => {
  logError("polling", err);
});

// ─── MarkdownV2 үшін экрандау ─────────────────────────────────────────────────
function escapeMarkdown(text) {
  return (text || "").replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

console.log("🤖 Бот іске қосылды! /present командасын күтуде...");
