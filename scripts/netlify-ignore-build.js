const { execFileSync } = require("node:child_process");

// Le anteprime delle bozze restano disponibili e non sono pubblicazioni di produzione.
if (process.env.CONTEXT !== "production") {
  process.exit(1);
}

const previousCommit = process.env.CACHED_COMMIT_REF;
const currentCommit = process.env.COMMIT_REF;

// Nel dubbio pubblichiamo: è più sicuro mostrare l'ultima versione che bloccare il sito.
if (!previousCommit || !currentCommit || previousCommit === currentCommit) {
  process.exit(1);
}

let changedFiles;

try {
  changedFiles = execFileSync(
    "git",
    ["diff", "--name-only", previousCommit, currentCommit],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
} catch (error) {
  process.exit(1);
}

const publicationMarker = ".netlify-publish";
const isEditorialFile = (file) =>
  file.startsWith("content/") || file.startsWith("assets/uploads/");

if (changedFiles.includes(publicationMarker)) {
  process.exit(1);
}

// Le sole modifiche editoriali si accumulano senza creare una nuova produzione.
// Un cambiamento al codice continua invece a essere pubblicato normalmente.
const onlyEditorialChanges =
  changedFiles.length > 0 && changedFiles.every(isEditorialFile);

process.exit(onlyEditorialChanges ? 0 : 1);
