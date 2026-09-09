#!/usr/bin/env node
/* =============================================================================
   tools/apply_ewi_scope.mjs — THE SCOPE GETS THE EWI
   run:  node tools\\apply_ewi_scope.mjs            (install + verify)
         node tools\\apply_ewi_scope.mjs --gates    (install, then run the gate)
         node tools\\apply_ewi_scope.mjs --gates-only

   Carries its payload as base64 because .js does not land reliably on eyeZ.
   Every file is re-read from disk after writing and checked byte-for-byte and
   by sha256 against what was carried. Nothing is reported as installed unless
   it verified. A file that already matches is left alone and reported UNCHANGED.

   WHAT THIS CHANGES
     tools/relay_scope.html  Web MIDI. EWI note-on = a NOTE CHANGE (drives the
                               lag AND feeds Pacemaker, so `snap` is real); CC2
                               breath = the supply into the head. Live readout of
                               Pacemaker period / confidence / flow.
     tools/serve.mjs         NEW - a dependency-free local server. Web MIDI is
                               only granted on a SECURE CONTEXT, and file:// is
                               not one: opened by double-click the page can never
                               see the EWI, silently, with no prompt. localhost IS
                               a secure context. That is the whole reason.

   The engine is NOT touched. zigcore.js and vertebra_ref.mjs are already at 0.23
   on eyeZ and are deliberately not carried again.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* FINDING THE ROOT IS NOT ASSUMED, IT IS PROVEN.
   Two ways to guess where the repo is, and neither is trusted on faith:
     1. fileURLToPath(import.meta.url)/..  — fileURLToPath, NOT url.pathname. On
        Windows the latter yields "/C:/Users/..." and joining it onto anything
        produces "C:\\C:\\Users\\..." — the fault that killed the first build of
        this installer. It passed on Linux and could not pass on eyeZ.
     2. process.cwd() — correct whenever you run it from the repo root.
   A candidate is only accepted if engine/zigcore.js and test/ are actually
   THERE. An installer that cannot prove where it is must not write. */
const CANDIDATES = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  process.cwd()
];
const looksRight = (d) => existsSync(path.join(d, "engine", "zigcore.js")) &&
                          existsSync(path.join(d, "test")) &&
                          existsSync(path.join(d, "tools"));
const ROOT = CANDIDATES.find(looksRight);
if (!ROOT) {
  console.log("\n  CANNOT LOCATE THE REPO. Tried:");
  CANDIDATES.forEach((d) => console.log("    " + d));
  console.log("  Run this from C:\\Users\\billy\\Zigverse — nothing was written.\n");
  process.exit(1);
}
const args = process.argv.slice(2);
const gates = args.includes("--gates") || args.includes("--gates-only");
const only  = args.includes("--gates-only");
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

