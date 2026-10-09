import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Job = {
  id: string
  title: string
  description: string | null
  location: string | null
  work_mode: string
  experience_level: string | null
  min_graduation_year: number | null
  max_graduation_year: number | null
  status: string
  application_deadline: string | null
  minimum_match_score: number
  companies: {
    id: string
    name: string
    website: string | null
    location: string | null
    description: string | null
  } | null
}

type Match = {
  match_score: number
}

type Application = {
  id: string
  status: string
  match_score: number
  applied_at: string
}

export default function JobDetails() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [application, setApplication] =
    useState<Application | null>(null)

  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) {
      setError('Job not found.')
      setLoading(false)
      return
    }

    loadJob()
  }, [jobId])

  async function loadJob() {
    try {
      setLoading(true)
      setError('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        navigate('/login')
        return
      }

      const { data: jobData, error: jobError } =
        await supabase
          .from('company_jobs')
          .select(`
            id,
            title,
            description,
            location,
            work_mode,
            experience_level,
            min_graduation_year,
            max_graduation_year,
            status,
            application_deadline,
            minimum_match_score,
            companies (
              id,
              name,
              website,
              location,
              description
            )
          `)
          .eq('id', jobId)
          .eq('status', 'published')
          .single()

      if (jobError) {
        throw jobError
      }

      setJob(jobData as unknown as Job)

      const {
        data: matchData,
        error: matchError,
      } = await supabase
        .from('company_job_matches')
        .select('match_score')
        .eq('job_id', jobId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (matchError) {
        throw matchError
      }

      setMatch(matchData)

      const {
        data: applicationData,
        error: applicationError,
      } = await supabase
        .from('job_applications')
        .select(
          'id, status, match_score, applied_at'
        )
        .eq('job_id', jobId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (applicationError) {
        throw applicationError
      }

      setApplication(applicationData)
    } catch (err: unknown) {
      console.error('Job details error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load this job.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function applyForJob() {
    if (!jobId || applying) {
      return
    }

    try {
      setApplying(true)
      setError('')

      const {
        data,
        error: applyError,
      } = await supabase.rpc('apply_for_job', {
        p_job_id: jobId,
      })

      if (applyError) {
        throw applyError
      }

      setApplication(data as Application)
    } catch (err: unknown) {
      console.error('Apply error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to apply for this job.'
      )
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          Loading job details...
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 rounded-lg border px-4 py-2"
          >
            ← Back
          </button>

          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen p-8">
        Job not found.
      </div>
    )
  }

  const score = match?.match_score ?? 0
  const requiredScore =
    Number(job.minimum_match_score ?? 0)

  const eligible = score >= requiredScore
  const alreadyApplied = Boolean(application)

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">

        <button
          onClick={() => navigate(-1)}
          className="mb-6 rounded-lg border px-4 py-2 text-sm font-medium"
        >
          ← Back
        </button>

        <div className="rounded-2xl border bg-white p-8 shadow-sm">

          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold text-indigo-600">
              {job.companies?.name || 'Company'}
            </p>

            <h1 className="text-3xl font-bold">
              {job.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">

              {job.location && (
                <span className="rounded-full bg-gray-100 px-3 py-1">
                  📍 {job.location}
                </span>
              )}

              <span className="rounded-full bg-gray-100 px-3 py-1">
                💼 {job.work_mode}
              </span>

              {job.experience_level && (
                <span className="rounded-full bg-gray-100 px-3 py-1">
                  🎯 {job.experience_level}
                </span>
              )}

            </div>
          </div>

          <div className="mb-8 rounded-xl bg-indigo-50 p-5">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-600">
                  Your match score
                </p>

                <p className="text-3xl font-bold text-indigo-600">
                  {score}%
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Required
                </p>

                <p className="text-2xl font-bold">
                  {requiredScore}%
                </p>
              </div>

            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="mb-8">
            <h2 className="mb-3 text-xl font-bold">
              About the role
            </h2>

            <p className="whitespace-pre-wrap text-gray-700">
              {job.description ||
                'No job description provided.'}
            </p>
          </section>

          {job.companies?.description && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-bold">
                About the company
              </h2>

              <p className="text-gray-700">
                {job.companies.description}
              </p>
            </section>
          )}

          <section className="mb-8">
            <h2 className="mb-3 text-xl font-bold">
              Eligibility
            </h2>

            <div className="space-y-2 text-sm text-gray-700">

              <p>
                Match score:{' '}
                <strong>{score}%</strong>
              </p>

              <p>
                Required score:{' '}
                <strong>{requiredScore}%</strong>
              </p>

              {job.min_graduation_year && (
                <p>
                  Minimum graduation year:{' '}
                  <strong>
                    {job.min_graduation_year}
                  </strong>
                </p>
              )}

              {job.max_graduation_year && (
                <p>
                  Maximum graduation year:{' '}
                  <strong>
                    {job.max_graduation_year}
                  </strong>
                </p>
              )}

            </div>
          </section>

          {alreadyApplied ? (
            <div className="rounded-xl bg-green-50 p-5">
              <p className="font-semibold text-green-700">
                Application submitted
              </p>

              <p className="mt-1 text-sm text-green-600">
                Current status:{' '}
                {application?.status}
              </p>
            </div>
          ) : eligible ? (
            <button
              onClick={applyForJob}
              disabled={applying}
              className="w-full rounded-xl bg-indigo-600 px-6 py-4 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying
                ? 'Applying...'
                : 'Apply Now'}
            </button>
          ) : (
            <div className="rounded-xl bg-gray-100 p-5">
              <p className="font-semibold text-gray-700">
                You are not currently eligible for this job.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Your match score must reach the required
                score before you can apply.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}