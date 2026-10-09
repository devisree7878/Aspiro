import { NavLink, Outlet, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Home,
  Map,
  Target,
  Bell,
  Settings,
  LogOut,
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  Send,
  ScrollText,
  ShieldCheck,
  ClipboardCheck,
  Award,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import { supabase } from '../lib/supabase'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-ink-soft hover:bg-paper-line/70'
  }`

type NavItem = {
  to: string
  label: string
  icon: any
  end?: boolean
  badge?: number
}

function Shell({
  items,
  title,
  extra,
}: {
  items: NavItem[]
  title: string
  extra?: React.ReactNode
}) {
  const { signOut, profile } = useAuth()

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className="border-b border-paper-line bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <div>
            <div className="text-xl font-extrabold tracking-tight">
              ASPIRO
            </div>

            <div className="text-xs text-ink-mute">
              {title}
            </div>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg p-2 text-ink-soft hover:bg-paper-line lg:hidden"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label={`${title} navigation`}
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkCls}
            >
              <item.icon size={18} />

              <span className="whitespace-nowrap">
                {item.label}
              </span>

              {!!item.badge && (
                <span className="ml-auto rounded-full bg-ember-500 px-2 text-xs text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {extra}
        </nav>

        {/* Desktop user section */}
        <div className="mt-auto hidden p-4 lg:absolute lg:bottom-0 lg:block lg:w-64">
          <div className="mb-2 truncate text-xs text-ink-mute">
            {profile?.email}
          </div>

          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-line"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  )
}

/* =========================================================
   STUDENT LAYOUT
   ========================================================= */

export function StudentLayout() {
  const { isAdmin, session } = useAuth()

  const unread = useQuery({
    queryKey: ['unread', session?.user.id],

    queryFn: async () => {
      const { count } = await supabase
        .from('notification_recipients')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .is('read_at', null)

      return count ?? 0
    },

    refetchInterval: 60_000,
  })

  return (
    <Shell
      title="Student"
      items={[
        {
          to: '/',
          label: 'Home',
          icon: Home,
          end: true,
        },
        {
          to: '/journey',
          label: 'My Journey',
          icon: Map,
        },
        {
          to: '/skills',
          label: 'Skills',
          icon: Target,
        },
        {
          to: '/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unread.data,
        },
        {
          to: '/settings',
          label: 'Profile & Settings',
          icon: Settings,
        },
      ]}
      extra={
        isAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ember-600 hover:bg-ember-50"
          >
            <ShieldCheck size={18} />
            Admin
          </Link>
        ) : null
      }
    />
  )
}

/* =========================================================
   ADMIN LAYOUT
   ========================================================= */

export function AdminLayout() {
  return (
    <Shell
      title="Administrator"
      items={[
        {
          to: '/admin',
          label: 'Dashboard',
          icon: LayoutDashboard,
          end: true,
        },

        {
          to: '/admin/courses',
          label: 'Courses',
          icon: BookOpen,
        },

        {
          to: '/admin/catalog',
          label: 'Careers & Skills',
          icon: Layers,
        },

        {
          to: '/admin/students',
          label: 'Students',
          icon: Users,
        },

        {
          to: '/admin/submissions',
          label: 'Submissions',
          icon: ClipboardCheck,
        },

        {
          to: '/admin/notifications',
          label: 'Notifications',
          icon: Send,
        },

        {
          to: '/admin/audit',
          label: 'Audit log',
          icon: ScrollText,
        },
{
  to: '/certificates',
  label: 'Certificates',
  icon: Award,
},
        {
          to: '/',
          label: 'Student view',
          icon: Home,
        },
      ]}
    />
  )
}