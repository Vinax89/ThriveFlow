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
