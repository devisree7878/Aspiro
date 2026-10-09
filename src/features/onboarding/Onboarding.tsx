
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'

import {
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Empty,
  ErrorBox,
} from '../../components/ui'

const OBJECTIVES = [
  'Internship',
  'Job',
  'Placement',
  'Competitive exam',
  'Career skills',
]

const TIMELINES = [30, 60, 90, 180, 365]

const DAILY = [
  { v: 30, l: '30 minutes' },
  { v: 60, l: '1 hour' },
  { v: 120, l: '2 hours' },
  { v: 180, l: '3+ hours' },
]

const STEPS = [
  'Career direction',
  'Skills',
  'Target role',
  'Job preferences',
  'About you',
  'Learning plan',
]

const SUGGESTED_SKILLS = [
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'C++',
  'SQL',
  'HTML',
  'CSS',
  'Git',
  'DSA',
  'OOP',
  'React',
  'Spring Boot',
  'Node.js',
  'Machine Learning',
]

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const url = z
  .string()
  .trim()
  .url('Enter a full URL (https://...)')
  .or(z.literal(''))

const schemas = [
  // STEP 0 — Career direction
  z.object({}),

  // STEP 1 — Skills
  z.object({
    experience_level: z.enum([
      'beginner',
      'intermediate',
      'advanced',
    ]),
    github_url: url,
    linkedin_url: url,
  }),

  // STEP 2 — Target role
  z.object({}),

  // STEP 3 — Job preferences
  z.object({}),

  // STEP 4 — About you
  z.object({
    full_name: z.string().trim().min(2, 'Required'),
    institution: z.string().trim().min(2, 'Required'),
    degree: z.string().trim().min(2, 'Required'),
    branch: z.string().trim().min(2, 'Required'),
    graduation_year: z.coerce
      .number()
      .int()
      .min(2000, 'Enter a valid year')
      .max(2100, 'Enter a valid year'),
    location: z.string().trim().min(2, 'Required'),
  }),

  // STEP 5 — Learning plan
  z.object({}),
]

