/* ==========================================================================
   Week Maxxing — Monk Mode
   Single-page gamified weekly dashboard.
   Architecture:
     CONFIG  — static definitions (habits, ranks, achievements, quotes, goals)
     Store   — localStorage persistence + state shape
     Engine  — scoring, XP, levels, ranks, streaks, penalties, achievements
     Charts  — dependency-free SVG chart builders (bar, line, radar, heatmap)
     FX      — confetti, particles, floating XP, animated counters, toasts
     UI      — render + event wiring per panel
   ========================================================================== */

"use strict";

/* ==========================================================================
   CONFIG
   ========================================================================== */

const WEEK_DAYS = 7;
const STORAGE_KEY = "weekMaxxing.v1";

const HABITS = [
  { id: "wake8",       label: "Wake at 8 AM",             group: "Morning Protocol",  xp: 15 },
  { id: "noSnooze",    label: "No Snooze",                group: "Morning Protocol",  xp: 10 },
  { id: "makeBreakfast", label: "Make Breakfast for her",  group: "Morning Protocol",  xp: 10, days: [1, 2, 3, 4, 5] }, // workdays only (Day 1 = Monday)
  { id: "journalAM",   label: "Journal Morning",          group: "Morning Protocol",  xp: 10 },
  { id: "prayerDhuhr",   label: "Dhuhr",                  group: "Prayer 🕌", xp: 15 },
  { id: "prayerAsr",     label: "Asr",                    group: "Prayer 🕌", xp: 15 },
  { id: "prayerMaghrib", label: "Maghrib",                group: "Prayer 🕌", xp: 15 },
  { id: "prayerIsha",    label: "Isha",                   group: "Prayer 🕌", xp: 15 },
  { id: "noDew",       label: "No Mountain Dew",          group: "Nutrition Discipline", xp: 20, penalty: 15 },
  { id: "noSugar",     label: "No Sugar",                 group: "Nutrition Discipline", xp: 20, penalty: 15 },
  { id: "noJunk",      label: "No Junk Food",             group: "Nutrition Discipline", xp: 15, penalty: 10 },
  { id: "noFastFood",  label: "No Fast Food",             group: "Nutrition Discipline", xp: 15, penalty: 10 },
  { id: "water3l",     label: "Drink 3L Water",           group: "Nutrition Discipline", xp: 15 },
  { id: "protein100",  label: "Protein ≥ 100g",           group: "Nutrition Discipline", xp: 15 },
  { id: "gymOrWalk",   label: "Gym OR Walk",              group: "Body",  xp: 20 },
  { id: "steps8k",     label: "6,000+ Steps",             group: "Body",  xp: 15 }, // id kept for saved-data compatibility
  { id: "read30",      label: "Read 30 Minutes",          group: "Mind",  xp: 15 },
  { id: "journalPM",   label: "Journal Night",            group: "Mind",  xp: 10 },
  { id: "cleanRoom",   label: "Clean Room 20 Minutes",    group: "Mind",  xp: 10 },
  { id: "screenUnder1h", label: "Phone Screen Time < 1 Hour", group: "Mind", xp: 20 },
  { id: "deepWork3h",  label: "Deep Work ≥ 3 Hours",      group: "Career Engine", xp: 25 },
  { id: "aiLearning",  label: "AI Learning",              group: "Career Engine", xp: 15 },
  { id: "qaLearning",  label: "QA Learning",              group: "Career Engine", xp: 15 },
  { id: "freelance",   label: "Freelance",                group: "Career Engine", xp: 15 },
  { id: "contentCreation", label: "Content Creation",     group: "Career Engine", xp: 15 },
  { id: "sleepBefore12", label: "Sleep before 12 AM",     group: "Sleep", xp: 15, penalty: 10 },
];

// habits may be limited to specific days (e.g. workdays); everything scoring a
// day must go through this filter so day % and perfect-day stay fair
function habitsForDay(n) { return HABITS.filter(h => !h.days || h.days.includes(n)); }

const SCREEN_LIMIT_MIN = 60;
const SCREEN_PENALTY = 20;

const RANKS = [
  { name: "Civilian",    xp: 0,    emblem: "👤" },
  { name: "Disciplined", xp: 250,  emblem: "🥋" },
  { name: "Focused",     xp: 600,  emblem: "🎯" },
  { name: "Warrior",     xp: 1000, emblem: "⚔️" },
  { name: "Elite",       xp: 1500, emblem: "🦅" },
  { name: "Monk",        xp: 2100, emblem: "🧘" },
  { name: "Legend",      xp: 2600, emblem: "👑" },
];

// cumulative XP required to REACH each level (level 1 = 0)
function xpForLevel(level) { return 75 * (level - 1) * level; } // 0,150,450,900,1500,2250,3150…
function levelForXp(xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "The pain of discipline weighs ounces. The pain of regret weighs tons.",
  "Monk mode: silence the noise, amplify the work.",
  "A week of focus can outwork a year of drifting.",
  "Small daily wins compound into an unrecognizable future.",
  "Your future self is watching you right now through memories.",
  "Hard choices, easy life. Easy choices, hard life.",
  "The gym is optional. So is being average.",
  "Focus is the new IQ.",
  "One week. Zero excuses. Full send.",
  "You are one disciplined week away from momentum.",
  "Comfort is a slow poison. Effort is the antidote.",
  "Win the morning, win the day. Win the day, win the week.",
];

const GOALS = {
  sleepHours: 8, workoutMin: 45, waterL: 3, proteinG: 100, calories: 2200,
  steps: 6000, walkMin: 30, deepWorkH: 3, pomodoros: 6, readMin: 30, pages: 20,
  learnMin: 60, screenMin: 60, cleanMin: 20, journalCount: 2,
};

const ACHIEVEMENTS = [
  { id: "firstHabit",  name: "First Blood",       icon: "🩸", xp: 10,  desc: "Complete your first habit" },
  { id: "firstWorkout",name: "First Workout",     icon: "🏋️", xp: 25,  desc: "Check Gym OR Walk once" },
  { id: "protein100",  name: "Protein Punch",     icon: "🍗", xp: 25,  desc: "Hit 100g protein in a day" },
  { id: "noSugar3",    name: "No Sugar · 3 Days", icon: "🚫", xp: 50,  desc: "3 straight days sugar-free" },
  { id: "noSugar7",    name: "No Sugar · 7 Days", icon: "💎", xp: 100, desc: "The whole week sugar-free" },
  { id: "xp100",       name: "Centurion",         icon: "💯", xp: 10,  desc: "Earn 100 total XP" },
  { id: "xp1000",      name: "XP Machine",        icon: "⚡", xp: 50,  desc: "Earn 1,000 total XP" },
  { id: "streak3",     name: "Heating Up",        icon: "🔥", xp: 30,  desc: "3-day streak (≥60% days)" },
  { id: "streak7",     name: "7-Day Streak",      icon: "🌋", xp: 100, desc: "Full week streak" },
  { id: "deepWork",    name: "Deep Work Master",  icon: "🧠", xp: 75,  desc: "15+ deep work hours this week" },
  { id: "phoneDetox",  name: "Phone Detox",       icon: "📵", xp: 50,  desc: "Screen < 60 min, 3 days" },
  { id: "hydration",   name: "Hydro Homie",       icon: "💧", xp: 30,  desc: "3L water on 3 days" },
  { id: "bookworm",    name: "Bookworm",          icon: "📚", xp: 40,  desc: "Read 150+ pages this week" },
  { id: "earlyRiser",  name: "Early Riser",       icon: "🌅", xp: 40,  desc: "Wake at 8 AM on 5 days" },
  { id: "jobHunter",   name: "Job Hunter",        icon: "🎯", xp: 40,  desc: "Send 5+ applications" },
  { id: "prayers3",    name: "Steadfast · 3 Days", icon: "🕌", xp: 50,  desc: "All 4 prayers, 3 days" },
  { id: "prayers7",    name: "Steadfast · 7 Days", icon: "🌙", xp: 100, desc: "All 4 prayers, every day" },
  { id: "perfectDay",  name: "Perfect Day",       icon: "🌟", xp: 75,  desc: "100% habits in one day" },
  { id: "monkMode",    name: "Monk Mode",         icon: "🧘", xp: 100, desc: "3 perfect days in the week" },
  { id: "perfectWeek", name: "Perfect Week",      icon: "🏆", xp: 200, desc: "7 perfect days. Legend." },
];

/* ==========================================================================
   Store
   ========================================================================== */

function emptyDay() {
  return {
    habits: {},
    metrics: {
      sleepHours: null, weight: null, proteinG: null, calories: null, waterL: null,
      workoutMin: null, walkMin: null, steps: null, energy: 0, recovery: 0, mood: 0,
      deepWorkH: null, pomodoros: 0, playwrightMin: null, aiMin: null,
      freelanceMin: null, contentMin: null, applications: 0, resumeImp: 0, linkedinImp: 0, sideProjectMin: null,
      screenMin: null, socialMin: null, youtubeMin: null, entertainmentMin: null,
      bookTitle: "", pages: null, readMin: null, booksFinished: 0,
      cleanMin: null,
    },
    journal: { p1: "", p2: "", p3: "", mission: "", wins: "", lessons: "", gratitude: "" },
  };
}

