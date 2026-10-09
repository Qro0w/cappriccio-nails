# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

---
## v4 update (existing site)
1. Supabase > SQL Editor > paste ALL of `supabase/06_upgrade_v4.sql` > Run (once; safe to re-run).
2. Replace the project's `src/` folder with the one from the zip (delete the old `src` first), copy `supabase/06_upgrade_v4.sql` in, push to GitHub. Vercel redeploys by itself. Env vars are unchanged.
3. Open /admin once and sign in (stays signed in). Photos tab: add tier photos. Settings: check GCash number/location. Schedule: turn December on when ready.
Fresh Supabase project instead? Run 01, 02, 03, then 06.
