"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "site-content.js"), "utf8");

class Element {
  constructor(tag = "div", text = "") {
    this.tag = tag;
    this.children = [];
    this.queries = new Map();
    this.attributes = {};
    this.value = text;
    this.classList = { add() {} };
  }
  set textContent(text) { this.value = String(text); this.children = []; }
  get textContent() { return this.value + this.children.map((child) => child.textContent).join(""); }
  get firstChild() { return this.children[0]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.value = ""; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) { return this.queries.get(selector) || null; }
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function descendants(element, predicate) {
  return [element, ...element.children.flatMap((child) => descendants(child, predicate))].filter(predicate);
}

function fixtures(overrides = {}) {
  return {
    "content/libri.json": { books: [] },
    "content/poesie.json": { poems: [] },
    "content/racconti.json": { stories: [] },
    "content/autore.json": {},
    "content/testi.json": {},
    ...overrides,
  };
}

async function render(page, files, search = "") {
  freeze(files);
  const before = JSON.stringify(files);
  const selectors = new Map();
  const container = new Element("section");
  const add = (selector, element) => { selectors.set(selector, element); return element; };
  if (page === "books") add(".page-content", container);
  if (page === "poems") add(".poetry-list", container);
  if (page === "stories") add(".text-list", container);
  const book = add(".featured-book-home", new Element("article"));
  for (const selector of ["img", ".book-cover-link", ".home-book-copy .eyebrow", "h3", ".book-tagline"]) book.queries.set(selector, new Element(selector));
  const story = add(".featured-story", new Element("article"));
  for (const selector of ["h3", "h3 + p", "a"]) story.queries.set(selector, new Element(selector));
  story.querySelector("a").append(new Element("#text", "Leggi "));
  const poem = add(".quote-section blockquote", new Element("blockquote", "Poesie"));
  const errors = [];
  const requests = [];
  const document = {
    body: { dataset: { contentPage: page } },
    querySelector: (selector) => selectors.get(selector) || null,
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => new Element("#text", text),
  };
  vm.runInNewContext(source, {
    document,
    window: { location: { search } },
    URLSearchParams,
    fetch: async (url) => {
      assert.ok(Object.hasOwn(files, url), `Richiesta inattesa: ${url}`);
      requests.push(url);
      return { ok: true, json: async () => files[url] };
    },
    console: { error: (...args) => errors.push(args) },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, [], "Il caricamento dei contenuti non deve generare errori");
  assert.equal(JSON.stringify(files), before, "La visualizzazione non deve modificare i contenuti salvati");
  return {
    titles: container.children.map((article) => descendants(article, (element) => element.tag === "h2")[0].textContent),
    articles: container.children,
    home: { books: book.querySelector("h3").textContent, stories: story.querySelector("h3").textContent, poems: poem.textContent },
    storyHref: story.querySelector("a").href,
    requests,
  };
}

const cases = [
  { page: "books", file: "libri", key: "books", entries: [{ title: "Primo manuale", publication_date: "2020-01-01" }, { title: "Secondo manuale", publication_date: "2021-01-01" }, { title: "Ultima uscita", publication_date: "2026-01-01" }], selected: "Ultima uscita" },
  { page: "poems", file: "poesie", key: "poems", entries: [{ title: "Prima manuale", text: "Prima riga\nSeconda riga" }, { title: "Seconda manuale", text: "Testo secondo" }, { title: "In evidenza", text: "Testo completo", featured: true }], selected: "In evidenza" },
  { page: "stories", file: "racconti", key: "stories", entries: [{ title: "Primo manuale", text: "Primo testo" }, { title: "Secondo manuale", text: "Secondo testo" }, { title: "In evidenza", text: "Testo del racconto", slug: "collegamento-esistente", featured: true }], selected: "In evidenza" },
];

for (const scenario of cases) {
  test(`${scenario.page}: stesso contenuto della Home al primo posto, altri nell'ordine manuale`, async () => {
    const files = fixtures({ [`content/${scenario.file}.json`]: { [scenario.key]: scenario.entries } });
    const home = await render("home", files);
    const direct = await render(scenario.page, files);
    const fromHome = await render(scenario.page, files, "?provenienza=home");
    assert.equal(home.home[scenario.page], scenario.selected, "Il criterio della Home deve restare invariato");
    assert.deepEqual(direct.titles, [scenario.selected, ...scenario.entries.filter((entry) => entry.title !== scenario.selected).map((entry) => entry.title)]);
    assert.deepEqual(fromHome.titles, direct.titles);
    assert.equal(direct.articles.length, scenario.entries.length);
    if (scenario.page === "stories") {
      assert.equal(home.storyHref, "racconto.html?storia=collegamento-esistente");
      const links = descendants(direct.articles[0], (element) => element.tag === "a");
      assert.ok(links.every((link) => link.href === home.storyHref));
    }
    if (scenario.page === "poems" || scenario.page === "stories") {
      assert.match(direct.articles[0].children[0].textContent, /^01/);
      assert.match(direct.articles[1].children[0].textContent, /^02/);
    }
  });

  test(`${scenario.page}: riordino degli altri elementi conservato`, async () => {
    const entries = [scenario.entries[1], scenario.entries[2], scenario.entries[0]];
    const files = fixtures({ [`content/${scenario.file}.json`]: { [scenario.key]: entries } });
    const result = await render(scenario.page, files);
    assert.deepEqual(result.titles, [scenario.selected, scenario.entries[1].title, scenario.entries[0].title]);
  });

  test(`${scenario.page}: lista vuota, elemento unico e contenuto già primo senza duplicati`, async () => {
    for (const entries of [[], [scenario.entries[2]], [scenario.entries[2], scenario.entries[0], scenario.entries[1]]]) {
      const files = fixtures({ [`content/${scenario.file}.json`]: { [scenario.key]: entries } });
      const result = await render(scenario.page, files);
      assert.deepEqual(result.titles, entries.map((entry) => entry.title));
      await render("home", files);
    }
  });
}

test("Libri: date uguali, mancanti o non valide mantengono le scelte precedenti della Home", async () => {
  for (const books of [
    [{ title: "A", publication_date: "2026-01-01" }, { title: "B", publication_date: "2026-01-01" }],
    [{ title: "A" }, { title: "B", publication_date: "non-valida" }],
  ]) {
    const files = fixtures({ "content/libri.json": { books } });
    assert.equal((await render("home", files)).home.books, "A");
    assert.deepEqual((await render("books", files)).titles, ["A", "B"]);
  }
});

test("Poesie e racconti: senza spunte o con più spunte non vengono introdotti nuovi criteri", async () => {
  for (const scenario of cases.filter((item) => item.page !== "books")) {
    for (const entries of [
      [{ title: "A", text: "Testo A" }, { title: "B", text: "Testo B" }],
      [{ title: "A", text: "Testo A" }, { title: "B", text: "Testo B", featured: true }, { title: "C", text: "Testo C", featured: true }],
    ]) {
      const files = fixtures({ [`content/${scenario.file}.json`]: { [scenario.key]: entries } });
      const featured = entries.find((entry) => entry.featured);
      const home = await render("home", files);
      assert.equal(home.home[scenario.page], featured?.title || (scenario.page === "stories" ? "A" : "Poesie"));
      assert.deepEqual((await render(scenario.page, files)).titles, featured ? ["B", "A", "C"] : ["A", "B"]);
    }
  }
});

test("Titoli uguali: viene spostato l'elemento esatto, senza perdere testi o collegamenti", async () => {
  const stories = [
    { title: "Titolo uguale", text: "Primo testo", slug: "primo" },
    { title: "Titolo uguale", text: "Secondo testo", slug: "secondo", featured: true },
  ];
  const files = fixtures({ "content/racconti.json": { stories } });
  const result = await render("stories", files);
  const links = result.articles.map((article) => descendants(article, (element) => element.tag === "a")[0].href);
  assert.deepEqual(links, ["racconto.html?storia=secondo", "racconto.html?storia=primo"]);
  assert.equal((await render("home", files)).storyHref, links[0]);
});

test("Contenuti reali di Davide: stessa selezione Home, nessuna modifica ai file o ai dati", async () => {
  const files = fixtures();
  for (const name of ["libri", "poesie", "racconti"]) files[`content/${name}.json`] = JSON.parse(fs.readFileSync(path.join(root, "content", `${name}.json`), "utf8"));
  const home = await render("home", files);
  for (const scenario of cases) {
    const original = files[`content/${scenario.file}.json`][scenario.key];
    const result = await render(scenario.page, files);
    const selected = home.home[scenario.page];
    assert.equal(result.titles[0], selected);
    assert.deepEqual(result.titles.slice(1), original.filter((entry) => entry.title !== selected).map((entry) => entry.title));
  }
});
