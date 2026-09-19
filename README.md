# Captains browser extension

A no-build-step WebExtension starter that can be used by Chrome and converted
into a Safari Web Extension.

## Project structure

```text
.
├── manifest.json
├── background.js
├── content/
│   ├── content.js
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.css
└── assets/
    └── icons/
```

## Test in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Pin **Captains** and open its popup.

After changing a file, click the extension's reload button on the extensions
page and refresh any page being tested.

## Test in Safari

Safari Web Extensions are packaged as app extensions in an Xcode project. On a
Mac with Xcode installed, create that wrapper from this folder with:

```sh
xcrun safari-web-extension-converter .
```

Open the generated Xcode project, select a development team for signing, and
run it. Then enable the extension under Safari's extension settings.

## Next steps

- Replace the placeholder name and description in `manifest.json`.
- Add extension icons in `assets/icons/`.
- Narrow `content_scripts.matches` from `<all_urls>` if the extension only
  needs to work on particular sites.
- Implement page behavior in `content/content.js` and popup behavior in
  `popup/popup.js`.
