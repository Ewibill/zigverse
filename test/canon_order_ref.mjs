/* =============================================================================
   test/canon_order_ref.mjs — THE ORDERING CONTRACT 1.0.0, proved
   (run: node test/canon_order_ref.mjs)

   "A law with no numeric test is an opinion." The ordering contract is not a
   law but the machinery every law composes through, so it is held to the same
   standard: nothing here is asserted, all of it is measured.

   The contract exists because two collisions were measured on 2026-08-17 by
   tools/order_collisions.mjs against the shipped 0.45.0 engine:

     · THE APPEND INVERSION — `.replace(A, A + block)` emits the LAST-applied
       block FIRST, `.replace(A, block + A)` emits it LAST, and both idioms are
       in use. Composition order was a property of the idiom, not of the law.
     · THE FOUR-OWNER UNDERSIDE — fabric · memory · note flash · gem all write
       the back face, in template order 0.29 → 0.27 → 0.43 → 0.33. The gem
       REPLACES, and lands last, so with gemFace="inside" the other three are
       computed and discarded. Valid shader, rendered frame, three dead laws.

   What this probe proves:
     1  rails      — stations are a declared total order, and emission obeys it
     2  INVERSION  — emission is identical whichever order the claims are filed
     3  typos      — an unknown rail or station is refused, never guessed
     4  AMBIGUOUS  — two claims at one station on one face must declare `after`
     5  CONTESTED  — two REPLACE skins on one face cannot both be visible
     6  DEAD       — a write a later REPLACE discards is a build fault
     7  faces      — front and back are independent; disjoint faces never fault
     8  THE CLAIM  — the real four-owner underside, replayed, faults exactly
                     where the measurement said it would, and a declared
                     `yieldsTo` chain clears it
     9  strict     — emit() refuses faults; an audit may report them instead
    10  radiance   — the shipped law declares a station, and it is the last one

   What this probe does NOT prove: that any of it RUNS. Nothing here executes a
   shader. eyeZ is the real gate; tools/metal_gate.mjs is the Metal one.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;
const O = ZC.Canon.Order;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  \u2713 " : "  \u2717 ") + msg); if (!ok) failures++; };
const throws = (fn) => { try { fn(); return null; } catch (e) { return String(e.message || e); } };
const kinds = (rail) => O.order(rail).faults.map((f) => f.kind);

console.log("\nTHE ORDERING CONTRACT " + O.VERSION + " \u2014 order is a law, not a leftover\n");

/* ---- 1 · the rails are a declared total order --------------------------- */
console.log("1 \u00b7 RAILS");
{
  const face = O.rails["shard.face"], light = O.rails["frame.light"];
  say(!!face && !!light, "two rails: \"shard.face\" (a body's skin) and \"frame.light\" (the light's journey)");
  say(light.stations[light.stations.length - 1] === "tone",
    "\"tone\" is the LAST station on frame.light \u2014 nothing follows the screen");
  say(light.stations.indexOf("medium") < light.stations.indexOf("tone"),
    "\"medium\" precedes \"tone\": the space between body and eye is crossed before the room is reached");
  say(face.stations.indexOf("lining") < face.stations.indexOf("tint"),
    "\"lining\" precedes \"tint\": a skin is applied before anything stains it");
  const uniq = (a) => a.length === new Set(a).size;
  say(uniq(face.stations) && uniq(light.stations), "no station is declared twice on a rail");
}

/* ---- 2 · THE INVERSION, structurally impossible ------------------------- */
console.log("\n2 \u00b7 THE APPEND INVERSION \u2014 gone, not guarded against");
{
  const file = (order) => {
    O.reset("frame.light");
    for (const id of order)
      O.claim("frame.light", { id, station: id === "radiance" ? "tone" : "medium",
        mode: "modulate", wgsl: "col = " + id + "(col);" });
    return O.emit("frame.light");
  };
  const a = file(["radiance", "ambience"]);
  const b = file(["ambience", "radiance"]);
  say(a === b, "filing radiance-then-ambience and ambience-then-radiance emit IDENTICAL WGSL");
  say(a.indexOf("ambience(") < a.indexOf("radiance("),
    "and the emitted order is ambience \u2192 radiance in both cases \u2014 scatter, then tone");
  say(a.indexOf("replace") < 0 && a.split("\n").length === 2,
    "the emission is the claims joined once \u2014 no anchor, no idiom, nothing to get backwards");
  O.reset();
}

/* ---- 3 · typos are refused, never guessed ------------------------------- */
console.log("\n3 \u00b7 A TYPO IS NOT A LAW");
{
  say(/no rail/.test(throws(() => O.claim("frame.lite", { id: "x", station: "tone" })) || ""),
    "an unknown RAIL is refused");
  const m = throws(() => O.claim("frame.light", { id: "x", station: "toan", mode: "modulate" })) || "";
  say(/not on this rail/.test(m), "an unknown STATION is refused");
  say(/body \u2192 medium \u2192 tone/.test(m), "\u2026 and the refusal names the stations that DO exist");
  say(!!throws(() => O.claim("frame.light", { station: "tone" })), "a claim with no id is refused");
  O.reset();
}

