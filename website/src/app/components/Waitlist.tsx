"use client";

import { useState } from "react";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("developer");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    setStatus("submitting");

    try {
      // 调用 API 发送邮件
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, userType }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "You're on the list! Check your email for confirmation.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  };

  return (
    <section id="waitlist" className="py-24 px-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="max-w-xl mx-auto relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--text-2)]">Coming Q2 2026</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Be first to experience
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              the Agent Economy
            </span>
          </h2>
          
          <p className="text-[var(--text-2)] leading-relaxed max-w-md mx-auto">
            Join developers, gamers, and protocols building the future of AI services. 
            Early access launching Q2 2026.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm placeholder:text-[var(--text-3)] focus:outline-none focus:border-white/30 transition-colors"
                disabled={status === "submitting"}
              />
            </div>
            
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="px-4 py-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
              disabled={status === "submitting"}
            >
              <option value="developer">I'm a Developer</option>
              <option value="gamer">I'm a Gamer/User</option>
              <option value="protocol">I'm a Protocol</option>
              <option value="investor">I'm an Investor</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full px-6 py-3.5 rounded-xl bg-white text-[var(--bg)] text-sm font-semibold hover:shadow-[0_0_40px_rgba(139,92,246,0.25)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === "submitting" ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Joining...
              </>
            ) : (
              "Join Waitlist"
            )}
          </button>
        </form>

        {status === "success" && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {message}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[var(--text-3)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            No spam
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Unsubscribe anytime
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Early access
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">2,000+</div>
              <div className="text-xs text-[var(--text-3)]">Waitlist members</div>
            </div>
            <div className="w-px h-10 bg-[var(--border)]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Q2 2026</div>
              <div className="text-xs text-[var(--text-3)]">Beta launch</div>
            </div>
            <div className="w-px h-10 bg-[var(--border)]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">$1T+</div>
              <div className="text-xs text-[var(--text-3)]">Target market</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
