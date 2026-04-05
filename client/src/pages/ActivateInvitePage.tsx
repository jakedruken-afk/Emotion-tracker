import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import type { AuthUser } from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";

type ActivateInvitePageProps = {
  token: string;
  onActivated: (user: AuthUser) => void;
};

export default function ActivateInvitePage({
  token,
  onActivated,
}: ActivateInvitePageProps) {
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
      const user = await apiRequest<AuthUser>("/api/invites/accept", {
        method: "POST",
        data: {
          token,
          password,
        },
      });

      toast({
        title: "Account ready",
        description: "Your invite has been accepted and you are now signed in.",
        variant: "success",
      });
      onActivated(user);
    } catch (error) {
      toast({
        title: "Could not activate this invite",
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
            context="Invite Activation"
            subtitle="Set your password and finish your secure pilot account setup."
          />
          <h1 className="hero-title text-balance">
            Finish your L.A.M.B account setup.
          </h1>
          <p className="hero-text">
            This invite link is meant for a private pilot account. Once your password is set,
            you will be signed in and taken to your workspace.
          </p>

          <div className="mt-6 soft-panel">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-teal-600" />
              <div className="text-sm leading-6 text-slate-700">
                Use a password you have not used elsewhere. This pilot uses secure server-backed
                sign-in instead of keeping login state only in the browser.
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-8 md:p-10">
          <div className="mb-8 text-center">
            <BrandMark
              variant="compact"
              align="center"
              showWordmark={false}
              showTagline={false}
            />
            <h2 className="mt-6 text-3xl font-bold text-slate-900">Create your password</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This password will be used the next time you sign in.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="invite-password">
                New password
              </label>
              <input
                id="invite-password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label" htmlFor="invite-password-confirm">
                Confirm password
              </label>
              <input
                id="invite-password-confirm"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Type the same password again"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              <KeyRound className="h-4 w-4" />
              {isSubmitting ? "Setting up your account..." : "Activate Account"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
