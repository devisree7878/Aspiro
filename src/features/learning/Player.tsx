import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Circle, Eye } from 'lucide-react'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { typeDef } from '../../lib/activityTypes'
import type { Activity, Day, Progress as P } from '../../lib/types'
import { Card, Empty, ErrorBox, Progress, Spinner } from '../../components/ui'
import { RENDERERS } from './renderers'

export default function Player({ preview, dayIdProp }: { preview?: boolean; dayIdProp?: string }) {
  const params = useParams(); const dayId = dayIdProp ?? params.dayId!
  const [sp, setSp] = useSearchParams(); const { session } = useAuth(); const qc = useQueryClient(); const nav = useNavigate()
  const uid = session?.user.id

  const day = useQuery({ queryKey: ['day', dayId], queryFn: async () => {
    const d = unwrap(await supabase.from('days').select('*').eq('id', dayId).maybeSingle()) as Day | null
    if (!d) throw new Error('This day is not available.')
    const acts = unwrap(await supabase.from('activities').select('id,type,title,order_index,is_required,estimated_minutes,status').eq('day_id', dayId).order('order_index'))
    return { day: d, acts: acts as Pick<Activity, 'id' | 'type' | 'title' | 'order_index' | 'is_required' | 'estimated_minutes' | 'status'>[] }
  } })
  const prog = useQuery({ queryKey: ['progress', dayId, uid], enabled: !preview && !!day.data, queryFn: async () =>
    unwrap(await supabase.from('activity_progress').select('activity_id,status,score,attempts,completed_at,result').eq('student_id', uid!).in('activity_id', day.data!.acts.map(a => a.id))) as P[] })

  const pm = new Map((prog.data ?? []).map(p => [p.activity_id, p]))
  const acts = day.data?.acts ?? []
  const firstOpen = acts.find(a => pm.get(a.id)?.status !== 'completed') ?? acts[0]
  const currentId = sp.get('a') ?? firstOpen?.id
  const current = acts.find(a => a.id === currentId)

  const full = useQuery({ queryKey: ['activity', currentId], enabled: !!currentId, queryFn: async () =>
    unwrap(await supabase.from('activities').select('*').eq('id', currentId!).maybeSingle()) as Activity })
  useEffect(() => { window.scrollTo(0, 0) }, [currentId])

  if (day.isLoading) return <Spinner />
  if (day.error) return <ErrorBox error={day.error} onRetry={() => day.refetch()} />
  const done = acts.filter(a => pm.get(a.id)?.status === 'completed').length
  const pct = acts.length ? (done / acts.length) * 100 : 0
  const idx = acts.findIndex(a => a.id === currentId)

  const onDone = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['progress'] }), qc.invalidateQueries({ queryKey: ['journey'] }), qc.invalidateQueries({ queryKey: ['skills'] })])
    const fresh = await qc.fetchQuery({ queryKey: ['progress', dayId, uid], queryFn: async () => unwrap(await supabase.from('activity_progress').select('activity_id,status').eq('student_id', uid!)) })
    const doneIds = new Set((fresh as any[]).filter(p => p.status === 'completed').map(p => p.activity_id))
    const next = acts.slice(idx + 1).find(a => !doneIds.has(a.id)) ?? acts.find(a => !doneIds.has(a.id))
    if (next) setSp({ a: next.id }); else nav('/')
  }

  const Renderer = full.data ? RENDERERS[full.data.type] : null
  const base = preview ? '/admin/days/' + dayId : '/'
  return (
    <div className="mx-auto max-w-6xl">
      {preview && <div className="mb-4 flex items-center gap-2 rounded-xl bg-ember-50 p-3 text-sm font-semibold text-ember-600"><Eye size={16} />Student preview — progress is not recorded and drafts are visible.</div>}
      <div className="mb-4 flex items-center justify-between">
        <Link to={base} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={16} />{preview ? 'Back to builder' : 'Home'}</Link>
        <span className="text-sm font-semibold text-ink-soft">Day {day.data!.day.day_number}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_220px]">
        <nav aria-label="Today's activities" className="order-1 lg:order-none">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-mute">Today</h2>
          <ol className="flex gap-2 overflow-x-auto lg:flex-col">
            {acts.map(a => { const t = typeDef(a.type); const ok = pm.get(a.id)?.status === 'completed'; const on = a.id === currentId
              return <li key={a.id} className="shrink-0"><button onClick={() => setSp({ a: a.id })} aria-current={on ? 'step' : undefined}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-white hover:bg-brand-50'}`}>
                {ok ? <CheckCircle2 size={16} /> : on ? <t.icon size={16} /> : <Circle size={16} className="opacity-40" />}<span className="truncate">{a.title}</span></button></li> })}
          </ol>
        </nav>
        <section className="min-w-0 order-2 lg:order-none">
          {!current ? <Empty title="Nothing to do yet" body="This day has no published activities." /> : (
            <Card className="p-6 sm:p-8">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-600">{typeDef(current.type).verb} · {current.estimated_minutes} min{!current.is_required && ' · optional'}</div>
              <h1 className="mb-5 mt-1 text-2xl font-extrabold">{current.title}</h1>
              {full.isLoading ? <Spinner /> : full.error ? <ErrorBox error={full.error} onRetry={() => full.refetch()} /> :
                Renderer && full.data ? <Renderer activity={full.data} progress={pm.get(full.data.id)} preview={preview} onDone={onDone} /> :
                <p className="text-ink-mute">This activity type isn't supported by the player yet.</p>}
            </Card>)}
        </section>
        <aside className="order-3 lg:order-none"><Card>
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-mute">Progress</h2>
          <p className="mt-2 text-3xl font-extrabold">{Math.round(pct)}%</p>
          <Progress value={pct} className="my-2" />
          <p className="text-sm text-ink-soft">{done}/{acts.length} activities</p>
        </Card></aside>
      </div>
    </div>
  )
}
