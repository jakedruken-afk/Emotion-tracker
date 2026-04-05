import { z } from "zod";

export const roleOptions = ["patient", "support"] as const;
export type UserRole = (typeof roleOptions)[number];

export const emotionOptions = ["Happy", "Sad", "Angry", "Worried"] as const;
export type EmotionName = (typeof emotionOptions)[number];

export const observationTypeOptions = [
  "Clinical",
  "Behavioral",
  "Progress",
  "Recommendation",
] as const;
export type ObservationType = (typeof observationTypeOptions)[number];

export const priorityOptions = ["Low", "Medium", "High", "Urgent"] as const;
export type ObservationPriority = (typeof priorityOptions)[number];

export const medicationAdherenceOptions = [
  "not_prescribed",
  "took_as_prescribed",
  "missed_some",
  "missed_all",
] as const;
export type MedicationAdherence = (typeof medicationAdherenceOptions)[number];

export const dailyReportTypeOptions = ["morning", "night"] as const;
export type DailyReportType = (typeof dailyReportTypeOptions)[number];

export const dailyReportTypeLabels: Record<DailyReportType, string> = {
  morning: "Morning report",
  night: "Night report",
};

export const sleepQualityOptions = [
  "very_bad",
  "bad",
  "okay",
  "good",
  "very_good",
] as const;
export type SleepQuality = (typeof sleepQualityOptions)[number];

export const sleepQualityLabels: Record<SleepQuality, string> = {
  very_bad: "Very bad",
  bad: "Bad",
  okay: "Okay",
  good: "Good",
  very_good: "Very good",
};

export const medicationAdherenceLabels: Record<MedicationAdherence, string> = {
  not_prescribed: "Not prescribed",
  took_as_prescribed: "Taken as prescribed",
  missed_some: "Missed some",
  missed_all: "Missed all",
};

export const demoAccounts = {
  patient: {
    username: "patient1",
    password: "demo123",
    role: "patient" as const,
    firstName: "John",
    lastName: "Doe",
  },
  support: {
    username: "support1",
    password: "demo123",
    role: "support" as const,
    firstName: "Sarah",
    lastName: "Smith",
  },
};

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const loginRequestSchema = loginSchema.extend({
  expectedRole: z.enum(roleOptions).optional(),
});

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.enum(roleOptions),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

const emotionLocationShape = {
  latitude: z.number().finite().min(-90).max(90).optional().nullable(),
  longitude: z.number().finite().min(-180).max(180).optional().nullable(),
  accuracyMeters: z.number().finite().nonnegative().optional().nullable(),
  locationCapturedAt: z.string().min(1).optional().nullable(),
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const optionalTimeSchema = z
  .string()
  .trim()
  .max(5)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value.length === 0) {
      return null;
    }

    return value;
  })
  .refine((value) => value == null || timePattern.test(value), {
    message: "Please enter a valid time",
  });

const insertEmotionStructuredShape = {
  patientId: z.string().trim().min(1, "Patient ID is required"),
  emotion: z.enum(emotionOptions),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or less")
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      return value.length > 0 ? value : null;
    }),
  sleepHours: z.number().finite().min(0).max(24),
  stressLevel: z.number().int().min(0).max(10),
  cravingLevel: z.number().int().min(0).max(10),
  substanceUseToday: z.boolean(),
  moneyChangedToday: z.boolean(),
  medicationAdherence: z.enum(medicationAdherenceOptions),
};

const emotionStructuredShape = {
  patientId: z.string().trim().min(1, "Patient ID is required"),
  emotion: z.enum(emotionOptions),
  notes: z.string().nullable(),
  sleepHours: z.number().finite().min(0).max(24).nullable(),
  stressLevel: z.number().int().min(0).max(10).nullable(),
  cravingLevel: z.number().int().min(0).max(10).nullable(),
  substanceUseToday: z.boolean().nullable(),
  moneyChangedToday: z.boolean().nullable(),
  medicationAdherence: z.enum(medicationAdherenceOptions).nullable(),
};

const emotionInsertSchemaBase = z.object({
  ...insertEmotionStructuredShape,
  ...emotionLocationShape,
});

const emotionRecordSchemaBase = z.object({
  ...emotionStructuredShape,
  ...emotionLocationShape,
});

