'use client'

import React, { useEffect, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DEFAULT_HOUSEHOLD = {
  filingStatus: 'single' as 'single' | 'married' | 'hoh',
  dependents: 0,
  pretaxPct: 0, // 401k/403b/457 etc. (percent of wages)
  renter: true,
}

const LOCAL_STORAGE_KEY = 'thriveflow_calc_prefs'

// BLS Consumer Expenditure Survey weights (2022)
// https://www.bls.gov/news.release/cesan.nr0.htm
const DEFAULT_BUDGET = {
  housing: 0.333,
  transportation: 0.168,
  food: 0.128,
  personal_insurance_pensions: 0.124,
  healthcare: 0.081,
  entertainment: 0.057,
  apparel: 0.026,
  other: 0.083,
}

/** Reads assumptions from localStorage with safe fallbacks. */
export function readAssumptionsSafe() {
  let household = DEFAULT_HOUSEHOLD
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.v === 1 && parsed.household) {
        household = { ...DEFAULT_HOUSEHOLD, ...parsed.household }
      }
    }
  } catch {
    //
  }

  // Adjust weights based on renter status
  const weights = {
    // Housing: from survey, lower if homeowner (no rent)
    housing: household.renter ? 0.25 : 0.1,
    // Utilities: from survey, slightly higher if homeowner
    utilities: household.renter ? 0.04 : 0.05,
    // Other major categories, scaled to fill remainder
    food: 0.18,
    transportation: 0.15,
    taxes_effective: 0.2, // fed/state/local combined
    other: 0.18,
  }
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  // Normalize to sum to 1
  for (const k in weights) (weights as any)[k] /= total

  return { household, weights, budget: DEFAULT_BUDGET }
}

/**
 * Weighted average of cost-of-living index components.
 * @param rpp_state_adj RPP for state (e.g., 1.15 for 15% > avg)
 * @param cpi_delta % YoY inflation (e.g., 0.035 for 3.5%)
 * @param housing_zip_adj ZIP-level rent index vs metro avg
 * @param weights Budget shares (e.g., housing: 0.33)
 * @returns Combined cost index (e.g., 1.1 for 10% > avg)
 */
export function blendIndexFromAssumptions(
  rpp_state_adj: number,
  cpi_delta: number,
  housing_zip_adj: number,
  weights: ReturnType<typeof readAssumptionsSafe>['weights']
) {
  const effective_rpp = rpp_state_adj * (1 + cpi_delta)
  const home = housing_zip_adj * effective_rpp

  const weighted =
    weights.housing * home +
    weights.food * effective_rpp +
    weights.transportation * effective_rpp +
    weights.utilities * effective_rpp +
    weights.other * effective_rpp
  // Taxes are already baked into post-tax income, so not included here
  return weighted
}

// Simple pub/sub for assumption changes
const listeners = new Set<() => void>();
export function onAssumptionsChange(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback); // unsubscribe
}
function notifyListeners() {
  listeners.forEach(cb => cb());
}


export default function AdvancedAssumptionsPanel() {
  const [household, setHousehold] = useState(DEFAULT_HOUSEHOLD)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Basic validation
        if (parsed.v === 1 && parsed.household) {
          setHousehold(parsed.household)
        }
      }
    } catch {
      // Ignore errors if local storage is unavailable or malformed
    }
  }, [])

  function writePrefsToLocalStorage() {
    try {
      const payload = {
        v: 1,
        when: Date.now(),
        household,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
      alert('Saved calculator defaults.')
      notifyListeners();
    } catch (e: any) {
      alert(`Could not save defaults: ${e.message}`)
    }
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-lg border bg-background p-3"
    >
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4" />
            <span className="text-sm font-medium">Calculator Assumptions</span>
          </div>
          <ChevronDown
            className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-accordion-down space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Filing status
            </Label>
            <select
              className="mt-1 w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
              value={household.filingStatus}
              onChange={(e) =>
                setHousehold((h) => ({
                  ...h,
                  filingStatus: e.target.value as any,
                }))
              }
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="hoh">Head of Household</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Dependents</Label>
            <input
              type="number"
              className="mt-1 w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
              value={household.dependents}
              min={0}
              onChange={(e) =>
                setHousehold((h) => ({
                  ...h,
                  dependents: Number(e.target.value || 0),
                }))
              }
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Pre-tax retirement savings (% of wages)
          </Label>
          <input
            type="number"
            className="mt-1 w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
            value={household.pretaxPct}
            min={0}
            max={100}
            step={1}
            onChange={(e) =>
              setHousehold((h) => ({
                ...h,
                pretaxPct: Math.min(
                  100,
                  Math.max(0, Number(e.target.value || 0))
                ),
              }))
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Housing</Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="housing"
                checked={household.renter}
                onChange={() => setHousehold((h) => ({ ...h, renter: true }))}
              />
              Renter
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="housing"
                checked={!household.renter}
                onChange={() => setHousehold((h) => ({ ...h, renter: false }))}
              />
              Homeowner
            </label>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={writePrefsToLocalStorage}
        >
          Save as Defaults
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
