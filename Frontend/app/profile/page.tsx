"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Navigation, Save, Shield, X } from "lucide-react";
import toast from "react-hot-toast";

import { Navbar } from "@/components/layout/Navbar";
import { useLocation } from "@/hooks/useLocation";
import { authApi, getApiErrorMessage, servicesApi, uploadsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { MediaAsset, ServiceCategory, ServiceProvider } from "@/types";
import { CATEGORY_LABELS } from "@/types";

type ProviderForm = {
  business_name: string;
  description: string;
  category: ServiceCategory;
  address: string;
  city: string;
  pincode: string;
  base_price: string;
  price_unit: string;
  phone: string;
  whatsapp: string;
  is_available_24x7: boolean;
  is_currently_available: boolean;
  latitude?: number;
  longitude?: number;
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][];

function toForm(provider?: ServiceProvider | null, fallbackPhone?: string): ProviderForm {
  return {
    business_name: provider?.business_name || "",
    description: provider?.description || "",
    category: provider?.category || "plumber",
    address: provider?.address || "",
    city: provider?.city || "",
    pincode: provider?.pincode || "",
    base_price: provider?.base_price ? String(provider.base_price) : "",
    price_unit: provider?.price_unit || "per visit",
    phone: provider?.phone || fallbackPhone || "",
    whatsapp: provider?.whatsapp || fallbackPhone || "",
    is_available_24x7: provider?.is_available_24x7 || false,
    is_currently_available: provider?.is_currently_available ?? true,
    latitude: provider?.latitude,
    longitude: provider?.longitude,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, isAuthenticated, hasHydrated, updateUser } = useAuthStore();
  const { coords, getLocation, loading: locationLoading, locationName } = useLocation();
  const [form, setForm] = useState<ProviderForm>(() => toForm(null, user?.phone));
  const [accountForm, setAccountForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    preferred_language: user?.preferred_language || "hi",
  });
  const isBootstrappingSession = hasHydrated && !!token && !user;
  const canManageProviderProfile = !user?.is_admin;

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    setAccountForm({
      name: user?.name || "",
      phone: user?.phone || "",
      preferred_language: user?.preferred_language || "hi",
    });
  }, [user?.name, user?.phone, user?.preferred_language]);

  const providerQuery = useQuery({
    queryKey: ["my-provider"],
    queryFn: () => servicesApi.getMine().then((res) => res.data as ServiceProvider),
    enabled: hasHydrated && !isBootstrappingSession && isAuthenticated && canManageProviderProfile,
    retry: false,
  });
  const assetsQuery = useQuery({
    queryKey: ["my-assets"],
    queryFn: () => uploadsApi.getMy().then((res) => res.data as MediaAsset[]),
    enabled: hasHydrated && !isBootstrappingSession && isAuthenticated,
  });

  useEffect(() => {
    if (providerQuery.data) {
      setForm(toForm(providerQuery.data, user?.phone));
    } else if (providerQuery.error && !providerQuery.isLoading) {
      setForm((prev) => ({ ...toForm(null, user?.phone), category: prev.category }));
    }
  }, [providerQuery.data, providerQuery.error, providerQuery.isLoading, user?.phone]);

  const isExistingProvider = !!providerQuery.data;

  const accountMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        name: accountForm.name.trim(),
        phone: accountForm.phone.trim() || undefined,
        preferred_language: accountForm.preferred_language,
      }),
    onSuccess: (res) => {
      updateUser(res.data);
      toast.success("Account updated");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not update account"));
    },
  });

  const validateForm = () => {
    if (form.business_name.trim().length < 2) {
      toast.error("Business name is required");
      return false;
    }
    if (form.address.trim().length < 5) {
      toast.error("Service address is required");
      return false;
    }
    if (form.city.trim().length < 2) {
      toast.error("City is required");
      return false;
    }
    if (form.phone.trim().length < 10) {
      toast.error("Valid phone number is required");
      return false;
    }
    if (form.base_price && Number(form.base_price) < 0) {
      toast.error("Price cannot be negative");
      return false;
    }
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_name: form.business_name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        address: form.address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim() || undefined,
        base_price: form.base_price ? Number(form.base_price) : undefined,
        price_unit: form.price_unit.trim() || "per visit",
        phone: form.phone.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        is_available_24x7: form.is_available_24x7,
        is_currently_available: form.is_currently_available,
        latitude: form.latitude,
        longitude: form.longitude,
      };

      if (isExistingProvider && providerQuery.data) {
        return servicesApi.update(providerQuery.data.id, payload);
      }
      return servicesApi.create(payload);
    },
    onSuccess: () => {
      updateUser({ is_provider: true });
      providerQuery.refetch();
      toast.success(isExistingProvider ? "Provider profile updated" : "Provider profile created");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not save provider profile"));
    },
  });

  const liveLocationMutation = useMutation({
    mutationFn: async () => {
      if (!coords) {
        throw new Error("Current location is not available yet");
      }
      return servicesApi.updateLiveLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    onSuccess: () => {
      setForm((prev) => ({
        ...prev,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }));
      providerQuery.refetch();
      toast.success("Live provider location updated");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not update live location"));
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ file, assetType }: { file: File; assetType: string }) => {
      const formData = new FormData();
      formData.append("asset_type", assetType);
      formData.append("file", file);
      return uploadsApi.upload(formData);
    },
    onSuccess: async (res, variables) => {
      const asset = res.data as MediaAsset;
      if (variables.assetType === "profile_image") {
        try {
          await authApi.updateProfile({ profile_image: asset.file_url });
          updateUser({ profile_image: asset.file_url });
        } catch {
          // Keep the successful upload UX intact even if the follow-up profile sync fails.
        }
      }
      assetsQuery.refetch();
      toast.success("File uploaded");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Upload failed"));
    },
  });
  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => uploadsApi.delete(assetId),
    onSuccess: async () => {
      await assetsQuery.refetch();
      toast.success("File deleted");
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, "Could not delete file"));
    },
  });

  const selectedLocationText = useMemo(() => {
    if (!coords) return "No live location selected";
    return locationName?.label || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
  }, [coords, locationName]);
  const assetsByType = useMemo(() => {
    const grouped = new Map<string, MediaAsset>();
    for (const asset of assetsQuery.data || []) {
      if (!grouped.has(asset.asset_type)) {
        grouped.set(asset.asset_type, asset);
      }
    }
    return grouped;
  }, [assetsQuery.data]);

  const handleChange = <K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!hasHydrated || isBootstrappingSession) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">
            Account Profile
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {user?.is_admin ? "Manage your admin account" : "Manage your account"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Keep your account details updated. Provider settings, uploads, and verification
            tools are shown where they are relevant.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  className="input"
                  value={accountForm.name}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  className="input"
                  value={accountForm.phone}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Language</label>
                <select
                  className="input"
                  value={accountForm.preferred_language}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      preferred_language: e.target.value,
                    }))
                  }
                >
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => accountMutation.mutate()}
              disabled={accountMutation.isPending}
              className="btn-secondary flex w-full items-center justify-center gap-2"
            >
              {accountMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save account details
            </button>
          </section>

          <aside className="space-y-4">
            {user?.is_admin ? (
              <section className="card space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Admin account</h2>
                    <p className="text-sm text-slate-500">
                      Provider onboarding fields are hidden for admin users.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p>You can continue using the admin dashboard for moderation, bookings, and KYC review.</p>
                  <p className="mt-2 text-xs text-slate-400">{user.email}</p>
                </div>
              </section>
            ) : null}

            {canManageProviderProfile ? (
              <>
                <section className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name</label>
                <input
                  className="input"
                  value={form.business_name}
                  onChange={(e) => handleChange("business_name", e.target.value)}
                  placeholder="e.g. Arjun Electric Works"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  className="input min-h-28 resize-none"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="What services do you offer?"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value as ServiceCategory)}
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Starting Price</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.base_price}
                  onChange={(e) => handleChange("base_price", e.target.value)}
                  placeholder="299"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Street, area, landmark"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Delhi"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Pincode</label>
                <input
                  className="input"
                  value={form.pincode}
                  onChange={(e) => handleChange("pincode", e.target.value)}
                  placeholder="110001"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp</label>
                <input
                  className="input"
                  value={form.whatsapp}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Price Unit</label>
                <input
                  className="input"
                  value={form.price_unit}
                  onChange={(e) => handleChange("price_unit", e.target.value)}
                  placeholder="per visit"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_available_24x7}
                  onChange={(e) => handleChange("is_available_24x7", e.target.checked)}
                />
                Available 24x7
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_currently_available}
                  onChange={(e) => handleChange("is_currently_available", e.target.checked)}
                />
                Available now
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!validateForm()) return;
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isExistingProvider ? "Save changes" : "Create provider profile"}
            </button>
          </section>

            <section className="card space-y-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-orange-50 p-2 text-orange-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Saved provider location</h2>
                  <p className="text-sm text-slate-500">
                    Address-based coordinates are auto-generated when you save.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>{form.address || "No address added yet"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {form.latitude && form.longitude
                    ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                    : "Coordinates will be generated on save"}
                </p>
              </div>
            </section>

            <section className="card space-y-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                  <Navigation size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Live provider location</h2>
                  <p className="text-sm text-slate-500">
                    Use this when you want customers to see your current nearby availability.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>{selectedLocationText}</p>
              </div>

              <button
                type="button"
                onClick={() => getLocation()}
                className="btn-secondary w-full"
                disabled={locationLoading}
              >
                {locationLoading ? "Detecting location..." : "Use my current location"}
              </button>

              <button
                type="button"
                onClick={() => liveLocationMutation.mutate()}
                className="btn-primary w-full"
                disabled={liveLocationMutation.isPending || !coords || !isExistingProvider}
              >
                {liveLocationMutation.isPending ? "Updating live location..." : "Push live location to backend"}
              </button>

              {!isExistingProvider && (
                <p className="text-xs text-slate-400">
                  Create your provider profile first, then you can update live location.
                </p>
              )}
            </section>
              </>
            ) : null}

            <section className="card space-y-4">
              <div>
                <h2 className="font-semibold text-slate-900">Uploads & verification</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Upload profile image{canManageProviderProfile ? ", KYC document, or work samples" : ""} for trust building.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Profile image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate({ file, assetType: "profile_image" });
                  }}
                />
                {assetsByType.get("profile_image") ? (
                  <UploadAssetRow
                    asset={assetsByType.get("profile_image")!}
                    deleting={deleteAssetMutation.isPending}
                    onDelete={(assetId) => deleteAssetMutation.mutate(assetId)}
                  />
                ) : null}
              </div>

              {canManageProviderProfile ? (
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">KYC document</label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadMutation.mutate({ file, assetType: "kyc_document" });
                      }}
                    />
                    {assetsByType.get("kyc_document") ? (
                      <UploadAssetRow
                        asset={assetsByType.get("kyc_document")!}
                        deleting={deleteAssetMutation.isPending}
                        onDelete={(assetId) => deleteAssetMutation.mutate(assetId)}
                      />
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Work sample</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadMutation.mutate({ file, assetType: "work_sample" });
                      }}
                    />
                    {assetsByType.get("work_sample") ? (
                      <UploadAssetRow
                        asset={assetsByType.get("work_sample")!}
                        deleting={deleteAssetMutation.isPending}
                        onDelete={(assetId) => deleteAssetMutation.mutate(assetId)}
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  Admin accounts usually only need a profile image.
                </p>
              )}

              {false && <div className="space-y-2">
                {assetsQuery.data?.map((asset) => (
                  <div key={asset.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-medium text-slate-900">{asset.original_name}</p>
                    <p className="text-xs text-slate-500">
                      {asset.asset_type} · {asset.is_verified ? "Verified" : "Pending verification"}
                    </p>
                    <a href={asset.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-orange-600">
                      Open file
                    </a>
                  </div>
                ))}
              </div>}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function UploadAssetRow({
  asset,
  deleting,
  onDelete,
}: {
  asset: MediaAsset;
  deleting: boolean;
  onDelete: (assetId: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{asset.original_name}</p>
          <p className="text-xs text-slate-500">
            {asset.is_verified ? "Verified" : "Pending verification"}
          </p>
          <a
            href={asset.file_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-orange-600"
          >
            Open file
          </a>
        </div>
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          disabled={deleting}
          className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-red-500"
          aria-label="Delete upload"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
