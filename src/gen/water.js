// @sys gen/water: the map's fresh water as the generator lays it: each tile's source (w.fresh) from the lakes, the rivers and the marsh, and
// the depth to the ground's water on land (w.waterDepth), from the tile's rise above the nearest water surface
VB['gen/water'] = (() => {
  const { B } = VB['world/biomes'];
  const { ROCK } = VB['world/geology'];
  const { KIND } = VB['world/rivers'];
  const { FRESH, WELL, NO_WELL } = VB['world/water'];
  // @tunable WATERTABLE: the depth to the ground's water, from the terrain (design.md, Water by the site, The water table; Proposed, Kim's
  // starting values of 23 November). metres: what w.he 1 is read as on land (the median land tile 32 m above the sea); a tile's rise is its
  // height above the nearest water surface by steps over land: the sea at 0, a lake at its lowest bank, a river's tile at its own height.
  // Depth = base + perRise × rise × (dry − moisture w.hm) × the bedrock's factor (`rock`, by ROCK code; 1 where the world has no bedrock);
  // `marsh` is a marsh tile's depth whatever its rise. Mountains and snowfields have no well, nor has ground deeper than WELL.deepest.
  const WATERTABLE = {
    metres: 120,
    base: 1,
    perRise: 0.3,
    dry: 1.5,
    marsh: 0.5,
    rock: {
      [ROCK.GRANITE]: 1,
      [ROCK.SOAPSTONE]: 1,
      [ROCK.SANDSTONE]: 0.8,
      [ROCK.SLATE]: 1.2,
      [ROCK.LIMESTONE]: 1.4,
      [ROCK.MARBLE]: 1.4,
    },
  };

  // w.fresh: a lake tile is a lake, a tile a river runs through is running water by its flow, a marsh tile with no river is marsh.
  function sources({ N, biome, river }) {
    const fresh = new Uint8Array(N);
    for (let i = 0; i < N; i++)
      fresh[i] = river[i]
        ? river[i] < KIND.brook
          ? FRESH.BROOK
          : river[i] < KIND.stream
            ? FRESH.STREAM
            : FRESH.RIVER
        : biome[i] === B.LAKE
          ? FRESH.LAKE
          : biome[i] === B.MARSH
            ? FRESH.MARSH
            : FRESH.NONE;
    return fresh;
  }
  // The height of each lake's surface, by lake tile: the lowest land tile on its bank (0 for a lake with no bank). One flood a lake.
  function lakeLevels({ N, nb, he, water, ocean }) {
    const level = new Float32Array(N),
      seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (!water[s] || ocean[s] || seen[s]) continue;
      const q = [s];
      let low = Infinity;
      seen[s] = 1;
      for (let h = 0; h < q.length; h++)
        for (let k = 0; k < 6; k++) {
          const j = nb[q[h] * 6 + k];
          if (j < 0 || ocean[j]) continue;
          if (!water[j]) low = Math.min(low, he[j]);
          else if (!seen[j]) {
            seen[j] = 1;
            q.push(j);
          }
        }
      for (const i of q) level[i] = low < Infinity ? Math.max(0, low) : 0;
    }
    return level;
  }
  // The height of the nearest water surface of every land tile, by steps over land: one breadth-first search from every water tile (the
  // sea at 0, a lake at its level) and every river tile (at its own height). A river tile is its own surface. Where the ways to water
  // are as short through several neighbours, the surface is the mean of theirs, so that it does not go by the order the tiles are read in.
  function surfaces(t, river) {
    const { N, nb, he, water, ocean } = t,
      level = lakeLevels(t),
      surf = new Float32Array(N),
      ways = new Uint8Array(N),
      dist = new Int32Array(N).fill(-1),
      q = [];
    for (let i = 0; i < N; i++) {
      if (!water[i] && !river[i]) continue;
      surf[i] = water[i] ? (ocean[i] ? 0 : level[i]) : he[i];
      dist[i] = 0;
      q.push(i);
    }
    const seeds = q.length;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (ways[i]) surf[i] /= ways[i]; // every nearer neighbour has added its surface by now
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || (dist[j] >= 0 && dist[j] !== dist[i] + 1)) continue;
        if (dist[j] < 0) {
          dist[j] = dist[i] + 1;
          q.push(j);
        }
        surf[j] += surf[i];
        ways[j]++;
      }
    }
    VB.count.waterSettled += q.length - seeds;
    return surf;
  }
  // The world's fresh water: {fresh, waterDepth}, from the fields the map has (t.rock may be missing: a world made without the ground).
  function lay(t) {
    const { N, he, hm, water, biome, rock } = t,
      river = t.river || new Uint16Array(N),
      fresh = sources({ N, biome, river }),
      surf = surfaces(t, river),
      waterDepth = new Float32Array(N).fill(NO_WELL);
    for (let i = 0; i < N; i++) {
      if (water[i] || biome[i] === B.MOUNTAIN || biome[i] === B.SNOW) continue;
      const rise = Math.max(0, he[i] - surf[i]) * WATERTABLE.metres,
        d =
          biome[i] === B.MARSH
            ? WATERTABLE.marsh
            : WATERTABLE.base +
              WATERTABLE.perRise * rise * (WATERTABLE.dry - hm[i]) * ((rock && WATERTABLE.rock[rock[i]]) || 1);
      if (d <= WELL.deepest) waterDepth[i] = d;
    }
    // @state w.fresh: Uint8Array per tile; the tile's source of fresh water, a FRESH code of world/water (none, lake, brook, stream,
    //   river, marsh, well): laid from the lake biome, w.river by its kinds and the marsh biome; no rule reads it yet (VB-1550)
    // @state w.waterDepth: Float32Array per tile; metres down to the ground's water on a land tile, Infinity (world/water NO_WELL)
    //   where no well can be dug: water, mountain, snowfield and ground deeper than WELL.deepest; computed once, shown as a band
    return { fresh, waterDepth };
  }
  return { WATERTABLE, lay };
})();
