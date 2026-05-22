---
name: solid-ui
description: Use this skill whenever the user mentions Solid UI, solid-ui.com, solidui-cli, shadcn-style components for SolidJS, Kobalte/corvu/Tailwind UI components, or asks how to install, add, list, inspect, customize, or use reusable Solid UI components. This skill explains that Solid UI is copied into the app rather than installed as a runtime dependency, shows the CLI commands, and helps discover both available library components and components already present in the local project.
---

# Solid UI component workflow

Use this skill to help users work with [Solid UI](https://www.solid-ui.com/docs/introduction), an unofficial SolidJS port of shadcn/ui and tremor-raw. Solid UI components are built with Kobalte, corvu, and Tailwind CSS.

## Core mental model

Solid UI is **not a package-style component library** that the app imports from npm at runtime. It is a collection of reusable component source files that you copy into the project, usually with `solidui-cli`, then customize locally.

Explain this clearly because it changes the workflow:

- Do not add `solid-ui` as a normal app dependency.
- Use the CLI to copy component code into the project.
- Treat copied files as app-owned source code.
- Customize copied components directly, while preserving accessibility patterns from Kobalte/corvu.

## Before making changes

1. Confirm the project is a SolidJS/SolidStart app or a workspace package that contains Solid components.
2. Inspect for existing setup:
   - `ui.config.json`
   - `tailwind.config.*`
   - `src/components/ui/`, `components/ui/`, or the `componentDir` configured in `ui.config.json`
   - path aliases such as `~/*` or `@/*`
3. Prefer Bun commands in this project when executing package binaries, but keep official docs commands visible when explaining them:
   - Project-friendly: `bunx solidui-cli@latest ...`
   - Official docs: `npx solidui-cli@latest ...`

## Initialize Solid UI in a project

If the project has no `ui.config.json`, initialize first:

```bash
bunx solidui-cli@latest init
```

Official equivalent:

```bash
npx solidui-cli@latest init
```

The init command installs dependencies, adds the `cn` utility, configures Tailwind and CSS variables, and creates `ui.config.json`. If the project uses a custom directory layout, update `componentDir` in `ui.config.json` before adding many components.

## Add components

Add one or more components by name:

```bash
bunx solidui-cli@latest add button card dialog
```

Official equivalent:

```bash
npx solidui-cli@latest add button card dialog
```

Useful variants:

```bash
# Interactive picker; also useful for seeing available components
bunx solidui-cli@latest add

# Add every available component
bunx solidui-cli@latest add --all

# Replace an already-copied component
bunx solidui-cli@latest add button --overwrite
```

The `add` command copies component files into the configured component directory and installs component-specific dependencies.

## Find available components in the Solid UI library

Use these approaches, in order:

1. Run the interactive picker:
   ```bash
   bunx solidui-cli@latest add
   ```
   The picker displays available components and lets the user select components with Space, toggle all with `A`, and submit with Enter.
2. Check the Solid UI docs under `https://www.solid-ui.com/docs/components/<component-name>`.
3. If network access is available and a complete list is needed, inspect the docs source component pages in the Solid UI GitHub repo.

Known component pages include:

`accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge-delta`, `badge`, `bar-list`, `breadcrumb`, `button`, `callout`, `card`, `carousel`, `charts`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `data-table`, `date-picker`, `delta-bar`, `dialog`, `drawer`, `dropdown-menu`, `flex`, `grid`, `hover-card`, `label`, `menubar`, `navigation-menu`, `number-field`, `otp-field`, `pagination`, `popover`, `progress-circle`, `progress`, `radio-group`, `resizable`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `text-field`, `timeline`, `toast`, `toggle-group`, `toggle`, `tooltip`.

Component names occasionally change, so prefer the CLI picker or current docs for final confirmation.

## Find components already installed in the local project

To answer “what Solid UI components do we already have?”, inspect local source rather than the website:

1. Read `ui.config.json` and note `componentDir`.
2. List files in that directory, commonly:
   ```bash
   find src/components/ui components/ui -maxdepth 2 -type f 2>/dev/null | sort
   ```
3. Check imports in app code to see what is actively used:
   ```bash
   rg 'components/ui|~/components/ui|@/components/ui'
   ```
4. If a component exists locally, treat the local file as the source of truth because users are expected to customize copied components.

## Use components in Solid code

After adding a component, import it from the local component directory. Example with the default docs path:

```tsx
import { Button } from "~/components/ui/button";

export function Example() {
  return <Button variant="outline">Button</Button>;
}
```

For button-styled links, use the helper exported by the local button component:

```tsx
import { buttonVariants } from "~/components/ui/button";

<a class={buttonVariants({ variant: "outline" })}>Click here</a>;
```

Some components wrap Kobalte/corvu primitives and may expose Solid-specific composition props. Read the copied local component file and the matching docs page before changing APIs.

## Customization guidance

- Edit copied component files directly; the code belongs to the app after installation.
- Keep Tailwind class composition centralized with the generated `cn` helper.
- Preserve accessibility attributes and primitive structure unless there is a clear reason to change them.
- Match the project’s existing import alias and component directory rather than blindly using `~/components/ui`.
- When adding UI in this project, follow `DESIGN.md` if present and validate front-end changes with `npx agent-browser` after implementation.

## Troubleshooting

- If imports fail, check the project’s path alias and adjust imports to match `tsconfig.json`/SolidStart config.
- If styles are missing, verify Tailwind content paths include the component directory and CSS variables from init are loaded by the app.
- If a component name fails, run the interactive picker to confirm the current registry name.
- If re-adding a customized component, avoid `--overwrite` unless the user explicitly wants to replace local changes.
