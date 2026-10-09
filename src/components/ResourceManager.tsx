import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '../lib/supabase'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Select, Spinner, Textarea } from './ui'
import { useToast } from './Toast'

export interface RField { key: string; label: string; type?: 'text' | 'textarea' | 'select' | 'checkbox'; required?: boolean; options?: { value: string; label: string }[] }

/** Generic admin CRUD over one table. Authorization is enforced by RLS, not by this component. */
export default function ResourceManager({ table, title, fields, orderBy = 'created_at', searchKey, columns }:
  { table: string; title: string; fields: RField[]; orderBy?: string; searchKey?: string; columns: string[] }) {
  const qc = useQueryClient(); const toast = useToast()
  const [search, setSearch] = useState(''); const [editing, setEditing] = useState<any | null>(null)
  const q = useQuery({ queryKey: [table, search], queryFn: async () => {
    let r = supabase.from(table).select('*').order(orderBy, { ascending: orderBy === 'name' || orderBy === 'title' }).limit(200)
    if (search && searchKey) r = r.ilike(searchKey, `%${search.replace(/[%,]/g, '')}%`)
    return unwrap(await r) as any[]
  } })
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from(table).delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast('ok', 'Deleted') }, onError: (e: Error) => toast('err', e.message)
  })
  const label = (f: RField, v: any) => f.type === 'select' ? f.options?.find(o => o.value === v)?.label ?? '—' : f.type === 'checkbox' ? (v ? 'Yes' : 'No') : v ?? '—'
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {searchKey && <Input className="max-w-xs" placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title}`} value={search} onChange={e => setSearch(e.target.value)} />}
        <Button className="ml-auto" onClick={() => setEditing({})}><Plus size={16} />Add</Button>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> :
        !q.data?.length ? <Empty title={`No ${title.toLowerCase()} yet`} body="Create the first one to get started." action={<Button onClick={() => setEditing({})}>Add {title.replace(/s$/, '').toLowerCase()}</Button>} /> :
        <div className="overflow-x-auto rounded-2xl border border-paper-line bg-white">
          <table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase text-ink-mute"><tr>
            {columns.map(c => <th key={c} className="px-4 py-3">{fields.find(f => f.key === c)?.label ?? c}</th>)}<th className="px-4 py-3" /></tr></thead>
            <tbody>{q.data.map(r => <tr key={r.id} className="border-t border-paper-line">
              {columns.map(c => { const f = fields.find(x => x.key === c)!; const v = label(f, r[c]); return <td key={c} className="max-w-xs truncate px-4 py-3">{c === 'status' ? <Badge tone={r[c] === 'published' ? 'good' : 'warn'}>{String(v)}</Badge> : String(v)}</td> })}
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button aria-label="Edit" className="rounded-lg p-2 hover:bg-paper-line" onClick={() => setEditing(r)}><Pencil size={16} /></button>
                <button aria-label="Delete" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => confirm('Delete this item permanently? Anything linked to it may be affected.') && del.mutate(r.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
      {editing && <Form table={table} title={title} fields={fields} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: [table] }) }} />}
    </div>
  )
}

function Form({ table, title, fields, initial, onClose, onSaved }: { table: string; title: string; fields: RField[]; initial: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<Record<string, any>>(() => Object.fromEntries(fields.map(f => [f.key, initial[f.key] ?? (f.type === 'checkbox' ? true : f.type === 'select' ? f.options?.[0]?.value ?? '' : '')])))
  const [errs, setErrs] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: async () => {
      const e: Record<string, string> = {}
      fields.forEach(f => { if (f.required && !String(v[f.key]).trim()) e[f.key] = 'Required' })
      setErrs(e); if (Object.keys(e).length) throw new Error('Please fill the required fields')
      const row = Object.fromEntries(fields.map(f => [f.key, typeof v[f.key] === 'string' ? (v[f.key].trim() === '' ? null : v[f.key].trim()) : v[f.key]]))
      const r = initial.id ? await supabase.from(table).update(row).eq('id', initial.id) : await supabase.from(table).insert(row)
      if (r.error) throw r.error
    }, onSuccess: () => { toast('ok', 'Saved'); onSaved() }, onError: (e: Error) => toast('err', e.message)
  })
  return (
    <Modal title={`${initial.id ? 'Edit' : 'New'} ${title.replace(/s$/, '').toLowerCase()}`} onClose={onClose}>
      <div className="space-y-4">{fields.map(f => <Field key={f.key} label={f.label + (f.required ? ' *' : '')} error={errs[f.key]}>
        {f.type === 'textarea' ? <Textarea value={v[f.key]} onChange={e => setV({ ...v, [f.key]: e.target.value })} />
          : f.type === 'select' ? <Select value={v[f.key] ?? ''} onChange={e => setV({ ...v, [f.key]: e.target.value })}>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          : f.type === 'checkbox' ? <input type="checkbox" checked={!!v[f.key]} onChange={e => setV({ ...v, [f.key]: e.target.checked })} />
          : <Input value={v[f.key]} onChange={e => setV({ ...v, [f.key]: e.target.value })} />}</Field>)}</div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>
    </Modal>
  )
}