function validateEmotionLocation(
  value: z.infer<typeof emotionInsertSchemaBase> | z.infer<typeof emotionRecordSchemaBase>,
  ctx: z.RefinementCtx,
) {
  const hasAnyLocationData =
    value.latitude != null ||
    value.longitude != null ||
    value.accuracyMeters != null ||
    value.locationCapturedAt != null;

  if (!hasAnyLocationData) {
    return;
  }

  if (value.latitude == null || value.longitude == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude are both required when location is included",
      path: ["latitude"],
    });
  }

  if (value.locationCapturedAt == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location capture time is required when location is included",
      path: ["locationCapturedAt"],
    });
  }
}

export const insertEmotionSchema = emotionInsertSchemaBase.superRefine(validateEmotionLocation);

export const emotionSchema = emotionRecordSchemaBase.extend({
  id: z.number().int().positive(),
  timestamp: z.string(),
}).superRefine(validateEmotionLocation);

export type InsertEmotion = z.infer<typeof insertEmotionSchema>;
export type EmotionRecord = z.infer<typeof emotionSchema>;
export type LocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  locationCapturedAt: string;
};

export const insertObservationSchema = z.object({
  patientId: z.string().trim().min(1, "Patient ID is required"),
  observationType: z.enum(observationTypeOptions),
  observation: z
    .string()
    .trim()
    .min(1, "Observation details are required")
    .max(1000, "Observation details must be 1000 characters or less"),
  priority: z.enum(priorityOptions),
  supportWorkerName: z
    .string()
    .trim()
    .min(1, "Support worker name is required")
    .max(100, "Support worker name must be 100 characters or less"),
});

export const observationSchema = insertObservationSchema.extend({
  id: z.number().int().positive(),
  timestamp: z.string(),
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type ObservationRecord = z.infer<typeof observationSchema>;

export const emotionLogSchema = emotionRecordSchemaBase.extend({
  id: z.number().int().positive(),
  timestamp: z.string(),
  observations: z.array(observationSchema),
}).superRefine(validateEmotionLocation);

export type EmotionLog = z.infer<typeof emotionLogSchema>;

const insertDailyReportShape = {
  patientId: z.string().trim().min(1, "Patient ID is required"),
  reportType: z.enum(dailyReportTypeOptions),
  bedTime: optionalTimeSchema,
  wakeTime: optionalTimeSchema,
  sleepQuality: z.enum(sleepQualityOptions).optional().nullable(),
  wakeUps: z.number().int().min(0).max(20).optional().nullable(),
  feltRested: z.boolean().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(300, "Notes must be 300 characters or less")
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      return value.length > 0 ? value : null;
    }),
};

const dailyReportShape = {
  patientId: z.string().trim().min(1, "Patient ID is required"),
  reportType: z.enum(dailyReportTypeOptions),
  bedTime: z.string().regex(timePattern).nullable(),
  wakeTime: z.string().regex(timePattern).nullable(),
  sleepQuality: z.enum(sleepQualityOptions).nullable(),
  wakeUps: z.number().int().min(0).max(20).nullable(),
  feltRested: z.boolean().nullable(),
  notes: z.string().nullable(),
};

function validateDailyReport(
  value: z.infer<typeof insertDailyReportSchemaBase> | z.infer<typeof dailyReportSchemaBase>,
  ctx: z.RefinementCtx,
) {
  if (value.bedTime == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        value.reportType === "night"
          ? "Please enter the time you are going to sleep"
          : "Please enter the time you went to sleep",
      path: ["bedTime"],
    });
  }

  if (value.reportType === "morning") {
    if (value.wakeTime == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter the time you woke up",
        path: ["wakeTime"],
      });
    }

    if (value.sleepQuality == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please tell us how you slept",
        path: ["sleepQuality"],
      });
    }
  }
}

const insertDailyReportSchemaBase = z.object(insertDailyReportShape);
const dailyReportSchemaBase = z.object(dailyReportShape);

export const insertDailyReportSchema = insertDailyReportSchemaBase.superRefine(
  validateDailyReport,
);

export const dailyReportSchema = dailyReportSchemaBase
  .extend({
    id: z.number().int().positive(),
    timestamp: z.string(),
  })
  .superRefine(validateDailyReport);

export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReportRecord = z.infer<typeof dailyReportSchema>;

export const weeklyScreeningAttemptTimingOptions = [
  "none",
  "more_than_year",
  "within_year",
] as const;
export type WeeklyScreeningAttemptTiming =
  (typeof weeklyScreeningAttemptTimingOptions)[number];

export const weeklyScreeningAttemptTimingLabels: Record<
  WeeklyScreeningAttemptTiming,
  string
