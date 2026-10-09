import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Badge, Button, Empty, ErrorBox, Input, Modal, PageHeader, Spinner } from '../../components/ui'
import { useToast } from '../../components/Toast'

const PAGE = 20
export default function Students() {
  const qc = useQueryClient(); const toast = useToast()
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0); const [sel, setSel] = useState<any | null>(null)
  const q = useQuery({ queryKey: ['students', search, page], queryFn: async () => {
    let r = supabase.from('profiles').select('id,full_name,email,institution,graduation_year,status,onboarding_completed,created_at').order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (search) { const s = search.replace(/[%,()]/g, ''); r = r.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`) }
    return unwrap(await r) as any[] } })
  const detail = useQuery({ queryKey: ['student', sel?.id], enabled: !!sel, queryFn: async () => {
    const [e, p, s] = await Promise.all([
      supabase.from('enrollments').select('status,start_date,courses(title)').eq('student_id', sel.id),
      supabase.from('activity_progress').select('status,score').eq('student_id', sel.id),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('student_id', sel.id)])
    const prog = unwrap(p) as any[]
    return { enrollments: unwrap(e) as any[], completed: prog.filter(x => x.status === 'completed').length, scores: prog.filter(x => x.score != null), submissions: s.count ?? 0 } } })
  const toggle = useMutation({
    mutationFn: async (s: any) => { const next = s.status === 'active' ? 'suspended' : 'active'
      if (!confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} ${s.full_name || s.email}?`)) return
      const r = await supabase.from('profiles').update({ status: next }).eq('id', s.id); if (r.error) throw r.error; setSel({ ...s, status: next }) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); toast('ok', 'Updated') }, onError: (e: Error) => toast('err', e.message) })
  return (
    <div>
      <PageHeader title="Students" />
      <Input className="mb-4 max-w-sm" placeholder="Search by name or email…" aria-label="Search students" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <Empty title="No students found" /> :
        <div className="overflow-x-auto rounded-2xl border border-paper-line bg-white"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase text-ink-mute"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Institution</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>{q.data.map(s => <tr key={s.id} className="cursor-pointer border-t border-paper-line hover:bg-brand-50" onClick={() => setSel(s)}>
            <td className="px-4 py-3 font-semibold">{s.full_name || '—'}</td><td className="px-4 py-3">{s.email}</td><td className="px-4 py-3">{s.institution ?? '—'}</td>
            <td className="px-4 py-3"><Badge tone={s.status === 'active' ? 'good' : 'warn'}>{s.status}</Badge></td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={(q.data?.length ?? 0) < PAGE} onClick={() => setPage(page + 1)}>Next</Button></div>
      {sel && <Modal title={sel.full_name || sel.email} onClose={() => setSel(null)}>
        {detail.isLoading ? <Spinner /> : detail.error ? <ErrorBox error={detail.error} /> : <div className="space-y-3 text-sm">
          <p><b>Email:</b> {sel.email}</p><p><b>Graduation:</b> {sel.graduation_year ?? '—'}</p>
          <p><b>Enrollments:</b> {detail.data!.enrollments.length ? detail.data!.enrollments.map(e => e.courses?.title).join(', ') : 'None'}</p>
          <p><b>Activities completed:</b> {detail.data!.completed} · <b>Graded results:</b> {detail.data!.scores.length} · <b>Submissions:</b> {detail.data!.submissions}</p>
          <div className="pt-2"><Button variant={sel.status === 'active' ? 'danger' : 'primary'} loading={toggle.isPending} onClick={() => toggle.mutate(sel)}>{sel.status === 'active' ? 'Suspend account' : 'Reactivate account'}</Button></div></div>}</Modal>}
    </div>
  )
}
