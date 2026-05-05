<div align="center">

# 🐼 Lazy Panda

**AI-powered academic scheduling assistant for students**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-7c6ff7?style=for-the-badge&logo=github)](https://atifahmed615.github.io/Lazy-panda/)
[![PWA](https://img.shields.io/badge/PWA-Installable-34d399?style=for-the-badge&logo=pwa)](https://atifahmed615.github.io/Lazy-panda/)
[![Google Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-f87171?style=for-the-badge)](https://gemini.google.com)

*Built for  Students  — manages classes, tasks, and daily planning through a conversational AI assistant.*

![Lazy Panda Screenshot](icon.svg)

</div>

---

## ✨ Features

- **📅 Smart Dashboard** — See your next class with a live countdown timer, today's full schedule timeline, and task overview at a glance
- **🤖 AI Assistant** — Powered by Google Gemini AI. Talk naturally to add events, reschedule classes, detect conflicts, and get smart suggestions
- **✅ Task Manager** — Track tasks by priority (high/medium/low) with due dates, split into Today and Upcoming views
- **🔁 Recurring Events** — Support for daily, weekly, and weekend recurring schedules
- **📱 PWA — Installable as a Mobile App** — Works fully offline after first load; installs on Android and iPhone like a native app
- **💾 Local Storage** — All data persists on your device; nothing is sent to any server
- **🌙 Dark Mode** — Beautiful dark UI designed for late-night study sessions

---

## 📱 Install as Mobile App

### Android (Chrome)
1. Open the live URL in **Chrome**
2. Wait a few seconds for the install banner
3. Tap **"Add Lazy Panda to Home screen"** → **Install**

### iPhone (Safari)
1. Open the live URL in **Safari**
2. Tap the **Share button** (box with arrow)
3. Tap **"Add to Home Screen"** → **Add**

> ⚠️ On iPhone, use Safari — Chrome on iOS does not support PWA installation.

---

## 🤖 Setting Up the AI Assistant

The AI assistant requires a Google Gemini API key to function.

1. Get your API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open Lazy Panda → go to **Settings** tab
3. Paste your key under **Gemini API Key** → tap **Save Key**

> 🔒 Your API key is stored **only on your device** in localStorage. It is never sent to any server other than Google Gemini API directly.

### What the AI can do
- *"What classes do I have today?"*
- *"Add a study session tomorrow at 9 PM for 2 hours"*
- *"Move my ML class to 6 PM"*
- *"Create a task: Review backpropagation notes, due today, high priority"*
- *"What free time do I have today?"*
- *"Schedule revision time before my next exam"*

---

## 🗂️ File Structure

```
lazy-panda/
├── index.html       # Main app (entire frontend — single file)
├── manifest.json    # PWA manifest (name, icons, display mode)
├── sw.js            # Service worker (offline caching)
├── icon.svg         # App icon (panda logo)
└── README.md        # This file
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Fonts | DM Sans + DM Mono (Google Fonts) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Storage | Browser localStorage |
| Hosting | GitHub Pages |
| PWA | Web App Manifest + Service Worker |

No frameworks. No build tools. No backend. Just one HTML file.

---

## 🚀 Deploy Your Own

1. **Fork** this repository
2. Go to repo **Settings → Pages**
3. Set source to **Deploy from branch → main → / (root)**
4. Your app will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/`

---

## 📆 Pre-loaded Schedule

The app comes pre-loaded with a full weekly class schedule:

| Day | Class | Time | Location |
|-----|-------|------|----------|
| Monday | Machine Learning | 18:00 – 21:00 | NED CIS Department |
| Tuesday | Mathematics for AI | 18:00 – 21:00 | NED CIS Department |
| Wednesday | Introduction to AI | 18:00 – 21:00 | NED CIS Department |
| Thursday | Understanding Holy Quran 1 | 18:00 – 21:00 | NED Auditorium |
| Friday | AI-Driven Dev & Claude Code | 20:00 – 22:00 | Online |
| Sat & Sun | PGD: Machine Learning | 11:00 – 13:00 | NED Textile Department |
| Saturday | CAIPP | 14:00 – 18:00 | PNEC CS Department |
| Sat & Sun | AI-Driven Dev & Claude Code | 20:00 – 22:00 | Online |

You can edit or delete any event directly in the app.

---

## 🔒 Privacy

- No user accounts, no sign-up
- All schedule and task data is stored locally on your device only
- API key is stored in localStorage and sent only to `generativelanguage.googleapis.com` (Google)
- No analytics, no tracking, no ads

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
  <sub>Built with ☕ and 🐼 energy · MS AI Student · NED University, Karachi</sub>
</div>
