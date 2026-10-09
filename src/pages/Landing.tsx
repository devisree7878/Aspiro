
import { Link } from 'react-router-dom'

function AspiroLogo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-3"
      aria-label="ASPIRO home"
    >
      <span className="relative flex h-8 w-8 items-center justify-center">
        <svg
          viewBox="0 0 40 40"
          className="h-8 w-8"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 4L36 34H28.5L20 17.8L11.5 34H4L20 4Z"
            fill="url(#aspiroGradient)"
          />

          <path
            d="M14.2 28.5L20 17.8L25.8 28.5H20H14.2Z"
            fill="#07101F"
          />

          <defs>
            <linearGradient
              id="aspiroGradient"
              x1="7"
              y1="7"
              x2="34"
              y2="34"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4F8CFF" />
              <stop offset="0.5" stopColor="#625BFF" />
              <stop offset="1" stopColor="#9B5CFF" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      <span className="text-[15px] font-medium tracking-[0.42em] text-white">
        ASPIRO
      </span>
    </Link>
  )
}

function CareerPath() {
  return (
    <div
      className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
      aria-hidden="true"
    >
      {/* Atmospheric circles */}
      <div className="absolute -right-[360px] top-[70px] h-[780px] w-[780px] rounded-full border border-blue-500/[0.08]" />

      <div className="absolute -right-[285px] top-[145px] h-[630px] w-[630px] rounded-full border border-violet-500/[0.08]" />

      {/* Career path */}
      <svg
        viewBox="0 0 760 600"
        className="absolute right-[-40px] top-[60px] h-[600px] w-[760px]"
        fill="none"
      >
        <defs>
          <linearGradient
            id="careerPath"
            x1="60"
            y1="520"
            x2="700"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              stopColor="#4F8CFF"
              stopOpacity="0.18"
            />

            <stop
              offset="0.35"
              stopColor="#4F8CFF"
            />

            <stop
              offset="0.7"
              stopColor="#735CFF"
            />

            <stop
              offset="1"
              stopColor="#A55CFF"
            />
          </linearGradient>

          <filter
            id="careerGlow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur
              stdDeviation="7"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M40 545 C175 500 220 420 350 390 C475 360 475 285 580 245 C640 222 674 185 705 112"
          stroke="url(#careerPath)"
          strokeWidth="2"
          className="drop-shadow-[0_0_8px_rgba(75,130,255,0.7)]"
        />

        {/* Goal */}
        <circle
          cx="150"
          cy="475"
          r="5"
          fill="#8BB4FF"
          filter="url(#careerGlow)"
        />

        <circle
          cx="150"
          cy="475"
          r="11"
          stroke="#4F8CFF"
          strokeOpacity="0.18"
        />

        {/* Skills */}
        <circle
          cx="435"
          cy="330"
          r="5"
          fill="#8C83FF"
          filter="url(#careerGlow)"
        />

        <circle
          cx="435"
          cy="330"
          r="11"
          stroke="#735CFF"
          strokeOpacity="0.18"
        />

        {/* Opportunity */}
        <circle
          cx="705"
          cy="112"
          r="6"
          fill="#B28AFF"
          filter="url(#careerGlow)"
        />

        <circle
          cx="705"
          cy="112"
          r="14"
          stroke="#9B5CFF"
          strokeOpacity="0.2"
        />
      </svg>

      <span className="absolute right-[72%] top-[455px] text-xs text-slate-600">
        Goal
      </span>

      <span className="absolute right-[36%] top-[390px] text-xs text-slate-500">
        Skills
      </span>

      <span className="absolute right-[6%] top-[195px] text-sm text-slate-400">
        Opportunity
      </span>
    </div>
  )
}

export default function Landing() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#030711] text-white">

      {/* Background atmosphere */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-[5%] top-[5%] h-[350px] w-[350px] rounded-full bg-blue-600/[0.035] blur-[130px]" />

        <div className="absolute right-[5%] top-[15%] h-[450px] w-[450px] rounded-full bg-violet-600/[0.045] blur-[150px]" />

        <div className="absolute bottom-[5%] left-[40%] h-[300px] w-[300px] rounded-full bg-indigo-600/[0.025] blur-[130px]" />
      </div>

      {/* Navigation */}
      <header className="relative z-30 mx-auto flex h-[84px] max-w-[1400px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <AspiroLogo />

        {/* Desktop */}
        <Link
          to="/signup"
          className="hidden rounded-full bg-gradient-to-r from-[#625BFF] to-[#438EFF] px-7 py-3 text-sm font-medium text-white shadow-[0_0_35px_rgba(73,101,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_45px_rgba(73,101,255,0.35)] md:inline-flex"
        >
          Get Started
        </Link>

        {/* Mobile */}
        <Link
          to="/signup"
          className="rounded-full bg-gradient-to-r from-[#625BFF] to-[#438EFF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_25px_rgba(73,101,255,0.18)] md:hidden"
        >
          Get Started
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-16">
        <CareerPath />

        <div className="relative flex min-h-[calc(100vh-84px)] items-center">

          <div className="max-w-[680px] pb-24 pt-10 lg:pb-32">

            {/* Small label */}
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-blue-400 to-violet-500" />

              <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-blue-300">
                Career Intelligence
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-[54px] font-light leading-[0.96] tracking-[-0.05em] sm:text-[72px] lg:text-[86px]">

              <span className="block text-white">
                Your career.
              </span>

              <span className="mt-3 block bg-gradient-to-r from-[#4D91FF] via-[#675EFF] to-[#A35BFF] bg-clip-text text-transparent">
                Your direction.
              </span>

            </h1>

            {/* Description */}
            <p className="mt-8 max-w-[480px] text-[17px] leading-7 text-slate-400">
              One intelligent system to help you move
              from ambition to opportunity.
            </p>

            {/* CTA */}
            <div className="mt-10">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-4 rounded-full bg-gradient-to-r from-[#625BFF] to-[#438EFF] px-8 py-4 text-sm font-medium text-white shadow-[0_0_45px_rgba(73,101,255,0.2)] transition-all duration-300 hover:gap-5 hover:shadow-[0_0_60px_rgba(73,101,255,0.35)]"
              >
                Start your journey

                <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="relative z-20 mx-auto max-w-[1400px] px-6 pb-8 sm:px-10 lg:px-16">

        <div className="border-t border-white/[0.06] pt-7">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="text-xs text-slate-600">
              ASPIRO — Build what comes next.
            </div>

            <div className="text-xs text-slate-700">
              Career Intelligence Platform
            </div>

          </div>

        </div>

      </footer>

    </main>
  )
}
