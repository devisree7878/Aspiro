import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  Building2,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Loader2,
  Trophy,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type Notification = {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

type NotificationRecipientRow = {
  read_at: string | null;
  notifications:
    | Notification
    | Notification[]
    | null;
};

type NotificationSection =
  | "hackathons"
  | "companies"
  | "courses";

const sectionConfig: Record<
  NotificationSection,
  {
    label: string;
    icon: typeof Trophy;
    description: string;
  }
> = {
  hackathons: {
    label: "Hackathons",
    icon: Trophy,
    description:
      "Hackathon announcements and updates",
  },

  companies: {
    label: "Companies",
    icon: Building2,
    description:
      "Company opportunities and updates",
  },

  courses: {
    label: "Courses",
    icon: BookOpen,
    description:
      "Course announcements and updates",
  },
};

function getSection(
  notification: Notification
): NotificationSection | null {
  const url = (
    notification.action_url || ""
  ).toLowerCase();

  const title =
    notification.title.toLowerCase();

  const message =
    notification.message.toLowerCase();

  if (
    url.includes("/hackathon") ||
    title.includes("hackathon") ||
    message.includes("hackathon")
  ) {
    return "hackathons";
  }

  if (
    url.includes("/company") ||
    url.includes("/job") ||
    title.includes("company") ||
    message.includes("company") ||
    title.includes("internship") ||
    message.includes("internship") ||
    title.includes("job opportunity") ||
    message.includes("job opportunity") ||
    title.includes("matched") ||
    message.includes("matched")
  ) {
    return "companies";
  }

  if (
    url.includes("/course") ||
    title.includes("course") ||
    message.includes("course")
  ) {
    return "courses";
  }

  return null;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const diff =
    now.getTime() - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "Just now";
  }

  if (diff < hour) {
    const minutes = Math.floor(
      diff / minute
    );

    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours = Math.floor(
      diff / hour
    );

    return `${hours}h ago`;
  }

  if (diff < 7 * day) {
    const days = Math.floor(
      diff / day
    );

    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function priorityClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "high":
      return "bg-red-500/10 text-red-400 border-red-500/20";

    case "medium":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";

    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

export default function Notifications() {
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [activeSection, setActiveSection] =
    useState<NotificationSection>(
      "companies"
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadNotifications =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: {
            user,
          },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        /*
         * IMPORTANT:
         *
         * We now read notification_recipients
         * instead of reading every notification.
         *
         * This ensures a student only receives
         * notifications targeted to that student.
         */
        const {
          data,
          error: queryError,
        } = await supabase
          .from(
            "notification_recipients"
          )
          .select(`
            read_at,
            notifications (
              id,
              title,
              message,
              category,
              priority,
              action_url,
              created_at
            )
          `)
          .eq("user_id", user.id);

        if (queryError) {
          throw queryError;
        }

        const rows =
          (data || []) as NotificationRecipientRow[];

        const mapped: Notification[] =
          rows
            .map((row) => {
              const notification =
                Array.isArray(
                  row.notifications
                )
                  ? row.notifications[0]
                  : row.notifications;

              if (!notification) {
                return null;
              }

              return {
                ...notification,
                read_at: row.read_at,
              };
            })
            .filter(
              (
                item
              ): item is Notification =>
                Boolean(item)
            );

        mapped.sort(
          (a, b) =>
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
        );

        setNotifications(mapped);
      } catch (err: unknown) {
        console.error(
          "Failed to load notifications:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load notifications."
        );

        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /*
   * Listen for a notification recipient
   * being created for the logged-in student.
   *
   * This is better than listening to every
   * notification created by the admin.
   */
  useEffect(() => {
    let channel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    async function subscribe() {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      channel = supabase
        .channel(
          `student-notifications-${user.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notification_recipients",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            /*
             * Reload the targeted notification
             * after the recipient row appears.
             */
            loadNotifications();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notification_recipients",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(
          channel
        );
      }
    };
  }, [loadNotifications]);

  /*
   * Mark one notification as read.
   */
  const markAsRead = async (
    notificationId: string
  ) => {
    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const now =
        new Date().toISOString();

      const { error } =
        await supabase
          .from("notification_recipients")
          .update({
            read_at: now,
          })
          .eq(
            "notification_id",
            notificationId
          )
          .eq(
            "user_id",
            user.id
          );

      if (error) {
        console.error(
          "Failed to mark notification as read:",
          error
        );

        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id ===
              notificationId
                ? {
                    ...notification,
                    read_at: now,
                  }
                : notification
          )
      );
    } catch (err) {
      console.error(
        "Mark notification read error:",
        err
      );
    }
  };

  const openNotification = async (
    notification: Notification
  ) => {
    await markAsRead(
      notification.id
    );

    if (!notification.action_url) {
      return;
    }

    window.location.href =
      notification.action_url;
  };

  const grouped = useMemo(() => {
    const result: Record<
      NotificationSection,
      Notification[]
    > = {
      hackathons: [],
      companies: [],
      courses: [],
    };

    for (const notification of notifications) {
      const section =
        getSection(notification);

      if (section) {
        result[section].push(
          notification
        );
      }
    }

    return result;
  }, [notifications]);

  const activeNotifications =
    grouped[activeSection];

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read_at
    ).length;

  const companyUnreadCount =
    grouped.companies.filter(
      (notification) =>
        !notification.read_at
    ).length;

  const ActiveIcon =
    sectionConfig[
      activeSection
    ].icon;

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10">
              <Bell className="h-5 w-5 text-indigo-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Notifications
                </h1>

                {unreadCount > 0 && (
                  <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-slate-400">
                Stay updated with hackathons,
                companies and courses.
              </p>
            </div>

          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {(
            Object.keys(
              sectionConfig
            ) as NotificationSection[]
          ).map((section) => {
            const config =
              sectionConfig[section];

            const Icon = config.icon;

            const active =
              activeSection === section;

            const count =
              grouped[section].length;

            const unread =
              grouped[section].filter(
                (notification) =>
                  !notification.read_at
              ).length;

            return (
              <button
                key={section}
                type="button"
                onClick={() =>
                  setActiveSection(
                    section
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >

                <div className="flex items-center justify-between">

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      active
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-2">

                    {count > 0 && (
                      <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-400">
                        {count}
                      </span>
                    )}

                    {unread > 0 && (
                      <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white">
                        {unread} new
                      </span>
                    )}

                  </div>

                </div>

                <h2 className="mt-4 font-semibold text-white">
                  {config.label}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {config.description}
                </p>

              </button>
            );
          })}

        </div>

        {/* Current section */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">

          <div className="border-b border-slate-800 px-5 py-4">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
                <ActiveIcon className="h-4 w-4 text-indigo-400" />
              </div>

              <div>
                <div className="flex items-center gap-2">

                  <h2 className="font-semibold text-white">
                    {
                      sectionConfig[
                        activeSection
                      ].label
                    }
                  </h2>

                  {activeSection ===
                    "companies" &&
                    companyUnreadCount >
                      0 && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {companyUnreadCount} new
                      </span>
                    )}

                </div>

                <p className="text-xs text-slate-500">
                  {
                    sectionConfig[
                      activeSection
                    ].description
                  }
                </p>
              </div>

            </div>

          </div>

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[240px] items-center justify-center">

              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications...
              </div>

            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-6">

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">

                <p className="font-medium text-red-400">
                  Unable to load notifications
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={
                    loadNotifications
                  }
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Try again
                </button>

              </div>

            </div>
          )}

          {/* Empty */}
          {!loading &&
            !error &&
            activeNotifications.length ===
              0 && (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
                  <ActiveIcon className="h-6 w-6 text-slate-500" />
                </div>

                <h3 className="mt-4 font-semibold text-white">
                  No{" "}
                  {sectionConfig[
                    activeSection
                  ].label.toLowerCase()}{" "}
                  notifications
                </h3>

                <p className="mt-2 max-w-md text-sm text-slate-500">
                  New{" "}
                  {sectionConfig[
                    activeSection
                  ].label.toLowerCase()}{" "}
                  updates will appear here
                  when they are published.
                </p>

              </div>
            )}

          {/* Notifications */}
          {!loading &&
            !error &&
            activeNotifications.length >
              0 && (
              <div className="divide-y divide-slate-800">

                {activeNotifications.map(
                  (notification) => {
                    const clickable =
                      Boolean(
                        notification.action_url
                      );

                    const unread =
                      !notification.read_at;

                    return (
                      <div
                        key={
                          notification.id
                        }
                        className={`p-5 transition ${
                          clickable
                            ? "cursor-pointer hover:bg-slate-800/40"
                            : ""
                        } ${
                          unread
                            ? "bg-indigo-500/[0.04]"
                            : ""
                        }`}
                        onClick={() =>
                          openNotification(
                            notification
                          )}
                        role={
                          clickable
                            ? "button"
                            : undefined
                        }
                        tabIndex={
                          clickable
                            ? 0
                            : undefined
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            clickable &&
                            (event.key ===
                              "Enter" ||
                              event.key ===
                                " ")
                          ) {
                            event.preventDefault();

                            openNotification(
                              notification
                            );
                          }
                        }}
                      >

                        <div className="flex gap-4">

                          <div
                            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              unread
                                ? "bg-indigo-500/20"
                                : "bg-indigo-500/10"
                            }`}
                          >
                            <ActiveIcon className="h-5 w-5 text-indigo-400" />

                            {unread && (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-start justify-between gap-3">

                              <div>

                                <h3
                                  className={`font-semibold ${
                                    unread
                                      ? "text-white"
                                      : "text-slate-300"
                                  }`}
                                >
                                  {
                                    notification.title
                                  }
                                </h3>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">

                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5" />

                                    {formatDate(
                                      notification.created_at
                                    )}
                                  </span>

                                  {notification.priority && (
                                    <span
                                      className={`rounded-full border px-2 py-0.5 font-medium ${priorityClass(
                                        notification.priority
                                      )}`}
                                    >
                                      {
                                        notification.priority
                                      }
                                    </span>
                                  )}

                                  {unread && (
                                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-400">
                                      New
                                    </span>
                                  )}

                                </div>

                              </div>

                              {clickable && (
                                <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
                              )}

                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              {
                                notification.message
                              }
                            </p>

                            {clickable && (
                              <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400">

                                View{" "}
                                {
                                  sectionConfig[
                                    activeSection
                                  ].label
                                }

                                <ChevronRight className="h-4 w-4" />

                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

        </div>
      </div>
    </div>
  );
}