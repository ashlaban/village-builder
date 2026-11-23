// Every theme defines every token (VB-1532): the list of theme tokens at the head of the stylesheet (VB-1530), the themes of
// THEMES in src/page/options.js, and each theme's token block in src/head.html. A theme is safe to add: one that misses a token, or a
// block whose theme is not in THEMES, fails with the theme and the token named.
// A theme's token block is a rule outside any @media whose selector has a part that is the themed element itself (`:root[data-theme="x"]`,
// `[data-theme="x"]`, `.theme-pv[data-theme="x"]`: one compound, no combinator) and that sets a custom property; one under a media
// query (Glass dark) is an override and may set some of them. A `var(--x)` of the stylesheet that no theme sets must be defined by a
// declaration `--x:` outside the theme blocks, in the stylesheet or the page's markup and script (an inline style, setProperty).
// A theme styles pieces, not components (VB-1534): the pieces are listed in the comment that names "The pieces", one `.name:` (or
// `button:`) a line, with the components a theme may still style alone on its `counted:` line; every other rule under a theme's
// selector (`[data-theme="x"] ...`) must have a piece or a counted component as the first compound after the theme.
const fs = require('fs'),
  path = require('path');
const { readSource } = require('../tools/lib/source');
const ROOT = path.join(__dirname, '..');

// The tokens of the list: the comment that names "theme tokens", one `--name: what it is` a line.
function tokenList(css) {
  const c = (css.match(/\/\*[\s\S]*?\*\//g) || []).find((x) => /theme tokens/i.test(x));
  if (!c) return null;
  return [...c.matchAll(/^\s*--([a-z0-9-]+):/gim)].map((m) => m[1]);
}

// The rules of a stylesheet, each {selector, body, media}: media is the enclosing at-rules' preludes, comments dropped.
function rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [],
    stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const prelude = text.slice(start, i).trim();
      if (prelude.startsWith('@')) {
        stack.push(prelude);
        start = i + 1;
        continue;
      }
      const end = text.indexOf('}', i);
      out.push({
        selector: prelude,
        body: text.slice(i + 1, end),
        media: stack.slice(),
        line: text.slice(0, i).split('\n').length,
      });
      i = end;
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';' && !text.slice(start, i).includes('{')) {
      if (text.slice(start, i).trim().startsWith('@')) start = i + 1; // @import, @charset
    }
  }
  return out;
}

