# Redemption Arc

A 91-day (Oct 1 – Dec 30, 2026) tracker for health, career output, money, and mindset. Static site — no build step, no server. Data is stored in your own free Firebase project (Firestore) behind Google sign-in, so the same data shows up wherever you open the page.

## What's inside

- **Dashboard** — day-of-91 progress arc, today's 6 non-negotiables, streak, weight trend, career output bars, money saved, Excel export.
- **Today** — daily log (wake/sleep/steps/water/calories/junk/career task + bonus signals) with a live 0–100 score and a craving log.
- **Career** — 13-week curriculum (Python → JS → Angular → full-stack → capstone → review), each with a production project, 2 mini projects, and a LinkedIn-post counter (48 posts / 12 production / 24 mini target).
- **Skills** — Python / JavaScript / HTML-CSS / Angular mastery checklists.
- **Relax** — 10 activities on a daily rotation.
- **Finance** — running "money saved by not ordering" total vs. a goal, weekly chart.
- **Milestones** — Day 30 / 60 / 90 checkpoints (weight, hair note, portfolio snapshot, followers).
- **Weekly Review** — a 4-question Sunday ritual (body / career / money / mind) for all 13 weeks.

## 1. Create your Firebase project (free, ~5 minutes)

1. Go to the [Firebase console](https://console.firebase.google.com/) and click **Add project**. Name it anything (e.g. `redemption-arc`). You can disable Google Analytics for this project.
2. In the left sidebar: **Build → Authentication → Get started**. Under **Sign-in method**, enable **Google**, pick a support email, and save.
3. **Build → Firestore Database → Create database**. Start in **production mode**, pick any region close to you.
4. Still in Firestore, go to the **Rules** tab and replace the contents with what's in [`firestore.rules`](./firestore.rules) in this repo, then **Publish**. This is what guarantees nobody but you can ever read or write your data.
5. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web) icon → register an app (any nickname) → it shows you a `firebaseConfig` object.
6. Copy those values into [`firebase-config.js`](./firebase-config.js) in this repo, replacing the placeholders.
7. Back in **Authentication → Settings → Authorized domains**, add the GitHub Pages domain you'll use, e.g. `yourusername.github.io` (you can add this after step 2 below once you know the exact URL).

## 2. Host it on GitHub Pages

```bash
git init
git add .
git commit -m "Redemption Arc tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from branch → main / (root)**. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

Don't forget to add that exact domain to Firebase's **Authorized domains** (step 7 above) or Google sign-in will refuse to work there.

## 3. Use it

Open the GitHub Pages URL on any device, sign in with the same Google account every time, and your data follows you. Use the **Export to Excel** button on the Dashboard any time you want a `.xlsx` copy of everything (daily log, career, skills, weekly reviews, milestones) as a local file.

## Notes

- `firebase-config.js`'s values are not secret — they identify your project, not grant access. Access control is entirely enforced by `firestore.rules`, which restricts every document to the signed-in user who owns it.
- There's no backend/server here at all — Firebase's SDK talks to Google's servers directly from the browser.
- The curriculum, skills list, relax rotation, and scoring rule weights are plain JavaScript objects/arrays near the top of [`app.js`](./app.js) — edit them directly if you want to change project ideas, point values, or add activities.
