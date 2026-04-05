"use client";
import Link from "next/link";
import { Star, MapPin, Clock, Phone, BadgeCheck, Zap } from "lucide-react";
import type { ServiceProvider } from "@/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDistance, getRatingColor, getWhatsappLink, cn } from "@/lib/utils";

interface Props {
  provider: ServiceProvider;
  compact?: boolean;
}

export function ServiceCard({ provider, compact = false }: Props) {
  const icon = CATEGORY_ICONS[provider.category];
  const label = CATEGORY_LABELS[provider.category];

  return (
    <Link href={`/services/${provider.id}`}>
      <div className={cn(
        "card hover:shadow-md hover:border-orange-100 transition-all duration-200 cursor-pointer group",
        compact ? "p-3" : "p-4"
      )}>
        <div className="flex gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-orange-100 transition-colors">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                    {provider.business_name}
                  </h3>
                  {provider.is_verified && (
                    <BadgeCheck size={14} className="text-blue-500 shrink-0" />
                  )}
                </div>
                <span className="text-xs text-slate-500">{label}</span>
              </div>

              {/* Available badge */}
              {provider.is_currently_available ? (
                <span className="badge bg-green-50 text-green-700 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
                  Available
                </span>
              ) : (
                <span className="badge bg-slate-100 text-slate-500 shrink-0">
                  Busy
                </span>
              )}
            </div>

            {/* Rating + Distance */}
            <div className="flex items-center gap-3 mt-1.5">
              <span className={cn("flex items-center gap-1 text-xs font-medium", getRatingColor(provider.rating))}>
                <Star size={11} fill="currentColor" />
                {provider.rating.toFixed(1)}
                <span className="text-slate-400 font-normal">({provider.total_reviews})</span>
              </span>

              {provider.distance_km !== undefined && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={11} />
                  {formatDistance(provider.distance_km)}
                </span>
              )}

              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} />
                ~{provider.response_time_minutes}min
              </span>
            </div>

            {!compact && (
              <div className="flex items-center justify-between mt-2">
                {/* Price */}
                {provider.base_price ? (
                  <span className="text-sm font-semibold text-orange-600">
                    {formatCurrency(provider.base_price)}
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      {provider.price_unit}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Price on visit</span>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2">
                  {provider.whatsapp && (
                    <a
                      href={getWhatsappLink(provider.whatsapp, `Hi, I need ${label} service`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                  {provider.phone && (
                    <a
                      href={`tel:${provider.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Phone size={11} />
                      Call
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 24x7 tag */}
        {provider.is_available_24x7 && (
          <div className="mt-2 flex">
            <span className="badge bg-purple-50 text-purple-700">
              <Zap size={10} />
              24x7 Available
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}