function defaultState() {
  return {
    startDate: toISODate(new Date()),
    selectedDay: 1,
    theme: "dark",
    meta: { lastLevel: 1, unlocked: {}, celebratedPerfect: {} },
    days: Array.from({ length: WEEK_DAYS }, emptyDay),
  };
}

function toISODate(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const base = defaultState();
    // deep-merge saved onto defaults so new fields never break old data
    const state = { ...base, ...saved, meta: { ...base.meta, ...(saved.meta || {}) } };
    state.days = base.days.map((d, i) => {
      const sd = (saved.days && saved.days[i]) || {};
      return {
        habits: { ...(sd.habits || {}) },
        metrics: { ...d.metrics, ...(sd.metrics || {}) },
        journal: { ...d.journal, ...(sd.journal || {}) },
      };
    });
    return state;
  } catch {
    return defaultState();
  }
}

let state = loadState();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 150);
}

/* ==========================================================================
   Engine — scoring, XP, streaks, achievements
   ========================================================================== */

function todayDayNumber() {
  const start = new Date(state.startDate + "T00:00:00");
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), WEEK_DAYS);
}

function isFutureDay(n) { return n > todayDayNumber(); }
function isPastOrToday(n) { return n <= todayDayNumber(); }

function dayPenalties(n) {
  const day = state.days[n - 1];
  const out = [];
  if (isFutureDay(n)) return out;
  const isToday = n === todayDayNumber();
  for (const h of habitsForDay(n)) {
    if (!h.penalty) continue;
    // discipline penalties land once the day is over (or live if metrics prove it)
    if (!day.habits[h.id] && !isToday) {
      out.push({ label: `${h.label} missed`, xp: h.penalty, icon: "⛔" });
    }
  }
  if (day.metrics.screenMin != null && day.metrics.screenMin > SCREEN_LIMIT_MIN) {
    out.push({
      label: `Screen time ${day.metrics.screenMin} min (limit ${SCREEN_LIMIT_MIN})`,
      xp: SCREEN_PENALTY, icon: "📱",
    });
  }
  return out;
}

function computeDay(n) {
  const day = state.days[n - 1];
  const applicable = habitsForDay(n);
  const doneHabits = applicable.filter(h => day.habits[h.id]);
  const earned = doneHabits.reduce((s, h) => s + h.xp, 0);
  const penalties = dayPenalties(n);
  const penaltyXp = penalties.reduce((s, p) => s + p.xp, 0);
  const score = Math.max(0, earned - penaltyXp);
  const pct = Math.round((doneHabits.length / applicable.length) * 100);
  return {
    n, earned, penalties, penaltyXp, score, pct,
    habitsDone: doneHabits.length,
    habitsTotal: applicable.length,
    perfect: doneHabits.length === applicable.length,
  };
}

function computeWeek() {
  const days = [];
  for (let i = 1; i <= WEEK_DAYS; i++) days.push(computeDay(i));
  const achievementXp = Object.keys(state.meta.unlocked)
    .reduce((s, id) => { const a = ACHIEVEMENTS.find(x => x.id === id); return s + (a ? a.xp : 0); }, 0);
  const habitXp = days.reduce((s, d) => s + d.score, 0);
  const totalXp = habitXp + achievementXp;
  const level = levelForXp(totalXp);
  const today = todayDayNumber();
  const elapsed = days.slice(0, today);
  const weekPct = Math.round(days.reduce((s, d) => s + d.pct, 0) / WEEK_DAYS);
  const elapsedPct = Math.round(elapsed.reduce((s, d) => s + d.pct, 0) / elapsed.length);

  // streak = consecutive days ending at the most recent day with >=60%
  let streak = 0;
  for (let i = today; i >= 1; i--) {
    const d = days[i - 1];
    if (d.pct >= 60) streak++;
    else if (i === today && d.pct < 60) continue; // today isn't over — don't break streak yet
    else break;
  }

  let rank = RANKS[0], nextRank = RANKS[1];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalXp >= RANKS[i].xp) { rank = RANKS[i]; nextRank = RANKS[i + 1] || null; break; }
  }

  return { days, habitXp, achievementXp, totalXp, level, weekPct, elapsedPct, streak, rank, nextRank, today };
}

/* streak of consecutive days (from day 1 of the elapsed week) a habit was kept */
function habitStreak(habitId) {
  const today = todayDayNumber();
  let streak = 0;
  for (let i = today; i >= 1; i--) {
    const checked = state.days[i - 1].habits[habitId];
    if (checked) streak++;
    else if (i === today) continue; // today still in progress
    else break;
  }
  return streak;
}

function habitDaysKept(habitId) {
  return state.days.filter((d, i) => i < todayDayNumber() + 0 && d.habits[habitId]).length;
}

function checkAchievements(week) {
  const m = i => state.days[i].metrics;
  const anyHabit = state.days.some(d => Object.values(d.habits).some(Boolean));
  const perfectDays = week.days.filter(d => d.perfect).length;
  const PRAYERS = ["prayerDhuhr", "prayerAsr", "prayerMaghrib", "prayerIsha"];
  const fullPrayerDays = state.days.filter(d => PRAYERS.every(p => d.habits[p])).length;
  const conditions = {
    firstHabit: anyHabit,
    firstWorkout: state.days.some(d => d.habits.gymOrWalk),
    protein100: state.days.some((d, i) => (m(i).proteinG || 0) >= 100 || d.habits.protein100),
    noSugar3: habitStreak("noSugar") >= 3,
    noSugar7: habitStreak("noSugar") >= 7,
    xp100: week.totalXp >= 100,
    xp1000: week.totalXp >= 1000,
    streak3: week.streak >= 3,
    streak7: week.streak >= 7,
    deepWork: state.days.reduce((s, d, i) => s + (m(i).deepWorkH || 0), 0) >= 15,
    phoneDetox: state.days.filter((d, i) => m(i).screenMin != null && m(i).screenMin < 60).length >= 3,
    hydration: state.days.filter((d, i) => (m(i).waterL || 0) >= 3 || d.habits.water3l).length >= 3,
    bookworm: state.days.reduce((s, d, i) => s + (m(i).pages || 0), 0) >= 150,
    earlyRiser: state.days.filter(d => d.habits.wake8).length >= 5,
    jobHunter: state.days.reduce((s, d, i) => s + (m(i).applications || 0), 0) >= 5,
    prayers3: fullPrayerDays >= 3,
    prayers7: fullPrayerDays >= 7,
    perfectDay: perfectDays >= 1,
    monkMode: perfectDays >= 3,
    perfectWeek: perfectDays >= 7,
  };
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (conditions[a.id] && !state.meta.unlocked[a.id]) {
      state.meta.unlocked[a.id] = Date.now();
      newly.push(a);
    }
  }
  return newly;
}

/* ==========================================================================
   FX — confetti, particles, floating XP, counters, toasts
   ========================================================================== */

const FX = (() => {
  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let raf = null;

  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
  addEventListener("resize", resize); resize();

  const COLORS = ["#3987e5", "#10b981", "#e8b339", "#58a6ff", "#34d399", "#f6d67c", "#9085e9"];

  function spawn(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = opts.spread ? (Math.random() * Math.PI * 2) : (-Math.PI / 2 + (Math.random() - 0.5) * 1.6);
      const speed = (opts.power || 8) * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        g: 0.28,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        size: 4 + Math.random() * 5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() < 0.5 ? "rect" : "circle",
      });
    }
    if (!raf) tick();
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99;
      p.life -= p.decay; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    raf = particles.length ? requestAnimationFrame(tick) : null;
    if (!particles.length) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function confetti() {
    spawn(canvas.width * 0.2, canvas.height * 0.9, 70, { power: 16 });
    spawn(canvas.width * 0.8, canvas.height * 0.9, 70, { power: 16 });
    setTimeout(() => spawn(canvas.width * 0.5, canvas.height * 0.85, 80, { power: 18 }), 250);
  }

  function burstAt(el, count = 26) {
    const r = el.getBoundingClientRect();
    spawn(r.left + r.width / 2, r.top + r.height / 2, count, { spread: true, power: 5 });
  }

  return { confetti, burstAt };
})();

function floatXp(el, amount) {
  const r = el.getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "xp-float" + (amount < 0 ? " neg" : "");
  f.textContent = (amount > 0 ? "+" : "") + amount + " XP";
  f.style.left = (r.right - 50) + "px";
  f.style.top = (r.top - 4) + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 950);
}

