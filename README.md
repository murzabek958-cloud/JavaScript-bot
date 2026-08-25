# 🤖 Telegram PowerPoint Bot

Gemini AI арқылы бірегей презентация жасайтын Telegram боты.

## ⚡ Іске қосу — 4 қадам

### 1. Орнату
```bash
npm install
```

### 2. API кілттерін алу

**Telegram Token:**
1. [@BotFather](https://t.me/BotFather) → `/newbot` → Token алыңыз

**Gemini API Key (тегін):**
1. [aistudio.google.com](https://aistudio.google.com) → Get API Key

### 3. .env файлын жасау
```bash
cp .env.example .env
# .env ішіне кілттерді қойыңыз
```

### 4. Іске қосу
```bash
node bot.js
```

## 📌 Пайдалану

```
/present <тақырып> <слайд саны>
```

**Мысалдар:**
```
/present Жасанды интеллект 10
/present Climate Change 8
/present Машинное обучение 6
```

## 🏗 Архитектура

```
bot.js          — Telegram команда өңдеуші
gemini.js       — Контент + композиция жоспарлаушы
imageGen.js     — Gemini 2.0 сурет генераторы
fallback.js     — Геометриялық визуал (сурет жоқ болса)
slideBuilder.js — pptxgenjs слайд салушы
layouts.js      — Макет схемалары + түс палитралары
utils.js        — Көмекші функциялар
```

## ✨ Ерекшеліктер

- 🎨 Әр презентация бірегей — 8+ макет, 8 палитра
- 🖼 Gemini 2.0 сурет генерациясы
- 🛡 Сурет сәтсіз → геометриялық визуал (бот тоқтамайды)
- 🌐 Қазақша / Орысша / Ағылшынша автоанықтау
