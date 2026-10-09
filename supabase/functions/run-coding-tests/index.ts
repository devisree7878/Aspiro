import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
  c: 50,
  csharp: 51,
};

type TestCase = {
  input: string;
  expected: string;
};

type ExecutionResult = {
  test_id: number;
  passed: boolean;
  input: string | null;
  output: string;
  expected?: string;
  status: string;
  runtime_ms?: number | null;
  error?: string;
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function normalizeOutput(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

async function runJudge0(
  judgeUrl: string,
  sourceCode: string,
  languageId: number,
  input: string,
): Promise<Record<string, any>> {
  const createResponse = await fetch(
    `${judgeUrl}/submissions?base64_encoded=false&wait=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin: input,
      }),
    },
  );

  if (!createResponse.ok) {
    const errorText =
      await createResponse.text();

    throw new Error(
      `Judge0 submission failed (${createResponse.status}): ${errorText}`,
    );
  }

  const created: Record<string, any> =
    await createResponse.json();

  if (!created.token) {
    throw new Error(
      "Judge0 did not return a submission token.",
    );
  }

  const token = String(created.token);

  for (
    let attempt = 0;
    attempt < 30;
    attempt++
  ) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, 1000),
    );

    const resultResponse =
      await fetch(
        `${judgeUrl}/submissions/${token}?base64_encoded=false`,
      );

    if (!resultResponse.ok) {
      continue;
    }

    const result: Record<string, any> =
      await resultResponse.json();

    const statusId =
      Number(result.status?.id ?? 0);

    if (
      statusId === 1 ||
      statusId === 2
    ) {
      continue;
    }

    return result;
  }

  throw new Error(
    "Code execution timed out.",
  );
}

Deno.serve(
  async (
    req: Request,
  ): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error:
            "Only POST requests are allowed.",
        },
        405,
      );
    }

    try {
      /* ================================================================ */
      /* ENVIRONMENT                                                      */
      /* ================================================================ */

      const supabaseUrl =
        Deno.env.get("SUPABASE_URL");

      const supabaseAnonKey =
        Deno.env.get(
          "SUPABASE_ANON_KEY",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      const judgeUrl =
        Deno.env.get("JUDGE0_URL") ||
        "https://ce.judge0.com";

      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !serviceRoleKey
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Supabase server configuration is incomplete.",
          },
          500,
        );
      }

      /* ================================================================ */
      /* AUTHENTICATION                                                    */
      /* ================================================================ */

      const authorization =
        req.headers.get(
          "Authorization",
        );

      if (!authorization) {
        return jsonResponse(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      const token =
        authorization
          .replace(
            /^Bearer\s+/i,
            "",
          )
          .trim();

      if (!token) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid authorization token.",
          },
          401,
        );
      }

      const userClient =
        createClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            global: {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          },
        );

      const {
        data: userData,
        error: userError,
      } =
        await userClient.auth.getUser(
          token,
        );

      if (
        userError ||
        !userData.user
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Your session is invalid or expired.",
          },
          401,
        );
      }

      const user =
        userData.user;

      /* ================================================================ */
      /* ADMIN SUPABASE CLIENT                                            */
      /* ================================================================ */

      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,
              persistSession:
                false,
            },
          },
        );

      /* ================================================================ */
      /* REQUEST BODY                                                     */
      /* ================================================================ */

      const body: Record<
        string,
        any
      > = await req.json();

      const activityId =
        body.activity_id;

      const code =
        body.code;

      const language =
        String(
          body.language ||
            "python",
        ).toLowerCase();

      /*
       * Frontend currently sends:
       *
       * public_only: true / false
       *
       * We support that directly.
       */
      const publicOnly =
        Boolean(
          body.public_only,
        );

      /*
       * Also support:
       *
       * submit: true / false
       *
       * for backwards compatibility.
       */
      const submit =
        body.submit === true ||
        publicOnly === false;

      if (!activityId) {
        return jsonResponse(
          {
            success: false,
            error:
              "activity_id is required.",
          },
          400,
        );
      }

      if (
        !code ||
        typeof code !== "string"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Code is required.",
          },
          400,
        );
      }

      if (code.length > 50000) {
        return jsonResponse(
          {
            success: false,
            error:
              "Code is too large. Maximum 50,000 characters.",
          },
          400,
        );
      }

      const languageId =
        LANGUAGE_IDS[language];

      if (!languageId) {
        return jsonResponse(
          {
            success: false,
            error:
              `Unsupported language: ${language}`,
          },
          400,
        );
      }

      /* ================================================================ */
      /* LOAD ACTIVITY                                                    */
      /* ================================================================ */

      const {
        data: activity,
        error: activityError,
      } = await adminClient
        .from("activities")
        .select(
          `
          id,
          title,
          type,
          content,
          version,
          day_id,
          days (
            id,
            course_id
          )
        `,
        )
        .eq(
          "id",
          activityId,
        )
        .maybeSingle();

      if (activityError) {
        console.error(
          "Activity query error:",
          activityError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Unable to load the coding activity.",
          },
          500,
        );
      }

      if (!activity) {
        return jsonResponse(
          {
            success: false,
            error:
              "Activity not found.",
          },
          404,
        );
      }

      if (
        activity.type !==
        "coding_exercise"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "This activity is not a coding exercise.",
          },
          400,
        );
      }

      /* ================================================================ */
      /* COURSE                                                           */
      /* ================================================================ */

      const day =
        Array.isArray(
          activity.days,
        )
          ? activity.days[0]
          : activity.days;

      if (!day?.course_id) {
        return jsonResponse(
          {
            success: false,
            error:
              "The activity is not connected to a course.",
          },
          400,
        );
      }

      /* ================================================================ */
      /* ENROLLMENT                                                       */
      /* ================================================================ */

      const {
        data: enrollment,
        error: enrollmentError,
      } = await adminClient
        .from("enrollments")
        .select(
          "id,status",
        )
        .eq(
          "student_id",
          user.id,
        )
        .eq(
          "course_id",
          day.course_id,
        )
        .eq(
          "status",
          "active",
        )
        .maybeSingle();

      if (enrollmentError) {
        console.error(
          "Enrollment error:",
          enrollmentError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Unable to verify course enrollment.",
          },
          500,
        );
      }

      if (!enrollment) {
        return jsonResponse(
          {
            success: false,
            error:
              "You are not enrolled in this course.",
          },
          403,
        );
      }

      /* ================================================================ */
      /* PUBLIC TESTS                                                     */
      /* ================================================================ */

      const content =
        activity.content &&
        typeof activity.content ===
          "object"
          ? activity.content
          : {};

      const publicTests: TestCase[] =
        Array.isArray(
          content.public_tests,
        )
          ? content.public_tests
              .filter(
                (test: any) =>
                  typeof test?.input ===
                    "string" &&
                  (
                    typeof test?.expected ===
                      "string" ||
                    typeof test?.expected_output ===
                      "string"
                  ),
              )
              .map(
                (test: any) => ({
                  input:
                    test.input,
                  expected:
                    typeof test.expected ===
                    "string"
                      ? test.expected
                      : String(
                          test.expected_output ??
                            "",
                        ),
                }),
              )
          : [];

      /* ================================================================ */
      /* HIDDEN TESTS                                                     */
      /* ================================================================ */

      let hiddenTests: TestCase[] =
        [];

      if (submit) {
        const {
          data: secret,
          error: secretError,
        } = await adminClient
          .from(
            "activity_secrets",
          )
          .select("content")
          .eq(
            "activity_id",
            activityId,
          )
          .maybeSingle();

        if (secretError) {
          console.error(
            "Secret query error:",
            secretError,
          );

          return jsonResponse(
            {
              success: false,
              error:
                "Unable to load hidden tests.",
            },
            500,
          );
        }

        const secretContent =
          secret?.content &&
          typeof secret.content ===
            "object"
            ? secret.content
            : {};

        hiddenTests =
          Array.isArray(
            secretContent.hidden_tests,
          )
            ? secretContent.hidden_tests
                .filter(
                  (test: any) =>
                    typeof test?.input ===
                      "string" &&
                    (
                      typeof test?.expected ===
                        "string" ||
                      typeof test?.expected_output ===
                        "string"
                    ),
                )
                .map(
                  (test: any) => ({
                    input:
                      test.input,
                    expected:
                      typeof test.expected ===
                      "string"
                        ? test.expected
                        : String(
                            test.expected_output ??
                              "",
                          ),
                  }),
                )
            : [];
      }

      const tests =
        submit
          ? [
              ...publicTests,
              ...hiddenTests,
            ]
          : publicTests;

      if (tests.length === 0) {
        return jsonResponse(
          {
            success: false,
            error:
              "No test cases have been configured for this coding activity.",
          },
          400,
        );
      }

      if (tests.length > 30) {
        return jsonResponse(
          {
            success: false,
            error:
              "Too many test cases configured. Maximum is 30.",
          },
          400,
        );
      }

      /* ================================================================ */
      /* RUN TESTS                                                        */
      /* ================================================================ */

      const results: ExecutionResult[] =
        [];

      for (
        let index = 0;
        index < tests.length;
        index++
      ) {
        const test =
          tests[index];

        try {
          const judgeResult =
            await runJudge0(
              judgeUrl,
              code,
              languageId,
              test.input,
            );

          const output =
            normalizeOutput(
              judgeResult.stdout,
            );

          const expected =
            normalizeOutput(
              test.expected,
            );

          const passed =
            Number(
              judgeResult.status
                ?.id,
            ) === 3 &&
            output ===
              expected;

          const isHidden =
            submit &&
            index >=
              publicTests.length;

          results.push({
            test_id: index,
            passed,
            input: isHidden
              ? null
              : test.input,
            output,
            ...(isHidden
              ? {}
              : {
                  expected,
                }),
            status:
              judgeResult
                .status
                ?.description ||
              "Unknown",
            runtime_ms:
              judgeResult.time
                ? Math.round(
                    Number(
                      judgeResult.time,
                    ) * 1000,
                  )
                : null,
            error:
              judgeResult.stderr ||
              judgeResult.compile_output ||
              judgeResult.message ||
              undefined,
          });
        } catch (
          error
        ) {
          const isHidden =
            submit &&
            index >=
              publicTests.length;

          results.push({
            test_id: index,
            passed: false,
            input: isHidden
              ? null
              : test.input,
            output: "",
            ...(isHidden
              ? {}
              : {
                  expected:
                    test.expected,
                }),
            status:
              "Execution Error",
            error:
              error instanceof
              Error
                ? error.message
                : "Unknown execution error.",
          });
        }
      }

      /* ================================================================ */
      /* SCORE                                                            */
      /* ================================================================ */

      const passedCount =
        results.filter(
          (result) =>
            result.passed,
        ).length;

      const totalCount =
        results.length;

      const score =
        totalCount > 0
          ? Math.round(
              (passedCount /
                totalCount) *
                100,
            )
          : 0;

      const allPassed =
        totalCount > 0 &&
        passedCount ===
          totalCount;

      /* ================================================================ */
      /* SAVE SUBMISSION                                                 */
      /* ================================================================ */

      if (submit) {
        const {
          error: submissionError,
        } = await adminClient
          .from("submissions")
          .insert({
            student_id:
              user.id,
            activity_id:
              activityId,
            code,
            language,
            status:
              allPassed
                ? "passed"
                : "failed",
            score,
            feedback:
              allPassed
                ? "All test cases passed."
                : `${passedCount} of ${totalCount} test cases passed.`,
            activity_version:
              activity.version ??
              1,
          });

        if (submissionError) {
          console.error(
            "Submission insert error:",
            submissionError,
          );
        }

        /* ============================================================ */
        /* COMPLETE ACTIVITY                                            */
        /* ============================================================ */

        if (allPassed) {
          const {
            data: existingProgress,
          } = await adminClient
            .from(
              "activity_progress",
            )
            .select(
              "id,attempts",
            )
            .eq(
              "student_id",
              user.id,
            )
            .eq(
              "activity_id",
              activityId,
            )
            .maybeSingle();

          const attempts =
            Number(
              existingProgress?.attempts ??
                0,
            ) + 1;

          const {
            error:
              progressError,
          } =
            await adminClient
              .from(
                "activity_progress",
              )
              .upsert(
                {
                  student_id:
                    user.id,
                  activity_id:
                    activityId,
                  status:
                    "completed",
                  score,
                  attempts,
                  completed_at:
                    new Date().toISOString(),
                  activity_version:
                    activity.version ??
                    1,
                },
                {
                  onConflict:
                    "student_id,activity_id",
                },
              );

          if (
            progressError
          ) {
            console.error(
              "Progress update error:",
              progressError,
            );
          }
        }
      }

      /* ================================================================ */
      /* RESPONSE                                                         */
      /* ================================================================ */

      return jsonResponse({
        success: true,
        submit,
        public_only:
          !submit,
        passed:
          allPassed,
        score,
        passed_count:
          passedCount,
        total_count:
          totalCount,
        tests: results,
      });
    } catch (error) {
      console.error(
        "run-coding-tests error:",
        error,
      );

      return jsonResponse(
        {
          success: false,
          error:
            error instanceof
            Error
              ? error.message
              : "Unexpected server error.",
        },
        500,
      );
    }
  },
);