const PAYLOAD = [
  { path: 'tools/relay_scope.html', bytes: 9790, sha: '7a1b61af32fa01a6', b64: "PCFET0NUWVBFIGh0bWw+CjwhLS0gdG9vbHMvcmVsYXlfc2NvcGUuaHRtbCDigJQgVEhFIFJFTEFZIFNDT1BFIChaaWdDb3JlLlJlbGF5IDAuMjMpCiAgICAgQSBkaWFnbm9zdGljLCBub3QgYW4gb3JnYW5pc20uIENhbnZhcyAyRCBvbiBwdXJwb3NlOiBubyBXZWJHUFUsIG5vIHNoYWRlcgogICAgIHBhdGgsIG5vdGhpbmcgaGVyZSBjYW4gYmxhY2stc2NyZWVuIGFueXRoaW5nLgoKICAgICBJdCBhbnN3ZXJzIHRoZSBxdWVzdGlvbnMgb25seSBCaWxsJ3MgaGFuZHMgYW5kIGV5ZSBjYW4gYW5zd2VyOgogICAgICAgwrcgZG9lcyB0aGUgZGVsYXkgcmVhZCBhcyBDQVVTQVRJT04gb3IgYXMgd29iYmxlPwogICAgICAgwrcgZHJpdmVuIGJ5IE5PVEUgQ0hBTkdFUywgZG9lcyB0aGUgYm9keSBmb2xsb3cgdGhlIHdheSBhIHBocmFzZSBtb3Zlcz8KICAgICAgIMK3IGRvZXMgdGhlIENBVENILVVQIHJlYWQgYXMgYSBib2R5IGNvbXByZXNzaW5nLCBvciBhcyBjbHV0dGVyPwogICAgICAgwrcgcmF3IG5vdGUgaW50ZXJ2YWwsIG9yIFBhY2VtYWtlcidzIHBocmFzZSBwdWxzZT8gKGBzbmFwYCkKCiAgICAgTUlESSBORUVEUyBBIFNFQ1VSRSBDT05URVhULiBPcGVuZWQgYXMgZmlsZTovLyB0aGlzIHBhZ2UgY2FuIG5ldmVyIHNlZSB0aGUKICAgICBFV0kg4oCUIG5vIHByb21wdCwgbm8gZXJyb3IsIGp1c3Qgc2lsZW5jZS4gUnVuIGBub2RlIHRvb2xzL3NlcnZlLm1qc2AgYW5kIG9wZW4KICAgICBpdCBvbiBodHRwOi8vbG9jYWxob3N0LCB3aGljaCBJUyBhIHNlY3VyZSBjb250ZXh0LiBUaGUgYmFubmVyIHRvcC1yaWdodCBzYXlzCiAgICAgd2hpY2ggY2FzZSB5b3UgYXJlIGluLiAgLS0+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij48dGl0bGU+UmVsYXkgc2NvcGUg4oCUIDAuMjM8L3RpdGxlPgo8c3R5bGU+CiAgaHRtbCxib2R5e21hcmdpbjowO2hlaWdodDoxMDAlO2JhY2tncm91bmQ6IzA3MDgwYTtjb2xvcjojOGE4Zjk4OwogICAgZm9udDoxM3B4LzEuNSB1aS1tb25vc3BhY2UsTWVubG8sQ29uc29sYXMsbW9ub3NwYWNlO292ZXJmbG93OmhpZGRlbn0KICAjY3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMHZ3O2hlaWdodDoxMDB2aDt0b3VjaC1hY3Rpb246bm9uZX0KICAjdWl7cG9zaXRpb246Zml4ZWQ7bGVmdDoxNnB4O3RvcDoxNHB4O3otaW5kZXg6Mjt1c2VyLXNlbGVjdDpub25lfQogICN1aSBie2NvbG9yOiNkOGRkZTQ7Zm9udC13ZWlnaHQ6NTAwfQogIGxhYmVse2Rpc3BsYXk6YmxvY2s7bWFyZ2luOjZweCAwIDB9CiAgaW5wdXRbdHlwZT1yYW5nZV17d2lkdGg6MTUwcHg7dmVydGljYWwtYWxpZ246bWlkZGxlO2FjY2VudC1jb2xvcjojYzk4YTZhfQogIGlucHV0W3R5cGU9cmFuZ2VdOmRpc2FibGVke29wYWNpdHk6LjM1fQogIHNlbGVjdHtiYWNrZ3JvdW5kOiMxMjE1MWE7Y29sb3I6I2Q4ZGRlNDtib3JkZXI6MXB4IHNvbGlkICMyNjJjMzU7Zm9udDppbmhlcml0O3BhZGRpbmc6MXB4IDRweH0KICBzcGFuLnZ7Y29sb3I6I2M5OGE2YX0KICAjbWlkaXtwb3NpdGlvbjpmaXhlZDtyaWdodDoxNnB4O3RvcDoxNHB4O3otaW5kZXg6Mjt0ZXh0LWFsaWduOnJpZ2h0O2xpbmUtaGVpZ2h0OjEuNH0KICAjbWlkaSAub2t7Y29sb3I6IzhmYmY3YX0gI21pZGkgLm5ve2NvbG9yOiNjOTZhNmF9CiAgI2hpbnR7cG9zaXRpb246Zml4ZWQ7bGVmdDoxNnB4O2JvdHRvbToxNHB4O3otaW5kZXg6Mn0KPC9zdHlsZT4KPGNhbnZhcyBpZD0iYyI+PC9jYW52YXM+CjxkaXYgaWQ9InVpIj4KICA8Yj5SRUxBWSAwLjIzIOKAlCB0aGUgc3BpbmU8L2I+CiAgPGxhYmVsPm1vZGUgPHNlbGVjdCBpZD0ibW9kZSI+CiAgICA8b3B0aW9uIHZhbHVlPSJsaXZlIj5sYWcgZnJvbSBOT1RFIENIQU5HRVM8L29wdGlvbj4KICAgIDxvcHRpb24gdmFsdWU9ImZpeGVkIj5sYWcgZml4ZWQ8L29wdGlvbj4KICA8L3NlbGVjdD48L2xhYmVsPgogIDxsYWJlbD5sYWcgPGlucHV0IGlkPSJsYWciIHR5cGU9InJhbmdlIiBtaW49IjAiIG1heD0iMC42MCIgc3RlcD0iMC4wMSIgdmFsdWU9IjAuMTciPjxzcGFuIGNsYXNzPSJ2IiBpZD0ibGFndiI+PC9zcGFuPiBzL2hvcDwvbGFiZWw+CiAgPGxhYmVsPnJhdGlvIDxpbnB1dCBpZD0icmF0aW8iIHR5cGU9InJhbmdlIiBtaW49IjAuMjUiIG1heD0iMiIgc3RlcD0iMC4wNSIgdmFsdWU9IjEiPjxzcGFuIGNsYXNzPSJ2IiBpZD0icmF0aW92Ij48L3NwYW4+ICZ0aW1lczsgaW50ZXJ2YWw8L2xhYmVsPgogIDxsYWJlbD5zbmFwIDxpbnB1dCBpZD0ic25hcCIgdHlwZT0icmFuZ2UiIG1pbj0iMCIgbWF4PSIxIiBzdGVwPSIwLjA1IiB2YWx1ZT0iMCI+PHNwYW4gY2xhc3M9InYiIGlkPSJzbmFwdiI+PC9zcGFuPiByYXcgJnJhcnI7IHB1bHNlPC9sYWJlbD4KICA8bGFiZWw+Z2FpbiA8aW5wdXQgaWQ9ImdhaW4iIHR5cGU9InJhbmdlIiBtaW49IjAuMjUiIG1heD0iMSIgc3RlcD0iMC4wNSIgdmFsdWU9IjEiPjxzcGFuIGNsYXNzPSJ2IiBpZD0iZ2FpbnYiPjwvc3Bhbj48L2xhYmVsPgogIDxsYWJlbD5ibGVlZCA8aW5wdXQgaWQ9ImJsZWVkIiB0eXBlPSJyYW5nZSIgbWluPSIwIiBtYXg9IjEuMiIgc3RlcD0iMC4wNSIgdmFsdWU9IjAuMzUiPjxzcGFuIGNsYXNzPSJ2IiBpZD0iYmxlZWR2Ij48L3NwYW4+IC9zPC9sYWJlbD4KICA8bGFiZWw+c2VnbWVudHMgPGlucHV0IGlkPSJuIiB0eXBlPSJyYW5nZSIgbWluPSIzIiBtYXg9IjE0IiBzdGVwPSIxIiB2YWx1ZT0iOCI+PHNwYW4gY2xhc3M9InYiIGlkPSJudiI+PC9zcGFuPjwvbGFiZWw+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPnRyYW5zaXQgPHNwYW4gY2xhc3M9InYiIGlkPSJ0ciI+PC9zcGFuPnMgJm1pZGRvdDsgaGVhZCA8c3BhbiBjbGFzcz0idiIgaWQ9ImhkIj48L3NwYW4+ICZtaWRkb3Q7IGluIGZsaWdodCA8c3BhbiBjbGFzcz0idiIgaWQ9ImZsIj48L3NwYW4+PC9kaXY+CiAgPGRpdj5pbnRlcnZhbCA8c3BhbiBjbGFzcz0idiIgaWQ9Iml2Ij48L3NwYW4+cyAmbWlkZG90OyBsaXZlIGxhZyA8c3BhbiBjbGFzcz0idiIgaWQ9Imx2Ij48L3NwYW4+czwvZGl2PgogIDxkaXY+cGFjZW1ha2VyIDxzcGFuIGNsYXNzPSJ2IiBpZD0icG0iPjwvc3Bhbj48L2Rpdj4KPC9kaXY+CjxkaXYgaWQ9Im1pZGkiPiZoZWxsaXA7PC9kaXY+CjxkaXYgaWQ9ImhpbnQiPmhvbGQgLyBwcmVzcyB0byBwbGF5IGJ5IGhhbmQgJm1pZGRvdDsgb3IgcnVuIDxiPm5vZGUgdG9vbHMvc2VydmUubWpzPC9iPiBhbmQgb3BlbiBvbiBsb2NhbGhvc3QgdG8gdXNlIHRoZSBFV0k8L2Rpdj4KPHNjcmlwdCBzcmM9Ii4uL2VuZ2luZS96aWdjb3JlLmpzIj48L3NjcmlwdD4KPHNjcmlwdD4KKGZ1bmN0aW9uICgpIHsKICB2YXIgWkMgPSB3aW5kb3cuWmlnQ29yZSwgUkwgPSBaQy5SZWxheSwgUE0gPSBaQy5QYWNlbWFrZXI7CiAgdmFyIGMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiYyIpLCBnID0gYy5nZXRDb250ZXh0KCIyZCIpOwogIHZhciBlbCA9IGZ1bmN0aW9uIChpZCkgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpOyB9OwogIHZhciBTID0geyBsYWc6IGVsKCJsYWciKSwgZ2FpbjogZWwoImdhaW4iKSwgYmxlZWQ6IGVsKCJibGVlZCIpLCBuOiBlbCgibiIpLAogICAgICAgICAgICByYXRpbzogZWwoInJhdGlvIiksIHNuYXA6IGVsKCJzbmFwIiksIG1vZGU6IGVsKCJtb2RlIikgfTsKCiAgdmFyIHIgPSBudWxsLCBoZWxkID0gZmFsc2UsIGxhc3QgPSBwZXJmb3JtYW5jZS5ub3coKSwgZmxhc2ggPSBbXTsKICB2YXIgYnJlYXRoID0gMDsgICAgICAgICAgICAgIC8qIDAuLjEg4oCUIENDMiBmcm9tIHRoZSBFV0ksIG9yIDEgd2hpbGUgaGVsZCBieSBoYW5kICovCiAgdmFyIGxhc3ROb3RlTmFtZSA9ICJcdTIwMTQiOwoKICBmdW5jdGlvbiBidWlsZCgpIHsKICAgIHZhciBuID0gK1Mubi52YWx1ZTsKICAgIHIgPSBSTC5jcmVhdGUoewogICAgICBuOiBuLCBmdWxsOiAxLCByZXNldDogMC4xMiwgc3BpbGw6IDAuMTQsCiAgICAgIGxhZzogK1MubGFnLnZhbHVlLCBnYWluOiArUy5nYWluLnZhbHVlLCBibGVlZDogK1MuYmxlZWQudmFsdWUsIHRhdTogMC41LAogICAgICByYXRpbzogK1MucmF0aW8udmFsdWUsIHNuYXA6ICtTLnNuYXAudmFsdWUsIGxhZ01pbjogMC4wMywgbGFnTWF4OiAwLjYwCiAgICB9KTsKICAgIGZsYXNoID0gbmV3IEFycmF5KG4pLmZpbGwoMCk7CiAgICBlbCgibGFndiIpLnRleHRDb250ZW50ICAgPSAoK1MubGFnLnZhbHVlKS50b0ZpeGVkKDIpOwogICAgZWwoImdhaW52IikudGV4dENvbnRlbnQgID0gKCtTLmdhaW4udmFsdWUpLnRvRml4ZWQoMik7CiAgICBlbCgiYmxlZWR2IikudGV4dENvbnRlbnQgPSAoK1MuYmxlZWQudmFsdWUpLnRvRml4ZWQoMik7CiAgICBlbCgicmF0aW92IikudGV4dENvbnRlbnQgPSAoK1MucmF0aW8udmFsdWUpLnRvRml4ZWQoMik7CiAgICBlbCgic25hcHYiKS50ZXh0Q29udGVudCAgPSAoK1Muc25hcC52YWx1ZSkudG9GaXhlZCgyKTsKICAgIGVsKCJudiIpLnRleHRDb250ZW50ICAgICA9IG47CiAgICBlbCgibGFnIikuZGlzYWJsZWQgPSAoUy5tb2RlLnZhbHVlID09PSAibGl2ZSIpOwogIH0KICBPYmplY3Qua2V5cyhTKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7CiAgICBTW2tdLmFkZEV2ZW50TGlzdGVuZXIoImlucHV0IiwgYnVpbGQpOwogICAgU1trXS5hZGRFdmVudExpc3RlbmVyKCJjaGFuZ2UiLCBidWlsZCk7CiAgfSk7CiAgYnVpbGQoKTsKCiAgZnVuY3Rpb24gcmVzaXplKCkgewogICAgdmFyIGQgPSBNYXRoLm1pbigyLCBkZXZpY2VQaXhlbFJhdGlvIHx8IDEpOwogICAgYy53aWR0aCA9IGlubmVyV2lkdGggKiBkOyBjLmhlaWdodCA9IGlubmVySGVpZ2h0ICogZDsKICAgIGcuc2V0VHJhbnNmb3JtKGQsIDAsIDAsIGQsIDAsIDApOwogIH0KICBhZGRFdmVudExpc3RlbmVyKCJyZXNpemUiLCByZXNpemUpOyByZXNpemUoKTsKCiAgLyogLS0tLSBBIE5PVEUgQ0hBTkdFLiBPbmUgZW50cnkgcG9pbnQsIHdoZXRoZXIgaXQgY2FtZSBmcm9tIGEgZmluZ2VyIG9yIGZyb20KICAgICB0aGUgRVdJLiBSZWxheSBtZWFzdXJlcyB0aGUgaW50ZXJ2YWwgaXRzZWxmOyBQYWNlbWFrZXIgZ2V0cyB0aGUgc2FtZSBldmVudAogICAgIHNvIGBzbmFwYCBoYXMgYSByZWFsIHBocmFzZSBwdWxzZSB0byBibGVuZCB0b3dhcmQuIC0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqLwogIGZ1bmN0aW9uIG5vdGVDaGFuZ2UoKSB7CiAgICB2YXIgdCA9IHBlcmZvcm1hbmNlLm5vdygpIC8gMTAwMDsKICAgIGlmIChTLm1vZGUudmFsdWUgPT09ICJsaXZlIikgUkwubm90ZShyLCB0LCBQTSk7CiAgICBQTS5ub3RlT24odCk7CiAgfQoKICB2YXIgZG93biA9IGZ1bmN0aW9uICgpIHsgaGVsZCA9IHRydWU7IG5vdGVDaGFuZ2UoKTsgfTsKICB2YXIgdXAgPSBmdW5jdGlvbiAoKSB7IGhlbGQgPSBmYWxzZTsgfTsKICBhZGRFdmVudExpc3RlbmVyKCJwb2ludGVyZG93biIsIGRvd24pOyBhZGRFdmVudExpc3RlbmVyKCJwb2ludGVydXAiLCB1cCk7CiAgYWRkRXZlbnRMaXN0ZW5lcigicG9pbnRlcmNhbmNlbCIsIHVwKTsKICBhZGRFdmVudExpc3RlbmVyKCJrZXlkb3duIiwgZnVuY3Rpb24gKGUpIHsgaWYgKCFlLnJlcGVhdCkgZG93bigpOyB9KTsKICBhZGRFdmVudExpc3RlbmVyKCJrZXl1cCIsIHVwKTsKCiAgLyogLS0tLSBXRUIgTUlESSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovCiAgdmFyIG1pZGlFbCA9IGVsKCJtaWRpIik7CiAgdmFyIE5BTUVTID0gWyJDIiwiQyMiLCJEIiwiRCMiLCJFIiwiRiIsIkYjIiwiRyIsIkcjIiwiQSIsIkEjIiwiQiJdOwogIHZhciBtaWRpT24gPSBmYWxzZTsKCiAgZnVuY3Rpb24gb25NSURJKGV2KSB7CiAgICB2YXIgc3QgPSBldi5kYXRhWzBdLCBkMSA9IGV2LmRhdGFbMV0sIGQyID0gZXYuZGF0YVsyXSwga2luZCA9IHN0ICYgMHhmMDsKICAgIGlmIChraW5kID09PSAweDkwICYmIGQyID4gMCkgeyAgICAgICAgICAgICAgICAgICAgLyogbm90ZS1vbiA9IEEgTk9URSBDSEFOR0UgKi8KICAgICAgbGFzdE5vdGVOYW1lID0gTkFNRVNbZDEgJSAxMl0gKyAoTWF0aC5mbG9vcihkMSAvIDEyKSAtIDEpOwogICAgICBub3RlQ2hhbmdlKCk7CiAgICB9IGVsc2UgaWYgKGtpbmQgPT09IDB4YjAgJiYgZDEgPT09IDIpIHsgICAgICAgICAgIC8qIENDMiBicmVhdGggPSBUSEUgU1VQUExZICovCiAgICAgIGJyZWF0aCA9IGQyIC8gMTI3OwogICAgfSBlbHNlIGlmIChraW5kID09PSAweGIwICYmIChkMSA9PT0gMTIzIHx8IGQxID09PSAxMjApKSB7CiAgICAgIGJyZWF0aCA9IDA7CiAgICB9CiAgfQoKICBpZiAoIW5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2VzcykgewogICAgbWlkaUVsLmlubmVySFRNTCA9ICc8c3BhbiBjbGFzcz0ibm8iPm5vIFdlYiBNSURJPC9zcGFuPjxicj4nICsKICAgICAgKGxvY2F0aW9uLnByb3RvY29sID09PSAiZmlsZToiCiAgICAgICAgPyAnb3BlbmVkIGFzIGZpbGU6Ly8gJm1kYXNoOyBNSURJIGlzIGJsb2NrZWQgaGVyZS48YnI+cnVuIDxiPm5vZGUgdG9vbHMvc2VydmUubWpzPC9iPjxicj5hbmQgb3BlbiBvbiBsb2NhbGhvc3QnCiAgICAgICAgOiAndGhpcyBicm93c2VyIGRvZXMgbm90IGV4cG9zZSBpdCcpOwogIH0gZWxzZSB7CiAgICBuYXZpZ2F0b3IucmVxdWVzdE1JRElBY2Nlc3MoKS50aGVuKGZ1bmN0aW9uIChhY2Nlc3MpIHsKICAgICAgdmFyIHdpcmUgPSBmdW5jdGlvbiAoKSB7CiAgICAgICAgdmFyIGlucyA9IFtdOwogICAgICAgIGFjY2Vzcy5pbnB1dHMuZm9yRWFjaChmdW5jdGlvbiAoaSkgeyBpLm9ubWlkaW1lc3NhZ2UgPSBvbk1JREk7IGlucy5wdXNoKGkubmFtZSk7IH0pOwogICAgICAgIG1pZGlPbiA9IGlucy5sZW5ndGggPiAwOwogICAgICAgIG1pZGlFbC5pbm5lckhUTUwgPSBtaWRpT24KICAgICAgICAgID8gJzxzcGFuIGNsYXNzPSJvayI+TUlESSAmbWlkZG90OyAnICsgaW5zLmxlbmd0aCArICcgaW5wdXQnICsgKGlucy5sZW5ndGggPiAxID8gInMiIDogIiIpICsgJzwvc3Bhbj48YnI+JyArIGlucy5qb2luKCI8YnI+IikKICAgICAgICAgIDogJzxzcGFuIGNsYXNzPSJubyI+TUlESSBncmFudGVkICZtaWRkb3Q7IG5vIGlucHV0czwvc3Bhbj48YnI+aXMgdGhlIEVXSSBjb25uZWN0ZWQ/JzsKICAgICAgfTsKICAgICAgd2lyZSgpOwogICAgICBhY2Nlc3Mub25zdGF0ZWNoYW5nZSA9IHdpcmU7CiAgICB9KVsiY2F0Y2giXShmdW5jdGlvbiAoZSkgewogICAgICBtaWRpRWwuaW5uZXJIVE1MID0gJzxzcGFuIGNsYXNzPSJubyI+TUlESSByZWZ1c2VkPC9zcGFuPjxicj4nICsgZS5tZXNzYWdlOwogICAgfSk7CiAgfQoKICAvKiAtLS0tIEZSQU1FIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi8KICBmdW5jdGlvbiBmcmFtZShub3cpIHsKICAgIHZhciBkdCA9IE1hdGgubWluKDEgLyAzMCwgKG5vdyAtIGxhc3QpIC8gMTAwMCk7IGxhc3QgPSBub3c7CgogICAgLyogVEhFIFNVUFBMWSBpcyBicmVhdGgg4oCUIENDMiBmcm9tIHRoZSBFV0ksIG9yIGEgaGVsZCBwb2ludGVyIHN0YW5kaW5nIGluIGZvcgogICAgICAgaXQuIE9ubHkgdGhlIGhlYWQgaXMgZmVkLiBFdmVyeSBvdGhlciBzZWdtZW50IG1vdmVzIGJlY2F1c2Ugb2YgdGhlIG9uZQogICAgICAgYmVmb3JlIGl0LCBhbmQgZm9yIG5vIG90aGVyIHJlYXNvbi4gKi8KICAgIHZhciBzdXBwbHkgPSBtaWRpT24gPyBicmVhdGggOiAoaGVsZCA/IDEgOiAwKTsKICAgIGlmIChzdXBwbHkgPiAwKSBSTC5maWxsKHIsIDEuNiAqIHN1cHBseSAqIGR0KTsKICAgIFBNLnVwZGF0ZShkdCk7CgogICAgdmFyIGZpcmVkID0gUkwuc3RlcChyLCBkdCksIGk7CiAgICBmb3IgKGkgPSAwOyBpIDwgZmlyZWQubGVuZ3RoOyBpKyspIGZsYXNoW2ZpcmVkW2ldXSA9IDE7CiAgICBmb3IgKGkgPSAwOyBpIDwgci5uOyBpKyspIGZsYXNoW2ldICo9IE1hdGguZXhwKC1kdCAvIDAuMTgpOwoKICAgIHZhciBXID0gaW5uZXJXaWR0aCwgSCA9IGlubmVySGVpZ2h0OwogICAgZy5maWxsU3R5bGUgPSAiIzA3MDgwYSI7IGcuZmlsbFJlY3QoMCwgMCwgVywgSCk7CgogICAgdmFyIG4gPSByLm4sIHgwID0gVyAqIDAuMTQsIHgxID0gVyAqIDAuODYsIHkgPSBIICogMC41MjsKICAgIHZhciBzdGVwID0gKHgxIC0geDApIC8gKG4gLSAxKSwgcmFkID0gTWF0aC5taW4oMzQsIHN0ZXAgKiAwLjQyKTsKCiAgICBnLnN0cm9rZVN0eWxlID0gIiMxYjFmMjYiOyBnLmxpbmVXaWR0aCA9IDI7IGcuYmVnaW5QYXRoKCk7CiAgICBmb3IgKGkgPSAwOyBpIDwgbjsgaSsrKSB7CiAgICAgIHZhciB4eCA9IHgwICsgaSAqIHN0ZXAsIHliID0geSAtIFJMLnBvc2UociwgaSkgKiBIICogMC4xMzsKICAgICAgaWYgKGkpIGcubGluZVRvKHh4LCB5Yik7IGVsc2UgZy5tb3ZlVG8oeHgsIHliKTsKICAgIH0KICAgIGcuc3Ryb2tlKCk7CgogICAgZm9yIChpID0gMDsgaSA8IG47IGkrKykgewogICAgICB2YXIgcCA9IFJMLnBvc2UociwgaSksIGNoID0gUkwuY2hhcmdlKHIsIGkpOwogICAgICB2YXIgeCA9IHgwICsgaSAqIHN0ZXAsIHl5ID0geSAtIHAgKiBIICogMC4xMzsKCiAgICAgIGcuYmVnaW5QYXRoKCk7IGcuYXJjKHgsIHl5LCByYWQgKiAoMC41NSArIDAuNSAqIGNoKSwgMCwgNi4yODMyKTsKICAgICAgZy5zdHJva2VTdHlsZSA9ICJyZ2JhKDEyMCwxMzIsMTQ4LCIgKyAoMC4xOCArIDAuNSAqIGNoKSArICIpIjsKICAgICAgZy5saW5lV2lkdGggPSAxLjU7IGcuc3Ryb2tlKCk7CgogICAgICB2YXIgYSA9IDAuMTAgKyAwLjg1ICogcCwgZiA9IGZsYXNoW2ldOwogICAgICBnLmJlZ2luUGF0aCgpOyBnLmFyYyh4LCB5eSwgcmFkICogKDAuNDIgKyAwLjQyICogcCksIDAsIDYuMjgzMik7CiAgICAgIGcuZmlsbFN0eWxlID0gInJnYmEoIiArICgxOTAgKyA0NSAqIGYpICsgIiwiICsgKDEyOCArIDYwICogZikgKyAiLCIgKyAoMTA0ICsgNzAgKiBmKSArICIsIiArIGEgKyAiKSI7CiAgICAgIGcuZmlsbCgpOwoKICAgICAgZy5maWxsU3R5bGUgPSAicmdiYSgxMzgsMTQzLDE1MiwwLjU1KSI7CiAgICAgIGcuZm9udCA9ICIxMXB4IHVpLW1vbm9zcGFjZSxtb25vc3BhY2UiOwogICAgICBnLmZpbGxUZXh0KFN0cmluZyhpKSwgeCAtIDMsIHkgKyBIICogMC4xMCk7CiAgICB9CgogICAgZy5maWxsU3R5bGUgPSAicmdiYSgxMjAsMTMyLDE0OCwwLjQ1KSI7CiAgICBnLmZpbGxUZXh0KCJicmVhdGggICIgKyBsYXN0Tm90ZU5hbWUsIHgwIC0gNjIsIHkgKyBIICogMC4xNDUpOwogICAgZy5maWxsU3R5bGUgPSAicmdiYSgyMDEsMTM4LDEwNiwwLjg1KSI7CiAgICBnLmZpbGxSZWN0KHgwIC0gNjIsIHkgKyBIICogMC4xNTUsIDk2ICogc3VwcGx5LCA0KTsKCiAgICBlbCgiaGQiKS50ZXh0Q29udGVudCA9IHIuaGVhZDsKICAgIGVsKCJmbCIpLnRleHRDb250ZW50ID0gUkwuaW5mbGlnaHQocik7CiAgICBlbCgiaXYiKS50ZXh0Q29udGVudCA9IHIuaW50ZXJ2YWwudG9GaXhlZCgyKTsKICAgIGVsKCJsdiIpLnRleHRDb250ZW50ID0gci5iYXNlLnRvRml4ZWQoMyk7CiAgICBlbCgidHIiKS50ZXh0Q29udGVudCA9IFJMLnRyYW5zaXQocikudG9GaXhlZCgyKTsKICAgIGVsKCJwbSIpLnRleHRDb250ZW50ID0gInBlcmlvZCAiICsgUE0ucGVyaW9kLnRvRml4ZWQoMikgKyAicyBcdTAwYjcgY29uZiAiICsKICAgICAgICAgICAgICAgICAgICAgICAgICAgUE0uY29uZmlkZW5jZS50b0ZpeGVkKDIpICsgIiBcdTAwYjcgZmxvdyAiICsgUE0uZmxvdy50b0ZpeGVkKDIpOwogICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTsKICB9CiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTsKfSkoKTsKPC9zY3JpcHQ+Cg==" },
  { path: 'tools/serve.mjs', bytes: 3057, sha: '0445e7cbd80575fd', b64: "IyEvdXNyL2Jpbi9lbnYgbm9kZQovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICB0b29scy9zZXJ2ZS5tanMg4oCUIEEgVFJVU1RFRCBPUklHSU4sIE9OIERFTUFORAogICBydW46ICBub2RlIHRvb2xzXHNlcnZlLm1qcyAgICAgICAgICB0aGVuIG9wZW4gdGhlIFVSTCBpdCBwcmludHMKICAgICAgICAgbm9kZSB0b29sc1xzZXJ2ZS5tanMgODA4MSAgICAgaWYgODA4MCBpcyB0YWtlbgoKICAgV0hZIFRISVMgRVhJU1RTOiBXZWIgTUlESSBpcyBvbmx5IGdyYW50ZWQgb24gYSBTRUNVUkUgQ09OVEVYVC4gYGZpbGU6Ly9gIGlzCiAgIG5vdCBvbmUsIHNvIGEgcGFnZSBvcGVuZWQgYnkgZG91YmxlLWNsaWNraW5nIGNhbiBuZXZlciBzZWUgdGhlIEVXSSDigJQgaXQgZmFpbHMKICAgc2lsZW50bHksIHdpdGggbm8gcGVybWlzc2lvbiBwcm9tcHQgYXQgYWxsLiBgaHR0cDovL2xvY2FsaG9zdGAgSVMgYSBzZWN1cmUKICAgY29udGV4dCBieSBkZWZpbml0aW9uLCBzbyBzZXJ2aW5nIHRoZSByZXBvIGxvY2FsbHkgaXMgdGhlIHdob2xlIGZpeC4KCiAgIFRoZSBzYW1lIHRyYXAgd2FzIG1ldCBmcm9tIHRoZSBvdGhlciBzaWRlIG9uY2UgYWxyZWFkeTogR2l0SHViIFBhZ2VzIHdhcwogICBhZG9wdGVkIGZvciB0aGUgQmVlIHBhcnRseSBiZWNhdXNlIEhUVFBTIGdhdmUgTUlESSBwZXJtaXNzaW9uIHNvbWV3aGVyZSB0bwogICBsYW5kLiBUaGlzIGlzIHRoZSBsb2NhbCB2ZXJzaW9uIG9mIHRoYXQsIHdpdGggbm8gcHVzaCByZXF1aXJlZC4KCiAgIE5vIGRlcGVuZGVuY2llcywgbm8gaW5zdGFsbCwgbm90aGluZyB0byBrZWVwIHJ1bm5pbmcgYmV0d2VlbiBzZXNzaW9ucy4KICAgU2VydmVzIHRoZSByZXBvIHJlYWQtb25seS4gQ3RybCtDIGVuZHMgaXQuCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmltcG9ydCB7IGNyZWF0ZVNlcnZlciB9IGZyb20gIm5vZGU6aHR0cCI7CmltcG9ydCB7IHJlYWRGaWxlLCBzdGF0IH0gZnJvbSAibm9kZTpmcy9wcm9taXNlcyI7CmltcG9ydCBwYXRoIGZyb20gIm5vZGU6cGF0aCI7CmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICJub2RlOnVybCI7Cgpjb25zdCBST09UID0gcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpLCAiLi4iKTsKY29uc3QgUE9SVCA9IE51bWJlcihwcm9jZXNzLmFyZ3ZbMl0pIHx8IDgwODA7Cgpjb25zdCBUWVBFUyA9IHsKICAiLmh0bWwiOiAidGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04IiwKICAiLmpzIjogICAidGV4dC9qYXZhc2NyaXB0OyBjaGFyc2V0PXV0Zi04IiwKICAiLm1qcyI6ICAidGV4dC9qYXZhc2NyaXB0OyBjaGFyc2V0PXV0Zi04IiwKICAiLmNzcyI6ICAidGV4dC9jc3M7IGNoYXJzZXQ9dXRmLTgiLAogICIuanNvbiI6ICJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04IiwKICAiLm1pZCI6ICAiYXVkaW8vbWlkaSIsCiAgIi5wbmciOiAgImltYWdlL3BuZyIsCiAgIi5zdmciOiAgImltYWdlL3N2Zyt4bWwiLAogICIubWQiOiAgICJ0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04Igp9OwoKY29uc3Qgc2VydmVyID0gY3JlYXRlU2VydmVyKGFzeW5jIChyZXEsIHJlcykgPT4gewogIHRyeSB7CiAgICBjb25zdCB1cmwgPSBkZWNvZGVVUklDb21wb25lbnQoKHJlcS51cmwgfHwgIi8iKS5zcGxpdCgiPyIpWzBdKTsKICAgIC8qIHJlc29sdmUsIHRoZW4gY29uZmlybSB0aGUgcmVzdWx0IGlzIHN0aWxsIElOU0lERSB0aGUgcmVwbyDigJQgYSByZXF1ZXN0IGZvcgogICAgICAgLy4uLy4uL2V0Yy9wYXNzd2QgcmVzb2x2ZXMgb3V0IG9mIGl0LCBhbmQgdGhpcyBpcyB3aGF0IHN0b3BzIHRoYXQgKi8KICAgIGxldCBmaWxlID0gcGF0aC5yZXNvbHZlKFJPT1QsICIuIiArIHVybCk7CiAgICBpZiAoIWZpbGUuc3RhcnRzV2l0aChST09UKSkgeyByZXMud3JpdGVIZWFkKDQwMykuZW5kKCJvdXRzaWRlIHRoZSByZXBvIik7IHJldHVybjsgfQoKICAgIGNvbnN0IHMgPSBhd2FpdCBzdGF0KGZpbGUpLmNhdGNoKCgpID0+IG51bGwpOwogICAgaWYgKHMgJiYgcy5pc0RpcmVjdG9yeSgpKSBmaWxlID0gcGF0aC5qb2luKGZpbGUsICJpbmRleC5odG1sIik7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRGaWxlKGZpbGUpOwogICAgcmVzLndyaXRlSGVhZCgyMDAsIHsKICAgICAgImNvbnRlbnQtdHlwZSI6IFRZUEVTW3BhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpXSB8fCAiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtIiwKICAgICAgImNhY2hlLWNvbnRyb2wiOiAibm8tc3RvcmUiICAgICAgICAgIC8qIHNvIGEgcmUtcnVuIG9mIHRoZSBpbnN0YWxsZXIgaXMgc2VlbiBvbiByZWxvYWQgKi8KICAgIH0pOwogICAgcmVzLmVuZChib2R5KTsKICB9IGNhdGNoIHsKICAgIHJlcy53cml0ZUhlYWQoNDA0LCB7ICJjb250ZW50LXR5cGUiOiAidGV4dC9wbGFpbiIgfSkuZW5kKCJub3QgZm91bmQiKTsKICB9Cn0pOwoKc2VydmVyLmxpc3RlbihQT1JULCAiMTI3LjAuMC4xIiwgKCkgPT4gewogIGNvbnNvbGUubG9nKCJcbiAgWklHVkVSU0Ug4oCUIHNlcnZpbmcgIiArIFJPT1QpOwogIGNvbnNvbGUubG9nKCIgIGEgdHJ1c3RlZCBvcmlnaW4sIHNvIFdlYiBNSURJIGNhbiBiZSBncmFudGVkXG4iKTsKICBjb25zb2xlLmxvZygiICAgIGh0dHA6Ly9sb2NhbGhvc3Q6IiArIFBPUlQgKyAiL3Rvb2xzL3JlbGF5X3Njb3BlLmh0bWxcbiIpOwogIGNvbnNvbGUubG9nKCIgIEN0cmwrQyB0byBzdG9wLlxuIik7Cn0pOwpzZXJ2ZXIub24oImVycm9yIiwgKGUpID0+IHsKICBpZiAoZS5jb2RlID09PSAiRUFERFJJTlVTRSIpIGNvbnNvbGUubG9nKCJcbiAgUG9ydCAiICsgUE9SVCArICIgaXMgYnVzeS4gVHJ5OiAgbm9kZSB0b29sc1xcc2VydmUubWpzIDgwODFcbiIpOwogIGVsc2UgY29uc29sZS5sb2coIlxuICAiICsgZS5tZXNzYWdlICsgIlxuIik7CiAgcHJvY2Vzcy5leGl0KDEpOwp9KTsK" },
];

