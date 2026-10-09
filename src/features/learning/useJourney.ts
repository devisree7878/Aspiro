
import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'

export interface JActivity {
  id: string
  type: string
  title: string
  order_index: number
  is_required: boolean
  estimated_minutes: number
  status?: string | null
}

export interface JDay {
  id: string
  day_number: number
  title: string
  description: string | null
  estimated_minutes: number
  phase_id: string
  activities: JActivity[]
  done: number
  total: number
  complete: boolean
  pct: number
  index: number
  recovery_of_day?: number | null
}

export interface JPhase {
  id: string
  title: string
  description: string | null
}

/**
 * Student Journey
 *
 * IMPORTANT:
 *
 * The ADMIN-created course structure is the source
 * of truth for student learning content.
 *
 * Admin:
 *   Course
 *     ↓
 *   Phase
 *     ↓
 *   Day
 *     ↓
 *   Activities
 *
 * Student:
 *   Sees exactly the same Days and Activities.
 *
 * target_days and daily_minutes are only student
 * preferences. They do not create duplicate content.
 */
export function useJourney() {
  const { session } = useAuth()
  const uid = session?.user.id

  return useQuery({
    queryKey: ['journey', uid],
    enabled: !!uid,

    queryFn: async () => {
      /*
       * =========================================================
       * 1. GET ACTIVE ENROLLMENT
       * =========================================================
       */

      const enrollment = unwrap(
        await supabase
          .from('enrollments')
          .select(`
            *,
            courses(
              title,
              description
            ),
            career_goals(
              name
            )
          `)
          .eq('student_id', uid!)
          .eq('status', 'active')
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()
      ) as any

      if (!enrollment) {
        return null
      }

      const courseId =
        enrollment.course_id

      if (!courseId) {
        return null
      }

      /*
       * =========================================================
       * 2. LOAD ADMIN-CREATED PHASES + DAYS + PROGRESS
       * =========================================================
       *
       * IMPORTANT:
       *
       * We intentionally DO NOT read:
       *
       * student_journey_days
       *
       * because that table was causing the same content to be
       * duplicated into multiple student days.
       *
       * The actual course `days` table is now the source of truth.
       */

      const [
        phasesResult,
        daysResult,
        progressResult,
      ] = await Promise.all([
        /*
         * ADMIN PHASES
         */
        supabase
          .from('phases')
          .select(
            'id,title,description,order_index'
          )
          .eq(
            'course_id',
            courseId
          )
          .order(
            'order_index',
            {
              ascending: true,
            }
          ),

        /*
         * ADMIN DAYS + ADMIN ACTIVITIES
         */
        supabase
          .from('days')
          .select(`
            id,
            day_number,
            title,
            description,
            estimated_minutes,
            phase_id,
            activities(
              id,
              type,
              title,
              order_index,
              is_required,
              estimated_minutes
            )
          `)
          .eq(
            'course_id',
            courseId
          )
          .order(
            'day_number',
            {
              ascending: true,
            }
          ),

        /*
         * STUDENT ACTIVITY PROGRESS
         */
        supabase
          .from('activity_progress')
          .select(
            'activity_id,status,score'
          )
          .eq(
            'student_id',
            uid!
          ),
      ])

      /*
       * =========================================================
       * 3. CHECK DATABASE ERRORS
       * =========================================================
       */

      if (phasesResult.error) {
        throw phasesResult.error
      }

      if (daysResult.error) {
        throw daysResult.error
      }

      if (progressResult.error) {
        throw progressResult.error
      }

      const phases =
        unwrap(
          phasesResult
        ) as any[]

      const days =
        unwrap(
          daysResult
        ) as any[]

      const progress =
        unwrap(
          progressResult
        ) as any[]

      /*
       * =========================================================
       * 4. COMPLETED ACTIVITIES
       * =========================================================
       */

      const completedActivities =
        new Set<string>(
          progress
            .filter(
              (item: any) =>
                item.status ===
                'completed'
            )
            .map(
              (item: any) =>
                item.activity_id
            )
        )

      /*
       * =========================================================
       * 5. BUILD EXACT ADMIN DAYS
       * =========================================================
       *
       * Every day here comes directly from:
       *
       * public.days
       *
       * Every activity comes directly from:
       *
       * public.activities
       *
       * Nothing is generated.
       * Nothing is copied.
       * Nothing is renamed.
       */

      const dayList: JDay[] =
        days
          .map(
            (
              day: any,
              index: number
            ) => {
              /*
               * -------------------------------------------------
               * ADMIN ACTIVITIES
               * -------------------------------------------------
               */

              const activities: JActivity[] =
                [
                  ...(day.activities ?? []),
                ]
                  .sort(
                    (
                      a: any,
                      b: any
                    ) =>
                      Number(
                        a.order_index ??
                          0
                      ) -
                      Number(
                        b.order_index ??
                          0
                      )
                  )
                  .map(
                    (
                      activity: any
                    ) => {
                      const studentProgress =
                        progress.find(
                          (item: any) =>
                            item.activity_id ===
                            activity.id
                        )

                      return {
                        id:
                          activity.id,

                        type:
                          activity.type,

                        title:
                          activity.title,

                        order_index:
                          Number(
                            activity.order_index ??
                              0
                          ),

                        is_required:
                          Boolean(
                            activity.is_required
                          ),

                        estimated_minutes:
                          Number(
                            activity.estimated_minutes ??
                              0
                          ),

                        status:
                          studentProgress
                            ?.status ??
                          null,
                      }
                    }
                  )

              /*
               * -------------------------------------------------
               * COMPLETION
               * -------------------------------------------------
               */

              const requiredActivities =
                activities.filter(
                  activity =>
                    activity.is_required
                )

              const completionBasis =
                requiredActivities.length >
                0
                  ? requiredActivities
                  : activities

              const done =
                activities.filter(
                  activity =>
                    completedActivities.has(
                      activity.id
                    )
                ).length

              const complete =
                activities.length >
                  0 &&
                completionBasis.every(
                  activity =>
                    completedActivities.has(
                      activity.id
                    )
                )

              const pct =
                activities.length >
                0
                  ? (done /
                      activities.length) *
                    100
                  : 0

              /*
               * -------------------------------------------------
               * DAY TIME
               * -------------------------------------------------
               *
               * Prefer the duration entered by the admin.
               * If it is empty/zero, calculate it from activities.
               */

              const calculatedMinutes =
                activities.reduce(
                  (
                    total,
                    activity
                  ) =>
                    total +
                    Number(
                      activity.estimated_minutes ||
                        0
                    ),
                  0
                )

              const estimatedMinutes =
                Number(
                  day.estimated_minutes ||
                    calculatedMinutes
                )

              /*
               * -------------------------------------------------
               * RETURN DAY
               * -------------------------------------------------
               */

              return {
                id:
                  day.id,

                day_number:
                  Number(
                    day.day_number
                  ),

                title:
                  day.title ||
                  `Day ${day.day_number}`,

                description:
                  day.description ??
                  null,

                estimated_minutes:
                  estimatedMinutes,

                phase_id:
                  day.phase_id,

                activities,

                done,

                total:
                  activities.length,

                complete,

                pct,

                index,

                /*
                 * Normal admin days are not recovery days.
                 *
                 * Recovery is handled separately.
                 */
                recovery_of_day:
                  null,
              }
            }
          )
          /*
           * Only display days that contain actual
           * admin-created activities.
           */
          .filter(
            (day: JDay) =>
              day.activities.length >
              0
          )

      /*
       * =========================================================
       * 6. KEEP DAY INDEXES
       * =========================================================
       *
       * The actual displayed Day number remains the admin's
       * day_number.
       */

      dayList.forEach(
        (
          day,
          index
        ) => {
          day.index =
            index
        }
      )

      /*
       * =========================================================
       * 7. CURRENT DAY
       * =========================================================
       *
       * First incomplete admin-created day.
       */

      const current =
        dayList.find(
          day =>
            !day.complete
        ) ?? null

      /*
       * =========================================================
       * 8. COMPLETED DAYS
       * =========================================================
       */

      const completeDays =
        dayList.filter(
          day =>
            day.complete
        ).length

      /*
       * =========================================================
       * 9. OVERALL PROGRESS
       * =========================================================
       */

      const overallPct =
        dayList.length >
        0
          ? (
              completeDays /
              dayList.length
            ) *
            100
          : 0

      /*
       * =========================================================
       * 10. CALCULATE ELAPSED JOURNEY DAYS
       * =========================================================
       *
       * Used only for Recovery Mode.
       */

      const startDate =
        enrollment.start_date
          ? new Date(
              enrollment.start_date
            )
          : new Date()

      startDate.setHours(
        0,
        0,
        0,
        0
      )

      const today =
        new Date()

      today.setHours(
        0,
        0,
        0,
        0
      )

      const elapsedDays =
        Math.max(
          1,
          Math.floor(
            (
              today.getTime() -
              startDate.getTime()
            ) /
              86400000
          ) + 1
        )

      /*
       * =========================================================
       * 11. FIND MISSED DAY
       * =========================================================
       */

      const missedDay =
        dayList.find(
          day =>
            day.day_number <
              elapsedDays &&
            !day.complete &&
            !day.recovery_of_day
        ) ?? null

      /*
       * =========================================================
       * 12. RECOVERY STATUS
       * =========================================================
       *
       * Kept for compatibility with the existing Journey.tsx.
       */

      const recoveryDays =
        dayList.filter(
          day =>
            day.recovery_of_day !==
            null
        )

      const recoveryActive =
        recoveryDays.length >
        0

      const recoverySourceDay =
        recoveryDays.length >
        0
          ? recoveryDays[0]
              .recovery_of_day ??
            null
          : null

      /*
       * =========================================================
       * 13. RETURN JOURNEY
       * =========================================================
       */

      return {
        enrollment:
          enrollment as any,

        /*
         * ADMIN CONTENT
         */
        phases:
          phases as JPhase[],

        days:
          dayList,

        /*
         * STUDENT PROGRESS
         */
        done:
          completedActivities,

        current,

        completeDays,

        overallPct,

        /*
         * RECOVERY
         */
        missedDay,

        recoveryActive,

        recoverySourceDay,
      }
    },
  })
}
