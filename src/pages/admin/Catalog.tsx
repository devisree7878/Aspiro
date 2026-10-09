
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { supabase, unwrap } from '../../lib/supabase'
import ResourceManager from '../../components/ResourceManager'
import { PageHeader } from '../../components/ui'

const STATUS = ['draft', 'published', 'archived'].map(s => ({
  value: s,
  label: s,
}))

const JOB_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
]

type Skill = {
  id: string
  name: string
  category?: string | null
}

type Company = {
  id: string
  name: string
}

type Job = {
  id: string
  company_id: string
  title: string
  description?: string | null
  location?: string | null
  work_mode?: string | null
  experience_level?: string | null
  min_graduation_year?: number | null
  max_graduation_year?: number | null
  minimum_match_score?: number | null
  status: string
  application_deadline?: string | null
  created_at: string
}

export default function Catalog() {
  const [tab, setTab] = useState<
    'goals' | 'paths' | 'skills' | 'companies' | 'jobs'
  >('goals')

  const goals = useQuery({
    queryKey: ['career_goals', ''],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('career_goals')
          .select('id,name')
          .order('name')
      ) as any[],
  })

  const companies = useQuery({
    queryKey: ['companies', ''],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('companies')
          .select('id,name')
          .order('name')
      ) as Company[],
  })

  const skills = useQuery({
    queryKey: ['skills', ''],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('skills')
          .select('id,name,category')
          .order('name')
      ) as Skill[],
  })

  const goalOpts = [
    { value: '', label: '— none —' },
    ...(goals.data ?? []).map(g => ({
      value: g.id,
      label: g.name,
    })),
  ]

  const tabs = [
    ['goals', 'Career goals'],
    ['paths', 'Learning paths'],
    ['skills', 'Skills'],
    ['companies', 'Companies'],
    ['jobs', 'Jobs'],
  ] as const

  return (
    <div>
      <PageHeader
        title="Careers & skills"
        sub="Manage career goals, learning paths, skills, companies and job opportunities."
      />

      <div
        className="mb-6 flex flex-wrap gap-2"
        role="tablist"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? 'bg-brand-600 text-white'
                : 'border border-paper-line bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* =========================
          CAREER GOALS
      ========================= */}

      {tab === 'goals' && (
        <ResourceManager
          key="g"
          table="career_goals"
          title="Career goals"
          orderBy="name"
          searchKey="name"
          columns={[
            'name',
            'category',
            'is_active',
          ]}
          fields={[
            {
              key: 'name',
              label: 'Name',
              required: true,
            },
            {
              key: 'category',
              label: 'Category',
            },
            {
              key: 'description',
              label: 'Description',
              type: 'textarea',
            },
            {
              key: 'is_active',
              label: 'Active (visible to students)',
              type: 'checkbox',
            },
          ]}
        />
      )}

      {/* =========================
          LEARNING PATHS
      ========================= */}

      {tab === 'paths' && (
        <ResourceManager
          key="p"
          table="learning_paths"
          title="Learning paths"
          orderBy="title"
          searchKey="title"
          columns={[
            'title',
            'career_goal_id',
            'status',
          ]}
          fields={[
            {
              key: 'title',
              label: 'Title',
              required: true,
            },
            {
              key: 'career_goal_id',
              label: 'Career goal',
              type: 'select',
              options: goalOpts,
            },
            {
              key: 'description',
              label: 'Description',
              type: 'textarea',
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: STATUS,
            },
          ]}
        />
      )}

      {/* =========================
          SKILLS
      ========================= */}

      {tab === 'skills' && (
        <ResourceManager
          key="s"
          table="skills"
          title="Skills"
          orderBy="name"
          searchKey="name"
          columns={[
            'name',
            'category',
          ]}
          fields={[
            {
              key: 'name',
              label: 'Name',
              required: true,
            },
            {
              key: 'category',
              label: 'Category',
            },
            {
              key: 'description',
              label: 'Description',
              type: 'textarea',
            },
          ]}
        />
      )}

      {/* =========================
          COMPANIES
      ========================= */}

      {tab === 'companies' && (
        <ResourceManager
          key="c"
          table="companies"
          title="Companies"
          orderBy="name"
          searchKey="name"
          columns={[
            'name',
            'website',
            'location',
            'is_active',
          ]}
          fields={[
            {
              key: 'name',
              label: 'Company name',
              required: true,
            },
            {
              key: 'website',
              label: 'Website',
            },
            {
              key: 'location',
              label: 'Location',
            },
            {
              key: 'description',
              label: 'Description',
              type: 'textarea',
            },
            {
              key: 'is_active',
              label: 'Active',
              type: 'checkbox',
            },
          ]}
        />
      )}

      {/* =========================
          JOBS
      ========================= */}

      {tab === 'jobs' && (
        <JobsManager
          companies={companies.data ?? []}
          skills={skills.data ?? []}
        />
      )}
    </div>
  )
}