const counters = new Map();
function animateValue(el, to, fmt = v => Math.round(v).toLocaleString()) {
  const from = counters.get(el) ?? 0;
  counters.set(el, to);
  if (from === to) { el.textContent = fmt(to); return; }
  const start = performance.now(), dur = 600;
  function step(t) {
    const p = Math.min((t - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toast(msg, icon = "✅", variant = "") {
  const stack = document.getElementById("toast-stack");
  const t = document.createElement("div");
  t.className = "toast " + variant;
  t.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 3400);
}

function showLevelUp(level) {
  const ov = document.getElementById("levelup-overlay");
  document.getElementById("levelup-level").textContent = level;
  ov.hidden = false;
  FX.confetti();
  setTimeout(() => { ov.hidden = true; }, 2200);
  ov.onclick = () => { ov.hidden = true; };
}

/* ==========================================================================
   Charts — dependency-free SVG
   ========================================================================== */

const Charts = (() => {
  const DAY_LABELS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];
  const W = 420, H = 190, PAD = { t: 14, r: 12, b: 26, l: 34 };

  function frame(maxV, unit) {
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    let g = "";
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = PAD.t + ih - (ih * i / ticks);
      const val = maxV * i / ticks;
      g += `<line class="grid-line" x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}"/>`;
      g += `<text class="axis-label" x="${PAD.l - 6}" y="${y + 3}" text-anchor="end">${fmtTick(val)}${i === ticks && unit ? "" : ""}</text>`;
    }
    return { iw, ih, grid: g };
  }
  function fmtTick(v) { return v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(v * 10) / 10; }

  function xLabels(iw) {
    let s = "";
    for (let i = 0; i < 7; i++) {
      const x = PAD.l + iw * (i + 0.5) / 7;
      s += `<text class="axis-label" x="${x}" y="${H - 8}" text-anchor="middle">${DAY_LABELS[i]}</text>`;
    }
    return s;
  }

  function bar({ values, color = "var(--chart-blue)", goal = null, unit = "", max = null }) {
    const maxV = Math.max(max || 0, goal || 0, ...values.map(v => v || 0), 1) * 1.15;
    const { iw, ih, grid } = frame(maxV, unit);
    let bars = "";
    values.forEach((v, i) => {
      const val = v || 0;
      const bw = iw / 7 * 0.56;
      const x = PAD.l + iw * (i + 0.5) / 7 - bw / 2;
      const bh = Math.max(ih * val / maxV, val > 0 ? 3 : 0);
      const y = PAD.t + ih - bh;
      bars += `<rect class="bar-mark" data-tip="Day ${i + 1}|${val}${unit}" x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 0.01)}" rx="4"
        fill="${color}" opacity="${val > 0 ? 0.92 : 0.15}">
        <animate attributeName="height" from="0" to="${Math.max(bh, 0.01)}" dur="0.5s" fill="freeze"/>
        <animate attributeName="y" from="${PAD.t + ih}" to="${y}" dur="0.5s" fill="freeze"/></rect>`;
    });
    let goalLine = "";
    if (goal != null) {
      const gy = PAD.t + ih - ih * goal / maxV;
      goalLine = `<line x1="${PAD.l}" y1="${gy}" x2="${W - PAD.r}" y2="${gy}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/>
        <text class="axis-label" x="${W - PAD.r}" y="${gy - 4}" text-anchor="end" fill="var(--gold)">goal ${goal}${unit}</text>`;
    }
    return svgWrap(`${grid}${xLabels(iw)}${bars}${goalLine}`);
  }

  function line({ values, color = "var(--chart-green)", goal = null, unit = "", area = true, danger = false }) {
    const nums = values.map(v => v == null ? null : v);
    const maxV = Math.max(goal || 0, ...nums.map(v => v || 0), 1) * 1.15;
    const { iw, ih, grid } = frame(maxV, unit);
    const pts = [];
    nums.forEach((v, i) => {
      if (v == null) return;
      pts.push({ x: PAD.l + iw * (i + 0.5) / 7, y: PAD.t + ih - ih * v / maxV, v, i });
    });
    let path = "", areaPath = "";
    if (pts.length) {
      path = "M" + pts.map(p => `${p.x},${p.y}`).join(" L");
      areaPath = path + ` L${pts[pts.length - 1].x},${PAD.t + ih} L${pts[0].x},${PAD.t + ih} Z`;
    }
    const dots = pts.map(p =>
      `<circle class="bar-mark" data-tip="Day ${p.i + 1}|${p.v}${unit}" cx="${p.x}" cy="${p.y}" r="4.5" fill="${p.v > (goal ?? Infinity) && danger ? "var(--chart-red)" : color}" stroke="var(--surface-solid)" stroke-width="2"/>`
    ).join("");
    let goalLine = "";
    if (goal != null) {
      const gy = PAD.t + ih - ih * goal / maxV;
      goalLine = `<line x1="${PAD.l}" y1="${gy}" x2="${W - PAD.r}" y2="${gy}" stroke="${danger ? "var(--chart-red)" : "var(--gold)"}" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/>
        <text class="axis-label" x="${W - PAD.r}" y="${gy - 4}" text-anchor="end" fill="${danger ? "var(--chart-red)" : "var(--gold)"}">${danger ? "limit" : "goal"} ${goal}${unit}</text>`;
    }
    const len = 1200;
    return svgWrap(`${grid}${xLabels(iw)}
      ${area && pts.length ? `<path d="${areaPath}" fill="${color}" opacity="0.10"/>` : ""}
      ${pts.length ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"><animate attributeName="stroke-dashoffset" from="${len}" to="0" dur="0.9s" fill="freeze"/></path>` : ""}
      ${dots}${goalLine}`);
  }

  function radar({ axes, values, color = "var(--chart-blue)" }) {
    const size = 300, cx = size / 2, cy = size / 2, r = 100;
    const n = axes.length;
    const angle = i => -Math.PI / 2 + (Math.PI * 2 * i) / n;
    let rings = "";
    for (let k = 1; k <= 4; k++) {
      const rr = r * k / 4;
      const p = Array.from({ length: n }, (_, i) => `${cx + rr * Math.cos(angle(i))},${cy + rr * Math.sin(angle(i))}`).join(" ");
      rings += `<polygon points="${p}" fill="none" class="grid-line"/>`;
    }
    let spokes = "", labels = "";
    for (let i = 0; i < n; i++) {
      const x = cx + r * Math.cos(angle(i)), y = cy + r * Math.sin(angle(i));
      spokes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="grid-line"/>`;
      const lx = cx + (r + 22) * Math.cos(angle(i)), ly = cy + (r + 20) * Math.sin(angle(i));
      labels += `<text class="axis-label" x="${lx}" y="${ly + 3}" text-anchor="middle">${axes[i]} ${values[i]}</text>`;
    }
    const poly = values.map((v, i) => {
      const rr = r * Math.min(v, 100) / 100;
      return `${cx + rr * Math.cos(angle(i))},${cy + rr * Math.sin(angle(i))}`;
    }).join(" ");
    const dots = values.map((v, i) => {
      const rr = r * Math.min(v, 100) / 100;
      return `<circle cx="${cx + rr * Math.cos(angle(i))}" cy="${cy + rr * Math.sin(angle(i))}" r="4" fill="${color}" stroke="var(--surface-solid)" stroke-width="2"/>`;
    }).join("");
    return `<div class="chart-wrap"><svg viewBox="0 0 ${size} ${size}" role="img">
      ${rings}${spokes}
      <polygon points="${poly}" fill="${color}" opacity="0.22"/>
      <polygon points="${poly}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}${labels}</svg></div>`;
  }

  function svgWrap(inner) {
    return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img">${inner}</svg><div class="chart-tooltip"></div></div>`;
  }

  // one delegated tooltip handler for every chart on the page
  document.addEventListener("mouseover", e => {
    const mark = e.target.closest(".bar-mark");
    if (!mark) return;
    const wrap = mark.closest(".chart-wrap");
    const tip = wrap && wrap.querySelector(".chart-tooltip");
    if (!tip) return;
    const [label, value] = (mark.dataset.tip || "").split("|");
    tip.innerHTML = `${label}<br><b>${value}</b>`;
    tip.style.opacity = "1";
    const wr = wrap.getBoundingClientRect();
    const mr = mark.getBoundingClientRect();
    let x = mr.left - wr.left + mr.width / 2;
    tip.style.left = "0px"; tip.style.top = "0px";
    const tw = tip.offsetWidth || 80;
    x = Math.min(Math.max(x - tw / 2, 4), wr.width - tw - 4);
    tip.style.left = x + "px";
    tip.style.top = Math.max(mr.top - wr.top - tip.offsetHeight - 8, 2) + "px";
  });
  document.addEventListener("mouseout", e => {
    if (!e.target.closest || !e.target.closest(".bar-mark")) return;
    const wrap = e.target.closest(".chart-wrap");
    const tip = wrap && wrap.querySelector(".chart-tooltip");
    if (tip) tip.style.opacity = "0";
  });

  return { bar, line, radar };
})();

/* ==========================================================================
   UI helpers
   ========================================================================== */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function selDay() { return state.days[state.selectedDay - 1]; }

function numberField(id, label, unit, value, opts = {}) {
  return `<div class="field">
    <label>${label} ${unit ? `<span class="field-unit">(${unit})</span>` : ""}</label>
    <input type="number" inputmode="decimal" data-metric="${id}" value="${value ?? ""}"
      min="0" step="${opts.step || 1}" placeholder="${opts.placeholder || "0"}">
  </div>`;
}

function stepperField(id, label, value) {
  return `<div class="field">
    <label>${label}</label>
    <div class="stepper" data-stepper="${id}">
      <button type="button" data-step="-1">−</button>
      <span class="stepper-val">${value || 0}</span>
      <button type="button" data-step="1">+</button>
    </div>
  </div>`;
}

