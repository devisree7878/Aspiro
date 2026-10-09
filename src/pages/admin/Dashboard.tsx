import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Card, ErrorBox, PageHeader, Spinner } from '../../components/ui'

export default function Dashboard() {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: async () => unwrap(await supabase.rpc('admin_stats')) as any })
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  const s = q.data
  const tiles: [string, any][] = [['Registered students', s.students], ['Active (7 days)', s.active_7d], ['Published courses', s.courses_published],
    ['Enrollments', s.enrollments], ['Activities completed', s.activities_completed], ['Avg quiz score', s.avg_quiz_score == null ? null : `${s.avg_quiz_score}%`]]
  return (
    <div>
      <PageHeader title="Dashboard" sub="Live metrics from the database." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tiles.map(([l, v]) => <Card key={l}><div className="text-xs font-bold uppercase text-ink-mute">{l}</div>
        <div className="mt-2 text-3xl font-extrabold">{v ?? <span className="text-base font-medium text-ink-mute">No data available yet.</span>}</div></Card>)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <List title="Most popular career paths" rows={s.popular_paths} val={r => `${r.students} students`} />
        <List title="Most difficult skills (lowest average)" rows={s.hardest_skills} val={r => `${r.avg_score}%`} />
      </div>
    </div>
  )
}
function List({ title, rows, val }: { title: string; rows: any[]; val: (r: any) => string }) {
  return <Card><h2 className="mb-3 font-bold">{title}</h2>{!rows.length ? <p className="text-sm text-ink-mute">No data available yet.</p> :
    <ul className="divide-y divide-paper-line text-sm">{rows.map(r => <li key={r.name} className="flex justify-between py-2"><span>{r.name}</span><b>{val(r)}</b></li>)}</ul>}</Card>
}
