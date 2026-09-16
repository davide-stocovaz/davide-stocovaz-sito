(function () {
  "use strict";

  const page = document.body.dataset.contentPage;
  if (!page) return;

  const getJson = (path) =>
    fetch(path, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Impossibile caricare ${path}`);
      return response.json();
    });

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const addTextParagraphs = (container, text) => {
    String(text || "")
      .split(/\n\s*\n/)
      .filter(Boolean)
      .forEach((paragraph) => {
        const p = make("p");
        const lines = paragraph.split("\n");
        lines.forEach((line, index) => {
          if (index) p.append(document.createElement("br"));
          p.append(document.createTextNode(line));
        });
        container.append(p);
      });
  };

  const storyUrl = (story) => `racconto.html?storia=${encodeURIComponent(story.slug)}`;

  function bookArticle(book) {
    const article = make("article", "book-detail");
    const cover = make("div", "book-detail-cover");
    const image = make("img", "book-cover-image");
    image.src = book.cover;
    image.alt = `Copertina di ${book.title}`;
    image.loading = "lazy";
    cover.append(image);

    const copy = make("div", "book-detail-copy");
    copy.append(make("p", "eyebrow", ["Romanzo", book.genre].filter(Boolean).join(" · ")));
    copy.append(make("h2", "", book.title));
    copy.append(make("p", "book-tagline", book.tagline));
    const description = make("div", "book-description");
    addTextParagraphs(description, book.description);
    copy.append(description);

    const meta = make("dl", "book-meta");
    [
      ["Editore", book.publisher],
      ["Anno", book.year],
      ["Collana", book.series],
      ["Uscita", book.release],
      ["Formato", book.format],
      ["Pagine", book.pages],
      ["ISBN", book.isbn],
    ].forEach(([label, value]) => {
      if (value === undefined || value === null || value === "") return;
      const row = make("div");
      row.append(make("dt", "", label), make("dd", "", String(value)));
      meta.append(row);
    });
    copy.append(meta);

    if (book.purchase_url) {
      const link = make("a", "purchase-button");
      link.href = book.purchase_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(document.createTextNode("Acquista "), make("span", "", "↗"));
      copy.append(link);
    }

    article.append(cover, copy);
    return article;
  }

  function renderBooks(data) {
    const container = document.querySelector(".page-content");
    if (!container || !Array.isArray(data.books)) return;
    container.replaceChildren(...data.books.map(bookArticle));
  }

  function renderPoems(data) {
    const container = document.querySelector(".poetry-list");
    if (!container || !Array.isArray(data.poems)) return;
    const cards = data.poems.map((poem, index) => {
      const article = make("article", "poem-card");
      article.append(make("p", "poem-number", `${String(index + 1).padStart(2, "0")} · Poesia`));
      const text = make("div", "poem-text");
      text.append(make("h2", "", poem.title));
      addTextParagraphs(text, poem.text);
      article.append(text);
      return article;
    });
    container.replaceChildren(...cards);
  }

  function renderStories(data) {
    const container = document.querySelector(".text-list");
    if (!container || !Array.isArray(data.stories)) return;
    const cards = data.stories.map((story, index) => {
      const article = make("article", "text-card");
      article.append(make("p", "", `${String(index + 1).padStart(2, "0")} · Racconto`));
      const heading = make("h2");
      const titleLink = make("a", "", story.title);
      titleLink.href = storyUrl(story);
      heading.append(titleLink);
      const readLink = make("a", "story-card-link");
      readLink.href = storyUrl(story);
      readLink.append(document.createTextNode("Leggi il racconto "), make("span", "", "→"));
      article.append(heading, readLink);
      return article;
    });
    container.replaceChildren(...cards);
  }

  function renderBiography(data) {
    const container = document.querySelector(".biography-page-copy .long-copy");
    if (!container || !data.biography) return;
    const signature = container.querySelector(".author-signature");
    const eyebrow = make("p", "eyebrow", "L’autore");
    const heading = make("h2", "", "Davide Stocovaz");
    container.replaceChildren(eyebrow, heading);
    addTextParagraphs(container, data.biography);
    if (signature) container.append(signature);
    if (signature && data.signature) signature.src = data.signature;
    const portrait = document.querySelector(".hero-author-photo img");
    if (portrait && data.portrait) portrait.src = data.portrait;
  }

  function renderContacts(data) {
    const list = document.querySelector(".social-list");
    if (!list) return;
    const entries = [
      ["Email", data.email, data.email ? `mailto:${data.email}` : ""],
      ["Facebook", data.facebook, data.facebook_url],
      ["Instagram", data.instagram, data.instagram_url],
      ["TikTok", data.tiktok, data.tiktok_url],
    ];
    const rows = entries.filter(([, value]) => value).map(([label, value, url]) => {
      const row = make("div");
      const detail = make("dd");
      if (url) {
        const link = make("a", "", value);
        link.href = url;
        if (!url.startsWith("mailto:")) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        detail.append(link);
      } else {
        detail.textContent = value;
      }
      row.append(make("dt", "", label), detail);
      return row;
    });
    list.replaceChildren(...rows);
  }

  function renderHomeBook(data) {
    const book = data.books?.find((item) => item.featured) || data.books?.[0];
    const article = document.querySelector(".featured-book-home");
    if (!book || !article) return;
    const image = article.querySelector("img");
    image.src = book.cover;
    image.alt = `Copertina di ${book.title}`;
    article.querySelector(".home-book-copy .eyebrow").textContent = ["Romanzo", book.genre].filter(Boolean).join(" · ");
    article.querySelector("h3").textContent = book.title;
    article.querySelector(".book-tagline").textContent = book.tagline;
  }

  function renderHomeStory(data) {
    const story = data.stories?.find((item) => item.featured) || data.stories?.[0];
    const article = document.querySelector(".featured-story");
    if (!story || !article) return;
    article.querySelector("h3").textContent = story.title;
    article.querySelector("h3 + p").textContent = story.excerpt;
    const link = article.querySelector("a");
    link.href = storyUrl(story);
    link.firstChild.textContent = `Leggi ${story.title} `;
  }

  function renderHomePoem(data) {
    const poem = data.poems?.find((item) => item.featured);
    const title = document.querySelector(".quote-section blockquote");
    if (poem && title) title.textContent = poem.title;
  }

  function renderHomeBiography(data) {
    const container = document.querySelector(".bio-copy");
    if (!container || !data.biography) return;
    const link = container.querySelector("a");
    const eyebrow = make("p", "eyebrow", "L’autore");
    const heading = make("h2", "", "Davide Stocovaz");
    container.replaceChildren(eyebrow, heading);
    addTextParagraphs(container, data.biography);
    container.querySelector("h2 + p")?.classList.add("bio-lead");
    const portrait = document.querySelector(".author-portrait img");
    if (portrait && data.portrait) portrait.src = data.portrait;
    if (link) container.append(link);
  }

  function renderSingleStory(data) {
    const slug = new URLSearchParams(window.location.search).get("storia");
    const story = data.stories?.find((item) => item.slug === slug);
    if (!story) return;
    document.title = `${story.title} — Davide Stocovaz`;
    document.querySelector(".story-reading-hero h1").textContent = story.title;
    const copy = document.querySelector(".story-copy");
    copy.replaceChildren();
    addTextParagraphs(copy, story.text);
  }

  const actions = {
    home: () =>
      Promise.all([
        getJson("content/libri.json").then(renderHomeBook),
        getJson("content/racconti.json").then(renderHomeStory),
        getJson("content/poesie.json").then(renderHomePoem),
        getJson("content/autore.json").then(renderHomeBiography),
      ]),
    books: () => getJson("content/libri.json").then(renderBooks),
    poems: () => getJson("content/poesie.json").then(renderPoems),
    stories: () => getJson("content/racconti.json").then(renderStories),
    biography: () => getJson("content/autore.json").then(renderBiography),
    contacts: () => getJson("content/autore.json").then(renderContacts),
    story: () => getJson("content/racconti.json").then(renderSingleStory),
  };

  actions[page]?.().catch((error) => {
    console.error("I contenuti aggiornabili non sono stati caricati.", error);
  });
})();
