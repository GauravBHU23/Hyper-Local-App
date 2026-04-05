"use client";
import { useState } from "react";
import { X, Calendar, MapPin, Loader2, CheckCircle } from "lucide-react";
import { bookingsApi } from "@/lib/api";
import type { ServiceProvider } from "@/types";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  provider: ServiceProvider;
  onClose: () => void;
  onSuccess?: () => void;
  aiSuggested?: boolean;
  prefillProblem?: string;
}

export function BookingModal({ provider, onClose, onSuccess, aiSuggested, prefillProblem }: Props) {
  const [problem, setProblem] = useState(prefillProblem || "");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!problem.trim()) {
      toast.error("Problem description is required");
      return;
    }
    setLoading(true);
    try {
      await bookingsApi.create({
        provider_id: provider.id,
        problem_description: problem,
        service_address: address,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        ai_suggested: aiSuggested || false,
      });
      setDone(true);
      toast.success("Booking confirmed! 🎉");
      setTimeout(() => { onSuccess?.(); onClose(); }, 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Book Service</h3>
            <p className="text-sm text-slate-500">{provider.business_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle size={48} className="text-green-500" />
            <p className="font-semibold text-slate-800">Booking Confirmed!</p>
            <p className="text-sm text-slate-500">Provider will contact you soon</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Provider summary */}
            <div className="bg-orange-50 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm">
                🔧
              </div>
              <div>
                <p className="font-medium text-sm text-slate-800">{provider.business_name}</p>
                {provider.base_price && (
                  <p className="text-xs text-orange-600 font-semibold">
                    Est. {formatCurrency(provider.base_price)} {provider.price_unit}
                  </p>
                )}
              </div>
            </div>

            {/* Problem */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Problem describe karo *
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. AC cooling nahi kar raha, gas refill chahiye..."
                className="input resize-none h-24 text-sm"
                maxLength={500}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <MapPin size={13} className="inline mr-1" />
                Service Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ghar ka address daalo..."
                className="input text-sm"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Calendar size={13} className="inline mr-1" />
                Preferred Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="input text-sm"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !problem.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2"
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