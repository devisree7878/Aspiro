import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Button, Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui'

const PAGE = 25
export default function Audit() {
  const [page, setPage] = useState(0)
  const q = useQuery({ queryKey: ['audit', page], queryFn: async () => unwrap(await supabase.from('audit_logs').select('*').order('id', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)) as any[] })
  return (
    <div>
      <PageHeader title="Audit log" sub="Sensitive admin actions: who did what, and when." />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <Empty title="No activity recorded yet" /> :
        <div className="overflow-x-auto rounded-2xl border border-paper-line bg-white"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase text-ink-mute"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Detail</th></tr></thead>
          <tbody>{q.data.map(r => <tr key={r.id} className="border-t border-paper-line"><td className="whitespace-nowrap px-4 py-2">{new Date(r.created_at).toLocaleString()}</td><td className="px-4 py-2 font-semibold">{r.action}</td><td className="px-4 py-2">{r.entity}</td><td className="max-w-sm truncate px-4 py-2 text-ink-soft">{r.metadata?.title ?? ''} {r.metadata?.status ? `(${r.metadata.status})` : ''}{r.metadata?.recipients != null ? ` → ${r.metadata.recipients} recipients` : ''}</td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={(q.data?.length ?? 0) < PAGE} onClick={() => setPage(page + 1)}>Next</Button></div>
    </div>
  )
}
