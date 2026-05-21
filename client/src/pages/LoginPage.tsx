import { useState, type FormEvent } from "react";
import { ArrowLeft, LogIn, ShieldCheck, User, UserCheck } from "lucide-react";
import {
  authSessionSchema,
  demoAccounts,
  type AuthSession,
  type AuthUser,
  type UserRole,
} from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import { useToast } from "../hooks/useToast";
import {
  apiRequest,
  getErrorMessage,
  getPreferredSessionMode,
  persistAuthSession,
} from "../lib/api";

type LoginPageProps = {
  onLogin: (user: AuthUser) => void;
};

type LoginUserType = UserRole | "admin";

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [userType, setUserType] = useState<LoginUserType | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const demoAccount = userType === "patient" || userType === "support" ? demoAccounts[userType] : null;
  const isCloudflareBackend = String(import.meta.env.VITE_API_BASE_URL ?? "").includes(
    "workers.dev",
  );
  const showDemoAccounts =
    !isCloudflareBackend &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isPatientLogin = userType === "patient";
  const isAdminLogin = userType === "admin";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userType) {
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionResponse = await apiRequest<AuthSession>("/api/auth/login", {
        method: "POST",
        data: {
          username,
          password,
          expectedRole: userType === "patient" ? "patient" : "support",
          sessionMode: getPreferredSessionMode(),
        },
      });
      const session = authSessionSchema.parse(sessionResponse);

      persistAuthSession(session);
      onLogin(session.user);
      toast({
        title: "Welcome back",
        description:
          session.sessionMode === "header"
            ? "You have successfully logged in with mobile-ready session storage."
            : "You have successfully logged in.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userType) {
    return (
      <div className="page-shell">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="hero-panel order-2 hidden md:block xl:order-1">
            <div>
              <BrandMark
                variant="hero"
                context="Daily Care Tracking"
                subtitle="Listen, aid, manage, and balance everyday care in one calm place."
              />
              <h1 className="hero-title text-balance">
                A calmer, clearer way to follow mood and routine between visits.
              </h1>
              <p className="hero-text">
                Designed for patients, support workers, and clinicians who need simple daily check-ins, better sleep tracking, and faster pattern review.
              </p>

              <div className="mt-6 metric-grid">
                <MetricTile
                  label="Patient side"
                  value="Simple"
                  detail="Big choices, clear wording, and guided daily reports."
                  tone="coral"
                />
                <MetricTile
                  label="Support side"
                  value="Focused"
                  detail="Priority queues, weekly reviews, and care pathways."
                  tone="sky"
                />
                <MetricTile
                  label="Runs locally"
                  value="Private"
                  detail="Uses the local database on this device."
                  tone="mint"
                />
                <MetricTile
                  label="Built for"
                  value="Care Teams"
                  detail="Helpful for mental health, addiction, and routine monitoring."
                  tone="gold"
                />
              </div>
            </div>
          </section>

          <section className="panel workspace-panel order-1 p-3.5 sm:p-5 md:p-10 xl:order-2">
            <div className="text-center">
              <BrandMark
                variant="compact"
                align="center"
                showWordmark={false}
                showTagline={false}
                className="workspace-brand"
              />
              <h2 className="mt-3 text-xl font-bold leading-tight text-slate-900 sm:text-2xl md:mt-6 md:text-3xl">
                Choose your workspace
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm md:mt-3 md:text-base">
                Choose how you want to use the app today.
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:gap-3 md:mt-8 md:gap-4">
              <button
                type="button"
                className="selection-card bg-gradient-to-br from-cyan-50 to-white hover:border-cyan-300 hover:bg-cyan-100"
                onClick={() => setUserType("patient")}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-md md:h-16 md:w-16 md:rounded-[24px]">
                  <User className="h-5 w-5 md:h-8 md:w-8" />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-slate-900 md:text-lg">Patient</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm md:mt-1 md:leading-6">
                    Mood, sleep, reports, and check-ins.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="selection-card bg-gradient-to-br from-emerald-50 to-cyan-50 hover:border-emerald-300 hover:bg-emerald-100"
                onClick={() => setUserType("support")}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md md:h-16 md:w-16 md:rounded-[24px]">
                  <UserCheck className="h-5 w-5 md:h-8 md:w-8" />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-slate-900 md:text-lg">Support Worker</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm md:mt-1 md:leading-6">
                    Priorities, observations, and summaries.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="selection-card bg-gradient-to-br from-amber-50 to-white hover:border-amber-300 hover:bg-amber-100"
                onClick={() => setUserType("admin")}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-amber-500 to-teal-500 text-white shadow-md md:h-16 md:w-16 md:rounded-[24px]">
                  <ShieldCheck className="h-5 w-5 md:h-8 md:w-8" />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-slate-900 md:text-lg">App Admin</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm md:mt-1 md:leading-6">
                    Beta accounts, invites, and access.
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-5xl gap-4 md:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="hero-panel order-2 hidden md:block xl:order-1">
          <BrandMark
            variant="compact"
            context={isPatientLogin ? "Patient Access" : isAdminLogin ? "Admin Access" : "Support Access"}
            subtitle={
              isPatientLogin
                ? "Sign in to check in with your care team in a calmer, simpler workspace."
                : isAdminLogin
                  ? "Sign in to manage beta accounts and invite-only registration."
                : "Sign in to review patient patterns, sleep, and care follow-up in one place."
            }
          />
          <h1 className="hero-title">
            {isPatientLogin
              ? "Check in with your care team in a calm, simple workspace."
              : isAdminLogin
                ? "Open the beta admin console for accounts and invites."
              : "Step into the clinician dashboard with quick access to patient patterns."}
          </h1>
          <p className="hero-text">
            {isPatientLogin
              ? "Mood tracking, sleep reports, and reminders stay organized so daily check-ins feel easier."
              : isAdminLogin
                ? "Create staff accounts, issue patient invites, and keep the beta controlled."
              : "Priority queues, weekly summaries, and local care pathways help the team move faster."}
          </p>

          {showDemoAccounts && demoAccount ? (
            <div className="mt-6 soft-panel">
              <p className="mini-heading">Development demo access</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Username: <span className="font-semibold text-slate-900">{demoAccount?.username}</span>
              </p>
              <p className="text-sm leading-6 text-slate-700">
                Password: <span className="font-semibold text-slate-900">{demoAccount?.password}</span>
              </p>
            </div>
          ) : (
            <div className="mt-6 soft-panel">
              <p className="mini-heading">Private pilot access</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Use the username and password created from your clinician invite link.
              </p>
            </div>
          )}
        </section>

        <section className="panel workspace-panel order-1 p-3.5 sm:p-5 md:p-10 xl:order-2">
          <button
            type="button"
            className="btn btn-secondary mb-4 md:mb-6"
            onClick={() => setUserType(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mb-4 text-center md:mb-8">
            <BrandMark
              variant="compact"
              align="center"
              showWordmark={false}
              showTagline={false}
              className="workspace-brand"
            />
            <h2 className="mt-3 text-xl font-bold leading-tight text-slate-900 sm:text-2xl md:mt-6 md:text-3xl">
              {isPatientLogin ? "Patient Login" : isAdminLogin ? "App Admin Login" : "Support Worker Login"}
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm md:mt-3 md:leading-6">
              {isPatientLogin
                ? "Sign in to record how you feel, complete daily reports, and keep your history together."
                : isAdminLogin
                  ? "Sign in to create beta accounts and private invite links."
                : "Sign in to review patients, document notes, and follow changes over time."}
            </p>
          </div>

          {showDemoAccounts && demoAccount ? (
            <div className="soft-panel mb-6 md:hidden">
              <p className="mini-heading">Development demo access</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Username: <span className="font-semibold text-slate-900">{demoAccount?.username}</span>
              </p>
              <p className="text-sm leading-6 text-slate-700">
                Password: <span className="font-semibold text-slate-900">{demoAccount?.password}</span>
              </p>
            </div>
          ) : (
            <div className="soft-panel mb-6 md:hidden">
              <p className="mini-heading">Private pilot access</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Use the username and password created from your clinician invite link.
              </p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="username">
                {isPatientLogin ? "Patient code or email" : "Email"}
              </label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={
                  isPatientLogin
                    ? "Enter your patient code or email"
                    : "Enter your email"
                }
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              <LogIn className="h-4 w-4" />
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