/* ---- 4 · AMBIGUOUS — the silence that made the underside --------------- */
console.log("\n4 \u00b7 AMBIGUOUS \u2014 two laws, one station, no declared order");
{
  O.reset();
  O.claim("frame.light", { id: "mist",  station: "medium", mode: "add" });
  O.claim("frame.light", { id: "glow",  station: "medium", mode: "add" });
  say(kinds("frame.light").indexOf("AMBIGUOUS") >= 0,
    "two claims at one station on the same face fault as AMBIGUOUS");
  O.reset();
  O.claim("frame.light", { id: "mist", station: "medium", mode: "add" });
  O.claim("frame.light", { id: "glow", station: "medium", mode: "add", after: ["mist"] });
  say(kinds("frame.light").length === 0, "one `after` declaration clears it");
  say(O.order("frame.light").order.map((c) => c.id).join(",") === "mist,glow",
    "\u2026 and the declared order is the emitted order");
  O.reset();
}

/* ---- 5 · CONTESTED — two skins claiming one face ----------------------- */
console.log("\n5 \u00b7 CONTESTED \u2014 two REPLACE skins on one face");
{
  O.reset();
  O.claim("shard.face", { id: "fabric", station: "lining", mode: "replace", face: "back" });
  O.claim("shard.face", { id: "gem",    station: "lining", mode: "replace", face: "back", after: ["fabric"] });
  const f = O.order("shard.face").faults;
  say(f.some((x) => x.kind === "CONTESTED"),
    "`after` orders them but does NOT reconcile them \u2014 still CONTESTED");
  say(/erases the other/.test(f.find((x) => x.kind === "CONTESTED").says),
    "\u2026 because ordering two REPLACEs does not make both visible, at any order");
  O.reset();
  O.claim("shard.face", { id: "fabric", station: "lining", mode: "replace", face: "back", yieldsTo: ["gem"] });
  O.claim("shard.face", { id: "gem",    station: "lining", mode: "replace", face: "back", after: ["fabric"] });
  say(kinds("shard.face").length === 0,
    "an explicit `yieldsTo` clears it \u2014 the loss is now a DECISION, on the record");
  O.reset();
}

/* ---- 6 · DEAD — the fault that had been shipping ------------------------ */
console.log("\n6 \u00b7 DEAD \u2014 computed, then thrown away");
{
  /* A write is DEAD when a REPLACE on the same face runs AFTER it. Station
     order decides that, so the fault is a property of the pair of stations. */
  O.reset();
  O.claim("shard.face", { id: "iridescence", station: "pigment", mode: "tint",    face: "back" });
  O.claim("shard.face", { id: "gem",         station: "lining",  mode: "replace", face: "back" });
  const f = O.order("shard.face").faults;
  say(f.some((x) => x.kind === "DEAD" && x.dead === "iridescence" && x.by === "gem"),
    "a write at an EARLIER station than a replace on the same face is DEAD");
  say(/computed and thrown away/.test(f.find((x) => x.kind === "DEAD").says),
    "\u2026 and the fault says so in the terms that matter: computed, then thrown away");

  /* The same two laws, with the tint moved to where the rail says a stain
     belongs. Nothing about either law changed; only its station. */
  O.reset();
  O.claim("shard.face", { id: "iridescence", station: "tint",   mode: "tint",    face: "back" });
  O.claim("shard.face", { id: "gem",         station: "lining", mode: "replace", face: "back" });
  say(kinds("shard.face").length === 0 &&
      O.order("shard.face").order.map((c) => c.id).join(",") === "gem,iridescence",
    "moved to \"tint\", the same write survives \u2014 `lining` before `tint` is WHY the rail is ordered that way");

  /* A REPLACE may consent to being overwritten. Then it is a decision. */
  O.reset();
  O.claim("shard.face", { id: "iridescence", station: "pigment", mode: "tint", face: "back", yieldsTo: ["gem"] });
  O.claim("shard.face", { id: "gem",         station: "lining",  mode: "replace", face: "back" });
  say(kinds("shard.face").length === 0,
    "or it may declare `yieldsTo` \u2014 the loss stays, but it is on the record instead of in the dark");
  O.reset();
}

/* ---- 7 · faces are independent ----------------------------------------- */
console.log("\n7 \u00b7 FACES");
{
  O.reset();
  O.claim("shard.face", { id: "gem",    station: "lining", mode: "replace", face: "back" });
  O.claim("shard.face", { id: "enamel", station: "lining", mode: "replace", face: "front" });
  say(kinds("shard.face").length === 0, "two REPLACEs on DIFFERENT faces do not contest \u2014 they never meet");
  O.reset();
  O.claim("shard.face", { id: "gem",  station: "lining", mode: "replace", face: "back" });
  O.claim("shard.face", { id: "wash", station: "lining", mode: "replace", face: "both" });
  say(kinds("shard.face").indexOf("CONTESTED") >= 0, "\"both\" overlaps every face, so it contests with either");
  O.reset();
}

