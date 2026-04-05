"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Mail, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [useOtpLogin, setUseOtpLogin] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await authApi.login(email, password);
      const { access_token, user } = res.data;

      setAuth(user, access_token);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email first.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.requestLoginOtp(email.trim());
      toast.success(res.data?.message || "OTP sent to your email");
      setOtpSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!email.trim() || !otp.trim()) {
      toast.error("Please enter email and OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.verifyLoginOtp(email.trim(), otp.trim());
      const { access_token, user } = res.data;
      setAuth(user, access_token);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "OTP verification failed");
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
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
        </div>

        <div className="card shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aap@example.com"
                  className="input pl-9 text-sm"
                  required
                />
              </div>
            </div>

            {!useOtpLogin ? (
              <>
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="........"
                      className="input pl-9 text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex w-full items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? "Signing in..." : "Login"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email OTP
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className="input pl-9 text-sm"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="btn-secondary flex-1 text-sm"
                  >
                    {loading && !otpSent ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleVerifyOtp}
                    className="btn-primary flex-1 text-sm"
                  >
                    {loading && otpSent ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  If SMTP is not configured, OTP will print in the backend console in development.
                </p>
              </>
            )}
          </form>

          <button
            type="button"
            onClick={() => {
              setUseOtpLogin((value) => !value);
              setOtpSent(false);
              setOtp("");
            }}
            className="mt-4 w-full text-sm font-medium text-orange-600 hover:underline"
          >
            {useOtpLogin ? "Use password instead" : "Login with email OTP"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-orange-600 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

