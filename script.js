const addCardButton = document.getElementById("add-card");
const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");

let welcome = document.getElementById("welcome");
let hoveredCard = null;

let spawnIndex = 0;
let highestZIndex = 0;

const spawnOffsets = [
  { x: 0, y: 0 },
  { x: 85, y: -35 },
  { x: -70, y: 45 },
  { x: 145, y: 65 },
  { x: -135, y: -75 },
  { x: 40, y: 125 },
  { x: -35, y: -130 },
  { x: 180, y: -15 },
  { x: -185, y: 95 },
  { x: 105, y: 155 },
  { x: -115, y: -160 },
  { x: 195, y: 130 },
];

// --------------------------------------------------
//    General helpers
// --------------------------------------------------

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function centerCanvasOnStart() {
  workspace.scrollLeft = (canvas.clientWidth - workspace.clientWidth) / 2;
  workspace.scrollTop = (canvas.clientHeight - workspace.clientHeight) / 2;
}

function bringCardToFront(card) {
  card.style.zIndex = String(++highestZIndex);
}

function keepCardInsideCanvas(card) {
  const maxX = Math.max(0, canvas.clientWidth - card.offsetWidth);
  const maxY = Math.max(0, canvas.clientHeight - card.offsetHeight);

  const x = clamp(parseFloat(card.style.left) || 0, 0, maxX);
  const y = clamp(parseFloat(card.style.top) || 0, 0, maxY);

  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

// --------------------------------------------------
//    Card spawning
// --------------------------------------------------

function getSpawnPosition(card) {
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;

  const offset = spawnOffsets[spawnIndex % spawnOffsets.length];
  spawnIndex++;

  const jitterX = (Math.random() - 0.5) * 30;
  const jitterY = (Math.random() - 0.5) * 30;

  const centerX = workspace.scrollLeft + workspace.clientWidth / 2;
  const centerY = workspace.scrollTop + workspace.clientHeight / 2;

  const desiredX = centerX - cardWidth / 2 + offset.x + jitterX;
  const desiredY = centerY - cardHeight / 2 + offset.y + jitterY;

  const maxX = Math.max(0, canvas.clientWidth - cardWidth);
  const maxY = Math.max(0, canvas.clientHeight - cardHeight);

  return {
    x: clamp(desiredX, 0, maxX),
    y: clamp(desiredY, 0, maxY),
  };
}

// --------------------------------------------------
//    Card dragging
// --------------------------------------------------

function enableCardDragging(card, dragSurface) {
  let dragState = null;

  dragSurface.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.target.closest("[contenteditable='true']")
    ) {
      return;
    }

    if (card.classList.contains("is-dissolving")) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: parseFloat(card.style.left) || 0,
      startTop: parseFloat(card.style.top) || 0,
    };

    bringCardToFront(card);
    card.classList.add("is-dragging");

    dragSurface.setPointerCapture(event.pointerId);

    event.preventDefault();
  });

  dragSurface.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    const maxX = Math.max(0, canvas.clientWidth - card.offsetWidth);
    const maxY = Math.max(0, canvas.clientHeight - card.offsetHeight);

    const newX = clamp(dragState.startLeft + deltaX, 0, maxX);
    const newY = clamp(dragState.startTop + deltaY, 0, maxY);

    card.style.left = `${newX}px`;
    card.style.top = `${newY}px`;
  });

  function stopDragging(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    dragState = null;
    card.classList.remove("is-dragging");
  }

  dragSurface.addEventListener("pointerup", stopDragging);
  dragSurface.addEventListener("pointercancel", stopDragging);
}

// --------------------------------------------------
//    Card dissolving
// --------------------------------------------------

function dissolveCard(card) {
  if (card.classList.contains("is-dissolving")) {
    return;
  }

  card.classList.add("is-dissolving");

  if (hoveredCard === card) {
    hoveredCard = null;
  }

  card.addEventListener("transitionend", (event) => {
    if (event.target === card && event.propertyName === "transform") {
      card.remove();
    }
  });

  // Fallback in case the transition event doesn't fire.
  setTimeout(() => {
    if (card.isConnected) {
      card.remove();
    }
  }, 300);
}

// --------------------------------------------------
//    Markdown renderer
// --------------------------------------------------

const markdownBlockExtensions = [];
const markdownInlineExtensions = [];

function registerMarkdownExtension(extension) {
  if (typeof extension.block === "function") {
    markdownBlockExtensions.push(extension);
  }

  if (typeof extension.inline === "function") {
    markdownInlineExtensions.push(extension);
  }
}

