/* =============================================================================
   test/zighaptics_ref.mjs — CPU proof of ZIGHAPTICS 0.1.0 (engine/zighaptics.js)
   (run: node test/zighaptics_ref.mjs)
   Fake platforms stand in for the phone: a recording navigator.vibrate (the
   Android web path) and a recording Capacitor Haptics plugin (the iOS stub).
   Proves the organism never needs to know which one it is on.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "engine/zighaptics.js"), "utf8");
const load = (g) => { new Function("globalThis", "window", src)(g, g); return g.ZigHaptics; };

let fail = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) fail++; };
const clockAt = () => { let t = 0; const f = () => t; f.set = (v) => { t = v; }; return f; };

console.log("[android web — navigator.vibrate]");
{
  const calls = [];
  const g = { navigator: { vibrate: (p) => { calls.push(p); return true; }, userAgent: "Android" } };
  g.self = g; g.top = g;
  const clk = clockAt();
  const H = load(g).create({ now: clk });
  say(H.backend === "vibrate", "auto-detects the vibrate backend");
  H.feel({ type: "startle", strength: 1 }); clk.set(200);
  H.feel({ type: "startle", strength: 0.2 }); clk.set(400);
  say(calls.length === 2 && calls[0][0] > calls[1][0], `strength becomes pulse length (${calls[0][0]}ms strong vs ${calls[1][0]}ms weak)`);
  H.feel({ type: "pulse", strength: 0.5 }); clk.set(600);
  say(calls[2].length === 3, `a heartbeat is lub … dub (${JSON.stringify(calls[2])})`);
  H.feel({ type: "release", strength: 0.5 });
  say(calls.length === 3, "release is felt as absence — no buzz");
  clk.set(900); H.feel({ type: "wave", strength: 1 }); clk.set(1200); H.feel({ type: "wave", strength: 0.2 });
  const wv = calls.slice(-2);
  say(wv.length === 2 && wv[0].length === 5 && wv[0][0] > wv[1][0], `a wave is a swell that runs off (${JSON.stringify(wv[0])} strong vs ${JSON.stringify(wv[1])} weak)`);
  say(/duration only/.test(H.status().why), "status names the limit: duration, not amplitude");
}

console.log("[rate limit — priority, not first-come]");
{
  const calls = [];
  const g = { navigator: { vibrate: (p) => { calls.push(p); return true; } } }; g.self = g; g.top = g;
  const clk = clockAt(); const H = load(g).create({ now: clk });
  H.feel({ type: "startle", strength: 0.9 }); clk.set(20);
  H.feel({ type: "current", strength: 0.9 });
  say(calls.length === 1, "a grain tick 20ms after a startle is dropped");
  clk.set(40); H.feel({ type: "current", strength: 0.9 }); clk.set(50);
  const H2 = load(g).create({ now: clk }); calls.length = 0;
  H2.feel({ type: "current", strength: 0.9 }); clk.set(60);
  H2.feel({ type: "startle", strength: 0.9 });
  say(calls.length === 2, "a startle 10ms after a grain tick pre-empts it");
}

console.log("[the quiet floor and the off switch]");
{
  const calls = [], seen = [];
  const g = { navigator: { vibrate: (p) => { calls.push(p); return true; } } }; g.self = g; g.top = g;
  const clk = clockAt(); const H = load(g).create({ now: clk, onVisual: (e) => seen.push(e.type) });
  H.feel({ type: "notice", strength: 0.03 });
  say(calls.length === 0 && seen.length === 1, "a feeling below the floor is shown, not buzzed");
  H.enabled = false; clk.set(500); H.feel({ type: "startle", strength: 1 });
  say(calls.length === 1 && calls[0] === 0 && seen.length === 2, "disabled: vibration cancelled (vibrate(0)), light still answers");
}

console.log("[inside a frame — say so]");
{
  const g = { navigator: { vibrate: () => false } }; g.self = g; g.top = {};
  const H = load(g).create({ now: () => 0 });
  H.feel({ type: "startle", strength: 1 });
  say(/frame/.test(H.status().why) && H.status().blocked === 1, "a blocked vibrate is counted and the reason is named");
}

console.log("[iOS native — the Capacitor stub]");
{
  const log = [];
  const plugin = { impact: (o) => log.push("impact:" + o.style), notification: (o) => log.push("note:" + o.type),
                   selectionStart: () => {}, selectionChanged: () => log.push("select"), selectionEnd: () => {} };
  const g = { navigator: { userAgent: "iPhone" }, Capacitor: { isNativePlatform: () => true, Plugins: { Haptics: plugin } },
              setTimeout: (f) => f() };
  g.self = g; g.top = g;
  const clk = clockAt(); const H = load(g).create({ now: clk });
  say(H.backend === "capacitor", "a native shell is found before the web path");
  const steps = [["startle", 0.9], ["startle", 0.5], ["startle", 0.1], ["trust", 0.8], ["notice", 0.5]];
  for (const [k, s] of steps) { H.feel({ type: k, strength: s }); clk.set(clk() + 200); }
  say(JSON.stringify(log) === JSON.stringify(["impact:HEAVY", "impact:MEDIUM", "impact:LIGHT", "note:SUCCESS", "select"]),
    "strength becomes Taptic weight: " + log.join(" · "));
}

console.log("[no haptics at all — graceful silence]");
{
  const seen = [];
  const g = { navigator: { userAgent: "iPhone" } }; g.self = g; g.top = g;
  const H = load(g).create({ now: () => 0, onVisual: (e, b) => seen.push(b) });
  const felt = H.feel({ type: "startle", strength: 1 });
  say(H.backend === "none" && felt === false && seen[0] === "none", "iPhone browser: nothing buzzes, the organism is still told to answer with light");
  say(/native app/.test(H.status().why), "and the status says where haptics will come from");
}

console.log(fail ? `\nZIGHAPTICS_REF FAIL (${fail})` : "\nZIGHAPTICS_REF PASS");
process.exit(fail ? 1 : 0);
