const addCardButton = document.getElementById("add-card");
const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");

let welcome = document.getElementById("welcome");

let spawnIndex = 0;
let highestZIndex = 0;

// This is an array of some random spawn offsets so when the cards spawn, they don't go out of the screen or go on top of each other.
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function centerCanvasOnStart() {
  workspace.scrollLeft = (canvas.clientWidth - workspace.clientWidth) / 2;
  workspace.scrollTop = (canvas.clientHeight - workspace.clientHeight) / 2;
}

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

  const minX = Math.max(24, workspace.scrollLeft + 24);
  const minY = Math.max(24, workspace.scrollTop + 24);

  const maxX = Math.min(
    canvas.clientWidth - cardWidth - 24,
    workspace.scrollLeft + workspace.clientWidth - cardWidth - 24,
  );
  const maxY = Math.min(
    canvas.clientHeight - cardHeight - 24,
    workspace.scrollTop + workspace.clientHeight - cardHeight - 24,
  );

  // If maxX >= minX then it does the first thing, or else it does the second thing
  const x =
    maxX >= minX
      ? clamp(desiredX, minX, maxX)
      : clamp(
          workspace.scrollLeft + 24,
          24,
          canvas.clientWidth - cardWidth - 24,
        );
  const y =
    maxY >= minY
      ? clamp(desiredY, minY, maxY)
      : clamp(
          workspace.scrollTop + 24,
          24,
          canvas.clientHeight - cardHeight - 24,
        );

  return { x, y };
}

function enableCardDragging(card, dragSurface) {
  let dragState = null;

  dragSurface.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.target.closest("[contenteditable='true']")
    ) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: parseFloat(card.style.left) || 0,
      startTop: parseFloat(card.style.top) || 0,
    };

    card.style.zIndex = String(++highestZIndex);
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

    card.style.left = `${dragState.startLeft + deltaX}px`;
    card.style.top = `${dragState.startTop + deltaY}px`;
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

function createCard() {
  if (welcome) {
    welcome.remove();
    welcome = null;
  }

  const card = document.createElement("div");
  card.classList.add("card");

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

  const content = document.createElement("div");
  content.classList.add("card-content");
  content.contentEditable = "true";
  content.setAttribute("role", "textbox");
  content.setAttribute("aria-label", "Card content");
  content.setAttribute("data-placeholder", "Write something...");

  header.appendChild(dragGrip);
  header.appendChild(title);

  card.appendChild(header);
  card.appendChild(content);

  canvas.appendChild(card);

  const position = getSpawnPosition(card);

  card.style.left = `${position.x}px`;
  card.style.top = `${position.y}px`;
  card.style.zIndex = String(++highestZIndex);

  enableCardDragging(card, header);

  card.addEventListener("pointerdown", () => {
    card.style.zIndex = String(++highestZIndex);
  });
}

addCardButton.addEventListener("click", createCard);

workspace.addEventListener("scroll", () => {
  spawnIndex = 0;
});

centerCanvasOnStart();