function escapeHTML(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMarkdownContext() {
  const protectedHTML = [];

  return {
    protect(html) {
      const index = protectedHTML.push(html) - 1;
      return `\u0000${index}\u0000`;
    },

    restore(text) {
      return text.replace(/\u0000(\d+)\u0000/g, (match, index) => {
        return protectedHTML[Number(index)] ?? match;
      });
    },
  };
}

function renderInlineMarkdown(source) {
  const context = createMarkdownContext();
  let text = escapeHTML(source);

  for (const extension of markdownInlineExtensions) {
    text = extension.inline(text, context);
  }

  return context.restore(text);
}

function findMarkdownBlock(lines, index) {
  for (const extension of markdownBlockExtensions) {
    const result = extension.block(lines, index, {
      renderInline: renderInlineMarkdown,
      escapeHTML,
    });

    if (result) {
      return result;
    }
  }

  return null;
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const output = [];

  let index = 0;

  while (index < lines.length) {
    if (lines[index].trim() === "") {
      index++;
      continue;
    }

    const block = findMarkdownBlock(lines, index);

    if (block) {
      output.push(block.html);
      index += block.consumed;
      continue;
    }

    const paragraphLines = [];

    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !findMarkdownBlock(lines, index)
    ) {
      paragraphLines.push(lines[index]);
      index++;
    }

    output.push(
      `<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`,
    );
  }

  return output.join("\n");
}

// --------------------------------------------------
//    Built-in Markdown extensions
// --------------------------------------------------

// Inline code: `code`
registerMarkdownExtension({
  name: "inline-code",

  inline(text, context) {
    return text.replace(/`([^`]+)`/g, (match, code) => {
      return context.protect(`<code>${code}</code>`);
    });
  },
});

// Links: [text](https://example.com)
registerMarkdownExtension({
  name: "links",

  inline(text, context) {
    return text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/gi,
      (match, label, url) => {
        return context.protect(
          `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
        );
      },
    );
  },
});

// Bold: **text** or __text__
registerMarkdownExtension({
  name: "bold",

  inline(text, context) {
    return text.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (match, a, b) => {
      return context.protect(`<strong>${a ?? b}</strong>`);
    });
  },
});

// Italics: *text* or _text_
registerMarkdownExtension({
  name: "italics",

  inline(text, context) {
    return text.replace(
      /(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g,
      (match, a, b) => {
        return context.protect(`<em>${a ?? b}</em>`);
      },
    );
  },
});

// Strikethrough: ~~text~~
registerMarkdownExtension({
  name: "strikethrough",

  inline(text, context) {
    return text.replace(/~~(.+?)~~/g, (match, content) => {
      return context.protect(`<del>${content}</del>`);
    });
  },
});

// Headings: # through ######
registerMarkdownExtension({
  name: "headings",

  block(lines, index, context) {
    const match = lines[index].match(/^(#{1,6})\s+(.+)$/);

    if (!match) {
      return null;
    }

    const level = match[1].length;
    const content = context.renderInline(match[2]);

    return {
      html: `<h${level}>${content}</h${level}>`,
      consumed: 1,
    };
  },
});

// Horizontal rules: ---, ***, or ___
registerMarkdownExtension({
  name: "horizontal-rule",

  block(lines, index) {
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[index])) {
      return {
        html: "<hr>",
        consumed: 1,
      };
    }

    return null;
  },
});

// Blockquotes: > quoted text
registerMarkdownExtension({
  name: "blockquote",

  block(lines, index, context) {
    if (!/^\s*>\s?/.test(lines[index])) {
      return null;
    }

    const quoteLines = [];

    while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
      quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
      index++;
    }

    return {
      html: `<blockquote>${quoteLines.map(context.renderInline).join("<br>")}</blockquote>`,
      consumed: quoteLines.length,
    };
  },
});

// Lists: - item or 1. item
registerMarkdownExtension({
  name: "lists",

  block(lines, index, context) {
    const firstMatch = lines[index].match(/^\s*([-*+]|\d+\.)\s+(.+)$/);

    if (!firstMatch) {
      return null;
    }

    const ordered = /^\d+\.$/.test(firstMatch[1]);
    const tag = ordered ? "ol" : "ul";
    const items = [];

    while (index < lines.length) {
      const match = lines[index].match(/^\s*([-*+]|\d+\.)\s+(.+)$/);

      if (!match || /^\d+\.$/.test(match[1]) !== ordered) {
        break;
      }

      let itemText = match[2];
      let checkbox = "";

      const taskMatch = itemText.match(/^\[([ xX])\]\s*(.*)$/);

      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === "x";
        checkbox = `<input type="checkbox" disabled ${checked ? "checked" : ""}>`;
        itemText = taskMatch[2];
      }

      items.push(`<li>${checkbox}${context.renderInline(itemText)}</li>`);
      index++;
    }

    return {
      html: `<${tag}>${items.join("")}</${tag}>`,
      consumed: items.length,
    };
  },
});

// Fenced code blocks: ``` code ```
registerMarkdownExtension({
  name: "code-blocks",

  block(lines, index) {
    if (!/^```/.test(lines[index])) {
      return null;
    }

    const startIndex = index;
    index++;

    const codeLines = [];

    while (index < lines.length && !/^```/.test(lines[index])) {
      codeLines.push(lines[index]);
      index++;
    }

    // Consume the closing fence when one exists.
    if (index < lines.length) {
      index++;
    }

    return {
      html: `<pre><code>${escapeHTML(codeLines.join("\n"))}</code></pre>`,
      consumed: index - startIndex,
    };
  },
});

// --------------------------------------------------
//    Custom callout Markdown extensions
// --------------------------------------------------

