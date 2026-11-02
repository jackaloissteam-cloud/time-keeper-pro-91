<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep timesheet search matching and history ordering in the browser-safe `src/lib/timesheet-search.ts` module so their behavior can be tested independently of the page.
- Validate JSON backup files and merge only missing or empty months in `src/lib/timesheet-backup.ts` so restoration never silently overwrites populated local timesheets; backups include months, not search history, and do not change current rates.
