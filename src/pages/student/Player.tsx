
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  HelpCircle,
  Rocket,
} from 'lucide-react'

import { supabase, unwrap } from '../../lib/supabase'
import { useJourney } from '../../features/learning/useJourney'

type Activity = {
  id: string
  type: string
  title: string
  order_index: number
  is_required: boolean
  estimated_minutes: number
  status?: string | null
  content?: string | null
  description?: string | null
}

function activityIcon(type: string) {
  const value = type.toLowerCase()

  if (
    value.includes('reading') ||
    value.includes('read') ||
    value.includes('lesson')
  ) {
    return BookOpen
  }

  if (
    value.includes('practice') ||
    value.includes('code') ||
    value.includes('coding')
  ) {
    return Code2
  }

  if (
    value.includes('check') ||
    value.includes('quiz') ||
    value.includes('test')
  ) {
    return HelpCircle
  }

  if (
    value.includes('challenge') ||
    value.includes('project')
  ) {
    return Rocket
  }

  return Circle
}

function activityLabel(type: string) {
  const value = type.toLowerCase()

  if (value.includes('reading') || value.includes('read') || value.includes('lesson')) {
    return 'Reading'
  }

  if (value.includes('practice') || value.includes('code') || value.includes('coding')) {
    return 'Practice'
  }

  if (value.includes('check') || value.includes('quiz') || value.includes('test')) {
    return 'Check'
  }

  if (value.includes('challenge') || value.includes('project')) {
    return 'Challenge'
  }

  return 'Activity'
}

function renderContent(content: string) {
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-8 text-ink-soft">
      {content}
    </div>
  )
}

