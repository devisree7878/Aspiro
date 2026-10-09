
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Lock,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react'

import { useAuth } from '../../features/auth/AuthContext'
import { useJourney } from '../../features/learning/useJourney'
import { supabase, unwrap } from '../../lib/supabase'
import { typeDef } from '../../lib/activityTypes'
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Progress,
  Spinner,
} from '../../components/ui'
import { useToast } from '../../components/Toast'

function greeting() {
  const h = new Date().getHours()

  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* -------------------------------------------------------------------------- */
/* Progress Ring                                                              */
/* -------------------------------------------------------------------------- */

function ProgressRing({
  value,
  size = 150,
}: {
  value: number
  size?: number
}) {
  const radius = 58
  const circumference = 2 * Math.PI * radius

  const safeValue = Math.min(
    100,
    Math.max(0, value),
  )

  const offset =
    circumference -
    (safeValue / 100) * circumference

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        className="-rotate-90"
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-white/10"
        />

        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-ember-500 transition-all duration-1000 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white">
          {Math.round(safeValue)}%
        </span>

        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
          complete
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Target
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-paper-line bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-100 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={19} />
          </div>

          <TrendingUp
            size={16}
            className="text-emerald-500"
          />
        </div>

        <div className="text-2xl font-black tracking-tight text-ink">
          {value}
        </div>

        <div className="mt-1 text-sm font-semibold text-ink">
          {label}
        </div>

        <div className="mt-1 text-xs text-ink-soft">
          {detail}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Achievement Card                                                           */
/* -------------------------------------------------------------------------- */

function AchievementCard({
  title,
  description,
  unlocked,
  icon: Icon,
  progress,
}: {
  title: string
  description: string
  unlocked: boolean
  icon: typeof Trophy
  progress?: number
}) {
  return (
    <div
      className={[
        'group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
        unlocked
          ? 'border-brand-200 bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg'
          : 'border-paper-line bg-paper/50',
      ].join(' ')}
    >
      {unlocked && (
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand-100 blur-2xl" />
      )}

      <div className="relative flex items-start gap-4">
        <div
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            unlocked
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
              : 'bg-paper-line text-ink-mute',
          ].join(' ')}
        >
          {unlocked ? (
            <Icon size={22} />
          ) : (
            <Lock size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-ink">
              {title}
            </h3>

            {unlocked && (
              <Check
                size={16}
                className="shrink-0 text-emerald-500"
              />
            )}
          </div>

          <p className="mt-1 text-xs leading-5 text-ink-soft">
            {description}
          </p>

          {!unlocked &&
            typeof progress === 'number' && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-mute">
                  <span>Progress</span>
                  <span>
                    {Math.round(progress)}%
                  </span>
                </div>

                <Progress value={progress} />
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Job Opportunity Type                                                       */
/* -------------------------------------------------------------------------- */

type JobOpportunity = {
  id: string
  title: string
  location: string | null
  work_mode: string
  minimum_match_score: number
  match_score: number
  companies?: {
    name: string
  } | null
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const { profile, session } = useAuth()
  const q = useJourney()
  const toast = useToast()
  const qc = useQueryClient()

  const [opportunities, setOpportunities] =
    useState<JobOpportunity[]>([])

  const [opportunitiesLoading, setOpportunitiesLoading] =
    useState(false)

  const [visibleProgress, setVisibleProgress] =
    useState(0)

  const first =
    (profile?.full_name || '').split(' ')[0] ||
    'there'

  /* ------------------------------------------------------------------------ */
  /* Retry / Generate Journey                                                */
  /* ------------------------------------------------------------------------ */

  const retry = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) {
        throw new Error(
          'Please sign in again.',
        )
      }

      const g: any = unwrap(
        await supabase
          .from('student_career_goals')
          .select('career_goal_id')
          .eq(
            'student_id',
            session.user.id,
          )
          .order('position')
          .limit(1)
          .maybeSingle(),
      )

      if (!g) {
        throw new Error(
          'Choose a career goal in Settings first.',
        )
      }

      const r = await supabase.rpc(
        'enroll_in_goal',
        {
          p_goal: g.career_goal_id,
          p_target_days:
            profile?.target_days,
          p_daily_minutes:
            profile?.daily_minutes,
        },
      )

      if (r.error) {
        throw r.error
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['journey'],
      })

      toast(
        'ok',
        'Your journey is ready!',
      )
    },

    onError: (e: Error) => {
      toast('err', e.message)
    },
  })

  /* ------------------------------------------------------------------------ */
  /* Animated Progress                                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!q.data) return

    const target = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          q.data.overallPct,
        ),
      ),
    )

    setVisibleProgress(0)

    const timer =
      window.setTimeout(() => {
        setVisibleProgress(target)
      }, 150)

    return () =>
      window.clearTimeout(timer)
  }, [q.data?.overallPct])

  /* ------------------------------------------------------------------------ */
  /* Load Matched Opportunities                                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false

    const loadOpportunities =
      async () => {
        if (
          !session?.user?.id ||
          !q.data
        ) {
          return
        }

        const journeyProgress =
          Number(q.data.overallPct)

        /*
         * Opportunity matching becomes visible
         * after the learner reaches 90%.
         */
        if (journeyProgress < 90) {
          if (!cancelled) {
            setOpportunities([])
            setOpportunitiesLoading(false)
          }

          return
        }

        if (!cancelled) {
          setOpportunitiesLoading(true)
        }

        try {
          const {
            data,
            error,
          } = await supabase
            .from('company_job_matches')
            .select(`
              job_id,
              match_score,
              company_jobs!inner(
                id,
                title,
                location,
                work_mode,
                minimum_match_score,
                status,
                companies(
                  name
                )
              )
            `)
            .eq(
              'student_id',
              session.user.id,
            )
            .eq(
              'company_jobs.status',
              'published',
            )
            .order(
              'match_score',
              {
                ascending: false,
              },
            )
            .limit(6)

          if (error) {
            throw error
          }

          const rows = (data ?? [])
            .map((row: any) => {
              const job =
                row.company_jobs

              if (!job) {
                return null
              }

              const matchScore =
                Number(
                  row.match_score ?? 0,
                )

              const requiredScore =
                Number(
                  job.minimum_match_score ??
                    0,
                )

              /*
               * Only show jobs where the
               * student's match score meets
               * that job's own configured
               * threshold.
               */
              if (
                matchScore <
                requiredScore
              ) {
                return null
              }

              return {
                id: job.id,
                title: job.title,
                location:
                  job.location,
                work_mode:
                  job.work_mode,
                minimum_match_score:
                  requiredScore,
                match_score:
                  matchScore,
                companies:
                  Array.isArray(
                    job.companies,
                  )
                    ? job.companies[0] ??
                      null
                    : job.companies ??
                      null,
              }
            })
            .filter(
              Boolean,
            ) as JobOpportunity[]

          if (!cancelled) {
            setOpportunities(rows)
          }
        } catch {
          if (!cancelled) {
            setOpportunities([])
          }
        } finally {
          if (!cancelled) {
            setOpportunitiesLoading(
              false,
            )
          }
        }
      }

    void loadOpportunities()

    return () => {
      cancelled = true
    }
  }, [
    session?.user?.id,
    q.data?.overallPct,
  ])

  /* ------------------------------------------------------------------------ */
  /* Dashboard Stats                                                          */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    if (!q.data) {
      return {
        completedDays: 0,
        totalDays: 0,
        activities: 0,
      }
    }

    const completedDays =
      q.data.completeDays

    const totalDays =
      q.data.days.length

    const activities =
      q.data.days.reduce(
        (
          total: number,
          d: any,
        ) =>
          total +
          Number(d.done ?? 0),
        0,
      )

    return {
      completedDays,
      totalDays,
      activities,
    }
  }, [q.data])

  /* ------------------------------------------------------------------------ */
  /* Loading / Error                                                          */
  /* ------------------------------------------------------------------------ */

  if (q.isLoading) {
    return <Spinner />
  }

  if (q.error) {
    return (
      <ErrorBox
        error={q.error}
        onRetry={() => q.refetch()}
      />
    )
  }

  const j = q.data

  /* ------------------------------------------------------------------------ */
  /* No Journey                                                               */
  /* ------------------------------------------------------------------------ */

  if (!j) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
            <Sparkles size={13} />
            Career journey
          </div>

          <h1 className="text-3xl font-black tracking-tight text-ink">
            {greeting()}, {first} 👋
          </h1>

          <p className="mt-2 text-sm text-ink-soft">
            Your personalized career
            journey is waiting.
          </p>
        </div>

        <Empty
          title="Your journey isn't ready yet"
          body="No published learning path matches your career goal yet. Your administrator is preparing new learning paths — check again soon."
          action={
            <Button
              loading={
                retry.isPending
              }
              onClick={() =>
                retry.mutate()
              }
            >
              Check again
            </Button>
          }
        />
      </div>
    )
  }

  /* ------------------------------------------------------------------------ */
  /* Derived Dashboard Values                                                 */
  /* ------------------------------------------------------------------------ */

  const total = j.days.length
  const day = j.current

  const progress = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        j.overallPct,
      ),
    ),
  )

  const complete =
    progress >= 100

  const internshipReady =
    progress >= 90

  const achievements = [
    {
      title: 'First Step',
      description:
        'Complete your first learning day.',
      unlocked:
        stats.completedDays >= 1,
      icon: Star,
      progress:
        stats.completedDays >= 1
          ? 100
          : 0,
    },

    {
      title: 'Building Momentum',
      description:
        'Reach 25% of your career journey.',
      unlocked:
        progress >= 25,
      icon: Flame,
      progress,
    },

    {
      title: 'Skill Builder',
      description:
        'Reach 50% journey progress.',
      unlocked:
        progress >= 50,
      icon: Target,
      progress,
    },

    {
      title: 'Internship Ready',
      description:
        'Reach 90% progress and unlock opportunity matching.',
      unlocked:
        internshipReady,
      icon: Rocket,
      progress,
    },

    {
      title: 'Journey Complete',
      description:
        'Complete 100% of your published journey.',
      unlocked:
        complete,
      icon: Trophy,
      progress,
    },
  ]

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">

      {/* ================================================================== */}
      {/* HERO                                                               */}
      {/* ================================================================== */}

      <section className="relative overflow-hidden rounded-[2rem] bg-[#080D1C] px-6 py-8 text-white shadow-2xl shadow-brand-900/10 sm:px-8 lg:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />

        <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-ember-500/20 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={13} />
              ASPIRO Career Intelligence
            </div>

            <p className="text-sm font-semibold text-brand-300">
              {greeting()}, {first} 👋
            </p>

            <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Your career.
              <span className="block bg-gradient-to-r from-brand-300 via-white to-ember-300 bg-clip-text text-transparent">
                Your direction.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
              {j.enrollment
                .career_goals?.name ??
                j.enrollment.courses
                  ?.title}{' '}
              — one step at a time, with your progress turning into real career opportunities.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {day && (
                <Link
                  to={`/learn/${day.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-ember-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-ember-500/20 transition-all hover:-translate-y-0.5 hover:bg-ember-600"
                >
                  Continue journey
                  <ArrowRight
                    size={16}
                  />
                </Link>
              )}

              <Link
                to="/skills"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                View my skills
              </Link>
            </div>
          </div>

          <ProgressRing
            value={
              visibleProgress
            }
            size={170}
          />
        </div>
      </section>

      {/* ================================================================== */}
      {/* STATS                                                              */}
      {/* ================================================================== */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Journey progress"
          value={`${progress}%`}
          detail={`${stats.completedDays}/${stats.totalDays} days complete`}
        />

        <StatCard
          icon={CheckCircle2}
          label="Activities completed"
          value={String(
            stats.activities,
          )}
          detail="Learning activities finished"
        />

        <StatCard
          icon={Flame}
          label="Current momentum"
          value={
            progress >= 75
              ? 'Strong'
              : progress >= 40
                ? 'Growing'
                : 'Starting'
          }
          detail="Keep moving forward"
        />

        <StatCard
          icon={Rocket}
          label="Career readiness"
          value={
            complete
              ? 'Complete'
              : internshipReady
                ? '90%+'
                : `${progress}%`
          }
          detail={
            complete
              ? 'Certificate unlocked'
              : internshipReady
                ? 'Opportunity matching unlocked'
                : 'Keep learning'
          }
        />
      </section>

      {/* ================================================================== */}
      {/* TODAY'S MISSION + PROGRESS                                        */}
      {/* ================================================================== */}

      <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        {day ? (
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand-950 via-brand-900 to-[#111827] text-paper shadow-xl">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />

            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ember-400">
                  <Target size={14} />
                  Today's mission
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                  Day {day.index + 1}{' '}
                  of {total}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-black sm:text-3xl">
                {day.title}
              </h2>

              {day.description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  {day.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/70">
                <span className="inline-flex items-center gap-2">
                  <Clock size={16} />

                  {day.estimated_minutes ||
                    day.activities.reduce(
                      (
                        s,
                        a,
                      ) =>
                        s +
                        a.estimated_minutes,
                      0,
                    )}{' '}
                  minutes
                </span>

                <span>
                  {day.done}/
                  {day.total}{' '}
                  activities done
                </span>
              </div>

              <Link
                to={`/learn/${day.id}`}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ember-500 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-ember-600"
              >
                {day.done
                  ? "Continue today's mission"
                  : "Start today's mission"}

                <ArrowRight
                  size={16}
                />
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="border-0 bg-gradient-to-br from-emerald-950 to-brand-950 text-white shadow-xl">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                  <Trophy size={25} />
                </div>

                <h2 className="mt-5 text-2xl font-black">
                  Journey complete 🎉
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  You've finished every
                  published day of this
                  course. Your next chapter
                  is now about turning your
                  skills into opportunities.
                </p>
              </div>

              <Link
                to="/certificates"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-950 hover:bg-white/90"
              >
                Open certificates
                <ArrowRight
                  size={16}
                />
              </Link>
            </div>
          </Card>
        )}

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-600">
                  Journey progress
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Your momentum
                </h2>
              </div>

              <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-black text-brand-700">
                {progress}%
              </div>
            </div>

            <div className="mt-6">
              <Progress
                value={
                  visibleProgress
                }
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-ink-soft">
              <span>
                {stats.completedDays}{' '}
                days complete
              </span>

              <span>
                {Math.max(
                  0,
                  total -
                    stats.completedDays,
                )}{' '}
                remaining
              </span>
            </div>
          </div>

          {j.days[
            (day?.index ??
              total) + 1
          ] && (
            <div className="mt-6 rounded-2xl bg-paper p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-ink-mute">
                Up next
              </p>

              <p className="mt-1 text-sm font-bold text-ink">
                {
                  j.days[
                    day!.index + 1
                  ].title
                }
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* ================================================================== */}
      {/* ACHIEVEMENTS                                                       */}
      {/* ================================================================== */}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
              Milestones
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
              Achievements
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              Every milestone moves you
              closer to your next
              opportunity.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-xs font-bold text-ink-soft sm:flex">
            <Award
              size={16}
              className="text-ember-500"
            />

            {
              achievements.filter(
                a => a.unlocked,
              ).length
            }
            /
            {achievements.length}{' '}
            unlocked
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {achievements.map(
            achievement => (
              <AchievementCard
                key={
                  achievement.title
                }
                {...achievement}
              />
            ),
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* CERTIFICATE + OPPORTUNITIES                                      */}
      {/* ================================================================== */}

      <section className="grid gap-6 lg:grid-cols-2">
        {/* CERTIFICATE */}

        <div
          className={[
            'relative overflow-hidden rounded-3xl border p-6 transition-all duration-300',
            complete
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
              : 'border-paper-line bg-white',
          ].join(' ')}
        >
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-100 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Award size={24} />
              </div>

              {complete ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  UNLOCKED
                </span>
              ) : (
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-black text-ink-mute">
                  {progress}% / 100%
                </span>
              )}
            </div>

            <h2 className="mt-5 text-xl font-black text-ink">
              Course completion
              certificate
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {complete
                ? 'Your journey is complete. Your certificate is ready to view and download.'
                : `Complete the remaining ${Math.max(
                    0,
                    100 - progress,
                  )}% of your journey to unlock your certificate.`}
            </p>

            <Link
              to="/certificates"
              className={[
                'mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all',
                complete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-paper-line text-ink-mute',
              ].join(' ')}
            >
              {complete
                ? 'View & download certificate'
                : 'Certificate locked'}

              {complete ? (
                <ArrowRight
                  size={16}
                />
              ) : (
                <Lock size={15} />
              )}
            </Link>
          </div>
        </div>

        {/* OPPORTUNITY READINESS */}

        <div
          className={[
            'relative overflow-hidden rounded-3xl border p-6 transition-all duration-300',
            internshipReady
              ? 'border-brand-200 bg-gradient-to-br from-brand-50 via-white to-ember-50'
              : 'border-paper-line bg-white',
          ].join(' ')}
        >
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand-100 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <BriefcaseBusiness
                  size={24}
                />
              </div>

              {internshipReady ? (
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-black text-brand-700">
                  READY
                </span>
              ) : (
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-black text-ink-mute">
                  {Math.max(
                    0,
                    90 - progress,
                  )}
                  % to go
                </span>
              )}
            </div>

            <h2 className="mt-5 text-xl font-black text-ink">
              Internship opportunities
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {internshipReady
                ? 'You have crossed the 90% readiness milestone. ASPIRO can now show opportunities matched to your profile and skills.'
                : 'Reach 90% journey progress to unlock your internship opportunity matching.'}
            </p>

            {internshipReady && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">
                <Rocket size={16} />
                Opportunity matching
                unlocked
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* MATCHED OPPORTUNITIES                                             */}
      {/* ================================================================== */}

      {internshipReady && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
                Career opportunities
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
                Matched opportunities
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                Opportunities that meet their
                configured eligibility and your
                current match score.
              </p>
            </div>
          </div>

          {opportunitiesLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            </Card>
          ) : opportunities.length ===
            0 ? (
            <Card className="border-dashed">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BriefcaseBusiness
                  size={30}
                  className="text-ink-mute"
                />

                <h3 className="mt-3 font-bold text-ink">
                  No matched
                  opportunities yet
                </h3>

                <p className="mt-1 max-w-md text-sm text-ink-soft">
                  Your 90% readiness
                  milestone is unlocked.
                  New opportunities will
                  appear when an administrator
                  publishes a job that matches
                  your profile.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {opportunities.map(
                job => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="group rounded-2xl border border-paper-line bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                          {job.companies
                            ?.name ??
                            'Company'}
                        </p>

                        <h3 className="mt-1 text-lg font-black text-ink">
                          {job.title}
                        </h3>

                        <p className="mt-2 text-xs text-ink-soft">
                          {job.location ||
                            'Location flexible'}
                          {' · '}
                          {job.work_mode}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-2xl bg-emerald-50 px-3 py-2 text-center">
                        <div className="text-lg font-black text-emerald-600">
                          {Math.round(
                            job.match_score,
                          )}
                          %
                        </div>

                        <div className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                          match
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-paper-line pt-4">
                      <span className="text-xs font-semibold text-ink-soft">
                        Required:{' '}
                        {Math.round(
                          job.minimum_match_score,
                        )}
                        %
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 transition-transform group-hover:translate-x-1">
                        View opportunity
                        <ArrowRight
                          size={14}
                        />
                      </span>
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>
      )}

      {/* ================================================================== */}
      {/* TODAY'S ACTIVITIES                                                */}
      {/* ================================================================== */}

      {day && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
              Today's learning
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
              Mission activities
            </h2>
          </div>

          <ol className="space-y-3">
            {day.activities.map(
              (a, i) => {
                const t =
                  typeDef(a.type)

                const done =
                  j.done.has(a.id)

                return (
                  <li key={a.id}>
                    <Link
                      to={`/learn/${day.id}?a=${a.id}`}
                      className={[
                        'group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300',
                        done
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-paper-line hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg',
                      ].join(' ')}
                    >
                      <span className="w-7 text-sm font-black text-ink-mute">
                        {String(
                          i + 1,
                        ).padStart(
                          2,
                          '0',
                        )}
                      </span>

                      <div
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          done
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-brand-50 text-brand-600',
                        ].join(' ')}
                      >
                        <t.icon
                          size={19}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-ink-mute">
                          {t.verb}
                          {!a.is_required &&
                            ' · optional'}
                        </div>

                        <div className="mt-0.5 truncate font-bold text-ink">
                          {a.title}
                        </div>
                      </div>

                      <span className="hidden text-xs font-semibold text-ink-mute sm:block">
                        {
                          a.estimated_minutes
                        }{' '}
                        min
                      </span>

                      {done ? (
                        <CheckCircle2
                          className="shrink-0 text-emerald-500"
                          size={21}
                        />
                      ) : (
                        <Circle
                          className="shrink-0 text-paper-line transition-colors group-hover:text-brand-400"
                          size={21}
                        />
                      )}
                    </Link>
                  </li>
                )
              },
            )}
          </ol>
        </section>
      )}

      {/* ================================================================== */}
      {/* FINAL MOTIVATION                                                  */}
      {/* ================================================================== */}

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-brand-600 to-ember-500 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-white/5 [clip-path:polygon(35%_0,100%_0,100%_100%,0_100%)]" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white/80">
              <Sparkles size={16} />
              Keep moving
            </div>

            <h2 className="mt-2 text-2xl font-black">
              Learn with purpose. Grow
              with direction.
            </h2>

            <p className="mt-1 text-sm text-white/70">
              Every completed activity is
              another step toward your
              career.
            </p>
          </div>

          {day && (
            <Link
              to={`/learn/${day.id}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-brand-700 transition-transform hover:-translate-y-0.5"
            >
              Continue
              <ArrowRight
                size={16}
              />
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}