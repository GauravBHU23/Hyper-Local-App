"use client";

import { useState } from "react";
import Link from "next/link";
// @ts-ignore: lucide-react has no declaration file
import { Loader2, Lock, Mail, MapPin, Phone, User } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { authApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";

type RegisterForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  preferred_language: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    email: "",
    phone: "",
    password: "",
    preferred_language: "hi",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof RegisterForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await authApi.register(form);
      const { access_token, user } = res.data;

      setAuth(user, access_token);
      toast.success(`Welcome, ${user.name}!`);
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-rose-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-lg">
            <MapPin size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hyper<span className="text-gradient">Local</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Naya account banao</p>
        </div>

        <div className="card shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <div className="relative">
                <User
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Aapka naam"
                  className="input pl-9 text-sm"
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="aap@example.com"
                  className="input pl-9 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone (Optional)
              </label>
              <div className="relative">
                <Phone
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="9876543210"
                  className="input pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="........"
                  className="input pl-9 text-sm"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Language
              </label>
              <select
                value={form.preferred_language}
                onChange={(e) => handleChange("preferred_language", e.target.value)}
                className="input text-sm"
              >
                <option value="hi">Hindi</option>
                <option value="en">English</option>
                <option value="bho">Bhojpuri</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Account ban raha hai..." : "Register"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Account hai?{" "}
            <Link
              href="/login"
              className="font-medium text-orange-600 hover:underline"
            >
              Login karo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
