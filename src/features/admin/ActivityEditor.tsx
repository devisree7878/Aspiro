import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Lock,
  Eye,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

import { supabase, unwrap } from '../../lib/supabase'
import { typeDef } from '../../lib/activityTypes'
import type { Activity } from '../../lib/types'

import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '../../components/ui'

import { useToast } from '../../components/Toast'

interface Q {
  id: string
  prompt: string
  type: 'single' | 'multiple' | 'truefalse'
  options: string[]
  correct: number[]
  explanation: string
}

interface CodingTestCase {
  id?: string
  input: string
  expected: string
  is_hidden: boolean
  points: number
  order_index: number
}

const rid = () =>
  Math.random().toString(36).slice(2, 10)

const lines = (value: any): string =>
  Array.isArray(value)
    ? value.join('\n')
    : ''

const toLines = (value: string): string[] =>
  value
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)

/*
|--------------------------------------------------------------------------
| Coding test cleanup
|--------------------------------------------------------------------------
|
| This prevents accidental Markdown from being stored as executable input.
|
| Example bad input:
|
| ## 15. Public test case **Input** ```text 20 6
|
| Becomes:
|
| 20 6
|
*/

const cleanTestValue = (
  value: string,
): string => {
  let result = String(value ?? '')

  if (!result.trim()) {
    return ''
  }

  /*
   * Case 1:
   * Proper fenced Markdown:
   *
   * ```text
   * 20 6
   * ```
   */
  const fencedMatch = result.match(
    /```(?:text|txt|plaintext)?\s*([\s\S]*?)(?:```|$)/i,
  )

  if (fencedMatch) {
    result = fencedMatch[1]
  } else if (result.includes('```')) {
    /*
     * Case 2:
     * Broken/incomplete fence such as:
     *
     * ## 15. Public test case **Input** ```text 20 6
     */
    const markerMatch = result.match(
      /```(?:text|txt|plaintext)?\s*([\s\S]*)$/i,
    )

    if (markerMatch) {
      result = markerMatch[1]
    }
  }

  /*
   * If Markdown contains an Input label, keep only what follows it.
   */
  if (
    /(^|\n)\s*#+\s*.*public\s+test/i.test(
      result,
    ) ||
    /\*\*Input\*\*/i.test(result)
  ) {
    const inputMatch = result.match(
      /(?:\*\*)?Input(?:\*\*)?\s*:?\s*([\s\S]*)/i,
    )

    if (inputMatch) {
      result = inputMatch[1]
    }
  }

  /*
   * Remove common Markdown artifacts.
   */
  result = result
    .replace(/```/g, '')
    .replace(/`/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .trim()

  return result
}

const cleanTestCase = (
  test: CodingTestCase,
): CodingTestCase => ({
  ...test,
  input: cleanTestValue(test.input),
  expected: cleanTestValue(test.expected),
})

export default function ActivityEditor({
  activity,
  skills,
  onClose,
  onSaved,
}: {
  activity: Activity
  skills: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const def = typeDef(activity.type)

  const isQuiz =
    activity.type === 'quiz' ||
    activity.type === 'assessment'

  const isCode =
    activity.type === 'coding_exercise'

  const [base, setBase] = useState({
    title: activity.title,
    description: activity.description ?? '',
    is_required: activity.is_required,
    estimated_minutes:
      activity.estimated_minutes,
    status: activity.status,
  })

  const [content, setContent] = useState<
    Record<string, any>
  >(activity.content ?? {})

  const [testCases, setTestCases] =
    useState<CodingTestCase[]>([])

  const [qs, setQs] = useState<Q[]>([])

  const [skillIds, setSkillIds] =
    useState<string[]>([])

  const [dirty, setDirty] = useState(false)

  /*
  |--------------------------------------------------------------------------
  | Load existing data
  |--------------------------------------------------------------------------
  */

  const extra = useQuery({
    queryKey: [
      'activity-extra',
      activity.id,
    ],

    queryFn: async () => {
      const [sec, sk] =
        await Promise.all([
          supabase
            .from('activity_secrets')
            .select('content')
            .eq(
              'activity_id',
              activity.id,
            )
            .maybeSingle(),

          supabase
            .from('activity_skills')
            .select('skill_id')
            .eq(
              'activity_id',
              activity.id,
            ),
        ])

      if (sec.error) {
        throw sec.error
      }

      if (sk.error) {
        throw sk.error
      }

      return {
        secret:
          (sec.data?.content ??
            {}) as Record<string, any>,

        skills: unwrap(sk).map(
          (x: any) => x.skill_id,
        ) as string[],
      }
    },

    staleTime: 0,
  })

  /*
  |--------------------------------------------------------------------------
  | Initialize form
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!extra.data) {
      return
    }

    const secret = extra.data.secret

    setSkillIds(
      extra.data.skills,
    )

    /*
     * Quiz questions
     */

    const answers =
      secret.answers ?? {}

    const explanations =
      secret.explanations ?? {}

    setQs(
      (
        (activity.content?.questions ??
          []) as any[]
      ).map(q => ({
        id: q.id,
        prompt: q.prompt ?? '',
        type: q.type,
        options: q.options ?? [],
        correct:
          answers[q.id] ?? [],
        explanation:
          explanations[q.id] ?? '',
      })),
    )

    /*
     * Coding test cases
     *
     * Public:
     * activity.content.public_tests
     *
     * Hidden:
     * activity_secrets.content.hidden_tests
     */

    if (isCode) {
      const oldPublic =
        Array.isArray(
          activity.content
            ?.public_tests,
        )
          ? activity.content
              .public_tests
          : []

      const oldHidden =
        Array.isArray(
          secret.hidden_tests,
        )
          ? secret.hidden_tests
          : []

      const migrated: CodingTestCase[] =
        [
          ...oldPublic.map(
            (
              test: any,
              index: number,
            ) =>
              cleanTestCase({
                input:
                  test.input ?? '',
                expected:
                  test.expected ??
                  '',
                is_hidden: false,
                points: 10,
                order_index: index,
              }),
          ),

          ...oldHidden.map(
            (
              test: any,
              index: number,
            ) =>
              cleanTestCase({
                input:
                  test.input ?? '',
                expected:
                  test.expected ??
                  '',
                is_hidden: true,
                points: 10,
                order_index:
                  oldPublic.length +
                  index,
              }),
          ),
        ]

      setTestCases(migrated)
    }
  }, [
    extra.data,
    activity.content,
    isCode,
  ])

  /*
  |--------------------------------------------------------------------------
  | Prevent accidental navigation
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const handleBeforeUnload = (
      event: BeforeUnloadEvent,
    ) => {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload,
    )

    return () =>
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload,
      )
  }, [dirty])

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  const touch =
    <T,>(
      fn: (value: T) => void,
    ) =>
    (value: T) => {
      setDirty(true)
      fn(value)
    }

  const setC = (
    key: string,
    value: any,
  ) => {
    setDirty(true)

    setContent(current => ({
      ...current,
      [key]: value,
    }))
  }

  const close = () => {
    if (
      !dirty ||
      confirm(
        'Discard unsaved changes?',
      )
    ) {
      onClose()
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Save
  |--------------------------------------------------------------------------
  */

  const save = useMutation({
    mutationFn: async () => {
      if (!base.title.trim()) {
        throw new Error(
          'Title is required.',
        )
      }

      let nextContent = {
        ...content,
      }

      /*
       * Preserve existing secret data.
       *
       * This is important because coding tests,
       * quiz answers, etc. may share activity_secrets.
       */

      let nextSecret: Record<
        string,
        any
      > = {
        ...(extra.data?.secret ?? {}),
      }

      /*
       |--------------------------------------------------------------------------
       | QUIZ
       |--------------------------------------------------------------------------
       */

      if (isQuiz) {
        for (const question of qs) {
          if (!question.prompt.trim()) {
            throw new Error(
              'Every question needs text.',
            )
          }

          if (
            question.type !==
              'truefalse' &&
            question.options.filter(
              option =>
                option.trim(),
            ).length < 2
          ) {
            throw new Error(
              'Each question needs at least two options.',
            )
          }

          if (
            !question.correct.length
          ) {
            throw new Error(
              `Mark the correct answer for: "${question.prompt.slice(
                0,
                40,
              )}"`,
            )
          }
        }

        nextContent.questions =
          qs.map(question => ({
            id: question.id,
            prompt:
              question.prompt.trim(),
            type: question.type,
            options:
              question.type ===
              'truefalse'
                ? ['True', 'False']
                : question.options.filter(
                    option =>
                      option.trim(),
                  ),
          }))

        nextSecret = {
          ...nextSecret,

          answers:
            Object.fromEntries(
              qs.map(question => [
                question.id,
                question.correct,
              ]),
            ),

          explanations:
            Object.fromEntries(
              qs.map(question => [
                question.id,
                question.explanation,
              ]),
            ),
        }
      }

      /*
       |--------------------------------------------------------------------------
       | CODING EXERCISE
       |--------------------------------------------------------------------------
       */

      if (isCode) {
        const validTests =
          testCases
            .map(cleanTestCase)
            .filter(
              test =>
                test.input.trim() ||
                test.expected.trim(),
            )

        if (!validTests.length) {
          throw new Error(
            'Add at least one coding test case.',
          )
        }

        for (
          let index = 0;
          index < validTests.length;
          index++
        ) {
          const test =
            validTests[index]

          const number =
            index + 1

          if (!test.input.trim()) {
            throw new Error(
              `Test ${number}: Input is required.`,
            )
          }

          if (
            !test.expected.trim()
          ) {
            throw new Error(
              `Test ${number}: Expected output is required.`,
            )
          }

          if (
            !Number.isFinite(
              Number(test.points),
            ) ||
            Number(test.points) < 0
          ) {
            throw new Error(
              `Test ${number}: Points must be 0 or greater.`,
            )
          }
        }

        /*
         * PUBLIC TESTS
         *
         * The Edge Function reads these from:
         *
         * activities.content.public_tests
         */

        nextContent.public_tests =
          validTests
            .filter(
              test =>
                !test.is_hidden,
            )
            .map(test => ({
              input: test.input,
              expected:
                test.expected,
            }))

        /*
         * HIDDEN TESTS
         *
         * The Edge Function reads these from:
         *
         * activity_secrets.content.hidden_tests
         */

        nextSecret = {
          ...nextSecret,

          hidden_tests:
            validTests
              .filter(
                test =>
                  test.is_hidden,
              )
              .map(test => ({
                input: test.input,
                expected:
                  test.expected,
              })),
        }
      }

      /*
       |--------------------------------------------------------------------------
       | Remove empty numeric fields
       |--------------------------------------------------------------------------
       */

      def.fields.forEach(field => {
        if (
          field.kind === 'number' &&
          nextContent[field.key] === ''
        ) {
          delete nextContent[field.key]
        }
      })

      /*
       |--------------------------------------------------------------------------
       | Update activity
       |--------------------------------------------------------------------------
       */

      const activityUpdate =
        await supabase
          .from('activities')
          .update({
            title:
              base.title.trim(),

            description:
              base.description ||
              null,

            is_required:
              base.is_required,

            estimated_minutes:
              Number(
                base.estimated_minutes,
              ) || 0,

            status: base.status,

            content: nextContent,
          })
          .eq(
            'id',
            activity.id,
          )

      if (activityUpdate.error) {
        throw activityUpdate.error
      }

      /*
       |--------------------------------------------------------------------------
       | Save quiz/coding secret data
       |--------------------------------------------------------------------------
       */

      if (isQuiz || isCode) {
        const secretUpdate =
          await supabase
            .from(
              'activity_secrets',
            )
            .upsert({
              activity_id:
                activity.id,

              content:
                nextSecret,
            })

        if (secretUpdate.error) {
          throw secretUpdate.error
        }
      }

      /*
       |--------------------------------------------------------------------------
       | Update skills
       |--------------------------------------------------------------------------
       */

      const deleteSkills =
        await supabase
          .from(
            'activity_skills',
          )
          .delete()
          .eq(
            'activity_id',
            activity.id,
          )

      if (deleteSkills.error) {
        throw deleteSkills.error
      }

      if (skillIds.length) {
        const insertSkills =
          await supabase
            .from(
              'activity_skills',
            )
            .insert(
              skillIds.map(
                skillId => ({
                  activity_id:
                    activity.id,
                  skill_id:
                    skillId,
                }),
              ),
            )

        if (insertSkills.error) {
          throw insertSkills.error
        }
      }
    },

    onSuccess: () => {
      setDirty(false)

      toast(
        'ok',
        'Activity saved successfully',
      )

      onSaved()
    },

    onError: (error: Error) => {
      toast(
        'err',
        error.message,
      )
    },
  })

  /*
  |--------------------------------------------------------------------------
  | Quiz helpers
  |--------------------------------------------------------------------------
  */

  const updateQuestion = (
    index: number,
    patch: Partial<Q>,
  ) => {
    setDirty(true)

    setQs(current =>
      current.map(
        (question, questionIndex) =>
          questionIndex === index
            ? {
                ...question,
                ...patch,
              }
            : question,
      ),
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Coding test helpers
  |--------------------------------------------------------------------------
  */

  const addTestCase = (
    hidden: boolean,
  ) => {
    setDirty(true)

    setTestCases(current => [
      ...current,

      {
        input: '',
        expected: '',
        is_hidden: hidden,
        points: 10,
        order_index:
          current.length,
      },
    ])
  }

  const updateTestCase = (
    index: number,
    patch: Partial<CodingTestCase>,
  ) => {
    setDirty(true)

    setTestCases(current =>
      current.map(
        (test, testIndex) =>
          testIndex === index
            ? {
                ...test,
                ...patch,
              }
            : test,
      ),
    )
  }

  const removeTestCase = (
    index: number,
  ) => {
    setDirty(true)

    setTestCases(current =>
      current
        .filter(
          (_, testIndex) =>
            testIndex !== index,
        )
        .map((test, newIndex) => ({
          ...test,
          order_index: newIndex,
        })),
    )
  }

  const moveTestCase = (
    index: number,
    direction: -1 | 1,
  ) => {
    const target =
      index + direction

    if (
      target < 0 ||
      target >= testCases.length
    ) {
      return
    }

    setDirty(true)

    setTestCases(current => {
      const copy = [...current]

      const temporary =
        copy[index]

      copy[index] =
        copy[target]

      copy[target] =
        temporary

      return copy.map(
        (test, newIndex) => ({
          ...test,
          order_index:
            newIndex,
        }),
      )
    })
  }

  const fieldsUI = useMemo(
    () => def.fields,
    [def],
  )

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (extra.isLoading) {
    return (
      <Modal
        title="Loading…"
        onClose={onClose}
      >
        <Spinner />
      </Modal>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <Modal
      wide
      title={`${def.label}: ${activity.title}`}
      onClose={close}
    >
      <div className="space-y-5">

        {/* BASIC INFORMATION */}

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Title *">
            <Input
              value={base.title}
              onChange={event => {
                setDirty(true)

                setBase({
                  ...base,
                  title:
                    event.target.value,
                })
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">

            <Field label="Minutes">
              <Input
                type="number"
                min={0}
                value={
                  base.estimated_minutes
                }
                onChange={event => {
                  setDirty(true)

                  setBase({
                    ...base,
                    estimated_minutes:
                      Number(
                        event.target.value,
                      ),
                  })
                }}
              />
            </Field>

            <Field label="Status">
              <Select
                value={base.status}
                onChange={event => {
                  setDirty(true)

                  setBase({
                    ...base,
                    status:
                      event.target
                        .value as any,
                  })
                }}
              >
                <option value="draft">
                  draft
                </option>

                <option value="published">
                  published
                </option>

                <option value="archived">
                  archived
                </option>
              </Select>
            </Field>

          </div>
        </div>

        <Field label="Short description">
          <Input
            value={base.description}
            onChange={event => {
              setDirty(true)

              setBase({
                ...base,
                description:
                  event.target.value,
              })
            }}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={base.is_required}
            onChange={event => {
              setDirty(true)

              setBase({
                ...base,
                is_required:
                  event.target.checked,
              })
            }}
          />

          Required (day isn't complete without it)
        </label>

        {/* GENERIC ACTIVITY FIELDS */}

        {fieldsUI.map(field => (
          <Field
            key={field.key}
            label={field.label}
          >
            {field.kind === 'md' ? (
              <Textarea
                className="min-h-[180px] font-mono text-sm"
                value={
                  content[field.key] ??
                  ''
                }
                onChange={event =>
                  setC(
                    field.key,
                    event.target.value,
                  )
                }
              />
            ) : field.kind ===
              'lines' ? (
              <Textarea
                value={lines(
                  content[field.key],
                )}
                onChange={event =>
                  setC(
                    field.key,
                    toLines(
                      event.target.value,
                    ),
                  )
                }
              />
            ) : field.kind ===
              'select' ? (
              <Select
                value={
                  content[field.key] ??
                  field.options?.[0]
                }
                onChange={event =>
                  setC(
                    field.key,
                    event.target.value,
                  )
                }
              >
                {field.options?.map(
                  option => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  ),
                )}
              </Select>
            ) : (
              <Input
                type={
                  field.kind ===
                  'number'
                    ? 'number'
                    : 'text'
                }
                value={
                  content[field.key] ??
                  ''
                }
                onChange={event =>
                  setC(
                    field.key,
                    field.kind ===
                      'number'
                      ? event.target
                          .value === ''
                        ? ''
                        : Number(
                            event.target
                              .value,
                          )
                      : event.target
                          .value,
                  )
                }
              />
            )}
          </Field>
        ))}

        {/* =====================================================
            QUIZ
        ====================================================== */}

        {isQuiz && (
          <div className="space-y-4">

            <div className="grid gap-4 sm:grid-cols-4">

              <Field label="Passing score %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={
                    content.passing_score ??
                    60
                  }
                  onChange={event =>
                    setC(
                      'passing_score',
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </Field>

              <Field
                label="Max attempts"
                hint="Empty = unlimited"
              >
                <Input
                  type="number"
                  min={1}
                  value={
                    content.max_attempts ??
                    ''
                  }
                  onChange={event =>
                    setC(
                      'max_attempts',
                      event.target.value
                        ? Number(
                            event.target.value,
                          )
                        : undefined,
                    )
                  }
                />
              </Field>

              <Field label="Time limit (min)">
                <Input
                  type="number"
                  min={1}
                  value={
                    content.time_limit_minutes ??
                    ''
                  }
                  onChange={event =>
                    setC(
                      'time_limit_minutes',
                      event.target.value
                        ? Number(
                            event.target.value,
                          )
                        : undefined,
                    )
                  }
                />
              </Field>

              <Field label="Difficulty">
                <Select
                  value={
                    content.difficulty ??
                    'easy'
                  }
                  onChange={event =>
                    setC(
                      'difficulty',
                      event.target.value,
                    )
                  }
                >
                  <option value="easy">
                    easy
                  </option>

                  <option value="medium">
                    medium
                  </option>

                  <option value="hard">
                    hard
                  </option>
                </Select>
              </Field>

            </div>

            {qs.map(
              (question, questionIndex) => (
                <div
                  key={question.id}
                  className="space-y-3 rounded-2xl border border-paper-line bg-white p-4"
                >

                  <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">

                    <Field
                      label={`Question ${
                        questionIndex + 1
                      }`}
                    >
                      <Input
                        value={
                          question.prompt
                        }
                        onChange={event =>
                          updateQuestion(
                            questionIndex,
                            {
                              prompt:
                                event.target
                                  .value,
                            },
                          )
                        }
                      />
                    </Field>

                    <Field label="Type">
                      <Select
                        value={
                          question.type
                        }
                        onChange={event =>
                          updateQuestion(
                            questionIndex,
                            {
                              type:
                                event.target
                                  .value as Q['type'],
                              correct: [],
                            },
                          )
                        }
                      >
                        <option value="single">
                          Single answer
                        </option>

                        <option value="multiple">
                          Multiple answers
                        </option>

                        <option value="truefalse">
                          True / False
                        </option>
                      </Select>
                    </Field>

                    <button
                      type="button"
                      aria-label="Remove question"
                      className="mt-6 rounded-lg p-2 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setDirty(true)

                        setQs(current =>
                          current.filter(
                            (_, index) =>
                              index !==
                              questionIndex,
                          ),
                        )
                      }}
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                  {(
                    question.type ===
                    'truefalse'
                      ? [
                          'True',
                          'False',
                        ]
                      : question.options
                  ).map(
                    (
                      option,
                      optionIndex,
                    ) => (
                      <div
                        key={optionIndex}
                        className="flex items-center gap-2"
                      >

                        <input
                          aria-label={`Option ${
                            optionIndex + 1
                          } is correct`}
                          type={
                            question.type ===
                            'multiple'
                              ? 'checkbox'
                              : 'radio'
                          }
                          name={`question-${question.id}`}
                          checked={question.correct.includes(
                            optionIndex,
                          )}
                          onChange={() => {
                            updateQuestion(
                              questionIndex,
                              {
                                correct:
                                  question.type ===
                                  'multiple'
                                    ? question.correct.includes(
                                        optionIndex,
                                      )
                                      ? question.correct.filter(
                                          index =>
                                            index !==
                                            optionIndex,
                                        )
                                      : [
                                          ...question.correct,
                                          optionIndex,
                                        ]
                                    : [
                                        optionIndex,
                                      ],
                              },
                            )
                          }}
                        />

                        {question.type ===
                        'truefalse' ? (
                          <span className="text-sm">
                            {option}
                          </span>
                        ) : (
                          <>
                            <Input
                              value={option}
                              placeholder={`Option ${
                                optionIndex + 1
                              }`}
                              onChange={event =>
                                updateQuestion(
                                  questionIndex,
                                  {
                                    options:
                                      question.options.map(
                                        (
                                          currentOption,
                                          index,
                                        ) =>
                                          index ===
                                          optionIndex
                                            ? event
                                                .target
                                                .value
                                            : currentOption,
                                      ),
                                  },
                                )
                              }
                            />

                            <button
                              type="button"
                              aria-label="Remove option"
                              className="rounded-lg p-2 text-ink-mute hover:bg-paper-line"
                              onClick={() =>
                                updateQuestion(
                                  questionIndex,
                                  {
                                    options:
                                      question.options.filter(
                                        (
                                          _,
                                          index,
                                        ) =>
                                          index !==
                                          optionIndex,
                                      ),

                                    correct:
                                      question.correct
                                        .filter(
                                          index =>
                                            index !==
                                            optionIndex,
                                        )
                                        .map(
                                          index =>
                                            index >
                                            optionIndex
                                              ? index -
                                                1
                                              : index,
                                        ),
                                  },
                                )
                              }
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          </>
                        )}

                      </div>
                    ),
                  )}

                  {question.type !==
                    'truefalse' && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        updateQuestion(
                          questionIndex,
                          {
                            options: [
                              ...question.options,
                              '',
                            ],
                          },
                        )
                      }
                    >
                      <Plus size={14} />
                      Add option
                    </Button>
                  )}

                  <Field label="Explanation (shown after submitting)">
                    <Input
                      value={
                        question.explanation
                      }
                      onChange={event =>
                        updateQuestion(
                          questionIndex,
                          {
                            explanation:
                              event.target
                                .value,
                          },
                        )
                      }
                    />
                  </Field>

                </div>
              ),
            )}

            <Button
              variant="secondary"
              onClick={() => {
                setDirty(true)

                setQs(current => [
                  ...current,

                  {
                    id: rid(),
                    prompt: '',
                    type: 'single',
                    options: [
                      '',
                      '',
                    ],
                    correct: [],
                    explanation: '',
                  },
                ])
              }}
            >
              <Plus size={16} />
              Add question
            </Button>

            <p className="text-xs text-ink-mute">
              Correct answers are stored in
              the admin-only activity secrets
              table and graded on the server.
            </p>

          </div>
        )}

        {/* =====================================================
            CODING EXERCISE
        ====================================================== */}

        {isCode && (
          <div className="space-y-5">

            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">

              <div className="flex items-start gap-3">

                <div className="rounded-xl bg-white p-2">
                  <Lock size={18} />
                </div>

                <div>
                  <h3 className="font-bold">
                    Automatic Code Judge
                  </h3>

                  <p className="mt-1 text-sm text-ink-mute">
                    Configure public and hidden
                    test cases. Hidden tests are
                    stored securely and are never
                    sent to students.
                  </p>
                </div>

              </div>

            </div>

            <Field label="Problem statement (Markdown)">
              <Textarea
                className="min-h-[140px] font-mono text-sm"
                value={
                  content.statement ?? ''
                }
                onChange={event =>
                  setC(
                    'statement',
                    event.target.value,
                  )
                }
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">

              <Field label="Language">
                <Input
                  value={
                    content.language ?? ''
                  }
                  onChange={event =>
                    setC(
                      'language',
                      event.target.value,
                    )
                  }
                  placeholder="java"
                />
              </Field>

              <Field label="Difficulty">
                <Select
                  value={
                    content.difficulty ??
                    'easy'
                  }
                  onChange={event =>
                    setC(
                      'difficulty',
                      event.target.value,
                    )
                  }
                >
                  <option value="easy">
                    easy
                  </option>

                  <option value="medium">
                    medium
                  </option>

                  <option value="hard">
                    hard
                  </option>
                </Select>
              </Field>

              <Field label="Function signature">
                <Input
                  value={
                    content.signature ?? ''
                  }
                  onChange={event =>
                    setC(
                      'signature',
                      event.target.value,
                    )
                  }
                />
              </Field>

              <Field label="Time limit (ms)">
                <Input
                  type="number"
                  min={100}
                  value={
                    content.time_limit_ms ??
                    ''
                  }
                  onChange={event =>
                    setC(
                      'time_limit_ms',
                      event.target.value
                        ? Number(
                            event.target.value,
                          )
                        : undefined,
                    )
                  }
                />
              </Field>

              <Field label="Memory limit (MB)">
                <Input
                  type="number"
                  min={1}
                  value={
                    content.memory_limit_mb ??
                    ''
                  }
                  onChange={event =>
                    setC(
                      'memory_limit_mb',
                      event.target.value
                        ? Number(
                            event.target.value,
                          )
                        : undefined,
                    )
                  }
                />
              </Field>

            </div>

            <Field label="Starter code">
              <Textarea
                spellCheck={false}
                className="min-h-[160px] font-mono text-sm"
                value={
                  content.starter_code ??
                  ''
                }
                onChange={event =>
                  setC(
                    'starter_code',
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Constraints (Markdown)">
              <Textarea
                value={
                  content.constraints ??
                  ''
                }
                onChange={event =>
                  setC(
                    'constraints',
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Hints (one per line)">
              <Textarea
                value={lines(
                  content.hints,
                )}
                onChange={event =>
                  setC(
                    'hints',
                    toLines(
                      event.target.value,
                    ),
                  )
                }
              />
            </Field>

            <Field label="Explanation / solution notes (Markdown)">
              <Textarea
                value={
                  content.explanation ??
                  ''
                }
                onChange={event =>
                  setC(
                    'explanation',
                    event.target.value,
                  )
                }
              />
            </Field>

            {/* TEST CASE MANAGER */}

            <div className="rounded-2xl border border-paper-line bg-white p-4">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h3 className="font-bold">
                    Test Cases
                  </h3>

                  <p className="text-xs text-ink-mute">
                    {testCases.length}{' '}
                    test case
                    {testCases.length ===
                    1
                      ? ''
                      : 's'} configured
                  </p>
                </div>

                <div className="flex gap-2">

                  <Button
                    variant="secondary"
                    onClick={() =>
                      addTestCase(
                        false,
                      )
                    }
                  >
                    <Eye size={15} />
                    Public Test
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      addTestCase(
                        true,
                      )
                    }
                  >
                    <Lock size={15} />
                    Hidden Test
                  </Button>

                </div>

              </div>

              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">

                <strong>
                  Test data rule:
                </strong>{' '}
                Enter only the raw input and
                expected output.

                <div className="mt-2 font-mono text-xs">
                  Input: 20 6
                  <br />
                  Expected:
                  <br />
                  26
                  <br />
                  14
                  <br />
                  120
                  <br />
                  2
                </div>

                <p className="mt-2 text-xs text-blue-700">
                  Do not paste headings such as
                  "## Public test case" or Markdown
                  code fences.
                </p>

              </div>

              {!testCases.length ? (
                <div className="rounded-xl border border-dashed border-paper-line p-8 text-center">

                  <p className="font-semibold">
                    No test cases yet
                  </p>

                  <p className="mt-1 text-sm text-ink-mute">
                    Add public tests that
                    students can see and
                    hidden tests used by the
                    judge.
                  </p>

                </div>
              ) : (
                <div className="space-y-3">

                  {testCases.map(
                    (
                      test,
                      index,
                    ) => (
                      <div
                        key={
                          test.id ??
                          `new-${index}`
                        }
                        className={`rounded-xl border p-4 ${
                          test.is_hidden
                            ? 'border-purple-200 bg-purple-50/40'
                            : 'border-paper-line bg-white'
                        }`}
                      >

                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                          <div className="flex items-center gap-2">

                            <GripVertical
                              size={16}
                              className="text-ink-mute"
                            />

                            <span className="font-semibold">
                              Test Case{' '}
                              {index + 1}
                            </span>

                            {test.is_hidden ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                                <Lock
                                  size={11}
                                />
                                Hidden
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                <Eye
                                  size={11}
                                />
                                Public
                              </span>
                            )}

                          </div>

                          <div className="flex items-center gap-1">

                            <button
                              type="button"
                              title="Move up"
                              disabled={
                                index ===
                                0
                              }
                              className="rounded-lg p-2 text-ink-mute hover:bg-paper-line disabled:opacity-30"
                              onClick={() =>
                                moveTestCase(
                                  index,
                                  -1,
                                )
                              }
                            >
                              <ArrowUp
                                size={14}
                              />
                            </button>

                            <button
                              type="button"
                              title="Move down"
                              disabled={
                                index ===
                                testCases.length -
                                  1
                              }
                              className="rounded-lg p-2 text-ink-mute hover:bg-paper-line disabled:opacity-30"
                              onClick={() =>
                                moveTestCase(
                                  index,
                                  1,
                                )
                              }
                            >
                              <ArrowDown
                                size={14}
                              />
                            </button>

                            <button
                              type="button"
                              title="Remove test"
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                              onClick={() =>
                                removeTestCase(
                                  index,
                                )
                              }
                            >
                              <Trash2
                                size={14}
                              />
                            </button>

                          </div>

                        </div>

                        <div className="grid gap-4 md:grid-cols-2">

                          <Field label="Input">

                            <Textarea
                              spellCheck={false}
                              className="min-h-[100px] font-mono text-sm"
                              placeholder="Example: 20 6"
                              value={
                                test.input
                              }
                              onChange={event =>
                                updateTestCase(
                                  index,
                                  {
                                    input:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />

                          </Field>

                          <Field label="Expected Output">

                            <Textarea
                              spellCheck={false}
                              className="min-h-[100px] font-mono text-sm"
                              placeholder={
                                'Example:\n26\n14\n120\n2'
                              }
                              value={
                                test.expected
                              }
                              onChange={event =>
                                updateTestCase(
                                  index,
                                  {
                                    expected:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />

                          </Field>

                        </div>

                        <div className="mt-3 grid gap-4 sm:grid-cols-3">

                          <Field label="Points">
                            <Input
                              type="number"
                              min={0}
                              value={
                                test.points
                              }
                              onChange={event =>
                                updateTestCase(
                                  index,
                                  {
                                    points:
                                      Number(
                                        event
                                          .target
                                          .value,
                                      ),
                                  },
                                )
                              }
                            />
                          </Field>

                          <div className="sm:col-span-2 flex items-end">

                            <p className="text-xs text-ink-mute">
                              {test.is_hidden
                                ? 'Hidden tests are used by the automatic judge and are never shown to students.'
                                : 'Public tests are visible to students and are used when they click Run Code.'}
                            </p>

                          </div>

                        </div>

                      </div>
                    ),
                  )}

                </div>
              )}

            </div>

          </div>
        )}

        {/* SKILLS */}

        <div>

          <p className="mb-2 text-sm font-semibold">
            Skills evidenced by this
            activity
          </p>

          {!skills.length ? (
            <p className="text-sm text-ink-mute">
              No skills defined yet
              (Careers & Skills).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">

              {skills.map(skill => {
                const selected =
                  skillIds.includes(
                    skill.id,
                  )

                return (
                  <button
                    key={skill.id}
                    type="button"
                    aria-pressed={
                      selected
                    }
                    onClick={() => {
                      setDirty(true)

                      setSkillIds(
                        current =>
                          selected
                            ? current.filter(
                                id =>
                                  id !==
                                  skill.id,
                              )
                            : [
                                ...current,
                                skill.id,
                              ],
                      )
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      selected
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-paper-line bg-white'
                    }`}
                  >
                    {skill.name}
                  </button>
                )
              })}

            </div>
          )}

        </div>

      </div>

      {/* FOOTER */}

      <div className="mt-6 flex justify-end gap-2">

        <Button
          variant="ghost"
          onClick={close}
        >
          Close
        </Button>

        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate()
          }
        >
          Save activity
        </Button>

      </div>
    </Modal>
  )
}