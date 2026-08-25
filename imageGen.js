const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logError } = require("./utils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Gemini 2.0 Flash арқылы сурет генерациялау ──────────────────────────────
async function generateImage(imagePrompt) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a high-quality, photorealistic image for a professional presentation slide.
Style: cinematic, clean, modern, suitable for business presentation.
${imagePrompt}
Important: No text, no watermarks, no UI elements in the image.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["image", "text"],
      },
    });

    // Response-тен base64 суретті алу
    const parts = result.response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        return {
          success: true,
          data: part.inlineData.data,         // base64
          mimeType: part.inlineData.mimeType, // image/png немесе image/jpeg
        };
      }
    }

    // Сурет бөлігі табылмады
    logError("imageGen", new Error("Gemini суретті қайтармады"));
    return { success: false };

  } catch (err) {
    logError("imageGen", err);
    return { success: false };
  }
}

// ─── Base64 суретті pptxgenjs форматына дайындау ─────────────────────────────
function prepareImageData(base64, mimeType) {
  return `data:${mimeType};base64,${base64}`;
}

// ─── Слайд үшін сурет алу (fallback қоса) ────────────────────────────────────
async function getSlideImage(imagePrompt) {
  if (!imagePrompt) return { success: false };

  const result = await generateImage(imagePrompt);

  if (result.success) {
    return {
      success: true,
      imageData: prepareImageData(result.data, result.mimeType),
    };
  }

  // Сурет алынбады → fallback.js өңдейді
  return { success: false };
}

module.exports = {
  getSlideImage,
};
