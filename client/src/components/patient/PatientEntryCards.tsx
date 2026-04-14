import { format } from "date-fns";
import { MapPin, Shield } from "lucide-react";
import {
  dailyReportTypeLabels,
  getCheckInRichness,
  getEmotionFlags,
  medicationAdherenceLabels,
  sleepQualityLabels,
  type DailyReportRecord,
  type EmotionName,
  type EmotionRecord,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningFollowUpDetails,
  getWeeklyScreeningSignals,
} from "@shared/weeklyScreening";
import {
  buildMapsUrl,
  formatCoordinates,
} from "../../lib/location";
import {
  formatClockTime,
  getSleepDurationHours,
} from "../../lib/dailyReports";

const emotionMeta: Record<
  EmotionName,
  {
    emoji: string;
    badgeClass: string;
  }
> = {
  Happy: {
    emoji: "\u{1F60A}",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  Sad: {
    emoji: "\u{1F622}",
    badgeClass: "bg-sky-100 text-sky-800",
  },
  Angry: {
    emoji: "\u{1F620}",
    badgeClass: "bg-rose-100 text-rose-800",
  },
  Worried: {
    emoji: "\u{1F630}",
    badgeClass: "bg-amber-100 text-amber-800",
  },
};

export function EmotionEntryCard({
  entry,
  compact = false,
}: {
  entry: EmotionRecord;
  compact?: boolean;
}) {
  return (
    <div className="timeline-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{emotionMeta[entry.emotion].emoji}</div>
          <div>
            <p className="text-base font-semibold text-slate-900">{entry.emotion}</p>
            <p className="text-sm text-slate-500">
              {format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <span className={`badge ${emotionMeta[entry.emotion].badgeClass}`}>{entry.emotion}</span>
      </div>

      {entry.notes ? (
        <p className="mt-3 rounded-[20px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {compact ? truncate(entry.notes, 110) : entry.notes}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-slate-400">No note added for this check-in.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="badge bg-slate-100 text-slate-700">
          Data: {getCheckInRichness(entry)}
        </span>
        <span className="badge bg-slate-100 text-slate-700">
          Reliability: {entry.reliabilityLevel}
        </span>
        {entry.editCount > 0 ? (
          <span className="badge bg-amber-100 text-amber-900">
            Edited {entry.editCount} time{entry.editCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {entry.crisisLevel !== "none" ? (
          <span className="badge bg-rose-100 text-rose-900">
            {entry.crisisLevel === "critical" ? "Critical alert" : "Safety alert"}
          </span>
        ) : null}
        {entry.sleepHours != null ? (
          <span className="badge bg-violet-50 text-violet-800">Sleep {entry.sleepHours}h</span>
        ) : null}
        {entry.stressLevel != null ? (
          <span className="badge bg-rose-50 text-rose-800">Stress {entry.stressLevel}/10</span>
        ) : null}
        {entry.cravingLevel != null ? (
          <span className="badge bg-amber-50 text-amber-800">Cravings {entry.cravingLevel}/10</span>
        ) : null}
        {entry.medicationAdherence != null ? (
          <span className="badge bg-emerald-50 text-emerald-800">
            Meds {medicationAdherenceLabels[entry.medicationAdherence]}
          </span>
        ) : null}
        {entry.missedMedicationName ? (
          <span className="badge bg-amber-50 text-amber-900">
            Missed: {entry.missedMedicationName}
          </span>
        ) : null}
      </div>

      {entry.crisisSummary ? (
        <p className="mt-3 rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {entry.crisisSummary}
        </p>
      ) : null}

      {!compact ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {entry.substanceUseToday != null ? (
              <span>Substances today: {entry.substanceUseToday ? "Yes" : "No"}</span>
            ) : null}
            {entry.moneyChangedToday != null ? (
              <span>Got or spent a lot of money: {entry.moneyChangedToday ? "Yes" : "No"}</span>
            ) : null}
          </div>

          {getEmotionFlags(entry).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {getEmotionFlags(entry).map((flag) => (
                <span key={flag} className="badge bg-amber-100 text-amber-900">
                  Follow up: {flag}
                </span>
              ))}
            </div>
          ) : null}

          {entry.latitude != null && entry.longitude != null ? (
            <div className="mt-3 rounded-[20px] border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-semibold">Location captured</span>
                <span>{formatCoordinates(entry.latitude, entry.longitude)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-sky-800">
                {entry.accuracyMeters != null ? (
                  <span>Accuracy +/- {Math.round(entry.accuracyMeters)} m</span>
                ) : null}
                {entry.locationCapturedAt ? (
                  <span>
                    {format(
                      new Date(entry.locationCapturedAt),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </span>
                ) : null}
                <a
                  href={buildMapsUrl(entry.latitude, entry.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  Open map
                </a>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function DailyReportCard({ report }: { report: DailyReportRecord }) {
  const sleepDuration = getSleepDurationHours(report.bedTime, report.wakeTime);

  return (
    <div className="timeline-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">
              {dailyReportTypeLabels[report.reportType]}
            </p>
            <span className="badge bg-slate-100 text-slate-700">
              {format(new Date(report.timestamp), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {report.reportType === "morning"
              ? "Morning sleep check-in"
              : "Tonight's bedtime plan"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {report.bedTime ? (
          <span className="badge bg-indigo-50 text-indigo-800">
            Sleep time {formatClockTime(report.bedTime)}
          </span>
        ) : null}
        {report.wakeTime ? (
          <span className="badge bg-sky-50 text-sky-800">
            Wake time {formatClockTime(report.wakeTime)}
          </span>
        ) : null}
        {sleepDuration != null ? (
          <span className="badge bg-violet-50 text-violet-800">
            Around {sleepDuration.toFixed(1)} hours
          </span>
        ) : null}
        {report.sleepQuality ? (
          <span className="badge bg-emerald-50 text-emerald-800">
            Slept {sleepQualityLabels[report.sleepQuality]}
          </span>
        ) : null}
        {report.wakeUps != null ? (
          <span className="badge bg-amber-50 text-amber-800">
            Wake-ups {report.wakeUps}
          </span>
        ) : null}
        {report.feltRested != null ? (
          <span className="badge bg-rose-50 text-rose-800">
            Felt rested: {report.feltRested ? "Yes" : "No"}
          </span>
        ) : null}
        {report.mealsCount != null ? (
          <span className="badge bg-amber-50 text-amber-800">
            Meals {report.mealsCount}
          </span>
        ) : null}
        <span className="badge bg-slate-100 text-slate-700">
          Reliability {report.reliabilityLevel}
        </span>
        {report.editCount > 0 ? (
          <span className="badge bg-amber-100 text-amber-900">
            Edited {report.editCount} time{report.editCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {report.crisisLevel !== "none" ? (
          <span className="badge bg-rose-100 text-rose-900">
            {report.crisisLevel === "critical" ? "Critical alert" : "Safety alert"}
          </span>
        ) : null}
      </div>

      {report.notes ? (
        <p className="mt-3 rounded-[20px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {report.notes}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-slate-400">No extra note added for this report.</p>
      )}

      {report.mealsNote ? (
        <p className="mt-3 rounded-[20px] bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Meals note: {report.mealsNote}
        </p>
      ) : null}

      {report.crisisSummary ? (
        <p className="mt-3 rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {report.crisisSummary}
        </p>
      ) : null}
    </div>
  );
}

export function WeeklyScreeningCard({
  screening,
  compact = false,
}: {
  screening: WeeklyScreeningRecord;
  compact?: boolean;
}) {
  const disposition = getWeeklyScreeningDisposition(screening);
  const signals = getWeeklyScreeningSignals(screening);
  const followUpDetails = getWeeklyScreeningFollowUpDetails(screening);
  const badgeClass =
    disposition === "urgent"
      ? "bg-rose-100 text-rose-900"
      : disposition === "positive"
        ? "bg-amber-100 text-amber-900"
        : disposition === "history"
          ? "bg-sky-100 text-sky-900"
          : "bg-emerald-100 text-emerald-900";

  return (
    <div className="timeline-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">Weekly safety screen</p>
            <p className="text-sm text-slate-500">
              {format(new Date(screening.timestamp), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <span className={`badge ${badgeClass}`}>
          {getWeeklyScreeningDispositionLabel(disposition)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="badge bg-slate-100 text-slate-700">
          Current thoughts: {screening.currentThoughts == null ? "Not asked" : screening.currentThoughts ? "Yes" : "No"}
        </span>
        <span className="badge bg-slate-100 text-slate-700">
          Help staying safe: {screening.needsHelpStayingSafe == null ? "Not answered" : screening.needsHelpStayingSafe ? "Yes" : "No"}
        </span>
        <span className="badge bg-slate-100 text-slate-700">
          Reliability {screening.reliabilityLevel}
        </span>
        {screening.editCount > 0 ? (
          <span className="badge bg-amber-100 text-amber-900">
            Edited {screening.editCount} time{screening.editCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {signals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {signals.slice(0, compact ? 3 : 6).map((signal) => (
            <span key={signal} className="badge bg-amber-50 text-amber-900">
              {signal}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-slate-400">
          No extra weekly screening signals were flagged.
        </p>
      )}

      {!compact ? (
        <>
          {screening.crisisSummary ? (
            <p className="mt-3 rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {screening.crisisSummary}
            </p>
          ) : null}

          {followUpDetails.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {followUpDetails.map((detail) => (
                <span key={detail} className="badge bg-sky-100 text-sky-900">
                  {detail}
                </span>
              ))}
            </div>
          ) : null}

          {screening.supportPerson ? (
            <p className="mt-3 rounded-[20px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Support person: {screening.supportPerson}
            </p>
          ) : null}

          {screening.reasonsForLiving ? (
            <p className="mt-3 rounded-[20px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Reasons for staying safe: {screening.reasonsForLiving}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
      {message}
    </div>
  );
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}
