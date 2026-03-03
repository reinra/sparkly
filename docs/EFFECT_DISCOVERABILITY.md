# Effect Discoverability Plan

As the number of effects grows, users need better ways to find effects quickly. This document tracks planned improvements, ordered from least to most effort.

## 1. Search/filter text input ✅

Add a text input above the effects list that filters effects by name as the user types. Purely frontend — no API changes needed.

**Status:** Implemented

## 2. Categories/tags on effects ✅

Each effect class declares a `category` field (`'animated'`, `'simple'`, `'static'`, or `'test'`). The `EffectCategory` type and display labels are defined in `Effect.ts`. The category is exposed in the `getInfo` API response and used in the UI:

- **Device card** (`DeviceCard.svelte`): effect `<select>` uses `<optgroup>` per category.
- **Device detail page** (`devices/[id]/+page.svelte`): effect list shows category headers between groups.

Category is code-level metadata on the effect class, so it flows through persistence naturally — built-in effects always have it, and cloned effects inherit it via `new EffectClass()`.

**Status:** Implemented

## 3. Collapsible groups

Group effects visually by category with collapsible section headers (e.g. "Animated", "Static", "Test"). Builds on top of item 2 and makes browsing natural without a search box.

**Status:** Not started

## 4. Favorites / recently used

Let users star/pin effects so their most-used ones appear at the top. Could be stored per-device or globally in the frontend (localStorage) or backend state.

**Status:** Not started

## 5. Sort options

Allow sorting by name (A-Z), by type (1D/2D), or by animation mode.

**Status:** Not started
