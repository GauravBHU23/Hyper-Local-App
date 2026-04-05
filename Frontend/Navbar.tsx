"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Bell, User, LogOut, MessageCircle, Search, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
    { href: "/chat", label: "AI Chat" },
    ...(isAuthenticated ? [{ href: "/bookings", label: "My Bookings" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl flex items-center justify-center shadow">
            <MapPin size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900">
            Hyper<span className="text-gradient">Local</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-orange-50 text-orange-600"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="hidden md:flex items-center gap-2 btn-primary text-sm py-2 px-4"
          >
            <MessageCircle size={15} />
            Ask AI
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:block">{user?.name?.split(" ")[0]}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl hover:bg-slate-50 text-slate-500"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login" className="btn-secondary text-sm py-2">
                Login
              </Link>
              <Link href="/register" className="btn-primary text-sm py-2">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-slate-50"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium",
                pathname === link.href
                  ? "bg-orange-50 text-orange-600"
                  : "text-slate-600"
              )}
            >
              {link.label}
            </Link>
          ))}
          {!isAuthenticated && (
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