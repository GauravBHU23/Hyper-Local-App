"use client";
import { Suspense, useDeferredValue, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X, MapPin, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { servicesApi } from "@/lib/api";
import { useLocation } from "@/hooks/useLocation";
import { CategoryFilter } from "@/components/services/CategoryFilter";
import { ServiceCard } from "@/components/services/ServiceCard";
import { Navbar } from "@/components/layout/Navbar";
import type { ServiceCategory, ServiceProvider } from "@/types";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { coords } = useLocation();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState<ServiceCategory | null>(
    (searchParams.get("category") as ServiceCategory) || null
  );
  const [radius, setRadius] = useState(15);
  const [availableNow, setAvailableNow] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  const nearbyQuery = useQuery({
    queryKey: ["search", coords, deferredQuery, category, radius, availableNow, minRating],
    queryFn: () =>
      servicesApi
        .getNearby({
          latitude: coords!.latitude,
          longitude: coords!.longitude,
          radius_km: radius,
          category: category || undefined,
          query: deferredQuery || undefined,
          available_now: availableNow,
          min_rating: minRating,
          limit: 30,
        })
        .then((r) => r.data as ServiceProvider[]),
    enabled: !!coords,
  });

  const featuredQuery = useQuery({
    queryKey: ["search-featured", deferredQuery, category],
    queryFn: () =>
      servicesApi
        .discover({
          query: deferredQuery || undefined,
          category: category || undefined,
          limit: 30,
        })
        .then((r) => r.data as ServiceProvider[]),
  });

  const results =
    nearbyQuery.data && nearbyQuery.data.length > 0 ? nearbyQuery.data : featuredQuery.data;
  const isLoading = (!!coords && nearbyQuery.isLoading) || featuredQuery.isLoading;
  const isFetching = nearbyQuery.isFetching || featuredQuery.isFetching;
  const showingFeatured = (!coords || (nearbyQuery.data?.length || 0) === 0) && (featuredQuery.data?.length || 0) > 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/search?q=${encodeURIComponent(query)}&category=${category || ""}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Search Header */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-40 px-4 py-3">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a service..."
              className="input pl-9 text-sm h-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary h-10 px-3 flex items-center gap-2 ${showFilters ? "bg-orange-50 border-orange-200 text-orange-600" : ""}`}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:block text-sm">Filters</span>
          </button>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="max-w-4xl mx-auto mt-3 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Radius:</label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1"
              >
                {[5, 10, 15, 25, 50].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Min Rating:</label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1"
              >
                {[0, 3, 3.5, 4, 4.5].map((r) => (
                  <option key={r} value={r}>{r === 0 ? "Any" : `${r}+`}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={availableNow}
                onChange={(e) => setAvailableNow(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-medium text-slate-600">Available Now</span>
            </label>
          </div>
        )}

        {/* Category filter */}
        <div className="max-w-4xl mx-auto mt-3">
          <CategoryFilter selected={category} onChange={setCategory} />
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Searching...
              </span>
            ) : (
              `${results?.length || 0} services found`
            )}
          </p>
          {coords && !showingFeatured && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={11} />
              {radius}km radius
            </span>
          )}
          {showingFeatured && (
            <span className="text-xs text-slate-400">Showing featured providers</span>
          )}
        </div>

        {!coords && !showingFeatured && (
          <div className="text-center py-12">
            <MapPin size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Detecting your location...</p>
          </div>
        )}

        {results?.length === 0 && !isLoading && (
          <div className="text-center py-12 text-slate-400">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results found</p>
            <p className="text-sm mt-1">Try increasing the radius or clearing some filters</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {(isLoading ? Array.from({ length: 6 }) : results || []).map((svc, i) =>
            isLoading ? (
              <div key={i} className="card animate-pulse h-28">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ) : (
              <ServiceCard key={(svc as ServiceProvider).id} provider={svc as ServiceProvider} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
