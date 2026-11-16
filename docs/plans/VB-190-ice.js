// scratch (VB-190): the winter's dates by latitude and by the winter's severity, from the plan's normal curve (docs/plans/VB-190.md,
// section 5.1). node docs/plans/VB-190-ice.js [lat,lat]    Research code, not game code. Days are game days of the 48-day year (spring day 1 is
// day 1, winter day 1 is day 37); a game day stands for 365 / 48 = 7.6 days of freezing or thawing.
const C = { janAt56: 0.5, janPerDeg: -1.25, julAt56: 17, julPerDeg: -0.15, coldest: 43, swing: 3, snow: -1, lake: 60, sound: 300, rot: 20, soundRot: 10, grow: 5 };
const REAL = 365 / 48;
const name = (d) => {
  d = (((d - 1) % 48) + 48) % 48;
  return ['sp', 'su', 'au', 'wi'][Math.floor(d / 12)] + ((d % 12) + 1);
};
function year(lat, sev) {
  const jan = C.janAt56 + C.janPerDeg * (lat - 56),
    jul = C.julAt56 + C.julPerDeg * (lat - 56),
    mean = (jan + jul) / 2,
    amp = (jul - jan) / 2;
  // the winter's severity moves the cold half of the year only: sev -1 is a hard winter, C.swing degrees colder at its coldest
  const T = (d) => {
    const c = Math.cos((2 * Math.PI * (d - C.coldest)) / 48);
    return mean - amp * c + (c > 0 ? C.swing * sev * c : 0);
  };
  let fdd = 0,
    tdd = 0,
    snowOn = null,
    snowOff = null,
    lakeOn = null,
    lakeOff = null,
    soundOn = null,
    soundOff = null,
    lakeOpen = null,
    growOn = null,
    growOff = null;
  for (let d = 25; d < 25 + 48; d++) {
    // from autumn day 1 round the year
    const t = T(d);
    if (snowOn === null && t < C.snow) snowOn = d;
    if (snowOn !== null && snowOff === null && d > C.coldest && t > -C.snow) snowOff = d;
    if (t < 0) {
      fdd += -t * REAL;
      tdd = 0;
    } else if (fdd > 0 && d > C.coldest) tdd += t * REAL;
    if (lakeOn === null && fdd >= C.lake) lakeOn = d;
    if (soundOn === null && fdd >= C.sound) soundOn = d;
    if (soundOn !== null && soundOff === null && tdd >= C.soundRot) soundOff = d;
    if (lakeOn !== null && lakeOff === null && tdd >= C.rot) lakeOff = d;
    if (lakeOff !== null && lakeOpen === null && tdd >= 3 * C.rot) lakeOpen = d;
    if (growOn === null && d > C.coldest && t >= C.grow) growOn = d;
  }
  for (let d = 13; d < 49; d++) if (growOff === null && d > 19 && T(d) < C.grow) growOff = d;
  const span = (a, b) => (a === null ? '-' : `${name(a)} to ${name(b)} (${b - a})`);
  return {
    lat,
    sev,
    coldest: +T(C.coldest).toFixed(1),
    fdd: Math.round(fdd),
    snow: span(snowOn, snowOff),
    lakeIce: span(lakeOn, lakeOff),
    lakeOpen: lakeOpen === null ? '-' : name(lakeOpen),
    soundIce: span(soundOn, soundOff),
    growing: growOn === null ? '-' : `${name(growOn)} to ${name(growOff)} (${growOff + 48 - growOn})`,
  };
}
for (const lat of (process.argv[2] || "56,58,60,62,64,66").split(",").map(Number)) for (const sev of [1, 0, -1]) console.log(JSON.stringify(year(lat, sev)));
