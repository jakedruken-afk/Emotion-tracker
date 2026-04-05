import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  acceptInviteSchema,
  authUserSchema,
  carePlanSchema,
  consentRecordSchema,
  createInviteSchema,
  createPatientAssignmentSchema,
  dailyReportSchema,
  emotionLogSchema,
  insertCarePlanSchema,
  insertDailyReportSchema,
  insertEmotionSchema,
  insertMedicationSchema,
  insertObservationSchema,
  insertWeeklyScreeningSchema,
  inviteCreateResponseSchema,
  inviteSchema,
  loginRequestSchema,
  medicationSchema,
  observationSchema,
  patientAssignmentSchema,
  patientSummarySchema,
  staffSummarySchema,
  updateCarePlanSchema,
  updateConsentSchema,
  updateMedicationSchema,
  weeklyScreeningSchema,
  type AuthUser,
} from "../shared/contracts";
import {
  assertPatientAccess,
  clearSessionCookie,
  createAuditLog,
  createInvite,
  createPatientAssignment,
  getAllowedPatientIds,
  getConsentByPatientId,
  getPatientSummaries,
  getRequestMetadata,
  getStaffUsers,
  listInvites,
  loginWithPassword,
  logoutCurrentSession,
  requireAuth,
  requireRole,
  setSessionCookie,
  upsertConsent,
  acceptInvite,
} from "./auth";
import { db } from "./db";
import { storage } from "./storage";

function getZodMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(", ");
}

function getRequestUser(req: Request) {
  if (!req.sessionUser) {
    throw new Error("Missing authenticated user");
  }

  return req.sessionUser;
}

async function ensurePatientAccess(
  req: Request,
  res: Response,
  patientId: string,
) {
  if (!req.sessionUser) {
    res.status(401).json({ message: "Please sign in to continue" });
    return false;
  }

  const allowed = await assertPatientAccess(req.sessionUser, patientId);
  if (!allowed) {
    res.status(403).json({ message: "You do not have access to this patient" });
    return false;
  }

  return true;
}

async function requireConsent(
  req: Request,
  res: Response,
  patientId: string,
  consentKey: "moodTracking" | "sleepReports" | "weeklyScreening",
  failureMessage: string,
) {
  const consent = await getConsentByPatientId(patientId);
  if (!consent || !consent[consentKey]) {
    res.status(403).json({ message: failureMessage });
    return false;
  }

  return consent;
}

