import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthContext'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner } from '../../components/ui'
import { useToast } from '../../components/Toast'

const schema = z.object({
  full_name: z.string().trim().min(2, 'Required'), institution: z.string().trim(), degree: z.string().trim(), branch: z.string().trim(),
  location: z.string().trim(), preferred_location: z.string().trim(),
  github_url: z.string().trim().url('Enter a full URL').or(z.literal('')), linkedin_url: z.string().trim().url('Enter a full URL').or(z.literal(''))
})

export default function Settings() {
  const { profile, session, refresh, signOut } = useAuth(); const toast = useToast(); const qc = useQueryClient()
  const [v, setV] = useState({
    full_name: profile?.full_name ?? '', institution: profile?.institution ?? '', degree: profile?.degree ?? '', branch: profile?.branch ?? '',
    location: profile?.location ?? '', preferred_location: profile?.preferred_location ?? '', github_url: profile?.github_url ?? '', linkedin_url: profile?.linkedin_url ?? '',
    work_mode: profile?.work_mode ?? 'any', daily_minutes: profile?.daily_minutes ?? 60, notifications_enabled: profile?.notifications_enabled ?? true
  })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const goals = useQuery({ queryKey: ['goals'], queryFn: async () => unwrap(await supabase.from('career_goals').select('id,name').order('name')) as any[] })
  const mine = useQuery({ queryKey: ['mygoals'], queryFn: async () => unwrap(await supabase.from('student_career_goals').select('career_goal_id').eq('student_id', session!.user.id)) as any[] })
  const [sel, setSel] = useState<string[] | null>(null)
  const chosen = sel ?? (mine.data ?? []).map(g => g.career_goal_id)

  const save = useMutation({
    mutationFn: async () => {
      const r = schema.safeParse(v)
      if (!r.success) { setErrs(Object.fromEntries(r.error.issues.map(i => [String(i.path[0]), i.message]))); throw new Error('Please fix the highlighted fields') }
      setErrs({})
      const u = await supabase.from('profiles').update({ ...r.data, github_url: r.data.github_url || null, linkedin_url: r.data.linkedin_url || null,
        work_mode: v.work_mode, daily_minutes: Number(v.daily_minutes), notifications_enabled: v.notifications_enabled }).eq('id', session!.user.id)
      if (u.error) throw u.error
      if (sel) {
        await supabase.from('student_career_goals').delete().eq('student_id', session!.user.id)
        if (sel.length) { const i = await supabase.from('student_career_goals').insert(sel.map((id, p) => ({ student_id: session!.user.id, career_goal_id: id, position: p }))); if (i.error) throw i.error
          await supabase.rpc('enroll_in_goal', { p_goal: sel[0], p_target_days: profile?.target_days, p_daily_minutes: Number(v.daily_minutes) }) }
      }
    },
    onSuccess: async () => { await refresh(); qc.invalidateQueries({ queryKey: ['journey'] }); qc.invalidateQueries({ queryKey: ['mygoals'] }); toast('ok', 'Saved') },
    onError: (e: Error) => toast('err', e.message)
  })
  const set = (k: string, val: any) => setV(s => ({ ...s, [k]: val }))
  const t = (k: keyof typeof v, label: string) => <Field label={label} error={errs[k]}><Input value={v[k] as string} onChange={e => set(k, e.target.value)} /></Field>

  if (goals.isLoading || mine.isLoading) return <Spinner />
  if (goals.error) return <ErrorBox error={goals.error} />
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile & settings" />
      <Card className="space-y-4">
        {t('full_name', 'Full name')}{t('institution', 'Institution')}
        <div className="grid gap-4 sm:grid-cols-2">{t('degree', 'Degree')}{t('branch', 'Branch')}{t('location', 'Location')}{t('preferred_location', 'Preferred work location')}</div>
        <div className="grid gap-4 sm:grid-cols-2">{t('github_url', 'GitHub')}{t('linkedin_url', 'LinkedIn')}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Work mode"><Select value={v.work_mode} onChange={e => set('work_mode', e.target.value)}><option value="any">No preference</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></Select></Field>
          <Field label="Daily learning time"><Select value={v.daily_minutes} onChange={e => set('daily_minutes', e.target.value)}>{[30, 60, 120, 180].map(m => <option key={m} value={m}>{m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`}</option>)}</Select></Field>
        </div>
        <div><p className="mb-2 text-sm font-semibold">Career interests (up to 3)</p><div className="flex flex-wrap gap-2">{(goals.data ?? []).map(g => { const on = chosen.includes(g.id)
          return <button key={g.id} type="button" aria-pressed={on} onClick={() => setSel(on ? chosen.filter((x: string) => x !== g.id) : chosen.length < 3 ? [...chosen, g.id] : chosen)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-paper-line bg-white'}`}>{g.name}</button> })}</div></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={v.notifications_enabled} onChange={e => set('notifications_enabled', e.target.checked)} />Notify me about learning, opportunities and deadlines</label>
        <div className="flex justify-between pt-2"><Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button><Button variant="ghost" onClick={signOut}>Log out</Button></div>
      </Card>
    </div>
  )
}
