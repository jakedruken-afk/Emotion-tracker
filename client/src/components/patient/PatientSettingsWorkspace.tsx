import { format } from "date-fns";
import {
  Accessibility,
  BookOpen,
  CheckCircle2,
  MonitorCheck,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import {
  formatDisplayName,
  type AuthUser,
  type ConsentRecord,
} from "@shared/contracts";

export type PatientLocalSettings = {
  largerText: boolean;
  reduceMotion: boolean;
  tutorialOnLogin: boolean;
};

type PatientSettingsWorkspaceProps = {
  user: AuthUser;
  consent: ConsentRecord | null;
  isOnline: boolean;
  lastSyncedAt: string | null;
  pendingSyncCount: number;
  settings: PatientLocalSettings;
  onSettingsChange: (nextSettings: PatientLocalSettings) => void;
  onOpenTutorial: () => void;
  onResetTutorial: () => void;
};

export default function PatientSettingsWorkspace({
  user,
  consent,
  isOnline,
  lastSyncedAt,
  pendingSyncCount,
  settings,
  onSettingsChange,
  onOpenTutorial,
  onResetTutorial,
}: PatientSettingsWorkspaceProps) {
  return (
    <div className="content-stack">
      <section className="hero-panel">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Settings</p>
            <h3 className="hero-title text-balance">
              Adjust the patient workspace and find help when you need it.
            </h3>
            <p className="hero-text">
              These settings stay on this device for now. Your privacy consent and submitted
              care entries are still handled by the secure L.A.M.B backend.
            </p>
          </div>

          <div className="metric-grid">
            <SettingsSummaryTile
              label="Signed in as"
              value={formatDisplayName(user)}
              detail={user.username}
              Icon={ShieldCheck}
            />
            <SettingsSummaryTile
              label="Connection"
              value={isOnline ? "Online" : "Offline"}
              detail={
                pendingSyncCount > 0
                  ? `${pendingSyncCount} item${pendingSyncCount === 1 ? "" : "s"} waiting to sync`
                  : "No saved items are waiting"
              }
              Icon={isOnline ? Wifi : WifiOff}
            />
            <SettingsSummaryTile
              label="Last sync"
              value={formatSyncValue(lastSyncedAt)}
              detail="Shown from this device session"
              Icon={MonitorCheck}
            />
            <SettingsSummaryTile
              label="Tutorial"
              value={settings.tutorialOnLogin ? "Shows on login" : "Manual"}
              detail="You can reopen it anytime"
              Icon={BookOpen}
            />
          </div>
        </div>
      </section>

      <div className="content-grid">
        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <Accessibility className="h-5 w-5 text-teal-600" />
            <div>
              <h3 className="section-title text-lg">Comfort settings</h3>
              <p className="section-copy">Change how the app feels on this device.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <SettingsToggle
              title="Larger comfort text"
              description="Slightly increases patient workspace text size for easier reading."
              checked={settings.largerText}
              onChange={(checked) => onSettingsChange({ ...settings, largerText: checked })}
            />
            <SettingsToggle
              title="Reduce motion"
              description="Minimizes hover movement and animation effects."
              checked={settings.reduceMotion}
              onChange={(checked) => onSettingsChange({ ...settings, reduceMotion: checked })}
            />
            <SettingsToggle
              title="Show tutorial after sign-in"
              description="Opens the tutorial automatically whenever this account signs in on this device."
              checked={settings.tutorialOnLogin}
              onChange={(checked) => onSettingsChange({ ...settings, tutorialOnLogin: checked })}
            />
          </div>
        </section>

        <div className="content-stack mt-0">
          <section className="surface-panel">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="section-title text-lg">Tutorial and help</h3>
                <p className="section-copy">Use this if you forget where something is.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn btn-primary" onClick={onOpenTutorial}>
                <BookOpen className="h-4 w-4" />
                Open Tutorial
              </button>
              <button type="button" className="btn btn-secondary" onClick={onResetTutorial}>
                Show Again Next Login
              </button>
            </div>

            <div className="mt-5 rounded-[22px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm leading-6 text-slate-700">
              The tutorial explains Daily Check-In, Sleep Reports, Weekly Screen, History, and
              this Settings area in plain language.
            </div>
          </section>

          <section className="surface-panel">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="section-title text-lg">Privacy and safety reminders</h3>
                <p className="section-copy">A quick summary of the consent choices on file.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <ConsentStatus label="Mood tracking" accepted={Boolean(consent?.moodTracking)} />
              <ConsentStatus label="Sleep reports" accepted={Boolean(consent?.sleepReports)} />
              <ConsentStatus
                label="Weekly safety screens"
                accepted={Boolean(consent?.weeklyScreening)}
              />
              <ConsentStatus
                label="Optional GPS snapshots"
                accepted={Boolean(consent?.gpsTracking)}
                optional
              />
              <ConsentStatus
                label="Staffed-hours limit acknowledged"
                accepted={Boolean(consent?.acknowledgeStaffedHours)}
              />
              <ConsentStatus
                label="Emergency-care limit acknowledged"
                accepted={Boolean(consent?.acknowledgeEmergencyLimits)}
              />
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Last consent update: {formatDateTime(consent?.updatedAt)}
            </p>
          </section>

          <section className="surface-panel border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-1 h-5 w-5 text-amber-700" />
              <div>
                <h3 className="section-title text-lg">Pilot limits</h3>
                <p className="section-copy text-amber-900">
                  L.A.M.B is not 24/7 emergency monitoring. If there is immediate danger,
                  contact emergency services or go to the nearest emergency department.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsSummaryTile({
  label,
  value,
  detail,
  Icon,
}: {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between gap-3">
        <p className="metric-label">{label}</p>
        <Icon className="h-4 w-4 text-teal-600" />
      </div>
      <p className="metric-value text-xl md:text-2xl">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function SettingsToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
      <span>
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block leading-6 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ConsentStatus({
  label,
  accepted,
  optional = false,
}: {
  label: string;
  accepted: boolean;
  optional?: boolean;
}) {
  return (
    <div className="summary-row">
      <span className="flex items-center gap-2">
        <CheckCircle2
          className={`h-4 w-4 ${accepted ? "text-emerald-600" : "text-slate-300"}`}
        />
        {label}
      </span>
      <strong>{accepted ? "On" : optional ? "Off" : "Needed"}</strong>
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return format(date, "MMM d, yyyy 'at' h:mm a");
}

function formatSyncValue(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not yet";
  }

  return format(date, "MMM d");
}
