import JobDetails from './pages/JobDetails'
import { lazy, Suspense } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom'

import { configured } from './lib/supabase'
import { useAuth } from './features/auth/AuthContext'

import {
  Forgot,
  Login,
  Reset,
  Signup,
} from './features/auth/AuthPages'

import { Spinner } from './components/ui'

import {
  StudentLayout,
  AdminLayout,
} from './components/Layouts'

import Landing from './pages/Landing'

// ─────────────────────────────────────────────
// Job page
// IMPORTANT:
// Keep this as a normal import instead of lazy import.
// This avoids the JobDetails module-resolution issue.
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// Student pages
// ─────────────────────────────────────────────

const Onboarding = lazy(
  () => import('./features/onboarding/Onboarding')
)

const Certificates = lazy(
  () => import('./pages/student/Certificates')
)

const Home = lazy(
  () => import('./pages/student/Home')
)

const Journey = lazy(
  () => import('./pages/student/Journey')
)

const Player = lazy(
  () => import('./features/learning/Player')
)

const Skills = lazy(
  () => import('./pages/student/Skills')
)

const Notifications = lazy(
  () => import('./pages/student/Notifications')
)

const Settings = lazy(
  () => import('./pages/student/Settings')
)

const Hackathons = lazy(
  () => import('./pages/student/Hackathons')
)

// ─────────────────────────────────────────────
// Admin pages
// ─────────────────────────────────────────────

const AdminDashboard = lazy(
  () => import('./pages/admin/Dashboard')
)

const AdminCourses = lazy(
  () => import('./pages/admin/Courses')
)

const CourseBuilder = lazy(
  () => import('./pages/admin/CourseBuilder')
)

const DayBuilder = lazy(
  () => import('./pages/admin/DayBuilder')
)

const AdminCatalog = lazy(
  () => import('./pages/admin/Catalog')
)

const AdminStudents = lazy(
  () => import('./pages/admin/Students')
)

const AdminNotify = lazy(
  () => import('./pages/admin/Notify')
)

const AdminPreview = lazy(
  () => import('./pages/admin/Preview')
)

const AdminAudit = lazy(
  () => import('./pages/admin/Audit')
)

const AdminSubmissions = lazy(
  () => import('./pages/admin/Submissions')
)

const HackathonsAdmin = lazy(
  () => import('./pages/admin/Hackathons')
)

// ─────────────────────────────────────────────
// Supabase setup screen
// ─────────────────────────────────────────────

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-extrabold">
        Connect Supabase
      </h1>

      <p className="mt-3 text-ink-soft">
        Copy <code>.env.example</code> to{' '}
        <code>.env</code>, fill in{' '}
        <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>, run the SQL
        in <code>supabase/migrations</code>, then restart
        the dev server. See README.md.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Authentication guard
// ─────────────────────────────────────────────

function RequireAuth() {
  const {
    session,
    loading,
  } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return <Outlet />
}

// ─────────────────────────────────────────────
// Student guard
// ─────────────────────────────────────────────

function RequireStudent() {
  const {
    profile,
    isAdmin,
    loading,
  } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!profile) {
    return (
      <Spinner
        label="Preparing your account…"
      />
    )
  }

  if (profile.status === 'suspended') {
    return (
      <div className="p-10 text-center">
        This account is suspended. Please contact
        support.
      </div>
    )
  }

  if (
    !isAdmin &&
    !profile.onboarding_completed
  ) {
    return (
      <Navigate
        to="/onboarding"
        replace
      />
    )
  }

  return <Outlet />
}

// ─────────────────────────────────────────────
// Admin guard
// ─────────────────────────────────────────────

function RequireAdmin() {
  const {
    isAdmin,
    loading,
  } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!isAdmin) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  return <Outlet />
}

// ─────────────────────────────────────────────
// Root route
//
// Signed out:
//     / → Landing page
//
// Admin:
//     / → /admin
//
// New student:
//     / → /onboarding
//
// Existing student:
//     / → /dashboard
// ─────────────────────────────────────────────

