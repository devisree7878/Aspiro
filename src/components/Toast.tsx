import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

type T = { id: number; kind: 'ok' | 'err'; msg: string }
const Ctx = createContext<(kind: 'ok' | 'err', msg: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((kind: 'ok' | 'err', msg: string) => {
    const id = Date.now() + Math.random()
    setItems(s => [...s, { id, kind, msg }])
    setTimeout(() => setItems(s => s.filter(i => i.id !== id)), kind === 'err' ? 6000 : 3000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {items.map(i => (
          <div key={i.id} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-soft max-w-sm text-white ${i.kind === 'ok' ? 'bg-brand-700' : 'bg-red-600'}`}>
            {i.kind === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<span>{i.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
