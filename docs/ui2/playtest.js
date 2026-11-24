// A playtester's hands and eyes: a browser session kept open by a small server, driven by one command at a time.
//   node pt.js serve NAME phone|desk [HASH]        start the session (run in the background); HASH e.g. ot7 = solo, tiny map, seed 7
//   node pt.js NAME CMD [args] [, CMD [args] ...]   commands, chained with a lone comma:
//     shot            a screenshot; prints its path (read it with the Read tool)
//     text            what the interface says now, and its buttons with their centres (x,y in CSS pixels)
//     tap X Y         tap (phone) or click (desk) at a point
//     click TEXT      press the button or link whose label contains TEXT
//     drag X1 Y1 X2 Y2   drag the map
//     zoom in|out [N] zoom the map N steps at the screen's middle (pinch or wheel)
//     wait MS         let real time pass (the game runs)
//     key K           press a key (desk)
//     stop            end the session
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), DIR = process.env.PT_DIR || path.join(require('os').tmpdir(), 'vb-pt');
fs.mkdirSync(DIR, { recursive: true });
const [, , a0, ...rest] = process.argv;
const portFile = (n) => path.join(DIR, n + '.port');
if (a0 === 'serve') {
  (async () => {
    const [name, kind, hash = 'ot7'] = rest;
    const browser = await chromium.launch();
    const ctx = await browser.newContext(kind === 'phone' ? devices['iPhone 13'] : { viewport: { width: 1366, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'index.html') + '#' + hash); // run node build.js first
    let n = 0;
    const vp = page.viewportSize();
    const run = async ([cmd, ...a]) => {
      if (cmd === 'shot') { const f = path.join(DIR, `${name}-${String(++n).padStart(3, '0')}.png`); await page.screenshot({ path: f, scale: 'css' }); return 'screenshot: ' + f; }
      if (cmd === 'text') return await page.evaluate(() => {
        const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
        const out = [`screen ${innerWidth}x${innerHeight}`];
        for (const el of document.querySelectorAll('body > *')) { if (el.id === 'stage' || el.tagName === 'SCRIPT' || !vis(el) || +getComputedStyle(el).opacity < 0.1) continue; const t = el.innerText && el.innerText.trim(); if (t) out.push(`[${el.id || el.className}]\n${t}`); }
        out.push('-- buttons --');
        for (const b of document.querySelectorAll('button, [role=button], a[href], input, select')) { if (!vis(b) || b.closest('[inert]')) continue; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!top || !(b.contains(top) || top.contains(b))) continue;
          out.push(`${(b.innerText || b.getAttribute('aria-label') || b.title || '?').trim().replace(/\s+/g, ' ').slice(0, 50)} @ ${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)}${b.disabled ? ' (disabled)' : ''}${b.getAttribute('aria-pressed') === 'true' ? ' (on)' : ''}`); }
        return out.join('\n');
      });
      if (cmd === 'tap') { if (kind === 'phone') await page.touchscreen.tap(+a[0], +a[1]); else await page.mouse.click(+a[0], +a[1]); await page.waitForTimeout(350); return `tapped ${a[0]},${a[1]}`; }
      if (cmd === 'click') { const t = a.join(' '); const loc = page.locator('button:visible, a:visible, [role=button]:visible').filter({ hasText: t }).first(); if (!(await loc.count())) { const l2 = page.locator(`[aria-label*="${t}" i]:visible`).first(); if (!(await l2.count())) return `no button "${t}"`; if (kind === 'phone') await l2.tap({ timeout: 4000 }); else await l2.click({ timeout: 4000 }); } else if (kind === 'phone') await loc.tap({ timeout: 4000 }); else await loc.click({ timeout: 4000 }); await page.waitForTimeout(350); return `pressed "${t}"`; }
      if (cmd === 'drag') { const [x1, y1, x2, y2] = a.map(Number); if (kind === 'phone') { const cdp = await ctx.newCDPSession(page); const pt = (x, y) => [{ x, y, id: 1 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x1, y1) }); for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x1 + ((x2 - x1) * k) / 8, y1 + ((y2 - y1) * k) / 8) }); await page.waitForTimeout(25); } await page.waitForTimeout(120); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 8 }); await page.waitForTimeout(120); await page.mouse.up(); } await page.waitForTimeout(300); return 'dragged'; }
      if (cmd === 'zoom') { const k = +(a[1] || 1); await page.evaluate(([dir, k, w, h]) => { for (let i = 0; i < k; i++) document.getElementById('stage').dispatchEvent(new WheelEvent('wheel', { deltaY: dir === 'in' ? -300 : 300, clientX: w / 2, clientY: h / 2, bubbles: true, cancelable: true })); }, [a[0], k, vp.width, vp.height]); await page.waitForTimeout(700); return 'zoomed ' + a[0]; }
      if (cmd === 'wait') { await page.waitForTimeout(Math.min(60000, +a[0] || 1000)); return 'waited'; }
      if (cmd === 'key') { await page.keyboard.press(a[0]); await page.waitForTimeout(250); return 'key ' + a[0]; }
      if (cmd === 'stop') { setTimeout(() => process.exit(0), 100); return 'stopped'; }
      return 'unknown command ' + cmd;
    };
    const srv = http.createServer((req, res) => { let body = ''; req.on('data', (d) => (body += d)); req.on('end', async () => { const out = []; try { for (const c of JSON.parse(body)) out.push(await run(c)); } catch (e) { out.push('error: ' + e.message.split('\n')[0]); } if (errs.length) out.push('PAGE ERRORS: ' + errs.splice(0).join(' | ')); res.end(out.join('\n')); }); });
    srv.listen(0, '127.0.0.1', () => { fs.writeFileSync(portFile(name), String(srv.address().port)); console.log('serving', name, srv.address().port); });
  })();
} else {
  const cmds = []; let cur = [];
  for (const t of rest) { if (t === ',') { cmds.push(cur); cur = []; } else cur.push(t); }
  if (cur.length) cmds.push(cur);
  const req = http.request({ host: '127.0.0.1', port: +fs.readFileSync(portFile(a0), 'utf8'), method: 'POST', timeout: 120000 }, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => console.log(b)); });
  req.on('error', (e) => console.log('session not reachable:', e.message)); req.end(JSON.stringify(cmds));
}
