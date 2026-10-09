import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Archive,
  CalendarDays,
  Edit3,
  ExternalLink,
  ImagePlus,
  MapPin,
  Plus,
  Save,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type HackathonStatus = 'draft' | 'published' | 'archived'

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
  status: HackathonStatus
  created_at: string
}

type FormState = {
  title: string
  description: string
  organizer: string
  event_date: string
  registration_deadline: string
  mode: string
  location: string
  registration_url: string
  event_url: string
  banner_url: string
}

const emptyForm: FormState = {
  title: '',
  description: '',
  organizer: '',
  event_date: '',
  registration_deadline: '',
  mode: 'Online',
  location: '',
  registration_url: '',
  event_url: '',
  banner_url: '',
}

const HACKATHON_BUCKET = 'hackathons'

export default function HackathonsAdmin() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null)

  const [imagePreview, setImagePreview] =
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
        .select(`
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
          status,
          created_at
        `)
        .order('created_at', {
          ascending: false,
        })

    if (loadError) {
      console.error(
        'Load hackathons error:',
        loadError,
      )
      setError(loadError.message)
    } else {
      setHackathons(
        (data ?? []) as Hackathon[],
      )
    }

    setLoading(false)
  }

  function updateField(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setSelectedImage(null)
    setImagePreview(null)
  }

  function openCreate() {
    resetForm()
    setError(null)
    setMessage(null)
    setShowForm(true)
  }

  function databaseDateToInput(
    value: string | null,
  ) {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const day = String(
      date.getDate(),
    ).padStart(2, '0')

    const month = String(
      date.getMonth() + 1,
    ).padStart(2, '0')

    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  }

  function openEdit(
    hackathon: Hackathon,
  ) {
    setEditingId(hackathon.id)

    setForm({
      title: hackathon.title,
      description:
        hackathon.description ?? '',
      organizer:
        hackathon.organizer ?? '',
      event_date:
        databaseDateToInput(
          hackathon.event_date,
        ),
      registration_deadline:
        databaseDateToInput(
          hackathon.registration_deadline,
        ),
      mode:
        hackathon.mode ?? 'Online',
      location:
        hackathon.location ?? '',
      registration_url:
        hackathon.registration_url ?? '',
      event_url:
        hackathon.event_url ?? '',
      banner_url:
        hackathon.banner_url ?? '',
    })

    setSelectedImage(null)
    setImagePreview(
      hackathon.banner_url ?? null,
    )

    setError(null)
    setMessage(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    resetForm()
  }

  function isValidDate(
    value: string,
  ) {
    if (!value) return true

    const match = value.match(
      /^(\d{2})-(\d{2})-(\d{4})$/,
    )

    if (!match) return false

    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return false
    }

    const date = new Date(
      year,
      month - 1,
      day,
    )

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    )
  }

  function dateInputToIso(
    value: string,
  ): string | null {
    if (!value.trim()) return null

    if (!isValidDate(value)) {
      return null
    }

    const [day, month, year] =
      value.split('-').map(Number)

    const date = new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
    )

    return date.toISOString()
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) return 'Not set'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'Not set'
    }

    const day = String(
      date.getDate(),
    ).padStart(2, '0')

    const month = String(
      date.getMonth() + 1,
    ).padStart(2, '0')

    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  }

  function handleImageSelect(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0]

    if (!file) return

    if (
      !file.type.startsWith('image/')
    ) {
      setError(
        'Please select an image file.',
      )
      return
    }

    if (
      file.size > 5 * 1024 * 1024
    ) {
      setError(
        'Image must be smaller than 5 MB.',
      )
      return
    }

    setError(null)
    setSelectedImage(file)

    const preview =
      URL.createObjectURL(file)

    setImagePreview(preview)
  }

  async function uploadImage() {
    if (!selectedImage) {
      return form.banner_url || null
    }

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser()

    if (
      userError ||
      !userData.user
    ) {
      throw new Error(
        'You must be signed in as an admin.',
      )
    }

    const extension =
      selectedImage.name
        .split('.')
        .pop()
        ?.toLowerCase() || 'jpg'

    const fileName =
      `${crypto.randomUUID()}.${extension}`

    const filePath =
      `${userData.user.id}/${fileName}`

    const {
      error: uploadError,
    } = await supabase.storage
      .from(HACKATHON_BUCKET)
      .upload(
        filePath,
        selectedImage,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            selectedImage.type,
        },
      )

    if (uploadError) {
      throw uploadError
    }

    const { data } =
      supabase.storage
        .from(HACKATHON_BUCKET)
        .getPublicUrl(
          filePath,
        )

    if (!data.publicUrl) {
      throw new Error(
        'Could not create image URL.',
      )
    }

    return data.publicUrl
  }

  async function saveHackathon(
    event: FormEvent<HTMLFormElement> | null,
    publish: boolean,
  ) {
    event?.preventDefault()

    setError(null)
    setMessage(null)

    if (!form.title.trim()) {
      setError(
        'Hackathon title is required.',
      )
      return
    }

    if (
      form.event_date &&
      !isValidDate(
        form.event_date,
      )
    ) {
      setError(
        'Event Date must be in DD-MM-YYYY format.',
      )
      return
    }

    if (
      form.registration_deadline &&
      !isValidDate(
        form.registration_deadline,
      )
    ) {
      setError(
        'Registration Deadline must be in DD-MM-YYYY format.',
      )
      return
    }

    const eventIso =
      dateInputToIso(
        form.event_date,
      )

    const deadlineIso =
      dateInputToIso(
        form.registration_deadline,
      )

    if (
      eventIso &&
      deadlineIso &&
      new Date(deadlineIso) >
        new Date(eventIso)
    ) {
      setError(
        'Registration deadline should normally be on or before the event date.',
      )
      return
    }

    setSaving(true)

    try {
      const bannerUrl =
        await uploadImage()

      let hackathonId =
        editingId

      /*
       * CREATE
       */
      if (!editingId) {
        const {
          data,
          error: createError,
        } = await supabase.rpc(
          'admin_create_hackathon',
          {
            p_title:
              form.title.trim(),

            p_description:
              form.description.trim() ||
              null,

            p_organizer:
              form.organizer.trim() ||
              null,

            p_event_date:
              eventIso,

            p_registration_deadline:
              deadlineIso,

            p_mode:
              form.mode.trim() ||
              null,

            p_location:
              form.location.trim() ||
              null,

            p_registration_url:
              form.registration_url.trim() ||
              null,

            p_event_url:
              form.event_url.trim() ||
              null,

            p_banner_url:
              bannerUrl,
          },
        )

        if (createError) {
          throw createError
        }

        hackathonId = data

        if (!hackathonId) {
          throw new Error(
            'Hackathon was created but no ID was returned.',
          )
        }
      }

      /*
       * UPDATE
       */
      if (editingId) {
        const {
          error: updateError,
        } = await supabase.rpc(
          'admin_update_hackathon',
          {
            p_id: editingId,

            p_title:
              form.title.trim(),

            p_description:
              form.description.trim() ||
              null,

            p_organizer:
              form.organizer.trim() ||
              null,

            p_event_date:
              eventIso,

            p_registration_deadline:
              deadlineIso,

            p_mode:
              form.mode.trim() ||
              null,

            p_location:
              form.location.trim() ||
              null,

            p_registration_url:
              form.registration_url.trim() ||
              null,

            p_event_url:
              form.event_url.trim() ||
              null,

            p_banner_url:
              bannerUrl,
          },
        )

        if (updateError) {
          throw updateError
        }
      }

      /*
       * PUBLISH
       */
      if (
        publish &&
        hackathonId
      ) {
        const {
          error: publishError,
        } = await supabase.rpc(
          'publish_hackathon',
          {
            p_hackathon_id:
              hackathonId,
          },
        )

        if (publishError) {
          throw publishError
        }
      }

      setMessage(
        publish
          ? 'Hackathon published successfully. All students have been notified.'
          : 'Hackathon saved as draft.',
      )

      setShowForm(false)
      resetForm()

      await loadHackathons()
    } catch (saveError) {
      console.error(
        'Hackathon save error:',
        saveError,
      )

      const message =
        saveError &&
        typeof saveError === 'object' &&
        'message' in saveError
          ? String(
              (
                saveError as {
                  message: string
                }
              ).message,
            )
          : saveError instanceof Error
            ? saveError.message
            : 'Could not save hackathon.'

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(
    id: string,
    status: HackathonStatus,
  ) {
    setError(null)
    setMessage(null)
    setSaving(true)

    try {
      if (status === 'published') {
        const {
          error: publishError,
        } = await supabase.rpc(
          'publish_hackathon',
          {
            p_hackathon_id: id,
          },
        )

        if (publishError) {
          throw publishError
        }

        setMessage(
          'Hackathon published successfully. All students have been notified.',
        )
      } else {
        const {
          error: statusError,
        } = await supabase.rpc(
          'admin_set_hackathon_status',
          {
            p_id: id,
            p_status: status,
          },
        )

        if (statusError) {
          throw statusError
        }

        setMessage(
          status === 'archived'
            ? 'Hackathon archived.'
            : 'Hackathon moved to draft.',
        )
      }

      await loadHackathons()
    } catch (statusError) {
      console.error(
        'Hackathon status error:',
        statusError,
      )

      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Could not update hackathon.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteHackathon(
    id: string,
  ) {
    const confirmed =
      window.confirm(
        'Delete this hackathon permanently?',
      )

    if (!confirmed) return

    setError(null)
    setMessage(null)
    setSaving(true)

    try {
      const {
        error: deleteError,
      } = await supabase.rpc(
        'admin_delete_hackathon',
        {
          p_id: id,
        },
      )

      if (deleteError) {
        throw deleteError
      }

      setMessage(
        'Hackathon deleted.',
      )

      await loadHackathons()
    } catch (deleteError) {
      console.error(
        'Delete hackathon error:',
        deleteError,
      )

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete hackathon.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-3">
              <Trophy className="h-7 w-7 text-indigo-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Hackathons
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Create hackathon announcements for students.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add Hackathon
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            Loading hackathons...
          </div>
        ) : hackathons.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-slate-600" />

            <h2 className="mt-4 text-lg font-semibold">
              No hackathons yet
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Create your first hackathon.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {hackathons.map(
              (hackathon) => (
                <article
                  key={hackathon.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                >
                  {hackathon.banner_url ? (
                    <img
                      src={
                        hackathon.banner_url
                      }
                      alt={
                        hackathon.title
                      }
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-indigo-600/10">
                      <Trophy className="h-14 w-14 text-indigo-400/60" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold">
                        {hackathon.title}
                      </h2>

                      <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
                        {hackathon.status}
                      </span>
                    </div>

                    {hackathon.organizer && (
                      <p className="mt-2 text-sm text-slate-400">
                        Organizer:{' '}
                        {
                          hackathon.organizer
                        }
                      </p>
                    )}

                    {hackathon.description && (
                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {
                          hackathon.description
                        }
                      </p>
                    )}

                    <div className="mt-5 space-y-2 border-t border-slate-800 pt-4 text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-indigo-400" />
                        Event:{' '}
                        {formatDate(
                          hackathon.event_date,
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-400" />
                        Registration:{' '}
                        {formatDate(
                          hackathon.registration_deadline,
                        )}
                      </div>

                      {hackathon.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-400" />
                          {
                            hackathon.location
                          }
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            hackathon,
                          )
                        }
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>

                      {hackathon.status !==
                        'published' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void changeStatus(
                              hackathon.id,
                              'published',
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {saving
                            ? 'Publishing...'
                            : 'Publish'}
                        </button>
                      )}

                      {hackathon.status ===
                        'published' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void changeStatus(
                              hackathon.id,
                              'archived',
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </button>
                      )}

                      {hackathon.event_url && (
                        <a
                          href={
                            hackathon.event_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </a>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void deleteHackathon(
                            hackathon.id,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId
                    ? 'Edit Hackathon'
                    : 'Create Hackathon'}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Students will see published hackathons.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void saveHackathon(
                  event,
                  false,
                )
              }
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Hackathon Title *
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    updateField(
                      'title',
                      event.target.value,
                    )
                  }
                  placeholder="Smart India Hackathon 2026"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    updateField(
                      'description',
                      event.target.value,
                    )
                  }
                  rows={5}
                  placeholder="Explain the hackathon, themes, eligibility, prizes..."
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Organizer
                  </label>

                  <input
                    value={
                      form.organizer
                    }
                    onChange={(event) =>
                      updateField(
                        'organizer',
                        event.target.value,
                      )
                    }
                    placeholder="Company / Organization"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Mode
                  </label>

                  <select
                    value={form.mode}
                    onChange={(event) =>
                      updateField(
                        'mode',
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option>
                      Online
                    </option>
                    <option>
                      Offline
                    </option>
                    <option>
                      Hybrid
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Event Date
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      form.event_date
                    }
                    onChange={(event) =>
                      updateField(
                        'event_date',
                        event.target.value,
                      )
                    }
                    placeholder="DD-MM-YYYY"
                    maxLength={10}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Example: 25-10-2026
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Registration Deadline
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      form.registration_deadline
                    }
                    onChange={(event) =>
                      updateField(
                        'registration_deadline',
                        event.target.value,
                      )
                    }
                    placeholder="DD-MM-YYYY"
                    maxLength={10}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Example: 20-10-2026
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Location
                </label>

                <input
                  value={
                    form.location
                  }
                  onChange={(event) =>
                    updateField(
                      'location',
                      event.target.value,
                    )
                  }
                  placeholder="Bengaluru / Online / College Campus"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Registration URL
                  </label>

                  <input
                    type="url"
                    value={
                      form.registration_url
                    }
                    onChange={(event) =>
                      updateField(
                        'registration_url',
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Event / Details URL
                  </label>

                  <input
                    type="url"
                    value={
                      form.event_url
                    }
                    onChange={(event) =>
                      updateField(
                        'event_url',
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Hackathon Banner Image
                </label>

                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-5">
                  {imagePreview ? (
                    <div className="relative overflow-hidden rounded-xl">
                      <img
                        src={
                          imagePreview
                        }
                        alt="Hackathon preview"
                        className="max-h-72 w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImage(
                            null,
                          )
                          setImagePreview(
                            null,
                          )
                          updateField(
                            'banner_url',
                            '',
                          )
                        }}
                        className="absolute right-3 top-3 rounded-lg bg-black/70 p-2 text-white hover:bg-black"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ImagePlus className="h-12 w-12 text-slate-600" />

                      <p className="mt-3 text-sm font-medium text-slate-300">
                        Upload a banner image
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        PNG, JPG, JPEG or WEBP • Maximum 5 MB
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold hover:bg-indigo-500">
                      <Upload className="h-4 w-4" />
                      Choose Image

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={
                          handleImageSelect
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />

                  {saving
                    ? 'Saving...'
                    : 'Save Draft'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void saveHackathon(
                      null,
                      true,
                    )
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving
                    ? 'Publishing...'
                    : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}