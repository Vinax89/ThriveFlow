'use client';
import { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, orderBy, query, limit } from 'firebase/firestore';

export default function AdminMetrics(){
  const [rows, setRows] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(()=> { (async()=>{
    const db = getFirestore();
    const m = await getDocs(query(collection(db,'admin_metrics'), orderBy('date','desc'), limit(30)));
    setRows(m.docs.map(d=> d.data()));
    const a = await getDocs(query(collection(db,'admin_alerts'), orderBy('createdAt','desc'), limit(100)));
    setAlerts(a.docs.map(d=> d.data()));
  })(); }, []);
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin — Metrics</h1>
      <div className="overflow-auto border">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-right">Opened</th>
            <th className="p-2 text-right">Resolved</th>
            <th className="p-2 text-right">Backlog</th>
            <th className="p-2 text-right">Median TTR (min)</th>
            <th className="p-2 text-right">p95 TTR (min)</th>
            <th className="p-2 text-right">Oldest open (min)</th>
          </tr></thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.date} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{r.date}</td>
                <td className="p-2 text-right">{r.opened}</td>
                <td className="p-2 text-right">{r.resolved}</td>
                <td className="p-2 text-right">{r.backlog}</td>
                <td className="p-2 text-right">{r.medianTTRmin}</td>
                <td className="p-2 text-right">{r.p95TTRmin}</td>
                <td className="p-2 text-right">{r.oldestOpenMin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section>
        <h2 className="font-medium mb-2">SLA Alerts (≥ threshold)</h2>
        <ul className="list-disc pl-6">
          {alerts.map(a=> <li key={a.id}>{a.createdAt} · review {a.reviewId} (user {String(a.userId).slice(0,6)}…) — age {a.ageMin} min</li>)}
        </ul>
      </section>
    </main>
  );
}
