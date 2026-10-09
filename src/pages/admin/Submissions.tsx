import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react'

import { supabase, unwrap } from '../../lib/supabase'

import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '../../components/ui'

import { useToast } from '../../components/Toast'

// ============================================================
// TYPES
// ============================================================

type Submission = {
  id: string
  student_id: string
  activity_id: string
  text_body: string | null
  url: string | null
  file_path: string | null
  code: string | null
  language: string | null
  status: 'submitted' | 'reviewed'
  score: number | null
  feedback: string | null
  activity_version: number | null
  created_at: string
  student_name: string
  student_email: string
  activity_title: string
  activity_type: string
}

type JobApplication = {
  id: string
  job_id: string
  student_id: string
  match_score: number
  status:
    | 'applied'
    | 'under_review'
    | 'shortlisted'
    | 'rejected'
    | 'selected'
    | 'offer_sent'
  applied_at: string
  updated_at: string

  student_name: string
  student_email: string

  job_title: string
  company_name: string
  company_id: string
  job_location: string | null
  work_mode: string
  minimum_match_score: number
}

// ============================================================
// PAGE
// ============================================================

export default function Submissions() {
  const toast = useToast()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<
    'applications' | 'submissions'
  >('applications')

  // ==========================================================
  // JOB APPLICATION STATE
  // ==========================================================

  const [applicationSearch, setApplicationSearch] = useState('')

  const [applicationFilter, setApplicationFilter] = useState<
    | 'all'
    | 'applied'
    | 'under_review'
    | 'shortlisted'
    | 'selected'
    | 'rejected'
    | 'offer_sent'
  >('all')

  const [selectedApplication, setSelectedApplication] =
    useState<JobApplication | null>(null)

  // ==========================================================
  // LEARNING SUBMISSION STATE
  // ==========================================================

  const [search, setSearch] = useState('')

  const [filter, setFilter] = useState<
    'all' | 'submitted' | 'reviewed'
  >('all')

  const [selected, setSelected] =
    useState<Submission | null>(null)

  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')

  // ==========================================================
  // JOB APPLICATIONS QUERY
  // ==========================================================

  const applicationsQuery = useQuery({
    queryKey: ['admin-job-applications'],

    queryFn: async () => {
      const result = await supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          student_id,
          match_score,
          status,
          applied_at,
          updated_at,
          company_jobs (
            id,
            title,
            location,
            work_mode,
            minimum_match_score,
            companies (
              id,
              name
            )
          ),
          profiles (
            id,
            full_name,
            email
          )
        `)
        .order('applied_at', {
          ascending: false,
        })

      if (result.error) {
        throw result.error
      }

      const rows = (result.data ?? []) as any[]

      return rows.map(row => ({
        id: row.id,
        job_id: row.job_id,
        student_id: row.student_id,
        match_score: Number(row.match_score ?? 0),
        status: row.status,
        applied_at: row.applied_at,
        updated_at: row.updated_at,

        student_name:
          row.profiles?.full_name ??
          'Unknown student',

        student_email:
          row.profiles?.email ??
          '',

        job_title:
          row.company_jobs?.title ??
          'Unknown job',

        company_name:
          row.company_jobs?.companies?.name ??
          'Unknown company',

        company_id:
          row.company_jobs?.companies?.id ??
          '',

        job_location:
          row.company_jobs?.location ??
          null,

        work_mode:
          row.company_jobs?.work_mode ??
          'any',

        minimum_match_score:
          Number(
            row.company_jobs?.minimum_match_score ??
            0
          ),
      })) as JobApplication[]
    },
  })

  // ==========================================================
  // LEARNING SUBMISSIONS QUERY
  // ==========================================================

  const submissionsQuery = useQuery({
    queryKey: ['admin-submissions'],

    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('submissions')
          .select('*')
          .order('created_at', {
            ascending: false,
          })
      ) as any[]

      if (!rows.length) {
        return [] as Submission[]
      }

      const studentIds = [
        ...new Set(
          rows.map(row => row.student_id)
        ),
      ]

      const activityIds = [
        ...new Set(
          rows.map(row => row.activity_id)
        ),
      ]

      const [profiles, activities] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id,full_name,email')
            .in('id', studentIds),

          supabase
            .from('activities')
            .select('id,title,type')
            .in('id', activityIds),
        ])

      if (profiles.error) {
        throw profiles.error
      }

      if (activities.error) {
        throw activities.error
      }

      const profileMap = new Map(
        (profiles.data ?? []).map(profile => [
          profile.id,
          profile,
        ])
      )

      const activityMap = new Map(
        (activities.data ?? []).map(activity => [
          activity.id,
          activity,
        ])
      )

      return rows.map(row => ({
        ...row,

        student_name:
          profileMap.get(row.student_id)
            ?.full_name ??
          'Unknown student',

        student_email:
          profileMap.get(row.student_id)
            ?.email ??
          '',

        activity_title:
          activityMap.get(row.activity_id)
            ?.title ??
          'Unknown activity',

        activity_type:
          activityMap.get(row.activity_id)
            ?.type ??
          'assignment',
      })) as Submission[]
    },
  })

  // ==========================================================
  // APPLICATION STATUS MUTATION
  // ==========================================================

  const updateApplicationMutation =
    useMutation({
      mutationFn: async ({
        application,
        status,
      }: {
        application: JobApplication
        status: JobApplication['status']
      }) => {
        const result = await supabase
          .from('job_applications')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', application.id)

        if (result.error) {
          throw result.error
        }

        // ----------------------------------------------------
        // Notify the student
        // ----------------------------------------------------

        let title = ''
        let message = ''

        if (status === 'selected') {
          title = 'Application selected'

          message =
            `Your application for ${application.job_title} ` +
            `at ${application.company_name} has been selected.`
        } else if (status === 'rejected') {
          title = 'Application update'

          message =
            `Your application for ${application.job_title} ` +
            `at ${application.company_name} has been rejected.`
        } else if (status === 'under_review') {
          title = 'Application under review'

          message =
            `Your application for ${application.job_title} ` +
            `at ${application.company_name} is now under review.`
        } else if (status === 'shortlisted') {
          title = 'Application shortlisted'

          message =
            `Your application for ${application.job_title} ` +
            `at ${application.company_name} has been shortlisted.`
        } else if (status === 'offer_sent') {
          title = 'Offer update'

          message =
            `An offer has been sent for your application for ` +
            `${application.job_title} at ${application.company_name}.`
        } else {
          title = 'Application status updated'

          message =
            `Your application for ${application.job_title} ` +
            `at ${application.company_name} is now ${status.replace('_', ' ')}.`
        }

        const notificationResult = await supabase
          .from('notifications')
          .insert({
            title,
            message,
            category: 'opportunities',
            priority:
              status === 'rejected'
                ? 'normal'
                : 'high',
            action_url: `/jobs/${application.job_id}`,
          })
          .select('id')
          .single()

        if (notificationResult.error) {
          throw notificationResult.error
        }

        const recipientResult =
          await supabase
            .from('notification_recipients')
            .insert({
              notification_id:
                notificationResult.data.id,
              user_id:
                application.student_id,
            })

        if (recipientResult.error) {
          throw recipientResult.error
        }
      },

      onSuccess: (_, variables) => {
        const statusLabel =
          variables.status
            .replace('_', ' ')
            .replace(/\b\w/g, char =>
              char.toUpperCase()
            )

        toast(
          'ok',
          `Application ${statusLabel}. Student has been notified.`
        )

        setSelectedApplication(null)

        qc.invalidateQueries({
          queryKey: ['admin-job-applications'],
        })
      },

      onError: (error: Error) => {
        toast('err', error.message)
      },
    })

  // ==========================================================
  // GRADE SUBMISSION MUTATION
  // ==========================================================

  const gradeMutation = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new Error(
          'Select a submission first.'
        )
      }

      const numericScore = Number(score)

      if (
        !Number.isFinite(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        throw new Error(
          'Score must be between 0 and 100.'
        )
      }

      const result = await supabase.rpc(
        'admin_grade_submission',
        {
          p_submission: selected.id,
          p_score: numericScore,
          p_feedback:
            feedback.trim() || null,
        }
      )

      if (result.error) {
        throw result.error
      }
    },

    onSuccess: () => {
      toast(
        'ok',
        'Submission graded successfully.'
      )

      setSelected(null)
      setScore('')
      setFeedback('')

      qc.invalidateQueries({
        queryKey: ['admin-submissions'],
      })

      qc.invalidateQueries({
        queryKey: ['progress'],
      })

      qc.invalidateQueries({
        queryKey: ['skills'],
      })
    },

    onError: (error: Error) => {
      toast('err', error.message)
    },
  })

  // ==========================================================
  // FILTER APPLICATIONS
  // ==========================================================

  const applicationRows = useMemo(() => {
    const all =
      (
        applicationsQuery.data ?? []
      ).filter(row =>
        applicationFilter === 'all' ||
        row.status === applicationFilter
      )

    const searchText =
      applicationSearch
        .trim()
        .toLowerCase()

    if (!searchText) {
      return all
    }

    return all.filter(row =>
      `${row.student_name}
       ${row.student_email}
       ${row.job_title}
       ${row.company_name}
       ${row.status}`
        .toLowerCase()
        .includes(searchText)
    )
  }, [
    applicationsQuery.data,
    applicationFilter,
    applicationSearch,
  ])

  // ==========================================================
  // FILTER SUBMISSIONS
  // ==========================================================

  const rows = useMemo(() => {
    const all =
      (
        submissionsQuery.data ?? []
      ).filter(row =>
        filter === 'all' ||
        row.status === filter
      )

    const searchText =
      search.trim().toLowerCase()

    if (!searchText) {
      return all
    }

    return all.filter(row =>
      `${row.student_name}
       ${row.student_email}
       ${row.activity_title}`
        .toLowerCase()
        .includes(searchText)
    )
  }, [
    submissionsQuery.data,
    filter,
    search,
  ])

  // ==========================================================
  // OPEN SUBMISSION
  // ==========================================================

  const openSubmission = (
    submission: Submission
  ) => {
    setSelected(submission)

    setScore(
      submission.score == null
        ? ''
        : String(submission.score)
    )

    setFeedback(
      submission.feedback ?? ''
    )
  }

  // ==========================================================
  // OPEN FILE
  // ==========================================================

  const openFile = async (
    submission: Submission
  ) => {
    if (!submission.file_path) {
      return
    }

    const result =
      await supabase.storage
        .from('submissions')
        .createSignedUrl(
          submission.file_path,
          60 * 10
        )

    if (result.error) {
      toast(
        'err',
        result.error.message
      )
      return
    }

    window.open(
      result.data.signedUrl,
      '_blank',
      'noopener,noreferrer'
    )
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    applicationsQuery.isLoading ||
    submissionsQuery.isLoading
  ) {
    return <Spinner />
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (applicationsQuery.error) {
    return (
      <ErrorBox
        error={applicationsQuery.error}
        onRetry={() =>
          applicationsQuery.refetch()
        }
      />
    )
  }

  if (submissionsQuery.error) {
    return (
      <ErrorBox
        error={submissionsQuery.error}
        onRetry={() =>
          submissionsQuery.refetch()
        }
      />
    )
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div>
      <PageHeader
        title="Submissions & Applications"
        sub="Review student work and manage company job applications."
      />

      {/* ======================================================
          MAIN TABS
      ====================================================== */}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setActiveTab('applications')
          }
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            activeTab === 'applications'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-ink-soft hover:bg-paper-line'
          }`}
        >
          Job Applications
          {applicationRows.length > 0 && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {applicationRows.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab('submissions')
          }
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            activeTab === 'submissions'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-ink-soft hover:bg-paper-line'
          }`}
        >
          Learning Submissions
        </button>
      </div>

      {/* ======================================================
          JOB APPLICATIONS
      ====================================================== */}

      {activeTab === 'applications' && (
        <div>
          {/* Search + filters */}

          <div className="mb-5 flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
              />

              <Input
                value={applicationSearch}
                onChange={event =>
                  setApplicationSearch(
                    event.target.value
                  )
                }
                placeholder="Search student, job or company..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  'all',
                  'applied',
                  'under_review',
                  'shortlisted',
                  'selected',
                  'rejected',
                  'offer_sent',
                ] as const
              ).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setApplicationFilter(
                      value
                    )
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    applicationFilter === value
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-ink-soft hover:bg-paper-line'
                  }`}
                >
                  {value === 'all'
                    ? 'All'
                    : value
                        .replace('_', ' ')
                        .replace(
                          /\b\w/g,
                          char =>
                            char.toUpperCase()
                        )}
                </button>
              ))}
            </div>
          </div>

          {!applicationRows.length ? (
            <Card>
              <div className="py-10 text-center">
                <UserCheck
                  className="mx-auto mb-3 text-ink-mute"
                  size={32}
                />

                <p className="font-semibold">
                  No job applications found.
                </p>

                <p className="mt-1 text-sm text-ink-mute">
                  Applications from eligible students
                  will appear here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {applicationRows.map(
                application => (
                  <Card key={application.id}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      {/* Application information */}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-bold">
                            {application.job_title}
                          </h2>

                          <Badge>
                            {application.company_name}
                          </Badge>

                          <Badge
tone={
  application.status === 'selected'
    ? 'good'
    : 'warn'
}

                          >
                            {application.status
                              .replace('_', ' ')
                              .replace(
                                /\b\w/g,
                                char =>
                                  char.toUpperCase()
                              )}
                          </Badge>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-ink-soft">
                          {application.student_name}
                        </p>

                        <p className="text-xs text-ink-mute">
                          {application.student_email}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-mute">
                          <span>
                            Match:{' '}
                            <strong className="text-ink">
                              {application.match_score}%
                            </strong>
                          </span>

                          <span>
                            Required:{' '}
                            <strong className="text-ink">
                              {application.minimum_match_score}%
                            </strong>
                          </span>

                          <span>
                            Mode:{' '}
                            <strong className="text-ink">
                              {application.work_mode}
                            </strong>
                          </span>

                          {application.job_location && (
                            <span>
                              Location:{' '}
                              <strong className="text-ink">
                                {application.job_location}
                              </strong>
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs text-ink-mute">
                          Applied:{' '}
                          {new Date(
                            application.applied_at
                          ).toLocaleString()}
                        </p>
                      </div>

                      {/* Actions */}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setSelectedApplication(
                              application
                            )
                          }
                        >
                          Review
                        </Button>

                        {application.status !==
                          'selected' &&
                          application.status !==
                            'rejected' && (
                            <>
                              <Button
                                onClick={() =>
                                  updateApplicationMutation.mutate(
                                    {
                                      application,
                                      status:
                                        'selected',
                                    }
                                  )
                                }
                                loading={
                                  updateApplicationMutation.isPending
                                }
                              >
                                <CheckCircle2
                                  size={16}
                                />
                                Select
                              </Button>

                              <Button
                                variant="ghost"
                                onClick={() =>
                                  updateApplicationMutation.mutate(
                                    {
                                      application,
                                      status:
                                        'rejected',
                                    }
                                  )
                                }
                                loading={
                                  updateApplicationMutation.isPending
                                }
                              >
                                <XCircle
                                  size={16}
                                />
                                Reject
                              </Button>
                            </>
                          )}
                      </div>
                    </div>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          LEARNING SUBMISSIONS
      ====================================================== */}

      {activeTab === 'submissions' && (
        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
              />

              <Input
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
                placeholder="Search student or activity..."
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              {(
                [
                  'all',
                  'submitted',
                  'reviewed',
                ] as const
              ).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(value)
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    filter === value
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-ink-soft hover:bg-paper-line'
                  }`}
                >
                  {value === 'all'
                    ? 'All'
                    : value === 'submitted'
                    ? 'Pending'
                    : 'Reviewed'}
                </button>
              ))}
            </div>
          </div>

          {!rows.length ? (
            <Card>
              <p className="text-sm text-ink-mute">
                No submissions found.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map(row => (
                <Card key={row.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">
                          {row.activity_title}
                        </h2>

                        <Badge>
                          {row.activity_type}
                        </Badge>

                        <Badge
                          tone={
                            row.status ===
                            'reviewed'
                              ? 'good'
                              : 'warn'
                          }
                        >
                          {row.status ===
                          'reviewed'
                            ? 'Reviewed'
                            : 'Needs review'}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-ink-soft">
                        {row.student_name}
                      </p>

                      <p className="text-xs text-ink-mute">
                        {row.student_email}
                        {' · '}
                        {new Date(
                          row.created_at
                        ).toLocaleString()}
                      </p>

                      {row.score != null && (
                        <p className="mt-2 text-sm font-bold">
                          Score: {row.score}%
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() =>
                        openSubmission(row)
                      }
                    >
                      Review submission
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          JOB APPLICATION REVIEW MODAL
      ====================================================== */}

      {selectedApplication && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto my-8 max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">
                  Job application
                </h2>

                <p className="mt-1 text-sm text-ink-soft">
                  Review this student's application.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedApplication(null)
                }
                className="rounded-lg p-2 text-xl text-ink-mute hover:bg-paper-line"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
                  Student
                </p>

                <p className="mt-1 text-lg font-bold">
                  {selectedApplication.student_name}
                </p>

                <p className="text-sm text-ink-soft">
                  {selectedApplication.student_email}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-paper-line p-4">
                  <p className="text-xs text-ink-mute">
                    Job
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedApplication.job_title}
                  </p>
                </div>

                <div className="rounded-xl border border-paper-line p-4">
                  <p className="text-xs text-ink-mute">
                    Company
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedApplication.company_name}
                  </p>
                </div>

                <div className="rounded-xl border border-paper-line p-4">
                  <p className="text-xs text-ink-mute">
                    Match score
                  </p>

                  <p className="mt-1 text-2xl font-extrabold text-brand-600">
                    {selectedApplication.match_score}%
                  </p>
                </div>

                <div className="rounded-xl border border-paper-line p-4">
                  <p className="text-xs text-ink-mute">
                    Required score
                  </p>

                  <p className="mt-1 text-2xl font-extrabold">
                    {
                      selectedApplication.minimum_match_score
                    }%
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-paper-line p-4">
                <p className="text-xs text-ink-mute">
                  Current status
                </p>

                <div className="mt-2">
                  <Badge>
                    {selectedApplication.status
                      .replace('_', ' ')
                      .replace(
                        /\b\w/g,
                        char =>
                          char.toUpperCase()
                      )}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-paper-line pt-5">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelectedApplication(null)
                  }
                >
                  Close
                </Button>

                {selectedApplication.status !==
                  'selected' &&
                  selectedApplication.status !==
                    'rejected' && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          updateApplicationMutation.mutate(
                            {
                              application:
                                selectedApplication,
                              status:
                                'rejected',
                            }
                          )
                        }
                        loading={
                          updateApplicationMutation.isPending
                        }
                      >
                        <XCircle size={16} />
                        Reject
                      </Button>

                      <Button
                        onClick={() =>
                          updateApplicationMutation.mutate(
                            {
                              application:
                                selectedApplication,
                              status:
                                'selected',
                            }
                          )
                        }
                        loading={
                          updateApplicationMutation.isPending
                        }
                      >
                        <CheckCircle2 size={16} />
                        Select
                      </Button>
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          LEARNING SUBMISSION REVIEW MODAL
      ====================================================== */}

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto my-8 max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">
                  Review submission
                </h2>

                <p className="mt-1 text-sm text-ink-soft">
                  {selected.student_name}
                  {' · '}
                  {selected.activity_title}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="rounded-lg p-2 text-xl text-ink-mute hover:bg-paper-line"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {selected.text_body && (
                <div>
                  <h3 className="mb-2 font-bold">
                    Student answer
                  </h3>

                  <div className="whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm">
                    {selected.text_body}
                  </div>
                </div>
              )}

              {selected.url && (
                <div>
                  <h3 className="mb-2 font-bold">
                    Submitted link
                  </h3>

                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 underline"
                  >
                    {selected.url}
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {selected.file_path && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    openFile(selected)
                  }
                >
                  <FileText size={16} />
                  Open submitted file
                </Button>
              )}

              {selected.code && (
                <div>
                  <h3 className="mb-2 font-bold">
                    Submitted code
                    {selected.language
                      ? ` · ${selected.language}`
                      : ''}
                  </h3>

                  <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">
                    {selected.code}
                  </pre>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <Field label="Score (0–100)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={score}
                    onChange={event =>
                      setScore(
                        event.target.value
                      )
                    }
                    placeholder="85"
                  />
                </Field>

                <Field label="Feedback for student">
                  <Textarea
                    value={feedback}
                    onChange={event =>
                      setFeedback(
                        event.target.value
                      )
                    }
                    placeholder="Explain strengths, improvements, and what to work on next..."
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-2 border-t border-paper-line pt-4">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelected(null)
                  }
                >
                  Cancel
                </Button>

                <Button
                  loading={
                    gradeMutation.isPending
                  }
                  onClick={() =>
                    gradeMutation.mutate()
                  }
                >
                  <CheckCircle2 size={16} />
                  Save grade
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}