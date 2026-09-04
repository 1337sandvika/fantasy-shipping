# iOS icon and splash sources

Apple will reject a generic Capacitor icon. Replace these before review.

| File | Role |
| --- | --- |
| `icon-source.jpg` |  Copy of the web share card (`public/og.jpg`). Dark sea + type. |
| `splash-source.jpg` | Same art; `@capacitor/assets` letterboxes it on `#071018`. |

On a Mac, after `npm install`:

```bash
# Optional: produce a square 1024 PNG first (Preview, Pixelmator, or:
#   sips -z 1024 1024 resources/icon-source.jpg --out resources/icon.png
# )
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#071018' \
  --splashBackgroundColor '#071018'
npx cap sync ios
```

Or drop a **1024×1024 PNG without alpha** onto `AppIcon` in
`ios/App/App/Assets.xcassets` using Xcode.

Background / brand color: `#071018`. Accent: `#e85d04`.
