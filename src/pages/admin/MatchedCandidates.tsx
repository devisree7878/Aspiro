import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  User,
  Users,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui'

type Match = {
  id: string
  job_id: string
  student_id: string
  match_score: number
  matched_at: string

  full_name: string | null
  email: string | null
  graduation_year: number | null
  experience_level: string | null
  tech_skills: string[] | null
}

type Job = {
  id: string
  title: string
  minimum_match_score: number
  status: string
  location: string | null
  work_mode: string
  company: {
    name: string
  } | null
}

async function fetchJob(jobId: string): Promise<Job> {
  const { data, error } = await supabase
    .from('company_jobs')
    .select(`
      id,
      title,
      minimum_match_score,
      status,
      location,
      work_mode,
      company:companies (
        name
      )
    `)
    .eq('id', jobId)
    .single()

  if (error) throw error

  return data as unknown as Job
}

async function fetchMatches(jobId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('company_job_matches')
    .select(`
      id,
      job_id,
      student_id,
      match_score,
      matched_at,
      profile:profiles (
        full_name,
        email,
        graduation_year,
        experience_level,
        tech_skills
      )
    `)
    .eq('job_id', jobId)
    .order('match_score', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    job_id: row.job_id,
    student_id: row.student_id,
    match_score: Number(row.match_score ?? 0),
    matched_at: row.matched_at,
    full_name: row.profile?.full_name ?? null,
    email: row.profile?.email ?? null,
    graduation_year: row.profile?.graduation_year ?? null,
    experience_level: row.profile?.experience_level ?? null,
    tech_skills: row.profile?.tech_skills ?? [],
  }))
}

export default function MatchedCandidates() {
  const navigate = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()

  const jobQuery = useQuery({
    queryKey: ['matched-job', jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: Boolean(jobId),
  })

  const matchesQuery = useQuery({
    queryKey: ['job-matches', jobId],
    queryFn: () => fetchMatches(jobId!),
    enabled: Boolean(jobId),
  })

  if (!jobId) {
    return (
      <div className="p-6">
        <p className="text-red-600">Job ID is missing.</p>
      </div>
    )
  }

  const job = jobQuery.data
  const matches = matchesQuery.data ?? []

  const minimumScore = Number(job?.minimum_match_score ?? 0)

  const eligibleMatches = matches.filter(
    (candidate) => candidate.match_score >= minimumScore
  )

  const isLoading = jobQuery.isLoading || matchesQuery.isLoading

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/admin/catalog')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to Careers & Skills
        </button>

        <PageHeader
          title="Matched candidates"
          sub={
            job
              ? `${job.company?.name ?? 'Company'} • ${job.title}`
              : 'Candidates matched to this job'
          }
        />
      </div>

      {jobQuery.isError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load the job details.
        </div>
      )}

      {matchesQuery.isError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load matched candidates.
        </div>
      )}

      {job && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard
              icon={<Users size={20} />}
              label="Matched candidates"
              value={String(matches.length)}
            />

            <StatCard
              icon={<CheckCircle2 size={20} />}
              label="Eligible candidates"
              value={String(eligibleMatches.length)}
            />

            <StatCard
              icon={<Award size={20} />}
              label="Minimum match"
              value={`${minimumScore}%`}
            />

            <StatCard
              icon={<RefreshCw size={20} />}
              label="Job status"
              value={job.status}
            />
          </div>

          <div className="mb-6 rounded-2xl border border-paper-line bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
              {job.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={17} />
                  {job.location}
                </div>
              )}

              <div className="capitalize">
                Work mode: <strong>{job.work_mode}</strong>
              </div>

              <div>
                Minimum score:{' '}
                <strong className="text-slate-900">
                  {minimumScore}%
                </strong>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Eligible candidates
          </h2>

          <p className="text-sm text-slate-500">
            Candidates meeting the configured minimum match score.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            jobQuery.refetch()
            matchesQuery.refetch()
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-paper-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-paper-line bg-white p-10 text-center text-slate-500">
          Loading matched candidates...
        </div>
      ) : eligibleMatches.length === 0 ? (
        <div className="rounded-2xl border border-paper-line bg-white p-12 text-center">
          <Users className="mx-auto mb-4 text-slate-400" size={40} />

          <h3 className="text-lg font-bold text-slate-900">
            No eligible candidates
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            No candidate currently meets the configured minimum match score
            of {minimumScore}%.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {eligibleMatches.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              minimumScore={minimumScore}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateCard({
  candidate,
  minimumScore,
}: {
  candidate: Match
  minimumScore: number
}) {
  const score = Math.round(candidate.match_score)

  const skills = Array.isArray(candidate.tech_skills)
    ? candidate.tech_skills
    : []

  return (
    <div className="rounded-2xl border border-paper-line bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <User size={22} />
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">
              {candidate.full_name || 'Unnamed candidate'}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              {candidate.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={15} />
                  {candidate.email}
                </span>
              )}

              {candidate.graduation_year && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} />
                  Graduation {candidate.graduation_year}
                </span>
              )}

              {candidate.experience_level && (
                <span className="capitalize">
                  {candidate.experience_level}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="text-3xl font-black text-brand-700">
            {score}%
          </div>

          <div className="text-xs text-slate-500">
            Match score
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} />
            Eligible
          </span>
        </div>
      </div>

      <div className="my-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, score))}%`,
          }}
        />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Candidate skills
        </p>

        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            No skills listed
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
        <div className="text-xs text-slate-500">
          Required minimum: {minimumScore}%
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-paper-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Mail size={16} />
            View email
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => {
              alert(
                `Candidate notification will be sent to ${
                  candidate.full_name || candidate.email
                }.`
              )
            }}
          >
            <Send size={16} />
            Notify candidate
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-paper-line bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </div>

      <p className="text-sm text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-black capitalize text-slate-900">
        {value}
      </p>
    </div>
  )
}