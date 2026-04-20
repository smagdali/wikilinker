# Chrome Web Store — submission guide for French & Spanish

Chrome Web Store doesn't allow automated creation of new listings via API — you have to create each new item in the developer dashboard once, then our `publish.sh` can push updates.

## One-time steps, per language

For each of French (`fr`) and Spanish (`es`):

### 1. Create a new item

Go to https://chrome.google.com/webstore/devconsole and click **New item**.

Upload the ZIP:
- **French**: `build/wikilinker-fr-0.6.5.zip`
- **Spanish**: `build/wikilinker-es-0.6.5.zip`

(Generate or refresh with `bash scripts/publish.sh --lang fr` / `es` — it builds + zips without uploading to Chrome if no extension ID is registered yet. Or run `node extension/build.js --lang fr` followed by manual zip.)

### 2. Fill the listing

All the fields have localized copy already generated at `i18n/<lang>/store-listing.json`. Paste from there:

| Dashboard field | JSON key |
|---|---|
| Description (long) | `chromeDescription` |
| Category | **Productivity** (pick manually) |
| Language | Pick the target language from the dropdown |

The short description (manifest-level) comes from `manifest.json` — already set via the build.

### 3. Screenshots (required, 1280x800)

Upload from `i18n/<lang>/screenshots/voyager-desktop.png`.

### 4. Privacy

- Privacy policy URL: `https://github.com/smagdali/wikilinker/blob/main/PRIVACY.md`
- Single-purpose statement: "Auto-links names on any webpage to Wikipedia articles." (translate manually if Chrome requires localized)
- Permissions justification: `storage` — saves the enable/disable preference

### 5. Submit for review

Submit. Chrome review usually takes a few hours to a day.

### 6. Capture the extension ID

Once the listing is created (doesn't need to be approved yet — just created), the URL will contain the extension ID, like `chromewebstore.google.com/detail/wikilinker-fran%C3%A7ais/abcdefghijklmnopqrstuvwxyz123456`.

Add it to `.env.publish`:

```
CHROME_EXTENSION_ID_FR=<id-from-french-listing>
CHROME_EXTENSION_ID_ES=<id-from-spanish-listing>
```

### 7. Future updates

Once the IDs are registered, `bash scripts/publish.sh --lang fr chrome` (or `--lang all chrome`) will upload + publish new versions automatically — same pipeline as English.

## Notes

- The name shown in the store is `__MSG_extensionName__` → `Wikilinker (Français)` / `Wikilinker (Español)` from the extension's `_locales/` folder. Chrome picks this up automatically.
- The French and Spanish listings are separate Chrome Web Store items with distinct URLs. Users pick whichever language they read Wikipedia in.