function RootRoute() {
  const {
    session,
    profile,
    isAdmin,
    loading,
  } = useAuth()

  if (loading) {
    return <Spinner />
  }

  // Public user
  if (!session) {
    return <Landing />
  }

  // Admin
  if (isAdmin) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }

  // Profile still loading
  if (!profile) {
    return (
      <Spinner
        label="Preparing your account…"
      />
    )
  }

  // New student
  if (!profile.onboarding_completed) {
    return (
      <Navigate
        to="/onboarding"
        replace
      />
    )
  }

  // Existing student
  return (
    <Navigate
      to="/dashboard"
      replace
    />
  )
}

// ─────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────

export default function App() {
  if (!configured) {
    return <SetupNotice />
  }

  return (
    <Suspense
      fallback={<Spinner />}
    >
      <Routes>

        {/* ═══════════════════════════════════════
            PUBLIC HOMEPAGE
        ═══════════════════════════════════════ */}

        <Route
          path="/"
          element={<RootRoute />}
        />

        {/* ═══════════════════════════════════════
            PUBLIC AUTH ROUTES
        ═══════════════════════════════════════ */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/forgot"
          element={<Forgot />}
        />

        <Route
          path="/reset"
          element={<Reset />}
        />

        {/* ═══════════════════════════════════════
            AUTHENTICATED ROUTES
        ═══════════════════════════════════════ */}

        <Route
          element={<RequireAuth />}
        >

          {/* ────────────────────────────────────
              ONBOARDING
          ──────────────────────────────────── */}

          <Route
            path="/onboarding"
            element={<Onboarding />}
          />

          {/* ════════════════════════════════════
              STUDENT AREA
          ════════════════════════════════════ */}

          <Route
            element={<RequireStudent />}
          >

            {/* Job Details */}

            <Route
              path="jobs/:jobId"
              element={<JobDetails />}
            />

            {/* Student Layout */}

            <Route
              element={<StudentLayout />}
            >

              {/* Student Dashboard */}

              <Route
                path="dashboard"
                element={<Home />}
              />

              {/* Journey */}

              <Route
                path="journey"
                element={<Journey />}
              />

              {/* Learning */}

              <Route
                path="learn/:dayId"
                element={<Player />}
              />

              {/* Skills */}

              <Route
                path="skills"
                element={<Skills />}
              />

              {/* Hackathons */}

              <Route
                path="hackathons"
                element={<Hackathons />}
              />

              {/* Notifications */}

              <Route
                path="notifications"
                element={<Notifications />}
              />

              {/* Certificates */}

              <Route
                path="certificates"
                element={<Certificates />}
              />

              {/* Settings */}

              <Route
                path="settings"
                element={<Settings />}
              />

            </Route>
          </Route>

          {/* ════════════════════════════════════
              ADMIN AREA
          ════════════════════════════════════ */}

          <Route
            element={<RequireAdmin />}
          >

            <Route
              path="admin"
              element={<AdminLayout />}
            >

              {/* Dashboard */}

              <Route
                index
                element={<AdminDashboard />}
              />

              {/* Courses */}

              <Route
                path="courses"
                element={<AdminCourses />}
              />

              {/* Course Builder */}

              <Route
                path="courses/:courseId"
                element={<CourseBuilder />}
              />

              {/* Day Builder */}

              <Route
                path="days/:dayId"
                element={<DayBuilder />}
              />

              {/* Preview */}

              <Route
                path="preview/:dayId"
                element={<AdminPreview />}
              />

              {/* Careers, Skills & Jobs */}

              <Route
                path="catalog"
                element={<AdminCatalog />}
              />

              {/* Students */}

              <Route
                path="students"
                element={<AdminStudents />}
              />

              {/* Notifications */}

              <Route
                path="notifications"
                element={<AdminNotify />}
              />

              {/* Hackathons */}

              <Route
                path="hackathons"
                element={<HackathonsAdmin />}
              />

              {/* Job Applications + Learning Submissions */}

              <Route
                path="submissions"
                element={<AdminSubmissions />}
              />

              {/* Audit */}

              <Route
                path="audit"
                element={<AdminAudit />}
              />

            </Route>
          </Route>

        </Route>

        {/* ═══════════════════════════════════════
            FALLBACK
        ═══════════════════════════════════════ */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </Suspense>
  )
}