export default function Player() {
  const { dayId } = useParams<{ dayId: string }>()
  const journey = useJourney()

  const [selectedActivityId, setSelectedActivityId] =
    useState<string | null>(null)

  const [activitiesWithContent, setActivitiesWithContent] =
    useState<Record<string, Activity>>({})

  const [loadingContent, setLoadingContent] = useState(false)

  const day = useMemo(() => {
    return journey.data?.days.find(
      item => item.id === dayId
    )
  }, [journey.data, dayId])

  const activities = useMemo(() => {
    return [...(day?.activities ?? [])].sort(
      (a, b) =>
        Number(a.order_index ?? 0) -
        Number(b.order_index ?? 0)
    )
  }, [day])

  const selectedActivity = selectedActivityId
    ? activitiesWithContent[selectedActivityId] ??
      activities.find(
        activity => activity.id === selectedActivityId
      )
    : null

  /*
   * Reset the selected activity when the student
   * opens another day.
   */
  useEffect(() => {
    setSelectedActivityId(null)
    setActivitiesWithContent({})
  }, [dayId])

  /*
   * Load ONLY the selected activity.
   *
   * Nothing is loaded/displayed until the student
   * clicks an activity.
   */
  async function openActivity(activity: Activity) {
    setSelectedActivityId(activity.id)

    /*
     * If content has already been loaded, don't request it again.
     */
    if (activitiesWithContent[activity.id]) {
      return
    }

    setLoadingContent(true)

    try {
      /*
       * The activity itself is admin-created.
       * We only read its stored content.
       *
       * If your activities table uses another column
       * for the content, change only this select.
       */
      const result = await supabase
        .from('activities')
        .select(`
          id,
          type,
          title,
          order_index,
          is_required,
          estimated_minutes,
          description,
          content
        `)
        .eq('id', activity.id)
        .single()

      if (result.error) {
        throw result.error
      }

      const data = unwrap(result) as Activity

      setActivitiesWithContent(prev => ({
        ...prev,
        [activity.id]: data,
      }))
    } catch (error) {
      console.error('Failed to load activity:', error)

      /*
       * Keep the activity visible even if there is
       * no separate content column.
       */
      setActivitiesWithContent(prev => ({
        ...prev,
        [activity.id]: activity,
      }))
    } finally {
      setLoadingContent(false)
    }
  }

  function backToActivities() {
    setSelectedActivityId(null)
  }

  if (journey.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm font-semibold text-ink-mute">
          Loading lesson...
        </div>
      </div>
    )
  }

  if (journey.error) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load this day.
        </div>
      </div>
    )
  }

  if (!day) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="rounded-2xl border border-paper-line bg-white p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink">
            Day not found
          </h1>

          <Link
            to="/journey"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
          >
            <ArrowLeft size={16} />
            Back to journey
          </Link>
        </div>
      </div>
    )
  }

  const progress = Math.round(day.pct)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">

      {/* TOP BAR */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/journey"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-mute transition hover:text-ink"
        >
          <ArrowLeft size={16} />
          Home / Day {day.day_number}
        </Link>

        {/* SMALL TOP-RIGHT PROGRESS */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">
            Progress
          </span>

          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-paper-line">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="text-sm font-extrabold text-ink">
            {progress}%
          </span>
        </div>
      </div>

      {/* DAY HEADER + ACTIVITIES */}
      {!selectedActivity && (
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">

          {/* DAY INFORMATION */}
          <div>
            <div className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-600">
              DAY {day.day_number}
            </div>

            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {day.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-mute">
              <span>Today</span>
              <span>·</span>
              <span>
                {activities.length}{' '}
                {activities.length === 1
                  ? 'activity'
                  : 'activities'}
              </span>
              <span>·</span>
              <span>
                ~{day.estimated_minutes || 0} min
              </span>
            </div>

            {day.description && (
              <p className="mt-6 max-w-2xl text-base leading-7 text-ink-soft">
                {day.description}
              </p>
            )}
          </div>

          {/* ACTIVITIES */}
          <div>
            <div className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-mute">
              Activities
            </div>

            <div className="space-y-2">
              {activities.map((activity, index) => {
                const Icon = activityIcon(activity.type)

                const completed =
                  activity.status === 'completed'

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => openActivity(activity)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-paper-line bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        completed
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-paper text-ink-mute group-hover:bg-brand-50 group-hover:text-brand-600'
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Icon size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                        {activityLabel(activity.type)}
                      </div>

                      <div className="truncate text-sm font-bold text-ink">
                        {activity.title}
                      </div>

                      {activity.estimated_minutes > 0 && (
                        <div className="mt-0.5 text-xs text-ink-mute">
                          {activity.estimated_minutes} min
                        </div>
                      )}
                    </div>

                    <ArrowRight
                      size={16}
                      className="shrink-0 text-ink-mute transition group-hover:translate-x-1 group-hover:text-brand-600"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* SELECTED ACTIVITY CONTENT */}
      {selectedActivity && (
        <div className="animate-in fade-in duration-200">

          {/* BACK BUTTON */}
          <button
            type="button"
            onClick={backToActivities}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-paper-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
          >
            <ArrowLeft size={16} />
            Back to activities
          </button>

          {/* ACTIVITY CONTENT */}
          <article className="rounded-3xl border border-paper-line bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10 lg:px-14">

            {/* ACTIVITY TYPE */}
            <div className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-600">
              {(() => {
                const Icon = activityIcon(
                  selectedActivity.type
                )

                return <Icon size={16} />
              })()}

              {activityLabel(selectedActivity.type)}
            </div>

            {/* TITLE */}
            <h2 className="max-w-4xl text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {selectedActivity.title}
            </h2>

            {/* TIME */}
            {selectedActivity.estimated_minutes > 0 && (
              <div className="mt-3 text-sm font-semibold text-ink-mute">
                Learn · {selectedActivity.estimated_minutes} min
              </div>
            )}

            <div className="my-8 h-px bg-paper-line" />

            {/* CONTENT */}
            {loadingContent ? (
              <div className="py-16 text-center">
                <div className="text-sm font-semibold text-ink-mute">
                  Loading activity...
                </div>
              </div>
            ) : selectedActivity.content ? (
              renderContent(selectedActivity.content)
            ) : selectedActivity.description ? (
              renderContent(selectedActivity.description)
            ) : (
              <div className="rounded-2xl border border-dashed border-paper-line bg-paper/40 p-8 text-center">
                <p className="text-sm font-semibold text-ink-mute">
                  This activity does not have content yet.
                </p>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  )
}
