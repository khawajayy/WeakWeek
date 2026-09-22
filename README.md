# Week Maxxing — Monk Mode 🧘

> **A high-performance, gamified weekly dashboard built to optimize daily execution, discipline, and focus.**

---

## 📖 Overview

**Week Maxxing** is a single-page, local-first web application engineered around a disciplined 7-day sprint ("Monk Mode"). It bridges habit tracking, macro nutrition, career productivity, digital detox, and personal reflection into a cohesive RPG-inspired gamification system.

Track your days, complete daily protocols, earn XP, level up, unlock achievements, and archive your weekly performance reviews—all with zero bloat and instant responsiveness.

---

## ⚡ Key Features

### 1. ⚡ Daily Habit Protocol & Gamification
- **XP Progression & Levels**: Earn XP for each completed habit. Level up along a quadratic XP curve (`75 × (level − 1) × level`).
- **Rank Tiers**: Rise through 7 discipline ranks:
  - 👤 **Civilian** (0 XP)
  - 🥋 **Disciplined** (250 XP)
  - 🎯 **Focused** (600 XP)
  - ⚔️ **Warrior** (1,000 XP)
  - 🦅 **Elite** (1,500 XP)
  - 🧘 **Monk** (2,100 XP)
  - 👑 **Legend** (2,600 XP)
- **Discipline Penalties**: Strict habits (e.g. No Mountain Dew, No Sugar, Fast Food, Late Sleep) penalize missed days with negative XP.
- **🎉 Cheat Day Mode**: Toggleable per day to pause nutrition discipline penalties without breaking momentum.
- **Rings & Visual Progress**: Real-time SVG rings showing today's completion and weekly pace.
- **🏆 22 Unlockable Achievements**: Visual badge unlocks celebrating milestones (e.g., *First Blood*, *Centurion*, *Steadfast Prayers*, *Hydro Homie*, *Monk Mode*).

---

### 2. ⚙️ In-App Admin Panel (Custom Habits & XP Adjustments)
Take full control of your habit protocol:
- **Add Custom Habits**: Create habits with custom titles, categories/groups, custom XP rewards, optional missed penalties, and day schedules (All 7 days, Workdays, Weekends, or custom days).
- **Adjust XP & Penalties**: Fine-tune the XP value of any habit directly inline with instant recalculation of your day score, level, and stats.
- **Remove Habits**: Safely delete habits you no longer wish to track with confirmation safeguards.
- **Factory Presets**: One-click "Restore Default Habits" to return to the core factory setup at any time.
- **Instant Persistence & Sync**: All habit modifications are stored in your state and automatically synced to your cloud account.

---

### 3. 🗓️ 7-Day Sprint Architecture & Weekly Archive
- **Monday-Anchored Weeks**: Each week runs Monday (Day 1) through Sunday (Day 7).
- **🔒 Close Week & Archive**: At the end of the week, bank your habit XP, archive a permanent performance snapshot (grades, pillar radar, heatmap), and start a fresh week.
- **Rollover**: Pending tasks and scratchpad notes automatically carry over into the new week.

---

### 4. 🍽️ Food Journal & Macro Tracker
- Log meals (*Breakfast*, *Lunch*, *Dinner*, *Snacks*) with Calories, Protein (g), Carbs (g), Fiber (g), and Fat (g).
- Live macro summary tiles and progress against nutritional targets.
- **Auto-tracked habits**: Protein habit (`Protein ≥ 100g`) automatically checks off when logged in your food journal.

---

### 5. 💼 Career Engine & Deep Work
- Track **Deep Work Hours** and **Pomodoro intervals**.
- Daily logs for AI Learning, QA Learning, Freelancing, Content Creation, and Job Applications.
- Interactive weekly charts visualizing deep work and career velocity.

---

