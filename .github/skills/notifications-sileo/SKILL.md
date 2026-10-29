---
name: notifications-sileo
description: "Use Sileo as the single notification system in Branch. Apply when adding or changing user notifications in dialogs, navbar actions, or async workflows."
---

# Notifications With Sileo

Use this skill when implementing toast notifications.

## Standard

- Notification runtime is Sileo (`sileo`, `Toaster`).
- App-facing API is `src/services/notify.ts`.
- Do not reintroduce notification state in Zustand stores.

## Root Setup

- Mount one `Toaster` in `src/App.tsx`.
- Keep position `top-right` with offset matching app spacing.
- Keep zinc-aligned styling via Toaster options and CSS variables in `src/index.css`.

## Call-Site Usage

Use the notifier utility instead of direct library calls in feature components:

```ts
import { notify } from "@/services/notify";

notify.success({ title: "Saved", message: "Changes were persisted", duration: 3000 });
notify.error({ title: "Failed", message: "Please retry", duration: 5000 });
```

## Message Guidelines

- `success`: completed user actions (export/import/save)
- `warning`: recoverable issues requiring user attention
- `error`: failed operations
- `info`: contextual, low-severity feedback

## Migration Guardrails

- Remove old imports from `src/components/ui/Toast.tsx` (legacy removed).
- Do not add `addToast/removeToast/clearToasts` back to `src/store/uiStore.ts`.
- Preserve existing message copy and durations unless intentionally changed.

## Verification

1. Run `npm run type-check`.
2. Trigger notifications from navbar, import/export dialogs, and icon picker.
3. Validate light/dark appearance and overlap with navbar/panels.
