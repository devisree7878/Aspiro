import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '../../lib/supabase'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, statusTone } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function CourseBuilder() {
  const { courseId } = useParams(); const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate()
  const key = ['course-builder', courseId]
  const [phaseModal, setPhaseModal] = useState<any | null>(null)
  const [dayModal, setDayModal] = useState<any | null>(null)
  const [meta, setMeta] = useState<any | null>(null)

  const q = useQuery({ queryKey: key, queryFn: async () => {
    const [c, ph, dy, sk, cs, lp] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId!).single(),
      supabase.from('phases').select('*').eq('course_id', courseId!).order('order_index'),
      supabase.from('days').select('id,phase_id,day_number,title,status,estimated_minutes,activities(count)').eq('course_id', courseId!).order('day_number'),
      supabase.from('skills').select('id,name').order('name'),
      supabase.from('course_skills').select('skill_id').eq('course_id', courseId!),
      supabase.from('learning_paths').select('id,title').order('title')
    ])
    return { course: unwrap(c) as any, phases: unwrap(ph) as any[], days: unwrap(dy) as any[], skills: unwrap(sk) as any[], cskills: unwrap(cs).map((x: any) => x.skill_id) as string[], paths: unwrap(lp) as any[] }
  } })
  const refetch = () => qc.invalidateQueries({ queryKey: key })
  const run = (fn: () => Promise<any>, ok = 'Saved') => async () => { try { await fn(); toast('ok', ok); refetch() } catch (e) { toast('err', (e as Error).message) } }

  const savePhase = useMutation({ mutationFn: async (p: any) => {
    if (!p.title?.trim()) throw new Error('Phase title is required')
    const r = p.id ? await supabase.from('phases').update({ title: p.title.trim(), description: p.description || null }).eq('id', p.id)
      : await supabase.from('phases').insert({ course_id: courseId, title: p.title.trim(), description: p.description || null, order_index: (q.data!.phases.at(-1)?.order_index ?? 0) + 1 })
    if (r.error) throw r.error }, onSuccess: () => { setPhaseModal(null); refetch() }, onError: (e: Error) => toast('err', e.message) })
  const addDay = useMutation({ mutationFn: async (d: any) => {
    if (!d.title?.trim()) throw new Error('Day title is required')
    const next = (q.data!.days.reduce((m, x) => Math.max(m, x.day_number), 0)) + 1
    const r = await supabase.from('days').insert({ course_id: courseId, phase_id: d.phase_id, day_number: next, title: d.title.trim() }).select('id').single()
    if (r.error) throw r.error; return r.data.id as string }, onSuccess: id => nav(`/admin/days/${id}`), onError: (e: Error) => toast('err', e.message) })

  const move = async (i: number, dir: -1 | 1) => {
    const a = q.data!.phases[i], b = q.data!.phases[i + dir]; if (!b) return
    await run(async () => { await supabase.from('phases').update({ order_index: b.order_index }).eq('id', a.id); await supabase.from('phases').update({ order_index: a.order_index }).eq('id', b.id) }, 'Reordered')()
  }
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  const { course, phases, days, skills, cskills, paths } = q.data!
  const m = meta ?? course

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/courses" className="text-sm font-semibold text-ink-soft">← Courses</Link>
      <PageHeader title={course.title} actions={<Badge tone={statusTone(course.status)}>{course.status}</Badge>} />
      <Card className="mb-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><Input value={m.title} onChange={e => setMeta({ ...m, title: e.target.value })} /></Field>
          <Field label="Learning path"><Select value={m.learning_path_id ?? ''} onChange={e => setMeta({ ...m, learning_path_id: e.target.value || null })}><option value="">— none —</option>{paths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
          <Field label="Level"><Select value={m.level ?? ''} onChange={e => setMeta({ ...m, level: e.target.value || null })}><option value="">any</option><option>beginner</option><option>intermediate</option><option>advanced</option></Select></Field>
          <Field label="Status"><Select value={m.status} onChange={e => setMeta({ ...m, status: e.target.value })}><option>draft</option><option>published</option><option>archived</option></Select></Field>
        </div>
        <Field label="Description"><Textarea value={m.description ?? ''} onChange={e => setMeta({ ...m, description: e.target.value })} /></Field>
        <div><p className="mb-2 text-sm font-semibold">Skills developed by this course</p>
          {!skills.length ? <p className="text-sm text-ink-mute">Add skills under Careers & Skills first.</p> : <div className="flex flex-wrap gap-2">{skills.map(s => { const on = (m.skillIds ?? cskills).includes(s.id)
            return <button key={s.id} type="button" aria-pressed={on} onClick={() => { const cur: string[] = m.skillIds ?? cskills; setMeta({ ...m, skillIds: on ? cur.filter(x => x !== s.id) : [...cur, s.id] }) }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-paper-line bg-white'}`}>{s.name}</button> })}</div>}</div>
        <div className="flex justify-end gap-2">
          {meta && <Button variant="ghost" onClick={() => setMeta(null)}>Discard changes</Button>}
          <Button disabled={!meta} onClick={run(async () => {
            if (!m.title.trim()) throw new Error('Title is required')
            if (m.status === 'published' && course.status !== 'published' && !confirm('Publish this course? Students matched to its learning path will see published days immediately.')) return
            const u = await supabase.from('courses').update({ title: m.title.trim(), description: m.description, level: m.level, status: m.status, learning_path_id: m.learning_path_id }).eq('id', courseId!)
            if (u.error) throw u.error
            if (m.skillIds) { await supabase.from('course_skills').delete().eq('course_id', courseId!); if (m.skillIds.length) { const i = await supabase.from('course_skills').insert(m.skillIds.map((s: string) => ({ course_id: courseId, skill_id: s }))); if (i.error) throw i.error } }
            setMeta(null) })}>Save course</Button></div>
      </Card>

      <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold">Phases & days</h2><Button onClick={() => setPhaseModal({})}><Plus size={16} />Add phase</Button></div>
      {!phases.length ? <Empty title="No phases yet" body="Phases group days into stages, e.g. “Java Foundations”." action={<Button onClick={() => setPhaseModal({})}>Add first phase</Button>} /> :
        <div className="space-y-4">{phases.map((p, i) => { const pd = days.filter(d => d.phase_id === p.id)
          return <Card key={p.id}>
            <div className="mb-3 flex items-center gap-2"><div className="flex-1"><div className="text-xs font-bold uppercase text-ink-mute">Phase {i + 1}</div><h3 className="font-bold">{p.title}</h3></div>
              <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-2 hover:bg-paper-line disabled:opacity-30"><ArrowUp size={16} /></button>
              <button aria-label="Move down" disabled={i === phases.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-2 hover:bg-paper-line disabled:opacity-30"><ArrowDown size={16} /></button>
              <button aria-label="Edit phase" onClick={() => setPhaseModal(p)} className="rounded-lg p-2 hover:bg-paper-line"><Pencil size={16} /></button>
              <button aria-label="Delete phase" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => confirm(`Delete phase "${p.title}" and its ${pd.length} day(s)? This cannot be undone.`) && run(async () => { const r = await supabase.from('phases').delete().eq('id', p.id); if (r.error) throw r.error }, 'Deleted')()}><Trash2 size={16} /></button></div>
            <ul className="space-y-2">{pd.map(d => <li key={d.id}><Link to={`/admin/days/${d.id}`} className="flex items-center gap-3 rounded-xl border border-paper-line px-4 py-3 hover:border-brand-500">
              <span className="w-16 text-sm font-bold text-ink-mute">Day {d.day_number}</span><span className="flex-1 truncate font-semibold">{d.title}</span>
              <span className="text-xs text-ink-mute">{d.activities?.[0]?.count ?? 0} activities · {d.estimated_minutes}m</span><Badge tone={statusTone(d.status)}>{d.status}</Badge></Link></li>)}</ul>
            <Button variant="secondary" className="mt-3" onClick={() => setDayModal({ phase_id: p.id })}><Plus size={16} />Add day</Button></Card> })}</div>}

      {phaseModal && <Modal title={phaseModal.id ? 'Edit phase' : 'New phase'} onClose={() => setPhaseModal(null)}><div className="space-y-4">
        <Field label="Title *"><Input value={phaseModal.title ?? ''} onChange={e => setPhaseModal({ ...phaseModal, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={phaseModal.description ?? ''} onChange={e => setPhaseModal({ ...phaseModal, description: e.target.value })} /></Field></div>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPhaseModal(null)}>Cancel</Button><Button loading={savePhase.isPending} onClick={() => savePhase.mutate(phaseModal)}>Save</Button></div></Modal>}
      {dayModal && <Modal title="New day" onClose={() => setDayModal(null)}><Field label="Day title *"><Input autoFocus value={dayModal.title ?? ''} onChange={e => setDayModal({ ...dayModal, title: e.target.value })} placeholder="e.g. Conditional Logic" /></Field>
        <p className="mt-2 text-xs text-ink-mute">Next, you'll choose exactly which activities this day contains.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDayModal(null)}>Cancel</Button><Button loading={addDay.isPending} onClick={() => addDay.mutate(dayModal)}>Create & open</Button></div></Modal>}
    </div>
  )
}
