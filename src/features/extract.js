// Produces a clean, inert copy of the page's main reading content.
globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

const REMOVE_FROM_READER = [
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "aside",
  "footer",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "canvas",
  "video",
  "audio",
  "marquee",
  "dialog",
  "[role='dialog']",
  "[aria-modal='true']",
  "[hidden]",
  "[aria-hidden='true']",
  "ins.adsbygoogle",
  "[class*='advert' i]",
  "[class*='sponsor' i]",
  "[class*='promot' i]",
  "[class*='paid-content' i]",
  "[class*='partner-content' i]",
  "[class*='recommend' i]",
  "[class*='cookie' i]",
  "[class*='popup' i]",
  "[class*='modal' i]",
  "[class*='carousel' i]",
  "[class*='ticker' i]",
  "[class*='slideshow' i]",
  "[id*='advert' i]",
  "[id*='sponsor' i]",
  "[id*='promot' i]",
  "[id*='paid-content' i]",
  "[id*='partner-content' i]",
  "[id*='recommend' i]",
  "[id*='cookie' i]",
  "[id*='popup' i]",
  "[id*='modal' i]",
  "[id*='carousel' i]",
  "[id*='ticker' i]",
  "[id*='slideshow' i]",
  "[data-ad]",
  "[data-ad-client]",
  "[data-ad-slot]",
  "[data-google-query-id]",
  "[aria-label*='advertisement' i]",
  "[aria-label*='sponsored' i]",
  "[aria-label*='promoted' i]",
  "[aria-label*='paid content' i]",
  "[aria-label*='partner content' i]",
  "[aria-label*='recommended' i]",
  "[title*='advertisement' i]",
  "[title*='sponsored' i]",
  "[title*='promoted' i]",
].join(",");

const PROMOTIONAL_LABEL = /^(?:advertisement|advertorial|sponsored|promoted|paid\s+(?:content|post|partnership)|partner\s+(?:content|post)|recommended)\b/i;
const PROMOTIONAL_CONTAINER = "section, aside, article, li, figure, [role='region']";
const TRACKING_IMAGE = /(?:doubleclick|googlesyndication|adservice|tracking|tracker|pixel|\/ads?[\/_.?=-])/i;

const READER_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "EM",
  "FIGCAPTION",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "IMG",
  "LI",
  "MARK",
  "OL",
  "P",
  "PRE",
  "S",
  "SECTION",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
]);

function findMainContent() {
  const candidates = [
    ...document.querySelectorAll("article, main, [role='main']"),
  ].filter((element) => element.innerText.trim().length > 0);

  return candidates.sort(
    (left, right) => right.innerText.length - left.innerText.length,
  )[0] ?? document.body;
}

function safeUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function cleanElement(element) {
  const href = element.tagName === "A" ? safeUrl(element.getAttribute("href")) : null;
  const src = element.tagName === "IMG" ? safeUrl(element.getAttribute("src")) : null;
  const alt = element.tagName === "IMG" ? element.getAttribute("alt") : null;

  for (const attribute of [...element.attributes]) {
    element.removeAttribute(attribute.name);
  }

  if (href) {
    element.setAttribute("href", href);
    element.setAttribute("target", "_blank");
    element.setAttribute("rel", "noopener noreferrer");
  }

  if (src) {
    element.setAttribute("src", src);
    element.setAttribute("loading", "lazy");
  }

  if (alt) {
    element.setAttribute("alt", alt);
  }
}

function labelText(element) {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-label"),
    element.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeSectionFromHeading(heading) {
  const headingLevel = Number(heading.tagName.slice(1));
  let current = heading;

  while (current) {
    const next = current.nextSibling;
    const nextHeadingLevel =
      current !== heading && /^H[1-6]$/.test(current.tagName)
        ? Number(current.tagName.slice(1))
        : null;

    if (nextHeadingLevel && nextHeadingLevel <= headingLevel) {
      break;
    }

    current.remove();
    current = next;
  }
}

function removeLabelledPromotions(root) {
  const labels = root.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, [aria-label], [title], [data-label]",
  );

  for (const label of labels) {
    if (!label.isConnected && !root.contains(label)) {
      continue;
    }

    if (!PROMOTIONAL_LABEL.test(labelText(label))) {
      continue;
    }

    const container = label.closest(PROMOTIONAL_CONTAINER);

    if (container && container !== root) {
      container.remove();
      continue;
    }

    const parent = label.parentElement;
    if (parent && parent !== root && !["MAIN", "ARTICLE"].includes(parent.tagName)) {
      parent.remove();
      continue;
    }

    if (/^H[1-6]$/.test(label.tagName)) {
      removeSectionFromHeading(label);
    } else {
      label.remove();
    }
  }
}

function removeTrackingImages(root) {
  for (const image of root.querySelectorAll("img")) {
    const width = Number.parseFloat(image.getAttribute("width"));
    const height = Number.parseFloat(image.getAttribute("height"));
    const source = image.getAttribute("src") ?? "";
    const isTrackingSize =
      (Number.isFinite(width) && width <= 3) ||
      (Number.isFinite(height) && height <= 3);

    if (isTrackingSize || TRACKING_IMAGE.test(source)) {
      image.remove();
    }
  }
}

function sanitizedMainHtml() {
  const clone = findMainContent().cloneNode(true);

  if (clone.matches(REMOVE_FROM_READER)) {
    return "";
  }

  clone.querySelectorAll(REMOVE_FROM_READER).forEach((element) => element.remove());
  removeLabelledPromotions(clone);
  removeTrackingImages(clone);

  for (const element of [...clone.querySelectorAll("*")]) {
    if (!READER_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }

    cleanElement(element);
  }

  cleanElement(clone);
  return clone.innerHTML.trim();
}

globalThis.Captains.features.extract = {
  forReader() {
    return {
      title: document.title,
      sourceUrl: window.location.href,
      language: document.documentElement.lang || null,
      contentHtml: sanitizedMainHtml(),
    };
  },
};
