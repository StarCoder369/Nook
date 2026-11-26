const addCardButton = document.getElementById("add-card");
const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");

let cardCount = 0;

function createCard() {
  const card = document.createElement("div");
  card.classList.add("card");

  const title = document.createElement("h3");
  title.textContent = "Untitled";

  const content = document.createElement("p");
  content.textContent = "Start writing...";

  card.appendChild(title);
  card.appendChild(content);

  const x =
    workspace.scrollLeft + workspace.clientWidth / 2 - 120 + cardCount * 25;
  const y =
    workspace.scrollTop + workspace.clientHeight / 2 - 80 + cardCount * 25;

  card.style.left = `${x}px`;
  card.style.top = `${y}px`;

  canvas.appendChild(card);

  cardCount++;
}

addCardButton.addEventListener("click", createCard);
