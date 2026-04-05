"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Loader2, X, CheckCircle } from "lucide-react";
import { bookingsApi } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import type { Booking, BookingStatus } from "@/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDate, getStatusColor, cn } from "@/lib/utils";
import toast from "react-hot-toast";

const STATUS_TABS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "in_progress" },
  { label: "Done", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<BookingStatus | "all">("all");
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", activeTab],
    queryFn: () =>
      bookingsApi
        .getMy(activeTab !== "all" ? { status: activeTab } : undefined)
        .then((r) => r.data as Booking[]),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
    },
    onError: () => toast.error("Cancel nahi ho payi"),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Bookings</h1>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
                activeTab === tab.value
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-slate-200 text-slate-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : bookings?.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>Koi booking nahi hai</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings?.map((booking) => (
              <div key={booking.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {booking.provider && (
                      <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
                        {CATEGORY_ICONS[booking.provider.category]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-slate-900">
                        {booking.provider?.business_name || "Service Provider"}
                      </p>
                      {booking.provider && (
                        <p className="text-xs text-slate-500">
                          {CATEGORY_LABELS[booking.provider.category]}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn("badge text-xs shrink-0", getStatusColor(booking.status))}>
                    {booking.status.replace("_", " ")}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                  {booking.problem_description}
                </p>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {booking.scheduled_at && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {formatDate(booking.scheduled_at)}
                    </span>
                  )}
                  {booking.service_address && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={11} />
                      {booking.service_address}
                    </span>
                  )}
                  {(booking.estimated_cost || booking.final_cost) && (
                    <span className="text-xs font-semibold text-orange-600">
                      {formatCurrency(booking.final_cost || booking.estimated_cost!)}
                    </span>
                  )}
                </div>

                {booking.ai_suggested && (
                  <div className="mt-2">
                    <span className="badge bg-purple-50 text-purple-700 text-xs">✨ AI Suggested</span>
                  </div>
                )}

                {booking.status === "pending" && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => cancelMutation.mutate(booking.id)}
                      disabled={cancelMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      <X size={13} />
                      Cancel Booking
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}