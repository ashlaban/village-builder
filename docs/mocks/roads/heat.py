# usage: python3 docs/mocks/roads/heat.py docs/mocks/roads/img/heat/heat-3.json
# The heat map of a village's walks over one game year (heat.js): each cell coloured by how many walks passed it, on a log scale,
# over the hexes (water blue, fields outlined, houses marked). Writes <json>-map.png beside the JSON... as heat-<seed>.png.
import base64, json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

src = sys.argv[1]
d = json.load(open(src))
GW, GH, S = d['GW'], d['GH'], d['S']
x0, y0, x1, y1 = d['box']
grid = np.frombuffer(base64.b64decode(d['grid']), dtype=np.float32).reshape(GH, GW)
K = 3  # pixels per map unit
W, H = GW * K, GH * K
R = d['R']
px = lambda x, y: ((x - x0) * K, (y - y0) * K)

# inferno-like ramp
stops = [(0, (0, 0, 4)), (0.15, (40, 11, 84)), (0.35, (101, 21, 110)), (0.55, (178, 50, 90)), (0.72, (229, 92, 48)), (0.87, (248, 161, 28)), (1, (252, 255, 164))]
def ramp(t):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            u = (t - a) / (b - a)
            return tuple(int(ca[k] + (cb[k] - ca[k]) * u) for k in range(3))
    return stops[-1][1]
lut = np.array([ramp(i / 255) for i in range(256)], dtype=np.uint8)

g = grid.copy()
mx = float(g.max())
t = np.log1p(g) / math.log1p(mx)
img = Image.fromarray(lut[(t * 255).astype(np.uint8)], 'RGB').resize((W, H), Image.NEAREST)
img = img.filter(ImageFilter.GaussianBlur(1.2))
base = Image.new('RGB', (W, H), (16, 18, 24))
dr = ImageDraw.Draw(base)
hexpts = lambda cx, cy, r: [px(cx + r * math.cos(math.radians(30 + 60 * k)), cy + r * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
N = len(d['hx'])
for i in range(N):
    cx, cy = d['hx'][i], d['hy'][i]
    if cx < x0 - R or cx > x1 + R or cy < y0 - R or cy > y1 + R:
        continue
    if d['water'][i]:
        dr.polygon(hexpts(cx, cy, R), fill=(18, 34, 58))
# heat on top where there is any
mask = Image.fromarray(((g > 0) * 255).astype(np.uint8), 'L').resize((W, H), Image.NEAREST).filter(ImageFilter.GaussianBlur(1.2))
base.paste(img, (0, 0), mask)
dr = ImageDraw.Draw(base)
for i in range(N):
    cx, cy = d['hx'][i], d['hy'][i]
    if cx < x0 - R or cx > x1 + R or cy < y0 - R or cy > y1 + R:
        continue
    dr.polygon(hexpts(cx, cy, R), outline=(60, 66, 80))
for f in d['fields']:
    dr.polygon(hexpts(d['hx'][f], d['hy'][f], R * 0.86), outline=(196, 170, 90), width=2)
for h in d['houses']:
    x, y = px(d['hx'][h], d['hy'][h])
    dr.rectangle((x - 12, y - 10, x + 12, y + 10), outline=(255, 255, 255), width=3)
for h in d['houses']:  # a house's gate (VB-1951): a green bar on the side it opens
    g = d.get('gate')
    if g and g[h] >= 0:
        n = d['nb'][h * 6 + g[h]]
        gx, gy = (d['hx'][h] + d['hx'][n]) / 2, (d['hy'][h] + d['hy'][n]) / 2
        x, y = px(gx, gy)
        dr.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(80, 230, 120), outline=(0, 0, 0), width=2)
if d.get('well') is not None and d['well'] >= 0:
    x, y = px(d['hx'][d['well']], d['hy'][d['well']])
    dr.ellipse((x - 8, y - 8, x + 8, y + 8), outline=(120, 200, 255), width=3)
# legend
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
    bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except OSError:
    font = bold = ImageFont.load_default()
pad = 20
dr.rectangle((0, 0, W, 120), fill=(16, 18, 24))
dr.text((pad, 14), f"{d['name']}: every walk of one game year ({d['walks']:,} walks, {len(d['houses'])} farms, {d['pop']} people)", fill=(235, 235, 235), font=bold)
bx, by, bw = pad, 64, 420
for k in range(bw):
    dr.line((bx + k, by, bx + k, by + 22), fill=tuple(int(v) for v in lut[int(k / bw * 255)]))
for v in [1, 10, 100, 1000, 10000]:
    if v > mx:
        break
    xx = bx + bw * math.log1p(v) / math.log1p(mx)
    dr.line((xx, by + 22, xx, by + 30), fill=(200, 200, 200))
    dr.text((xx - 10, by + 30), str(v), fill=(200, 200, 200), font=font)
dr.text((bx + bw + 70, by - 2), 'walks a year through the spot (log scale)', fill=(200, 200, 200), font=font)
dr.text((bx + bw + 70, by + 28), 'white box: house   green dot: gate   yellow: field   blue ring: well', fill=(200, 200, 200), font=font)
out = src.replace('.json', '.png')
base.save(out)
print(out, base.size, 'max', mx)
