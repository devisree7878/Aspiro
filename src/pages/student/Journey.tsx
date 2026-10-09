
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  RotateCcw,
  Settings2,
} from 'lucide-react'
import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { useJourney } from '../../features/learning/useJourney'
import { supabase } from '../../lib/supabase'

import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Progress,
  Select,
  Spinner,
} from '../../components/ui'

import { useToast } from '../../components/Toast'

const DAY_OPTIONS = [30, 60, 90, 180, 365]

const TIME_OPTIONS = [30, 60, 120, 180, 240]

export default function Journey() {
  const q = useJourney()
  const qc = useQueryClient()
  const toast = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  const [days, setDays] = useState(90)
  const [minutes, setMinutes] = useState(60)
  const [recoveryDays, setRecoveryDays] = useState(2)

  /*
   * UPDATE JOURNEY PREFERENCES
   */
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc(
        'update_my_journey_preferences',
        {
          p_target_days: Number(days),
          p_daily_minutes: Number(minutes),
        }
      )

      if (error) {
        throw error
      }
    },

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['journey'],
      })

      await qc.invalidateQueries({
        queryKey: ['auth-profile'],
      })

      setEditOpen(false)

      toast(
        'ok',
        'Your journey has been adjusted to your new schedule.'
      )
    },

    onError: (error: Error) => {
      toast('err', error.message)
    },
  })

  /*
   * START RECOVERY MODE
   */
  const recover = useMutation({
    mutationFn: async () => {
      if (!q.data?.missedDay) {
        throw new Error(
          'No missed day is ready for recovery.'
        )
      }

      const { error } = await supabase.rpc(
        'start_journey_recovery',
        {
          p_missed_day:
            q.data.missedDay.day_number,

          p_recovery_days:
            Number(recoveryDays),
        }
      )

      if (error) {
        throw error
      }
    },

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['journey'],
      })

      setRecoveryOpen(false)

      toast(
        'ok',
        `Recovery added across the next ${recoveryDays} days.`
      )
    },

    onError: (error: Error) => {
      toast('err', error.message)
    },
  })

  /*
   * LOADING
   */
  if (q.isLoading) {
    return <Spinner />
  }

  /*
   * ERROR
   */
  if (q.error) {
    return (
      <ErrorBox
        error={q.error}
        onRetry={() => q.refetch()}
      />
    )
  }

  const j = q.data

  /*
   * NO JOURNEY
   */
  if (!j) {
    return (
      <Empty
        title="No journey yet"
        body="Once a learning path is published for your career goal, your roadmap appears here."
      />
    )
  }

  /*
   * CURRENT PERSONAL SETTINGS
   */
  const currentDays = Number(
    j.enrollment.target_days ?? j.days.length
  )

  const currentMinutes = Number(
    j.enrollment.daily_minutes ?? 60
  )

  const readyDays = DAY_OPTIONS.includes(currentDays)
    ? currentDays
    : 90

  const readyMinutes = TIME_OPTIONS.includes(
    currentMinutes
  )
    ? currentMinutes
    : 60

  const openEdit = () => {
    setDays(readyDays)
    setMinutes(readyMinutes)
    setEditOpen(true)
  }

  const timeLabel = (m: number) =>
    m < 60
      ? `${m} min/day`
      : `${m / 60} hr${m > 60 ? 's' : ''}/day`

  return (
    <div className="mx-auto max-w-4xl">

      {/* HEADER */}

      <PageHeader
        title={
          j.enrollment.courses?.title ??
          'My Journey'
        }
        sub={
          j.enrollment.courses?.description ??
          'A learning plan adapted to your time and pace.'
        }
        actions={
          <Button
            variant="secondary"
            onClick={openEdit}
          >
            <Settings2 size={16} />
            Edit Journey
          </Button>
        }
      />

      {/* PERSONAL PACE */}

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-mute">
              Your learning pace
            </p>

            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">

              <span>
                {currentDays} days
              </span>

              <span>
                {timeLabel(currentMinutes)}
              </span>

              <span>
                {j.days.length} personalized days
              </span>

            </div>
          </div>

          <div className="min-w-[180px] text-right">

            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span>Overall</span>

              <span>
                {j.completeDays}/{j.days.length} days
              </span>
            </div>

            <Progress value={j.overallPct} />

          </div>
        </div>
      </Card>

      {/* RECOVERY MODE */}

      {j.missedDay &&
        !j.missedDay.recovery_of_day && (
          <Card className="mb-6 border-ember-200 bg-ember-50/50">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2 font-bold text-ink">

                  <RotateCcw
                    size={17}
                    className="text-ember-500"
                  />

                  Recovery Mode

                </div>

                <p className="mt-1 text-sm text-ink-soft">
                  You missed Day{' '}
                  {j.missedDay.day_number}.
                  {' '}
                  Recover its tasks across the next
                  2, 3, or 4 days.
                </p>

              </div>

              <Button
                variant="accent"
                onClick={() =>
                  setRecoveryOpen(true)
                }
              >
                Recover Day{' '}
                {j.missedDay.day_number}
              </Button>

            </div>

          </Card>
        )}

      {/* PHASES */}

      {j.phases.map((p, pi) => {

        const phaseDays = j.days.filter(
          d => d.phase_id === p.id
        )

        if (!phaseDays.length) {
          return null
        }

        const pct =
          phaseDays.reduce(
            (sum, d) => sum + d.pct,
            0
          ) / phaseDays.length

        return (
          <section
            key={p.id}
            className="mb-8"
          >

            {/* PHASE HEADER */}

            <div className="mb-3 flex items-end justify-between gap-4">

              <div>

                <div className="text-xs font-bold uppercase text-ink-mute">
                  Phase {pi + 1}
                </div>

                <h2 className="text-xl font-extrabold">
                  {p.title}
                </h2>

                {p.description && (
                  <p className="mt-1 text-sm text-ink-soft">
                    {p.description}
                  </p>
                )}

              </div>

              <span className="text-sm font-semibold text-ink-soft">
                {Math.round(pct)}%
              </span>

            </div>

            {/* DAYS */}

            <ul className="space-y-2">

              {phaseDays.map(d => {

                const cur =
                  j.current?.id === d.id

                const activityMinutes =
                  d.activities.reduce(
                    (sum, activity) =>
                      sum +
                      Number(
                        activity.estimated_minutes || 0
                      ),
                    0
                  )

                const totalMinutes =
                  Number(
                    d.estimated_minutes ||
                      activityMinutes
                  )

                return (
                  <li key={d.id}>

                    <Link
                      to={`/learn/${d.id}`}
                      className={`
                        flex items-center gap-4
                        rounded-2xl border
                        bg-white p-4
                        transition
                        hover:border-brand-500
                        ${
                          cur
                            ? 'border-brand-500 ring-2 ring-brand-100'
                            : 'border-paper-line'
                        }
                      `}
                    >

                      {/* STATUS */}

                      {d.complete ? (
                        <CheckCircle2
                          className="shrink-0 text-brand-600"
                        />
                      ) : cur ? (
                        <PlayCircle
                          className="shrink-0 text-ember-500"
                        />
                      ) : (
                        <Circle
                          className="shrink-0 text-paper-line"
                        />
                      )}

                      {/* DAY INFORMATION */}

                      <div className="min-w-0 flex-1">

                        <div className="text-xs text-ink-mute">
                          Day {d.day_number}
                        </div>

                        <div className="truncate font-semibold">
                          {d.title}
                        </div>

                        {d.recovery_of_day && (
                          <div className="mt-0.5 text-xs font-semibold text-ember-600">
                            Recovery from Day{' '}
                            {d.recovery_of_day}
                          </div>
                        )}

                      </div>

                      {/* PROGRESS / TIME */}

                      <div className="w-28 shrink-0 text-right text-xs text-ink-mute">

                        <div>
                          {d.done}/{d.total}
                        </div>

                        <div>
                          {totalMinutes}m
                        </div>

                      </div>

                    </Link>

                  </li>
                )
              })}

            </ul>

          </section>
        )
      })}

      {/* EDIT JOURNEY MODAL */}

      {editOpen && (
        <Modal
          title="Adjust your learning journey"
          onClose={() =>
            !save.isPending &&
            setEditOpen(false)
          }
        >

          <div className="space-y-5">

            <p className="text-sm text-ink-soft">
              Your course content stays the same.
              ASPIRO rebuilds your personal schedule
              around the time you can actually give.
            </p>

            {/* DAYS */}

            <Field label="How many days can you give?">

              <Select
                value={days}
                onChange={e =>
                  setDays(
                    Number(e.target.value)
                  )
                }
              >

                {DAY_OPTIONS.map(d => (
                  <option
                    key={d}
                    value={d}
                  >
                    {d} days
                  </option>
                ))}

              </Select>

            </Field>

            {/* DAILY TIME */}

            <Field
              label="How much time can you study each day?"
            >

              <Select
                value={minutes}
                onChange={e =>
                  setMinutes(
                    Number(e.target.value)
                  )
                }
              >

                {TIME_OPTIONS.map(m => (
                  <option
                    key={m}
                    value={m}
                  >
                    {timeLabel(m)}
                  </option>
                ))}

              </Select>

            </Field>

            {/* EXPLANATION */}

            <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">

              <strong>Personalized pacing</strong>

              <p className="mt-1">
                A professional with 1 hour/day
                gets a lighter pace, while a student
                with 3 hours/day can move through
                the same goal more intensively.
              </p>

            </div>

            {/* ACTIONS */}

            <div className="flex justify-end gap-2">

              <Button
                variant="secondary"
                disabled={save.isPending}
                onClick={() =>
                  setEditOpen(false)
                }
              >
                Cancel
              </Button>

              <Button
                loading={save.isPending}
                onClick={() =>
                  save.mutate()
                }
              >
                Update Journey
              </Button>

            </div>

          </div>

        </Modal>
      )}

      {/* RECOVERY MODAL */}

      {recoveryOpen &&
        j.missedDay && (
          <Modal
            title={`Recover Day ${j.missedDay.day_number}`}
            onClose={() =>
              !recover.isPending &&
              setRecoveryOpen(false)
            }
          >

            <div className="space-y-5">

              {/* INFORMATION */}

              <div className="rounded-xl bg-ember-50 p-4 text-sm text-ink-soft">

                Your missed Day{' '}
                {j.missedDay.day_number}
                {' '}
                tasks will be added in order
                to the next recovery days.
                Your normal journey then continues.

              </div>

              {/* RECOVERY DAYS */}

              <Field label="Recover over">

                <Select
                  value={recoveryDays}
                  onChange={e =>
                    setRecoveryDays(
                      Number(e.target.value)
                    )
                  }
                >

                  {[2, 3, 4].map(d => (
                    <option
                      key={d}
                      value={d}
                    >
                      {d} days
                    </option>
                  ))}

                </Select>

              </Field>

              {/* RECOVERY PREVIEW */}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                {Array.from(
                  {
                    length: recoveryDays,
                  },
                  (_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-paper-line bg-white p-3 text-center text-xs font-semibold text-ink-soft"
                    >

                      <div>
                        Day{' '}
                        {j.missedDay!.day_number +
                          i +
                          1}
                      </div>

                      <div className="mt-1 font-normal text-ember-600">
                        Recovery
                      </div>

                    </div>
                  )
                )}

              </div>

              {/* ACTIONS */}

              <div className="flex justify-end gap-2">

                <Button
                  variant="secondary"
                  disabled={recover.isPending}
                  onClick={() =>
                    setRecoveryOpen(false)
                  }
                >
                  Cancel
                </Button>

                <Button
                  loading={recover.isPending}
                  onClick={() =>
                    recover.mutate()
                  }
                >
                  Start Recovery
                </Button>

              </div>

            </div>

          </Modal>
        )}

    </div>
  )
}
