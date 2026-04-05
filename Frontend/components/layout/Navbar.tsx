"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, MapPin, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { NotificationItem } from "@/types";

async function safeNotificationsQuery(): Promise<NotificationItem[]> {
  try {
    const res = await notificationsApi.getMy();
    return res.data as NotificationItem[];
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return [];
    }
    throw err;
  }
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, isAuthenticated, hasHydrated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isBootstrappingSession = hasHydrated && !!token && !user;

  const profileImage = user?.profile_image;
  const showProfileImage = Boolean(profileImage) && !avatarFailed;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  useEffect(() => {
    setAvatarFailed(false);
  }, [profileImage]);

  const isAdmin = Boolean(user?.is_admin);
  const isProvider = Boolean(user?.is_provider);
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: safeNotificationsQuery,
    enabled: hasHydrated && !isBootstrappingSession && isAuthenticated,
    staleTime: 30_000,
    retry: false,
  });
  const unreadCount = notificationsQuery.data?.filter((item) => !item.is_read).length || 0;

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
    { href: "/chat", label: "AI Chat" },
    ...(isAuthenticated ? [{ href: "/bookings", label: "My Bookings" }] : []),
    ...(isAuthenticated ? [{ href: "/support", label: "Support" }] : []),
    ...(isAuthenticated ? [{ href: "/notifications", label: "Notifications" }] : []),
    ...(isProvider ? [{ href: "/provider", label: "Provider" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 shadow">
            <MapPin size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">
            Hyper<span className="text-gradient">Local</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-orange-50 text-orange-600"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="btn-primary hidden items-center gap-2 px-4 py-2 text-sm md:flex"
          >
            <MessageCircle size={15} />
            Ask AI
          </Link>

          {hasHydrated && !isBootstrappingSession && isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                href="/notifications"
                className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-50"
              >
                <Bell size={16} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showProfileImage ? (
                  <img
                    src={profileImage!}
                    alt={user?.name || "Profile"}
                    className="h-7 w-7 rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-400 text-xs font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:block">{user?.name?.split(" ")[0]}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : hasHydrated && !isBootstrappingSession ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="btn-secondary py-2 text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary py-2 text-sm">
                Sign Up
              </Link>
            </div>
          ) : null}

          <button
            className="rounded-xl p-2 hover:bg-slate-50 md:hidden"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-medium",
                pathname === link.href ? "bg-orange-50 text-orange-600" : "text-slate-600"
              )}
            >
              {link.label}
            </Link>
          ))}
          {hasHydrated && !isBootstrappingSession && !isAuthenticated && (
            <div className="flex gap-2 pt-2">
              <Link href="/login" className="btn-secondary flex-1 text-center text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary flex-1 text-center text-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
