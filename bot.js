'use strict';

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const os = require('os');
const PptxGenJS = require('pptxgenjs');

const {
  parseUserMessage,
  generateSlidesPlan
} = require('./gemini');

const {
  buildDeck
} = require('./slideBuilder');

const {
  renderSlide
} = require('./htmlGen');

const {
  renderAllSlides,
  closeBrowser
} = require('./renderer');

const {
  getImagesForRequirements
} = require('./unsplash');

const {
  hasFreeAccess,
  useFree,
  usePaid,
  getUserStats,
  savePending,
  getPending,
  deletePending,
} = require('./db');

const {
  safeDelete,
  logError
} = require('./utils');

const bot = new TelegramBot(
  process.env.TELEGRAM_BOT_TOKEN,
  { polling: true }
);

// ─── Kaspi ────────────────────────────────────────────────────────────────

const KASPI_PHONE = process.env.KASPI_PHONE;
const KASPI_NAME = process.env.KASPI_NAME;
const PRICE_TENGE = Number(process.env.PRICE_TENGE) || 500;

// ─── Runtime state ────────────────────────────────────────────────────────

const processing = new Set();
const awaitingConfirm = new Map();

// ─── Status ───────────────────────────────────────────────────────────────

async function updateStatus(chatId, msgId, text) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'Markdown',
    });
  } catch (_) {}
}

// ─── Escape MarkdownV2 ────────────────────────────────────────────────────

