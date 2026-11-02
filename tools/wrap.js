// Wraps JavaScript lines over 160 characters at safe token boundaries, for refactors that move code (the refactor rules in BACKLOG.md; VB-161).
// node tools/wrap.js [--dry] FILE...         wrap in place (--dry: only report); prints breaks made and lines it could not wrap
// node tools/wrap.js --compare OLD NEW       compare the inline scripts of two built pages token by token (whitespace outside literals ignored)
// It breaks only after ; , { && || => ?? and, at lower preference, ? : + ( (useful inside ${...} code), never inside strings, template text,
// regexes or comments, so no automatic semicolon can be inserted and no literal changes. Among the breaks that fit it takes the shallowest
// bracket depth, a statement end (;) first, then the latest; continuation lines are indented 2 more. Lines it cannot wrap (long template
// text) are listed for wrapping by hand. A wrapped file's token stream is checked against the original before it is written.
const fs = require('fs');
const MAX = 160;
const OPS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.',
  '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const BREAK_AFTER = new Set([';', ',', '{', '&&', '||', '=>', '??', '?', ':', '+', '(']), WEAK = new Set(['?', ':', '+', '(']);
const BEFORE_REGEX = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

// tokens {t, s, e, v?, open?}: t is str, tpl (a template chunk with its delimiters; open when it ends in ${), re, com, punct, word or num
function tokenize(src) {
  const toks = [], tplStack = [], n = src.length;
  let i = 0, braces = 0;
  const prev = () => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'com') return toks[k]; return null; };
  const regexAllowed = () => {
    const p = prev();
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 're') return false;
    if (p.t === 'tpl') return p.open;
    if (p.t === 'word') return BEFORE_REGEX.test(p.v);
    return !/^[)\]}]$/.test(p.v);
  };
  const readTpl = (j) => { // from after ` or }, to after the closing ` or the next ${
    for (; j < n; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === '`') return [j + 1, false];
      if (src[j] === '$' && src[j + 1] === '{') return [j + 2, true];
    }
    throw new Error('unterminated template literal');
  };
  const tpl = (s) => { const [e, open] = readTpl(s + 1); toks.push({ t: 'tpl', s, e, open }); if (open) tplStack.push(braces); i = e; };
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i), end = e < 0 ? n : e; toks.push({ t: 'com', s: i, e: end }); i = end; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2) + 2; toks.push({ t: 'com', s: i, e: end }); i = end; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      for (; src[j] !== c; j++) { if (src[j] === '\\') j++; if (j >= n || src[j] === '\n') throw new Error('unterminated string at ' + i); }
      toks.push({ t: 'str', s: i, e: j + 1 }); i = j + 1; continue;
    }
    if (c === '`') { tpl(i); continue; }
    if (c === '}' && tplStack.length && tplStack[tplStack.length - 1] === braces) { tplStack.pop(); tpl(i); continue; }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      for (; src[j] !== '/' || cls; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (j >= n || src[j] === '\n') throw new Error('unterminated regex at ' + i);
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
      }
      for (j++; /[a-z]/.test(src[j]); j++);
      toks.push({ t: 're', s: i, e: j }); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && /[\w$]/.test(src[j])) j++; toks.push({ t: 'word', s: i, e: j, v: src.slice(i, j) }); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      while (j < n && /[\w.]/.test(src[j])) { if (/[eE]/.test(src[j]) && /[+-]/.test(src[j + 1])) j++; j++; }
      toks.push({ t: 'num', s: i, e: j }); i = j; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i)) || c;
    if (op === '{') braces++;
    if (op === '}') braces--;
    toks.push({ t: 'punct', s: i, e: i + op.length, v: op }); i += op.length;
  }
  return toks;
}

// the break points of one line: after a BREAK_AFTER token followed, on the same line, by a token that is not a comment
function breakPoints(src, toks) {
  const out = [];
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k], nx = toks[k + 1];
    if (t.t === 'punct' && /^[([{]$/.test(t.v)) depth++;
    if (t.t === 'punct' && /^[)\]}]$/.test(t.v)) depth--;
    if (t.t === 'tpl' && src[t.s] === '}') depth--;
    if (t.t === 'tpl' && t.open) depth++;
    if (t.t === 'punct' && BREAK_AFTER.has(t.v) && nx && nx.t !== 'com') out.push({ pos: t.e, next: nx.s, depth: depth - (t.v === '{' ? 1 : 0), kind: t.v });
  }
  return out;
}

function wrap(src) {
  const toks = tokenize(src), starts = [0], edits = [], unwrapped = [];
  for (let k = 0; k < src.length; k++) if (src[k] === '\n') starts.push(k + 1);
  for (let L = 0; L < starts.length; L++) {
    const ls = starts[L], le = L + 1 < starts.length ? starts[L + 1] - 1 : src.length;
    if (le - ls <= MAX) continue;
    const cont = src.slice(ls, le).match(/^\s*/)[0] + '  ';
    const cands = breakPoints(src, toks.filter((t) => t.s >= ls && t.s < le));
    for (let start = ls, first = true; (first ? 0 : cont.length) + le - start > MAX; first = false) {
      const limit = start + MAX - (first ? 0 : cont.length), fit = cands.filter((c) => c.pos > start + 20 && c.pos <= limit);
      if (!fit.length) { unwrapped.push(L + 1); break; }
      const strong = fit.filter((c) => !WEAK.has(c.kind)), pool = strong.length ? strong : fit;
      const shallow = pool.filter((c) => c.depth === Math.min(...pool.map((d) => d.depth)));
      const semis = shallow.filter((c) => c.kind === ';');
      const pick = (semis.length ? semis : shallow).reduce((a, b) => (b.pos > a.pos ? b : a));
      edits.push({ from: pick.pos, to: pick.next, text: '\n' + cont });
      start = pick.next;
    }
  }
  let out = src;
  for (const ed of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, ed.from) + ed.text + out.slice(ed.to);
  return { out, breaks: edits.length, unwrapped };
}

const tokenTexts = (src) => tokenize(src).map((t) => src.slice(t.s, t.e));
module.exports = { tokenize, wrap, tokenTexts };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--compare') {
    const scripts = (f) => [...fs.readFileSync(f, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const markup = (f) => fs.readFileSync(f, 'utf8').replace(/<script>[\s\S]*?<\/script>/g, '');
    const [a, b] = [args[1], args[2]].map((f) => tokenTexts(scripts(f)));
    const diffs = [];
    for (let k = 0; k < Math.max(a.length, b.length); k++) if (a[k] !== b[k]) diffs.push(k);
    console.log(`tokens ${a.length} -> ${b.length}; markup outside scripts ${markup(args[1]) === markup(args[2]) ? 'identical' :
      'differs'}; ${diffs.length} tokens differ`);
    for (const k of diffs.slice(0,
      10)) console.log(`  token ${k}: ${JSON.stringify(String(a[k]).slice(0, 100))}\n    -> ${JSON.stringify(String(b[k]).slice(0, 100))}`);
    process.exit(diffs.length ? 1 : 0);
  }
  const dry = args.includes('--dry');
  for (const f of args.filter((x) => x !== '--dry')) {
    const src = fs.readFileSync(f, 'utf8'), { out, breaks, unwrapped } = wrap(src);
    if (tokenTexts(out).join('\n') !== tokenTexts(src).join('\n')) throw new Error(f + ': the token stream changed; nothing written');
    console.log(`${f}: ${breaks} breaks${unwrapped.length ? `; not wrapped, by hand: lines ${unwrapped.join(', ')}` : ''}`);
    if (!dry && breaks) fs.writeFileSync(f, out);
  }
}
