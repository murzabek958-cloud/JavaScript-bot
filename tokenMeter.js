let total = 0;
let requests = 0;

function record(result, label = "Gemini") {
  const usage = result?.response?.usageMetadata;

  if (!usage) {
    console.log(`[TOKEN] ${label}: usageMetadata жоқ`);
    return;
  }

  const prompt = usage.promptTokenCount || 0;
  const output = usage.candidatesTokenCount || 0;
  const thoughts = usage.thoughtsTokenCount || 0;
  const tokens = usage.totalTokenCount || (prompt + output + thoughts);

  requests++;
  total += tokens;

  console.log(
    `[TOKEN] ${label}: ` +
    `prompt=${prompt} | output=${output} | thoughts=${thoughts} | ` +
    `total=${tokens} | SESSION=${total}`
  );
}

function getStats() {
  return { total, requests };
}

function reset() {
  total = 0;
  requests = 0;
}

module.exports = {
  record,
  getStats,
  reset
};