> = {
  none: "No past attempt",
  more_than_year: "More than a year ago",
  within_year: "Within the last year",
};

export const weeklyScreeningFrequencyOptions = [
  "once",
  "some_days",
  "most_days",
  "every_day",
] as const;
export type WeeklyScreeningFrequency =
  (typeof weeklyScreeningFrequencyOptions)[number];

export const weeklyScreeningFrequencyLabels: Record<
  WeeklyScreeningFrequency,
  string
> = {
  once: "Once",
  some_days: "A few days",
  most_days: "Most days",
  every_day: "Every day",
};

export const appetiteChangeDirectionOptions = [
  "less_than_usual",
  "more_than_usual",
  "up_and_down",
] as const;
export type AppetiteChangeDirection =
  (typeof appetiteChangeDirectionOptions)[number];

export const appetiteChangeDirectionLabels: Record<
  AppetiteChangeDirection,
  string
> = {
  less_than_usual: "Eating less than usual",
  more_than_usual: "Eating more than usual",
  up_and_down: "Going up and down",
};

const optionalShortTextSchema = z
  .string()
  .trim()
  .max(120, "This answer must be 120 characters or less")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const optionalLongTextSchema = z
  .string()
  .trim()
  .max(500, "This answer must be 500 characters or less")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const optionalMedicationTextSchema = z
  .string()
  .trim()
  .max(200, "This answer must be 200 characters or less")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const optionalCarePlanTextSchema = z
  .string()
  .trim()
  .max(1000, "This answer must be 1000 characters or less")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const weeklyScreeningShape = {
  patientId: z.string().trim().min(1, "Patient ID is required"),
  wishedDead: z.boolean(),
  familyBetterOffDead: z.boolean(),
  thoughtsKillingSelf: z.boolean(),
  thoughtsKillingSelfFrequency: z
    .enum(weeklyScreeningFrequencyOptions)
    .optional()
    .nullable(),
  everTriedToKillSelf: z.boolean(),
  attemptTiming: z.enum(weeklyScreeningAttemptTimingOptions),
  currentThoughts: z.boolean().optional().nullable(),
  depressedHardToFunction: z.boolean(),
  depressedFrequency: z.enum(weeklyScreeningFrequencyOptions).optional().nullable(),
  anxiousOnEdge: z.boolean(),
  anxiousFrequency: z.enum(weeklyScreeningFrequencyOptions).optional().nullable(),
  hopeless: z.boolean(),
  couldNotEnjoyThings: z.boolean(),
  keepingToSelf: z.boolean(),
  moreIrritable: z.boolean(),
  substanceUseMoreThanUsual: z.boolean(),
  substanceUseFrequency: z.enum(weeklyScreeningFrequencyOptions).optional().nullable(),
  sleepTrouble: z.boolean(),
  sleepTroubleFrequency: z.enum(weeklyScreeningFrequencyOptions).optional().nullable(),
  appetiteChange: z.boolean(),
  appetiteChangeDirection: z.enum(appetiteChangeDirectionOptions).optional().nullable(),
  supportPerson: optionalShortTextSchema,
  reasonsForLiving: optionalLongTextSchema,
  copingPlan: optionalLongTextSchema,
  needsHelpStayingSafe: z.boolean().optional().nullable(),
};

function validateWeeklyScreening(
  value:
    | z.infer<typeof insertWeeklyScreeningSchemaBase>
    | z.infer<typeof weeklyScreeningSchemaBase>,
  ctx: z.RefinementCtx,
) {
  const hasPositiveAsq =
    value.wishedDead ||
    value.familyBetterOffDead ||
    value.thoughtsKillingSelf ||
    value.everTriedToKillSelf;

  if (!value.everTriedToKillSelf && value.attemptTiming !== "none") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Past-attempt timing only applies when a past attempt was reported",
      path: ["attemptTiming"],
    });
  }

  if (value.everTriedToKillSelf && value.attemptTiming === "none") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us whether the past attempt was within the last year",
      path: ["attemptTiming"],
    });
  }

  if (hasPositiveAsq && value.currentThoughts == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please answer whether you are having thoughts of killing yourself right now",
      path: ["currentThoughts"],
    });
  }

  if (value.thoughtsKillingSelf && value.thoughtsKillingSelfFrequency == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us how often those thoughts happened this week",
      path: ["thoughtsKillingSelfFrequency"],
    });
  }

  if (value.depressedHardToFunction && value.depressedFrequency == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us how often low mood made daily life hard this week",
      path: ["depressedFrequency"],
    });
  }

  if (value.anxiousOnEdge && value.anxiousFrequency == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us how often anxiety made daily life hard this week",
      path: ["anxiousFrequency"],
    });
  }

  if (value.substanceUseMoreThanUsual && value.substanceUseFrequency == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us how often substance or alcohol use was higher this week",
      path: ["substanceUseFrequency"],
    });
  }

  if (value.sleepTrouble && value.sleepTroubleFrequency == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us how often sleep trouble happened this week",
      path: ["sleepTroubleFrequency"],
    });
  }

  if (value.appetiteChange && value.appetiteChangeDirection == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please tell us what kind of appetite change happened this week",
      path: ["appetiteChangeDirection"],
    });
  }
}

