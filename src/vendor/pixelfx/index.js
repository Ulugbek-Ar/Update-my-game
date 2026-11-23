// Piksel Qal'a: pixelfx'dan faqat o'yin ishlatadigan qismlar (bitta kirish nuqtasi).
// Manba: https://github.com/patch-gg/pixelfx (MIT, LICENSE va NOTICE.md ga qarang).
export { createFx, createFrame, clearFrame, composite } from "./core/fx.js";

import * as hitSpark from "./fx/impacts/hit-spark.js";
import * as critHit from "./fx/impacts/crit-hit.js";
import * as poof from "./fx/spawn/poof.js";
import * as disintegrate from "./fx/spawn/disintegrate.js";
import * as soulRise from "./fx/spawn/soul-rise.js";
import * as spawnPortal from "./fx/spawn/spawn-portal.js";
import * as collectBurst from "./fx/pickups/collect-burst.js";
import * as sunburst from "./fx/holy/sunburst.js";
import * as manaBurst from "./fx/arcane/mana-burst.js";
import * as thunderclap from "./fx/lightning/thunderclap.js";
import * as plasmaExplosion from "./fx/explosions/plasma-explosion.js";

export const FX = {
  hitSpark,
  critHit,
  poof,
  disintegrate,
  soulRise,
  spawnPortal,
  collectBurst,
  sunburst,
  manaBurst,
  thunderclap,
  plasmaExplosion,
};
