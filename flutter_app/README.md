# HTOO Shop - Flutter App

Migrated from the React/Vite web storefront. Supports iOS, Android, and Web.

## Prerequisites
- Flutter SDK >= 3.2.0
- Dart >= 3.2.0
- Android Studio / Xcode for native builds
- A Supabase project

## Setup
1. Copy `.env.example` to `.env` and fill in values:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `API_BASE_URL` (default `http://localhost:8787`)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (NO leading `@`),
     `TELEGRAM_CHAT_ID`
2. Install dependencies:
   ```bash
   flutter pub get
   ```
3. Run:
   ```bash
   flutter run            # device/emulator
   flutter run -d chrome  # web
   ```

## Build
- Android App Bundle (Play Store):
  ```bash
  flutter build appbundle --release
  ```
- Web:
  ```bash
  flutter build web --release
  ```
- iOS:
  ```bash
  flutter build ipa --release
  ```

## Android signing (Play Store)
Create `android/key.properties` (gitignored) or set env vars:
```
KEYSTORE_PATH=/path/to/release.keystore
KEYSTORE_PASSWORD=...
KEY_ALIAS=htoo_shop
KEY_PASSWORD=...
```
Then build with `--release`.

## Git
```bash
git add flutter_app
git commit -m "Add Flutter mobile app scaffold"
git push origin master
```

## Architecture
```
lib/
  config/      # env, supabase, app config
  models/      # data models
  services/    # Supabase, Telegram, API
  providers/   # state management (Provider)
  views/       # screens
  widgets/     # reusable widgets
```
