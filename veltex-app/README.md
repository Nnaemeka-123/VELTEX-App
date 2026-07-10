# VELTEX mobile app

Real Expo/React Native app: auth, vertical video feed, follow system, wallet,
and an actual AdMob rewarded video ad (`react-native-google-mobile-ads`) —
not a mock.

## Why this can't run in Expo Go

`react-native-google-mobile-ads` is a native module. Expo Go (the quick
preview app) doesn't include it, so this needs a **custom dev build** —
which is exactly what EAS Build produces, entirely in Google's/Expo's cloud.
You never touch a terminal on your own phone.

## Getting a real, installable app — no Termux, no local setup

1. Go to **expo.dev**, sign up (free), and create a project.
2. From *any* computer with the code (a Windows/Mac laptop is easiest for
   this one-time step — it only needs to happen once, not on your phone):
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build --platform android --profile preview
   ```
   This uploads your code and builds it on Expo's servers — your machine
   does almost no work.
3. When the build finishes, EAS gives you a **download link** and a **QR
   code**. Scan it on your Android phone → it installs like any APK.
4. For iOS, the equivalent is `eas build --platform ios --profile preview`,
   but Apple requires a paid Apple Developer account ($99/year) before it'll
   install on a real device.

If you don't have access to a laptop even for that one-time step, **GitHub
Codespaces** or **Replit** can also run those same three `eas` commands in a
browser terminal — still no phone-side copying, just clicking into a
browser-based shell and pasting three commands once.

## Before building, fill in real values

- `app.config.js` → `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` (from AdMob
  console → App settings)
- `src/components/RewardedAdCard.js` → `AD_UNIT_ID` (from AdMob console →
  your Rewarded ad unit)
- `extra.apiBaseUrl` in `app.config.js` → your deployed backend URL from the
  `veltex-backend` project (not `localhost` — it needs to be reachable from
  a real phone)

## What's wired up

| Screen | Talks to |
|---|---|
| Login / Signup | `POST /auth/login`, `POST /auth/signup` |
| Feed | `GET /feed`, follow buttons hit `POST/DELETE /follow/:id` |
| Rewarded ad card | `POST /wallet/rewards/session` → loads real AdMob ad → Google verifies completion server-side |
| Wallet | `GET /wallet`, `GET /wallet/ledger` |
| Profile | `GET /follow/following`, `GET /follow/followers` |

## Still needed before this is a real product

- Actual video upload/hosting (the feed currently expects `video_url` to
  already point at a hosted file — nothing here uploads video yet)
- App icons/splash screen assets in `./assets/`
- Apple/Google Play developer accounts to publish (vs. just installing on
  your own test device via the preview build above)
- Privacy policy + AdMob's required user consent flow (GDPR/CCPA) before
  going live with real users
