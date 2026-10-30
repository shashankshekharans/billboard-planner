# Templates

[`sites-template.xlsx`](sites-template.xlsx): a blank vendor sheet for Billboard Planner. Fill the **Sites** sheet (one row per billboard), optionally the **Plan** and **Groups** sheets, then build it:

```bash
npx billboard-planner build sites.xlsx
```

The **Read me** sheet inside explains each column. Regenerate the file with `node packages/cli/scripts/make-template.mjs`.