/* ==========================================================================
   UI — render functions
   ========================================================================== */

function renderHero(week) {
  const d = week.days[state.selectedDay - 1];
  animateValue($("#stat-xp"), week.totalXp);
  animateValue($("#stat-weekscore"), week.habitXp);
  $("#stat-level").textContent = week.level;
  $("#stat-day").innerHTML = `${week.today}<small>/7</small>`;
  $("#stat-streak").textContent = `🔥 ${week.streak}`;
  $("#stat-weekpct").textContent = week.weekPct + "%";

  // rank
  $("#rank-emblem").textContent = week.rank.emblem;
  $("#rank-name").textContent = week.rank.name;
  if (week.nextRank) {
    const span = week.nextRank.xp - week.rank.xp;
    const p = Math.min(((week.totalXp - week.rank.xp) / span) * 100, 100);
    $("#rank-progress-fill").style.width = p + "%";
    $("#rank-next").textContent = `${week.nextRank.xp - week.totalXp} XP to ${week.nextRank.name}`;
  } else {
    $("#rank-progress-fill").style.width = "100%";
    $("#rank-next").textContent = "Maximum rank achieved 👑";
  }

  // rings (today ring shows the day being viewed)
  const C = 2 * Math.PI * 52;
  $("#ring-today").style.strokeDashoffset = C * (1 - d.pct / 100);
  $("#ring-today-val").textContent = d.pct + "%";
  $("#ring-week").style.strokeDashoffset = C * (1 - week.weekPct / 100);
  $("#ring-week-val").textContent = week.weekPct + "%";

  // xp bar
  const cur = xpForLevel(week.level), next = xpForLevel(week.level + 1);
  const into = week.totalXp - cur, span = next - cur;
  $("#xp-level-label").textContent = `Level ${week.level} — ${week.rank.name}`;
  $("#xp-to-next").textContent = `${into} / ${span} XP · ${span - into} to Level ${week.level + 1}`;
  $("#xp-bar-fill").style.width = Math.min((into / span) * 100, 100) + "%";
}

function renderDayTabs(week) {
  const wrap = $("#day-tabs");
  const start = new Date(state.startDate + "T00:00:00");
  wrap.innerHTML = week.days.map(d => {
    const date = new Date(start.getTime() + (d.n - 1) * 86400000);
    const lbl = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const isToday = d.n === week.today;
    return `<button class="day-tab ${d.n === state.selectedDay ? "active" : ""} ${isFutureDay(d.n) ? "future" : ""}" data-day="${d.n}">
      ${isToday ? '<span class="dt-today-dot"></span>' : ""}
      <span class="dt-day">Day ${d.n}</span>
      <span class="dt-date">${lbl}</span>
      <span class="dt-pct"><i style="width:${d.pct}%"></i></span>
    </button>`;
  }).join("");
}

function renderScoreCard(week) {
  const d = week.days[state.selectedDay - 1];
  $("#score-card-grid").innerHTML = `
    <div class="score-tile"><div class="st-value blue">${d.score}</div><div class="st-label">Day Score</div></div>
    <div class="score-tile"><div class="st-value green">${d.pct}%</div><div class="st-label">Day %</div></div>
    <div class="score-tile"><div class="st-value gold">${week.level}</div><div class="st-label">Level</div></div>
    <div class="score-tile"><div class="st-value ${d.penaltyXp ? "red" : ""}">${d.penaltyXp ? "−" + d.penaltyXp : "0"}</div><div class="st-label">Penalties</div></div>`;
}

function renderHabits(week) {
  const day = selDay();
  const d = week.days[state.selectedDay - 1];
  const dayHabits = habitsForDay(state.selectedDay);
  const groups = [...new Set(dayHabits.map(h => h.group))];
  $("#habit-list").innerHTML = groups.map(g => `
    <div>
      <div class="habit-group-title">${g}</div>
      <div class="habit-items">
        ${dayHabits.filter(h => h.group === g).map(h => `
          <label class="habit ${day.habits[h.id] ? "checked" : ""} ${h.penalty && !day.habits[h.id] && isPastOrToday(state.selectedDay) ? "penalty-live" : ""}" data-habit="${h.id}">
            <input type="checkbox" ${day.habits[h.id] ? "checked" : ""}>
            <span class="hb-box">✓</span>
            <span class="hb-label">${h.label}</span>
            <span class="hb-xp">+${h.xp}</span>
          </label>`).join("")}
      </div>
    </div>`).join("");
  $("#habit-count").textContent = `${d.habitsDone}/${d.habitsTotal} · ${d.earned} XP earned`;
  $("#habit-progress-fill").style.width = d.pct + "%";
}

function renderWarnings(week) {
  const d = week.days[state.selectedDay - 1];
  const day = selDay();
  let html = "";
  if (day.metrics.screenMin != null && day.metrics.screenMin > SCREEN_LIMIT_MIN) {
    html += `<div class="warning-banner"><span class="wb-icon">📱</span>
      Screen time is ${day.metrics.screenMin} min — over the ${SCREEN_LIMIT_MIN} min limit.
      <span class="wb-xp">−${SCREEN_PENALTY} XP</span></div>`;
  }
  if (!day.habits.noDew && isPastOrToday(state.selectedDay)) {
    html += `<div class="warning-banner warn-soft"><span class="wb-icon">🥤</span>
      Mountain Dew alert — "No Mountain Dew" isn't checked. Stay strong.
      <span class="wb-xp">${state.selectedDay < week.today ? "−15 XP" : "at risk"}</span></div>`;
  }
  for (const p of d.penalties) {
    if (p.icon === "📱") continue; // already shown above
    html += `<div class="warning-banner"><span class="wb-icon">${p.icon}</span>${esc(p.label)}<span class="wb-xp">−${p.xp} XP</span></div>`;
  }
  $("#warnings-area").innerHTML = html;
}

/* ---------- metric cards (Today side) ---------- */

const EMOJI = ["😫", "😕", "😐", "🙂", "🤩"];

function metricCard({ icon, title, value, unit, goal, pct, color, sub, input }) {
  const bar = pct != null
    ? `<div class="mc-bar"><i style="width:${Math.min(pct, 100)}%;background:${pct >= 100 ? "var(--green)" : color}"></i></div>` : "";
  return `<div class="metric-card">
    <div class="mc-head"><span class="mc-title">${icon} ${title}</span>${pct >= 100 ? '<span class="mc-goal-ok">✓ goal</span>' : ""}</div>
    <div class="mc-value">${value}${unit ? `<small>${unit}</small>` : ""}</div>
    ${bar}${sub ? `<div class="mc-sub">${sub}</div>` : ""}${input || ""}
  </div>`;
}

function emojiScale(metricId, value) {
  return `<div class="emoji-scale" data-emoji="${metricId}">
    ${EMOJI.map((e, i) => `<button type="button" class="${value === i + 1 ? "sel" : ""}" data-val="${i + 1}">${e}</button>`).join("")}
  </div>`;
}

function quickInput(metricId, step, unit) {
  return `<div class="mc-input-row">
    <input type="number" inputmode="decimal" data-metric="${metricId}" data-quick step="${step}" min="0" placeholder="log ${unit}">
  </div>`;
}