function escMd(text) {
  return String(text || '')
    .replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

// ─── Gemini slide → new SlideModel input ──────────────────────────────────

function convertGeminiSlide(slide, index, parsed) {
  const content = Array.isArray(slide.content)
    ? slide.content
    : [];

  const topic = parsed.topic || slide.title || 'the subject';

  /*
   * New slideBuilder does not receive Gemini's layout decision.
   * It receives semantic context and decides the layout itself.
   */

  // ─── Semantic context for Layout Engine ───────────────────────────────
  const slideType = slide.type || 'content';

  const textAmount =
    content.length >= 5 ? 'long' :
    content.length >= 2 ? 'medium' :
    'short';

  let contentStructure;

  if (slideType === 'comparison') {
    contentStructure = 'comparison';
  } else if (slideType === 'data') {
    contentStructure = 'statistics';
  } else if (slideType === 'quote') {
    contentStructure = 'quote';
  } else if (slideType === 'end') {
    contentStructure = 'paragraph';
  } else if (content.length >= 4) {
    contentStructure = 'bullets';
  } else if (content.length >= 2) {
    contentStructure = 'mixed';
  } else {
    contentStructure = 'paragraph';
  }

  const imageQueries = slide.image_query
    ? [slide.image_query]
    : [];

  const imageCountAvailable = Math.min(imageQueries.length, 4);

  const slideContext = {
    slideType,
    textAmount,
    imageCountAvailable,
    preferredImageCount: imageCountAvailable,
    contentStructure,

    language: parsed.language,
    topic,
    subject: slide.title || topic,

    imageQueries,

    styleHint: slide.style_hint || null,
    mood: slide.mood || null,

    isImageImportant: imageCountAvailable > 0,
  };

  /*
   * Normalize content for CONTENT_FIELD_MAP.
   */

  const normalizedContent = {
    title: slide.title || `Слайд ${index + 1}`,

    subtitle: slide.subtitle || null,

    body: content.length
      ? content.join('\n')
      : null,

    body2: content[1] || null,

    label: null,
    label2: null,
    label3: null,

    statistic: null,

    quoteText: null,
    attribution: null,

    caption: slide.subtitle || null,

    title1: content[0] || null,
    title2: content[1] || null,
    title3: content[2] || null,

    body1: content[0] || null,
    body2_col: content[1] || null,
    body3: content[2] || null,
    body4: content[3] || null,

    titleLeft: null,
    titleRight: null,
    bodyLeft: null,
    bodyRight: null,

    stat1: null,
    stat2: null,

    topic,
    subject: slide.title || topic,

    imageQueries: slide.image_query
      ? [slide.image_query]
      : [],
  };

  return {
    content: normalizedContent,
    context: slideContext,
  };
}

// ─── New architecture → HTML ──────────────────────────────────────────────

async function buildHtmlList(deck) {
  const htmlList = [];
  const imageMaps = [];

  for (const model of deck) {
    const requirements = Array.isArray(model.imageRequirements)
      ? model.imageRequirements
      : [];

    const resolved = await getImagesForRequirements(requirements);

    const imageMap = {};

    // Pass 1: foreground zones — collect used image IDs to avoid reuse
    const usedIds = new Set();
    for (const item of resolved) {
      if (item.image && item.image.url && item.zone && !item.isBackground) {
        imageMap[item.zone] = item.image.url;
        usedIds.add(item.image.id);
        console.log(`[unsplash] ${item.zone}: ${item.image.id}`);
      }
    }

    // Pass 2: background zone — stored as imageMap.background
    for (const item of resolved) {
      if (item.isBackground && item.zone === 'background') {
        if (item.image && item.image.url) {
          if (usedIds.has(item.image.id)) {
            console.log(`[unsplash] background: candidate ${item.image.id} already used by foreground — still applying`);
          }
          imageMap.background = item.image.url;
          console.log(`[unsplash] background: ${item.image.id}`);
        } else {
          imageMap.background = null;
          console.log(`[unsplash] background: no image found — fallbackColor will be used`);
        }
      }
    }

    imageMaps.push(imageMap);
    htmlList.push(renderSlide(model, imageMap));
  }

  return {
    htmlList,
    imageMaps,
  };
}

// ─── PNG → PPTX ───────────────────────────────────────────────────────────

async function exportRenderedSlidesToPptx(
  slides,
  renderedList,
  outputPath
) {
  const pptx = new PptxGenJS();

  // 16:9
  pptx.layout = 'LAYOUT_WIDE';

  pptx.author = 'AI Presentation Bot';
  pptx.subject = 'AI Generated Presentation';
  pptx.title = slides[0]?.content?.title || 'Presentation';
  pptx.company = 'AI Presentation Bot';

  for (let i = 0; i < renderedList.length; i++) {
    const rendered = renderedList[i];

    if (!rendered || !rendered.imageBuffer) {
      throw new Error(`Слайд ${i + 1}: imageBuffer жоқ`);
    }

    const pptSlide = pptx.addSlide();

    pptSlide.addImage({
      data:
        `data:image/png;base64,` +
        rendered.imageBuffer.toString('base64'),

      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
    });
  }

  await pptx.writeFile({
    fileName: outputPath,
  });
}

// ─── Full new pipeline ────────────────────────────────────────────────────

async function createPresentation(
  chatId,
  userId,
  msgId,
  parsed,
  isFree
) {
  const {
    topic,
    slide_count,
    language,
    user_preferences
  } = parsed;

  let tmpFile = null;

  try {
    // 1. Gemini Art Director
    await updateStatus(
      chatId,
      msgId,
      `🎨 *1/5 — Art Director жұмыста...*\n` +
      `_Слайд жоспары жасалуда..._`
    );

    const rawSlides = await generateSlidesPlan(
      topic,
      slide_count,
      language,
      user_preferences
    );

    if (!Array.isArray(rawSlides) || !rawSlides.length) {
      throw new Error('Gemini слайд жоспарын қайтармады');
    }

    // 2. Semantic model → Layout engine
    await updateStatus(
      chatId,
      msgId,
      `🧩 *2/5 — Layout Engine...*\n` +
      `_${rawSlides.length} слайдқа layout таңдалуда..._`
    );

    const inputs = rawSlides.map((slide, index) =>
      convertGeminiSlide(slide, index, parsed)
    );

    console.log('[DEBUG inputs]', inputs.map((x, i) => ({
  slide: i + 1,
  hasContent: !!x.content,
  hasContext: !!x.context,
  slideType: x.context?.slideType,
  imageCountAvailable: x.context?.imageCountAvailable,
  imageQueries: x.context?.imageQueries,
  image_query: x.content?.imageQueries
})));

const deck = buildDeck(inputs);

    console.log(
      '[pipeline] layouts:',
      deck.map(s => s.layoutId).join(', ')
    );

    // 3. HTML
    await updateStatus(
      chatId,
      msgId,
      `🖌 *3/5 — HTML/CSS рендер...*\n` +
      `_${deck.length} SlideModel дайын_`
    );

    const {
      htmlList,
      imageMaps,
    } = await buildHtmlList(deck);

    console.log(
      '[pipeline] image maps:',
      imageMaps.map(m => Object.keys(m).length).join(', ')
    );

    // 4. Chromium
    await updateStatus(
      chatId,
      msgId,
      `📸 *4/5 — Chromium рендерлеуде...*\n` +
      `_Puppeteer PNG жасап жатыр..._`
    );

    const renderedList = await renderAllSlides(
      htmlList.map((html, i) => ({
        html,
        layout: deck[i].layoutId,
      }))
    );

    // 5. PPTX
    await updateStatus(
      chatId,
      msgId,
      `📦 *5/5 — PPTX жинауда...*`
    );

    tmpFile = path.join(
      os.tmpdir(),
      `pptx_${Date.now()}.pptx`
    );

    await exportRenderedSlidesToPptx(
      deck,
      renderedList,
      tmpFile
    );

    if (isFree) {
      useFree(userId);
    }

    const stats = getUserStats(userId);

    await bot.sendDocument(
      chatId,
      tmpFile,
      {
        caption:
          `🎨 *${escMd(topic)}*\n\n` +
          `🗂 ${deck.length} слайд\n` +
          `🎯 Layout Engine + Gemini Art Director\n` +
          `🎁 Тегін қалды: ${stats.freeLeft} / 2`,

        parse_mode: 'Markdown',
      }
    );

    await bot.deleteMessage(chatId, msgId);

  } catch (err) {
    logError('createPresentation', err);

    await updateStatus(
      chatId,
      msgId,
      `❌ *Қате:* \`${escMd(
        err.message?.slice(0, 150)
      )}\`\n\nҚайта жазып көріңіз.`
    );

  } finally {
    safeDelete(tmpFile);
  }
}

// ─── /start ───────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Досым';
  const stats = getUserStats(msg.from.id);

  bot.sendMessage(
    msg.chat.id,

    `👋 Сәлем, *${escMd(name)}*!\n\n` +
    `🎨 Маған кез келген тақырыпты жаз — кәсіби презентация жасаймын.\n\n` +

    `*Мысалдар:*\n` +
    `_Қазақ хандығы туралы 10 слайд, тарихи стиль_\n` +
    `_Жасанды интеллект, 8 слайд, қараңғы cinematic_\n` +
    `_Climate change presentation, 6 slides, minimal_\n\n` +

    `🎁 *Тегін:* ${stats.freeLeft} презентация қалды\n` +
    `💳 *Төлемді:* ${PRICE_TENGE}₸ (Kaspi Pay)`,

    { parse_mode: 'Markdown' }
  );
});

