globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

let originalArticle;
let originalHtml;
let originalStyle;

function findMainArticle() {
  const candidates = [
    ...document.querySelectorAll("article, main, [role='main']"),
  ].filter((element) => element.innerText.trim());

  return candidates.sort(
    (left, right) => right.innerText.length - left.innerText.length,
  )[0] ?? document.body;
}

function normalizeSingleColumn(root) {
  root.querySelectorAll('*').forEach((element) => {
    const style = getComputedStyle(element);

    if (style.columnCount !== 'auto' && style.columnCount !== '1') {
      element.style.columnCount = '1';
      element.style.columnWidth = 'auto';
    }

    if (style.display === 'grid' && style.gridTemplateColumns !== 'none') {
      element.style.gridTemplateColumns = '1fr';
    }

    if (style.display === 'flex' && style.flexDirection !== 'column') {
      element.style.flexDirection = 'column';
    }

    element.style.textAlign = 'left';
  });

  root.style.columnCount = '1';
  root.style.columnWidth = 'auto';
  root.style.textAlign = 'left';
}

function splitLongParagraphs(root) {
  root.querySelectorAll('p').forEach((paragraph) => {
    const text = paragraph.textContent.trim();
    if (!text) return;

    // Protect periods that are not sentence boundaries before splitting.
    // The markers are restored below, so the paragraph text is unchanged.
    const protectedPeriods = [];
    const protectedText = text
      .replace(
        /\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|sr|jr|st)\./gi,
        (abbreviation) => {
          const marker = `\uE000${protectedPeriods.length}\uE001`;
          protectedPeriods.push(abbreviation);
          return abbreviation.slice(0, -1) + marker;
        },
      )
      .replace(/(?<=\d)\.(?=\d)/g, () => {
        const marker = `\uE000${protectedPeriods.length}\uE001`;
        protectedPeriods.push('.');
        return marker;
      })
      .replace(/\b([A-Z])\.(?=\s+[A-Z]\b)/g, (initial) => {
        const marker = `\uE000${protectedPeriods.length}\uE001`;
        protectedPeriods.push('.');
        return initial.slice(0, -1) + marker;
      });

    const sentences = protectedText.match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) =>
        sentence.replace(/\uE000(\d+)\uE001/g, (_marker, index) =>
          protectedPeriods[Number(index)],
        ),
      );

    if (!sentences || sentences.length <= 2) return;

    const replacement = document.createDocumentFragment();
    for (let index = 0; index < sentences.length; index += 2) {
      const newParagraph = document.createElement('p');
      newParagraph.textContent = sentences.slice(index, index + 2).join(' ');
      replacement.appendChild(newParagraph);
    }

    paragraph.replaceWith(replacement);
  });
}

globalThis.Captains.features.layout = {
  // Applies to a live page element. This is also used by reader.js after it
  // inserts extract.forReader().contentHtml into the reader document.
  apply(root) {
    if (!root) return;

    splitLongParagraphs(root);
    normalizeSingleColumn(root);
  },

  setEnabled(enabled) {
    if (enabled) {
      const article = findMainArticle();
      if (!article || article === originalArticle) return;

      originalArticle = article;
      originalHtml = article.innerHTML;
      originalStyle = article.getAttribute('style');
      this.apply(article);
      return;
    }

    if (!originalArticle) return;

    originalArticle.innerHTML = originalHtml;
    if (originalStyle === null) originalArticle.removeAttribute('style');
    else originalArticle.setAttribute('style', originalStyle);
    originalArticle = null;
    originalHtml = null;
    originalStyle = null;
  },
};
