"use client";

import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Loader2 } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { supportApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SupportTicket } from "@/types";

export default function SupportPage() {
  const ticketsQuery = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => supportApi.getMy().then((res) => res.data as SupportTicket[]),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">Support</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Help requests and disputes</h1>
          <p className="mt-2 text-sm text-slate-500">
            All issues raised from the booking page will be tracked here.
          </p>
        </div>

        {ticketsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : ticketsQuery.data?.length ? (
          <div className="space-y-4">
            {ticketsQuery.data.map((ticket) => (
              <div key={ticket.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <LifeBuoy size={16} className="text-orange-500" />
                      <h2 className="text-lg font-semibold text-slate-900">{ticket.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{ticket.message}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      Raised on {formatDate(ticket.created_at)}
                    </p>
                    {ticket.booking?.problem_description ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Booking: {ticket.booking.problem_description}
                      </p>
                    ) : null}
                  </div>
                  <span className="badge bg-slate-100 text-slate-700 text-xs">
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
                {ticket.admin_notes ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Admin note
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{ticket.admin_notes}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center text-slate-500">
            No support requests yet. You can raise an issue from the booking screen.
          </div>
        )}
      </main>
    </div>
  );
}