// ─── /stats ──────────────────────────────────────────────────────────────

bot.onText(/\/stats/, (msg) => {
  const stats = getUserStats(msg.from.id);

  bot.sendMessage(
    msg.chat.id,

    `📊 *Сіздің статистика:*\n\n` +
    `🎁 Тегін қалды: *${stats.freeLeft}* / 2\n` +
    `📊 Жалпы презентация: *${stats.totalPresentations}*\n` +
    `💳 Жұмсалған: *${stats.totalPaidTenge}₸*`,

    { parse_mode: 'Markdown' }
  );
});

// ─── /help ───────────────────────────────────────────────────────────────

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,

    `📖 *Қалай пайдалануға болады?*\n\n` +

    `Кәдімгі хабарлама жаз:\n\n` +

    `• _Ғарыш зерттеулері, 8 слайд_\n` +
    `• _Dark cinematic style, blockchain_\n` +
    `• _Ұлы Жібек жолы, тарихи стиль_\n\n` +

    `*Бот өзі анықтайды:*\n` +
    `✅ Тақырып\n` +
    `✅ Слайд саны\n` +
    `✅ Стиль және көңіл-күй\n` +
    `✅ Тіл\n` +
    `✅ Layout\n` +
    `✅ Image requirements\n\n` +

    `*Бағасы:*\n` +
    `🎁 Айына 2 тегін\n` +
    `💳 ${PRICE_TENGE}₸ = 1 презентация`,

    { parse_mode: 'Markdown' }
  );
});

// ─── /paid ───────────────────────────────────────────────────────────────

