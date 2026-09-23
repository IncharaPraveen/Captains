# Captains browser extension

A no-build-step Chrome extension with an accessible reading view, a global
OpenDyslexic font switch, and text-to-speech.

The reading view uses a single 68-character column, 18px sans-serif body text,
1.65 line spacing, left alignment, increased paragraph/character/word spacing,
and a high-contrast dark-on-light palette. Source scripts, forms, popups,
advertising containers, moving media, and carousel-like elements are excluded
from the extracted copy. Sections identified as advertisements, advertorials,
sponsored or promoted material, paid or partner content, or recommendations are
always removed, along with common tracking-pixel images. Its header includes an
OpenDyslexic switch that controls the same global preference as the extension
popup.

## Project structure

```text
.
├── manifest.json
├── src/
│   ├── background.js
│   ├── content.js
│   ├── content.css
│   ├── content-fonts.css
│   ├── fonts.css
│   ├── features/
│   │   ├── extract.js
│   │   ├── open-dyslexic.js
│   │   └── text-to-speech.js
│   ├── reader/
│   │   ├── reader.html
│   │   ├── reader.css
│   │   └── reader.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── options/
│       ├── options.html
│       └── options.css
└── assets/
    ├── fonts/
    │   ├── OpenDyslexic-Regular.woff2
    │   ├── OpenDyslexic-Italic.woff2
    │   ├── OpenDyslexic-Bold.woff2
    │   ├── OpenDyslexic-Bold-Italic.woff2
    │   └── OFL.txt
    └── icons/
```

## Test in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Pin **Captains** and open its popup.
5. Try opening the reading view, enabling OpenDyslexic, or reading a normal
   webpage aloud.

After changing a file, click the extension's reload button on the extensions
page and refresh any page being tested.

## Next steps

- Replace the placeholder name and description in `manifest.json`.
- Add extension icons in `assets/icons/`.
- Narrow `content_scripts.matches` from `<all_urls>` if the extension only
  needs to work on particular sites.
- Add new page capabilities as focused modules under `src/features/`.
- Put frequently used actions in `src/popup/` and detailed configuration in
  `src/options/`.

## OpenDyslexic

The bundled OpenDyslexic font is distributed under the SIL Open Font License
1.1. Its license is included at `assets/fonts/OFL.txt`.
