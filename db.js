const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "users.json");

// ─── Базаны жүктеу ────────────────────────────────────────────────────────────
function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return {};
  }
}

// ─── Базаны сақтау ────────────────────────────────────────────────────────────
function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("[db] Сақтау қатесі:", err.message);
  }
}

// ─── Пайдаланушы алу / жасау ─────────────────────────────────────────────────
function getUser(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = {
      id: userId,
      free_used: 0,
      free_limit: 2,
      total_presentations: 0,
      total_paid: 0,
      created_at: new Date().toISOString(),
      last_reset: getCurrentMonth(),
    };
    saveDB(db);
  }

  const user = db[userId];

  // Ай басында тегін лимитті қайтарамыз
  if (user.last_reset !== getCurrentMonth()) {
    user.free_used = 0;
    user.last_reset = getCurrentMonth();
    db[userId] = user;
    saveDB(db);
  }

  return user;
}

// ─── Тегін лимит тексеру ──────────────────────────────────────────────────────
function hasFreeAccess(userId) {
  const user = getUser(userId);
  return user.free_used < user.free_limit;
}

// ─── Тегін презентация қолдану ────────────────────────────────────────────────
function useFree(userId) {
  const db = loadDB();
  const user = getUser(userId);
  user.free_used += 1;
  user.total_presentations += 1;
  db[userId] = user;
  saveDB(db);
}

// ─── Төлемді презентация тіркеу ───────────────────────────────────────────────
function usePaid(userId, stars) {
  const db = loadDB();
  const user = getUser(userId);
  user.total_presentations += 1;
  user.total_paid += stars;
  db[userId] = user;
  saveDB(db);
}

// ─── Пайдаланушы статистикасы ─────────────────────────────────────────────────
function getUserStats(userId) {
  const user = getUser(userId);
  const freeLeft = Math.max(0, user.free_limit - user.free_used);
  return {
    freeLeft,
    totalPresentations: user.total_presentations,
    totalPaid: user.total_paid,
  };
}

// ─── Ағымдағы ай (лимит reset үшін) ──────────────────────────────────────────
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

module.exports = {
  getUser,
  hasFreeAccess,
  useFree,
  usePaid,
  getUserStats,
};
