# Paper Trail

Check AI-assisted copy against its sources, one claim at a time.

**Try it:** https://zeyadgenena.github.io/paper-trail/ (opens with a practice story loaded)

Paper Trail is a free, open-source prototype for newsroom editors. Paste an AI-assisted draft and the documents it was based on. Paper Trail splits the draft into claims and pairs each one with the source sentences that support it. It flags differences a reader would care about:

- absolutes the source doesn't use ("all", "unanimously")
- numbers, names and quotes that don't match the source
- careful words the draft drops ("eligible", "may", "up to", "about", "until", "said")

The editor marks each claim supported, fixes it, cuts it or opens a check with an owner. Export gives corrected copy (clean or with tracked changes), the open checks, a draft note for readers about AI use, and a claim-by-claim record.

Paper Trail never decides what is true. It shows where the copy and its sources differ, and it records what the editor decided.

## Run it

Open `index.html` in a browser. There is nothing to install and no server. Everything stays in the browser tab, and nothing you paste is uploaded.

Links that open straight into a state:

- `index.html#practice`: the practice story, ready to check
- `index.html#finished`: a finished review of the practice story
- `index.html#practice-setup`: the practice story on the setup screen

## Build

The page is assembled from `src/` by `sh build.sh`, which writes `index.html` (standalone) and `artifact.html` (a body-only copy for claude.ai).

- `src/03-engine.js`: sentence splitting, word-based matching and the difference flags
- `src/04-app-core.js` to `src/07-init.js`: the interface

## Limits

- Matching is word-based, so a heavy paraphrase can pair with the wrong passage. Pick the right one by hand.
- English only.
- Paste text or add a .txt file. PDF and Word import are planned.

## License

MIT. See `LICENSE`.
