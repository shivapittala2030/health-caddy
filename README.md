# Health Caddy

Health Caddy tells you, in a second, whether a packaged food fits **your** diet, avoid list and allergies, and helps you see how what you ate today may affect your digestion, sleep, energy and weight.

This is release 1 (features F1–F8 in the features & requirements doc). It is a mobile web app (installable to the phone home screen) built in TypeScript and React.

## What it does

| | Feature | How |
|---|---|---|
| F1 | Diet presets: lacto-vegetarian, vegan, Jain, none | Profile and first-run setup |
| F2 | Custom avoid list with hidden-source synonyms | Eggs, caffeine, alcohol, gelatin, plus any words you add |
| F3 | Allergies, sensitivities, goals, body data, additive tolerance | Profile |
| F4 | Barcode scan with verdict | Phone camera (BarcodeDetector or ZXing), or type the number. Real product data from Open Food Facts |
| F5 | Ingredient-label photo scan | Photo read on the device with Tesseract.js; you can correct the text |
| F6 | Verdicts Avoid, Caution, Good, Unknown, each with reasons | `src/engine/evaluate.ts` |
| F7 | Food log by search, barcode, photo or usual meal | Log tab; your log stays on your device |
| F8 | Predicted effects for the next 24–48 hours | Insights tab; transparent rules in `src/engine/predict.ts` |
| F16 | Several people on one phone | Tap the name at the top to switch or add a person; each has their own profile, log and report |
| — | Weekly report | Report tab: scans, verdict counts, most flagged ingredients, sugar, sodium, fiber and calorie trends (`src/engine/report.ts`) |

Key rules it follows: verdicts come only from your own profile (R1), every verdict shows its reasons (R2), missing or unreadable ingredients show **Unknown, never Good** (R3), hidden animal sources are flagged (R4), and your profile and food log never leave the device (R16).

## Data sources

- **Open Food Facts** (https://world.openfoodfacts.org): product names, ingredients, allergens and nutrition, under the Open Database License. Lookups send only the barcode or search words. Recent products are cached on the device so repeat scans work offline (R20).
- **USDA FoodData Central**: rounded values for the built-in list of home and fresh foods (`src/data/commonFoods.ts`).

## Run it

```bash
npm install
npm run dev        # local development server
npm test           # rules engine tests
npm run build      # production build in dist/
```

The camera only works on `https://` pages (or `localhost`). Pushing to `main` on GitHub runs the tests and publishes the app to GitHub Pages through `.github/workflows/deploy.yml` (turn on Pages with source "GitHub Actions" in the repository settings).

## Code map

- `src/engine/` rules engine shared by every screen (types, ingredient dictionary, verdicts, predictions) with tests
- `src/data/` Open Food Facts client and common foods
- `src/scan/` camera barcode reader and label OCR
- `src/ui/` screens: Scan, Result, Log, Insights, Profile
- `public/` app icons, web manifest and offline service worker

Health Caddy gives general guidance, not medical advice.
