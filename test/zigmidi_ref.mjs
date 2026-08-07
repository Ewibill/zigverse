/* test/zigmidi_ref.mjs — ZigMidi parses Bill's take exactly, player delivers all */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigmidi.js"), "utf8"))();
const ZM = globalThis.ZigMidi;
let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

const buf = readFileSync(path.join(root, "Zigfield_sickle_field.mid"));
const parsed = ZM.parse(new Uint8Array(buf));
say(parsed.notes === 697, "notes: " + parsed.notes + " (expected 697)");
say(parsed.breathCC === 3072, "breath CC2: " + parsed.breathCC + " (expected 3072)");
say(Math.abs(parsed.duration - 96) < 2, "duration: " + parsed.duration.toFixed(1) + "s (~96)");
const first = parsed.events.find(e => (e.data[0] & 0xF0) === 0x90 && e.data[2] > 0);
say(Math.abs(first.t - 1.89) < 0.05, "first onset at " + first.t.toFixed(2) + "s (~1.89)");

const P = { n: 0, held: new Set(), heldT: new Map(), onMsg(e) { this.n++; } };
const player = ZM.createPlayer(parsed, { into: P, loop: true });
player.toggle();
for (let t = 0; t < 97; t += 0.25) player.update(0.25);
say(P.n >= parsed.events.length, "player delivered every event (" + P.n + ")");
say(player.i === 0 || player.t < 5, "looped back to the top");
console.log(failures === 0 ? "\nZIGMIDI REF: PASS" : "\nZIGMIDI REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);
