"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type SidebarProps = {
  role: "TEACHER" | "STUDENT";
  userName: string;
};

const teacherNav: NavItem[] = [
  {
    href: "/teacher",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h5v5H2V2zm0 7h5v5H2V9zm7-7h5v5H9V2zm0 7h5v5H9V9z" />
      </svg>
    ),
  },
  {
    href: "/teacher/tests",
    label: "Reading Tests",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v1H2V2zm0 3h12v1H2V5zm0 3h8v1H2V8zm0 3h10v1H2v-1z" />
      </svg>
    ),
  },
  {
    href: "/teacher/students",
    label: "Students",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a3 3 0 100 6 3 3 0 000-6zM3 13c0-2.76 2.24-5 5-5s5 2.24 5 5H3z" />
      </svg>
    ),
  },
  {
    href: "/teacher/analytics",
    label: "Analytics",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 14V6h3v8H2zm4 0V2h3v12H6zm4 0V9h3v5h-3z" />
      </svg>
    ),
  },
];

const studentNav: NavItem[] = [
  {
    href: "/student",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h5v5H2V2zm0 7h5v5H2V9zm7-7h5v5H9V2zm0 7h5v5H9V9z" />
      </svg>
    ),
  },
  {
    href: "/student/tests",
    label: "My Tests",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v1H2V2zm0 3h12v1H2V5zm0 3h8v1H2V8zm0 3h10v1H2v-1z" />
      </svg>
    ),
  },
  {
    href: "/student/results",
    label: "Results",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 14V6h3v8H2zm4 0V2h3v12H6zm4 0V9h3v5h-3z" />
      </svg>
    ),
  },
];

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const nav = role === "TEACHER" ? teacherNav : studentNav;

  return (
    <aside className="flex flex-col w-56 shrink-0 bg-[#123D30] text-white h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="block w-2 h-2 rounded-full bg-[#E8B84B]" />
          <span className="font-bold text-sm tracking-tight">IELTS Platform</span>
        </div>
        <div className="mt-2 text-xs text-white/50 uppercase tracking-widest">
          {role === "TEACHER" ? "Teacher" : "Student"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active =
            item.href === pathname ||
            (item.href !== "/teacher" &&
              item.href !== "/student" &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-sm font-medium text-white/80 truncate mb-2">
          {userName}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
