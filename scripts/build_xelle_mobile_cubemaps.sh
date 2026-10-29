#!/bin/sh
# Phone copies of the scene reflection maps at half size (256 px octahedral,
# half float, ZIP16): a phone screen cannot show the difference and the mobile
# download shrinks by about 6 MB. build_xelle.cjs points the mobile fallback of
# each SC*_oct.exr at these copies. The bottle maps (watches_*) keep full size.
set -e
cd "$(dirname "$0")/../public/webgl/textures/cubemaps"
mkdir -p mobile
for exr in SC*_oct.exr; do
  ffmpeg -v error -y -i "$exr" -vf scale=256:256:flags=area,format=gbrpf32le -c:v exr -compression zip16 -format half "mobile/$exr"
done