async function logView(
  req: Request,
  action: string,
  entityType: string,
  patientId: string | null,
  details: Record<string, unknown> | null = null,
) {
  if (!req.sessionUser) {
    return;
  }

  const metadata = getRequestMetadata(req);
  await createAuditLog({
    actorUserId: req.sessionUser.id,
    actorRole: req.sessionUser.role,
    actorUsername: req.sessionUser.username,
    patientId,
    action,
    entityType,
    entityId: patientId,
    details: details ? JSON.stringify(details) : null,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    try {
      const check = db.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;
      return res.json({
        status: check?.ok === 1 ? "ok" : "degraded",
        serverTime: new Date().toISOString(),
      });
    } catch {
      return res.status(500).json({
        status: "error",
        serverTime: new Date().toISOString(),
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { expectedRole, username, password } = loginRequestSchema.parse(req.body);
      const authResult = await loginWithPassword(
        username,
        password,
        expectedRole,
        getRequestMetadata(req),
      );

      if (!authResult) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      setSessionCookie(res, authResult.sessionToken);
      return res.json(authUserSchema.parse(authResult.user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await logoutCurrentSession(req);
      clearSessionCookie(res);
      return res.status(204).send();
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    return res.json(authUserSchema.parse(getRequestUser(req)));
  });

  app.post("/api/invites/accept", async (req, res) => {
    try {
      const { token, password } = acceptInviteSchema.parse(req.body);
      const authResult = await acceptInvite(token, password, getRequestMetadata(req));
      setSessionCookie(res, authResult.sessionToken);
      return res.status(201).json(authUserSchema.parse(authResult.user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/consent/me", requireRole("patient"), async (req, res) => {
    try {
      const user = getRequestUser(req);
      const consent = await getConsentByPatientId(user.username);
      await logView(req, "consent.view.self", "consent_record", user.username);
      return res.json(consent ? consentRecordSchema.parse(consent) : null);
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/consent/me", requireRole("patient"), async (req, res) => {
    try {
      const user = getRequestUser(req);
      const consentInput = updateConsentSchema.parse(req.body);
      const savedConsent = await upsertConsent(
        user.username,
        consentInput,
        user,
        getRequestMetadata(req),
      );
      return res.json(consentRecordSchema.parse(savedConsent));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/patients", requireRole("support"), async (req, res) => {
    try {
      const patients = await getPatientSummaries(getRequestUser(req));
      await logView(req, "patient.list.view", "patient", null, {
        total: patients.length,
      });
      return res.json(patients.map((patient) => patientSummarySchema.parse(patient)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/staff", requireRole("support"), async (req, res) => {
    try {
      const staff = await getStaffUsers();
      return res.json(staff.map((member) => staffSummarySchema.parse(member)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/invites", requireRole("support"), async (req, res) => {
    try {
      const invites = await listInvites(getRequestUser(req));
      return res.json(invites.map((invite) => inviteSchema.parse(invite)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/invites", requireRole("support"), async (req, res) => {
    try {
      const inviteInput = createInviteSchema.parse(req.body);
      const invite = await createInvite(
        inviteInput,
        getRequestUser(req),
        getRequestMetadata(req),
      );
      return res.status(201).json(inviteCreateResponseSchema.parse(invite));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/patient-assignments", requireRole("support"), async (req, res) => {
    try {
      const assignmentInput = createPatientAssignmentSchema.parse(req.body);
      const assignment = await createPatientAssignment(
        assignmentInput,
        getRequestUser(req),
        getRequestMetadata(req),
      );
      return res.status(201).json(patientAssignmentSchema.parse(assignment));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/emotions", requireRole("patient"), async (req, res) => {
    try {
      const emotion = insertEmotionSchema.parse(req.body);
      const user = getRequestUser(req);

      if (emotion.patientId !== user.username) {
        return res.status(403).json({ message: "Patients can only write their own entries" });
      }

      const consent = await requireConsent(
        req,
        res,
        emotion.patientId,
        "moodTracking",
        "Mood tracking consent is required before saving entries",
      );

      if (!consent) {
        return;
      }

      const includesLocation =
        emotion.latitude != null ||
        emotion.longitude != null ||
        emotion.accuracyMeters != null ||
        emotion.locationCapturedAt != null;

      if (includesLocation && !consent.gpsTracking) {
        return res
          .status(403)
          .json({ message: "GPS consent is required before saving location data" });
      }

      const createdEmotion = await storage.createEmotion(emotion);
      await createAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        actorUsername: user.username,
        patientId: emotion.patientId,
        action: "emotion.created",
        entityType: "emotion",
        entityId: String(createdEmotion.id),
        details: JSON.stringify({ emotion: createdEmotion.emotion }),
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(createdEmotion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/emotions/:patientId", requireAuth, async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const emotions = await storage.getEmotionsByPatientId(req.params.patientId);
      await logView(req, "emotion.list.view", "emotion", req.params.patientId, {
        total: emotions.length,
      });
      return res.json(emotions);
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/daily-reports", requireRole("patient"), async (req, res) => {
    try {
      const report = insertDailyReportSchema.parse(req.body);
      const user = getRequestUser(req);

      if (report.patientId !== user.username) {
        return res.status(403).json({ message: "Patients can only write their own reports" });
      }

      const consent = await requireConsent(
        req,
        res,
        report.patientId,
        "sleepReports",
        "Sleep-report consent is required before saving daily reports",
      );
      if (!consent) {
        return;
      }

      const createdReport = await storage.createDailyReport(report);
      await createAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        actorUsername: user.username,
        patientId: report.patientId,
        action: "daily_report.created",
        entityType: "daily_report",
        entityId: String(createdReport.id),
        details: JSON.stringify({ reportType: createdReport.reportType }),
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(dailyReportSchema.parse(createdReport));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/daily-reports", requireRole("support"), async (req, res) => {
    try {
      const allowedPatientIds = new Set(await getAllowedPatientIds(getRequestUser(req)));
      const reports = (await storage.getAllDailyReports()).filter((report) =>
        allowedPatientIds.has(report.patientId),
      );
      await logView(req, "daily_report.list.view", "daily_report", null, {
        total: reports.length,
      });
      return res.json(reports.map((report) => dailyReportSchema.parse(report)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/daily-reports/:patientId", requireAuth, async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const reports = await storage.getDailyReportsByPatientId(req.params.patientId);
      await logView(req, "daily_report.patient.view", "daily_report", req.params.patientId, {
        total: reports.length,
      });
      return res.json(reports.map((report) => dailyReportSchema.parse(report)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/observations", requireRole("support"), async (req, res) => {
    try {
      const observation = insertObservationSchema.parse(req.body);
      if (!(await ensurePatientAccess(req, res, observation.patientId))) {
        return;
      }

      const createdObservation = await storage.createObservation(observation);
      await createAuditLog({
        actorUserId: getRequestUser(req).id,
        actorRole: getRequestUser(req).role,
        actorUsername: getRequestUser(req).username,
        patientId: observation.patientId,
        action: "observation.created",
        entityType: "observation",
        entityId: String(createdObservation.id),
        details: JSON.stringify({
          observationType: createdObservation.observationType,
          priority: createdObservation.priority,
        }),
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(observationSchema.parse(createdObservation));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/observations", requireRole("support"), async (req, res) => {
    try {
      const allowedPatientIds = new Set(await getAllowedPatientIds(getRequestUser(req)));
      const observations = (await storage.getAllObservations()).filter((observation) =>
        allowedPatientIds.has(observation.patientId),
      );
      await logView(req, "observation.list.view", "observation", null, {
        total: observations.length,
      });
      return res.json(
        observations.map((observation) => observationSchema.parse(observation)),
      );
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/observations/:patientId", requireRole("support"), async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const observations = await storage.getObservationsByPatientId(req.params.patientId);
      await logView(req, "observation.patient.view", "observation", req.params.patientId, {
        total: observations.length,
      });
      return res.json(
        observations.map((observation) => observationSchema.parse(observation)),
      );
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/weekly-screenings", requireRole("patient"), async (req, res) => {
    try {
      const screening = insertWeeklyScreeningSchema.parse(req.body);
      const user = getRequestUser(req);

      if (screening.patientId !== user.username) {
        return res
          .status(403)
          .json({ message: "Patients can only write their own weekly screens" });
      }

      const consent = await requireConsent(
        req,
        res,
        screening.patientId,
        "weeklyScreening",
        "Weekly-screen consent is required before saving this screen",
      );
      if (!consent) {
        return;
      }

      const createdScreening = await storage.createWeeklyScreening(screening);
      await createAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        actorUsername: user.username,
        patientId: screening.patientId,
        action: "weekly_screening.created",
        entityType: "weekly_screening",
        entityId: String(createdScreening.id),
        details: null,
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(weeklyScreeningSchema.parse(createdScreening));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/weekly-screenings", requireRole("support"), async (req, res) => {
    try {
      const allowedPatientIds = new Set(await getAllowedPatientIds(getRequestUser(req)));
      const screenings = (await storage.getAllWeeklyScreenings()).filter((screening) =>
        allowedPatientIds.has(screening.patientId),
      );
      await logView(req, "weekly_screening.list.view", "weekly_screening", null, {
        total: screenings.length,
      });
      return res.json(screenings.map((screening) => weeklyScreeningSchema.parse(screening)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/weekly-screenings/:patientId", requireAuth, async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const screenings = await storage.getWeeklyScreeningsByPatientId(req.params.patientId);
      await logView(req, "weekly_screening.patient.view", "weekly_screening", req.params.patientId, {
        total: screenings.length,
      });
      return res.json(screenings.map((screening) => weeklyScreeningSchema.parse(screening)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/medications", requireRole("support"), async (req, res) => {
    try {
      const medication = insertMedicationSchema.parse(req.body);
      if (!(await ensurePatientAccess(req, res, medication.patientId))) {
        return;
      }

      const createdMedication = await storage.createMedication(medication);
      await createAuditLog({
        actorUserId: getRequestUser(req).id,
        actorRole: getRequestUser(req).role,
        actorUsername: getRequestUser(req).username,
        patientId: medication.patientId,
        action: "medication.created",
        entityType: "medication",
        entityId: String(createdMedication.id),
        details: JSON.stringify({ medicationName: createdMedication.medicationName }),
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(medicationSchema.parse(createdMedication));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/medications/:id", requireRole("support"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Medication ID must be a positive number" });
      }

      const existingMedication = (await storage.getAllMedications()).find(
        (medication) => medication.id === id,
      );
      if (!existingMedication) {
        return res.status(404).json({ message: "Medication not found" });
      }

      if (!(await ensurePatientAccess(req, res, existingMedication.patientId))) {
        return;
      }

      const medication = updateMedicationSchema.parse(req.body);
      const updatedMedication = await storage.updateMedication(id, medication);

      await createAuditLog({
        actorUserId: getRequestUser(req).id,
        actorRole: getRequestUser(req).role,
        actorUsername: getRequestUser(req).username,
        patientId: updatedMedication.patientId,
        action: "medication.updated",
        entityType: "medication",
        entityId: String(updatedMedication.id),
        details: JSON.stringify({ medicationName: updatedMedication.medicationName }),
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });

      return res.json(medicationSchema.parse(updatedMedication));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/medications", requireRole("support"), async (req, res) => {
    try {
      const allowedPatientIds = new Set(await getAllowedPatientIds(getRequestUser(req)));
      const medications = (await storage.getAllMedications()).filter((medication) =>
        allowedPatientIds.has(medication.patientId),
      );
      await logView(req, "medication.list.view", "medication", null, {
        total: medications.length,
      });
      return res.json(medications.map((medication) => medicationSchema.parse(medication)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/medications/:patientId", requireRole("support"), async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const medications = await storage.getMedicationsByPatientId(req.params.patientId);
      await logView(req, "medication.patient.view", "medication", req.params.patientId, {
        total: medications.length,
      });
      return res.json(medications.map((medication) => medicationSchema.parse(medication)));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/care-plan", requireRole("support"), async (req, res) => {
    try {
      const carePlan = insertCarePlanSchema.parse(req.body);
      if (!(await ensurePatientAccess(req, res, carePlan.patientId))) {
        return;
      }

      const createdCarePlan = await storage.createCarePlan(carePlan);
      await createAuditLog({
        actorUserId: getRequestUser(req).id,
        actorRole: getRequestUser(req).role,
        actorUsername: getRequestUser(req).username,
        patientId: carePlan.patientId,
        action: "care_plan.created",
        entityType: "care_plan",
        entityId: carePlan.patientId,
        details: null,
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.status(201).json(carePlanSchema.parse(createdCarePlan));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return res.status(409).json({ message: "A care plan already exists for this patient" });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/care-plan/:patientId", requireRole("support"), async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const carePlan = updateCarePlanSchema.parse(req.body);
      const updatedCarePlan = await storage.updateCarePlan(req.params.patientId, carePlan);
      await createAuditLog({
        actorUserId: getRequestUser(req).id,
        actorRole: getRequestUser(req).role,
        actorUsername: getRequestUser(req).username,
        patientId: req.params.patientId,
        action: "care_plan.updated",
        entityType: "care_plan",
        entityId: req.params.patientId,
        details: null,
        ipAddress: getRequestMetadata(req).ipAddress,
        userAgent: getRequestMetadata(req).userAgent,
      });
      return res.json(carePlanSchema.parse(updatedCarePlan));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: getZodMessage(error) });
      }

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/care-plan/:patientId", requireRole("support"), async (req, res) => {
    try {
      if (!(await ensurePatientAccess(req, res, req.params.patientId))) {
        return;
      }

      const carePlan = await storage.getCarePlanByPatientId(req.params.patientId);
      await logView(req, "care_plan.patient.view", "care_plan", req.params.patientId, {
        hasCarePlan: Boolean(carePlan),
      });
      return res.json(carePlan ? carePlanSchema.parse(carePlan) : null);
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/logs", requireRole("support"), async (req, res) => {
    try {
      const allowedPatientIds = new Set(await getAllowedPatientIds(getRequestUser(req)));
      const emotions = (await storage.getAllEmotions()).filter((emotion) =>
        allowedPatientIds.has(emotion.patientId),
      );
      const observations = (await storage.getAllObservations()).filter((observation) =>
        allowedPatientIds.has(observation.patientId),
      );

      const observationsByPatient = observations.reduce<Record<string, typeof observations>>(
        (grouped, observation) => {
          if (!grouped[observation.patientId]) {
            grouped[observation.patientId] = [];
          }

          grouped[observation.patientId].push(observation);
          return grouped;
        },
        {},
      );

      const logs = emotions.map((emotion) =>
        emotionLogSchema.parse({
          ...emotion,
          observations: observationsByPatient[emotion.patientId] ?? [],
        }),
      );

      await logView(req, "emotion_log.list.view", "emotion_log", null, {
        total: logs.length,
      });

      return res.json(logs);
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
