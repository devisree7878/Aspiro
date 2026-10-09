import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthContext'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, statusTone } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function Courses() {
  const nav = useNavigate(); const toast = useToast(); const { session } = useAuth()
  const [search, setSearch] = useState(''); const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', level: 'beginner', learning_path_id: '' })
  const q = useQuery({ queryKey: ['courses', search], queryFn: async () => {
    let r = supabase.from('courses').select('id,title,level,status,updated_at,learning_paths(title)').order('updated_at', { ascending: false }).limit(100)
    if (search) r = r.ilike('title', `%${search.replace(/[%,]/g, '')}%`)
    return unwrap(await r) as any[] } })
  const paths = useQuery({ queryKey: ['paths-all'], queryFn: async () => unwrap(await supabase.from('learning_paths').select('id,title').order('title')) as any[] })
  const create = useMutation({
    mutationFn: async () => {
      if (f.title.trim().length < 3) throw new Error('Course title is required')
      const r = await supabase.from('courses').insert({ title: f.title.trim(), level: f.level, learning_path_id: f.learning_path_id || null, created_by: session!.user.id }).select('id').single()
      if (r.error) throw r.error; return r.data.id as string
    }, onSuccess: id => nav(`/admin/courses/${id}`), onError: (e: Error) => toast('err', e.message)
  })
  return (
    <div>
      <PageHeader title="Courses" sub="Build learning content: course → phases → days → activities." actions={<Button onClick={() => setOpen(true)}><Plus size={16} />New course</Button>} />
      <Input className="mb-4 max-w-xs" placeholder="Search courses…" aria-label="Search courses" value={search} onChange={e => setSearch(e.target.value)} />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> :
        !q.data?.length ? <Empty title="No courses yet" body="Create your first course, then add phases, days and activities." action={<Button onClick={() => setOpen(true)}>Create course</Button>} /> :
        <div className="grid gap-3">{q.data.map(c => <Link key={c.id} to={`/admin/courses/${c.id}`} className="flex items-center gap-4 rounded-2xl border border-paper-line bg-white p-4 hover:border-brand-500">
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{c.title}</div><div className="text-xs text-ink-mute">{c.learning_paths?.title ?? 'No learning path'} · {c.level ?? 'any level'} · updated {new Date(c.updated_at).toLocaleDateString()}</div></div>
          <Badge tone={statusTone(c.status)}>{c.status}</Badge></Link>)}</div>}
      {open && <Modal title="New course" onClose={() => setOpen(false)}><div className="space-y-4">
        <Field label="Title *"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Java Programming" /></Field>
        <Field label="Learning path" hint="Students are matched to courses through a published learning path linked to a career goal."><Select value={f.learning_path_id} onChange={e => setF({ ...f, learning_path_id: e.target.value })}>
          <option value="">— choose later —</option>{paths.data?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
        <Field label="Level"><Select value={f.level} onChange={e => setF({ ...f, level: e.target.value })}><option>beginner</option><option>intermediate</option><option>advanced</option></Select></Field></div>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create</Button></div></Modal>}
    </div>
  )
}
