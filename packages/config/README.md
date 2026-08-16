# @finora/config

Shared TypeScript configuration for the Finora workspace.

This package has no runnable scripts, dev server, or build output. Applications and libraries
consume its configuration through workspace dependencies. Validate the consuming packages with
the root commands:

```bash
pnpm check
pnpm check-types
```

`pnpm check` runs the repository linter and formatter, while `pnpm check-types` runs only packages
that define a `check-types` script.
