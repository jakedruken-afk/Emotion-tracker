import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  Copy,
  Link as LinkIcon,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import {
  formatDisplayName,
  type AuthUser,
  type InviteCreateResponse,
  type InviteRecord,
  type PatientSummary,
  type StaffSummary,
} from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";

type AdminUserRecord = {
  id: number;
  email: string;
  name: string;
  role: "patient" | "doctor" | "support_worker";
  clientRole: "patient" | "support";
  patientCode: string | null;
  isActive: boolean;
  isAppAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminOverview = {
  users: AdminUserRecord[];
  patients: PatientSummary[];
  invites: InviteRecord[];
  metrics: {
    totalUsers: number;
    activeUsers: number;
    patients: number;
    pendingInvites: number;
  };
};

type StaffOption = StaffSummary & {
  backendRole?: "doctor" | "support_worker";
  isAppAdmin?: boolean;
};

type AdminPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

const emptyStaffForm = {
  email: "",
  name: "",
  password: "",
  role: "support_worker" as "doctor" | "support_worker",
  isAppAdmin: false,
};

const emptyInviteForm = {
  email: "",
  name: "",
  doctorId: "",
  supportWorkerId: "",
};

export default function AdminPage({ user, onLogout }: AdminPageProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const { toast } = useToast();

  const doctors = useMemo(
    () => staff.filter((member) => member.backendRole === "doctor"),
    [staff],
  );
  const supportWorkers = useMemo(
    () => staff.filter((member) => member.backendRole === "support_worker"),
    [staff],
  );
  const pendingInvites = useMemo(
    () =>
      (overview?.invites ?? []).filter(
        (invite) =>
          invite.acceptedAt == null && new Date(invite.expiresAt).getTime() > Date.now(),
      ),
    [overview?.invites],
  );

  const loadAdmin = async () => {
    setIsLoading(true);
    try {
      const [nextOverview, nextStaff] = await Promise.all([
        apiRequest<AdminOverview>("/api/admin/overview"),
        apiRequest<StaffOption[]>("/api/staff"),
      ]);
      setOverview(nextOverview);
      setStaff(nextStaff);
      setInviteForm((current) => ({
        ...current,
        doctorId: current.doctorId || String(nextStaff.find((member) => member.backendRole === "doctor")?.id ?? ""),
        supportWorkerId:
          current.supportWorkerId ||
          String(nextStaff.find((member) => member.backendRole === "support_worker")?.id ?? ""),
      }));
    } catch (error) {
      toast({
        title: "Could not load admin console",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmin();
  }, []);

  const handleCreateStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingStaff(true);

    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        data: staffForm,
      });
      setStaffForm(emptyStaffForm);
      toast({
        title: "Staff account created",
        description: "The new staff member can now sign in.",
        variant: "success",
      });
      await loadAdmin();
    } catch (error) {
      toast({
        title: "Could not create staff account",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingInvite(true);

    try {
      const invite = await apiRequest<InviteCreateResponse>("/api/invites", {
        method: "POST",
        data: {
          role: "patient",
          email: inviteForm.email,
          name: inviteForm.name,
          doctor_id: Number(inviteForm.doctorId),
          support_worker_id: inviteForm.supportWorkerId ? Number(inviteForm.supportWorkerId) : null,
        },
      });
      setLatestInviteUrl(invite.activationUrl);
      setInviteForm((current) => ({
        ...emptyInviteForm,
        doctorId: current.doctorId,
        supportWorkerId: current.supportWorkerId,
      }));
      toast({
        title: invite.emailDelivery?.status === "sent" ? "Patient invite emailed" : "Patient invite created",
        description:
          invite.emailDelivery?.message ?? "Copy the private activation link and send it securely.",
        variant: "success",
      });
      await loadAdmin();
    } catch (error) {
      toast({
        title: "Could not create patient invite",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleToggleUser = async (target: AdminUserRecord) => {
    try {
      await apiRequest(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        data: { isActive: !target.isActive },
      });
      toast({
        title: target.isActive ? "Account deactivated" : "Account reactivated",
        description: target.email,
        variant: "success",
      });
      await loadAdmin();
    } catch (error) {
      toast({
        title: "Could not update account",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handleCopyInvite = async () => {
    if (!latestInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      toast({
        title: "Invite link copied",
        description: "The activation link is ready to share.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy invite",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  if (!user.isAppAdmin) {
    return (
      <div className="page-shell">
        <section className="panel mx-auto max-w-2xl p-8 text-center">
          <BrandMark variant="compact" align="center" showTagline={false} />
          <h1 className="mt-6 text-3xl font-bold text-slate-900">Admin access required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This signed-in account is not marked as a beta app admin.
          </p>
          <button type="button" className="btn btn-secondary mt-6" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-container flex items-center justify-between gap-4 py-4">
          <BrandMark
            variant="compact"
            showTagline={false}
            context="Beta Admin"
            subtitle={formatDisplayName(user)}
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => void loadAdmin()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="app-container py-6 md:py-8">
        <section className="hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Invite-Only Beta</p>
              <h1 className="hero-title text-balance">
                Manage beta accounts, staff, and patient invites.
              </h1>
              <p className="hero-text">
                Create staff accounts directly, invite patients into the assigned care team, and keep public registration closed.
              </p>
            </div>

            <div className="metric-grid">
              <MetricTile
                label="Total accounts"
                value={overview?.metrics.totalUsers ?? 0}
                detail={`${overview?.metrics.activeUsers ?? 0} active accounts.`}
                tone="sky"
              />
              <MetricTile
                label="Patients"
                value={overview?.metrics.patients ?? 0}
                detail="Created after invite activation."
                tone="mint"
              />
              <MetricTile
                label="Pending invites"
                value={overview?.metrics.pendingInvites ?? 0}
                detail="Waiting for activation."
                tone="gold"
              />
              <MetricTile
                label="Staff"
                value={staff.length}
                detail={`${doctors.length} doctors and ${supportWorkers.length} support workers.`}
                tone="coral"
              />
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="surface-panel">
            <div className="flex items-start gap-3">
              <UserCog className="mt-0.5 h-5 w-5 text-teal-600" />
              <div>
                <h2 className="section-title">Create staff account</h2>
                <p className="section-copy">
                  Add doctors and support workers before creating patient invites.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateStaff}>
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="staff-role">
                    Staff type
                  </label>
                  <select
                    id="staff-role"
                    className="input"
                    value={staffForm.role}
                    onChange={(event) =>
                      setStaffForm((current) => ({
                        ...current,
                        role: event.target.value as "doctor" | "support_worker",
                      }))
                    }
                  >
                    <option value="doctor">Doctor</option>
                    <option value="support_worker">Support worker</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="staff-email">
                    Email
                  </label>
                  <input
                    id="staff-email"
                    className="input"
                    type="email"
                    value={staffForm.email}
                    onChange={(event) =>
                      setStaffForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="label" htmlFor="staff-name">
                    Name
                  </label>
                  <input
                    id="staff-name"
                    className="input"
                    value={staffForm.name}
                    onChange={(event) =>
                      setStaffForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="label" htmlFor="staff-password">
                    Temporary password
                  </label>
                  <input
                    id="staff-password"
                    className="input"
                    type="password"
                    value={staffForm.password}
                    onChange={(event) =>
                      setStaffForm((current) => ({ ...current, password: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={staffForm.isAppAdmin}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, isAppAdmin: event.target.checked }))
                  }
                />
                Give this staff account admin access
              </label>

              <button type="submit" className="btn btn-primary" disabled={isCreatingStaff}>
                <UserPlus className="h-4 w-4" />
                {isCreatingStaff ? "Creating staff..." : "Create Staff Account"}
              </button>
            </form>
          </section>

          <section className="surface-panel">
            <div className="flex items-start gap-3">
              <LinkIcon className="mt-0.5 h-5 w-5 text-sky-600" />
              <div>
                <h2 className="section-title">Create patient invite</h2>
                <p className="section-copy">
                  The patient sets their own password from the activation link.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateInvite}>
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="invite-email">
                    Patient email
                  </label>
                  <input
                    id="invite-email"
                    className="input"
                    type="email"
                    value={inviteForm.email}
                    onChange={(event) =>
                      setInviteForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="label" htmlFor="invite-name">
                    Patient name
                  </label>
                  <input
                    id="invite-name"
                    className="input"
                    value={inviteForm.name}
                    onChange={(event) =>
                      setInviteForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="label" htmlFor="invite-doctor">
                    Assigned doctor
                  </label>
                  <select
                    id="invite-doctor"
                    className="input"
                    value={inviteForm.doctorId}
                    onChange={(event) =>
                      setInviteForm((current) => ({ ...current, doctorId: event.target.value }))
                    }
                  >
                    <option value="">Choose a doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {formatDisplayName(doctor)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="invite-support">
                    Assigned support worker
                  </label>
                  <select
                    id="invite-support"
                    className="input"
                    value={inviteForm.supportWorkerId}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        supportWorkerId: event.target.value,
                      }))
                    }
                  >
                    <option value="">None yet</option>
                    {supportWorkers.map((supportWorker) => (
                      <option key={supportWorker.id} value={supportWorker.id}>
                        {formatDisplayName(supportWorker)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isCreatingInvite}>
                <Send className="h-4 w-4" />
                {isCreatingInvite ? "Creating invite..." : "Create Patient Invite"}
              </button>
            </form>

            {latestInviteUrl ? (
              <div className="mt-6 rounded-[24px] border border-teal-200 bg-teal-50 px-5 py-5">
                <p className="mini-heading">Latest activation link</p>
                <p className="mt-3 break-all text-sm leading-6 text-slate-700">
                  {latestInviteUrl}
                </p>
                <button type="button" className="btn btn-secondary mt-4" onClick={handleCopyInvite}>
                  <Copy className="h-4 w-4" />
                  Copy Invite Link
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <section className="surface-panel mt-6">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="section-title">Accounts</h2>
              <p className="section-copy">
                Review beta accounts and temporarily deactivate access if needed.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {isLoading ? (
              <EmptyPanel message="Loading accounts..." />
            ) : overview?.users.length ? (
              overview.users.map((account) => (
                <div key={account.id} className="timeline-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {account.email} · {account.role.replace("_", " ")} · added{" "}
                        {format(new Date(account.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {account.isAppAdmin ? (
                        <span className="badge bg-teal-100 text-teal-900">Admin</span>
                      ) : null}
                      <span
                        className={`badge ${
                          account.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void handleToggleUser(account)}
                      >
                        {account.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyPanel message="No accounts found yet." />
            )}
          </div>
        </section>

        <section className="surface-panel mt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="section-title">Pending invites</h2>
              <p className="section-copy">
                These links have not been accepted yet.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {pendingInvites.length > 0 ? (
              pendingInvites.map((invite) => (
                <div key={invite.id} className="timeline-card">
                  <p className="text-sm font-semibold text-slate-900">{invite.username}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {invite.role === "patient" ? "Patient invite" : "Staff invite"} · expires{" "}
                    {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                  </p>
                </div>
              ))
            ) : (
              <EmptyPanel message="No pending invites." />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}