function createCalloutExtension(lines, index, context, type) {
  const openingLine = lines[index].trim();

  if (openingLine !== `::: ${type}`) {
    return null;
  }

  const contentLines = [];
  let closingIndex = -1;

  for (let i = index + 1; i < lines.length; i++) {
    if (lines[i].trim() === ":::") {
      closingIndex = i;
      break;
    }

    contentLines.push(lines[i]);
  }

  // Leave an unclosed callout alone instead of consuming the rest of the card.
  if (closingIndex === -1) {
    return null;
  }

  const labels = {
    warning: "Warning",
    info: "Info",
    success: "Success",
  };

  const content = contentLines
    .map((line) => context.renderInline(line))
    .join("<br>");

  return {
    html: `
      <div class="markdown-callout markdown-callout-${type}">
        <div class="markdown-callout-title">${labels[type]}</div>
        <div class="markdown-callout-content">${content}</div>
      </div>
    `,
    consumed: closingIndex - index + 1,
  };
}

function warningExtension(lines, index, context) {
  return createCalloutExtension(lines, index, context, "warning");
}

function infoExtension(lines, index, context) {
  return createCalloutExtension(lines, index, context, "info");
}

function successExtension(lines, index, context) {
  return createCalloutExtension(lines, index, context, "success");
}

function registerCustomMarkdownExtensions() {
  registerMarkdownExtension({
    name: "warning-callout",
    block: warningExtension,
  });

  registerMarkdownExtension({
    name: "info-callout",
    block: infoExtension,
  });

  registerMarkdownExtension({
    name: "success-callout",
    block: successExtension,
  });
}

registerCustomMarkdownExtensions();

// --------------------------------------------------
//    Card editing
// --------------------------------------------------

function beginEditingCard(card, preview) {
  if (
    card.classList.contains("is-dissolving") ||
    card.querySelector(".markdown-editor")
  ) {
    return;
  }

  const editor = document.createElement("textarea");
  editor.classList.add("markdown-editor");
  editor.value = card.dataset.markdown || "";
  editor.placeholder = "Write something...";

  preview.replaceWith(editor);

  editor.focus();

  editor.addEventListener("input", () => {
    editor.style.height = "auto";
    editor.style.height = `${Math.max(120, editor.scrollHeight)}px`;
  });

  editor.addEventListener("blur", () => {
    if (!editor.isConnected) {
      return;
    }

    card.dataset.markdown = editor.value;

    const newPreview = document.createElement("div");
    newPreview.classList.add("card-content");
    newPreview.innerHTML = renderMarkdown(editor.value);

    editor.replaceWith(newPreview);

    newPreview.addEventListener("click", () => {
      beginEditingCard(card, newPreview);
    });
  });
}

// --------------------------------------------------
//    Card creation
// --------------------------------------------------

function createCard() {
  if (welcome) {
    welcome.remove();
    welcome = null;
  }

  const card = document.createElement("div");
  card.classList.add("card");
  card.dataset.markdown = "";

  const header = document.createElement("div");
  header.classList.add("card-header");

  const dragGrip = document.createElement("span");
  dragGrip.classList.add("drag-grip");
  dragGrip.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.classList.add("card-title");
  title.textContent = "Untitled";
  title.contentEditable = "true";
  title.setAttribute("role", "textbox");
  title.setAttribute("aria-label", "Card title");
  title.spellcheck = false;

  const deleteButton = document.createElement("button");
  deleteButton.classList.add("card-delete");
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", "Dissolve card");
  deleteButton.title = "Dissolve card (X)";

  deleteButton.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    dissolveCard(card);
  });

  const content = document.createElement("div");
  content.classList.add("card-content");
  content.setAttribute("data-placeholder", "Write something...");

  content.addEventListener("click", () => {
    beginEditingCard(card, content);
  });

  header.appendChild(dragGrip);
  header.appendChild(title);

  card.appendChild(header);
  card.appendChild(deleteButton);
  card.appendChild(content);

  canvas.appendChild(card);

  const position = getSpawnPosition(card);

  card.style.left = `${position.x}px`;
  card.style.top = `${position.y}px`;

  bringCardToFront(card);
  keepCardInsideCanvas(card);

  enableCardDragging(card, header);

  card.addEventListener("pointerenter", () => {
    hoveredCard = card;
  });

  card.addEventListener("pointerleave", () => {
    if (hoveredCard === card) {
      hoveredCard = null;
    }
  });

  card.addEventListener("pointerdown", () => {
    bringCardToFront(card);
  });
}

// --------------------------------------------------
//    Keyboard shortcuts
// --------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "x" || !hoveredCard) {
    return;
  }

  const activeElement = document.activeElement;

  if (
    activeElement &&
    (activeElement.isContentEditable ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.tagName === "INPUT")
  ) {
    return;
  }

  dissolveCard(hoveredCard);
});

// --------------------------------------------------
//    App events
// --------------------------------------------------

addCardButton.addEventListener("click", createCard);

workspace.addEventListener("scroll", () => {
  spawnIndex = 0;
});

centerCanvasOnStart();
