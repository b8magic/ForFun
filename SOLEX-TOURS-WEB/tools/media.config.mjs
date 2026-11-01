// Responsive image + video sources for tools/build-media.mjs.
// Crop rules (see README): people-free images in big slots; guest faces only small;
// sunset-group-three only as the people-free left crop; never campfire / group-fuego-day.
// focus = crop centre in % of the source; crop = exact pixel box (wins over aspect/focus).
// Widths are clamped to the crop's real size, so 768 px sources are never upscaled.

export const images = [
  // Hero — Fuego at night (owner photo). Mobile square, desktop full 3:4 portrait.
  { id: 'hero-m', src: 'media/owner/fuego-eruption-night-plume.jpg', aspect: '1:1', focus: [50, 45], widths: [640, 828, 1080], quality: { avif: 46, webp: 70, jpg: 72 } },
  { id: 'hero-d', src: 'media/owner/fuego-eruption-night-plume.jpg', aspect: '3:4', focus: [42, 38], widths: [640, 900, 1200], quality: { avif: 48, webp: 72, jpg: 74 } },

  // The Cabin Door — one view, three shows.
  { id: 'door-afternoon', src: 'media/owner/cabin-fuego-day.jpg', aspect: '4:5', focus: [60, 52], widths: [480, 800, 1080] },
  // People-free left part of sunset-group-three (sun + sea of clouds, camp fence). No people, no bottle.
  { id: 'door-sunset', src: 'media/owner/sunset-group-three.jpg', crop: { left: 0, top: 150, width: 448, height: 560 }, widths: [448], quality: { avif: 60, webp: 80, jpg: 82 } },
  { id: 'door-night', src: 'media/owner/fuego-eruption-night-lava.jpg', aspect: '4:5', focus: [52, 34], widths: [480, 800, 1080] },

  // The two days (timeline). Desktop sticky panel = 4:5; mobile uses two photo moments.
  { id: 'tl-trailhead', src: 'media/site/trailhead-group.jpg', crop: { left: 560, top: 90, width: 848, height: 636 }, widths: [480, 848] },
  { id: 'tl-trailhead-p', src: 'media/site/trailhead-group.jpg', crop: { left: 700, top: 120, width: 560, height: 700 }, widths: [480, 560] },
  { id: 'tl-ridge', src: 'media/site/ridge-hiker-dog.jpg', aspect: '4:5', focus: [45, 55], widths: [480, 800] },
  { id: 'tl-camp', src: 'media/owner/cabins-path-fuego-day.jpg', aspect: '4:5', focus: [72, 62], widths: [480, 800] },
  // Sunset from camp, Fuego on the left: letterbox crop that stops above the guest's head (people-free).
  { id: 'tl-sunset-wide', src: 'media/owner/sunset-guest-fuego.jpg', crop: { left: 0, top: 380, width: 768, height: 330 }, widths: [480, 768], quality: { avif: 58, webp: 78, jpg: 80 } },
  { id: 'tl-night', src: 'media/owner/fuego-eruption-night-plume.jpg', aspect: '4:5', focus: [45, 40], widths: [480, 800] },
  { id: 'tl-predawn', src: 'media/site/sunrise-crowd.jpg', aspect: '4:5', focus: [50, 60], widths: [480, 614] },
  // Bottle and paper on the ground cropped out (they sit at y ≈ 777–830).
  { id: 'tl-sunrise', src: 'media/site/sunrise-group-silhouettes.jpg', crop: { left: 100, top: 0, width: 624, height: 780 }, widths: [480, 624] },
  { id: 'tl-morning', src: 'media/site/fuego-eruption-dawn.jpg', aspect: '4:5', focus: [40, 50], widths: [480, 768] },

  // Inside a cabin — photo trio (all 4:5 so the snap row is tidy).
  { id: 'cabin-door', src: 'media/site/cabin-door-fuego.jpg', aspect: '4:5', focus: [32, 40], widths: [480, 800] },
  { id: 'cabin-row', src: 'media/owner/cabins-path-fuego-day.jpg', aspect: '4:5', focus: [72, 62], widths: [480, 800] },
  { id: 'cabin-green', src: 'media/owner/new-green-cabins.jpg', crop: { left: 508, top: 0, width: 570, height: 713 }, widths: [480, 570] },

];

export const videos = [
  // Shown at max 640 px wide (low-res, handheld source), so it is encoded at 640 px.
  { id: 'cabin-beds', src: 'media/owner/cabin-interior.mp4', vf: 'scale=640:-2', crf: 31, webmCrf: 44, posterAt: 6.6 },
];