function renderMetricCards() {
  const m = selDay().metrics;
  const j = selDay().journal;
  const journalDone = (j.p1 || j.mission ? 1 : 0) + (j.wins || j.gratitude ? 1 : 0);
  const learnMin = (m.aiMin || 0) + (m.playwrightMin || 0);
  const cards = [
    metricCard({ icon: "😴", title: "Sleep", value: m.sleepHours ?? "–", unit: "h", pct: m.sleepHours ? m.sleepHours / GOALS.sleepHours * 100 : 0, color: "var(--violet)", sub: `goal ${GOALS.sleepHours}h`, input: quickInput("sleepHours", 0.5, "hours") }),
    metricCard({ icon: "🏋️", title: "Workout", value: m.workoutMin ?? "–", unit: "min", pct: m.workoutMin ? m.workoutMin / GOALS.workoutMin * 100 : 0, color: "var(--blue)", sub: `goal ${GOALS.workoutMin} min`, input: quickInput("workoutMin", 5, "min") }),
    metricCard({ icon: "🍗", title: "Nutrition", value: m.proteinG ?? "–", unit: "g protein", pct: m.proteinG ? m.proteinG / GOALS.proteinG * 100 : 0, color: "var(--green)", sub: `${m.calories ?? "–"} kcal · goal ${GOALS.proteinG}g`, input: quickInput("proteinG", 5, "grams") }),
    metricCard({ icon: "💼", title: "Career", value: m.deepWorkH ?? "–", unit: "h deep", pct: m.deepWorkH ? m.deepWorkH / GOALS.deepWorkH * 100 : 0, color: "var(--blue)", sub: `${m.pomodoros || 0} pomodoros · ${m.applications || 0} apps`, input: quickInput("deepWorkH", 0.5, "hours") }),
    metricCard({ icon: "🤖", title: "Learning", value: learnMin || "–", unit: "min", pct: learnMin / GOALS.learnMin * 100, color: "var(--violet)", sub: `AI ${m.aiMin || 0} · QA ${m.playwrightMin || 0} min` }),
    metricCard({ icon: "📖", title: "Reading", value: m.readMin ?? "–", unit: "min", pct: m.readMin ? m.readMin / GOALS.readMin * 100 : 0, color: "var(--gold)", sub: `${m.pages || 0} pages`, input: quickInput("readMin", 5, "min") }),
    metricCard({ icon: "💧", title: "Water", value: m.waterL ?? "–", unit: "L", pct: m.waterL ? m.waterL / GOALS.waterL * 100 : 0, color: "var(--blue)", sub: `goal ${GOALS.waterL}L`, input: quickInput("waterL", 0.25, "liters") }),
    metricCard({ icon: "🚶", title: "Walking", value: m.steps != null ? m.steps.toLocaleString() : "–", unit: "steps", pct: m.steps ? m.steps / GOALS.steps * 100 : 0, color: "var(--green)", sub: `goal ${GOALS.steps.toLocaleString()}`, input: quickInput("steps", 500, "steps") }),
    metricCard({ icon: "📓", title: "Journaling", value: `${journalDone}/2`, unit: "", pct: journalDone / 2 * 100, color: "var(--gold)", sub: journalDone === 2 ? "AM + PM done" : "morning + night" }),
    metricCard({ icon: "🧹", title: "Cleaning", value: m.cleanMin ?? "–", unit: "min", pct: m.cleanMin ? m.cleanMin / GOALS.cleanMin * 100 : 0, color: "var(--violet)", sub: `goal ${GOALS.cleanMin} min`, input: quickInput("cleanMin", 5, "min") }),
    metricCard({ icon: "🙂", title: "Mood", value: m.mood ? EMOJI[m.mood - 1] : "–", unit: "", sub: "how do you feel?", input: emojiScale("mood", m.mood) }),
    metricCard({ icon: "⚡", title: "Energy", value: m.energy ? EMOJI[m.energy - 1] : "–", unit: "", sub: "battery level", input: emojiScale("energy", m.energy) }),
  ];
  $("#metric-cards").innerHTML = cards.join("");
}

/* ---------- career panel ---------- */

function renderCareer() {
  const m = selDay().metrics;
  $("#career-inputs").innerHTML = [
    numberField("deepWorkH", "Deep Work", "hours", m.deepWorkH, { step: 0.5 }),
    stepperField("pomodoros", "Pomodoros", m.pomodoros),
    numberField("playwrightMin", "Playwright / QA Learning", "min", m.playwrightMin, { step: 5 }),
    numberField("aiMin", "AI Engineering Learning", "min", m.aiMin, { step: 5 }),
    numberField("freelanceMin", "Freelance", "min", m.freelanceMin, { step: 5 }),
    numberField("contentMin", "Content Creation", "min", m.contentMin, { step: 5 }),
    stepperField("applications", "Applications Sent", m.applications),
    stepperField("resumeImp", "Resume Improvements", m.resumeImp),
    stepperField("linkedinImp", "LinkedIn Improvements", m.linkedinImp),
    numberField("sideProjectMin", "Side Project", "min", m.sideProjectMin, { step: 5 }),
  ].join("");

  const days = state.days;
  const dw = days.map(d => d.metrics.deepWorkH);
  const apps = days.map(d => d.metrics.applications || 0);
  const learn = days.map(d => (d.metrics.aiMin || 0) + (d.metrics.playwrightMin || 0) + (d.metrics.freelanceMin || 0) + (d.metrics.contentMin || 0) + (d.metrics.sideProjectMin || 0));
  const totApps = apps.reduce((a, b) => a + b, 0);
  const totDw = dw.reduce((a, b) => a + (b || 0), 0);
  $("#career-charts").innerHTML = `
    <div class="chart-card" style="padding:0 0 10px">
      <h3>Deep Work Hours</h3><div class="chart-sub">total ${totDw.toFixed(1)}h · goal ${GOALS.deepWorkH}h/day</div>
      ${Charts.bar({ values: dw.map(v => v || 0), goal: GOALS.deepWorkH, unit: "h", color: "var(--chart-blue)" })}
    </div>
    <div class="chart-card" style="padding:0 0 10px">
      <h3>Learning + Building Minutes</h3><div class="chart-sub">AI + QA + freelance + content + side project</div>
      ${Charts.bar({ values: learn, unit: "m", color: "var(--chart-violet)" })}
    </div>
    <div class="chart-card" style="padding:0">
      <h3>Applications Sent</h3><div class="chart-sub">total ${totApps} this week</div>
      ${Charts.bar({ values: apps, unit: "", color: "var(--chart-green)" })}
    </div>`;
}

/* ---------- fitness panel ---------- */

function renderFitness() {
  const m = selDay().metrics;
  $("#fitness-inputs").innerHTML = [
    numberField("weight", "Weight", "lbs/kg", m.weight, { step: 0.1 }),
    numberField("proteinG", "Protein", "g", m.proteinG, { step: 5 }),
    numberField("calories", "Calories", "kcal", m.calories, { step: 50 }),
    numberField("waterL", "Water", "L", m.waterL, { step: 0.25 }),
    numberField("workoutMin", "Workout", "min", m.workoutMin, { step: 5 }),
    numberField("walkMin", "Walking", "min", m.walkMin, { step: 5 }),
    numberField("steps", "Steps", "", m.steps, { step: 500 }),
    numberField("sleepHours", "Sleep", "h", m.sleepHours, { step: 0.5 }),
  ].join("") + `
    <div class="field"><label>Body Energy</label>${emojiScale("energy", m.energy)}</div>
    <div class="field"><label>Recovery</label>${emojiScale("recovery", m.recovery)}</div>`;

  // streak tiles
  const streakDefs = [
    { id: "noDew", label: "No Mountain Dew", emoji: "🥤" },
    { id: "noJunk", label: "No Junk Food", emoji: "🍟" },
    { id: "noSugar", label: "No Sugar", emoji: "🍭" },
  ];
  const today = todayDayNumber();
  $("#sugar-streaks").innerHTML = streakDefs.map(s => {
    const st = habitStreak(s.id);
    const dots = Array.from({ length: 7 }, (_, i) => {
      const n = i + 1;
      if (n > today) return "<i></i>";
      return `<i class="${state.days[i].habits[s.id] ? "on" : (n < today || state.days[i].habits[s.id] === false ? (state.days[i].habits[s.id] ? "on" : (n < today ? "off" : "")) : "")}"></i>`;
    }).join("");
    return `<div class="streak-tile">
      <div class="sk-emoji">${s.emoji}</div>
      <div class="sk-days">${st}</div>
      <div class="sk-label">${s.label} · days</div>
      <div class="sk-dots">${dots}</div>
    </div>`;
  }).join("");

  const days = state.days;
  const gymDays = days.filter(d => d.habits.gymOrWalk).length;
  const exMin = days.reduce((s, d) => s + (d.metrics.workoutMin || 0) + (d.metrics.walkMin || 0), 0);
  $("#fitness-charts").innerHTML = `
    <div class="score-card-grid" style="margin-bottom:14px">
      <div class="score-tile"><div class="st-value green">${gymDays}</div><div class="st-label">Gym Days</div></div>
      <div class="score-tile"><div class="st-value blue">${exMin}</div><div class="st-label">Exercise Min</div></div>
      <div class="score-tile"><div class="st-value">${avgOf(days.map(d => d.metrics.energy)) || "–"}</div><div class="st-label">Avg Energy</div></div>
      <div class="score-tile"><div class="st-value">${avgOf(days.map(d => d.metrics.recovery)) || "–"}</div><div class="st-label">Avg Recovery</div></div>
    </div>
    <div class="chart-card" style="padding:0 0 10px">
      <h3>Water (L)</h3>
      ${Charts.bar({ values: days.map(d => d.metrics.waterL || 0), goal: GOALS.waterL, unit: "L", color: "var(--chart-blue)" })}
    </div>
    <div class="chart-card" style="padding:0 0 10px">
      <h3>Protein (g)</h3>
      ${Charts.line({ values: days.map(d => d.metrics.proteinG), goal: GOALS.proteinG, unit: "g", color: "var(--chart-green)" })}
    </div>
    <div class="chart-card" style="padding:0">
      <h3>Exercise Minutes (workout + walk)</h3>
      ${Charts.bar({ values: days.map(d => (d.metrics.workoutMin || 0) + (d.metrics.walkMin || 0)), unit: "m", color: "var(--chart-gold)" })}
    </div>`;
}

function avgOf(arr) {
  const v = arr.filter(x => x);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0;
}

/* ---------- detox + reading ---------- */

