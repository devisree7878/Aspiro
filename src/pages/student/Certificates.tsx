
import { useEffect, useState } from 'react'
import {
  Award,
  CheckCircle2,
  Download,
  Lock,
  Printer,
  ShieldCheck,
} from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { supabase } from '../../lib/supabase'
import { Card, Button, Spinner } from '../../components/ui'
import { useAuth } from '../../features/auth/AuthContext'

type Certificate = {
  id: string
  student_id: string
  course_id: string
  certificate_number: string
  student_name: string
  course_title: string
  learning_path_title: string | null
  career_goal: string | null
  issued_at: string
  status: 'issued' | 'revoked'
}

type Enrollment = {
  course_id: string
  status: string
}

export default function Certificates() {
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [certificate, setCertificate] =
    useState<Certificate | null>(null)

  const [enrollment, setEnrollment] =
    useState<Enrollment | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    if (session?.user.id) {
      loadCertificate()
    }
  }, [session?.user.id])

  async function loadCertificate() {
    if (!session?.user.id) return

    setLoading(true)
    setError(null)

    try {
      const { data: enrollments, error: enrollmentError } =
        await supabase
          .from('enrollments')
          .select('course_id,status')
          .eq('student_id', session.user.id)
          .order('created_at', {
            ascending: false,
          })
          .limit(1)

      if (enrollmentError) {
        throw enrollmentError
      }

      const currentEnrollment =
        enrollments?.[0] ?? null

      setEnrollment(currentEnrollment)

      if (!currentEnrollment) {
        setLoading(false)
        return
      }

      const { data, error: certificateError } =
        await supabase
          .from('certificates')
          .select(`
            id,
            student_id,
            course_id,
            certificate_number,
            student_name,
            course_title,
            learning_path_title,
            career_goal,
            issued_at,
            status
          `)
          .eq(
            'course_id',
            currentEnrollment.course_id,
          )
          .eq(
            'student_id',
            session.user.id,
          )
          .eq(
            'status',
            'issued',
          )
          .maybeSingle()

      if (certificateError) {
        throw certificateError
      }

      setCertificate(
        data as Certificate | null,
      )
    } catch (err: any) {
      setError(
        err?.message ??
          'Unable to load certificate information.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function getCertificate() {
    if (!enrollment?.course_id) return

    setIssuing(true)
    setError(null)

    try {
      const { data, error: rpcError } =
        await supabase.rpc(
          'issue_certificate',
          {
            p_course_id:
              enrollment.course_id,
          },
        )

      if (rpcError) {
        throw rpcError
      }

      setCertificate(
        data as Certificate,
      )
    } catch (err: any) {
      setError(
        err?.message ??
          'Certificate is not available yet.',
      )
    } finally {
      setIssuing(false)
    }
  }

  /*
   * PRINT CERTIFICATE
   */
  function printCertificate() {
    window.print()
  }

  /*
   * DOWNLOAD CERTIFICATE AS REAL PDF
   */
  async function downloadCertificate() {
    const element =
      document.getElementById(
        'certificate',
      )

    if (!element || !certificate) {
      setError(
        'Certificate could not be found.',
      )
      return
    }

    try {
      setDownloading(true)
      setError(null)

      /*
       * Clone the certificate.
       * This prevents html2pdf from modifying
       * the visible certificate on the page.
       */
      const clone =
        element.cloneNode(
          true,
        ) as HTMLElement

      clone.style.width = '1120px'
      clone.style.maxWidth = '1120px'
      clone.style.margin = '0'
      clone.style.position = 'fixed'
      clone.style.left = '-10000px'
      clone.style.top = '0'
      clone.style.background = '#ffffff'
      clone.style.zIndex = '-1'

      document.body.appendChild(clone)

      /*
       * Allow browser to finish rendering
       * fonts and certificate styles.
       */
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 500),
      )

      const safeName =
        certificate.student_name
          .trim()
          .replace(
            /[^a-zA-Z0-9]+/g,
            '-',
          )
          .replace(
            /^-+|-+$/g,
            '',
          ) || 'Student'

      /*
       * Generate the PDF as a Blob.
       */
      const pdfBlob =
        await html2pdf()
          .set({
            margin: 0,

            filename:
              `ASPIRO-Certificate-${safeName}.pdf`,

            image: {
              type: 'jpeg',
              quality: 0.98,
            },
html2canvas: {
  scale: 3,
  useCORS: true,
  allowTaint: false,
  backgroundColor: '#ffffff',
  logging: false,
  letterRendering: true,
  imageTimeout: 0,
},

            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: 'landscape',
            },
          })
          .from(clone)
          .outputPdf('blob')

      /*
       * Remove temporary certificate.
       */
      document.body.removeChild(
        clone,
      )

      /*
       * Create browser download.
       */
      const blobUrl =
        URL.createObjectURL(
          pdfBlob,
        )

      const link =
        document.createElement('a')

      link.href = blobUrl

      link.download =
        `ASPIRO-Certificate-${safeName}.pdf`

      link.style.display = 'none'

      document.body.appendChild(
        link,
      )

      link.click()

      document.body.removeChild(
        link,
      )

      /*
       * Clean the temporary Blob URL.
       */
      setTimeout(() => {
        URL.revokeObjectURL(
          blobUrl,
        )
      }, 2000)

    } catch (err: any) {
      console.error(
        'Certificate PDF error:',
        err,
      )

      setError(
        'Unable to download the certificate PDF. Please try again.',
      )
    } finally {
      setDownloading(false)
    }
  }

  /*
   * LOADING
   */
  if (loading) {
    return <Spinner />
  }

  /*
   * ERROR
   */
  if (error && !certificate) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <div className="flex items-start gap-4">

            <div className="rounded-xl bg-red-100 p-3 text-red-600">
              <Lock size={22} />
            </div>

            <div className="min-w-0">

              <h1 className="text-lg font-bold">
                Certificate not available yet
              </h1>

              <p className="mt-2 break-words text-sm text-ink-soft">
                {error}
              </p>

            </div>
          </div>

          <Button
            className="mt-6"
            onClick={loadCertificate}
          >
            Check Again
          </Button>

        </Card>
      </div>
    )
  }

  /*
   * CERTIFICATE LOCKED
   */
  if (!certificate) {
    return (
      <div className="mx-auto max-w-4xl p-6">

        <div className="mb-8">

          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Achievement
          </p>

          <h1 className="mt-2 text-3xl font-extrabold">
            Certificate
          </h1>

          <p className="mt-2 text-ink-soft">
            Complete your entire learning journey to
            unlock your ASPIRO certificate.
          </p>

        </div>

        <Card>

          <div className="flex flex-col items-center py-12 text-center">

            <div className="rounded-full bg-slate-100 p-6 text-slate-400">
              <Lock size={42} />
            </div>

            <h2 className="mt-6 text-2xl font-bold">
              Certificate Locked
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-ink-soft">
              Your certificate becomes available only
              after you complete every required activity
              in your selected learning journey.
            </p>

            <div className="mt-6 rounded-xl bg-brand-50 px-5 py-4 text-sm text-brand-700">
              Complete all required lessons, quizzes,
              assignments, challenges and coding activities.
            </div>

            <Button
              className="mt-6"
              loading={issuing}
              onClick={getCertificate}
            >
              Check Certificate Eligibility
            </Button>

          </div>

        </Card>

      </div>
    )
  }

  /*
   * REVOKED
   */
  if (certificate.status === 'revoked') {
    return (
      <div className="mx-auto max-w-3xl p-6">

        <Card>

          <div className="py-10 text-center">

            <Lock
              size={42}
              className="mx-auto text-red-500"
            />

            <h1 className="mt-5 text-2xl font-bold">
              Certificate Revoked
            </h1>

            <p className="mt-2 text-sm text-ink-soft">
              This certificate is currently not valid.
            </p>

          </div>

        </Card>

      </div>
    )
  }

  /*
   * ISSUED CERTIFICATE
   */
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">

      {/* PAGE HEADER */}
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center print:hidden">

        <div>

          <div className="flex items-center gap-2">

            <ShieldCheck
              size={18}
              className="text-brand-600"
            />

            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">
              Verified Achievement
            </p>

          </div>

          <h1 className="mt-2 text-3xl font-extrabold">
            Your ASPIRO Certificate
          </h1>

          <p className="mt-2 text-ink-soft">
            Your learning journey has been successfully completed.
          </p>

        </div>

        <div className="flex gap-2">

          <Button
            variant="ghost"
            onClick={printCertificate}
          >
            <Printer size={17} />
            Print
          </Button>

          <Button
            onClick={downloadCertificate}
            disabled={downloading}
          >
            <Download size={17} />

            {downloading
              ? 'Generating PDF...'
              : 'Save as PDF'}
          </Button>

        </div>

      </div>

      {/* CERTIFICATE */}
      <div
        id="certificate"
        className="certificate-shell"
      >

        <div className="certificate-paper">

          {/* DECORATIVE CORNERS */}
          <div className="certificate-corner certificate-corner-tl" />
          <div className="certificate-corner certificate-corner-tr" />
          <div className="certificate-corner certificate-corner-bl" />
          <div className="certificate-corner certificate-corner-br" />

          {/* BRAND */}
          <div className="certificate-brand">

            <div className="certificate-logo">
              <Award size={30} />
            </div>

            <div>

              <div className="certificate-brand-name">
                ASPIRO
              </div>

              <div className="certificate-brand-subtitle">
                AI-POWERED LEARNING PLATFORM
              </div>

            </div>

          </div>

          {/* TITLE */}
          <div className="certificate-heading">

            <div className="certificate-kicker">
              OFFICIAL ACHIEVEMENT
            </div>

            <h2>
              CERTIFICATE
            </h2>

            <div className="certificate-heading-line">
              OF COMPLETION
            </div>

          </div>

          {/* PRESENTED TO */}
          <p className="certificate-presented">
            This certificate is proudly presented to
          </p>

          <h3 className="certificate-student-name">
            {certificate.student_name}
          </h3>

          <div className="certificate-name-line" />

          {/* DESCRIPTION */}
          <p className="certificate-body">
            for successfully completing all required
            learning activities, assessments, challenges
            and milestones in the selected ASPIRO learning
            journey.
          </p>

          {/* COURSE */}
          <div className="certificate-course-block">

            <p className="certificate-label">
              COMPLETED LEARNING PROGRAM
            </p>

            <h4 className="certificate-course-title">
              {certificate.course_title}
            </h4>

            {certificate.learning_path_title && (
              <p className="certificate-path-title">
                Learning Path:{' '}
                {certificate.learning_path_title}
              </p>
            )}

            {certificate.career_goal && (
              <p className="certificate-career">
                Career Goal:{' '}
                {certificate.career_goal}
              </p>
            )}

          </div>

          {/* COMPLETION */}
          <div className="certificate-completion">

            <CheckCircle2 size={19} />

            <span>
              All required learning milestones successfully completed
            </span>

          </div>

          {/* DETAILS */}
          <div className="certificate-details">

            <div className="certificate-detail">

              <span>
                ISSUED ON
              </span>

              <strong>
                {new Date(
                  certificate.issued_at,
                ).toLocaleDateString(
                  'en-IN',
                  {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  },
                )}
              </strong>

            </div>

            <div className="certificate-seal">

              <div className="certificate-seal-inner">

                <ShieldCheck size={25} />

                <span>
                  VERIFIED
                </span>

                <small>
                  ASPIRO
                </small>

              </div>

            </div>

    <div className="certificate-detail certificate-detail-right">
  <span>CERTIFICATE ID</span>

  <strong
    className="certificate-id"
    style={{
      display: 'block',
      fontSize: '13px',
      fontWeight: 800,
      color: '#111827',
      letterSpacing: '0.05em',
      marginTop: '6px',
      whiteSpace: 'nowrap',
    }}
  >
    {certificate.certificate_number}
  </strong>
