# GitHub Actions workflows

These belong in `.github/workflows/`. They are kept here because the access token used to push from the development laptop cannot change workflow files (it lacks the `workflow` scope).

To turn them on, either:

- on github.com: **Add file → Create new file**, name it `.github/workflows/pages.yml` (or `ci.yml`), paste the file from this folder and commit; or
- give the token the `workflow` scope (or sign in again with Git Credential Manager), then move the files into `.github/workflows/` and push.

| File | What it does |
|---|---|
| `pages.yml` | Builds the browser app and publishes it to GitHub Pages on every push to `main`. Also set **Settings → Pages → Source: GitHub Actions** once. |
| `ci.yml` | On every push and pull request: type-check, unit tests, builds, and the Playwright smoke tests (start screen → example, hover card without panning, row click, resize, open a spreadsheet, download). |
