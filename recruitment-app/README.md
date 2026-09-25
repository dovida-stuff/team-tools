# Recruitment Operations

The Power Platform replacement for the talent acquisition Excel tracker.

| Path | What it is |
|---|---|
| `PROGRESS.md` | Progress record: done, decisions, open questions, next step. **Start here.** |
| `docs/01-assessment.md` | What the web prototype really does, what it only simulates, and its defects |
| `docs/02-power-platform-build-spec.md` | Proposed Dataverse, security, flow, Power Fx, migration and reporting design |
| `docs/03-step1-dataverse-setup.md` | Browser steps for the first build step |
| `docs/04-importable-solution.md` | How to import the solution zip, what's in it, and how it was checked |
| `solution/RecruitmentOperations_1_0_0_0.zip` | **Importable Dataverse solution** (tables, choices, keys, roles) |
| `solution/build.sh`, `build.py`, `verify.py`, `src/`, `template/` | How the zip is generated and checked, and its unpacked source |
| `seed-data/` | Synthetic configuration and test data exported from the prototype (CSV) |
| `tools/export-seed.mjs` | Regenerates `seed-data/` from the prototype source: `node tools/export-seed.mjs` |
| `prototype-source/` | The React prototype snapshot from the 25 Sep 2026 handover. Reference only, unchanged. |
| `START_HERE_Claude_Prompt.md`, `SOURCE_SHA256.txt` | The original handover brief and file checksums |

The solution zip contains structure only (no data). Production candidate
data stays in the Microsoft tenant. Everything in this folder is synthetic.