function renderDetox() {
  const m = selDay().metrics;
  $("#detox-inputs").innerHTML = [
    numberField("screenMin", "Total Screen Time", "min", m.screenMin, { step: 5 }),
    numberField("socialMin", "Social Media", "min", m.socialMin, { step: 5 }),
    numberField("youtubeMin", "YouTube", "min", m.youtubeMin, { step: 5 }),
    numberField("entertainmentMin", "Entertainment", "min", m.entertainmentMin, { step: 5 }),
  ].join("");

  let warn = "";
  const checks = [
    ["screenMin", "Total screen time", SCREEN_LIMIT_MIN, `−${SCREEN_PENALTY} XP`],
    ["socialMin", "Social media", 30, "danger zone"],
    ["youtubeMin", "YouTube", 30, "danger zone"],
    ["entertainmentMin", "Entertainment", 30, "danger zone"],
  ];
  for (const [id, label, limit, tag] of checks) {
    if (m[id] != null && m[id] > limit) {
      warn += `<div class="warning-banner ${id === "screenMin" ? "" : "warn-soft"}">
        <span class="wb-icon">⚠️</span>${label}: ${m[id]} min — over the ${limit} min limit
        <span class="wb-xp">${tag}</span></div>`;
    }
  }
  if (m.screenMin != null && m.screenMin <= SCREEN_LIMIT_MIN) {
    warn += `<div class="warning-banner" style="border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.08)">
      <span class="wb-icon">🧘</span>Screen time under control. Monk approved.
      <span class="wb-xp" style="color:var(--green)">clean</span></div>`;
  }
  $("#detox-warnings").innerHTML = warn;

  const rm = selDay().metrics;
  $("#reading-inputs").innerHTML = `
    <div class="field" style="grid-column:1/-1">
      <label>Current Book</label>
      <input type="text" data-metric-text="bookTitle" value="${esc(rm.bookTitle)}" placeholder="What are you reading?">
    </div>` + [
      numberField("pages", "Pages Read", "", rm.pages, { step: 5 }),
      numberField("readMin", "Minutes Read", "min", rm.readMin, { step: 5 }),
      stepperField("booksFinished", "Books Finished", rm.booksFinished),
    ].join("") + `
    <div class="score-tile" style="align-self:end">
      <div class="st-value gold">${state.days.reduce((s, d) => s + (d.metrics.pages || 0), 0)}</div>
      <div class="st-label">Pages This Week</div>
    </div>`;

  $("#detox-charts").innerHTML = `
    <div class="chart-card" style="padding:0">
      <h3>Screen Time vs Limit</h3><div class="chart-sub">red dots = over the ${SCREEN_LIMIT_MIN} min limit</div>
      ${Charts.line({ values: state.days.map(d => d.metrics.screenMin), goal: SCREEN_LIMIT_MIN, unit: "m", color: "var(--chart-blue)", danger: true })}
    </div>`;
}

/* ---------- journal ---------- */

function renderJournal() {
  const j = selDay().journal;
  $("#journal-morning").innerHTML = `
    <div class="journal-block">
      <label>Top 3 Priorities</label>
      ${[1, 2, 3].map(i => `
        <div class="priority-row">
          <span class="pr-num">${i}</span>
          <input type="text" data-journal="p${i}" value="${esc(j["p" + i])}" placeholder="Priority ${i}">
        </div>`).join("")}
    </div>
    <div class="journal-block">
      <label>Today's Mission</label>
      <textarea data-journal="mission" placeholder="If today had only ONE outcome, what would make it a win?">${esc(j.mission)}</textarea>
    </div>`;
  $("#journal-night").innerHTML = `
    <div class="journal-block">
      <label>Wins 🏅</label>
      <textarea data-journal="wins" placeholder="What did you conquer today?">${esc(j.wins)}</textarea>
    </div>
    <div class="journal-block">
      <label>Lessons 📖</label>
      <textarea data-journal="lessons" placeholder="What would you do differently?">${esc(j.lessons)}</textarea>
    </div>
    <div class="journal-block">
      <label>Gratitude 🙏</label>
      <textarea data-journal="gratitude" placeholder="Three things you're grateful for…">${esc(j.gratitude)}</textarea>
    </div>`;
}

/* ---------- analytics ---------- */

function renderAnalytics(week) {
  const days = state.days;
  const defs = [
    { title: "Daily Score", sub: "habit XP minus penalties", html: Charts.bar({ values: week.days.map(d => d.score), unit: " XP", color: "var(--chart-blue)" }) },
    { title: "Cumulative XP", sub: "total XP growth across the week", html: Charts.line({ values: week.days.reduce((acc, d, i) => { acc.push((acc[i - 1] || 0) + d.score); return acc; }, []), unit: " XP", color: "var(--chart-gold)", area: true }) },
    { title: "Habit Completion", sub: "% of that day's habits", html: Charts.bar({ values: week.days.map(d => d.pct), unit: "%", max: 100, color: "var(--chart-green)" }) },
    { title: "Sleep", sub: `goal ${GOALS.sleepHours}h`, html: Charts.line({ values: days.map(d => d.metrics.sleepHours), goal: GOALS.sleepHours, unit: "h", color: "var(--chart-violet)" }) },
    { title: "Workout Minutes", sub: `goal ${GOALS.workoutMin} min`, html: Charts.bar({ values: days.map(d => d.metrics.workoutMin || 0), goal: GOALS.workoutMin, unit: "m", color: "var(--chart-blue)" }) },
    { title: "Water", sub: `goal ${GOALS.waterL}L`, html: Charts.bar({ values: days.map(d => d.metrics.waterL || 0), goal: GOALS.waterL, unit: "L", color: "var(--chart-blue)" }) },
    { title: "Reading Minutes", sub: `goal ${GOALS.readMin} min`, html: Charts.bar({ values: days.map(d => d.metrics.readMin || 0), goal: GOALS.readMin, unit: "m", color: "var(--chart-gold)" }) },
    { title: "Deep Work Hours", sub: `goal ${GOALS.deepWorkH}h`, html: Charts.bar({ values: days.map(d => d.metrics.deepWorkH || 0), goal: GOALS.deepWorkH, unit: "h", color: "var(--chart-green)" }) },
    { title: "Screen Time", sub: `limit ${SCREEN_LIMIT_MIN} min`, html: Charts.line({ values: days.map(d => d.metrics.screenMin), goal: SCREEN_LIMIT_MIN, unit: "m", color: "var(--chart-red)", danger: true }) },
  ];
  $("#analytics-grid").innerHTML = defs.map(d => `
    <div class="chart-card glass"><h3>${d.title}</h3><div class="chart-sub">${d.sub}</div>${d.html}</div>`).join("");
}

/* ---------- achievements ---------- */

function renderAchievements(justUnlocked = []) {
  const unlockedCount = Object.keys(state.meta.unlocked).length;
  $("#achieve-count").textContent = `${unlockedCount}/${ACHIEVEMENTS.length} unlocked`;
  $("#achievements-grid").innerHTML = ACHIEVEMENTS.map(a => {
    const un = !!state.meta.unlocked[a.id];
    const fresh = justUnlocked.some(x => x.id === a.id);
    return `<div class="achievement ${un ? "unlocked" : ""} ${fresh ? "just-unlocked" : ""}" data-ach="${a.id}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
      <div class="ach-xp">${un ? "✓ " : ""}+${a.xp} XP</div>
    </div>`;
  }).join("");
}

/* ---------- week report ---------- */

function computeReportScores(week) {
  const days = state.days;
  const elapsed = week.today;
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const cap = v => Math.round(Math.min(Math.max(v, 0), 100));

  const productivity = cap(avg(days.slice(0, elapsed).map((d, i) => {
    const m = d.metrics;
    const dw = Math.min((m.deepWorkH || 0) / GOALS.deepWorkH, 1.2);
    const habits = ["deepWork3h", "freelance", "contentCreation"].filter(h => d.habits[h]).length / 3;
    return (dw * 60 + habits * 40);
  })));

  const health = cap(avg(days.slice(0, elapsed).map(d => {
    const m = d.metrics;
    let pts = 0;
    pts += m.sleepHours ? Math.min(m.sleepHours / GOALS.sleepHours, 1) * 25 : 0;
    pts += Math.min((m.waterL || 0) / GOALS.waterL, 1) * 20;
    pts += Math.min((m.proteinG || 0) / GOALS.proteinG, 1) * 20;
    pts += ((m.workoutMin || 0) + (m.walkMin || 0)) >= 30 || d.habits.gymOrWalk ? 20 : 0;
    pts += (m.steps || 0) >= GOALS.steps || d.habits.steps8k ? 15 : 0;
    return pts;
  })));

  const discipline = cap(
    week.elapsedPct * 0.6 +
    (habitStreak("noSugar") / 7) * 20 +
    (days.slice(0, elapsed).filter(d => d.metrics.screenMin != null && d.metrics.screenMin <= SCREEN_LIMIT_MIN).length / elapsed) * 20
  );

  const career = cap(avg(days.slice(0, elapsed).map(d => {
    const m = d.metrics;
    const learn = (m.aiMin || 0) + (m.playwrightMin || 0) + (m.freelanceMin || 0) + (m.contentMin || 0);
    let pts = Math.min((m.deepWorkH || 0) / GOALS.deepWorkH, 1) * 40;
    pts += Math.min(learn / GOALS.learnMin, 1) * 30;
    pts += ["aiLearning", "qaLearning", "freelance", "contentCreation"].filter(h => d.habits[h]).length / 4 * 30;
    return pts;
  })) + Math.min(days.reduce((s, d) => s + (d.metrics.applications || 0), 0) * 3, 15));

  const mind = cap(avg(days.slice(0, elapsed).map(d => {
    const m = d.metrics;
    let pts = Math.min((m.readMin || 0) / GOALS.readMin, 1) * 40;
    pts += (d.habits.journalAM ? 30 : 0) + (d.habits.journalPM ? 30 : 0);
    return pts;
  })));

  const recovery = cap(avg(days.slice(0, elapsed).map(d => {
    const m = d.metrics;
    let pts = m.sleepHours ? Math.min(m.sleepHours / GOALS.sleepHours, 1) * 50 : 0;
    pts += (m.recovery || 0) / 5 * 25 + (m.energy || 0) / 5 * 25;
    return pts;
  })));

  const overall = cap((productivity + health + discipline + career) / 4);
  const grade = overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 65 ? "B" : overall >= 50 ? "C" : "D";
  return { productivity, health, discipline, career, mind, recovery, overall, grade };
}

