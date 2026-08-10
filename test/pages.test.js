import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("static references remain inside the GitHub Pages repository subpath", () => {
  const pageBase = new URL("https://nicktitle.github.io/strfld-html5/");
  const documentReferences = [...index.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  const styleReferences = [...styles.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);

  for (const reference of documentReferences) {
    assert.equal(new URL(reference, pageBase).pathname.startsWith("/strfld-html5/"), true, reference);
  }
  for (const reference of styleReferences) {
    assert.equal(new URL(reference, new URL("styles.css", pageBase)).pathname.startsWith("/strfld-html5/"), true, reference);
  }
});

test("Pages workflow verifies main and deploys only its static site artifact", () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: _site/);
});

test("mobile markup maps the visible PICO-8 controls to all six game actions", () => {
  for (const mapping of [
    'data-control="left"',
    'data-control="right"',
    'data-control="thrust"',
    'data-control="advance"',
    'data-control="tuneUp"',
    'data-control="tuneDown"'
  ]) {
    assert.match(index, new RegExp(mapping));
  }
});
