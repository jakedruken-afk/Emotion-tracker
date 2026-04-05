import { useState, type FormEvent } from "react";
import { ArrowLeft, LogIn, User, UserCheck } from "lucide-react";
import { demoAccounts, type AuthUser, type UserRole } from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";

type LoginPageProps = {
  onLogin: (user: AuthUser) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [userType, setUserType] = useState<UserRole | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const demoAccount = userType ? demoAccounts[userType] : null;
  const showDemoAccounts =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userType) {
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await apiRequest<AuthUser>("/api/auth/login", {
        method: "POST",
        data: {
          username,
          password,
          expectedRole: userType,
        },
      });

      onLogin(user);
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
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
        <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="hero-panel">
            <BrandMark
              variant="hero"
              context="Daily Care Tracking"
              subtitle="Listen, aid, manage, and balance everyday care in one calm place."
            />
            <h1 className="hero-title text-balance">A calmer, clearer way to follow mood and routine between visits.</h1>
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
          </section>

          <section className="panel p-8 md:p-10">
            <div className="text-center">
              <BrandMark
                variant="compact"
                align="center"
                showWordmark={false}
                showTagline={false}
              />
              <h2 className="mt-6 text-3xl font-bold text-slate-900">Choose your workspace</h2>
              <p className="mt-3 text-base text-slate-600">
                Choose how you want to use the app today.
              </p>
            </div>

            <div className="mt-8 grid gap-4">
              <button
                type="button"
                className="selection-card bg-gradient-to-br from-cyan-50 to-white hover:border-cyan-300 hover:bg-cyan-100"
                onClick={() => setUserType("patient")}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-md">
                  <User className="h-8 w-8" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold text-slate-900">Patient</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Record mood, sleep, daily reports, and check-ins in a simple phone-friendly layout.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="selection-card bg-gradient-to-br from-emerald-50 to-cyan-50 hover:border-emerald-300 hover:bg-emerald-100"
                onClick={() => setUserType("support")}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md">
                  <UserCheck className="h-8 w-8" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold text-slate-900">Support Worker</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Review priority patients, add observations, and use weekly summaries to guide follow-up.
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
      <div className="mx-auto grid w-full max-w-5xl gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="hero-panel">
          <BrandMark
            variant="compact"
            context={userType === "patient" ? "Patient Access" : "Support Access"}
            subtitle={
              userType === "patient"
                ? "Sign in to check in with your care team in a calmer, simpler workspace."
                : "Sign in to review patient patterns, sleep, and care follow-up in one place."
            }
          />
          <h1 className="hero-title">
            {userType === "patient"
              ? "Check in with your care team in a calm, simple workspace."
              : "Step into the clinician dashboard with quick access to patient patterns."}
          </h1>
          <p className="hero-text">
            {userType === "patient"
              ? "Mood tracking, sleep reports, and reminders stay organized so daily check-ins feel easier."
              : "Priority queues, weekly summaries, and local care pathways help the team move faster."}
          </p>

          {showDemoAccounts ? (
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

        <section className="panel p-8 md:p-10">
          <button
            type="button"
            className="btn btn-secondary mb-6"
            onClick={() => setUserType(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mb-8 text-center">
            <BrandMark
              variant="compact"
              align="center"
              showWordmark={false}
              showTagline={false}
            />
            <h2 className="mt-6 text-3xl font-bold text-slate-900">
              {userType === "patient" ? "Patient Login" : "Support Worker Login"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {userType === "patient"
                ? "Sign in to record how you feel, complete daily reports, and keep your history together."
                : "Sign in to review patients, document notes, and follow changes over time."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="username">
                {userType === "patient" ? "Patient ID" : "Username"}
              </label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={userType === "patient" ? "Enter your patient ID" : "Enter your username"}
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
