import type { GetInfoResponse } from '../FrontendApiClient';
import type { EffectCategoryInfo } from '@sparkly/common';

type EffectEntry = GetInfoResponse['effects'][number];

export interface EffectGroup {
  label: string;
  effects: EffectEntry[];
}

export interface IndexedEffectGroup {
  label: string;
  entries: { effect: EffectEntry; index: number }[];
}

/**
 * Group effects by their category, preserving the order within each group.
 * Category order and labels come from the backend via effectCategories.
 * Effects without a category default to 'animated'.
 */
export function groupEffectsByCategory(effects: EffectEntry[], categories: EffectCategoryInfo[]): EffectGroup[] {
  const byCategory = new Map<string, EffectEntry[]>();

  for (const effect of effects) {
    const cat = effect.category ?? 'animated';
    let list = byCategory.get(cat);
    if (!list) {
      list = [];
      byCategory.set(cat, list);
    }
    list.push(effect);
  }

  const result: EffectGroup[] = [];
  for (const { key, label } of categories) {
    const list = byCategory.get(key);
    if (list && list.length > 0) {
      result.push({ label, effects: list });
      byCategory.delete(key);
    }
  }
  // Any unknown categories appear at the end
  for (const [key, list] of byCategory) {
    if (list.length > 0) {
      result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), effects: list });
    }
  }

  return result;
}

/**
 * Group indexed (filtered) effects by their category, preserving original indices.
 * Used by the detail page where effects are tracked by index for keyboard navigation.
 */
export function groupIndexedEffectsByCategory(
  entries: { effect: EffectEntry; index: number }[],
  categories: EffectCategoryInfo[]
): IndexedEffectGroup[] {
  const byCategory = new Map<string, { effect: EffectEntry; index: number }[]>();

  for (const entry of entries) {
    const cat = entry.effect.category ?? 'animated';
    let list = byCategory.get(cat);
    if (!list) {
      list = [];
      byCategory.set(cat, list);
    }
    list.push(entry);
  }

  const result: IndexedEffectGroup[] = [];
  for (const { key, label } of categories) {
    const list = byCategory.get(key);
    if (list && list.length > 0) {
      result.push({ label, entries: list });
      byCategory.delete(key);
    }
  }
  for (const [key, list] of byCategory) {
    if (list.length > 0) {
      result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), entries: list });
    }
  }

  return result;
}
