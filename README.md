# 🏙️ Fitzrovia · Rental Comp Intelligence

> A live dashboard that tells Fitzrovia what their competitors are charging for rent — in real time.

Built as the take-home for the **AI & Software Development Intern** interview (March 2026).

---

## 👋 What is this?

Imagine you run a fancy apartment building. Every day, you need to answer one question:

> **"What are the buildings down the street charging — and are we priced right?"**

Today, most teams answer that with a spreadsheet, a bunch of browser tabs, and a lot of hope. This app replaces all of that.

It **scrapes real rental prices** from 10 competing buildings in Midtown Toronto every time you hit a button, does the math to figure out the *real* price (not just the sticker price — more on that below), and shows it all on one clean dashboard.

---

## ✨ What it does

🏢 **Live comp dashboard** — see every competing building's prices in one place
🔄 **One-click scrape** — press a button, get fresh prices in ~3 minutes
💰 **Effective rent math** — if a building is offering "1 month free," this app tells you the *real* monthly cost
📊 **Apples-to-apples compare** — rank any unit type across all buildings by real price, not marketing fluff
💬 **Ask anything** — type questions like *"cheapest 2-bed"* or *"buildings with incentives"* in plain English
📄 **Executive PDF** — one-click export of a branded, presentation-ready report
🔐 **Login + roles** — admins, analysts, and viewers each see what they should

---

## 🎯 The big idea: sticker price ≠ real price

This is the heart of the project. Most apartment operators advertise a rent like **$2,400/month** but sweeten the deal with things like:

- 🎁 "1 month free"
- 💵 "$500 move-in credit"
- 🏷️ "10% off your first year"

If you just look at the number on the website, you'll think two buildings are priced the same. They're not! This app does the math and shows you the **effective rent** — what you'd *actually* pay if you averaged the deal over 12 months.

Example: A unit listed at $2,400 with **1 month free** is really $2,200/month. That's a huge difference when you're setting prices for your own building. 💡

---

## 🚀 Try it locally

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Then open 👉 [http://localhost:3000](http://localhost:3000)

### 🔑 Demo logins

| Email | Password | What they can do |
| --- | --- | --- |
| `admin@fitzrovia.ca` | `fitzrovia-admin-2026` | Everything 👑 |
| `analyst@fitzrovia.ca` | `fitzrovia-analyst-2026` | Scrape + view + export 📊 |
| `viewer@example.com` | `viewer-demo-2026` | View + export PDF 👀 |

Or sign up with your own email at `/signup`. Any `@fitzrovia.ca` email becomes an analyst automatically; everyone else starts as a viewer.

---

## 🛠️ What's under the hood (the non-scary version)

Here's what each piece does, in plain English:

| Piece | What it is | Why I picked it |
| --- | --- | --- |
| **Next.js 16** ⚛️ | The framework that runs the whole app | One codebase, one deploy — no separate "backend" to manage |
| **TypeScript** 📘 | JavaScript with safety rails | Catches mistakes before they hit the user |
| **Tailwind CSS** 🎨 | Styling toolkit | Fast to build with, consistent look everywhere |
| **Firecrawl** 🔥 | A service that grabs live web pages for me | Handles anti-bot walls so I don't have to run my own web browser fleet |
| **@react-pdf/renderer** 📄 | Turns the dashboard into a PDF | No janky "print the screen" hacks — proper PDF output |
| **Node's `scrypt`** 🔒 | Built-in password encryption | No third-party login service needed for a demo |
| **Render** ☁️ | Where the app is hosted | Handles the 3-minute scrape without timing out (Vercel couldn't) |

---

## 🔐 Logging in

Passwords are **encrypted** (using Node's built-in `scrypt`, the same thing big banks use). They're stored in a local file that's never checked into GitHub. The login system checks them carefully to make sure no one can guess them by timing attacks. 🕵️

In a real production version, I'd move this into a proper database (Postgres) and probably add two-factor authentication for admin accounts.

---

## 📂 How the code is organized

Folders are grouped by **feature**, not by file type. It reads a bit like a table of contents:

```
app/              The pages you see in your browser
interface/        The React components that build each page
features/         The "brain" — scraping, math, auth, data
  sources/        The web scraper
middleware.ts     The bouncer that checks you're logged in
```

Each folder has a clear job. If you want to know how the scraper works, you look in `features/sources/`. If you want to know how the PDF is built, it's in `features/pdf-report.tsx`. No mystery. 🔍

---

## 🙋 What's still rough (being honest)

This is a take-home, not a shipped product. Here's what I'd flag:

- **📦 Data is ephemeral** — the app remembers today's prices but not yesterday's. A real version would store every scrape in a database so you could see trends over time.
- **🕸️ Scrapers can break** — if a competing building redesigns their website, my parser might miss listings. Today the app tells you honestly *"this source returned nothing"* instead of pretending everything's fine.
- **🛂 The login is demo-grade** — works, but it's a simple file-based system. Production would use Postgres + proper session management.
- **🏘️ The 10 buildings are hardcoded** — adding a new submarket means a code change, not a UI toggle.
- **🌙 No alerting** — if a scrape fails at 3 AM, no one knows until they open the dashboard.

---

## 🔮 What I'd build next

If I had another week:

1. **📈 Save scrape history to a real database** so you can see rent trends week over week
2. **🤖 Hook up Claude for the "Ask anything" bar** so it can answer open-ended questions, not just the predefined ones
3. **🚨 Alerts** — "The Whitney just dropped their 2-bed by 8%" → Slack + email
4. **🌍 More submarkets** — King West, Liberty Village, wherever Fitzrovia cares about
5. **✅ A test suite** for the scraper so site redesigns don't silently break things

---

## 💌 About this build

This was built over 5 days as a take-home for Fitzrovia. I tried to focus on:

- 🎯 Making **one thing** really good (the effective-rent math + compare view)
- 🧱 Writing code that's easy for the next person to read
- 🚫 Being honest about what's demo-grade vs. production-ready

The whole thing — scraper, dashboard, PDF, login, natural-language search — runs as one deployable app. No separate services, no exotic dependencies, nothing a Fitzrovia engineer couldn't pick up in an afternoon.

Thanks for reading! 🙏

---

**Tech used:** Next.js 16 · React 19 · TypeScript · Tailwind · Firecrawl · @react-pdf/renderer · Node scrypt · Render