</div>

          </div>

          {/* SIGNATURES */}
          <div className="certificate-signatures">

            <div className="certificate-signature">

              <div className="signature-line" />

              <strong>
                ASPIRO
              </strong>

              <span>
                Learning Platform
              </span>

            </div>

            <div className="certificate-signature">

              <div className="signature-line" />

              <strong>
                ASPIRO LEARNING DIRECTOR
              </strong>

              <span>
                Authorized Certification
              </span>

            </div>

          </div>

          {/* FOOTER */}
          <div className="certificate-footer">

            <span>
              ASPIRO • LEARN • BUILD • ACHIEVE
            </span>

            <span>
              AUTHENTIC DIGITAL CERTIFICATE
            </span>

          </div>

        </div>

      </div>

      {/* SUCCESS CARD */}
      <div className="mt-6 rounded-2xl bg-brand-50 p-5 print:hidden">

        <div className="flex items-start gap-3">

          <CheckCircle2
            size={22}
            className="mt-0.5 shrink-0 text-brand-600"
          />

          <div>

            <h3 className="font-bold text-brand-800">
              Certificate successfully issued
            </h3>

            <p className="mt-1 text-sm text-brand-700">
              This certificate is uniquely issued to{' '}
              <strong>
                {certificate.student_name}
              </strong>{' '}
              for completing{' '}
              <strong>
                {certificate.course_title}
              </strong>.
            </p>

            <p className="mt-1 text-xs text-brand-600">
              Certificate ID:{' '}
              {certificate.certificate_number}
            </p>

          </div>

        </div>

      </div>

    </div>
  )
}