/* ---- 8 · THE CLAIM — the real underside, replayed ----------------------- */
console.log("\n8 \u00b7 THE FOUR-OWNER UNDERSIDE, replayed");
{
  /* Filed in the order the engine EMITS them today (measured by
     tools/order_collisions.mjs): fabric 0.29 \u2192 memory 0.27 \u2192 flash 0.43 \u2192 gem 0.33,
     with every one of them pinned to the station its template position implies. */
  O.reset();
  O.claim("shard.face", { id: "fabric", since: "0.29", station: "lining", mode: "replace", face: "back" });
  O.claim("shard.face", { id: "memory", since: "0.27", station: "lining", mode: "tint", face: "back", after: ["fabric"] });
  O.claim("shard.face", { id: "flash",  since: "0.43", station: "lining", mode: "tint", face: "back", after: ["memory"] });
  O.claim("shard.face", { id: "gem",    since: "0.33", station: "lining", mode: "replace", face: "back", after: ["flash"] });
  const f = O.order("shard.face").faults;
  const dead = f.filter((x) => x.kind === "DEAD").map((x) => x.dead).sort();
  console.log("    faults: " + f.map((x) => x.kind).join(", "));
  say(dead.join(",") === "fabric,flash,memory",
    "the contract independently finds the SAME three dead writers the emitted WGSL showed");
  say(f.some((x) => x.kind === "CONTESTED" && ((x.a === "fabric" && x.b === "gem") || (x.a === "gem" && x.b === "fabric"))),
    "and names fabric-vs-gem as CONTESTED \u2014 two skins, one interior");
  say(!!throws(() => O.emit("shard.face")), "a build carrying this composition is REFUSED, not rendered");

  /* Now the same four laws, ordered by the rail instead of by template position. */
  O.reset();
  O.claim("shard.face", { id: "fabric", since: "0.29", station: "lining", mode: "replace", face: "back", yieldsTo: ["gem"] });
  O.claim("shard.face", { id: "gem",    since: "0.33", station: "lining", mode: "replace", face: "back", after: ["fabric"] });
  O.claim("shard.face", { id: "memory", since: "0.27", station: "tint",   mode: "tint",    face: "back" });
  O.claim("shard.face", { id: "flash",  since: "0.43", station: "tint",   mode: "tint",    face: "back", after: ["memory"] });
  say(O.order("shard.face").faults.length === 0, "re-stationed on the rail, the same four laws compose with NO faults");
  say(O.stamp("shard.face") === "shard.face: fabric \u2192 gem \u2192 memory \u2192 flash",
    "and the build can state its composition: \"" + O.stamp("shard.face") + "\"");
  say(O.order("shard.face").order.filter((c) => c.mode === "tint").every(
        (t) => O.order("shard.face").order.filter((r) => r.mode === "replace").every((r) => r.station !== t.station)),
    "every tint now runs after every skin \u2014 the memory and the flash reach the eye");
  O.reset();
}

/* ---- 9 · strict vs reporting ------------------------------------------- */
console.log("\n9 \u00b7 REFUSE, OR REPORT");
{
  O.reset();
  O.claim("shard.face", { id: "memory", station: "tint", mode: "tint", face: "back", wgsl: "c = tint(c);" });
  O.claim("shard.face", { id: "wash",   station: "edge", mode: "replace", face: "back", wgsl: "c = wash(c);" });
  say(!!throws(() => O.emit("shard.face")), "emit() REFUSES a faulted rail by default \u2014 a build cannot ship one");
  const s = O.emit("shard.face", { strict: false });
  say(s.indexOf("tint(c)") >= 0 && s.indexOf("wash(c)") >= 0,
    "emit({strict:false}) still emits, so an audit can report faults without blocking a diagnosis");
  say(O.order("shard.face").faults.length === 1, "and the fault is still counted, not suppressed");
  O.reset();
}

/* ---- 10 · the shipped law declares its station -------------------------- */
console.log("\n10 \u00b7 RADIANCE, ON THE RAIL");
{
  const sp = ZC.Canon.registry.radiance.splice;
  say(sp.rail === "frame.light" && sp.station === "tone",
    "radiance 0.1.0 declares frame.light/tone in its own registration");
  const st = O.rails["frame.light"].stations;
  say(st.indexOf(sp.station) === st.length - 1,
    "\u2026 which is the last station, so no future law can legally be emitted after it");
  say(ZC.Canon.registry.radiance.defaults.gain === 1,
    "and the law is still OFF at defaults \u2014 the contract changed composition, not identity");
}

console.log(failures === 0
  ? "\nPASS \u2014 THE ORDERING CONTRACT " + O.VERSION +
    ": composition order is declared, refusable, and no longer a property of build history."
  : "\nFAIL \u2014 " + failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);