// The pieces and the counted components: {pieces, counted}, each a Set of names (".panel", "button"), or null with no list.
function pieceList(css) {
  const c = (css.match(/\/\*[\s\S]*?\*\//g) || []).find((x) => /The pieces/.test(x));
  if (!c) return null;
  const pieces = new Set([...c.matchAll(/^\s*(\.[a-z][\w-]*|button):/gim)].map((m) => m[1]));
  const line = c.match(/^\s*counted:([^\n]*)/im);
  const counted = new Set(line ? line[1].match(/\.[a-z][\w-]*/gi) || [] : []);
  return { pieces, counted };
}

// What a theme's rule styles: for each alternative of its selector, the first compound after the theme's part, as the classes
// and the element it names. The theme's part is `[data-theme="x"]`, bare, in :where() or on :root.
function themedSubjects(selector) {
  const out = [];
  for (const part of splitTop(selector)) {
    const m = part.match(/^\s*(?::where\(\s*)?(?::root)?\[data-theme=["']?[\w-]+["']?\]\)?\s+([\s\S]*)$/);
    if (!m) continue;
    const rest = m[1].trim();
    const alts = rest.startsWith(':is(') ? splitTop(rest.slice(4, matching(rest, 3))) : [rest];
    for (const a of alts) {
      let x = a.trim();
      for (let k = 0; k < 4; k++) x = x.replace(/:(?:not|where|is|has)\([^()]*\)/g, '');
      const first = x.split(/\s*[\s>+~]\s*/)[0];
      const el = (first.match(/^[a-z][\w-]*/i) || [''])[0];
      out.push({ text: a.trim(), names: [...(first.match(/\.[a-z][\w-]*/gi) || []), ...(el ? [el] : [])] });
    }
  }
  return out;
}
function splitTop(s) {
  const out = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && !depth) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}
function matching(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && !--depth) return i;
  }
  return s.length;
}

const setsOf = (body) => [...body.matchAll(/(?:^|[;{\s])--([a-z0-9-]+)\s*:/gi)].map((m) => m[1]);

// The theme a selector's part is the element of: one compound selector carrying [data-theme="x"].
function themeOf(selector) {
  const keys = [];
  for (const part of selector.split(',').map((s) => s.trim())) {
    const bare = part.replace(/:where\(([^()]*)\)/g, '$1');
    if (/[\s>+~]/.test(bare)) continue;
    const m = bare.match(/\[data-theme=["']?([\w-]+)["']?\]/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

// The check: what is wrong, one line each. css the stylesheet, themes the keys of THEMES, defined the custom properties set
// outside the stylesheet (the page's markup and script).
function check(css, themes, defined = new Set()) {
  const errors = [];
  const tokens = tokenList(css);
  if (!tokens || !tokens.length)
    return ['no list of theme tokens (a comment naming "theme tokens", one `--name: what it is` a line)'];
  const listed = new Set(tokens);
  const full = new Map(),
    anySet = new Set(),
    base = new Set(defined);
  for (const r of rules(css)) {
    const sets = setsOf(r.body);
    const keys = sets.length ? themeOf(r.selector) : [];
    if (!keys.length) {
      for (const t of sets) base.add(t);
      continue;
    }
    for (const t of sets) {
      anySet.add(t);
      if (!listed.has(t))
        errors.push(`--${t} is set by a theme (line ${r.line}, ${r.selector}) but is not in the list of theme tokens`);
    }
    for (const k of keys) {
      if (!themes.includes(k)) errors.push(`a token block for "${k}" (line ${r.line}), a theme not in THEMES`);
      if (r.media.length) continue; // an override, as Glass dark's
      if (!full.has(k)) full.set(k, []);
      full.get(k).push({ line: r.line, sets: new Set(sets) });
    }
  }
  for (const k of themes) {
    const blocks = full.get(k);
    if (!blocks) {
      errors.push(`theme "${k}" has no token block ([data-theme="${k}"] setting the tokens, outside any @media)`);
      continue;
    }
    for (const b of blocks) {
      const missing = tokens.filter((t) => !b.sets.has(t));
      for (const t of missing) errors.push(`theme "${k}" does not set --${t} (its token block, line ${b.line})`);
    }
  }
  const list = pieceList(css);
  if (!list || !list.pieces.size)
    errors.push('no list of the pieces (a comment naming "The pieces", one `.name:` a line)');
  else
    for (const r of rules(css))
      for (const t of themedSubjects(r.selector))
        if (!t.names.some((n) => list.pieces.has(n) || list.counted.has(n)))
          errors.push(
            `a theme's rule styles ${t.text} (line ${r.line}), not a piece: name a piece, or count the component with its reason`,
          );
  const used = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\(\s*--([a-z0-9-]+)/gi)].map((m) => m[1]));
  for (const t of used) {
    if (anySet.has(t) || base.has(t)) continue;
    errors.push(`var(--${t}) is used but no theme sets it and the base does not define it`);
  }
  return errors;
}

function themeKeys(src) {
  const m = src.match(/const THEMES = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('THEMES not found in src/page/options.js');
  return Object.keys(new Function(`return ${m[1]}`)());
}

function stylesheet(html) {
  const a = html.indexOf('<style>');
  if (a < 0) throw new Error('no <style> in src/head.html');
  const b = html.indexOf('</style>', a);
  return html.slice(0, a + 7).replace(/[^\n]/g, '') + html.slice(a + 7, b < 0 ? html.length : b); // lines as in the file
}

// Custom properties the page sets outside the stylesheet: `--x:` in an inline style, setProperty('--x', ...).
function pageDefined() {
  const files = [
    'src/body.html',
    ...fs
      .readdirSync(path.join(ROOT, 'src/page'))
      .filter((f) => /\.[jt]s$/.test(f))
      .map((f) => `src/page/${f}`),
  ];
  const out = new Set();
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const s = readSource(f);
    for (const m of s.matchAll(/setProperty\(\s*['"`]--([a-z0-9-]+)/gi)) out.add(m[1]);
    for (const m of s.matchAll(/[;"'`\s]--([a-z0-9-]+):/gi)) out.add(m[1]);
  }
  return out;
}

let fail = 0;
const expect = (cond, what) => {
  if (!cond) {
    fail++;
    console.error('THEMES FAIL: ' + what);
  }
};

// The self-test, on a constructed stylesheet.
const LIST =
  '/* The theme tokens:\n   --ink: words\n   --edge: a line\n   The pieces:\n   .y: a piece\n   button: a button\n   counted: .bar\n*/\n';
const good =
  LIST +
  ':root[data-theme="a"] { --ink: #000; --edge: #111; }\n@media (prefers-color-scheme: dark) { :root[data-theme="a"] { --ink: #fff; } }\n' +
  '[data-theme="b"], .theme-pv[data-theme="b"] { --ink: #222; --edge: #333; }\n.x { --gap: 2px; color: var(--ink); margin: var(--gap); }\n' +
  ':root[data-theme="b"] .y { --ink: red; }\n';
expect(
  check(good, ['a', 'b']).length === 0,
  'the constructed stylesheet should pass: ' + check(good, ['a', 'b']).join('; '),
);
const lacking = good.replace('--edge: #333; ', '');
expect(
  check(lacking, ['a', 'b']).some((e) => /"b" does not set --edge/.test(e)),
  'a missing token should be named: ' + check(lacking, ['a', 'b']).join('; '),
);
expect(
  check(good, ['a', 'b', 'c']).some((e) => /"c" has no token block/.test(e)),
  'a theme of THEMES with no block should fail',
);
expect(
  check(good, ['a']).some((e) => /"b".*not in THEMES/.test(e)),
  'a block of a theme not in THEMES should fail',
);
const stray = good.replace('margin: var(--gap)', 'margin: var(--gutter)');
expect(
  check(stray, ['a', 'b']).some((e) => /var\(--gutter\)/.test(e)),
  'an undefined var() should be named',
);
expect(check(stray, ['a', 'b'], new Set(['gutter'])).length === 0, 'a var() the page sets should pass');
const unlisted = good.replace('--ink: #222;', '--ink: #222; --glow: 1px;');
expect(
  check(unlisted, ['a', 'b']).some((e) => /--glow is set by a theme/.test(e)),
  'a token a theme sets outside the list should fail',
);

const component = good + '[data-theme="b"] .tabs button { color: red; }\n';
expect(
  check(component, ['a', 'b']).some((e) => /styles \.tabs button/.test(e)),
  'a theme rule naming a component should fail: ' + check(component, ['a', 'b']).join('; '),
);
const pieces =
  good +
  ':where([data-theme="b"]) button:where(:not(.y)) { color: red; }\n[data-theme="b"] :is(.y > b, .bar i) { color: red; }\n';
expect(
  check(pieces, ['a', 'b']).length === 0,
  'piece and counted rules should pass: ' + check(pieces, ['a', 'b']).join('; '),
);

// The repository.
const css = stylesheet(readSource('src/head.html'));
const themes = themeKeys(readSource('src/page/options.js'));
const errors = check(css, themes, pageDefined());
for (const e of errors) expect(false, e);
// the list was read whole: VB-1535 cut VB-1530's 40 to 28, a list of scales; fewer is fine, a list near empty is a misread
expect(tokenList(css).length >= 20, `the token list holds ${tokenList(css).length} tokens, VB-1535 wrote 28`);

if (fail) process.exit(1);
console.log(`themes ok: ${themes.length} themes, ${tokenList(css).length} tokens`);
