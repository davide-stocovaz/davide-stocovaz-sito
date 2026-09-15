const menuButton = document.querySelector(".menu-button");
const menuPanel = document.querySelector(".menu-panel");
const menuLinks = document.querySelectorAll(".menu-panel a");
const year = document.querySelector("#current-year");
const pageContent = [document.querySelector("main"), document.querySelector("footer")];
let lastFocusedElement = null;
let menuFocusTimer = null;

function setMenu(open, restoreFocus = false) {
  window.clearTimeout(menuFocusTimer);

  if (open) {
    lastFocusedElement = document.activeElement;
  }

  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Chiudi il menu" : "Apri il menu");
  menuPanel.setAttribute("aria-hidden", String(!open));
  menuPanel.inert = !open;
  menuPanel.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
  pageContent.forEach((element) => {
    element.inert = open;
  });

  if (open) {
    menuFocusTimer = window.setTimeout(() => {
      menuPanel.querySelector("a")?.focus();
    }, 260);
  } else if (restoreFocus) {
    lastFocusedElement?.focus();
  }
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  setMenu(!isOpen, isOpen);
});

menuLinks.forEach((link) => {
  link.addEventListener("click", () => setMenu(false, true));
});

document.addEventListener("keydown", (event) => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";

  if (event.key === "Escape" && isOpen) {
    event.preventDefault();
    setMenu(false, true);
  }

  if (event.key === "Tab" && isOpen) {
    const focusableElements = [menuButton, ...menuLinks];
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
});

window.addEventListener("resize", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";

  if (isOpen && window.innerWidth > 760) {
    setMenu(false, false);
  }
});

year.textContent = new Date().getFullYear();
