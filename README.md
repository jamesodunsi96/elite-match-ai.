# ELITE MATCH AI

Mobile-first football intelligence web app with Progressive Web App (PWA) support.

## Current build status
- Responsive dark dashboard and mobile navigation.
- PWA manifest and installable-app support.
- Express API: health, fixtures, predictions and custom analysis endpoints.
- Transparent Poisson baseline calculation.
- Sample fixtures are explicitly labelled DEMO.
- Not yet connected to live football data, persistent database, trained ML, calibrated probabilities or prediction settlement.

## Run locally
Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```
Frontend: http://localhost:5173 · API: http://localhost:3001/api/health

Build: `npm run build` · Start API: `npm start`

## Install on Android
Deploy over HTTPS, open the site in Chrome on Android, then browser menu → Install app or Add to Home screen. Availability varies by device/browser.

## Before production
Choose a football-data provider after checking league coverage, historical data, rate limits, terms and pricing. Keep API keys server-side. Add PostgreSQL persistence, historical imports, chronological backtesting, probability calibration, immutable pre-kickoff prediction records and automatic result settlement. The included Poisson model is an illustrative baseline only; it is not trained ML, calibrated or a proven betting edge.


## Android APK build (phone-friendly cloud option)

This folder is an **Android-ready source project**, not a finished APK. The Android
APK must be compiled by an Android build environment. You can trigger the included
GitHub Actions workflow from a GitHub repository without installing Android Studio
on your phone.

1. Create a GitHub repository and upload the contents of this project.
2. In the repository, open **Actions** and enable workflows if GitHub asks.
3. Open **Build ELITE MATCH AI Android APK** and choose **Run workflow** (or push
   the files to the `main` branch).
4. When the workflow finishes, open its run, scroll to **Artifacts**, and download
   `elite-match-ai-debug-apk`.
5. Extract the downloaded artifact on Android and tap `app-debug.apk` to install.
   Android may ask you to allow installs from that browser/file manager.

Important:
- This produces a **debug APK for testing**, not a Play Store release.
- Live scores, live fixtures, and production AI predictions are not connected yet.
  The included matches/predictions are demo data and the baseline model is not a
  trained or validated AI model.
- To make real live-data and AI features work, the app still needs a football-data
  provider, a deployed backend, secure API-key configuration, historical match
  data, model training/validation, and ongoing performance tracking.
- Never enter betting account passwords or payment details into this starter app.
