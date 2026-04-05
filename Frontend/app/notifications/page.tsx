"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { notificationsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { NotificationItem } from "@/types";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getMy().then((res) => res.data as NotificationItem[]),
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">Notifications</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Your updates</h1>
          </div>
          <button onClick={() => markAllMutation.mutate()} className="btn-secondary text-sm">
            Mark all read
          </button>
        </div>

        {notificationsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        ) : notificationsQuery.data?.length ? (
          <div className="space-y-3">
            {notificationsQuery.data.map((item) => (
              <div key={item.id} className={`card ${item.is_read ? "" : "border-orange-200 bg-orange-50/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDate(item.created_at)}</p>
                  </div>
                  {!item.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(item.id)}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                {item.action_url ? (
                  <a href={item.action_url} className="mt-3 inline-block text-sm font-medium text-orange-600 hover:text-orange-700">
                    Open related page
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center text-slate-500">
            <Bell className="mx-auto mb-3 text-slate-300" size={32} />
            No notifications yet.
          </div>
        )}
      </main>
    </div>
  );
}
