import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '../../lib/supabase'
import { ACTIVITY_TYPES, typeDef } from '../../lib/activityTypes'
import type { Activity, Day } from '../../lib/types'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, Spinner, Textarea, statusTone } from '../../components/ui'
import { useToast } from '../../components/Toast'
import ActivityEditor from '../../features/admin/ActivityEditor'

export default function DayBuilder() {
  const { dayId } = useParams(); const qc = useQueryClient(); const toast = useToast()
  const key = ['day-builder', dayId]
  const [edit, setEdit] = useState<Activity | null>(null); const [adding, setAdding] = useState(false)
  const [meta, setMeta] = useState<any | null>(null); const [busy, setBusy] = useState('')
  const q = useQuery({ queryKey: key, queryFn: async () => {
    const day = unwrap(await supabase.from('days').select('*').eq('id', dayId!).single()) as Day
    const [acts, skills, course] = await Promise.all([
      supabase.from('activities').select('*').eq('day_id', dayId!).order('order_index'),
      supabase.from('skills').select('id,name').order('name'),
      supabase.from('courses').select('id,title,status').eq('id', day.course_id).single()])
    return { day, acts: unwrap(acts) as Activity[], skills: unwrap(skills) as any[], course: unwrap(course) as any }
  } })
  const refetch = () => qc.invalidateQueries({ queryKey: key })
  const act = (name: string, fn: () => Promise<void>, ok: string) => async () => {
    setBusy(name); try { await fn(); toast('ok', ok); refetch() } catch (e) { toast('err', (e as Error).message) } finally { setBusy('') } }
  const chk = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message) }

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  const { day, acts, skills, course } = q.data!
  const m = meta ?? day
  const total = acts.filter(a => a.status !== 'archived').reduce((s, a) => s + a.estimated_minutes, 0)

  const saveMeta = async (status?: string) => {
    if (!m.title.trim()) throw new Error('Day title is required')
    chk(await supabase.from('days').update({ title: m.title.trim(), description: m.description || null, day_number: Number(m.day_number), estimated_minutes: total, status: status ?? m.status }).eq('id', day.id))
    setMeta(null)
  }
  const swap = (i: number, d: -1 | 1) => act('move', async () => {
    const a = acts[i], b = acts[i + d]; if (!b) return
    chk(await supabase.from('activities').update({ order_index: b.order_index }).eq('id', a.id)); chk(await supabase.from('activities').update({ order_index: a.order_index }).eq('id', b.id)) }, 'Reordered')()
  const duplicate = (a: Activity) => act('dup', async () => {
    const ins = await supabase.from('activities').insert({ day_id: day.id, type: a.type, title: `${a.title} (copy)`, description: a.description, order_index: (acts.at(-1)?.order_index ?? 0) + 1, is_required: a.is_required, estimated_minutes: a.estimated_minutes, status: 'draft', content: a.content }).select('id').single()
    if (ins.error) throw ins.error
    const sec = await supabase.from('activity_secrets').select('content').eq('activity_id', a.id).maybeSingle()
    if (sec.data) chk(await supabase.from('activity_secrets').insert({ activity_id: ins.data.id, content: sec.data.content }))
    const sk = await supabase.from('activity_skills').select('skill_id,weight').eq('activity_id', a.id)
    if (sk.data?.length) chk(await supabase.from('activity_skills').insert(sk.data.map(s => ({ ...s, activity_id: ins.data.id })))) }, 'Duplicated')()
  const remove = (a: Activity) => { if (confirm(`Delete "${a.title}"? Student progress on it will be removed.`)) act('del', async () => chk(await supabase.from('activities').delete().eq('id', a.id)), 'Deleted')() }
  const create = (type: string) => act('add', async () => {
    const t = typeDef(type)
    const r = await supabase.from('activities').insert({ day_id: day.id, type, title: `New ${t.label.toLowerCase()}`, order_index: (acts.at(-1)?.order_index ?? 0) + 1, estimated_minutes: t.defaultMinutes, content: type === 'quiz' || type === 'assessment' ? { passing_score: 60, questions: [] } : {} }).select('*').single()
    if (r.error) throw r.error; setAdding(false); setEdit(r.data as Activity) }, 'Activity added')()
  const publishDay = () => {
    if (!acts.length) return toast('err', 'Add at least one activity before publishing')
    if (!confirm(`Publish Day ${day.day_number} and all its non-archived activities?${course.status !== 'published' ? '\n\nNote: the course itself is still ' + course.status + ', so students will not see this until the course is published.' : ''}`)) return
    act('pub', async () => {
      chk(await supabase.from('activities').update({ status: 'published' }).eq('day_id', day.id).neq('status', 'archived'))
      await saveMeta('published') }, 'Day published')()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/admin/courses/${course.id}`} className="text-sm font-semibold text-ink-soft">← {course.title}</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold">Day {m.day_number}</h1><Badge tone={statusTone(day.status)}>{day.status}</Badge><span className="text-sm text-ink-soft">Estimated time: {total} minutes</span></div>
      <Card className="mb-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[100px_1fr]"><Field label="Day #"><Input type="number" min={1} value={m.day_number} onChange={e => setMeta({ ...m, day_number: e.target.value })} /></Field>
          <Field label="Title *"><Input value={m.title} onChange={e => setMeta({ ...m, title: e.target.value })} /></Field></div>
        <Field label="Today's mission (shown to students)"><Textarea value={m.description ?? ''} onChange={e => setMeta({ ...m, description: e.target.value })} /></Field>
      </Card>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink-mute">Activities</h2>
      {!acts.length ? <Empty title="No activities yet" body="Add exactly the activities this day needs: a lesson, coding exercises, a quiz — any combination." /> :
        <ol className="space-y-2">{acts.map((a, i) => { const t = typeDef(a.type)
          return <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-paper-line bg-white p-3">
            <span className="w-7 text-center text-sm font-bold text-ink-mute">{String(i + 1).padStart(2, '0')}</span><t.icon size={18} className="text-brand-600" />
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase text-ink-mute">{t.label}{!a.is_required && ' · optional'} · {a.estimated_minutes}m</div><div className="truncate font-semibold">{a.title}</div></div>
            <Badge tone={statusTone(a.status)}>{a.status}</Badge>
            <div className="flex">{[[ArrowUp, 'Move up', () => swap(i, -1), i === 0], [ArrowDown, 'Move down', () => swap(i, 1), i === acts.length - 1], [Copy, 'Duplicate', () => duplicate(a), false], [Pencil, 'Edit', () => setEdit(a), false]].map(([I, l, fn, dis]: any) =>
              <button key={l} aria-label={l} disabled={dis || !!busy} onClick={fn} className="rounded-lg p-2 hover:bg-paper-line disabled:opacity-30"><I size={16} /></button>)}
              <button aria-label="Delete" disabled={!!busy} onClick={() => remove(a)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button></div></li> })}</ol>}
      <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}><Plus size={16} />Add activity</Button>

      <div className="sticky bottom-0 mt-8 flex flex-wrap justify-end gap-2 border-t border-paper-line bg-paper/95 py-4 backdrop-blur">
        <Button variant="secondary" loading={busy === 'save'} onClick={act('save', () => saveMeta('draft'), 'Saved as draft')}>Save draft</Button>
        <Link to={`/admin/preview/${day.id}`} className="inline-flex items-center gap-2 rounded-xl border border-paper-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-brand-50"><Eye size={16} />Preview</Link>
        <Button loading={busy === 'pub'} onClick={publishDay}>Publish</Button>
      </div>

      {adding && <Modal title="Add activity" onClose={() => setAdding(false)}><div className="grid gap-2 sm:grid-cols-2">{Object.entries(ACTIVITY_TYPES).map(([k, t]) =>
        <button key={k} onClick={() => create(k)} className="flex items-center gap-3 rounded-xl border border-paper-line bg-white p-4 text-left hover:border-brand-500"><t.icon className="text-brand-600" /><span className="font-semibold">{t.label}</span></button>)}</div></Modal>}
      {edit && <ActivityEditor activity={edit} skills={skills} onClose={() => { setEdit(null); refetch() }} onSaved={() => { setEdit(null); refetch() }} />}
    </div>
  )
}
