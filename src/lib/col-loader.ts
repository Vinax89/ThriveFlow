/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

import 'server-only';
import base from '@/data/col/base.json';
import taxes from '@/data/col/taxes.json';
import overrides from '@/data/col/overrides.json';

type AnyMap = Record<string, any>;

export function getColSnapshot() {
  const meta = {
    version: (overrides as AnyMap).version || (base as AnyMap).version || (taxes as AnyMap).version || 'v1',
    updatedAt: (overrides as AnyMap).updatedAt || (base as AnyMap).updatedAt || (taxes as AnyMap).updatedAt || new Date().toISOString(),
  };
  return { base, taxes, overrides, ...meta };
}

export function getZipBundle(zip: string) {
  const z = zip.trim();
  const b = (base as AnyMap).zips?.[z] ?? null;
  const t = (taxes as AnyMap).zips?.[z] ?? null;
  const o = (overrides as AnyMap).zips?.[z] ?? null;
  return {
    zip: z,
    base: b,
    taxes: t,
    override: o,
    effective: { ...(b ?? {}), ...(t ?? {}), ...(o ?? {}) },
    meta: getColSnapshot(),
  };
}
