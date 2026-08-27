const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "users.json");
const PENDING_PATH = path.join(__dirname, "pending.json");

function writeAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

function loadJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function getUser(userId) {
  const db = loadJSON(DB_PATH, {});

  if (!db[userId]) {
    db[userId] = {
      id: userId,
      free_used: 0,
      free_limit: 2,
      total_presentations: 0,
      total_paid_tenge: 0,
      created_at: new Date().toISOString(),
      last_reset: getCurrentMonth(),
    };

    writeAtomic(DB_PATH, db);
  }

  const user = db[userId];

  if (user.last_reset !== getCurrentMonth()) {
    user.free_used = 0;
    user.last_reset = getCurrentMonth();
    writeAtomic(DB_PATH, db);
  }

  return user;
}

function hasFreeAccess(userId) {
  const user = getUser(userId);
  return user.free_used < user.free_limit;
}

function useFree(userId) {
  const db = loadJSON(DB_PATH, {});
  const user = getUser(userId);

  user.free_used += 1;
  user.total_presentations += 1;

  db[userId] = user;
  writeAtomic(DB_PATH, db);
}

function usePaid(userId, amountTenge) {
  const db = loadJSON(DB_PATH, {});
  const user = getUser(userId);

  user.total_presentations += 1;
  user.total_paid_tenge += amountTenge;

  db[userId] = user;
  writeAtomic(DB_PATH, db);
}

function savePending(userId, parsedData) {
  const pending = loadJSON(PENDING_PATH, {});

  pending[userId] = {
    data: parsedData,
    created_at: new Date().toISOString(),
  };

  writeAtomic(PENDING_PATH, pending);
}

function getPending(userId) {
  const pending = loadJSON(PENDING_PATH, {});
  return pending[userId]?.data || null;
}

function deletePending(userId) {
  const pending = loadJSON(PENDING_PATH, {});

  delete pending[userId];

  writeAtomic(PENDING_PATH, pending);
}

function getUserStats(userId) {
  const user = getUser(userId);

  return {
    freeLeft: Math.max(0, user.free_limit - user.free_used),
    totalPresentations: user.total_presentations,
    totalPaidTenge: user.total_paid_tenge,
  };
}

module.exports = {
  getUser,
  hasFreeAccess,
  useFree,
  usePaid,
  savePending,
  getPending,
  deletePending,
  getUserStats,
};
