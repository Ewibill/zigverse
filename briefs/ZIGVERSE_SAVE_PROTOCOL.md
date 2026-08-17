# Zigverse — Save & Access Protocol
### How work persists between sessions · v1.0 · supersedes the zip-in/zip-out ritual

---

## 0 · The problem being solved

Three things have gone wrong, repeatedly:

1. **Builds that die in the chat window.** `zigwebgpu 0.44.5` — the build the summit was
   performed on — was delivered through the file tool and never landed anywhere durable.
   It exists on eyeZ and nowhere else.
2. **Drive timestamps that lie.** Drive shows `0.44.3` modified Aug 13; the actual work was
   July 16. Those are *sync* events, not *version* events. Sorting Drive by modified time
   does not tell you what is newest — it tells you what synced most recently.
3. **Uploads that corrupt code.** `.js` and `.md` pushed through the Drive web interface get
   converted to Google Docs format: smart quotes, mangled whitespace, escaped characters.

All three have the same root cause: **the transport layer is also the archive.** It shouldn't be.

---

## 1 · The fix — git is the archive, Drive is the mailbox

| Channel | Carries | Truth? |
|---|---|---|
| **GitHub mirror** (public) | source, briefs, tests, tools, `CANON.md`, `ENGINE.md` | **Yes.** Version = commit sha. |
| **Google Drive** | delivered bundles, session captures, renders, docs for Scout | No. Convenience only. |
| **Chat / file tool** | in-flight artifacts | Never. Assume anything here is lost. |

The mirror matters for one concrete reason: **`github.com` and `raw.githubusercontent.com` are
on my sandbox's network allowlist.** With a public mirror I read your actual repo directly at
session start — correct version, correct encoding, no upload, no staleness, no ritual.

Nothing private goes in it. Code and briefs only.

---

## 2 · One-time setup on eyeZ

```powershell
cd C:\Users\billy\Zigverse

# Keep captures, renders, and node junk out of the public mirror
@'
node_modules/
captures/
renders/
*.mp4
*.wav
*.zip
'@ | Out-File -Encoding utf8 .gitignore

# dist/ IS tracked — judged builds must be recoverable
git add -A
git commit -m "pre-mirror snapshot"

# Create an EMPTY public repo named `zigverse` on github.com first, then:
git remote add origin https://github.com/<your-user>/zigverse.git
git branch -M main
git push -u origin main
```

Then tell me the URL once. Every session after that, I boot myself.

---

## 3 · Session start — what I do, unprompted

I fetch, in this order, from `raw.githubusercontent.com/<user>/zigverse/main/`:

1. `briefs/BOOT_GLYPH.md` — the bootloader
2. `ENGINE.md` — what the engine *is*
3. `CANON.md` — which laws exist, their versions, and their status
4. `briefs/Session_Log.md` — tail only, last 2 entries

Then I state the reconciliation in one paragraph: commit sha, engine versions, laws active,
open hazards. If the mirror is unreachable I say so plainly and ask for a zip — I never
silently build against guesswork.

---

## 4 · Session end — the close ritual

Non-negotiable, every substantive session:

1. Gate passes: `node --check` → `test/*_ref.mjs` all PASS → headless boot with numeric probes
2. Bundle to `dist/` with an incremented version — **never overwrite a judged build**
3. Append `briefs/Session_Log.md`
4. Update `CANON.md` if a law was added, changed, or promoted
5. `zig close -m "<one line>"` — commits and pushes
6. Deliver the bundle to Bill via the file tool **and** confirm it is committed in `dist/`

Step 6 is the one that failed with 0.44.5. A build that isn't in `dist/` on the mirror did not ship.

---

## 5 · Naming

| Thing | Pattern |
|---|---|
| Engine build | `Zigverse_Engine_<TRACK>_<feature>-<version>.html` |
| Signature build | `Signature_<Pose>_<law>-<version>.html` |
| Session capture | `session_<organism>_<yyyy-mm-dd>_<n>.json` |
| Render | `ZigGlow_<name>_4K_H265.mp4` |
| Law spec | `briefs/law_<name>.md` |

Judged builds get a git tag: `git tag build/0.45.0 && git push --tags`. A tag means *Bill has
seen this move.* Untagged builds are unjudged by definition.

---

## 6 · What this does not solve

**Performance data still doesn't return as data.** `ZigCore.Recorder` captures breath/bend/attack
with `toJSON()`, but nothing writes it out. Until `ZigCore.Session` exists — one JSON capsule on
stop containing Recorder track, lever state, build ID, fps profile, Climate/Temperament seed, and
a note field — tuning is done against guesses instead of against your actual breath.

Captures are gitignored on purpose: they belong on Drive, not in a public mirror. But the *format*
is a law-tier capability and belongs in the Canon ledger as a named gap.
