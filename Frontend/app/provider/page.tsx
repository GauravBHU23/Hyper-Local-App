"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, IndianRupee, Loader2, MapPin, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Navbar } from "@/components/layout/Navbar";
import { bookingsApi, getApiErrorMessage } from "@/lib/api";
import { cn, formatCurrency, formatDate, getMapsDirectionsLink, getStatusColor } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { Booking, BookingStatus, ProviderEarningsStats } from "@/types";

const STATUS_OPTIONS: BookingStatus[] = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

export default function ProviderDashboardPage() {
  const queryClient = useQueryClient();
  const { user, token, hasHydrated } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [otpDrafts, setOtpDrafts] = useState<Record<string, string>>({});
  const isBootstrappingSession = hasHydrated && !!token && !user;

  const bookingsQuery = useQuery({
    queryKey: ["provider-bookings", statusFilter],
    queryFn: () =>
      bookingsApi
        .getProviderMy(statusFilter === "all" ? undefined : { status: statusFilter })
        .then((res) => res.data as Booking[]),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_provider,
    retry: false,
  });
  const earningsQuery = useQuery({
    queryKey: ["provider-stats"],
    queryFn: () => bookingsApi.getProviderStats().then((res) => res.data as ProviderEarningsStats),
    enabled: hasHydrated && !isBootstrappingSession && !!user?.is_provider,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      bookingsApi.updateProvider(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
      toast.success("Booking updated");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not update booking"));
    },
  });
  const completeMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) =>
      bookingsApi.completeProvider(id, otp),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
      setOtpDrafts((prev) => ({ ...prev, [variables.id]: "" }));
      toast.success("Booking marked completed");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not complete booking"));
    },
  });

  const stats = useMemo(() => {
    const bookings = bookingsQuery.data || [];
    return {
      total: bookings.length,
      pending: bookings.filter((booking) => booking.status === "pending").length,
      active: bookings.filter((booking) => ["confirmed", "in_progress"].includes(booking.status)).length,
      completed: bookings.filter((booking) => booking.status === "completed").length,
    };
  }, [bookingsQuery.data]);

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

  if (!user?.is_provider) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-20">
          <div className="card py-12 text-center text-slate-500">
            Provider access required. Create a provider profile first.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">
              Provider Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {user?.name ? `${user.name.split(" ")[0]}'s jobs` : "Manage your bookings"}
            </h1>
          </div>
          <a href="/profile" className="btn-secondary text-sm">
            Manage provider profile
          </a>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
          <div className="card">
            <p className="text-sm text-slate-500">Total jobs</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-sky-600">{stats.active}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.completed}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Revenue</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(earningsQuery.data?.total_revenue || 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Avg ticket</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(earningsQuery.data?.average_ticket_size || 0)}
            </p>
          </div>
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium",
              statusFilter === "all" ? "bg-orange-500 text-white" : "bg-white text-slate-600 border border-slate-200"
            )}
          >
            All
          </button>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium capitalize",
                statusFilter === status ? "bg-orange-500 text-white" : "bg-white text-slate-600 border border-slate-200"
              )}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </section>

        {bookingsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        ) : bookingsQuery.isError ? (
          <div className="card py-12 text-center text-slate-500">
            Dashboard data will appear after you create a provider profile.
          </div>
        ) : bookingsQuery.data?.length ? (
          <div className="space-y-4">
            {bookingsQuery.data.map((booking) => {
              const nextActions: BookingStatus[] =
                booking.status === "pending"
                  ? ["confirmed", "cancelled"]
                  : booking.status === "confirmed"
                    ? ["in_progress", "cancelled"]
                    : [];

              return (
                <div key={booking.id} className="card">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {booking.user?.name || "Customer"}
                        </h2>
                        <span className={cn("badge text-xs", getStatusColor(booking.status))}>
                          {booking.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{booking.problem_description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        {booking.service_address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {booking.service_address}
                          </span>
                        ) : null}
                        {booking.service_address || (booking.service_latitude && booking.service_longitude) ? (
                          <a
                            href={getMapsDirectionsLink({
                              address: booking.service_address,
                              latitude: booking.service_latitude,
                              longitude: booking.service_longitude,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-orange-600"
                          >
                            <MapPin size={12} />
                            Open in Maps
                          </a>
                        ) : null}
                        {booking.scheduled_at ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={12} />
                            {formatDate(booking.scheduled_at)}
                          </span>
                        ) : null}
                        {booking.final_cost || booking.estimated_cost ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-orange-600">
                            <IndianRupee size={12} />
                            {formatCurrency(booking.final_cost || booking.estimated_cost || 0)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {nextActions.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => updateMutation.mutate({ id: booking.id, status: nextStatus })}
                          disabled={updateMutation.isPending}
                          className={cn(
                            "rounded-xl px-3 py-2 text-sm font-medium",
                            nextStatus === "cancelled"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : "bg-orange-500 text-white"
                          )}
                        >
                          {nextStatus === "confirmed"
                            ? "Accept"
                            : nextStatus === "in_progress"
                              ? "Start Job"
                              : "Cancel"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {booking.status === "in_progress" ? (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">
                            Customer service OTP required
                          </p>
                          <p className="mt-1 text-xs text-emerald-700">
                            After finishing the job, collect the 6-digit OTP from the customer and verify it here.
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter OTP"
                            value={otpDrafts[booking.id] || ""}
                            onChange={(e) =>
                              setOtpDrafts((prev) => ({
                                ...prev,
                                [booking.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                              }))
                            }
                            className="input w-full sm:w-40"
                          />
                          <button
                            onClick={() => {
                              const otp = otpDrafts[booking.id] || "";
                              if (otp.length < 4) {
                                toast.error("Please enter the customer OTP");
                                return;
                              }
                              completeMutation.mutate({ id: booking.id, otp });
                            }}
                            disabled={completeMutation.isPending}
                            className="btn-primary text-sm"
                          >
                            Verify & complete
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card py-12 text-center text-slate-500">
            No jobs yet. Customer bookings will appear here.
          </div>
        )}
      </main>
    </div>
  );
}
