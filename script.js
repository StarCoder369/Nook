const addCardButton = document.getElementById("add-card");
const workspace = document.getElementById("workspace");

function createCard() {
  const card = document.createElement("div");
  card.classList.add("card");

  const title = document.createElement("h3");
  title.textContent = "Untitled";

  const content = document.createElement("p");
  content.textContent = "Start writing...";

  card.appendChild(title);
  card.appendChild(content);

  workspace.appendChild(card);
}

addCardButton.addEventListener("click", createCard);
