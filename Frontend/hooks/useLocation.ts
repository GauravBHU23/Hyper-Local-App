"use client";

import { useEffect, useState } from "react";

const LOCATION_CACHE_KEY = "hyperlocal-location-cache";
const LOCATION_CACHE_TTL_MS = 10 * 60 * 1000;

interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationDetails {
  label: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [locationName, setLocationName] = useState<LocationDetails | null>(null);
  const [locationNameLoading, setLocationNameLoading] = useState(false);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setLocationNameLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch location name");
      }

      const data = await response.json();
      const address = data.address || {};
      const area =
        address.suburb ||
        address.neighbourhood ||
        address.village ||
        address.town ||
        address.city_district;
      const city = address.city || address.town || address.county || address.state_district;
      const state = address.state;
      const country = address.country;
      const labelParts = [area, city, state, country].filter(Boolean);

      setLocationName({
        label: labelParts.join(", ") || data.display_name || "Current location",
        area,
        city,
        state,
        country,
      });
      if (typeof window !== "undefined") {
        const cached = readLocationCache();
        writeLocationCache({
          coords: cached?.coords || { latitude, longitude },
          locationName: {
            label: labelParts.join(", ") || data.display_name || "Current location",
            area,
            city,
            state,
            country,
          },
        });
      }
    } catch {
      setLocationName(null);
    } finally {
      setLocationNameLoading(false);
    }
  };

  const readLocationCache = (): { coords: Coords; locationName: LocationDetails | null; lastUpdated: string } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LOCATION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        coords: Coords;
        locationName: LocationDetails | null;
        lastUpdated: string;
      };
      if (!parsed?.lastUpdated) return null;
      if (Date.now() - new Date(parsed.lastUpdated).getTime() > LOCATION_CACHE_TTL_MS) {
        localStorage.removeItem(LOCATION_CACHE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const writeLocationCache = (payload: {
    coords: Coords;
    locationName?: LocationDetails | null;
  }) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        LOCATION_CACHE_KEY,
        JSON.stringify({
          coords: payload.coords,
          locationName: payload.locationName ?? null,
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore local cache write issues.
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setError(null);
        const nextCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(nextCoords);
        setLastUpdated(new Date());
        setLoading(false);
        writeLocationCache({ coords: nextCoords, locationName });
        void reverseGeocode(nextCoords.latitude, nextCoords.longitude);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        setCoords(null);
        setLocationName(null);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 5000,
      }
    );
  };

  useEffect(() => {
    const cached = readLocationCache();
    if (cached) {
      setCoords(cached.coords);
      setLocationName(cached.locationName);
      setLastUpdated(new Date(cached.lastUpdated));
      return;
    }

    getLocation();
  }, []);

  return {
    coords,
    error,
    loading,
    lastUpdated,
    locationName,
    locationNameLoading,
    getLocation,
  };
}
