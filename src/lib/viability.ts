/**
 * @fileoverview Core cost-of-living and financial viability calculator.
 * This module contains the primary logic for assessing financial viability based on
 * income, expenses, debts, and various economic datasets.
 */

// --- Type Definitions ---

/** All required inputs for the viability calculation. */
export type ViabilityInputs = {
  zip: string;
  grossAnnual: number;
  filing: 'single' | 'married' | 'hoh';
  dependents: number;
  preTax: { k401: number; hsa: number; fsa: number; premiums: number }; // dollars/yr
  postTaxPremiums: number; // dollars/yr
  householdSize: number;
  actualHousingMonthly?: number;
  debtMonthly?: number;
};

/** A container for all the datasets required by the calculation. */
export type Datasets = {
  crosswalk: Record<string, any>; // Placeholder for zip -> location data
  rpp: Record<string, any>;       // Regional Price Parity data
  cpi: Record<string, any>;       // Consumer Price Index data
  housing: Record<string, any>;   // Housing index data
  taxZip: Record<string, any>;    // Tax tables by zip
};

// --- Helper Functions ---

function safeDiv(a: number, b: number): number {
  if (b === 0) return 0;
  return a / b;
}

function resolveZip(zip: string, crosswalk: Datasets['crosswalk']): Record<string, any> {
  // In a real implementation, this would look up state, county, CBSA, etc. from the crosswalk data.
  console.log(`Resolving ZIP: ${zip}`, crosswalk);
  return { state: 'CA', county: '94105', cbsa: 'SF', region: 'West', localityKey: 'CA-SF' };
}

function blendIndex({ rpp, cpi, hix }: Record<string, number>): number {
  // A simplified blend. A real implementation might have more sophisticated weighting.
  return (rpp * 0.5) + (cpi * 0.2) + (hix * 0.3);
}

function baseBasketMonthlyUSD(householdSize: number): Record<string, number> {
  // National average monthly spending basket. This would come from a data source.
  console.log('Getting base basket for household size:', householdSize);
  return { housing: 1800, food: 600, transport: 500, healthcare: 400, other: 700 };
}

function predictHousing(baseHousing: number, housingIndex: number): number {
  // Predict local housing cost based on a national baseline and a local index.
  return baseHousing * housingIndex;
}

function scaleBasket(base: Record<string, number>, localIndex: number, finalHousing: number): number {
  // Scale the national baseline basket to local costs.
  const { housing, ...rest } = base;
  const nonHousingTotal = Object.values(rest).reduce((sum, val) => sum + val, 0);
  const scaledNonHousing = nonHousingTotal * localIndex;
  return finalHousing + scaledNonHousing;
}

function calcTaxes(args: {
  grossAnnual: number;
  filing: 'single' | 'married' | 'hoh';
  dependents: number;
  state: string;
  locality: string;
  preTax: ViabilityInputs['preTax'];
  postTaxPremiums: number;
  taxTables: Datasets['taxZip'];
}): { federal: number; state: number; local: number; FICA: number; total: number } {
  // This is a major simplification. A real tax calculation is much more complex.
  console.log('Calculating taxes with args:', args);
  const federal = args.grossAnnual * 0.15;
  const state = args.grossAnnual * 0.05;
  const local = args.grossAnnual * 0.01;
  const FICA = args.grossAnnual * 0.0765;
  return { federal, state, local, FICA, total: federal + state + local + FICA };
}

function viabilityScore(metrics: {
  ICR: number;
  housingRat: number;
  dti: number;
  surplus: number;
  grossMonthly: number;
}): number {
  // A simple scoring model. A real one would be more nuanced.
  console.log('Scoring with metrics:', metrics);
  let score = 50;
  if (metrics.ICR > 1.5) score += 15;
  if (metrics.ICR > 2.0) score += 15;
  if (metrics.housingRat < 0.33) score += 10;
  if (metrics.dti < 0.4) score += 10;
  return Math.min(100, Math.max(0, score));
}

// --- Core Calculation Function ---

/**
 * Computes a financial viability report for a given set of inputs and datasets.
 * @param i The user-provided inputs.
 * @param ctx The context object containing all necessary datasets.
 * @returns A detailed financial viability report.
 */
export function computeViability(i: ViabilityInputs, ctx: Datasets) {
  const loc = resolveZip(i.zip, ctx.crosswalk);               // {state, county, cbsa, region}
  const rpp = ctx.rpp[loc.state] ?? 1.0;
  const cpi = ctx.cpi[loc.region] ?? 1.0;
  const hix = ctx.housing[i.zip] ?? ctx.housing[loc.cbsa] ?? 1.0;

  const LocalCostIndex = blendIndex({ rpp, cpi, hix });

  const base = baseBasketMonthlyUSD(i.householdSize);         // national baseline
  const housing = i.actualHousingMonthly ?? predictHousing(base.housing, hix);
  const LocalMonthlyCOL = scaleBasket(base, LocalCostIndex, housing);

  const taxes = calcTaxes({
    grossAnnual: i.grossAnnual,
    filing: i.filing,
    dependents: i.dependents,
    state: loc.state,
    locality: loc.localityKey,
    preTax: i.preTax,
    postTaxPremiums: i.postTaxPremiums,
    taxTables: ctx.taxZip,
  });

  const netAnnual   = i.grossAnnual - taxes.total;
  const netMonthly  = netAnnual / 12;
  const surplus     = netMonthly - LocalMonthlyCOL - (i.debtMonthly ?? 0);

  const ICR         = safeDiv(netMonthly, LocalMonthlyCOL);
  const housingRat  = safeDiv(housing, netMonthly);
  const dti         = safeDiv(i.debtMonthly ?? 0, i.grossAnnual / 12);

  const score = viabilityScore({ ICR, housingRat, dti, surplus, grossMonthly: i.grossAnnual/12 });
  return { LocalMonthlyCOL, netMonthly, surplus, ICR, housingRat, dti, score, breakdown: { taxes, basket: base } };
}