/* =========================================================
   JOB MANAGER
========================================================= */

function JobsManager({
  companies,
  skills,
}: {
  companies: Company[]
  skills: Skill[]
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)

  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [workMode, setWorkMode] = useState('any')
  const [experienceLevel, setExperienceLevel] =
    useState('beginner')

  const [minGraduationYear, setMinGraduationYear] =
    useState('')

  const [maxGraduationYear, setMaxGraduationYear] =
    useState('')

  /*
   * The value is controlled by the administrator.
   * No matching threshold is hard-coded into the matching engine.
   */
  const [minimumMatchScore, setMinimumMatchScore] =
    useState('')

  const [status, setStatus] = useState('draft')
  const [selectedSkills, setSelectedSkills] =
    useState<string[]>([])

  const [deadline, setDeadline] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const jobs = useQuery({
    queryKey: ['company_jobs'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('company_jobs')
          .select('*')
          .order('created_at', {
            ascending: false,
          })
      ) as Job[],
  })

  function resetForm() {
    setTitle('')
    setCompanyId('')
    setDescription('')
    setLocation('')
    setWorkMode('any')
    setExperienceLevel('beginner')
    setMinGraduationYear('')
    setMaxGraduationYear('')
    setMinimumMatchScore('')
    setStatus('draft')
    setSelectedSkills([])
    setDeadline('')
    setEditingJob(null)
    setError('')
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  async function openEdit(job: Job) {
    setEditingJob(job)

    setTitle(job.title)
    setCompanyId(job.company_id)
    setDescription(job.description ?? '')
    setLocation(job.location ?? '')
    setWorkMode(job.work_mode ?? 'any')
    setExperienceLevel(
      job.experience_level ?? 'beginner'
    )

    setMinGraduationYear(
      job.min_graduation_year?.toString() ?? ''
    )

    setMaxGraduationYear(
      job.max_graduation_year?.toString() ?? ''
    )

    setMinimumMatchScore(
      job.minimum_match_score?.toString() ?? ''
    )

    setStatus(job.status)

    setDeadline(
      job.application_deadline
        ? job.application_deadline.slice(0, 10)
        : ''
    )

    const { data, error } = await supabase
      .from('company_job_required_skills')
      .select('skill_id')
      .eq('job_id', job.id)

    if (error) {
      setError(error.message)
      return
    }

    setSelectedSkills(
      (data ?? []).map(
        (row: { skill_id: string }) =>
          row.skill_id
      )
    )

    setShowForm(true)
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills(current =>
      current.includes(skillId)
        ? current.filter(id => id !== skillId)
        : [...current, skillId]
    )
  }

  async function saveJob() {
    setError('')

    if (!title.trim()) {
      setError('Job title is required.')
      return
    }

    if (!companyId) {
      setError('Please select a company.')
      return
    }

    if (selectedSkills.length === 0) {
      setError(
        'Please select at least one required skill.'
      )
      return
    }

    if (!minimumMatchScore.trim()) {
      setError(
        'Please enter the minimum match score.'
      )
      return
    }

    const matchScore =
      Number(minimumMatchScore)

    if (
      !Number.isFinite(matchScore) ||
      matchScore < 0 ||
      matchScore > 100
    ) {
      setError(
        'Minimum match score must be between 0 and 100.'
      )
      return
    }

    if (
      minGraduationYear &&
      maxGraduationYear &&
      Number(minGraduationYear) >
        Number(maxGraduationYear)
    ) {
      setError(
        'Minimum graduation year cannot be greater than maximum graduation year.'
      )
      return
    }

    setSaving(true)

    try {
      const payload = {
        company_id: companyId,
        title: title.trim(),
        description:
          description.trim() || null,
        location:
          location.trim() || null,
        work_mode: workMode,
        experience_level: experienceLevel,

        min_graduation_year:
          minGraduationYear
            ? Number(minGraduationYear)
            : null,

        max_graduation_year:
          maxGraduationYear
            ? Number(maxGraduationYear)
            : null,

        minimum_match_score: matchScore,

        status,

        application_deadline:
          deadline
            ? new Date(
                `${deadline}T23:59:59`
              ).toISOString()
            : null,

        updated_at:
          new Date().toISOString(),
      }

      let jobId = editingJob?.id

      /* =========================
         CREATE / UPDATE JOB
      ========================= */

      if (editingJob) {
        const { error } = await supabase
          .from('company_jobs')
          .update(payload)
          .eq('id', editingJob.id)

        if (error) {
          throw error
        }
      } else {
        const { data, error } =
          await supabase
            .from('company_jobs')
            .insert(payload)
            .select('id')
            .single()

        if (error) {
          throw error
        }

        jobId = data.id
      }

      if (!jobId) {
        throw new Error(
          'Job ID was not created.'
        )
      }

      /* =========================
         SAVE REQUIRED SKILLS
      ========================= */

      const { error: deleteError } =
        await supabase
          .from(
            'company_job_required_skills'
          )
          .delete()
          .eq('job_id', jobId)

      if (deleteError) {
        throw deleteError
      }

      const skillRows =
        selectedSkills.map(skillId => ({
          job_id: jobId,
          skill_id: skillId,
        }))

      const { error: skillError } =
        await supabase
          .from(
            'company_job_required_skills'
          )
          .insert(skillRows)

      if (skillError) {
        throw skillError
      }

      /* =========================
         PUBLISH + MATCH
      ========================= */

      let matchedCount: number | null =
        null

      if (status === 'published') {
        const {
          data: matchResult,
          error: matchError,
        } = await supabase.rpc(
          'publish_and_match_job',
          {
            p_job_id: jobId,
          }
        )

        if (matchError) {
          throw new Error(
            `Job saved, but automatic matching failed: ${matchError.message}`
          )
        }

        matchedCount =
          typeof matchResult === 'number'
            ? matchResult
            : Number(
                matchResult ?? 0
              )

        console.log(
          'ASPIRO matching completed.',
          {
            jobId,
            minimumMatchScore:
              matchScore,
            matchedCount,
          }
        )
      }

      /* =========================
         REFRESH
      ========================= */

      await queryClient.invalidateQueries(
        {
          queryKey: ['company_jobs'],
        }
      )

      /* =========================
         SUCCESS
      ========================= */

      if (status === 'published') {
        alert(
          `Job published successfully!\n\n` +
          `Minimum match score: ${matchScore}%\n` +
          `Eligible candidates matched: ${
            matchedCount ?? 0
          }`
        )
      } else {
        alert(
          editingJob
            ? 'Job updated successfully.'
            : 'Job created successfully.'
        )
      }

      resetForm()
      setShowForm(false)
    } catch (err: any) {
      console.error(
        'JOB SAVE ERROR:',
        err
      )

      setError(
        err?.message ||
          'Something went wrong while saving the job.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteJob(
    jobId: string
  ) {
    const ok = window.confirm(
      'Delete this job? This cannot be undone.'
    )

    if (!ok) {
      return
    }

    const { error } =
      await supabase
        .from('company_jobs')
        .delete()
        .eq('id', jobId)

    if (error) {
      alert(error.message)
      return
    }

    await queryClient.invalidateQueries(
      {
        queryKey: ['company_jobs'],
      }
    )
  }

  const companyName = (
    companyId: string
  ) =>
    companies.find(
      company =>
        company.id === companyId
    )?.name ?? 'Unknown company'

  const skillName = (
    skillId: string
  ) =>
    skills.find(
      skill =>
        skill.id === skillId
    )?.name ?? 'Unknown skill'

  return (
    <div>
      {/* =========================
          HEADER
      ========================= */}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Jobs
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create jobs, define required skills
            and publish them for automatic
            student matching.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New job
        </button>
      </div>

      {/* =========================
          FORM
      ========================= */}

      {showForm && (
        <div className="mb-8 rounded-2xl border border-paper-line bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {editingJob
                  ? 'Edit job'
                  : 'Create job'}
              </h3>

              <p className="text-sm text-slate-500">
                Add the job details, eligibility
                threshold and required skills.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {/* JOB TITLE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Job title *
              </label>

              <input
                value={title}
                onChange={e =>
                  setTitle(e.target.value)
                }
                placeholder="Software Engineer Intern"
                className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            {/* COMPANY */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Company *
              </label>

              <select
                value={companyId}
                onChange={e =>
                  setCompanyId(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-paper-line bg-white px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="">
                  Select company
                </option>

                {companies.map(company => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* LOCATION */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Location
              </label>

              <input
                value={location}
                onChange={e =>
                  setLocation(
                    e.target.value
                  )
                }
                placeholder="Bengaluru"
                className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            {/* WORK MODE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Work mode
              </label>

              <select
                value={workMode}
                onChange={e =>
                  setWorkMode(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-paper-line bg-white px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="any">
                  Any
                </option>

                <option value="remote">
                  Remote
                </option>

                <option value="hybrid">
                  Hybrid
                </option>

                <option value="onsite">
                  On-site
                </option>
              </select>
            </div>

            {/* EXPERIENCE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Experience level
              </label>

              <select
                value={experienceLevel}
                onChange={e =>
                  setExperienceLevel(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-paper-line bg-white px-3 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="beginner">
                  Beginner / Fresher
                </option>

                <option value="intermediate">
                  Intermediate
                </option>

                <option value="advanced">
                  Advanced
                </option>
              </select>
            </div>

            {/* STATUS */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Status
              </label>

              <select
                value={status}
                onChange={e =>
                  setStatus(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-paper-line bg-white px-3 py-2.5 outline-none focus:border-brand-500"
              >
                {JOB_STATUS.map(
                  option => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* MIN GRADUATION */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Minimum graduation year
              </label>

              <input
                type="number"
                value={
                  minGraduationYear
                }
                onChange={e =>
                  setMinGraduationYear(
                    e.target.value
                  )
                }
                placeholder="2026"
                className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            {/* MAX GRADUATION */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Maximum graduation year
              </label>

              <input
                type="number"
                value={
                  maxGraduationYear
                }
                onChange={e =>
                  setMaxGraduationYear(
                    e.target.value
                  )
                }
                placeholder="2028"
                className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            {/* MINIMUM MATCH SCORE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Minimum match score *
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    minimumMatchScore
                  }
                  onChange={e =>
                    setMinimumMatchScore(
                      e.target.value
                    )
                  }
                  placeholder="Enter score"
                  className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
                />

                <span className="font-semibold text-slate-500">
                  %
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Candidates below this score
                will not be eligible.
              </p>
            </div>

            {/* DEADLINE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Application deadline
              </label>

              <input
                type="date"
                value={deadline}
                onChange={e =>
                  setDeadline(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* DESCRIPTION */}

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Job description
            </label>

            <textarea
              value={description}
              onChange={e =>
                setDescription(
                  e.target.value
                )
              }
              rows={5}
              placeholder="Describe the role, responsibilities and expectations..."
              className="w-full rounded-xl border border-paper-line px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </div>

          {/* REQUIRED SKILLS */}

          <div className="mt-6">
            <div className="mb-2">
              <h4 className="text-sm font-bold text-slate-900">
                Required skills *
              </h4>

              <p className="text-xs text-slate-500">
                These skills are used by ASPIRO's
                matching engine.
              </p>
            </div>

            {skills.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No skills are available yet.
                Go to the{' '}
                <strong>Skills</strong> tab
                and create skills first.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {skills.map(skill => {
                  const selected =
                    selectedSkills.includes(
                      skill.id
                    )

                  return (
                    <button
                      type="button"
                      key={skill.id}
                      onClick={() =>
                        toggleSkill(
                          skill.id
                        )
                      }
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-paper-line bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                            selected
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {selected
                            ? '✓'
                            : ''}
                        </span>

                        <span className="font-semibold">
                          {skill.name}
                        </span>
                      </div>

                      {skill.category && (
                        <div className="mt-1 ml-7 text-xs text-slate-400">
                          {skill.category}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* SAVE */}

          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="rounded-xl border border-paper-line px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={saveJob}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : status ===
                    'published'
                  ? 'Publish & Match'
                  : editingJob
                    ? 'Update Job'
                    : 'Create Job'}
            </button>
          </div>
        </div>
      )}

      {/* =========================
          JOB LIST
      ========================= */}

      {jobs.isLoading && (
        <div className="rounded-2xl border border-paper-line bg-white p-8 text-center text-sm text-slate-500">
          Loading jobs...
        </div>
      )}

      {jobs.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {(jobs.error as any)
            ?.message ||
            'Could not load jobs.'}
        </div>
      )}

      {!jobs.isLoading &&
        !jobs.error &&
        (jobs.data ?? []).length ===
          0 && (
          <div className="rounded-2xl border border-paper-line bg-white p-10 text-center">
            <h3 className="font-bold text-slate-900">
              No jobs yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Create your first company job
              opportunity.
            </p>
          </div>
        )}

      <div className="space-y-4">
        {(jobs.data ?? []).map(job => (
          <div
            key={job.id}
            className="rounded-2xl border border-paper-line bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {job.title}
                  </h3>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      job.status ===
                      'published'
                        ? 'bg-green-100 text-green-700'
                        : job.status ===
                            'closed'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold text-brand-700">
                  {companyName(
                    job.company_id
                  )}
                </p>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {job.location && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1">
                      {job.location}
                    </span>
                  )}

                  {job.work_mode && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1">
                      {job.work_mode}
                    </span>
                  )}

                  {job.experience_level && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1">
                      {job.experience_level}
                    </span>
                  )}

                  <span className="rounded-lg bg-brand-50 px-2 py-1 font-semibold text-brand-700">
                    Min match:{' '}
                    {job.minimum_match_score ??
                      '—'}
                    %
                  </span>
                </div>

                {job.description && (
                  <p className="mt-3 max-w-3xl text-sm text-slate-600">
                    {job.description}
                  </p>
                )}

                <JobSkills
                  jobId={job.id}
                  skillName={skillName}
                />
              </div>

              {/* =========================
                  ACTIONS
              ========================= */}

              <div className="flex shrink-0 flex-wrap gap-2">
                {job.status ===
                  'published' && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/admin/matches/${job.id}`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <Users size={16} />
                    View Matches
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    openEdit(job)
                  }
                  className="rounded-xl border border-paper-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteJob(job.id)
                  }
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   JOB SKILLS DISPLAY
========================================================= */

function JobSkills({
  jobId,
  skillName,
}: {
  jobId: string
  skillName: (id: string) => string
}) {
  const result = useQuery({
    queryKey: [
      'job_required_skills',
      jobId,
    ],

    queryFn: async () =>
      unwrap(
        await supabase
          .from(
            'company_job_required_skills'
          )
          .select('skill_id')
          .eq('job_id', jobId)
      ) as { skill_id: string }[],
  })

  if (result.isLoading) {
    return (
      <div className="mt-4 text-xs text-slate-400">
        Loading required skills...
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="mt-4 text-xs text-red-500">
        Could not load required skills.
      </div>
    )
  }

  const selected =
    result.data ?? []

  if (selected.length === 0) {
    return (
      <div className="mt-4 text-xs text-red-500">
        No required skills configured.
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        Required skills
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map(row => (
          <span
            key={row.skill_id}
            className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
          >
            {skillName(
              row.skill_id
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
