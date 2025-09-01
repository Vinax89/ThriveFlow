import 'server-only';

// Adjust paths if you placed files elsewhere
import base from '@/data/col/base.json';
import taxes from '@/data/col/taxes.json';
import overrides from '@/data/col/overrides.json';

type AnyObj = Record<string, any>;

export function getColSnapshot() {
  // Shallow merge with overrides taking precedence
  const data: AnyObj = {
    base,
    taxes,
    overrides,
    version: overrides.version ?? base.version ?? taxes.version ?? 'v1',
    updatedAt:
      overrides.updatedAt ?? base.updatedAt ?? taxes.updatedAt ?? new Date().toISOString(),
  };
  return data;
}

// Convenience getter: returns the best match for a ZIP
export function getZipBundle(zip: string) {
  const z = zip.trim();
  const b = (base as AnyObj).zips?.[z] ?? null;
  const t = (taxes as AnyObj).zips?.[z] ?? null;
  const o = (overrides as AnyObj).zips?.[z] ?? null;
  return {
    zip: z,
    base: b,
    taxes: t,
    override: o,
    // pick override → base where present
    effective: { ...(b ?? {}), ...(t ?? {}), ...(o ?? {}) },
    meta: getColSnapshot(),
  };
}