const insertWeeklyScreeningSchemaBase = z.object(weeklyScreeningShape);
const weeklyScreeningSchemaBase = z.object(weeklyScreeningShape);

export const insertWeeklyScreeningSchema = insertWeeklyScreeningSchemaBase.superRefine(
  validateWeeklyScreening,
);

export const weeklyScreeningSchema = weeklyScreeningSchemaBase
  .extend({
    id: z.number().int().positive(),
    timestamp: z.string(),
  })
  .superRefine(validateWeeklyScreening);

export type InsertWeeklyScreening = z.infer<typeof insertWeeklyScreeningSchema>;
export type WeeklyScreeningRecord = z.infer<typeof weeklyScreeningSchema>;

export const insertMedicationSchema = z.object({
  patientId: z.string().trim().min(1, "Patient ID is required"),
  medicationName: z
    .string()
    .trim()
    .min(1, "Medication name is required")
    .max(120, "Medication name must be 120 characters or less"),
  dose: optionalMedicationTextSchema,
  schedule: optionalMedicationTextSchema,
  purpose: optionalMedicationTextSchema,
  sideEffects: optionalLongTextSchema,
  adherenceNotes: optionalLongTextSchema,
  isActive: z.boolean(),
  updatedBy: z
    .string()
    .trim()
    .min(1, "Updated by is required")
    .max(100, "Updated by must be 100 characters or less"),
});

export const updateMedicationSchema = insertMedicationSchema.omit({
  patientId: true,
});

export const medicationSchema = z.object({
  id: z.number().int().positive(),
  patientId: z.string().trim().min(1),
  medicationName: z.string(),
  dose: z.string().nullable(),
  schedule: z.string().nullable(),
  purpose: z.string().nullable(),
  sideEffects: z.string().nullable(),
  adherenceNotes: z.string().nullable(),
  isActive: z.boolean(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type UpdateMedication = z.infer<typeof updateMedicationSchema>;
export type MedicationRecord = z.infer<typeof medicationSchema>;

export const insertCarePlanSchema = z.object({
  patientId: z.string().trim().min(1, "Patient ID is required"),
  goals: optionalCarePlanTextSchema,
  triggers: optionalCarePlanTextSchema,
  warningSigns: optionalCarePlanTextSchema,
  whatHelps: optionalCarePlanTextSchema,
  supportContacts: optionalCarePlanTextSchema,
  preferredFollowUpNotes: optionalCarePlanTextSchema,
  updatedBy: z
    .string()
    .trim()
    .min(1, "Updated by is required")
    .max(100, "Updated by must be 100 characters or less"),
});

export const updateCarePlanSchema = insertCarePlanSchema.omit({
  patientId: true,
});

export const carePlanSchema = z.object({
  patientId: z.string().trim().min(1),
  goals: z.string().nullable(),
  triggers: z.string().nullable(),
  warningSigns: z.string().nullable(),
  whatHelps: z.string().nullable(),
  supportContacts: z.string().nullable(),
  preferredFollowUpNotes: z.string().nullable(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InsertCarePlan = z.infer<typeof insertCarePlanSchema>;
export type UpdateCarePlan = z.infer<typeof updateCarePlanSchema>;
export type CarePlanRecord = z.infer<typeof carePlanSchema>;

export const createInviteSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username is required")
    .max(80, "Username must be 80 characters or less"),
  role: z.enum(roleOptions),
  firstName: z
    .string()
    .trim()
    .max(80, "First name must be 80 characters or less")
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      return value.length > 0 ? value : null;
    }),
  lastName: z
    .string()
    .trim()
    .max(80, "Last name must be 80 characters or less")
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      return value.length > 0 ? value : null;
    }),
  assignedStaffUserId: z.number().int().positive().optional().nullable(),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(20, "Invite token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const inviteSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.enum(roleOptions),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  assignedStaffUserId: z.number().int().positive().nullable(),
  createdByUserId: z.number().int().positive(),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
});

export const inviteCreateResponseSchema = inviteSchema.extend({
  activationUrl: z.string().url(),
});

export type CreateInvite = z.infer<typeof createInviteSchema>;
export type AcceptInvite = z.infer<typeof acceptInviteSchema>;
export type InviteRecord = z.infer<typeof inviteSchema>;
export type InviteCreateResponse = z.infer<typeof inviteCreateResponseSchema>;

export const createPatientAssignmentSchema = z.object({
  patientId: z.string().trim().min(1, "Patient ID is required"),
  staffUserId: z.number().int().positive("Staff user is required"),
});

export const patientAssignmentSchema = z.object({
  id: z.number().int().positive(),
  patientId: z.string(),
  staffUserId: z.number().int().positive(),
  createdByUserId: z.number().int().positive(),
  createdAt: z.string(),
});

export type CreatePatientAssignment = z.infer<typeof createPatientAssignmentSchema>;
export type PatientAssignmentRecord = z.infer<typeof patientAssignmentSchema>;

export const updateConsentSchema = z.object({
  moodTracking: z.boolean(),
  sleepReports: z.boolean(),
  weeklyScreening: z.boolean(),
  gpsTracking: z.boolean(),
});

export const consentRecordSchema = updateConsentSchema.extend({
  patientId: z.string().trim().min(1),
  acceptedAt: z.string(),
  updatedAt: z.string(),
});

export type UpdateConsent = z.infer<typeof updateConsentSchema>;
export type ConsentRecord = z.infer<typeof consentRecordSchema>;

export const staffSummarySchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.enum(roleOptions),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

export type StaffSummary = z.infer<typeof staffSummarySchema>;

export const patientSummarySchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.literal("patient"),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  createdAt: z.string(),
  assignedStaffUserIds: z.array(z.number().int().positive()),
  assignedStaffNames: z.array(z.string()),
  consent: consentRecordSchema.nullable(),
});

