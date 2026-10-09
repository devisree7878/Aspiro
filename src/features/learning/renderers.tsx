import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Award,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Trophy,
  Upload,
  XCircle,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import type { Activity, Progress as P } from '../../lib/types'
import Markdown from '../../components/Markdown'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useAuth } from '../auth/AuthContext'

export interface RenderProps {
  activity: Activity
  progress?: P
  preview?: boolean
  onDone: () => void
}

const secondsSince = (t: number) =>
  Math.max(0, Math.round((Date.now() - t) / 1000))

/* ========================================================================= */
/* ADMIN FEEDBACK                                                            */
/* ========================================================================= */

function AdminFeedback({
  submission,
}: {
  submission: any
}) {
  if (!submission) {
    return null
  }

  const reviewed =
    submission.status === 'reviewed' ||
    submission.score !== null ||
    !!submission.feedback

  if (!reviewed) {
    return (
      <Card className="border border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <Clock3
            size={20}
            className="mt-0.5 shrink-0 text-amber-600"
          />

          <div>
            <p className="font-bold text-amber-800">
              Submission received
            </p>

            <p className="mt-1 text-sm text-amber-700">
              Your submission has been received and is
              waiting for admin review.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border border-brand-200 bg-brand-50">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2">
          <Award
            size={22}
            className="text-brand-600"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-extrabold text-brand-900">
                Admin Review
              </p>

              <p className="text-xs text-brand-700">
                Your submission has been reviewed.
              </p>
            </div>

            {submission.score !== null &&
              submission.score !== undefined && (
                <div className="rounded-xl bg-white px-5 py-2 text-center shadow-sm">
                  <div className="text-2xl font-extrabold text-brand-700">
                    {submission.score}
                  </div>

                  <div className="text-[11px] font-semibold text-ink-mute">
                    / 100
                  </div>
                </div>
              )}
          </div>

          {submission.feedback ? (
            <div className="mt-4 rounded-xl bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                <MessageSquare size={16} />
                Admin Feedback
              </div>

              <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                {submission.feedback}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-white p-4 text-sm text-ink-mute">
              The admin reviewed your submission but did
              not leave written feedback.
            </div>
          )}

          {submission.created_at && (
            <p className="mt-3 text-xs text-brand-700/70">
              Submitted on{' '}
              {new Date(
                submission.created_at
              ).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ========================================================================= */
/* STUDENT SUBMISSION DISPLAY                                               */
/* ========================================================================= */

function StudentSubmission({
  submission,
}: {
  submission: any
}) {
  if (!submission) {
    return null
  }

  const hasText =
    !!submission.text_body?.trim()

  const hasUrl =
    !!submission.url?.trim()

  const hasCode =
    !!submission.code?.trim()

  const hasFile =
    !!submission.file_path?.trim()

  if (
    !hasText &&
    !hasUrl &&
    !hasCode &&
    !hasFile
  ) {
    return null
  }

  return (
    <Card className="border border-brand-200 bg-brand-50">
      <div className="flex items-center gap-2">
        <CheckCircle2
          size={19}
          className="text-brand-600"
        />

        <h3 className="font-extrabold text-brand-900">
          Your Submission
        </h3>
      </div>

      <p className="mt-1 text-xs text-brand-700">
        This is the answer you submitted.
      </p>

      {hasText && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            Your answer / notes
          </p>

          <div className="whitespace-pre-wrap text-sm leading-6 text-ink">
            {submission.text_body}
          </div>
        </div>
      )}

      {hasUrl && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            Submitted link
          </p>

          <a
            href={submission.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-brand-700 underline"
          >
            <span className="break-all">
              {submission.url}
            </span>

            <ExternalLink
              size={15}
              className="shrink-0"
            />
          </a>
        </div>
      )}

      {hasCode && (
        <div className="mt-4 rounded-xl bg-slate-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Submitted code
            </p>

            {submission.language && (
              <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">
                {submission.language}
              </span>
            )}
          </div>

          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-white">
            {submission.code}
          </pre>
        </div>
      )}

      {hasFile && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            Submitted file
          </p>

          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <Upload size={16} />

            <span className="break-all">
              {submission.file_path}
            </span>
          </div>
        </div>
      )}

      {submission.status && (
        <div className="mt-4">
          <Badge
            tone={
              submission.status === 'reviewed'
                ? 'good'
                : 'info'
            }
          >
            {submission.status ===
            'reviewed'
              ? 'Reviewed'
              : 'Submitted'}
          </Badge>
        </div>
      )}
    </Card>
  )
}

/* ========================================================================= */
/* CONTENT VIEW                                                              */
/* ========================================================================= */

export function ContentView({
  activity,
  progress,
  preview,
  onDone,
}: RenderProps) {
  const toast = useToast()
  const t0 = useRef(Date.now())

  useEffect(() => {
    t0.current = Date.now()

    if (!preview) {
      supabase.rpc('start_activity', {
        p_activity: activity.id,
      })
    }
  }, [activity.id, preview])

  const c = activity.content
  const done = progress?.status === 'completed'

  const complete = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc(
        'complete_activity',
        {
          p_activity: activity.id,
          p_seconds: secondsSince(t0.current),
        }
      )

      if (r.error) {
        throw r.error
      }
    },

    onSuccess: onDone,

    onError: (e: Error) =>
      toast('err', e.message),
  })

  const resources: string[] =
    Array.isArray(c.resources)
      ? c.resources
      : []

  return (
    <div>
      {activity.type === 'video' && (
        <VideoEmbed url={c.url} />
      )}

      <Markdown>
        {activity.type === 'video'
          ? c.description
          : c.body}
      </Markdown>

      {c.source_url && (
        <a
          className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600"
          href={c.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Original source
          <ExternalLink size={14} />
        </a>
      )}

      {resources.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-bold">
            Resources
          </h3>

          <ul className="space-y-1 text-sm">
            {resources.map((r, i) => {
              const [label, href] = r
                .split('|')
                .map((s) => s.trim())

              return (
                <li key={i}>
                  <a
                    className="text-brand-600 underline"
                    href={href || label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Button
          disabled={preview}
          loading={complete.isPending}
          onClick={() =>
            complete.mutate()
          }
        >
          {done
            ? 'Continue'
            : 'Mark complete & continue'}
        </Button>
      </div>
    </div>
  )
}

function VideoEmbed({
  url,
}: {
  url?: string
}) {
  if (!url) {
    return (
      <p className="text-sm text-ink-mute">
        No video URL configured.
      </p>
    )
  }

  const m = url.match(
    /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/
  )

  if (m) {
    return (
      <div className="mb-4 aspect-video overflow-hidden rounded-2xl">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${m[1]}`}
          title="Lesson video"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <video
      className="mb-4 w-full rounded-2xl"
      controls
      src={url}
    />
  )
}

/* ========================================================================= */
/* QUIZ VIEW                                                                 */
/* ========================================================================= */

export function QuizView({
  activity,
  progress,
  preview,
  onDone,
}: RenderProps) {
  const toast = useToast()
  const c = activity.content

  const questions: any[] =
    c.questions ?? []

  const [sel, setSel] =
    useState<Record<string, number[]>>({})

  const [res, setRes] =
    useState<any>(null)

  useEffect(() => {
    setSel({})
    setRes(null)

    if (!preview) {
      supabase.rpc(
        'start_activity',
        {
          p_activity: activity.id,
        }
      )
    }
  }, [activity.id, preview])

  const submit = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc(
        'submit_quiz',
        {
          p_activity: activity.id,
          p_answers: sel,
        }
      )

      if (r.error) {
        throw r.error
      }

      return r.data
    },

    onSuccess: (d) => {
      setRes(d)

      if (d.passed) {
        toast(
          'ok',
          `Passed with ${d.score}%`
        )
      }

      onDone()
    },

    onError: (e: Error) =>
      toast('err', e.message),
  })

  const toggle = (
    q: any,
    i: number
  ) =>
    setSel((s) => {
      const cur =
        s[q.id] ?? []

      return {
        ...s,

        [q.id]:
          q.type === 'multiple'
            ? cur.includes(i)
              ? cur.filter(
                  (x) => x !== i
                )
              : [...cur, i]
            : [i],
      }
    })

  if (!questions.length) {
    return (
      <p className="text-ink-mute">
        This {activity.type} has no questions yet.
      </p>
    )
  }

  const allAnswered =
    questions.every(
      (q) =>
        (sel[q.id] ?? []).length > 0
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge>
          Pass at {c.passing_score ?? 60}%
        </Badge>

        {c.max_attempts && (
          <Badge>
            {c.max_attempts} attempts
          </Badge>
        )}

        {progress?.score != null && (
          <Badge tone="info">
            Best score {progress.score}%
          </Badge>
        )}
      </div>

      <div className="space-y-5">
        {questions.map(
          (q, qi) => {
            const d =
              res?.detail?.[q.id]

            return (
              <Card key={q.id}>
                <p className="font-semibold">
                  <span className="mr-2 text-ink-mute">
                    {qi + 1}.
                  </span>

                  {q.prompt}
                </p>

                {q.type === 'multiple' && (
                  <p className="text-xs text-ink-mute">
                    Select all that apply
                  </p>
                )}

                <div
                  className="mt-3 space-y-2"
                  role={
                    q.type === 'multiple'
                      ? 'group'
                      : 'radiogroup'
                  }
                  aria-label={q.prompt}
                >
                  {(q.type === 'truefalse'
                    ? ['True', 'False']
                    : q.options
                  ).map(
                    (
                      o: string,
                      i: number
                    ) => {
                      const on =
                        (
                          sel[q.id] ?? []
                        ).includes(i)

                      const isCorrect =
                        d &&
                        d.expected.includes(i)

                      return (
                        <label
                          key={i}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                            d
                              ? isCorrect
                                ? 'border-brand-500 bg-brand-50'
                                : on
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-paper-line'
                              : on
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-paper-line hover:bg-paper'
                          }`}
                        >
                          <input
                            type={
                              q.type === 'multiple'
                                ? 'checkbox'
                                : 'radio'
                            }
                            name={q.id}
                            checked={on}
                            disabled={!!res}
                            onChange={() =>
                              toggle(q, i)
                            }
                          />

                          {o}
                        </label>
                      )
                    }
                  )}
                </div>

                {d && (
                  <div
                    className={`mt-3 flex gap-2 text-sm ${
                      d.correct
                        ? 'text-brand-700'
                        : 'text-red-700'
                    }`}
                  >
                    {d.correct ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}

                    <span>
                      {d.correct
                        ? 'Correct.'
                        : 'Not quite.'}{' '}
                      {d.explanation}
                    </span>
                  </div>
                )}
              </Card>
            )
          }
        )}
      </div>

      {res ? (
        <Card
          className={`mt-6 ${
            res.passed
              ? 'bg-brand-50'
              : 'bg-ember-50'
          }`}
        >
          <p className="text-lg font-extrabold">
            {res.score}% —{' '}
            {res.passed
              ? 'Passed'
              : `You need ${res.passing_score}% to pass`}
          </p>

          <p className="text-sm text-ink-soft">
            Attempt {res.attempts_used}
            {res.max_attempts
              ? ` of ${res.max_attempts}`
              : ''}
          </p>

          {!res.passed &&
            (!res.max_attempts ||
              res.attempts_used <
                res.max_attempts) && (
              <Button
                className="mt-3"
                onClick={() => {
                  setSel({})
                  setRes(null)
                }}
              >
                Try again
              </Button>
            )}
        </Card>
      ) : (
        <div className="mt-6">
          <Button
            disabled={
              preview ||
              !allAnswered
            }
            loading={submit.isPending}
            onClick={() =>
              submit.mutate()
            }
          >
            Submit answers
          </Button>

          {!allAnswered && (
            <span className="ml-3 text-xs text-ink-mute">
              Answer every question to submit
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* CODING TYPES                                                              */
/* ========================================================================= */

interface CodingTestCase {
  id: string
  input: string
  expected_output: string
  is_hidden: boolean
  points: number
  order_index: number
}

/* ========================================================================= */
/* CODING WORKSPACE                                                          */
/* ========================================================================= */

export function CodingWorkspace({
  activity,
  progress,
  preview,
  onDone,
}: RenderProps) {
  const toast = useToast()
  const { session } = useAuth()

  const c = activity.content

  const submission = useQuery({
    queryKey: [
      'student-submission',
      session?.user.id,
      activity.id,
    ],

    enabled:
      !!session?.user.id &&
      !preview,

    queryFn: async () => {
      if (!session?.user.id) {
        return null
      }

      const { data, error } =
        await supabase
          .from('submissions')
          .select(
            'id,student_id,activity_id,text_body,url,file_path,code,language,status,score,feedback,created_at'
          )
          .eq(
            'student_id',
            session.user.id
          )
          .eq(
            'activity_id',
            activity.id
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle()

      if (error) {
        throw error
      }

      return data
    },

    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const [code, setCode] =
    useState<string>(
      c.starter_code ?? ''
    )

  const [language, setLanguage] =
    useState<string>(
      c.language ?? 'java'
    )

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    'problem' | 'tests' | 'submissions'
  >('problem')

  const [
    testResults,
    setTestResults,
  ] = useState<any[]>([])

  const [
    judgeResult,
    setJudgeResult,
  ] = useState<any>(null)

  const [running, setRunning] =
    useState(false)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [hints, setHints] =
    useState(0)

  const [submitted, setSubmitted] =
    useState(
      progress?.status === 'completed'
    )

  useEffect(() => {
    setCode(
      c.starter_code ?? ''
    )

    setLanguage(
      c.language ?? 'java'
    )

    setTestResults([])
    setJudgeResult(null)
    setHints(0)

    setSubmitted(
      progress?.status === 'completed'
    )

    if (!preview) {
      supabase.rpc(
        'start_activity',
        {
          p_activity: activity.id,
        }
      )
    }
  }, [
    activity.id,
    preview,
    c.starter_code,
    c.language,
    progress?.status,
  ])

  const tests = useQuery({
    queryKey: [
      'coding-public-tests',
      activity.id,
    ],

    enabled:
      !!activity.id &&
      activity.type ===
        'coding_exercise',

    queryFn:
      async (): Promise<
        CodingTestCase[]
      > => {
        if (
          !Array.isArray(
            c.public_tests
          )
        ) {
          return []
        }

        return c.public_tests.map(
          (
            t: any,
            i: number
          ) => ({
            id: String(
              t.id ??
                `public-${activity.id}-${i}`
            ),

            input: String(
              t.input ?? ''
            ),

            expected_output: String(
              t.expected_output ??
                t.expected ??
                ''
            ),

            is_hidden: false,

            points: Number(
              t.points ?? 1
            ),

            order_index: i,
          })
        )
      },
  })

  const publicTests =
    tests.data ?? []

  const runCode = async () => {
    if (!code.trim()) {
      toast(
        'err',
        'Write some code before running it.'
      )
      return
    }

    if (!session) {
      toast(
        'err',
        'Please sign in before running code.'
      )
      return
    }

    if (preview) {
      toast(
        'err',
        'Code execution is disabled in preview mode.'
      )
      return
    }

    setRunning(true)
    setJudgeResult(null)
    setTestResults([])

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'run-coding-tests',
          {
            body: {
              activity_id:
                activity.id,

              code,

              language,

              submit: false,
            },
          }
        )

      if (error) {
        throw error
      }

      if (
        !data ||
        data.success === false
      ) {
        throw new Error(
          data?.error ??
            'Code execution failed.'
        )
      }

      setTestResults(
        Array.isArray(
          data.tests
        )
          ? data.tests
          : []
      )

      setJudgeResult(data)

      if (data.passed) {
        toast(
          'ok',
          'All public tests passed!'
        )
      } else {
        toast(
          'err',
          'Some public tests failed.'
        )
      }
    } catch (e: any) {
      console.error(
        'Code execution error:',
        e
      )

      const message =
        e?.message ??
        'Automatic code execution failed.'

      setJudgeResult({
        configured: false,
        success: false,
        error: message,
      })

      toast(
        'err',
        message
      )
    } finally {
      setRunning(false)
    }
  }

  const submitCode = async () => {
    if (!code.trim()) {
      toast(
        'err',
        'Write your solution first.'
      )
      return
    }

    if (!session) {
      toast(
        'err',
        'Please sign in before submitting.'
      )
      return
    }

    if (preview) {
      toast(
        'err',
        'Submission is disabled in preview mode.'
      )
      return
    }

    setSubmitting(true)
    setJudgeResult(null)
    setTestResults([])

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'run-coding-tests',
          {
            body: {
              activity_id:
                activity.id,

              code,

              language,

              submit: true,
            },
          }
        )

      if (error) {
        throw error
      }

      if (
        !data ||
        data.success === false
      ) {
        throw new Error(
          data?.error ??
            'Code execution failed.'
        )
      }

      setTestResults(
        Array.isArray(
          data.tests
        )
          ? data.tests
          : []
      )

      setJudgeResult(data)

      if (!data.passed) {
        toast(
          'err',
          'Submission failed. Fix the failed tests.'
        )
        return
      }

      setSubmitted(true)

      await submission.refetch()

      toast(
        'ok',
        'Accepted! Coding exercise completed.'
      )

      onDone()
    } catch (e: any) {
      console.error(
        'Submission error:',
        e
      )

      const message =
        e?.message ??
        'Unable to submit the solution.'

      toast(
        'err',
        message
      )

      setJudgeResult({
        configured: false,
        success: false,
        error: message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetCode = () => {
    setCode(
      c.starter_code ?? ''
    )

    setLanguage(
      c.language ?? 'java'
    )

    setTestResults([])
    setJudgeResult(null)
  }

  const passedCount =
    testResults.filter(
      (t) =>
        t.passed === true ||
        t.status === 'passed'
    ).length

  const failedCount =
    testResults.filter(
      (t) =>
        t.passed === false ||
        t.status === 'failed'
    ).length

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warn">
                {c.difficulty ??
                  'coding'}
              </Badge>

              <Badge>
                {language.toUpperCase()}
              </Badge>

              {c.time_limit_minutes && (
                <Badge>
                  <Clock3
                    size={13}
                    className="mr-1 inline"
                  />

                  {c.time_limit_minutes}{' '}
                  min
                </Badge>
              )}

              {submitted && (
                <Badge tone="good">
                  <CheckCircle2
                    size={13}
                    className="mr-1 inline"
                  />

                  Accepted
                </Badge>
              )}
            </div>

            <h2 className="mt-3 text-xl font-extrabold">
              {activity.title}
            </h2>

            {c.short_description && (
              <p className="mt-1 text-sm text-ink-soft">
                {c.short_description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={resetCode}
              disabled={
                running ||
                submitting
              }
            >
              <RotateCcw size={16} />
              Reset
            </Button>

            <Button
              onClick={runCode}
              disabled={
                preview ||
                running ||
                submitting
              }
              loading={running}
            >
              <Play size={16} />
              Run Code
            </Button>

            <Button
              onClick={submitCode}
              disabled={
                preview ||
                running ||
                submitting
              }
              loading={submitting}
            >
              <Send size={16} />
              Submit
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-paper-line pb-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeTab === 'problem'
              ? 'bg-brand-100 text-brand-700'
              : 'text-ink-soft hover:bg-paper'
          }`}
          onClick={() =>
            setActiveTab('problem')
          }
        >
          Problem
        </button>

        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeTab === 'tests'
              ? 'bg-brand-100 text-brand-700'
              : 'text-ink-soft hover:bg-paper'
          }`}
          onClick={() =>
            setActiveTab('tests')
          }
        >
          Public Tests

          {publicTests.length > 0 && (
            <span className="ml-2">
              ({publicTests.length})
            </span>
          )}
        </button>

        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeTab === 'submissions'
              ? 'bg-brand-100 text-brand-700'
              : 'text-ink-soft hover:bg-paper'
          }`}
          onClick={() =>
            setActiveTab(
              'submissions'
            )
          }
        >
          Submission
        </button>
      </div>

      {activeTab === 'problem' && (
        <Card>
          <Markdown>
            {c.statement ??
              c.description ??
              'No problem statement provided.'}
          </Markdown>

          {c.signature && (
            <div className="mt-5">
              <h3 className="mb-2 font-bold">
                Function Signature
              </h3>

              <pre className="overflow-x-auto rounded-xl bg-paper-line/50 p-4 font-mono text-sm">
                {c.signature}
              </pre>
            </div>
          )}

          {c.constraints && (
            <div className="mt-5">
              <h3 className="mb-2 font-bold">
                Constraints
              </h3>

              <Markdown>
                {c.constraints}
              </Markdown>
            </div>
          )}

          {(c.hints ?? []).length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <Lightbulb size={18} />
                Hints
              </h3>

              <div className="space-y-2">
                {(c.hints as string[])
                  .slice(0, hints)
                  .map(
                    (
                      h,
                      i
                    ) => (
                      <div
                        key={i}
                        className="rounded-xl bg-ember-50 p-3 text-sm"
                      >
                        {h}
                      </div>
                    )
                  )}
              </div>

              {hints <
                c.hints.length && (
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() =>
                    setHints(
                      hints + 1
                    )
                  }
                >
                  <Lightbulb size={16} />

                  Show hint (
                  {hints}/
                  {
                    c.hints
                      .length
                  }
                  )
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'tests' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                Public Test Cases
              </h3>

              <p className="text-sm text-ink-soft">
                Verify your solution before submitting.
              </p>
            </div>

            <Badge>
              {publicTests.length} tests
            </Badge>
          </div>

          {publicTests.length === 0 ? (
            <p className="text-sm text-ink-mute">
              No public test cases configured.
            </p>
          ) : (
            <div className="space-y-3">
              {publicTests.map(
                (
                  test: CodingTestCase,
                  i
                ) => {
                  const result =
                    testResults.find(
                      (r) =>
                        r.test_id ===
                          test.id ||
                        r.id ===
                          test.id ||
                        r.order_index ===
                          test.order_index
                    )

                  const passed =
                    result?.passed ===
                      true ||
                    result?.status ===
                      'passed'

                  const failed =
                    result?.passed ===
                      false ||
                    result?.status ===
                      'failed'

                  return (
                    <div
                      key={test.id}
                      className={`rounded-xl border p-4 ${
                        passed
                          ? 'border-brand-300 bg-brand-50'
                          : failed
                            ? 'border-red-300 bg-red-50'
                            : 'border-paper-line'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-bold">
                          Test {i + 1}
                        </span>

                        {passed && (
                          <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                            <CheckCircle2 size={16} />
                            Passed
                          </span>
                        )}

                        {failed && (
                          <span className="flex items-center gap-1 text-sm font-semibold text-red-700">
                            <XCircle size={16} />
                            Failed
                          </span>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-ink-mute">
                            Input
                          </p>

                          <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-xs">
                            {test.input ||
                              '(empty)'}
                          </pre>
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase text-ink-mute">
                            Expected Output
                          </p>

                          <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-xs">
                            {test.expected_output ||
                              '(empty)'}
                          </pre>
                        </div>
                      </div>

                      {result?.actual_output !=
                        null && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-semibold uppercase text-ink-mute">
                            Your Output
                          </p>

                          <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-xs">
                            {result.actual_output ||
                              '(empty)'}
                          </pre>
                        </div>
                      )}

                      {result?.error && (
                        <div className="mt-3 rounded-lg bg-red-100 p-3 text-xs text-red-700">
                          {result.error}
                        </div>
                      )}
                    </div>
                  )
                }
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} />

            <h3 className="font-bold">
              Code Editor
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value
                )
              }
              disabled={
                running ||
                submitting ||
                preview
              }
              className="rounded-lg border border-paper-line bg-paper px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="java">
                Java
              </option>

              <option value="python">
                Python
              </option>

              <option value="javascript">
                JavaScript
              </option>

              <option value="cpp">
                C++
              </option>
            </select>

            <Badge>
              {code.length} chars
            </Badge>
          </div>
        </div>

        <textarea
          value={code}
          onChange={(e) => {
            setCode(
              e.target.value
            )
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()

              const target =
                e.currentTarget

              const start =
                target.selectionStart

              const end =
                target.selectionEnd

              const nextCode =
                code.substring(
                  0,
                  start
                ) +
                '    ' +
                code.substring(
                  end
                )

              setCode(
                nextCode
              )

              requestAnimationFrame(
                () => {
                  target.selectionStart =
                    start + 4

                  target.selectionEnd =
                    start + 4
                }
              )
            }
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          disabled={preview}
          placeholder="// Write your solution here..."
          className="block min-h-[420px] w-full resize-y rounded-xl border border-slate-700 bg-[#111827] p-4 font-mono text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-mute">
            Your solution is saved when you submit it.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={resetCode}
              disabled={
                running ||
                submitting
              }
            >
              <RotateCcw size={15} />
              Reset
            </Button>

            <Button
              onClick={runCode}
              disabled={
                preview ||
                running ||
                submitting
              }
              loading={running}
            >
              <Play size={15} />
              Run Code
            </Button>

            <Button
              onClick={submitCode}
              disabled={
                preview ||
                running ||
                submitting
              }
              loading={submitting}
            >
              <Send size={15} />
              Submit Solution
            </Button>
          </div>
        </div>
      </Card>

      {(judgeResult ||
        testResults.length > 0) && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy size={19} />

              <h3 className="font-bold">
                Execution Result
              </h3>
            </div>

            {judgeResult?.configured === false ? (
              <Badge tone="warn">
                Execution Error
              </Badge>
            ) : judgeResult?.passed ? (
              <Badge tone="good">
                All tests passed
              </Badge>
            ) : (
              <Badge tone="warn">
                Tests need attention
              </Badge>
            )}
          </div>

          {judgeResult?.configured === false ? (
            <div className="rounded-xl bg-ember-50 p-4 text-sm">
              <p className="font-semibold">
                Automatic execution failed.
              </p>

              <p className="mt-1 text-ink-soft">
                The code-execution service returned an error.
              </p>

              {judgeResult.error && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs">
                  {judgeResult.error}
                </pre>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge tone="good">
                  Passed: {passedCount}
                </Badge>

                <Badge tone="warn">
                  Failed: {failedCount}
                </Badge>

                {judgeResult.score != null && (
                  <Badge>
                    Score: {judgeResult.score}%
                  </Badge>
                )}
              </div>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  {testResults.map(
                    (
                      result,
                      index
                    ) => (
                      <div
                        key={
                          result.test_id ??
                          result.id ??
                          index
                        }
                        className="rounded-xl border border-paper-line p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {result.passed ? (
                              <CheckCircle2
                                size={18}
                                className="text-brand-600"
                              />
                            ) : (
                              <XCircle
                                size={18}
                                className="text-red-600"
                              />
                            )}

                            <span className="text-sm font-semibold">
                              Test {index + 1}
                            </span>
                          </div>

                          <span className="text-xs text-ink-mute">
                            {result.runtime_ms !=
                            null
                              ? `${result.runtime_ms} ms`
                              : result.status ??
                                ''}
                          </span>
                        </div>

                        {result.actual_output !=
                          null && (
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-semibold uppercase text-ink-mute">
                              Output
                            </p>

                            <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-xs">
                              {result.actual_output ||
                                '(empty)'}
                            </pre>
                          </div>
                        )}

                        {result.error && (
                          <div className="mt-3 rounded-lg bg-red-100 p-3 text-xs text-red-700">
                            {result.error}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-2">
              <Trophy size={18} />

              <h3 className="font-bold">
                Your Coding Submission
              </h3>
            </div>

            {submitted ? (
              <div className="mt-4 rounded-xl bg-brand-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-brand-700">
                  <CheckCircle2 size={19} />

                  Coding exercise completed
                </div>

                <p className="mt-1 text-sm text-brand-700/80">
                  Your accepted solution has been recorded.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-paper p-4 text-sm text-ink-soft">
                Submit an accepted solution to complete this activity.
              </div>
            )}
          </Card>

          {submission.isLoading && (
            <Card>
              <p className="text-sm text-ink-mute">
                Checking admin review...
              </p>
            </Card>
          )}

          {submission.isError && (
            <Card className="border border-red-200 bg-red-50">
              <p className="font-semibold text-red-700">
                Unable to load your submission review.
              </p>

              <p className="mt-1 text-sm text-red-600">
                Please refresh the page and try again.
              </p>
            </Card>
          )}

          {!submission.isLoading &&
            !submission.isError &&
            submission.data && (
              <>
                <StudentSubmission
                  submission={
                    submission.data
                  }
                />

                <AdminFeedback
                  submission={
                    submission.data
                  }
                />
              </>
            )}
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* WORK VIEW                                                                 */
/* ========================================================================= */

export function WorkView({
  activity,
  progress,
  preview,
  onDone,
}: RenderProps) {
  if (
    activity.type ===
    'coding_exercise'
  ) {
    return (
      <CodingWorkspace
        activity={activity}
        progress={progress}
        preview={preview}
        onDone={onDone}
      />
    )
  }

  const toast = useToast()
  const { session } = useAuth()

  const c =
    activity.content

  const [text, setText] =
    useState('')

  const [url, setUrl] =
    useState('')

  const [file, setFile] =
    useState<File | null>(
      null
    )

  /*
   * Prevent the saved submission from repeatedly
   * overwriting a student's new draft.
   */
  const hydratedSubmission =
    useRef<string | null>(null)

  const submission = useQuery({
    queryKey: [
      'student-submission',
      session?.user.id,
      activity.id,
    ],

    enabled:
      !!session?.user.id &&
      !preview,

    queryFn: async () => {
      if (!session?.user.id) {
        return null
      }

      const { data, error } =
        await supabase
          .from('submissions')
          .select(
            `
              id,
              student_id,
              activity_id,
              text_body,
              url,
              file_path,
              code,
              language,
              status,
              score,
              feedback,
              created_at
            `
          )
          .eq(
            'student_id',
            session.user.id
          )
          .eq(
            'activity_id',
            activity.id
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle()

      if (error) {
        throw error
      }

      return data
    },

    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  /*
   * IMPORTANT FIX:
   *
   * Load the saved submission back into the form
   * after Supabase returns it.
   *
   * Previously the code queried the submission but
   * never called setText() / setUrl().
   */
  useEffect(() => {
    const saved =
      submission.data

    if (!saved) {
      return
    }

    if (
      hydratedSubmission.current ===
      saved.id
    ) {
      return
    }

    hydratedSubmission.current =
      saved.id

    setText(
      saved.text_body ?? ''
    )

    setUrl(
      saved.url ?? ''
    )
  }, [
    submission.data,
  ])

  const [hints, setHints] =
    useState(0)

  useEffect(() => {
    setText('')
    setUrl('')
    setFile(null)
    setHints(0)

    hydratedSubmission.current =
      null

    if (!preview) {
      supabase.rpc(
        'start_activity',
        {
          p_activity:
            activity.id,
        }
      )
    }
  }, [
    activity.id,
    preview,
  ])

  const submit =
    useMutation({
      mutationFn:
        async () => {
          let file_path:
            | string
            | null = null

          if (file) {
            if (
              file.size >
              10_000_000
            ) {
              throw new Error(
                'File must be under 10 MB'
              )
            }

            if (!session) {
              throw new Error(
                'Please sign in first.'
              )
            }

            file_path = `${session.user.id}/${activity.id}/${Date.now()}-${file.name.replace(
              /[^\w.-]/g,
              '_'
            )}`

            const up =
              await supabase.storage
                .from(
                  'submissions'
                )
                .upload(
                  file_path,
                  file
                )

            if (up.error) {
              throw up.error
            }
          }

          const r =
            await supabase.rpc(
              'submit_work',
              {
                p_activity:
                  activity.id,

                p_text:
                  text ||
                  null,

                p_url:
                  url ||
                  null,

                p_code: null,

                p_language:
                  null,

                p_file_path:
                  file_path,
              }
            )

          if (r.error) {
            throw r.error
          }

          return r.data
        },

      onSuccess:
        async () => {
          toast(
            'ok',
            'Submitted'
          )

          /*
           * Force React Query to fetch the newly
           * inserted submission from Supabase.
           */
          await submission.refetch()

          onDone()
        },

      onError: (
        e: Error
      ) =>
        toast(
          'err',
          e.message
        ),
    })

  const body =
    activity.type ===
    'project'
      ? c.description
      : activity.type ===
          'challenge'
        ? c.description
        : c.instructions

  const done =
    progress?.status ===
    'completed'

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {c.difficulty && (
          <Badge tone="warn">
            {c.difficulty}
          </Badge>
        )}

        {c.deadline && (
          <Badge>
            Due {c.deadline}
          </Badge>
        )}

        {done && (
          <Badge tone="good">
            Submitted
          </Badge>
        )}
      </div>

      <Markdown>
        {body}
      </Markdown>

      {activity.type ===
        'project' &&
        (
          [
            'requirements',
            'deliverables',
            'evaluation_criteria',
          ] as const
        ).map(
          (k) =>
            c[k] && (
              <div
                key={k}
              >
                <h3 className="mt-4 font-bold capitalize">
                  {k.replace(
                    '_',
                    ' '
                  )}
                </h3>

                <Markdown>
                  {c[k]}
                </Markdown>
              </div>
            )
        )}

      {activity.type ===
        'assignment' &&
        c.rubric && (
          <>
            <h3 className="mt-4 font-bold">
              Rubric
            </h3>

            <Markdown>
              {c.rubric}
            </Markdown>
          </>
        )}

      <div className="mt-5 space-y-4">
        <Field label="Your answer / notes">
          <Textarea
            value={text}
            onChange={(e) =>
              setText(
                e.target.value
              )
            }
            placeholder="Write your answer or notes here..."
          />
        </Field>

        {[
          'assignment',
          'project',
        ].includes(
          activity.type
        ) && (
          <>
            <Field label="GitHub / link (optional)">
              <Input
                value={url}
                onChange={(e) =>
                  setUrl(
                    e.target.value
                  )
                }
                placeholder="https://github.com/…"
              />
            </Field>

            <Field label="File (optional, max 10 MB)">
              <Input
                type="file"
                onChange={(e) =>
                  setFile(
                    e.target
                      .files?.[0] ??
                      null
                  )
                }
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-6">
        <Button
          disabled={preview}
          loading={
            submit.isPending
          }
          onClick={() =>
            submit.mutate()
          }
        >
          <Upload size={16} />

          {done
            ? 'Submit again'
            : 'Submit'}
        </Button>
      </div>

      {!preview && (
        <div className="mt-6 space-y-5">
          {submission.isLoading && (
            <div className="rounded-xl border border-paper-line bg-white p-4 text-sm text-ink-mute">
              Checking your submission status...
            </div>
          )}

          {submission.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">
                Unable to load your submission.
              </p>

              <p className="mt-1">
                Please refresh the page and try again.
              </p>
            </div>
          )}

          {!submission.isLoading &&
            !submission.isError &&
            submission.data && (
              <>
                {/* THIS IS THE IMPORTANT NEW SECTION */}
                <StudentSubmission
                  submission={
                    submission.data
                  }
                />

                {/* EXISTING ADMIN FEEDBACK */}
                <AdminFeedback
                  submission={
                    submission.data
                  }
                />
              </>
            )}
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* RENDERERS                                                                 */
/* ========================================================================= */

export const RENDERERS: Record<
  string,
  (p: RenderProps) => JSX.Element
> = {
  lesson: ContentView,
  reading: ContentView,
  video: ContentView,

  quiz: QuizView,
  assessment: QuizView,

  coding_exercise: WorkView,
  assignment: WorkView,
  project: WorkView,
  challenge: WorkView,
}