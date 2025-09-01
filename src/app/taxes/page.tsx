'use client';
import { useEffect, useMemo, useState } from 'react';
import { loadStateTax, computeStateTax, type StateTaxTable } from '@/lib/tax';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataConfidenceBadge } from '@/hooks/useDataConfidence';

export default function TaxesPage(){
  const [state, setState] = useState('CA');
  const [year, setYear] = useState(2025);
  const [income, setIncome] = useState(85000);
  const [table, setTable] = useState<StateTaxTable | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(()=> {
    (async()=>{
      try {
        setError('');
        setTable(await loadStateTax(state, year));
      } catch(e:any){
        setError(e.message);
        setTable(null);
      }
    })();
  }, [state, year]);

  const tax = useMemo(() => table ? computeStateTax(table, income) : 0, [table, income]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          State Tax Calculator
        </h1>
        <p className="text-muted-foreground">
          Estimate your state income tax based on different filing scenarios.
        </p>
      </header>
      
      <DataConfidenceBadge datasets={['cpi_zip', 'cost_of_living_zip', 'tax_zip']} className="mb-3" />

      <Card>
        <CardHeader>
          <CardTitle>Tax Calculation</CardTitle>
          <CardDescription>Enter your details to see the estimated state tax.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state-select">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state-select">
                  <SelectValue placeholder="Select state..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year-input">Year</Label>
              <Input id="year-input" type="number" value={year} onChange={e=> setYear(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income-input">Taxable Income</Label>
              <Input id="income-input" type="number" value={income} onChange={e=> setIncome(Number(e.target.value))} />
            </div>
          </div>

           {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

           {table && (
            <div className="space-y-4 pt-4">
                <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle>Estimated Tax Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-primary">${tax.toFixed(2)}</p>
                    </CardContent>
                </Card>

              <div className="space-y-2">
                 <h3 className="font-medium">Tax Brackets ({table.state} - {table.year})</h3>
                <div className="overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rate</TableHead>
                        <TableHead>Up To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {table.brackets.map((b,i)=> (
                        <TableRow key={i}>
                          <TableCell>{b.rate}%</TableCell>
                          <TableCell>{b.upTo?.toLocaleString() ?? '∞'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