function writtenReview(week, scores, best, worst) {
  const days = state.days;
  const elapsed = week.today;
  const p = [];

  const strengths = [];
  const weaknesses = [];
  if (scores.discipline >= 70) strengths.push("your habit discipline held up — the checklist got respected");
  if (scores.career >= 70) strengths.push("career output was strong (deep work + learning stacked consistently)");
  if (scores.health >= 70) strengths.push("body basics (water, protein, movement) were mostly on point");
  if (habitStreak("noSugar") >= 3) strengths.push(`a ${habitStreak("noSugar")}-day no-sugar streak — real willpower`);
  if (week.streak >= 3) strengths.push(`a ${week.streak}-day overall streak kept momentum alive`);
  if (!strengths.length) strengths.push("you showed up and logged data — that alone beats 90% of people");

  if (scores.discipline < 60) weaknesses.push("habit completion was inconsistent — too many unchecked boxes on core habits");
  if (scores.health < 60) weaknesses.push("health fundamentals slipped (sleep, water, or protein under target most days)");
  if (scores.career < 60) weaknesses.push("deep work hours came in under the 3h/day bar too often");
  if (scores.mind < 50) weaknesses.push("reading and journaling were the first things dropped — protect them");
  const dewMisses = days.slice(0, elapsed).filter(d => !d.habits.noDew).length;
  if (dewMisses >= 2) weaknesses.push(`Mountain Dew won ${dewMisses} day(s) — that's the #1 saboteur to kill next week`);
  if (!weaknesses.length) weaknesses.push("honestly, not much — keep raising the bar");

  const screenDays = days.slice(0, elapsed).filter(d => (d.metrics.screenMin || 0) > SCREEN_LIMIT_MIN);
  const totScreen = days.reduce((s, d) => s + (d.metrics.screenMin || 0), 0);
  const totSocial = days.reduce((s, d) => s + (d.metrics.socialMin || 0), 0);
  const totYt = days.reduce((s, d) => s + (d.metrics.youtubeMin || 0), 0);
  const totEnt = days.reduce((s, d) => s + (d.metrics.entertainmentMin || 0), 0);
  const wasters = [["social media", totSocial], ["YouTube", totYt], ["entertainment", totEnt]]
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  p.push(`<h4>Summary</h4><p>Week grade: <b>${scores.grade}</b> (${scores.overall}/100). You banked <b>${week.totalXp.toLocaleString()} XP</b>, finished at <b>Level ${week.level}</b>, and earned the rank of <b>${week.rank.name}</b>. Best day was <b>Day ${best.n}</b> (${best.pct}% · ${best.score} XP); the roughest was <b>Day ${worst.n}</b> (${worst.pct}% · ${worst.score} XP).</p>`);
  p.push(`<h4>Strengths</h4><ul>${strengths.map(s => `<li>${s}</li>`).join("")}</ul>`);
  p.push(`<h4>Weaknesses</h4><ul>${weaknesses.map(s => `<li>${s}</li>`).join("")}</ul>`);
  p.push(`<h4>Biggest time wasters</h4><p>${
    totScreen === 0 && !wasters.length
      ? "No screen time logged — either you were a monk or you didn't track it. Track it next week."
      : `Total screen time: <b>${totScreen} min</b>${screenDays.length ? `, over the ${SCREEN_LIMIT_MIN}-minute limit on ${screenDays.length} day(s)` : ""}. ${wasters.length ? "Top drains: " + wasters.map(([k, v]) => `<b>${k}</b> (${v} min)`).join(", ") + "." : ""}`
  }</p>`);

  const recs = [];
  const weakest = Object.entries({ Productivity: scores.productivity, Health: scores.health, Discipline: scores.discipline, Career: scores.career }).sort((a, b) => a[1] - b[1])[0];
  recs.push(`Attack your weakest pillar first: <b>${weakest[0]}</b> (${weakest[1]}/100). One targeted fix there moves the whole grade.`);
  if (dewMisses > 0) recs.push("Remove Mountain Dew from the house entirely — willpower is for emergencies, environment design wins wars.");
  if (scores.career < 80) recs.push("Schedule deep work as the FIRST block of the day, before the phone gets a vote.");
  if (screenDays.length > 0) recs.push("Put the phone in another room during work blocks; grayscale mode after 8 PM.");
  if (scores.health < 80) recs.push("Prep water bottles (3L) and protein the night before — decide once, execute daily.");
  recs.push("Next week: keep the same habit list, raise the streak target, and aim for your first " + (week.days.filter(d => d.perfect).length ? "back-to-back perfect days." : "Perfect Day."));
  p.push(`<h4>Recommendations for next week</h4><ul>${recs.map(r => `<li>${r}</li>`).join("")}</ul>`);
  return p.join("");
}

function renderReport() {
  const week = computeWeek();
  const scores = computeReportScores(week);
  const rated = week.days.slice(0, week.today);
  const best = [...rated].sort((a, b) => b.score - a.score || b.pct - a.pct)[0];
  const worst = [...rated].sort((a, b) => a.score - b.score || a.pct - b.pct)[0];

  const scoreTile = (label, val, color) => `
    <div class="report-score-tile">
      <div class="rs-label">${label}</div>
      <div class="rs-value">${val}<small style="font-size:13px;color:var(--text-3)">/100</small></div>
      <div class="rs-bar"><i style="width:${val}%;background:${color}"></i></div>
    </div>`;

  const heatRows = HABITS.map(h => `
    <tr><th>${h.label}</th>${state.days.map((d, i) => {
      const applies = !h.days || h.days.includes(i + 1);
      const cls = !applies ? "future-cell" : i + 1 > week.today ? "future-cell" : d.habits[h.id] ? "done" : "missed";
      return `<td class="${cls}" title="${h.label} — Day ${i + 1}${applies ? "" : " (off day)"}"></td>`;
    }).join("")}</tr>`).join("");

  $("#report-content").innerHTML = `
    <div class="report-grade-row">
      <div class="grade-card glass">
        <div class="grade-letter">${scores.grade}</div>
        <div class="grade-label">Overall Grade · ${scores.overall}/100</div>
      </div>
      <div class="card glass" style="margin:0">
        <div class="card-header"><h2>📊 Pillar Scores</h2><span class="card-header-meta">Day ${week.today} of 7</span></div>
        <div class="report-scores">
          ${scoreTile("Productivity", scores.productivity, "var(--chart-blue)")}
          ${scoreTile("Health", scores.health, "var(--chart-green)")}
          ${scoreTile("Discipline", scores.discipline, "var(--gold)")}
          ${scoreTile("Career", scores.career, "var(--chart-violet)")}
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card glass" style="margin:0">
        <div class="card-header"><h2>🕸 Performance Radar</h2></div>
        ${Charts.radar({ axes: ["Productivity", "Health", "Discipline", "Career", "Mind", "Recovery"], values: [scores.productivity, scores.health, scores.discipline, scores.career, scores.mind, scores.recovery] })}
      </div>
      <div class="stack">
        <div class="best-worst">
          <div class="bw-tile best"><div class="bw-label">🏆 Best Day</div><div class="bw-day">Day ${best.n}</div><div class="bw-score">${best.pct}% habits · ${best.score} XP</div></div>
          <div class="bw-tile worst"><div class="bw-label">💀 Worst Day</div><div class="bw-day">Day ${worst.n}</div><div class="bw-score">${worst.pct}% habits · ${worst.score} XP</div></div>
        </div>
        <div class="card glass" style="margin:0">
          <div class="card-header"><h2>🗺 Habit Heatmap</h2><span class="card-header-meta">green = kept · red = missed</span></div>
          <div class="heatmap-scroll">
            <table class="heatmap-table">
              <tr><th></th>${Array.from({ length: 7 }, (_, i) => `<th class="hm-day">D${i + 1}</th>`).join("")}</tr>
              ${heatRows}
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="card glass" style="margin:0">
      <div class="card-header"><h2>📝 Performance Review</h2><span class="card-header-meta">auto-generated from your data</span></div>
      <div class="review-text">${writtenReview(week, scores, best, worst)}</div>
    </div>`;
  $("#report-content").hidden = false;
  if (scores.grade === "A+" || scores.grade === "A") FX.confetti();
}

/* ==========================================================================
   Master update
   ========================================================================== */

let lastQuoteDay = -1;

