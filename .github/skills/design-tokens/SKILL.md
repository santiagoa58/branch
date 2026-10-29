---
name: design-tokens
description: "Design system tokens and patterns for Branch. Use when building or modifying UI components, pages, dialogs, or any visual element to ensure consistent styling across the app."
---

# Branch Design Tokens

Reference this skill when creating or modifying any UI component to ensure visual consistency with the established design system.

## Color Palette (Zinc-based Monochrome)

The app uses Tailwind's **zinc** scale exclusively. No blue/green/red for structural UI — color accents are reserved for semantic states only.

### CSS Custom Properties (defined in `src/index.css`)

| Token                | Dark (default) | Light     |
| -------------------- | -------------- | --------- |
| `--bg-primary`       | `#09090b`      | `#ffffff` |
| `--bg-secondary`     | `#18181b`      | `#f4f4f5` |
| `--bg-tertiary`      | `#27272a`      | `#e4e4e7` |
| `--border-primary`   | `#27272a`      | `#d4d4d8` |
| `--border-secondary` | `#3f3f46`      | `#a1a1aa` |
| `--text-primary`     | `#fafafa`      | `#18181b` |
| `--text-secondary`   | `#a1a1aa`      | `#52525b` |
| `--text-tertiary`    | `#71717a`      | `#71717a` |

## Typography

- **Font family**: Inter (`--font-sans: 'Inter', system-ui, sans-serif`)
- **Body text**: `text-sm` (14px)
- **Small text / labels**: `text-xs` (12px)
- **Section headings**: `text-sm font-medium text-zinc-500`
- **Logo / brand**: `font-semibold tracking-tight text-zinc-900 dark:text-zinc-100`
- **Button labels**: `text-xs font-medium` (secondary) or `text-xs font-semibold` (primary)

## Spacing & Layout

- **Page header height**: `h-14` (56px)
- **Header padding**: `px-4`
- **Header layout**: `flex items-center justify-between`
- **Header background**: `bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md`
- **Header border**: `border-b border-zinc-200 dark:border-zinc-800`
- **Button groups gap**: `gap-1` (inside group), `gap-3` or `gap-4` (between groups)
- **Content padding**: `p-8` for page bodies
- **Card gap / grid gap**: `gap-4`

## Icon Sizing

- **Standard icons**: `w-3.5 h-3.5` (14px)
- **Logo icon**: `w-4.5 h-4.5` (18px) with `strokeWidth={2}`
- **Icon library**: `@heroicons/react/24/outline`

## Border Radius

| Element          | Class        |
| ---------------- | ------------ |
| Buttons / inputs | `rounded-md` |
| Cards / dialogs  | `rounded-lg` |
| Logo button      | `rounded-lg` |
| Dropdown items   | `rounded-md` |
| Dropdown menus   | `rounded-lg` |

## Button Variants

### Primary (high emphasis — Export, Create)

```
bg-zinc-900 dark:bg-zinc-100
hover:bg-zinc-800 dark:hover:bg-zinc-200
text-zinc-100 dark:text-zinc-900
text-xs font-semibold
px-3 py-1.5 rounded-md
shadow-sm
```

### Secondary (medium emphasis — Layout, toolbar actions)

```
bg-zinc-100 dark:bg-zinc-900
hover:bg-zinc-200 dark:hover:bg-zinc-800
border border-zinc-200 dark:border-zinc-800
text-zinc-700 dark:text-zinc-300
text-xs font-medium
px-3 py-1.5 rounded-md
```

### Ghost (low emphasis — icon-only buttons, toggles)

```
p-1.5 rounded
hover:bg-zinc-200 dark:hover:bg-zinc-800
text-zinc-600 dark:text-zinc-400
hover:text-zinc-900 dark:hover:text-zinc-100
transition-colors
```

### Active toggle state (ghost button pressed)

```
text-zinc-900 dark:text-zinc-100
bg-zinc-200 dark:bg-zinc-800
```

### Disabled

```
disabled:opacity-30 disabled:cursor-not-allowed
```

### Cancel / secondary dialog button

```
bg-zinc-100 dark:bg-zinc-800
hover:bg-zinc-200 dark:hover:bg-zinc-700
text-zinc-700 dark:text-zinc-300
px-4 py-2 rounded-md text-sm font-medium
```

## Button Groups (pill containers)

Wrap related icon buttons in a bordered container:

```
bg-zinc-100 dark:bg-zinc-900
border border-zinc-200 dark:border-zinc-800
rounded-md p-1 gap-1
```

## Form Inputs

```
w-full px-3 py-2 rounded-md text-sm
bg-white dark:bg-zinc-900
border border-zinc-300 dark:border-zinc-700
text-zinc-900 dark:text-zinc-100
focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500
placeholder:text-zinc-400
```

## Dialogs / Modals

- **Backdrop**: `bg-black/60 backdrop-blur-sm`
- **Container**: `bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl`
- **Max width**: `max-w-md` for creation dialogs
- **Padding**: `p-6` for body
- **Header**: `text-lg font-semibold text-zinc-900 dark:text-zinc-100`
- **Close button**: ghost button with `XMarkIcon w-5 h-5`

## Dropdown Menus

```
bg-white dark:bg-zinc-900
border border-zinc-200 dark:border-zinc-800
rounded-lg shadow-xl
animate-slide-in
```

**Dropdown items:**

```
w-full text-left px-3 py-2 text-xs
text-zinc-700 dark:text-zinc-300
hover:bg-zinc-100 dark:hover:bg-zinc-800
hover:text-zinc-900 dark:hover:text-white
rounded-md flex items-center gap-2
```

## Navigation / Breadcrumbs

The app uses a breadcrumb pattern in the header:

```
Branch > Project Name > Diagram Name
```

- **Logo button**: `h-8 w-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg` with CubeIcon
- **Separator**: `ChevronRightIcon w-3 h-3 text-zinc-400`
- **Clickable crumbs**: `text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-[120px]`
- **Current (non-clickable)**: `text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]`

## Theme Toggle

Cycle through light → dark → system with a single button showing the current mode icon:

- Light: `SunIcon`
- Dark: `MoonIcon`
- System: `ComputerDesktopIcon`

Use the ghost button variant.

## Cards (project/diagram cards)

```
bg-white dark:bg-zinc-900
border border-zinc-200 dark:border-zinc-800
rounded-lg
hover:border-zinc-300 dark:hover:border-zinc-700
hover:shadow-md
transition-all cursor-pointer
p-4 or p-5
```

## Transitions

- Default: `transition-colors`
- Cards: `transition-all` (for shadow + border)
- Logo hover: `hover:opacity-80 transition-opacity`
- Animations: `animate-slide-in` (slideInRight 0.3s ease-out)

## Empty States

```
text-center py-16
Icon: w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4
Title: text-sm font-medium text-zinc-500
Description: text-xs text-zinc-400 mt-1
```

## Color Accents (semantic only)

Colors outside the zinc palette should only appear for semantic meaning:

- **Healthy / success**: green
- **Error / unhealthy**: red
- **Warning**: amber/yellow
- **Link hover (breadcrumbs only)**: blue-600 / blue-400

Never use colored backgrounds for structural UI elements (buttons, headers, panels).
