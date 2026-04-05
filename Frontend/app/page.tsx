"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, MapPin, Search } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { CategoryFilter } from "@/components/services/CategoryFilter";
import { ServiceCard } from "@/components/services/ServiceCard";
import { useLocation } from "@/hooks/useLocation";
import { servicesApi } from "@/lib/api";
import type { ServiceCategory, ServiceProvider } from "@/types";

export default function HomePage() {
  const {
    coords,
    error,
    loading: locationLoading,
    lastUpdated,
    locationName,
    locationNameLoading,
  } = useLocation();
  const [category, setCategory] = useState<ServiceCategory | null>(null);

  const nearbyQuery = useQuery({
    queryKey: ["home-nearby", coords, category],
    queryFn: () =>
      servicesApi
        .getNearby({
          latitude: coords!.latitude,
          longitude: coords!.longitude,
          radius_km: 10,
          category: category || undefined,
          limit: 8,
        })
        .then((response) => response.data as ServiceProvider[]),
    enabled: !!coords,
  });

  const featuredQuery = useQuery({
    queryKey: ["home-featured", category],
    queryFn: () =>
      servicesApi
        .discover({
          category: category || undefined,
          limit: 8,
        })
        .then((response) => response.data as ServiceProvider[]),
  });

  const providers =
    nearbyQuery.data && nearbyQuery.data.length > 0 ? nearbyQuery.data : featuredQuery.data;
  const isLoading = (!!coords && nearbyQuery.isLoading) || featuredQuery.isLoading;
  const showingFeatured = (!coords || (nearbyQuery.data?.length || 0) === 0) && (featuredQuery.data?.length || 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 px-6 py-10 text-white shadow-xl sm:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-orange-100">
                Local services, fast response
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
                  Nearby professionals for everyday problems.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200 sm:text-base">
                  Find plumbers, electricians, AC repair experts, tutors, cleaners,
                  and more. Browse trusted nearby providers and book directly.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/search" className="btn-primary inline-flex items-center gap-2">
                  <Search size={16} />
                  Start searching
                </Link>
                <Link href="/chat" className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 text-white hover:bg-white/15">
                  Ask AI
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-orange-100">Location status</p>
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-black/20 p-4">
                <div className="mt-0.5 rounded-xl bg-white/10 p-2">
                  <MapPin size={18} />
                </div>
                <div className="space-y-1 text-sm text-slate-100">
                  {coords ? (
                    <>
                      <p className="font-semibold">Location detected</p>
                      <p className="text-slate-300">
                        {locationNameLoading
                          ? "Resolving your current location..."
                          : locationName?.label || "Nearby services are now tailored to your area."}
                      </p>
                      <div className="pt-2 text-xs text-slate-400">
                        {locationName?.city || locationName?.state || locationName?.country ? (
                          <p>
                            {[
                              locationName.city,
                              locationName.state,
                              locationName.country,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        ) : null}
                        {coords.accuracy ? (
                          <p>Accuracy: about {Math.round(coords.accuracy)} meters</p>
                        ) : null}
                        {lastUpdated ? (
                          <p>
                            Updated:{" "}
                            {lastUpdated.toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : locationLoading ? (
                    <>
                      <p className="font-semibold">Detecting location</p>
                      <p className="text-slate-300">One moment, nearby providers are loading.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Location unavailable</p>
                      <p className="text-slate-300">
                        {error
                          ? "Please allow location access to see services near you."
                          : "Waiting for location access to load nearby services."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-600">
                Browse by category
              </p>
              <h2 className="text-2xl font-bold text-slate-900">Popular local services</h2>
            </div>
            <Link href="/search" className="text-sm font-medium text-orange-600 hover:text-orange-700">
              View all results
            </Link>
          </div>
          <CategoryFilter selected={category} onChange={setCategory} showAll />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {showingFeatured ? "Featured providers" : "Nearby providers"}
              </h3>
              {showingFeatured && (
                <p className="mt-1 text-sm text-slate-500">
                  Showing verified providers because nearby results are not available yet.
                </p>
              )}
            </div>
            {(isLoading || locationLoading) && (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading services
              </span>
            )}
          </div>

          {!coords && !locationLoading && !showingFeatured ? (
            <div className="card py-10 text-center text-slate-500">
              <MapPin size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Location access is required for nearby results.</p>
              <p className="mt-1 text-sm">
                Enable browser location permission and refresh the page.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(isLoading ? Array.from({ length: 6 }) : providers || []).map((provider, index) =>
              isLoading ? (
                <div key={index} className="card h-28 animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              ) : (
                <ServiceCard key={(provider as ServiceProvider).id} provider={provider as ServiceProvider} />
              )
            )}
          </div>

          {!isLoading && (!providers || providers.length === 0) && (
            <div className="card py-10 text-center text-slate-500">
              <p className="font-medium">No providers found for this category yet.</p>
              <p className="mt-1 text-sm">Try another category or add more providers from the backend.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