let bad = 0;
if (!only) {
  console.log("\n  ZIGVERSE - installing THE EWI SCOPE\n  root: " + ROOT + "\n");
  for (const p of PAYLOAD) {
    const dst = path.join(ROOT, p.path);
    const want = Buffer.from(p.b64, "base64");
    const had = existsSync(dst) ? readFileSync(dst) : null;
    if (had && had.equals(want)) {
      console.log("  UNCHANGED  " + p.path.padEnd(26) + p.bytes + " bytes");
      continue;
    }
    writeFileSync(dst, want);
    const back = readFileSync(dst);
    const okBytes = back.length === p.bytes, okSha = sha(back) === p.sha;
    if (okBytes && okSha) {
      console.log("  WROTE      " + p.path.padEnd(26) + p.bytes + " bytes · sha " + p.sha + " OK");
    } else {
      bad++;
      console.log("  MISMATCH   " + p.path.padEnd(26) + "wrote " + back.length + "/" + p.bytes +
                  " bytes · sha " + sha(back) + " vs " + p.sha);
    }
  }
  if (bad) {
    console.log("\n  " + bad + " FILE(S) DID NOT VERIFY — stop here and send this output to Glyph.");
    console.log("  Do not run the gate on a partial install.\n");
    process.exit(1);
  }
  console.log("\n  all files verified.\n");
}