### 6. 💪 Fitness & Digital Detox
- Log workout duration, walking minutes, step counts, energy, recovery, and mood.
- **🍭 No-Sugar Command Center**: Live streak visualizer tracking daily sugar discipline.
- **📵 Phone Detox**: Screen time tracker with customizable limits (alerts and −20 XP penalty if screen time exceeds 120 min).
- **📖 Reading Tracker**: Track daily pages read, minutes, and book titles.

---

### 7. 🌅 Daily Reflection Journal & Notes
- Structured prompts for Morning protocol (Priorities P1-P3, Mission) and Night review (Wins, Lessons, Gratitude).
- Week-wide scratchpad notes with pinning support (`Ctrl+Enter` quick save).

---

### 8. 📊 Analytics & Reporting
- Dependency-free SVG charts: Habit completion, Deep work, Screen time, Macro distributions.
- Radar charts scoring your 5 core life pillars: *Productivity*, *Discipline*, *Health*, *Growth*, and *Mindfulness*.
- Comprehensive End of Week Report with full 7-day habit heatmap.
- **Exporting**: One-click export to **Excel (CSV)** and **Printable PDF**.

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>1</kbd>–<kbd>7</kbd> | Jump to Day 1 through Day 7 |
| <kbd>H</kbd> | Navigate to **Today** panel |
| <kbd>D</kbd> | Navigate to **Tasks** panel |
| <kbd>F</kbd> | Navigate to **Food Journal** |
| <kbd>N</kbd> | Navigate to **Notes** scratchpad |
| <kbd>A</kbd> | Navigate to **Analytics** |
| <kbd>G</kbd> | Navigate to **Achievements** |
| <kbd>R</kbd> | View **Week Report** |
| <kbd>O</kbd> | Open **Admin Panel** (Manage Habits & XP) |
| <kbd>T</kbd> | Toggle Dark / Light theme |
| <kbd>E</kbd> | Export data to Excel (CSV) |
| <kbd>P</kbd> | Export to PDF (Print layout) |
| <kbd>?</kbd> | Open Keyboard Shortcuts modal |
| <kbd>Esc</kbd> | Close any open dialog or modal |

---

## 🛠️ Architecture & Tech Stack

```
WeekMaxxing/
├── index.html          # Application structure & modal containers
├── css/
│   └── styles.css      # Glassmorphic CSS design system (Dark & Light tokens)
├── js/
│   ├── app.js          # Core engine (Store, Engine, Charts, FX, UI, Admin Panel)
│   └── sync.js         # Cloud sync module (Firebase Auth + Firestore)
└── README.md           # Documentation
```

- **Zero Build Step**: Native ES2022 JavaScript, HTML5, and CSS3. Runs directly in any modern browser without npm or bundlers.
- **Local-First Storage**: All state is continuously saved in `localStorage` under key `weekMaxxing.v1`.
- **Cloud Sync**: Built-in optional Firebase Auth (Google Sign-In) and Firestore backend with conflict resolution (newest device timestamp wins).
- **Lightweight SVG Charts**: Handcrafted SVG builders for radial progress, bar charts, heatmaps, and radar charts.

---

## 🚀 Getting Started

### Local Development
Because Week Maxxing uses standard web technologies and ES modules for Firebase:
1. Clone the repository:
   ```bash
   git clone https://github.com/khawajayy/WeakWeek.git
   cd WeakWeek
   ```
2. Serve using any local HTTP server (required for ES module imports):
   - **VS Code**: Right click `index.html` → *Open with Live Server*
   - **Python**:
     ```bash
     python -m http.server 8000
     ```
   - **Node / npx**:
     ```bash
     npx serve .
     ```
3. Open `http://localhost:8000` in your web browser.

---

## 🔒 Privacy & Data Ownership

- If you do not sign in, **all your data stays strictly in your browser's `localStorage`**.
- If you sign in with Google, your data is encrypted and synced only to your private document in Google Firestore (`users/{uid}/data/current`).
- You can export your full data snapshot at any time using the CSV export button (<kbd>E</kbd>).

---

## 📄 License

MIT License. Designed and crafted for peak personal performance.