bot.onText(/\/paid/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const parsed = getPending(userId);

  if (!parsed) {
    bot.sendMessage(
      chatId,
      `❌ Белсенді тапсырыс жоқ. Алдымен тақырып жазыңыз.`
    );
    return;
  }

  if (awaitingConfirm.has(userId)) {
    clearTimeout(awaitingConfirm.get(userId));
    awaitingConfirm.delete(userId);
  }

  usePaid(userId, PRICE_TENGE);
  deletePending(userId);

  const statusMsg = await bot.sendMessage(
    chatId,
    `✅ *Төлем расталды!*\n\n` +
    `_Презентация жасалуда..._`,
    { parse_mode: 'Markdown' }
  );

  await createPresentation(
    chatId,
    userId,
    statusMsg.message_id,
    parsed,
    false
  );
});

// ─── Main message handler ─────────────────────────────────────────────────

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text.trim();

  if (!userMessage) return;

  if (processing.has(userId)) {
    bot.sendMessage(
      chatId,
      `⏳ Алдыңғы презентация жасалуда, күте тұрыңыз...`
    );
    return;
  }

  processing.add(userId);

  let statusMsg = null;

  try {
    // 1. Parse
    statusMsg = await bot.sendMessage(
      chatId,
      `🧠 *Түсінуде...*`,
      { parse_mode: 'Markdown' }
    );

    const parsed = await parseUserMessage(userMessage);

    const {
      topic,
      slide_count,
      language,
      user_preferences
    } = parsed;

    const langLabel =
      language === 'kazakh'
        ? '🇰🇿 Қазақша'
        : language === 'russian'
          ? '🇷🇺 Орысша'
          : '🇬🇧 English';

    // 2. Free / paid
    if (hasFreeAccess(userId)) {

      await updateStatus(
        chatId,
        statusMsg.message_id,

        `✅ *Түсіндім!*\n\n` +
        `📌 *Тақырып:* ${escMd(topic)}\n` +
        `🗂 *Слайд:* ${slide_count}\n` +
        `🌐 *Тіл:* ${langLabel}\n` +
        (user_preferences
          ? `💬 *Стиль:* ${escMd(user_preferences)}\n`
          : '') +
        `\n🎁 *Тегін презентация жасалуда...*`
      );

      await createPresentation(
        chatId,
        userId,
        statusMsg.message_id,
        parsed,
        true
      );

    } else {

      savePending(userId, parsed);

      await updateStatus(
        chatId,
        statusMsg.message_id,

        `✅ *Түсіндім!*\n\n` +
        `📌 *Тақырып:* ${escMd(topic)}\n` +
        `🗂 *Слайд:* ${slide_count}\n` +
        `🌐 *Тіл:* ${langLabel}\n\n` +

        `🎁 Тегін лимит таусылды.\n\n` +

        `💳 *Kaspi Pay арқылы төлеңіз:*\n` +
        `├ Нөмір: \`${KASPI_PHONE}\`\n` +
        `├ Аты: *${escMd(KASPI_NAME)}*\n` +
        `└ Сома: *${PRICE_TENGE}₸*\n\n` +

        `Төлегеннен кейін /paid деп жазыңыз ✅\n` +
        `_(30 минут ішінде растаңыз)_`
      );

      const handle = setTimeout(() => {

        deletePending(userId);
        awaitingConfirm.delete(userId);

        bot.sendMessage(
          chatId,
          `⏰ Төлем расталмады, тапсырыс жойылды. Қайта жазыңыз.`
        ).catch(() => {});

      }, 30 * 60 * 1000);

      awaitingConfirm.set(userId, handle);
    }

  } catch (err) {

    logError('bot:message', err);

    if (statusMsg) {
      await updateStatus(
        chatId,
        statusMsg.message_id,

        `❌ *Қате:* \`${escMd(
          err.message?.slice(0, 150)
        )}\`\n\nҚайта жазып көріңіз.`
      );
    }

  } finally {
    processing.delete(userId);
  }
});

// ─── Errors ───────────────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  logError('polling', err);
});

// ─── Shutdown ─────────────────────────────────────────────────────────────

async function shutdown() {
  try {
    await closeBrowser();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('🤖 Bot іске қосылды — NEW SLIDEMODEL PIPELINE');