if (!gates) {
  console.log("  next:  node tools\\apply_ewi_scope.mjs --gates-only\n");
  process.exit(0);
}

/* ---------------------------------------------------------------- THE GATE */
console.log("  REFERENCE GATE\n");
let syn = 0;
for (const f of ["engine/zigcore.js", "engine/zigwebgpu.js", "engine/zigmesh.js", "engine/zigmidi.js"]) {
  try { execFileSync(process.execPath, ["--check", path.join(ROOT, f)]); }
  catch (e) { syn++; console.log("  node --check FAILED: " + f); }
}
console.log("  node --check  " + (syn ? syn + " FAILED" : "clean (4 files)"));

const dir = path.join(ROOT, "test");
const tests = readdirSync(dir).filter((f) => f.endsWith("_ref.mjs")).sort();
let pass = 0; const failed = [];
for (const t of tests) {
  try { execFileSync(process.execPath, [path.join(dir, t)], { stdio: "pipe" }); pass++; }
  catch (e) {
    failed.push(t);
    console.log("  FAIL  " + t);
    const out = ((e.stdout || "") + (e.stderr || "")).toString().trim().split("\n").slice(-4);
    out.forEach((l) => console.log("        " + l));
  }
}
console.log("\n  REFERENCE GATE: " + pass + "/" + tests.length + " PASS");
if (syn || failed.length) {
  console.log("  STOP — send this output to Glyph before landing anything.\n");
  process.exit(1);
}
console.log("  vertebra_ref is included and passing.\n");
console.log("  now start the server (MIDI needs it):");
console.log("     node tools\\serve.mjs\n");
