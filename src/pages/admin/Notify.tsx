import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function Notify() {
  const toast = useToast()
  const [f, setF] = useState({ audience: 'all', title: '', message: '', category: 'learning', priority: 'normal', action_url: '', picked: [] as string[] })
  const [search, setSearch] = useState('')
  const found = useQuery({ queryKey: ['notify-search', search], enabled: f.audience === 'users' && search.length >= 2, queryFn: async () => {
    const s = search.replace(/[%,()]/g, '')
    return unwrap(await supabase.from('profiles').select('id,full_name,email').or(`full_name.ilike.%${s}%,email.ilike.%${s}%`).limit(8)) as any[] } })
  const send = useMutation({
    mutationFn: async () => {
      if (f.title.trim().length < 3 || f.message.trim().length < 3) throw new Error('Title and message are required')
      if (f.audience === 'users' && !f.picked.length) throw new Error('Select at least one student')
      if (f.audience === 'all' && !confirm('Send this to every active student?')) return null
      return unwrap(await supabase.rpc('admin_send_notification', { p_title: f.title.trim(), p_message: f.message.trim(), p_category: f.category, p_priority: f.priority, p_action_url: f.action_url, p_audience: f.audience, p_user_ids: f.picked })) as number
    },
    onSuccess: n => { if (n != null) { toast('ok', `Sent to ${n} student(s)`); setF({ ...f, title: '', message: '', action_url: '', picked: [] }) } },
    onError: (e: Error) => toast('err', e.message)
  })
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Send notification" sub="Stored in the database and shown in each student's notification center." />
      <Card className="space-y-4">
        <Field label="To"><Select value={f.audience} onChange={e => setF({ ...f, audience: e.target.value, picked: [] })}><option value="all">Everyone</option><option value="users">Selected students</option></Select></Field>
        {f.audience === 'users' && <div><Input placeholder="Search students by name or email…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Find students" />
          <ul className="mt-2 space-y-1 text-sm">{found.data?.map(s => <li key={s.id}><label className="flex gap-2"><input type="checkbox" checked={f.picked.includes(s.id)} onChange={() => setF({ ...f, picked: f.picked.includes(s.id) ? f.picked.filter(x => x !== s.id) : [...f.picked, s.id] })} />{s.full_name || s.email} <span className="text-ink-mute">{s.email}</span></label></li>)}</ul>
          <p className="mt-1 text-xs text-ink-mute">{f.picked.length} selected</p></div>}
        <Field label="Title *"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Message *"><Textarea value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="learning">Learning</option><option value="career">Career</option><option value="opportunities">Opportunities</option></Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></Select></Field></div>
        <Field label="Action link (optional)" hint="An in-app path such as /journey"><Input value={f.action_url} onChange={e => setF({ ...f, action_url: e.target.value })} /></Field>
        <div className="flex justify-end"><Button loading={send.isPending} onClick={() => send.mutate()}>Send</Button></div>
      </Card>
    </div>
  )
}
