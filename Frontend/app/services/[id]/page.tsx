"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Star, MapPin, Clock, Phone, MessageSquare, BadgeCheck, Zap,
  ArrowLeft, Calendar, IndianRupee, Loader2
} from "lucide-react";
import { servicesApi, reviewsApi } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { BookingModal } from "@/components/booking/BookingModal";
import { StarRating } from "@/components/ui/StarRating";
import type { ServiceProvider, Review } from "@/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDistance, formatDate, getWhatsappLink, getRatingColor } from "@/lib/utils";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showBooking, setShowBooking] = useState(false);

  const { data: provider, isLoading } = useQuery({
    queryKey: ["provider", id],
    queryFn: () => servicesApi.getById(id).then((r) => r.data as ServiceProvider),
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => reviewsApi.getForProvider(id).then((r) => r.data as Review[]),
    enabled: !!provider,
  });

  const { data: stats } = useQuery({
    queryKey: ["review-stats", id],
    queryFn: () => reviewsApi.getStats(id).then((r) => r.data),
    enabled: !!provider,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      </div>
    );
  }

  if (!provider) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Provider Header */}
        <div className="card">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl shrink-0">
              {CATEGORY_ICONS[provider.category]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="font-bold text-xl text-slate-900 leading-tight">
                  {provider.business_name}
                </h1>
                {provider.is_verified && (
                  <BadgeCheck size={18} className="text-blue-500 mt-0.5 shrink-0" />
                )}
              </div>
              <span className="text-sm text-slate-500">{CATEGORY_LABELS[provider.category]}</span>

              {/* Status */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {provider.is_currently_available ? (
                  <span className="badge bg-green-50 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
                    Available Now
                  </span>
                ) : (
                  <span className="badge bg-red-50 text-red-600">Currently Busy</span>
                )}
                {provider.is_available_24x7 && (
                  <span className="badge bg-purple-50 text-purple-700">
                    <Zap size={10} />
                    24x7
                  </span>
                )}
              </div>
            </div>
          </div>

          {provider.description && (
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">{provider.description}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <div className={`text-xl font-bold ${getRatingColor(provider.rating)}`}>
              {provider.rating.toFixed(1)}
            </div>
            <div className="mt-1 flex justify-center">
              <StarRating value={Math.round(provider.rating)} size={12} readonly />
            </div>
            <p className="text-xs text-slate-400 mt-1">{provider.total_reviews} reviews</p>
          </div>
          <div className="card text-center">
            <div className="text-xl font-bold text-slate-800">{provider.response_time_minutes}m</div>
            <p className="text-xs text-slate-400">Response time</p>
          </div>
          <div className="card text-center">
            <div className="text-xl font-bold text-slate-800">{provider.total_bookings}</div>
            <p className="text-xs text-slate-400">Bookings done</p>
          </div>
        </div>

        {/* Pricing & Location */}
        <div className="card space-y-3">
          {provider.base_price && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <IndianRupee size={16} />
                <span className="text-sm font-medium">Starting Price</span>
              </div>
              <span className="font-semibold text-orange-600">
                {formatCurrency(provider.base_price)} {provider.price_unit}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2 text-slate-600">
            <MapPin size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm">{provider.address}</p>
              {provider.city && (
                <p className="text-xs text-slate-400">{provider.city}</p>
              )}
              {provider.distance_km !== undefined && (
                <p className="text-xs text-slate-400">{formatDistance(provider.distance_km)} away</p>
              )}
            </div>
          </div>
        </div>

        {stats?.total > 0 && (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Review summary</p>
                <p className="text-xs text-slate-500">
                  Average {stats.average?.toFixed?.(1) ?? stats.average} from {stats.total} verified reviews
                </p>
              </div>
              <div className="flex gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">5★ {stats.breakdown?.["5"] || 0}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">4★ {stats.breakdown?.["4"] || 0}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">3★ {stats.breakdown?.["3"] || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Contact Actions */}
        <div className="grid grid-cols-2 gap-3">
          {provider.phone && (
            <a href={`tel:${provider.phone}`} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              <Phone size={15} />
              Call Now
            </a>
          )}
          {provider.whatsapp && (
            <a
              href={getWhatsappLink(provider.whatsapp, `Hi, I need ${CATEGORY_LABELS[provider.category]} service`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <MessageSquare size={15} />
              WhatsApp
            </a>
          )}
        </div>

        {/* Book CTA */}
        <button
          onClick={() => setShowBooking(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={!provider.is_currently_available}
        >
          <Calendar size={16} />
          {provider.is_currently_available ? "Book Now" : "Currently Unavailable"}
        </button>

        {/* Reviews */}
        {reviews && reviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-900">Customer Reviews</h2>
            {reviews.map((review) => (
              <div key={review.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
                        {review.user?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <span className="font-medium text-sm">{review.user?.name || "User"}</span>
                      {review.is_verified_purchase && (
                        <span className="badge bg-green-50 text-green-700 text-[10px]">✓ Verified</span>
                      )}
                    </div>
                  </div>
                  <StarRating value={review.rating} size={13} readonly />
                </div>
                {review.comment && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{review.comment}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">{formatDate(review.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBooking && (
        <BookingModal
          provider={provider}
          onClose={() => setShowBooking(false)}
          onSuccess={() => router.push("/bookings")}
        />
      )}
    </div>
  );
}
