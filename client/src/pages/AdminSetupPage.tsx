import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { authSessionSchema, type AuthSession, type AuthUser } from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import { useToast } from "../hooks/useToast";
import {
  apiRequest,
  getErrorMessage,
  getPreferredSessionMode,
  persistAuthSession,
} from "../lib/api";

type AdminSetupPageProps = {
  onSetup: (user: AuthUser) => void;
};

export default function AdminSetupPage({ onSetup }: AdminSetupPageProps) {
  const [setupToken, setSetupToken] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Choose a password with at least 8 characters.",
        variant: "info",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure both password fields are the same.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionResponse = await apiRequest<AuthSession>("/api/admin/bootstrap", {
        method: "POST",
        data: {
          setupToken,
          email,
          name,
          password,
          sessionMode: getPreferredSessionMode(),
        },
      });
      const session = authSessionSchema.parse(sessionResponse);
      persistAuthSession(session);
      toast({
        title: "Admin ready",
        description: "The beta admin account is active.",
        variant: "success",
      });
      onSetup(session.user);
    } catch (error) {
      toast({
        title: "Could not create admin",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-5xl gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="hero-panel">
          <BrandMark
            variant="compact"
            context="Beta Admin Setup"
            subtitle="Create the first private beta administrator."
          />
          <h1 className="hero-title text-balance">Set up the L.A.M.B. beta admin.</h1>
          <p className="hero-text">
            This creates the first staff account that can manage beta accounts and invites.
          </p>

          <div className="mt-6 soft-panel">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-teal-600" />
              <p className="text-sm leading-6 text-slate-700">
                Keep the setup token private. After the first admin exists, this setup path closes.
              </p>
            </div>
          </div>
        </section>

        <section className="panel p-6 md:p-10">
          <div className="mb-8 text-center">
            <BrandMark
              variant="compact"
              align="center"
              showWordmark={false}
              showTagline={false}
            />
            <h2 className="mt-6 text-3xl font-bold text-slate-900">Create admin account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use an email you control and a strong password.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="admin-setup-token">
                Setup token
              </label>
              <input
                id="admin-setup-token"
                className="input"
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
                autoComplete="one-time-code"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-name">
                Name
              </label>
              <input
                id="admin-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-password-confirm">
                Confirm password
              </label>
              <input
                id="admin-password-confirm"
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              <KeyRound className="h-4 w-4" />
              {isSubmitting ? "Creating admin..." : "Create Admin"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
