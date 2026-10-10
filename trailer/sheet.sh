#!/bin/bash
# sheet.sh OUTDIR "t1,t2,..." [cols] [k] -> renders stills and a contact sheet
OUT=$1; TIMES=$2; COLS=${3:-4}; K=${4:-1}
rm -rf "$OUT"; node render.mjs --stills "$TIMES" --out "$OUT" --workers 4 --k $K >/dev/null || exit 1
files=$(ls "$OUT"/still_*.png | sort -t_ -k2 -n)
montage $files -tile ${COLS}x -geometry 270x480+4+4 -background '#333' -font DejaVu-Sans -pointsize 14 -title "$OUT" "$OUT/sheet.png" 2>/dev/null || montage $files -tile ${COLS}x -geometry 270x480+4+4 -background '#333' "$OUT/sheet.png"
echo "$OUT/sheet.png"
