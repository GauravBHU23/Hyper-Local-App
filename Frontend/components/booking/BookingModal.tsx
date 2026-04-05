"use client";

import { useState } from "react";
import { Calendar, CheckCircle, Loader2, MapPin, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { bookingsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { ServiceProvider } from "@/types";

interface Props {
  provider: ServiceProvider;
  onClose: () => void;
  onSuccess?: () => void;
  aiSuggested?: boolean;
  prefillProblem?: string;
}

const QUICK_SLOTS = [
  { label: "In 1 hour", getValue: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "This evening", getValue: () => {
      const next = new Date();
      next.setHours(18, 0, 0, 0);
      if (next.getTime() <= Date.now()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    } },
  { label: "Tomorrow morning", getValue: () => {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(10, 0, 0, 0);
      return next;
    } },
];

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function BookingModal({
  provider,
  onClose,
  onSuccess,
  aiSuggested,
  prefillProblem,
}: Props) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [problem, setProblem] = useState(prefillProblem || "");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!hasHydrated) {
      toast.error("Please wait a moment and try again.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please login first to create a booking.");
      onClose();
      router.push("/login");
      return;
    }

    const trimmedProblem = problem.trim();
    const trimmedAddress = address.trim();

    if (!trimmedProblem) {
      toast.error("Problem description is required");
      return;
    }

    if (trimmedProblem.length < 8) {
      toast.error("Please add a little more detail about the issue");
      return;
    }

    if (!trimmedAddress) {
      toast.error("Service address is required");
      return;
    }

    setLoading(true);

    try {
      await bookingsApi.create({
        provider_id: provider.id,
        problem_description: trimmedProblem,
        service_address: trimmedAddress,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        ai_suggested: aiSuggested || false,
      });
      setDone(true);
      toast.success("Booking confirmed!");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-4 pt-5">
          <div>
            <h3 className="font-bold text-slate-900">Book Service</h3>
            <p className="text-sm text-slate-500">{provider.business_name}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <CheckCircle size={48} className="text-green-500" />
            <p className="font-semibold text-slate-800">Booking Confirmed!</p>
            <p className="text-sm text-slate-500">Provider will contact you soon</p>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                <Wrench size={18} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{provider.business_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {provider.base_price ? (
                    <p className="font-semibold text-orange-600">
                      Est. {formatCurrency(provider.base_price)} {provider.price_unit}
                    </p>
                  ) : (
                    <p className="font-medium text-slate-500">Final price after inspection</p>
                  )}
                  {provider.is_verified && (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                      Verified provider
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Describe the problem *
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. The AC is not cooling, gas refill needed..."
                className="input h-24 resize-none text-sm"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-slate-400">{problem.trim().length}/500</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                <MapPin size={13} className="mr-1 inline" />
                Service Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter the service address..."
                className="input text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                <Calendar size={13} className="mr-1 inline" />
                Preferred Time (Optional)
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {QUICK_SLOTS.map((slot) => (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => setScheduledAt(toLocalInputValue(slot.getValue()))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-300 hover:text-orange-600"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="input text-sm"
                min={toLocalInputValue(new Date())}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !problem.trim()}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
