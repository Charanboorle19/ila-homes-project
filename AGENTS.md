<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentation-First Development Rule

When I provide or reference a feature documentation file such as:

`/docs/features/map.md`

that documentation is the PRIMARY SOURCE OF TRUTH for the task.

### STRICT RULE

Before making any changes:

1. Read the specified `.md` file completely.
2. Understand the feature requirements, behavior, architecture, data flow, and constraints described in that document.
3. Use the document to determine which files are relevant.
4. Inspect ONLY those relevant files.
5. Make the required changes in those files.

### DO NOT SCAN THE ENTIRE PROJECT

If a feature documentation file is provided, DO NOT:

- Scan the entire repository.
- Read unrelated components.
- Read unrelated pages.
- Inspect unrelated services.
- Inspect unrelated API routes.
- Search the entire codebase unnecessarily.
- Review the entire project architecture.
- Open files simply to "understand the project better."

The documentation already contains the information needed for the feature.

Only expand the investigation beyond the documented files when there is a concrete technical dependency that prevents the task from being completed.

### FILE DISCOVERY

Use this order:

1. The `.md` file explicitly provided by me.
2. Files explicitly referenced by that `.md` file.
3. Direct dependencies of those files.
4. Additional files ONLY when technically necessary.

Do not go beyond this scope without a reason.

### IMPLEMENTATION

When the documentation says how a feature should work:

- Follow the documented behavior.
- Preserve the documented architecture.
- Preserve existing naming and terminology where possible.
- Make the smallest necessary changes.
- Do not redesign the feature.
- Do not introduce alternative implementations unless the documented implementation is impossible.

### IF INFORMATION IS MISSING

If the `.md` file does not contain enough information:

DO NOT immediately scan the entire project.

Instead:

1. Determine exactly what information is missing.
2. Inspect only the most likely directly related file.
3. Continue outward only if necessary.

If the required information still cannot be confirmed, state what is missing rather than making assumptions.

### IMPORTANT

The feature documentation is intentionally created so that you DO NOT need to understand the entire project before working on that feature.

Do not treat every task as a repository-wide investigation.

For example, if I say:

"Fix the Map layout image. Refer to `/docs/features/map.md`."

You should:

- Read `map.md`.
- Identify the Map/layout files from the documentation.
- Inspect those files.
- Find the issue.
- Modify the necessary files.
- Stop.

You should NOT inspect the entire repository first.

### SCOPE

Only change files directly required for the requested feature.

Do not modify unrelated files.

Do not perform unrelated refactoring.

Do not "clean up" unrelated code.

Do not update documentation unless explicitly requested.

Do not create additional files unless explicitly requested.

### TERMINAL

This rule works together with the terminal usage rules.

Do not use CMD/PowerShell/terminal to scan the repository when the documentation already identifies the relevant files.

Use terminal commands only when genuinely necessary.


