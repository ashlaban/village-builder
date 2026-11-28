// Inline src/ into a single self-contained index.html, a derived file that is not kept in the repository (VB-450): the Pages workflow
// builds it for the site, `--stdout` prints the page and writes nothing (tests/lib/page.js: the page's tests and tools build their own
// copy, VB-449), `--check` fails if index.html is not what the sources build. Run it to play locally.
// VB-374: esbuild bundles the modules of src/manifest.json, in its order and for their effects (the VB namespace is how they meet), into
// one IIFE; the entry is made here from the manifest, so the list is kept once. The page script is spliced into body.html as before.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const esbuild = require('esbuild');

const root = __dirname, src = path.join(root, 'src');
const read = (name) => fs.readFileSync(path.join(src, name), 'utf8');
const list = (name) => JSON.parse(read(name));

async function build() {
  const entry = list('manifest.json').map((name) => `import ${JSON.stringify('./' + name)};`).join('\n');
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: src, sourcefile: 'main.js', loader: 'js' },
    bundle: true, write: false, format: 'iife', target: 'es2022', legalComments: 'none', charset: 'utf8', logLevel: 'warning',
  });
  const modules = `<script>\n${out.outputFiles[0].text}</script>\n`;
  // The page script (VB-053): src/page/*.js, in the order of src/page.json, spliced into the one closure in body.html. Each file's first
  // line is its `// @sys` header, for the lint and the module map, and is left out of the page.
  const script = list('page.json').map((name) => read(name).split('\n').slice(1).join('\n')).join('');
  const body = read('body.html');
  if (body.split('<!--__PAGE__-->\n').length !== 2) throw new Error('body.html must hold one <!--__PAGE__--> line');
  // split/join, not replace: the code holds `$&` and the like
  // The stylesheets by area (VB-1948): src/styles/*.css and the new interface's src/ui2.css (page/ui2), in the order of src/styles.json,
  // which is the cascade's, make the page's one stylesheet, which head.html leaves open for body.html to end.
  const styles = list('styles.json').map(read).join('');
  let page = read('head.html') + styles + body.split('<!--__MODULES__-->\n').join(modules).split('<!--__PAGE__-->\n').join(script);
  // The build id (VB-214): a short hash of the page's sources, so the same sources make the same page; a page save names it.
  return page.split('__BUILD_ID__').join(crypto.createHash('sha256').update(page).digest('hex').slice(0, 10));
}

(async () => {
  const t0 = process.hrtime.bigint(), page = await build();
  if (process.argv.includes('--stdout')) { process.stdout.write(page); return; }
  const target = path.join(root, 'index.html');
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (have !== page) { console.error('index.html is stale: run node build.js'); process.exit(1); }
    console.log('index.html is current');
    return;
  }
  fs.writeFileSync(target, page);
  console.log(`index.html: ${Buffer.byteLength(page).toLocaleString('en-US')} bytes, ${Number(process.hrtime.bigint() - t0) / 1e6 | 0} ms`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
