import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Check,
  ChevronDown,
  Code2,
  Database,
  Lightbulb,
  Plus,
  Search,
  Star,
  Target,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthContext'
import {
  Card,
  Empty,
  ErrorBox,
  Progress,
  Spinner,
  Badge,
} from '../../components/ui'
import { useToast } from '../../components/Toast'

const WEAK = 60

type CatalogSkill = {
  id: string
  name: string
  category: string | null
  description: string | null
}

type VerifiedSkill = {
  skill_id: string
  name: string
  score: number
  evidence_count: number
}

function categoryIcon(category?: string | null) {
  const value = (category || '').toLowerCase()

  if (
    value.includes('database') ||
    value.includes('sql')
  ) {
    return Database
  }

  if (
    value.includes('tool') ||
    value.includes('devops')
  ) {
    return Wrench
  }

  if (
    value.includes('program') ||
    value.includes('development') ||
    value.includes('coding')
  ) {
    return Code2
  }

  return Target
}

function categoryLabel(category?: string | null) {
  return category || 'General'
}

export default function Skills() {
  const { session } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const uid = session!.user.id

  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  /*
   * IMPORTANT:
   * All React hooks are declared before any conditional return.
   * This prevents:
   * "Rendered more hooks than during the previous render."
   */
  const q = useQuery({
    queryKey: ['skills', uid],

    queryFn: async () => {
      const [
        scoresResult,
        skillsResult,
        profileResult,
        progressResult,
      ] = await Promise.all([
        supabase
          .from('student_skill_scores')
          .select(
            'skill_id,score,evidence_count',
          )
          .eq('student_id', uid),

        supabase
          .from('skills')
          .select(
            'id,name,category,description',
          )
          .order('name'),

        supabase
          .from('profiles')
          .select('tech_skills')
          .eq('id', uid)
          .single(),

        supabase
          .from('activity_progress')
          .select('activity_id')
          .eq('student_id', uid)
          .eq('status', 'completed'),
      ])

      const scores = unwrap(scoresResult)
      const skills = unwrap(
        skillsResult,
      ) as CatalogSkill[]

      const profileData = unwrap(
        profileResult,
      ) as {
        tech_skills?: string[] | null
      }

      const progress = unwrap(
        progressResult,
      )

      const names = new Map(
        skills.map((s) => [
          s.id,
          s.name,
        ]),
      )

      const rows = (
        scores as any[]
      )
        .map(
          (r): VerifiedSkill => ({
            skill_id: r.skill_id,
            name:
              names.get(r.skill_id) ??
              'Skill',
            score: Number(r.score),
            evidence_count:
              Number(
                r.evidence_count,
              ),
          }),
        )
        .sort(
          (a, b) =>
            a.score - b.score,
        )

      const done = new Set(
        (progress as any[]).map(
          (p) => p.activity_id,
        ),
      )

      const weak = rows
        .filter(
          (r) => r.score < WEAK,
        )
        .slice(0, 3)

      const recs: Record<
        string,
        any
      > = {}

      for (const w of weak) {
        const { data } =
          await supabase
            .from('activity_skills')
            .select(
              'activities(id,title,type,day_id)',
            )
            .eq(
              'skill_id',
              w.skill_id,
            )

        const cand = (
          data ?? []
        )
          .map(
            (x: any) =>
              x.activities,
          )
          .filter(
            (a: any) =>
              a &&
              !done.has(a.id),
          )

        if (cand.length) {
          recs[w.skill_id] =
            cand[0]
        }
      }

      return {
        rows,
        recs,
        skills,
        techSkills:
          profileData.tech_skills ??
          [],
      }
    },
  })

  const saveSkills = useMutation({
    mutationFn: async (
      nextSkills: string[],
    ) => {
      const { error } =
        await supabase
          .from('profiles')
          .update({
            tech_skills: nextSkills,
          })
          .eq('id', uid)

      if (error) throw error

      return nextSkills
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['skills', uid],
      })

      qc.invalidateQueries({
        queryKey: ['profile'],
      })

      toast(
        'ok',
        'Your skills have been updated.',
      )
    },

    onError: (error: Error) => {
      toast(
        'err',
        error.message ||
          'Unable to update your skills.',
      )
    },
  })

  /*
   * Conditional returns happen AFTER every hook.
   */
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

  const {
    rows,
    recs,
    skills,
    techSkills,
  } = q.data!

  const overall = rows.length
    ? Math.round(
        rows.reduce(
          (
            sum: number,
            r: VerifiedSkill,
          ) =>
            sum + Number(r.score),
          0,
        ) / rows.length,
      )
    : null

  /*
   * These are ordinary calculations, NOT hooks.
   * Therefore they are safe after the conditional returns.
   */
  const searchTerm =
    search.trim().toLowerCase()

  const filteredSkills =
    skills
      .filter(
        (skill) =>
          !techSkills.some(
            (current) =>
              current.toLowerCase() ===
              skill.name.toLowerCase(),
          ),
      )
      .filter((skill) => {
        if (!searchTerm)
          return true

        return (
          skill.name
            .toLowerCase()
            .includes(searchTerm) ||
          (skill.category || '')
            .toLowerCase()
            .includes(searchTerm)
        )
      })
      .slice(0, 30)

  const groupedSkills: Record<
    string,
    string[]
  > = {}

  techSkills.forEach(
    (skill) => {
      const catalog =
        skills.find(
          (s) =>
            s.name.toLowerCase() ===
            skill.toLowerCase(),
        )

      const category =
        categoryLabel(
          catalog?.category,
        )

      if (!groupedSkills[category]) {
        groupedSkills[category] =
          []
      }

      groupedSkills[
        category
      ].push(skill)
    },
  )

  const addSkill = (
    skillName: string,
  ) => {
    const exists =
      techSkills.some(
        (skill) =>
          skill.toLowerCase() ===
          skillName.toLowerCase(),
      )

    if (exists) return

    saveSkills.mutate([
      ...techSkills,
      skillName,
    ])
  }

  const removeSkill = (
    skillName: string,
  ) => {
    saveSkills.mutate(
      techSkills.filter(
        (skill) =>
          skill !== skillName,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-[#080D1C] px-6 py-8 text-white shadow-2xl sm:px-8">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl" />

        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-ember-500/15 blur-3xl" />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
            <TrendingUp size={13} />
            Career intelligence
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Your Skills.
            <span className="block bg-gradient-to-r from-brand-300 via-white to-ember-300 bg-clip-text text-transparent">
              Your opportunities.
            </span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Keep your skills up to date.
            ASPIRO uses your profile skills
            together with your verified
            learning performance to improve
            career opportunity matching.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black">
                {techSkills.length}
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Profile skills
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black">
                {rows.length}
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Verified skills
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black">
                {overall ?? 0}%
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Readiness
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MY SKILLS */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
              Career profile
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
              My skills
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              Add the skills you currently
              have or are actively developing.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowPicker(
                (value) => !value,
              )
            }
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-all hover:-translate-y-0.5 hover:bg-brand-700"
          >
            <Plus size={17} />

            Add skill

            <ChevronDown
              size={15}
              className={
                showPicker
                  ? 'rotate-180 transition-transform'
                  : 'transition-transform'
              }
            />
          </button>
        </div>

        <Card className="overflow-hidden p-0">

          {/* SEARCH / ADD */}
          {showPicker && (
            <div className="border-b border-paper-line bg-paper/60 p-5">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value,
                    )
                  }
                  placeholder="Search Java, Python, SQL, React..."
                  className="w-full rounded-xl border border-paper-line bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                />
              </div>

              <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {filteredSkills.map(
                  (skill) => {
                    const Icon =
                      categoryIcon(
                        skill.category,
                      )

                    return (
                      <button
                        key={skill.id}
                        type="button"
                        disabled={
                          saveSkills.isPending
                        }
                        onClick={() =>
                          addSkill(
                            skill.name,
                          )
                        }
                        className="group flex items-center gap-3 rounded-xl border border-paper-line bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md disabled:opacity-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon size={17} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">
                            {skill.name}
                          </span>

                          <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
                            {categoryLabel(
                              skill.category,
                            )}
                          </span>
                        </span>

                        <Plus
                          size={16}
                          className="text-ink-mute transition-colors group-hover:text-brand-600"
                        />
                      </button>
                    )
                  },
                )}

                {!filteredSkills.length && (
                  <div className="col-span-full py-6 text-center text-sm text-ink-soft">
                    No matching skills found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SELECTED */}
          <div className="p-5">
            {!techSkills.length ? (
              <div className="rounded-2xl border border-dashed border-paper-line bg-paper/50 px-5 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Code2 size={22} />
                </div>

                <h3 className="mt-3 font-bold text-ink">
                  No profile skills added yet
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                  Add your programming
                  languages, tools, databases
                  and other skills so ASPIRO
                  can use them when matching
                  you with opportunities.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowPicker(true)
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Plus size={15} />
                  Add your first skill
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(
                  groupedSkills,
                ).map(
                  ([
                    category,
                    categorySkills,
                  ]) => (
                    <div
                      key={category}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-ink-mute">
                          {category}
                        </span>

                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-mute">
                          {
                            categorySkills.length
                          }
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {categorySkills.map(
                          (skill) => (
                            <div
                              key={skill}
                              className="group inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800"
                            >
                              <Check
                                size={14}
                                className="text-brand-600"
                              />

                              {skill}

                              <button
                                type="button"
                                disabled={
                                  saveSkills.isPending
                                }
                                onClick={() =>
                                  removeSkill(
                                    skill,
                                  )
                                }
                                aria-label={`Remove ${skill}`}
                                className="ml-1 rounded-md p-0.5 text-brand-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <X
                                  size={14}
                                />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
              <Lightbulb
                size={18}
                className="mt-0.5 shrink-0 text-amber-500"
              />

              <p className="text-xs leading-5 text-amber-900">
                <b>Keep this updated.</b>{' '}
                Your profile skills help ASPIRO
                compare you with skills required
                by published career opportunities.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* VERIFIED SKILLS */}
      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
            ASPIRO assessment
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
            Verified skill readiness
          </h2>

          <p className="mt-1 text-sm text-ink-soft">
            Calculated from your quizzes,
            assessments and challenges — not
            from completion alone.
          </p>
        </div>

        {!rows.length ? (
          <Empty
            title="No verified skill evidence yet"
            body="Finish graded activities such as quizzes and assessments and your verified skill levels will appear here."
          />
        ) : (
          <>
            {/* OVERVIEW */}
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand-700 to-brand-950 text-white shadow-xl">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl" />

                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <Award size={21} />
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-wider text-white/50">
                    Overall readiness
                  </p>

                  <div className="mt-1 text-5xl font-black">
                    {overall}%
                  </div>

                  <p className="mt-2 text-xs text-white/50">
                    Average across {rows.length}{' '}
                    evidenced skills
                  </p>

                  <div className="mt-5">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-ember-500 transition-all duration-1000"
                        style={{
                          width: `${overall}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <TrendingUp size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-black text-ink">
                      Build stronger evidence
                    </p>

                    <p className="text-xs text-ink-soft">
                      Complete graded activities
                      to improve verified
                      readiness.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-paper p-3">
                    <div className="text-lg font-black text-ink">
                      {
                        rows.filter(
                          (r) =>
                            r.score >=
                            80,
                        ).length
                      }
                    </div>

                    <div className="text-[10px] font-bold uppercase text-ink-mute">
                      Strong
                    </div>
                  </div>

                  <div className="rounded-xl bg-paper p-3">
                    <div className="text-lg font-black text-ink">
                      {
                        rows.filter(
                          (r) =>
                            r.score >=
                              60 &&
                            r.score <
                              80,
                        ).length
                      }
                    </div>

                    <div className="text-[10px] font-bold uppercase text-ink-mute">
                      Growing
                    </div>
                  </div>

                  <div className="rounded-xl bg-paper p-3">
                    <div className="text-lg font-black text-ink">
                      {
                        rows.filter(
                          (r) =>
                            r.score < 60,
                        ).length
                      }
                    </div>

                    <div className="text-[10px] font-bold uppercase text-ink-mute">
                      Focus
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* SKILL CARDS */}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[...rows]
                .reverse()
                .map((r) => {
                  const catalog =
                    skills.find(
                      (s) =>
                        s.id ===
                        r.skill_id,
                    )

                  const Icon =
                    categoryIcon(
                      catalog?.category,
                    )

                  return (
                    <Card
                      key={r.skill_id}
                      className="transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                          <Icon size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-bold text-ink">
                              {r.name}
                            </span>

                            <div className="text-right">
                              <b className="text-lg text-ink">
                                {Math.round(
                                  r.score,
                                )}
                                %
                              </b>

                              <div className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">
                                {
                                  r.evidence_count
                                }{' '}
                                evidence
                              </div>
                            </div>
                          </div>

                          <Progress
                            value={Number(
                              r.score,
                            )}
                          />

                          {r.score <
                            WEAK && (
                            <div className="mt-3 flex items-start gap-2 text-xs">
                              <Badge tone="warn">
                                Needs improvement
                              </Badge>

                              {recs[
                                r.skill_id
                              ] ? (
                                <span className="flex items-start gap-1 text-ink-soft">
                                  <Lightbulb
                                    size={14}
                                    className="mt-0.5 shrink-0 text-ember-500"
                                  />

                                  <span>
                                    Recommended:{' '}
                                    <Link
                                      className="font-bold text-brand-600 underline"
                                      to={`/learn/${recs[r.skill_id].day_id}?a=${recs[r.skill_id].id}`}
                                    >
                                      {
                                        recs[
                                          r.skill_id
                                        ].title
                                      }
                                    </Link>
                                  </span>
                                </span>
                              ) : (
                                <span className="text-ink-mute">
                                  No further published
                                  practice is mapped
                                  to this skill yet.
                                </span>
                              )}
                            </div>
                          )}

                          {r.score >=
                            80 && (
                            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                              <Star
                                size={13}
                                fill="currentColor"
                              />
                              Strong evidence
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
            </div>
          </>
        )}
      </section>

      {/* CAREER MATCHING */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-ember-50 p-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-100 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
              <Target size={22} />
            </div>

            <div>
              <h2 className="font-black text-ink">
                Your skills influence your opportunities
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                Keep your profile skills current.
                When administrators publish new jobs,
                ASPIRO can compare your skills,
                preferences and learning profile
                against the opportunity requirements.
              </p>
            </div>
          </div>

          <Link
            to="/notifications"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
          >
            View opportunities
            <TrendingUp size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}