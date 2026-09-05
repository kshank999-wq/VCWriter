# 0001 — Electron for the desktop application

**Status:** accepted, 5 September 2026
**Context:** spec §3.1 (Windows 10/11 and macOS with functional parity), §14
(one shared domain model, not a product-logic fork), §18 (the framework choice
must stay reversible).

## Decision

The desktop application is Electron with a React renderer, built by
electron-vite and packaged by electron-builder.

## Why

- **One language across every surface.** The domain model, its rules and its
  tests are TypeScript, and they run unmodified in the desktop main process,
  the desktop renderer, the Vercel app and later the mobile companion. A Rust
  or .NET shell would mean either a second implementation of the story rules or
  an awkward FFI boundary through the hottest path in the app.
- **Signing and notarisation are well-trodden.** electron-builder handles
  Windows Authenticode and Apple signing/notarisation with configuration rather
  than bespoke tooling, which is the difference between §3.3 being a
  configuration task and a project of its own.
- **Editor work is web work.** The screenplay editor, print preview and PDF
  export in Phase 3 are far cheaper against a DOM than against a native text
  stack.

## What it costs

- Installer size around 100–150 MB per platform, and a baseline memory
  footprint higher than a native or Tauri app.
- Startup time needs attention against §15's "fast startup and responsive
  typing even in long projects". The mitigation is in the model, not the
  framework: large projects must not load every rich object into the editor at
  once.

## Keeping it reversible

The framework touches only `apps/desktop`. Everything the product knows about
stories lives in `packages/domain`, and everything the desktop can do to the
operating system is the fixed IPC channel list in `src/preload/index.ts`.
Replacing Electron means reimplementing that channel list and the renderer —
not reimplementing VC Writer.
