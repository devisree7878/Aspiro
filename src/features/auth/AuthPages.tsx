import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Button, Field, Input } from '../../components/ui'
import { useAuth } from './AuthContext'

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-12 text-paper lg:flex">
        <div className="text-2xl font-extrabold tracking-tight">ASPIRO</div>
        <div>
          <p className="text-4xl font-extrabold leading-tight">Don't browse courses.<br />Take a career mission.</p>
          <p className="mt-4 max-w-md text-paper/70">Tell us the career you want. ASPIRO builds your journey, tells you what to do today, and proves your skills with evidence.</p>
        </div>
        <div className="text-sm text-paper/50">From Learning to Career</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-xl font-extrabold lg:hidden">ASPIRO</div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-ink-soft">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

const emailS = z.string().trim().email('Enter a valid email')
const passS = z.string().min(8, 'At least 8 characters')

function useForm<S extends z.ZodTypeAny>(schema: S, run: (v: z.infer<S>) => Promise<string | void>) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setInfo('')
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries())
    const r = schema.safeParse(raw)
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map(i => [String(i.path[0]), i.message]))); return }
    setErrors({}); setBusy(true)
    try { const m = await run(r.data); if (m) setInfo(m) } catch (err) { setFormError(err instanceof Error ? err.message : 'Something went wrong') } finally { setBusy(false) }
  }
  return { errors, formError, info, busy, submit }
}
const Msg = ({ e, i }: { e: string; i: string }) => <>
  {e && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{e}</p>}
  {i && <p role="status" className="mb-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{i}</p>}</>

export function Login() {
  const { session } = useAuth(); const nav = useNavigate()
  const f = useForm(z.object({ email: emailS, password: z.string().min(1, 'Enter your password') }), async v => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) throw error
    nav('/')
  })
  if (session) return <Navigate to="/" replace />
  return (
    <Shell title="Welcome back" sub="Log in to continue your journey.">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Msg e={f.formError} i={f.info} />
        <Field label="Email" error={f.errors.email}><Input name="email" type="email" autoComplete="email" /></Field>
        <Field label="Password" error={f.errors.password}><Input name="password" type="password" autoComplete="current-password" /></Field>
        <Button type="submit" loading={f.busy} className="w-full">Log in</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm"><Link className="text-brand-600" to="/forgot">Forgot password?</Link><Link className="text-brand-600" to="/signup">Create account</Link></div>
    </Shell>
  )
}

export function Signup() {
  const { session } = useAuth()
  const f = useForm(z.object({ full_name: z.string().trim().min(2, 'Enter your name'), email: emailS, password: passS }), async v => {
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.full_name }, emailRedirectTo: window.location.origin } })
    if (error) throw error
    if (!data.session) return 'Check your inbox and confirm your email to finish creating your account.'
  })
  if (session) return <Navigate to="/" replace />
  return (
    <Shell title="Start your journey" sub="Create your student account.">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Msg e={f.formError} i={f.info} />
        <Field label="Full name" error={f.errors.full_name}><Input name="full_name" autoComplete="name" /></Field>
        <Field label="Email" error={f.errors.email}><Input name="email" type="email" autoComplete="email" /></Field>
        <Field label="Password" error={f.errors.password}><Input name="password" type="password" autoComplete="new-password" /></Field>
        <Button type="submit" loading={f.busy} className="w-full">Create account</Button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link className="text-brand-600" to="/login">Log in</Link></p>
    </Shell>
  )
}

export function Forgot() {
  const f = useForm(z.object({ email: emailS }), async v => {
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/reset` })
    if (error) throw error
    return 'If that email has an account, a reset link is on its way.'
  })
  return (
    <Shell title="Reset your password" sub="We'll email you a secure link.">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Msg e={f.formError} i={f.info} />
        <Field label="Email" error={f.errors.email}><Input name="email" type="email" /></Field>
        <Button type="submit" loading={f.busy} className="w-full">Send reset link</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-brand-600" to="/login">Back to log in</Link></p>
    </Shell>
  )
}

export function Reset() {
  const nav = useNavigate()
  const f = useForm(z.object({ password: passS }), async v => {
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) throw error
    nav('/')
  })
  return (
    <Shell title="Choose a new password" sub="Open this page from the link in your email.">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Msg e={f.formError} i={f.info} />
        <Field label="New password" error={f.errors.password}><Input name="password" type="password" autoComplete="new-password" /></Field>
        <Button type="submit" loading={f.busy} className="w-full">Update password</Button>
      </form>
    </Shell>
  )
}
