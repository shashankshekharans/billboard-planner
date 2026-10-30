# GitHub Actions workflows

The active workflows are in [`.github/workflows/`](../../.github/workflows). They were added through github.com and are written in YAML's compact one-line form; these files are the same workflows laid out for reading and editing.

| Workflow | What it does |
|---|---|
| `pages.yml` | Builds the browser app and publishes it to GitHub Pages (https://shashankshekharans.github.io/billboard-planner/) on every push to `main`. Pages source: **GitHub Actions**. |
| `ci.yml` | On every push and pull request: type-check, unit tests, builds, and the Playwright smoke tests (start screen → example, hover card without panning, row click, resize, photo viewer, open a spreadsheet, download). |

To change a workflow, edit it here and in `.github/workflows/` (the copies must parse to the same YAML). Pushing changes to `.github/workflows/` from the command line needs a token with the `workflow` scope; the github.com editor works without it.
