import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useEffect } from 'react'
import { Loader2, Inbox, AlertTriangle, X } from 'lucide-react'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

export function Button({ variant = 'primary', loading, className, children, disabled, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; loading?: boolean }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    accent: 'bg-ember-500 text-white hover:bg-ember-600',
    secondary: 'bg-white border border-paper-line text-ink hover:bg-brand-50',
    ghost: 'text-ink-soft hover:bg-paper-line/60',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  }[variant]
  return (
    <button type="button" {...p} disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed', v, className)}>
      {loading && <Loader2 size={16} className="animate-spin" />}{children}
    </button>
  )
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}
const inputCls = 'w-full rounded-xl border border-paper-line bg-white px-3.5 py-2.5 text-sm placeholder:text-ink-mute focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, r) => <input ref={r} {...p} className={cx(inputCls, p.className)} />)
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, r) => <textarea ref={r} {...p} className={cx(inputCls, 'min-h-[100px]', p.className)} />)
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((p, r) => <select ref={r} {...p} className={cx(inputCls, p.className)} />)

export const Card = ({ children, className }: { children: ReactNode; className?: string }) =>
  <div className={cx('rounded-2xl border border-paper-line bg-paper-card p-5 shadow-soft', className)}>{children}</div>

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'info' }) => {
  const t = { neutral: 'bg-paper-line text-ink-soft', good: 'bg-brand-50 text-brand-700', warn: 'bg-ember-50 text-ember-600', info: 'bg-blue-50 text-blue-700' }[tone]
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>
}
export const statusTone = (s: string) => (s === 'published' ? 'good' : s === 'draft' ? 'warn' : 'neutral') as 'good' | 'warn' | 'neutral'

export const Spinner = ({ label = 'Loading…' }: { label?: string }) =>
  <div className="flex items-center justify-center gap-2 py-16 text-ink-mute" role="status"><Loader2 className="animate-spin" size={20} />{label}</div>

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-paper-line bg-white/60 px-6 py-14 text-center">
      <Inbox className="mb-3 text-ink-mute" size={28} />
      <h3 className="font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1"><p className="font-semibold">Something went wrong</p><p>{error instanceof Error ? error.message : String(error)}</p></div>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx('my-8 w-full rounded-2xl bg-paper p-6 shadow-soft', wide ? 'max-w-4xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-paper-line"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cx('h-2 w-full overflow-hidden rounded-full bg-paper-line', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
)

export const PageHeader = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>{sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}</div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
)
