import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Copy,
  LogOut,
  Send,
  ShieldCheck,
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
  type UserRole,
} from "@shared/contracts";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";

type SupportAccessPageProps = {
  user: AuthUser;
  onLogout: () => void;
  onBack: () => void;
};

type InviteFormState = {
  role: UserRole;
  username: string;
  firstName: string;
  lastName: string;
  assignedStaffUserId: string;
};

type AssignmentFormState = {
  patientId: string;
  staffUserId: string;
};

function createEmptyInviteForm(currentUserId: number): InviteFormState {
  return {
    role: "patient",
    username: "",
    firstName: "",
    lastName: "",
    assignedStaffUserId: String(currentUserId),
  };
}

export default function SupportAccessPage({
  user,
  onLogout,
  onBack,
}: SupportAccessPageProps) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [staff, setStaff] = useState<StaffSummary[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(() =>
    createEmptyInviteForm(user.id),
  );
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    patientId: "",
    staffUserId: String(user.id),
  });
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const { toast } = useToast();

  const pendingInvites = useMemo(
    () =>
      invites.filter(
        (invite) =>
          invite.acceptedAt == null && new Date(invite.expiresAt).getTime() > Date.now(),
      ),
    [invites],
  );

  const loadAccessData = async () => {
    setIsLoading(true);

    try {
      const [nextPatients, nextStaff, nextInvites] = await Promise.all([
        apiRequest<PatientSummary[]>("/api/patients"),
        apiRequest<StaffSummary[]>("/api/staff"),
        apiRequest<InviteRecord[]>("/api/invites"),
      ]);

      setPatients(nextPatients);
      setStaff(nextStaff);
      setInvites(nextInvites);
      setAssignmentForm((current) => ({
        patientId: current.patientId || nextPatients[0]?.username || "",
        staffUserId: current.staffUserId || String(user.id),
      }));
    } catch (error) {
      toast({
        title: "Could not load access management",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccessData();
  }, []);

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingInvite(true);

    try {
      const invite = await apiRequest<InviteCreateResponse>("/api/invites", {
        method: "POST",
        data: {
          role: inviteForm.role,
          username: inviteForm.username,
          firstName: inviteForm.firstName,
          lastName: inviteForm.lastName,
          assignedStaffUserId:
            inviteForm.role === "patient" && inviteForm.assignedStaffUserId
              ? Number(inviteForm.assignedStaffUserId)
              : null,
        },
      });

      setLatestInviteUrl(invite.activationUrl);
      setInviteForm(createEmptyInviteForm(user.id));
      toast({
        title: "Invite created",
        description: "Copy the activation link and send it to the person you invited.",
        variant: "success",
      });
      await loadAccessData();
    } catch (error) {
      toast({
        title: "Could not create the invite",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCreateAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingAssignment(true);

    try {
      await apiRequest("/api/patient-assignments", {
        method: "POST",
        data: {
          patientId: assignmentForm.patientId,
          staffUserId: Number(assignmentForm.staffUserId),
        },
      });

      toast({
        title: "Assignment saved",
        description: "The staff-to-patient assignment has been updated.",
        variant: "success",
      });
      await loadAccessData();
    } catch (error) {
      toast({
        title: "Could not save the assignment",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingAssignment(false);
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
        description: "The activation link is ready to share securely.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy the invite link",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-container flex items-center justify-between gap-4 py-4">
          <BrandMark
            variant="compact"
            showTagline={false}
            context="Access Management"
            subtitle={formatDisplayName(user)}
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to Support
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
              <p className="eyebrow">Pilot Onboarding</p>
              <h1 className="hero-title text-balance">
                Manage invites, assignments, and consent status in one place.
              </h1>
              <p className="hero-text">
                This workspace is meant for private pilot setup. Create clinician-invite-only
                accounts, share patients with the right staff, and confirm who in your caseload
                has already completed consent.
              </p>
            </div>

            <div className="metric-grid">
              <MetricTile
                label="Patients"
                value={patients.length}
                detail="Patient accounts currently assigned to you."
                tone="mint"
              />
              <MetricTile
                label="Staff"
                value={staff.length}
                detail="Support and clinician-facing staff accounts."
                tone="sky"
              />
              <MetricTile
                label="Pending invites"
                value={pendingInvites.length}
                detail="Invite links you created or that route to your caseload."
                tone="gold"
              />
              <MetricTile
                label="Consented patients"
                value={patients.filter((patient) => patient.consent != null).length}
                detail="Assigned patients who have completed the in-app consent step."
                tone="coral"
              />
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="surface-panel">
            <div className="flex items-start gap-3">
              <UserPlus className="mt-0.5 h-5 w-5 text-teal-600" />
              <div>
                <h2 className="section-title">Create a secure invite</h2>
                <p className="section-copy">
                  Invite patient or staff accounts without exposing a shared demo password.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateInvite}>
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="invite-role">
                    Account type
                  </label>
                  <select
                    id="invite-role"
                    className="input"
                    value={inviteForm.role}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        role: event.target.value as UserRole,
                      }))
                    }
                  >
                    <option value="patient">Patient</option>
                    <option value="support">Support / clinician</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="invite-username">
                    Username / patient ID
                  </label>
                  <input
                    id="invite-username"
                    className="input"
                    value={inviteForm.username}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    placeholder="Example: patient2"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="invite-first-name">
                    First name
                  </label>
                  <input
                    id="invite-first-name"
                    className="input"
                    value={inviteForm.firstName}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="invite-last-name">
                    Last name
                  </label>
                  <input
                    id="invite-last-name"
                    className="input"
                    value={inviteForm.lastName}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </div>
                {inviteForm.role === "patient" ? (
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="invite-assigned-staff">
                      Assigned staff
                    </label>
                    <select
                      id="invite-assigned-staff"
                      className="input"
                      value={inviteForm.assignedStaffUserId}
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          assignedStaffUserId: event.target.value,
                        }))
                      }
                    >
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatDisplayName(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <button type="submit" className="btn btn-primary" disabled={isCreatingInvite}>
                <Send className="h-4 w-4" />
                {isCreatingInvite ? "Creating invite..." : "Create Invite"}
              </button>
            </form>

            {latestInviteUrl ? (
              <div className="mt-6 rounded-[24px] border border-teal-200 bg-teal-50 px-5 py-5">
                <p className="mini-heading">Latest activation link</p>
                <p className="mt-3 break-all text-sm leading-6 text-slate-700">
                  {latestInviteUrl}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="btn btn-secondary" onClick={handleCopyInvite}>
                    <Copy className="h-4 w-4" />
                    Copy Invite Link
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="surface-panel">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-sky-600" />
              <div>
                <h2 className="section-title">Assign patients to staff</h2>
                <p className="section-copy">
                  Use this when a patient already assigned to you should also be visible to
                  another support or clinician account.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateAssignment}>
              <div>
                <label className="label" htmlFor="assignment-patient">
                  Patient
                </label>
                <select
                  id="assignment-patient"
                  className="input"
                  value={assignmentForm.patientId}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      patientId: event.target.value,
                    }))
                  }
                >
                  <option value="">Choose a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.username} value={patient.username}>
                      {formatDisplayName(patient)} ({patient.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="assignment-staff">
                  Staff member
                </label>
                <select
                  id="assignment-staff"
                  className="input"
                  value={assignmentForm.staffUserId}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      staffUserId: event.target.value,
                    }))
                  }
                >
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {formatDisplayName(member)}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isSavingAssignment}>
                <ShieldCheck className="h-4 w-4" />
                {isSavingAssignment ? "Saving assignment..." : "Save Assignment"}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="mini-heading">Pending invites</p>
              {isLoading ? (
                <EmptyPanel message="Loading invites..." />
              ) : pendingInvites.length > 0 ? (
                pendingInvites.slice(0, 6).map((invite) => (
                  <div key={invite.id} className="timeline-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {invite.username}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {invite.role === "patient" ? "Patient invite" : "Support invite"} ·
                          expires {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <span className="badge bg-amber-100 text-amber-900">Pending</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel message="No live invite links are waiting to be accepted." />
              )}
            </div>
          </section>
        </div>

        <section className="surface-panel mt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="section-title">Patients and consent status</h2>
              <p className="section-copy">
                Watch assignment coverage and see which assigned patients have already completed
                consent.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {isLoading ? (
              <EmptyPanel message="Loading patient records..." />
            ) : patients.length > 0 ? (
              patients.map((patient) => (
                <div key={patient.username} className="timeline-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {formatDisplayName(patient)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {patient.username} · added {format(new Date(patient.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        patient.consent
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {patient.consent ? "Consent complete" : "Consent pending"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {patient.assignedStaffNames.length > 0 ? (
                      patient.assignedStaffNames.map((staffName) => (
                        <span key={`${patient.username}-${staffName}`} className="badge bg-sky-100 text-sky-900">
                          {staffName}
                        </span>
                      ))
                    ) : (
                      <span className="badge bg-rose-100 text-rose-900">No staff assigned</span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <InfoTile
                      label="Mood consent"
                      value={patient.consent?.moodTracking ? "Yes" : "No"}
                    />
                    <InfoTile
                      label="Sleep consent"
                      value={patient.consent?.sleepReports ? "Yes" : "No"}
                    />
                    <InfoTile
                      label="Weekly screen consent"
                      value={patient.consent?.weeklyScreening ? "Yes" : "No"}
                    />
                    <InfoTile
                      label="GPS consent"
                      value={patient.consent?.gpsTracking ? "Yes" : "No"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyPanel message="No patient accounts exist yet. Create the first invite to get started." />
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
