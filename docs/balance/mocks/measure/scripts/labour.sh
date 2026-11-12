#!/bin/bash
# labour.sh NAME... : for each runs/NAME.json.gz, one year with idle, hours and hunger reports
M=/tmp/claude-0/-home-user-village-builder/1bd4b2d0-2042-54e2-bcb4-9656fa3cf4b9/scratchpad/mocks/measure
cd /home/user/village-builder
for n in "$@"; do
  for r in idle hours hunger; do
    [ -s $M/labour/$n-$r.json ] || node tools/sim.js --load $M/runs/$n.json.gz --years 1 --report $r --json > $M/labour/$n-$r.json 2>$M/labour/$n-$r.err
  done
done
