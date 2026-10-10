// Dump the film timeline so the score is cut to the same cues as the picture.
import { T, DURATION } from '../src/film/timeline.js';
import { SELECTED } from '../src/film/data.js';
process.stdout.write(JSON.stringify({ T, DURATION, SELECTED }, null, 1));
