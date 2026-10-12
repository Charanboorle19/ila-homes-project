<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Documentation-First Development Rules

1. **Read the relevant MD files first.** Before making changes, read the documentation under `/docs/features/` and `/docs/architecture/` that applies to the requested task. For multiple affected features, read each relevant MD file.

2. **Do not scan the entire repository.** Use the documentation to identify relevant files. Inspect only those files and their direct dependencies. Explore further only when technically necessary.

3. **Make minimal changes.** Follow the documented architecture, preserve existing behavior, and modify only files required for the task. Do not refactor unrelated code.

4. **Keep documentation synchronized.** Whenever a change affects a feature's behavior, API, routing, or data flow, update its relevant MD file. Update architecture documentation when applicable. Documentation must reflect the current implementation.

5. **Use terminal commands only when necessary.** Avoid unnecessary CMD/PowerShell commands, Git checks, builds, linting, tests, and package installations. Verify changes by reading the affected files whenever possible.

6. **Do not guess.** If documentation or implementation details are missing, inspect only the relevant dependencies. If something remains unclear, report `UNKNOWN — needs verification`.

7. **Finish and stop.** Make the smallest necessary change, update relevant documentation, briefly verify the affected files, and report what changed. Do not perform unrelated checks or modifications.