export default function Onboarding() {
  const { profile, session, isAdmin, refresh } = useAuth()
  const nav = useNavigate()

  const [step, setStep] = useState(0)
  const [err, setErr] = useState<Record<string, string>>({})
  const [fail, setFail] = useState('')
  const [busy, setBusy] = useState(false)

  const [v, setV] = useState<Record<string, any>>({
    full_name: profile?.full_name ?? '',
    institution: '',
    degree: '',
    branch: '',
    graduation_year: '',
    location: '',

    experience_level: 'beginner',

    languages: '',
    tech_skills: '',

    github_url: '',
    linkedin_url: '',

    goals: [] as string[],
    objectives: [] as string[],

    target_role_id: '',
    target_role_name: '',

    preferred_location: '',
    work_mode: 'any',
    willing_to_relocate: false,
    company_type: '',

    target_days: 90,
    daily_minutes: 60,
    notifications_enabled: true,
  })

  const [resume, setResume] = useState<File | null>(null)

  /*
   * ============================================================
   * CAREER GOALS
   * ============================================================
   */

  const goals = useQuery({
    queryKey: ['student-career-goals'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('career_goals')
          .select(
            'id,name,description,category'
          )
          .eq('is_active', true)
          .order('name'),
      ),
  })

  /*
   * ============================================================
   * TARGET ROLES / LEARNING PATHS
   * ============================================================
   *
   * Admin creates learning paths under a career goal.
   *
   * Example:
   *
   * Software Engineer
   *   ├── Java Developer
   *   ├── Python Developer
   *   └── Full Stack Developer
   *
   * Only published paths are shown.
   */

  const targetRoles = useQuery({
    queryKey: [
      'student-target-roles',
      v.goals[0],
    ],

    enabled: Boolean(v.goals[0]),

    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_paths')
        .select(
          'id,title,description,career_goal_id,status',
        )
        .eq(
          'career_goal_id',
          v.goals[0],
        )
        .eq('status', 'published')
        .order('title')

      if (error) throw error

      return data ?? []
    },
  })

  /*
   * Admins should not complete student onboarding.
   */

  if (profile?.onboarding_completed || isAdmin) {
    return <Navigate to="/" replace />
  }

  /*
   * ============================================================
   * STATE HELPERS
   * ============================================================
   */

  const set = (
    key: string,
    value: any,
  ) => {
    setV((s) => ({
      ...s,
      [key]: value,
    }))
  }

  const toggle = (
    key: 'goals' | 'objectives',
    value: string,
    max = 99,
  ) => {
    setV((s) => {
      const arr: string[] = s[key]

      return {
        ...s,
        [key]: arr.includes(value)
          ? arr.filter(
              (x) => x !== value,
            )
          : arr.length < max
            ? [...arr, value]
            : arr,
      }
    })
  }

  /*
   * ============================================================
   * QUICK ADD SKILLS
   * ============================================================
   */

  const addSkill = (skill: string) => {
    const existing = list(
      v.tech_skills,
    )

    if (
      existing.some(
        (x) =>
          x.toLowerCase() ===
          skill.toLowerCase(),
      )
    ) {
      return
    }

    set(
      'tech_skills',
      [...existing, skill].join(', '),
    )
  }

  /*
   * ============================================================
   * TARGET ROLE
   * ============================================================
   */

  const selectTargetRole = (
    role: any,
  ) => {
    setV((s) => ({
      ...s,
      target_role_id: role.id,
      target_role_name: role.title,
    }))
  }

  /*
   * ============================================================
   * VALIDATION + NEXT
   * ============================================================
   */

  const next = () => {
    const result =
      schemas[step].safeParse(v)

    if (!result.success) {
      setErr(
        Object.fromEntries(
          result.error.issues.map(
            (issue) => [
              String(
                issue.path[0],
              ),
              issue.message,
            ],
          ),
        ),
      )

      return
    }

    /*
     * Career direction is required.
     */

    if (
      step === 0 &&
      v.goals.length === 0
    ) {
      setErr({
        goals:
          'Select at least one career direction.',
      })

      return
    }

    /*
     * At least one objective is required.
     */

    if (
      step === 0 &&
      v.objectives.length === 0
    ) {
      setErr({
        objectives:
          'Select at least one opportunity you are looking for.',
      })

      return
    }

    /*
     * Target role is mandatory.
     */

    if (
      step === 2 &&
      !v.target_role_id
    ) {
      setErr({
        target_role_id:
          'Select the role you want ASPIRO to prepare you for.',
      })

      return
    }

    setErr({})
    setStep((current) => current + 1)
  }

  /*
   * ============================================================
   * FINISH ONBOARDING
   * ============================================================
   */

  const finish = async () => {
    if (!session?.user?.id) {
      setFail(
        'Your session has expired. Please sign in again.',
      )

      return
    }

    if (!v.goals?.length) {
      setFail(
        'Please select a career direction.',
      )

      return
    }

    if (!v.target_role_id) {
      setFail(
        'Please select a target role.',
      )

      return
    }

    setBusy(true)
    setFail('')

    try {
      const uid =
        session.user.id

      /*
       * ----------------------------------------------------------
       * 1. Upload resume
       * ----------------------------------------------------------
       */

      let resume_path:
        | string
        | null = null

      if (resume) {
        if (
          resume.size >
          5_000_000
        ) {
          throw new Error(
            'Resume must be under 5 MB.',
          )
        }

        resume_path =
          `${uid}/resume-${Date.now()}-${resume.name.replace(
            /[^\w.-]/g,
            '_',
          )}`

        const upload =
          await supabase.storage
            .from('resumes')
            .upload(
              resume_path,
              resume,
            )

        if (upload.error) {
          throw upload.error
        }
      }

      /*
       * ----------------------------------------------------------
       * 2. Save profile
       * ----------------------------------------------------------
       */

      const profileUpdate =
        await supabase
          .from('profiles')
          .update({
            full_name:
              v.full_name,

            institution:
              v.institution,

            degree: v.degree,

            branch: v.branch,

            graduation_year:
              Number(
                v.graduation_year,
              ),

            location:
              v.location,

            experience_level:
              v.experience_level,

            languages:
              list(v.languages),

            tech_skills:
              list(v.tech_skills),

            resume_path,

            github_url:
              v.github_url ||
              null,

            linkedin_url:
              v.linkedin_url ||
              null,

            objectives:
              v.objectives,

            preferred_location:
              v.preferred_location ||
              null,

            work_mode:
              v.work_mode,

            willing_to_relocate:
              v.willing_to_relocate,

            company_type:
              v.company_type ||
              null,

            target_days:
              v.target_days,

            daily_minutes:
              v.daily_minutes,

            notifications_enabled:
              v.notifications_enabled,

            onboarding_completed:
              true,
          })
          .eq('id', uid)

      if (profileUpdate.error) {
        throw new Error(
          `Profile save failed: ${profileUpdate.error.message}`,
        )
      }

      /*
       * ----------------------------------------------------------
       * 3. Save career goals
       * ----------------------------------------------------------
       */

      const deleteGoals =
        await supabase
          .from(
            'student_career_goals',
          )
          .delete()
          .eq(
            'student_id',
            uid,
          )

      if (deleteGoals.error) {
        throw new Error(
          `Career goal cleanup failed: ${deleteGoals.error.message}`,
        )
      }

      const goalInsert =
        await supabase
          .from(
            'student_career_goals',
          )
          .insert(
            v.goals.map(
              (
                id: string,
                index: number,
              ) => ({
                student_id: uid,
                career_goal_id:
                  id,
                position:
                  index,
              }),
            ),
          )

      if (goalInsert.error) {
        throw new Error(
          `Career goal save failed: ${goalInsert.error.message}`,
        )
      }

      /*
       * ----------------------------------------------------------
       * 4. Create EXACT learning journey
       * ----------------------------------------------------------
       *
       * IMPORTANT:
       *
       * The selected career goal and selected learning path
       * are both passed to the RPC.
       *
       * Example:
       *
       * Software Engineer
       *        ↓
       * Java Developer
       *        ↓
       * Java learning journey
       *
       * This prevents ASPIRO from creating an unrelated
       * published learning path.
       */

      const enrollment =
        await supabase.rpc(
          'enroll_in_goal',
          {
            p_goal:
              v.goals[0],

            p_learning_path:
              v.target_role_id,

            p_target_days:
              v.target_days,

            p_daily_minutes:
              v.daily_minutes,
          },
        )

      if (enrollment.error) {
        throw new Error(
          `Journey creation failed: ${enrollment.error.message}`,
        )
      }

      /*
       * ----------------------------------------------------------
       * 5. Refresh profile/auth state
       * ----------------------------------------------------------
       */

      await refresh()

      /*
       * ----------------------------------------------------------
       * 6. Open Jobs page
       * ----------------------------------------------------------
       *
       * The student has now completed the information needed
       * for automatic job matching.
       */

      nav('/jobs', {
        replace: true,
      })
    } catch (error: any) {
      console.error(
        'ASPIRO ONBOARDING SAVE ERROR:',
        error,
      )

      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        error?.hint ||
        'Could not save your profile.'

      setFail(message)
      setBusy(false)
    }
  }

  /*
   * ============================================================
   * UI HELPERS
   * ============================================================
   */

  const E = (key: string) =>
    err[key]

  const txt = (
    key: string,
    label: string,
    props: any = {},
  ) => (
    <Field
      label={label}
      error={E(key)}
    >
      <Input
        value={v[key]}
        onChange={(e) =>
          set(
            key,
            e.target.value,
          )
        }
        {...props}
      />
    </Field>
  )

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">

      <div className="mb-2 text-xl font-extrabold">
        ASPIRO
      </div>

      <p className="mb-8 text-sm text-ink-soft">
        Tell us where you want your career
        to go. ASPIRO will use your career
        goals, skills and job preferences to
        personalize your learning journey and
        match you with relevant opportunities.
      </p>

      {/* PROGRESS */}

      <ol
        className="mb-8 flex gap-2"
        aria-label="Onboarding progress"
      >
        {STEPS.map(
          (label, index) => (
            <li
              key={label}
              className="flex-1"
            >
              <div
                className={`h-1.5 rounded-full ${
                  index <= step
                    ? 'bg-brand-500'
                    : 'bg-paper-line'
                }`}
              />

              <span
                className={`mt-1 block text-xs ${
                  index === step
                    ? 'font-bold'
                    : 'text-ink-mute'
                }`}
              >
                {label}
              </span>
            </li>
          ),
        )}
      </ol>

      <div className="space-y-6 rounded-2xl border border-paper-line bg-white p-6 shadow-soft">

        {/* ======================================================
            STEP 0 — CAREER DIRECTION
           ====================================================== */}

        {step === 0 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                Where do you want your career to go?
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                Choose the career directions
                you are interested in. ASPIRO
                will use these to personalize
                learning paths and job
                opportunities.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">
                Career direction
                <span className="ml-1 font-normal text-ink-mute">
                  Choose up to 3
                </span>
              </p>

              {goals.isLoading ? (
                <Spinner />
              ) : goals.error ? (
                <ErrorBox
                  error={goals.error}
                  onRetry={() =>
                    goals.refetch()
                  }
                />
              ) : !goals.data?.length ? (
                <Empty
                  title="No career paths available yet"
                  body="Your administrator has not published any career goals yet."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {goals.data.map(
                    (goal: any) => {
                      const selected =
                        v.goals.includes(
                          goal.id,
                        )

                      return (
                        <button
                          key={goal.id}
                          type="button"
                          aria-pressed={
                            selected
                          }
                          onClick={() =>
                            toggle(
                              'goals',
                              goal.id,
                              3,
                            )
                          }
                          className={`rounded-2xl border p-4 text-left transition ${
                            selected
                              ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100'
                              : 'border-paper-line hover:border-brand-300 hover:bg-brand-50/40'
                          }`}
                        >
                          <div className="font-bold">
                            {goal.name}
                          </div>

                          {goal.description && (
                            <div className="mt-1 text-xs text-ink-soft">
                              {
                                goal.description
                              }
                            </div>
                          )}

                          {goal.category && (
                            <div className="mt-2 text-xs font-semibold text-brand-600">
                              {
                                goal.category
                              }
                            </div>
                          )}
                        </button>
                      )
                    },
                  )}
                </div>
              )}

              {E('goals') && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {E('goals')}
                </p>
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">
                What are you looking for?
              </p>

              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map(
                  (objective) => {
                    const selected =
                      v.objectives.includes(
                        objective,
                      )

                    return (
                      <button
                        key={
                          objective
                        }
                        type="button"
                        aria-pressed={
                          selected
                        }
                        onClick={() =>
                          toggle(
                            'objectives',
                            objective,
                          )
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          selected
                            ? 'border-ember-500 bg-ember-500 text-white'
                            : 'border-paper-line bg-white hover:bg-ember-50'
                        }`}
                      >
                        {objective}
                      </button>
                    )
                  },
                )}
              </div>

              {E('objectives') && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {E('objectives')}
                </p>
              )}
            </div>
          </>
        )}

        {/* ======================================================
            STEP 1 — SKILLS
           ====================================================== */}

        {step === 1 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                What skills can you bring?
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                These skills will be used when
                calculating your job match score.
              </p>
            </div>

            {txt(
              'languages',
              'Programming languages',
              {
                placeholder:
                  'Java, Python, JavaScript',
              },
            )}

            {txt(
              'tech_skills',
              'Technical skills',
              {
                placeholder:
                  'SQL, React, Git, DSA, Spring Boot',
              },
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-ink-soft">
                Quick add skills
              </p>

              <div className="flex flex-wrap gap-2">
                {SUGGESTED_SKILLS.map(
                  (skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        addSkill(
                          skill,
                        )
                      }
                      className="rounded-full border border-paper-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-brand-400 hover:bg-brand-50"
                    >
                      + {skill}
                    </button>
                  ),
                )}
              </div>
            </div>

            <Field label="Current experience level">
              <Select
                value={
                  v.experience_level
                }
                onChange={(e) =>
                  set(
                    'experience_level',
                    e.target.value,
                  )
                }
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
              </Select>
            </Field>

            <Field label="Resume (optional, PDF/DOC, max 5 MB)">
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setResume(
                    e.target.files?.[0] ??
                      null,
                  )
                }
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {txt(
                'github_url',
                'GitHub',
                {
                  placeholder:
                    'https://github.com/you',
                },
              )}

              {txt(
                'linkedin_url',
                'LinkedIn',
                {
                  placeholder:
                    'https://linkedin.com/in/you',
                },
              )}
            </div>
          </>
        )}

        {/* ======================================================
            STEP 2 — TARGET ROLE
           ====================================================== */}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                Which role do you want to prepare for?
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                Select the exact learning path
                ASPIRO should use to build your
                preparation journey.
              </p>
            </div>

            {targetRoles.isLoading ? (
              <Spinner />
            ) : targetRoles.error ? (
              <ErrorBox
                error={
                  targetRoles.error
                }
                onRetry={() =>
                  targetRoles.refetch()
                }
              />
            ) : !v.goals.length ? (
              <Empty
                title="Select a career direction first"
                body="Go back and select a career goal."
              />
            ) : !targetRoles.data?.length ? (
              <Empty
                title="No published roles yet"
                body="Your administrator has not published a learning path for this career direction yet."
              />
            ) : (
              <div className="grid gap-3">
                {targetRoles.data.map(
                  (role: any) => {
                    const selected =
                      v.target_role_id ===
                      role.id

                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() =>
                          selectTargetRole(
                            role,
                          )
                        }
                        className={`rounded-2xl border p-5 text-left transition ${
                          selected
                            ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                            : 'border-paper-line bg-white hover:border-brand-400 hover:bg-brand-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-bold">
                              {
                                role.title
                              }
                            </p>

                            {role.description && (
                              <p className="mt-1 text-sm text-ink-soft">
                                {
                                  role.description
                                }
                              </p>
                            )}
                          </div>

                          {selected && (
                            <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                              Selected
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  },
                )}
              </div>
            )}

            {E('target_role_id') && (
              <p className="text-xs font-medium text-red-600">
                {E(
                  'target_role_id',
                )}
              </p>
            )}

            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-bold">
                Selected career direction
              </p>

              <p className="mt-1 text-sm text-ink-soft">
                {v.goals.length
                  ? goals.data
                      ?.filter(
                        (goal: any) =>
                          v.goals.includes(
                            goal.id,
                          ),
                      )
                      .map(
                        (goal: any) =>
                          goal.name,
                      )
                      .join(', ')
                  : 'None selected'}
              </p>
            </div>
          </>
        )}

        {/* ======================================================
            STEP 3 — JOB PREFERENCES
           ====================================================== */}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                What kind of job are you looking for?
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                These preferences directly affect
                how ASPIRO matches you with jobs.
              </p>
            </div>

            {txt(
              'preferred_location',
              'Preferred work location',
              {
                placeholder:
                  'Hyderabad, Bengaluru, Chennai, Anywhere',
              },
            )}

            <Field label="Preferred work mode">
              <Select
                value={v.work_mode}
                onChange={(e) =>
                  set(
                    'work_mode',
                    e.target.value,
                  )
                }
              >
                <option value="any">
                  Any mode
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
              </Select>
            </Field>

            <label className="flex items-center gap-3 rounded-xl border border-paper-line p-4 text-sm font-semibold">
              <input
                type="checkbox"
                checked={
                  v.willing_to_relocate
                }
                onChange={(e) =>
                  set(
                    'willing_to_relocate',
                    e.target.checked,
                  )
                }
              />

              <span>
                I'm willing to relocate for
                the right opportunity.
              </span>
            </label>

            <Field label="Preferred company type">
              <Select
                value={
                  v.company_type
                }
                onChange={(e) =>
                  set(
                    'company_type',
                    e.target.value,
                  )
                }
              >
                <option value="">
                  No preference
                </option>

                <option>
                  Startup
                </option>

                <option>
                  Product company
                </option>

                <option>
                  Service company
                </option>

                <option>
                  Government / PSU
                </option>

                <option>
                  Banking & finance
                </option>
              </Select>
            </Field>

            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-bold">
                How ASPIRO matches jobs
              </p>

              <p className="mt-1 text-xs leading-5 text-ink-soft">
                ASPIRO compares your skills,
                career interests, preferred
                location, work mode, graduation
                year and experience level against
                published opportunities.
              </p>
            </div>
          </>
        )}

        {/* ======================================================
            STEP 4 — ABOUT YOU
           ====================================================== */}

        {step === 4 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                Tell us about yourself
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                This information helps ASPIRO
                determine eligibility for
                relevant opportunities.
              </p>
            </div>

            {txt(
              'full_name',
              'Full name',
            )}

            {txt(
              'institution',
              'College / institution',
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {txt(
                'degree',
                'Degree',
                {
                  placeholder:
                    'B.Tech',
                },
              )}

              {txt(
                'branch',
                'Branch / specialization',
                {
                  placeholder:
                    'Computer Science',
                },
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {txt(
                'graduation_year',
                'Graduation year',
                {
                  type: 'number',
                  placeholder:
                    '2028',
                },
              )}

              {txt(
                'location',
                'Current location',
                {
                  placeholder:
                    'City, State',
                },
              )}
            </div>
          </>
        )}

        {/* ======================================================
            STEP 5 — LEARNING PLAN
           ====================================================== */}

        {step === 5 && (
          <>
            <div>
              <h2 className="text-xl font-bold">
                How do you want to prepare?
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                ASPIRO will use this information
                to create your personalized
                learning journey.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">
                Target preparation timeline
              </p>

              <div className="flex flex-wrap gap-2">
                {TIMELINES.map(
                  (days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={
                        v.target_days ===
                        days
                      }
                      onClick={() =>
                        set(
                          'target_days',
                          days,
                        )
                      }
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                        v.target_days ===
                        days
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-paper-line bg-white'
                      }`}
                    >
                      {days} days
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">
                Daily learning time
              </p>

              <div className="flex flex-wrap gap-2">
                {DAILY.map(
                  (item) => (
                    <button
                      key={item.v}
                      type="button"
                      aria-pressed={
                        v.daily_minutes ===
                        item.v
                      }
                      onClick={() =>
                        set(
                          'daily_minutes',
                          item.v,
                        )
                      }
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                        v.daily_minutes ===
                        item.v
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-paper-line bg-white'
                      }`}
                    >
                      {item.l}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-bold">
                Your selected preparation path
              </p>

              <p className="mt-1 text-sm text-ink-soft">
                {v.target_role_name ||
                  'No target role selected'}
              </p>
            </div>

            <div className="rounded-2xl border border-paper-line p-4">
              <p className="text-sm font-bold">
                Career interests
              </p>

              <p className="mt-1 text-sm text-ink-soft">
                {v.objectives.length
                  ? v.objectives.join(
                      ', ',
                    )
                  : 'No interests selected'}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={
                  v.notifications_enabled
                }
                onChange={(e) =>
                  set(
                    'notifications_enabled',
                    e.target.checked,
                  )
                }
              />

              <span>
                Notify me about relevant jobs,
                companies, learning opportunities
                and important deadlines.
              </span>
            </label>

            {fail && (
              <ErrorBox error={fail} />
            )}
          </>
        )}

        {/* ======================================================
            NAVIGATION
           ====================================================== */}

        <div className="flex justify-between pt-2">
          <Button
            variant="ghost"
            disabled={
              step === 0 || busy
            }
            onClick={() =>
              setStep(
                (current) =>
                  current - 1,
              )
            }
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={next}
              disabled={busy}
            >
              Continue
            </Button>
          ) : (
            <Button
              loading={busy}
              onClick={finish}
            >
              Build my career profile
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}