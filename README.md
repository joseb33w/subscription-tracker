# Subscription Tracker

A sleek, dark-themed dashboard for tracking recurring subscriptions, burn rate, and payment history -- powered by Supabase.

**Live:** [joseb33w.github.io/subscription-tracker](https://joseb33w.github.io/subscription-tracker/)

---

## Features

- **Authentication** -- Sign up / sign in with email and password (Supabase Auth)
- **Dashboard** -- Monthly burn rate, active count, yearly total, next billing alerts
- **Add Subscriptions** -- Name, cost, billing cycle (weekly/monthly/quarterly/yearly), category, currency, next billing date
- **Inline Edit** -- Tap any subscription to edit details in-place
- **Active / Inactive Toggle** -- Pause subscriptions without deleting them
- **Categories** -- Streaming, Music, Cloud, AI, Fitness, Creative, Entertainment, Web, Other
- **Spending Chart** -- Monthly spending trend via Chart.js
- **Payment History** -- Log and track individual payments
- **Renewal Alerts** -- Upcoming billing reminders with color-coded urgency badges
- **Realtime Sync** -- Supabase realtime subscriptions keep data fresh across devices
- **Mobile-First** -- Fully responsive dark UI designed for phones

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES Modules) |
| Styling | Custom CSS (dark theme with CSS variables) |
| Charts | Chart.js via CDN |
| Icons | Font Awesome 6 via CDN |
| Fonts | Inter via Google Fonts |
| Backend | Supabase (Auth, Database, Realtime) |
| Hosting | GitHub Pages |

## Project Structure

```
subscription-tracker/
  index.html      -- Entry point (CDN imports)
  app.js          -- Full app logic (auth, CRUD, charts, realtime)
  styles.css      -- Dark theme styles
  README.md
```

## Getting Started

1. Visit the live app at https://joseb33w.github.io/subscription-tracker/
2. Create an account (email + password)
3. Confirm your email, then sign in
4. Start adding your subscriptions!

---

Built with Supabase
