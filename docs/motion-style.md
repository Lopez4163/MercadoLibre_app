# UI Motion and Interaction Standards

Last updated: March 15, 2026

## Framer Motion Usage Map
1. Dashboard mount and section reveal
   - `components/dashboard/DashboardWorkspace.tsx`
   - `motion.main` + staggered `motion.section` fade-up.

2. Dashboard tab switching
   - `components/dashboard/DashboardWorkspace.tsx`
   - keyed tab container + `AnimatePresence`.

3. Dismissible Telegram-required notices
   - `components/dashboard/DashboardWorkspace.tsx`
   - `AnimatePresence` + enter/exit fade with slight Y movement.

4. Layout reflow smoothing
   - `components/dashboard/DashboardWorkspace.tsx`
   - `layout` transitions on wrappers/siblings to prevent jumpy vertical reflow.

5. Telegram connected success banner
   - `components/dashboard/DashboardWorkspace.tsx`
   - temporary green banner with animated in/out.

6. Orders Telegram status chip transition (`failed -> sent`)
   - `components/dashboard/DashboardWorkspace.tsx`
   - keyed `AnimatePresence` around status chip.

7. Settings content route transitions
   - `components/layout/SettingsContentTransition.tsx`
   - `src/app/(dashboard)/settings/layout.tsx`
   - pathname-keyed fade/slide transition.

8. Settings loading state
   - `src/app/(dashboard)/settings/loading.tsx`
   - motion fade-in + rotating spinner + skeleton card structure.

## Interaction Styling Standards (Non-Framer)
1. Use `transition-all`/`transition-colors` for buttons and tabs.
2. Use explicit hover feedback (border + background shift).
3. Use press feedback: `active:translate-y-px` and slight scale where suitable.
4. Use `cursor-pointer` on clickable tabs/actions.

## Easing and Timing
1. Primary curve: `[0.22, 1, 0.36, 1]`.
2. Short state transitions: ~`0.22s` to `0.32s`.
3. Avoid long delays that make actionable cards feel blocked.
