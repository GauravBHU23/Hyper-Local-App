"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, FileBadge, Loader2, Shield, Users, Wrench } from "lucide-react";
import toast from "react-hot-toast";

import { Navbar } from "@/components/layout/Navbar";
import { adminApi, bookingsApi, getApiErrorMessage, supportApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { AdminOverview, AuditLog, Booking, BookingStatus, MediaAsset, Review, ServiceProvider, SupportTicket, User } from "@/types";

async function safeAdminQuery<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return fallback;
    }
    throw err;
  }
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { user, token, hasHydrated } = useAuthStore();
  const isBootstrappingSession = hasHydrated && !!token && !user;

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () =>
      safeAdminQuery(
        () => adminApi.getOverview().then((res) => res.data as AdminOverview),
        {
          total_users: 0,
          total_providers: 0,
          total_bookings: 0,
          pending_bookings: 0,
          completed_bookings: 0,
          flagged_reviews: 0,
          pending_kyc_assets: 0,
        }
      ),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => safeAdminQuery(() => bookingsApi.getAll().then((res) => res.data as Booking[]), []),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => safeAdminQuery(() => adminApi.getUsers().then((res) => res.data as User[]), []),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const providersQuery = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () =>
      safeAdminQuery(() => adminApi.getProviders().then((res) => res.data as ServiceProvider[]), []),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () =>
      safeAdminQuery(
        () => adminApi.getReviews({ flagged_only: true }).then((res) => res.data as Review[]),
        []
      ),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const mediaAssetsQuery = useQuery({
    queryKey: ["admin-media-assets"],
    queryFn: () =>
      safeAdminQuery(
        () =>
          adminApi
            .getMediaAssets({ asset_type: "kyc_document", verified: false })
            .then((res) => res.data as MediaAsset[]),
        []
      ),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const supportTicketsQuery = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: () =>
      safeAdminQuery(
        () => supportApi.getAllAdmin().then((res) => res.data as SupportTicket[]),
        []
      ),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });
  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () =>
      safeAdminQuery(
        () => adminApi.getAuditLogs({ limit: 10 }).then((res) => res.data as AuditLog[]),
        []
      ),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_admin,
    retry: false,
  });

  const bookingMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      bookingsApi.updateAdmin(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Booking updated");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Could not update booking")),
  });
  const providerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      toast.success("Provider updated");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Could not update provider")),
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, is_flagged }: { id: string; is_flagged: boolean }) => adminApi.updateReview(id, { is_flagged }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Review moderation updated");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Could not update review")),
  });
  const mediaMutation = useMutation({
    mutationFn: ({ id, is_verified }: { id: string; is_verified: boolean }) =>
      adminApi.updateMediaAsset(id, { is_verified }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-assets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(variables.is_verified ? "KYC approved" : "KYC reset");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Could not update KYC asset")),
  });
  const supportMutation = useMutation({
    mutationFn: ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) =>
      supportApi.updateAdmin(id, { status, admin_notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Support ticket updated");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Could not update support ticket")),
  });

  const loading =
    overviewQuery.isLoading ||
    bookingsQuery.isLoading ||
    usersQuery.isLoading ||
    providersQuery.isLoading ||
    reviewsQuery.isLoading ||
    mediaAssetsQuery.isLoading ||
    supportTicketsQuery.isLoading ||
    auditLogsQuery.isLoading;

  if (!hasHydrated || isBootstrappingSession) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="card py-12 text-center text-slate-500">
            Admin access required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Operations control center</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <StatCard title="Users" value={overviewQuery.data?.total_users || 0} icon={<Users size={16} />} />
              <StatCard title="Providers" value={overviewQuery.data?.total_providers || 0} icon={<Wrench size={16} />} />
              <StatCard title="Bookings" value={overviewQuery.data?.total_bookings || 0} icon={<Shield size={16} />} />
              <StatCard title="Pending" value={overviewQuery.data?.pending_bookings || 0} />
              <StatCard title="Completed" value={overviewQuery.data?.completed_bookings || 0} />
              <StatCard title="Flagged Reviews" value={overviewQuery.data?.flagged_reviews || 0} icon={<AlertTriangle size={16} />} />
              <StatCard title="Pending KYC" value={overviewQuery.data?.pending_kyc_assets || 0} icon={<FileBadge size={16} />} />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Recent bookings</h2>
                  <span className="text-sm text-slate-500">{bookingsQuery.data?.length || 0} total</span>
                </div>
                <div className="space-y-3">
                  {bookingsQuery.data?.slice(0, 8).map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">
                            {booking.user?.name || "Customer"} to {booking.provider?.business_name || "Provider"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{booking.problem_description}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatDate(booking.created_at || "")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={cn("badge text-xs", booking.status ? statusBadge(booking.status) : "bg-slate-100 text-slate-600")}>
                            {booking.status.replace("_", " ")}
                          </span>
                          {booking.status === "pending" ? (
                            <button
                              onClick={() => bookingMutation.mutate({ id: booking.id, status: "confirmed" })}
                              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Force Confirm
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="card">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Provider moderation</h2>
                  <div className="space-y-3">
                    {providersQuery.data?.slice(0, 5).map((provider) => (
                      <div key={provider.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{provider.business_name}</p>
                            <p className="text-xs text-slate-500">
                              {provider.city} · {provider.is_verified ? "Verified" : "Unverified"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                providerMutation.mutate({
                                  id: provider.id,
                                  data: { is_verified: !provider.is_verified },
                                })
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {provider.is_verified ? "Remove verify" : "Verify"}
                            </button>
                            <button
                              onClick={() =>
                                providerMutation.mutate({
                                  id: provider.id,
                                  data: { is_currently_available: !provider.is_currently_available },
                                })
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {provider.is_currently_available ? "Set busy" : "Set available"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Latest users</h2>
                  <div className="space-y-3">
                    {usersQuery.data?.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.email}</p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {item.is_admin ? "Admin" : item.is_provider ? "Provider" : "Customer"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Flagged reviews</h2>
                  {reviewsQuery.data?.length ? (
                    <div className="space-y-3">
                      {reviewsQuery.data.slice(0, 5).map((review) => (
                        <div key={review.id} className="rounded-2xl bg-red-50 px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{review.user?.name || "User"}</p>
                          <p className="mt-1 text-sm text-slate-600">{review.comment || "No comment"}</p>
                          <button
                            onClick={() => reviewMutation.mutate({ id: review.id, is_flagged: false })}
                            className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Unflag review
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No flagged reviews right now.</p>
                  )}
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Support tickets</h2>
                    <span className="text-sm text-slate-500">{supportTicketsQuery.data?.length || 0} total</span>
                  </div>
                  {supportTicketsQuery.data?.length ? (
                    <div className="space-y-3">
                      {supportTicketsQuery.data.slice(0, 5).map((ticket) => (
                        <div key={ticket.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{ticket.title}</p>
                              <p className="mt-1 text-sm text-slate-600">{ticket.message}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {ticket.user?.name || "User"} · {ticket.provider?.business_name || "Provider"}
                              </p>
                            </div>
                            <span className="badge bg-slate-200 text-slate-700 text-xs">
                              {ticket.status.replace("_", " ")}
                            </span>
                          </div>
                          {ticket.admin_notes ? (
                            <p className="mt-2 text-xs text-slate-500">Admin note: {ticket.admin_notes}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => supportMutation.mutate({ id: ticket.id, status: "in_progress" })}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Mark in progress
                            </button>
                            <button
                              onClick={() => supportMutation.mutate({ id: ticket.id, status: "resolved", admin_notes: "Issue reviewed and resolved by admin." })}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => supportMutation.mutate({ id: ticket.id, status: "closed", admin_notes: "Ticket closed by admin." })}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No active support tickets right now.</p>
                  )}
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Recent audit logs</h2>
                    <span className="text-sm text-slate-500">{auditLogsQuery.data?.length || 0} shown</span>
                  </div>
                  {auditLogsQuery.data?.length ? (
                    <div className="space-y-3">
                      {auditLogsQuery.data.map((log) => (
                        <div key={log.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{log.action.replaceAll("_", " ")}</p>
                              <p className="text-xs text-slate-500">
                                {log.entity_type} {log.entity_id ? `· ${log.entity_id}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {log.user?.email || "system"} · {formatDate(log.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No audit log entries yet.</p>
                  )}
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Pending KYC approvals</h2>
                    <span className="text-sm text-slate-500">{mediaAssetsQuery.data?.length || 0} pending</span>
                  </div>
                  {mediaAssetsQuery.data?.length ? (
                    <div className="space-y-3">
                      {mediaAssetsQuery.data.slice(0, 5).map((asset) => (
                        <div key={asset.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">
                                {asset.provider?.business_name || asset.user?.name || "Provider document"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {asset.user?.email || "Unknown email"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">{formatDate(asset.created_at)}</p>
                            </div>
                            <a
                              href={asset.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              View file
                            </a>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => mediaMutation.mutate({ id: asset.id, is_verified: true })}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Approve KYC
                            </button>
                            <button
                              onClick={() => mediaMutation.mutate({ id: asset.id, is_verified: false })}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Keep pending
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No pending KYC documents right now.</p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon?: ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-3xl font-bold text-slate-900">
        {value}
        {title === "Pending KYC" && value > 0 ? <BadgeCheck size={18} className="text-orange-500" /> : null}
      </p>
    </div>
  );
}

function statusBadge(status: BookingStatus) {
  const map: Record<BookingStatus, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-sky-100 text-sky-700",
    in_progress: "bg-violet-100 text-violet-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status];
}
