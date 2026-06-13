# Theorycrafting — agent skills

## Publish docs site changes (default completion step)

When the user asks to **create a new page**, **update a page**, or otherwise change content on this MkDocs site (`docs/`, `mkdocs.yml`, site assets), treat **live on GitHub Pages** as the required end state — not “files edited locally.”

Unless the user explicitly says otherwise (e.g. “don’t push”, “local only”, “draft PR”):

1. Finish the content change (markdown, assets, nav in `mkdocs.yml`, `docs/index.md` links, CSS/JS if needed).
2. **Commit** with a concise message matching repo style (`docs: …`).
3. **Push** to `origin/main` so GitHub Pages redeploys.
4. Tell the user the live URL (e.g. `https://serendipper.github.io/theorycrafting/…`).

Do not stop after editing files and wait for a separate “publish” or “commit” request. Completing the task includes shipping it.

**Scope:** `docs/**`, `mkdocs.yml`, checklist assets under `docs/assets/`, related styles/scripts for the site.

**Exclude from auto-push:** unrelated repos (e.g. `~/projects/wwhd-save`), experimental branches, or changes the user asked to keep uncommitted.