function updateAll(opts = {}) {
  const week = computeWeek();

  // achievements first (they add XP)
  const newly = checkAchievements(week);
  const finalWeek = newly.length ? computeWeek() : week;

  renderHero(finalWeek);
  renderDayTabs(finalWeek);
  renderScoreCard(finalWeek);
  renderWarnings(finalWeek);
  $("#habit-count").textContent = `${finalWeek.days[state.selectedDay - 1].habitsDone}/${finalWeek.days[state.selectedDay - 1].habitsTotal} · ${finalWeek.days[state.selectedDay - 1].earned} XP earned`;
  $("#habit-progress-fill").style.width = finalWeek.days[state.selectedDay - 1].pct + "%";

  if (opts.fullHabits !== false) renderHabits(finalWeek);
  if (opts.metrics !== false) renderMetricCards();

  // re-render whichever heavy panel is open
  const active = document.querySelector(".section-tab.active")?.dataset.panel;
  if (active === "panel-career") renderCareer();
  if (active === "panel-fitness") renderFitness();
  if (active === "panel-detox") renderDetox();
  if (active === "panel-analytics") renderAnalytics(finalWeek);

  renderAchievements(newly);

  // celebrations
  for (const a of newly) {
    toast(`Achievement unlocked: ${a.name} (+${a.xp} XP)`, a.icon, "toast-gold");
    const el = document.querySelector(`[data-ach="${a.id}"]`);
    if (el) FX.burstAt(el);
  }
  if (newly.length) FX.burstAt($("#stat-xp"), 20);

  // perfect day confetti (once per day)
  const dsel = finalWeek.days[state.selectedDay - 1];
  if (dsel.perfect && !state.meta.celebratedPerfect[state.selectedDay]) {
    state.meta.celebratedPerfect[state.selectedDay] = true;
    FX.confetti();
    toast("PERFECT DAY! Every habit crushed. 🌟", "🎉", "toast-gold");
  }

  // level up
  if (finalWeek.level > state.meta.lastLevel) {
    showLevelUp(finalWeek.level);
    toast(`Level ${finalWeek.level} reached!`, "⬆️", "toast-gold");
  }
  state.meta.lastLevel = finalWeek.level;

  save();
}

function switchDay(n) {
  state.selectedDay = n;
  renderHabits(computeWeek());
  renderMetricCards();
  renderJournal();
  renderCareer();
  renderFitness();
  renderDetox();
  updateAll({ fullHabits: false, metrics: false });
}

function switchPanel(panelId) {
  document.querySelectorAll(".section-tab").forEach(t => t.classList.toggle("active", t.dataset.panel === panelId));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === panelId));
  const week = computeWeek();
  if (panelId === "panel-analytics") renderAnalytics(week);
  if (panelId === "panel-career") renderCareer();
  if (panelId === "panel-fitness") renderFitness();
  if (panelId === "panel-detox") renderDetox();
  if (panelId === "panel-journal") renderJournal();
}

/* ==========================================================================
   Events
   ========================================================================== */

// habit toggles (delegated)
$("#habit-list").addEventListener("change", e => {
  const habitEl = e.target.closest(".habit");
  if (!habitEl) return;
  const id = habitEl.dataset.habit;
  const h = HABITS.find(x => x.id === id);
  const checked = habitEl.querySelector("input").checked;
  selDay().habits[id] = checked;
  habitEl.classList.toggle("checked", checked);
  floatXp(habitEl, checked ? h.xp : -h.xp);
  if (checked) FX.burstAt(habitEl.querySelector(".hb-box"), 10);
  updateAll({ fullHabits: false });
});

// day tabs
$("#day-tabs").addEventListener("click", e => {
  const tab = e.target.closest(".day-tab");
  if (tab) switchDay(Number(tab.dataset.day));
});

// section tabs
$("#section-tabs").addEventListener("click", e => {
  const tab = e.target.closest(".section-tab");
  if (tab) switchPanel(tab.dataset.panel);
});

// numeric metric inputs (delegated, debounced re-render of computed bits only)
let metricTimer = null;
document.addEventListener("input", e => {
  const t = e.target;
  if (t.matches("[data-metric]")) {
    const v = t.value === "" ? null : Number(t.value);
    selDay().metrics[t.dataset.metric] = (v == null || Number.isNaN(v)) ? null : v;
    clearTimeout(metricTimer);
    metricTimer = setTimeout(() => updateAll({ metrics: !t.hasAttribute("data-quick") ? true : false, fullHabits: false }), 500);
    save();
  }
  if (t.matches("[data-metric-text]")) {
    selDay().metrics[t.dataset.metricText] = t.value;
    save();
  }
  if (t.matches("[data-journal]")) {
    selDay().journal[t.dataset.journal] = t.value;
    save();
  }
});

// quick inputs commit on Enter/blur → refresh cards
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches("[data-quick]")) e.target.blur();
});
document.addEventListener("blur", e => {
  if (e.target.matches && e.target.matches("[data-quick]")) updateAll({ fullHabits: false });
}, true);

// steppers + emoji scales (delegated clicks)
document.addEventListener("click", e => {
  const stepBtn = e.target.closest("[data-stepper] button");
  if (stepBtn) {
    const wrap = stepBtn.closest("[data-stepper]");
    const id = wrap.dataset.stepper;
    const cur = selDay().metrics[id] || 0;
    const next = Math.max(0, cur + Number(stepBtn.dataset.step));
    selDay().metrics[id] = next;
    wrap.querySelector(".stepper-val").textContent = next;
    updateAll({ fullHabits: false, metrics: false });
    return;
  }
  const emojiBtn = e.target.closest("[data-emoji] button");
  if (emojiBtn) {
    const wrap = emojiBtn.closest("[data-emoji]");
    const id = wrap.dataset.emoji;
    const val = Number(emojiBtn.dataset.val);
    selDay().metrics[id] = selDay().metrics[id] === val ? 0 : val;
    updateAll({ fullHabits: false });
    return;
  }
});

// theme
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("#btn-theme").textContent = state.theme === "dark" ? "◐" : "◑";
}
$("#btn-theme").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(); save();
});

// exports
function exportCsv() {
  const rows = [["Field", ...Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`)]];
  for (const h of HABITS) rows.push([h.label, ...state.days.map(d => d.habits[h.id] ? "YES" : "no")]);
  const metricKeys = Object.keys(emptyDay().metrics);
  for (const k of metricKeys) rows.push([k, ...state.days.map(d => d.metrics[k] ?? "")]);
  const week = computeWeek();
  rows.push(["Day Score", ...week.days.map(d => d.score)]);
  rows.push(["Day %", ...week.days.map(d => d.pct + "%")]);
  rows.push(["Total XP", week.totalXp]);
  rows.push(["Level", week.level]);
  rows.push(["Rank", week.rank.name]);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `week-maxxing-${state.startDate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported week-maxxing CSV (opens in Excel)", "📊");
}
$("#btn-export-excel").addEventListener("click", exportCsv);
$("#btn-export-pdf").addEventListener("click", () => { toast("Opening print dialog — choose 'Save as PDF'", "🖨"); setTimeout(() => print(), 400); });

// report
$("#btn-generate-report").addEventListener("click", () => { renderReport(); });

// reset
$("#btn-reset").addEventListener("click", () => {
  if (confirm("Reset the entire week? All data will be wiped.")) {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    location.reload();
  }
});

// modal
const modal = $("#modal-shortcuts");
$("#btn-shortcuts").addEventListener("click", () => { modal.hidden = false; });
modal.addEventListener("click", e => {
  if (e.target === modal || e.target.closest("[data-close]")) modal.hidden = true;
});

// keyboard shortcuts
document.addEventListener("keydown", e => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if (e.key === "Escape") { modal.hidden = true; $("#levelup-overlay").hidden = true; return; }
  if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key >= "1" && e.key <= "7") switchDay(Number(e.key));
  else if (e.key === "t" || e.key === "T") $("#btn-theme").click();
  else if (e.key === "h" || e.key === "H") switchPanel("panel-today");
  else if (e.key === "a" || e.key === "A") switchPanel("panel-analytics");
  else if (e.key === "g" || e.key === "G") switchPanel("panel-achievements");
  else if (e.key === "r" || e.key === "R") { switchPanel("panel-report"); renderReport(); }
  else if (e.key === "e" || e.key === "E") exportCsv();
  else if (e.key === "p" || e.key === "P") print();
  else if (e.key === "?") modal.hidden = false;
});

/* ==========================================================================
   Clock + quote
   ========================================================================== */

function tickClock() {
  const now = new Date();
  $("#top-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("#top-time").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dayN = todayDayNumber();
  if (dayN !== lastQuoteDay) {
    lastQuoteDay = dayN;
    $("#quote").textContent = "“" + QUOTES[(dayN * 3 + now.getDay()) % QUOTES.length] + "”";
  }
}
setInterval(tickClock, 1000);

/* ==========================================================================
   Init
   ========================================================================== */

state.selectedDay = Math.min(Math.max(state.selectedDay, 1), 7);
// default the selected day to today on load
state.selectedDay = todayDayNumber();
applyTheme();
tickClock();
renderJournal();
renderCareer();
renderFitness();
renderDetox();
updateAll();
