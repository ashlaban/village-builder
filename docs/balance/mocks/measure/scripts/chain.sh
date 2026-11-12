#!/bin/bash
# chain.sh SCEN SEED MAXYEARS : run in decades, save each decade
S=$1; SEED=$2; MAX=$3; MAP=${4:-small}
M=/tmp/claude-0/-home-user-village-builder/1bd4b2d0-2042-54e2-bcb4-9656fa3cf4b9/scratchpad/mocks/measure/runs
cd /home/user/village-builder
prev=""
for y in $(seq 10 10 $MAX); do
  out=$M/${S}-${MAP}-s${SEED}-y${y}.json.gz
  if [ -z "$prev" ]; then
    node tools/sim.js --scenario $S --seed $SEED --map $MAP --years 10 --save $out > $M/${S}-${MAP}-s${SEED}-y${y}.log 2>&1
  else
    node tools/sim.js --load $prev --years 10 --save $out > $M/${S}-${MAP}-s${SEED}-y${y}.log 2>&1
  fi
  prev=$out
done
echo done > $M/${S}-${MAP}-s${SEED}.done