export type PatientSummary = z.infer<typeof patientSummarySchema>;

export const auditLogSchema = z.object({
  id: z.number().int().positive(),
  actorUserId: z.number().int().positive().nullable(),
  actorRole: z.enum(roleOptions).nullable(),
  actorUsername: z.string().nullable(),
  patientId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  details: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  timestamp: z.string(),
});

export type AuditLogRecord = z.infer<typeof auditLogSchema>;

export function formatDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName.length > 0 ? fullName : user.username;
}

export function getEmotionFlags(entry: {
  sleepHours: number | null;
  stressLevel: number | null;
  cravingLevel: number | null;
  substanceUseToday: boolean | null;
  moneyChangedToday: boolean | null;
  medicationAdherence: MedicationAdherence | null;
}) {
  const flags: string[] = [];

  if (entry.sleepHours != null && entry.sleepHours <= 4) {
    flags.push("low sleep");
  }

  if (entry.stressLevel != null && entry.stressLevel >= 7) {
    flags.push("high stress");
  }

  if (entry.cravingLevel != null && entry.cravingLevel >= 7) {
    flags.push("high craving");
  }

  if (entry.substanceUseToday) {
    flags.push("reported substance use");
  }

  if (entry.moneyChangedToday && entry.cravingLevel != null && entry.cravingLevel >= 7) {
    flags.push("money change with high craving");
  }

  if (
    entry.medicationAdherence === "missed_some" ||
    entry.medicationAdherence === "missed_all"
  ) {
    flags.push("medication adherence concern");
  }

  return flags;
}

export function getCheckInRichness(entry: {
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sleepHours: number | null;
  stressLevel: number | null;
  cravingLevel: number | null;
  substanceUseToday: boolean | null;
  moneyChangedToday: boolean | null;
  medicationAdherence: MedicationAdherence | null;
}) {
  const hasStructuredData =
    entry.sleepHours != null &&
    entry.stressLevel != null &&
    entry.cravingLevel != null &&
    entry.substanceUseToday != null &&
    entry.moneyChangedToday != null &&
    entry.medicationAdherence != null;

  const hasGps = entry.latitude != null && entry.longitude != null;
  const hasSubstantialNote = (entry.notes ?? "").trim().length >= 20;

  if (hasStructuredData && (hasGps || hasSubstantialNote)) {
    return "Corroborated";
  }

  if (hasStructuredData) {
    return "Structured";
  }

  return "Basic";
}
