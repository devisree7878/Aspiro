import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ExternalLink,
  MapPin,
  Trophy,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Hackathon = {
  id: string
  title: string
  description: string | null
  organizer: string | null
  event_date: string | null
  registration_deadline: string | null
  mode: string | null
  location: string | null
  registration_url: string | null
  event_url: string | null
  banner_url: string | null
  created_at: string
}

export default function Hackathons() {
  const [hackathons, setHackathons] =
    useState<Hackathon[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    void loadHackathons()
  }, [])

  async function loadHackathons() {
    setLoading(true)
    setError(null)

    const { data, error: loadError } =
      await supabase
        .from('hackathon_posts')
        .select(
          `
          id,
          title,
          description,
          organizer,
          event_date,
          registration_deadline,
          mode,
          location,
          registration_url,
          event_url,
          banner_url,
          created_at
          `,
        )
        .eq('status', 'published')
        .order('event_date', {
          ascending: true,
          nullsFirst: false,
        })

    if (loadError) {
      console.error(
        'Hackathons load error:',
        loadError,
      )

      setError(loadError.message)
      setLoading(false)
      return
    }

    setHackathons(
      (data ?? []) as Hackathon[],
    )

    setLoading(false)
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return 'Date not announced'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'Date not announced'
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      },
    )
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-3">
              <Trophy className="h-7 w-7 text-indigo-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Hackathons
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Discover hackathons, competitions and opportunities posted by ASPIRO.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">
              Loading hackathons...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="font-semibold text-red-300">
              Unable to load hackathons
            </h2>

            <p className="mt-2 text-sm text-red-200/80">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadHackathons()
              }
              className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          hackathons.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
              <Trophy className="mx-auto h-12 w-12 text-slate-600" />

              <h2 className="mt-4 text-lg font-semibold">
                No hackathons available
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                New hackathons and competitions will appear here when they are published.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          hackathons.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {hackathons.map(
                (hackathon) => (
                  <article
                    key={hackathon.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl transition hover:-translate-y-1 hover:border-indigo-500/30"
                  >
                    {hackathon.banner_url ? (
                      <img
                        src={
                          hackathon.banner_url
                        }
                        alt={
                          hackathon.title
                        }
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-indigo-600/30 via-slate-900 to-purple-600/20">
                        <Trophy className="h-16 w-16 text-indigo-400/70" />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">
                          {
                            hackathon.title
                          }
                        </h2>

                        {hackathon.mode && (
                          <span className="shrink-0 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
                            {
                              hackathon.mode
                            }
                          </span>
                        )}
                      </div>

                      {hackathon.organizer && (
                        <p className="mb-3 text-sm text-slate-400">
                          By{' '}
                          {
                            hackathon.organizer
                          }
                        </p>
                      )}

                      {hackathon.description && (
                        <p className="mb-5 line-clamp-4 text-sm leading-6 text-slate-300">
                          {
                            hackathon.description
                          }
                        </p>
                      )}

                      <div className="space-y-3 border-t border-slate-800 pt-4">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                          <CalendarDays className="h-4 w-4 text-indigo-400" />

                          <span>
                            Event:{' '}
                            {formatDate(
                              hackathon.event_date,
                            )}
                          </span>
                        </div>

                        {hackathon.registration_deadline && (
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CalendarDays className="h-4 w-4 text-amber-400" />

                            <span>
                              Register by:{' '}
                              {formatDate(
                                hackathon.registration_deadline,
                              )}
                            </span>
                          </div>
                        )}

                        {hackathon.location && (
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <MapPin className="h-4 w-4 text-emerald-400" />

                            <span>
                              {
                                hackathon.location
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex gap-3">
                        {hackathon.registration_url && (
                          <a
                            href={
                              hackathon.registration_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold transition hover:bg-indigo-500"
                          >
                            Register
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}

                        {hackathon.event_url && (
                          <a
                            href={
                              hackathon.event_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                          >
                            Details
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
      </div>
    </div>
  )
}