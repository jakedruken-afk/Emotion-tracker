import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import {
  authUserSchema,
  consentRecordSchema,
  createInviteSchema,
  createPatientAssignmentSchema,
  inviteSchema,
  patientAssignmentSchema,
  patientSummarySchema,
  staffSummarySchema,
  updateConsentSchema,
  type AuthUser,
  type ConsentRecord,
  type CreateInvite,
  type CreatePatientAssignment,
  type InviteRecord,
  type PatientAssignmentRecord,
  type PatientSummary,
  type StaffSummary,
  type UpdateConsent,
  type UserRole,
} from "../shared/contracts";
import { db } from "./db";
import {
  appBaseUrl,
  inviteTtlHours,
  secureCookies,
  sessionCookieName,
  sessionSecret,
  sessionTtlHours,
} from "./config";
import { hashPassword, verifyPassword } from "./password";

type StoredUser = AuthUser & {
  passwordHash: string;
  createdAt: string;
};

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

type SessionContext = {
  token: string;
  user: AuthUser;
};

declare module "express-serve-static-core" {
  interface Request {
    sessionUser?: AuthUser | null;
    sessionToken?: string | null;
  }
}

export async function loadSessionUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const context = await getSessionContext(req);
    req.sessionUser = context?.user ?? null;
    req.sessionToken = context?.token ?? null;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.sessionUser) {
    return res.status(401).json({ message: "Please sign in to continue" });
  }

  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.sessionUser) {
      return res.status(401).json({ message: "Please sign in to continue" });
    }

    if (req.sessionUser.role !== role) {
      return res.status(403).json({ message: "You do not have access to this action" });
    }

    next();
  };
}

export async function loginWithPassword(
  username: string,
  password: string,
  expectedRole: UserRole | undefined,
  metadata: RequestMetadata,
) {
  const user = getStoredUserByUsername(username);

  if (!user || (expectedRole && user.role !== expectedRole)) {
    await createAuditLog({
      actorUserId: null,
      actorRole: null,
      actorUsername: username,
      patientId: null,
      action: "auth.login.failed",
      entityType: "session",
      entityId: null,
      details: JSON.stringify({ reason: "invalid_credentials" }),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return null;
  }

  const verification = await verifyPassword(user.passwordHash, password);
  if (!verification.valid) {
    await createAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actorUsername: user.username,
      patientId: user.role === "patient" ? user.username : null,
      action: "auth.login.failed",
      entityType: "session",
      entityId: null,
      details: JSON.stringify({ reason: "invalid_credentials" }),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return null;
  }

  if (verification.needsUpgrade) {
    const passwordHash = await hashPassword(password);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(passwordHash, user.id);
  }

  const sessionToken = await createSession(user, metadata);
  await createAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    actorUsername: user.username,
    patientId: user.role === "patient" ? user.username : null,
    action: "auth.login.success",
    entityType: "session",
    entityId: hashToken(sessionToken),
    details: null,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return {
    user: authUserSchema.parse(user),
    sessionToken,
  };
}

export async function logoutCurrentSession(req: Request) {
  if (!req.sessionToken) {
    return;
  }

  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(req.sessionToken));

  if (req.sessionUser) {
    await createAuditLog({
      actorUserId: req.sessionUser.id,
      actorRole: req.sessionUser.role,
      actorUsername: req.sessionUser.username,
      patientId: req.sessionUser.role === "patient" ? req.sessionUser.username : null,
      action: "auth.logout",
      entityType: "session",
      entityId: hashToken(req.sessionToken),
      details: null,
      ipAddress: getRequestMetadata(req).ipAddress,
      userAgent: getRequestMetadata(req).userAgent,
    });
  }
}

export async function createInvite(
  input: CreateInvite,
  actor: AuthUser,
  metadata: RequestMetadata,
) {
  const invite = createInviteSchema.parse(input);
  const existingUser = getStoredUserByUsername(invite.username);
  if (existingUser) {
    throw new Error("A user with that username already exists");
  }

  const hasPendingInvite = db
    .prepare(`
      SELECT id
      FROM invites
      WHERE username = ?
        AND accepted_at IS NULL
        AND datetime(expires_at) > datetime('now')
      LIMIT 1
    `)
    .get(invite.username) as { id?: number } | undefined;

  if (hasPendingInvite?.id) {
    throw new Error("A live invite already exists for that username");
  }

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + inviteTtlHours * 60 * 60 * 1000).toISOString();
  const assignedStaffUserId =
    invite.role === "patient" ? invite.assignedStaffUserId ?? actor.id : null;

  const insertResult = db
    .prepare(`
      INSERT INTO invites (
        token_hash,
        username,
        role,
        first_name,
        last_name,
        assigned_staff_user_id,
        created_by_user_id,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      tokenHash,
      invite.username,
      invite.role,
      invite.firstName ?? null,
      invite.lastName ?? null,
      assignedStaffUserId,
      actor.id,
      expiresAt,
    );

  const createdInvite = getInviteById(Number(insertResult.lastInsertRowid));
  if (!createdInvite) {
    throw new Error("Failed to create invite");
  }

  await createAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    actorUsername: actor.username,
    patientId: invite.role === "patient" ? invite.username : null,
    action: "invite.created",
    entityType: "invite",
    entityId: String(createdInvite.id),
    details: JSON.stringify({ role: invite.role, assignedStaffUserId }),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return {
    ...createdInvite,
    activationUrl: new URL(`/activate/${rawToken}`, appBaseUrl).toString(),
  };
}

export async function acceptInvite(
  token: string,
  password: string,
  metadata: RequestMetadata,
) {
  const tokenHash = hashToken(token);
  const invite = db
    .prepare(`
      SELECT
        id,
        username,
        role,
        first_name AS firstName,
        last_name AS lastName,
        assigned_staff_user_id AS assignedStaffUserId,
        created_by_user_id AS createdByUserId,
        created_at AS createdAt,
        expires_at AS expiresAt,
        accepted_at AS acceptedAt
      FROM invites
      WHERE token_hash = ?
      LIMIT 1
    `)
    .get(tokenHash) as Record<string, unknown> | undefined;

  const parsedInvite = mapInvite(invite);
  if (!parsedInvite) {
    throw new Error("This invite link is not valid");
  }

  if (parsedInvite.acceptedAt) {
    throw new Error("This invite link has already been used");
  }

  if (new Date(parsedInvite.expiresAt).getTime() <= Date.now()) {
    throw new Error("This invite link has expired");
  }

  if (getStoredUserByUsername(parsedInvite.username)) {
    throw new Error("A user with this username already exists");
  }

  const passwordHash = await hashPassword(password);
  const createdUserResult = db
    .prepare(`
      INSERT INTO users (username, password, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      parsedInvite.username,
      passwordHash,
      parsedInvite.role,
      parsedInvite.firstName ?? null,
      parsedInvite.lastName ?? null,
    );

  const createdUser = await getStoredUserById(Number(createdUserResult.lastInsertRowid));
  if (!createdUser) {
    throw new Error("Failed to create the invited user");
  }

  if (parsedInvite.role === "patient" && parsedInvite.assignedStaffUserId) {
    db.prepare(`
      INSERT OR IGNORE INTO patient_assignments (patient_id, staff_user_id, created_by_user_id)
      VALUES (?, ?, ?)
    `).run(parsedInvite.username, parsedInvite.assignedStaffUserId, parsedInvite.createdByUserId);
  }

  db.prepare("UPDATE invites SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?").run(parsedInvite.id);

  const sessionToken = await createSession(createdUser, metadata);

  await createAuditLog({
    actorUserId: createdUser.id,
    actorRole: createdUser.role,
    actorUsername: createdUser.username,
    patientId: createdUser.role === "patient" ? createdUser.username : null,
    action: "invite.accepted",
    entityType: "invite",
    entityId: String(parsedInvite.id),
    details: JSON.stringify({ role: createdUser.role }),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return {
    user: authUserSchema.parse(createdUser),
    sessionToken,
  };
}

export async function createPatientAssignment(
  input: CreatePatientAssignment,
  actor: AuthUser,
  metadata: RequestMetadata,
) {
  const assignment = createPatientAssignmentSchema.parse(input);

  const patient = getStoredUserByUsername(assignment.patientId);
  if (!patient || patient.role !== "patient") {
    throw new Error("Patient account not found");
  }

  const staffUser = await getStoredUserById(assignment.staffUserId);
  if (!staffUser || staffUser.role !== "support") {
    throw new Error("Support account not found");
  }

  const insertResult = db
    .prepare(`
      INSERT OR IGNORE INTO patient_assignments (patient_id, staff_user_id, created_by_user_id)
      VALUES (?, ?, ?)
    `)
    .run(assignment.patientId, assignment.staffUserId, actor.id);

  const row = db
    .prepare(`
      SELECT
        id,
        patient_id AS patientId,
        staff_user_id AS staffUserId,
        created_by_user_id AS createdByUserId,
        created_at AS createdAt
      FROM patient_assignments
      WHERE patient_id = ? AND staff_user_id = ?
      LIMIT 1
    `)
    .get(assignment.patientId, assignment.staffUserId) as Record<string, unknown> | undefined;

  const createdAssignment = mapPatientAssignment(row);
  if (!createdAssignment) {
    throw new Error("Failed to save the patient assignment");
  }

  await createAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    actorUsername: actor.username,
    patientId: assignment.patientId,
    action: insertResult.changes === 0 ? "assignment.confirmed" : "assignment.created",
    entityType: "patient_assignment",
    entityId: String(createdAssignment.id),
    details: JSON.stringify({ staffUserId: assignment.staffUserId }),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return createdAssignment;
}

export async function getStaffUsers() {
  const rows = db
    .prepare(`
      SELECT
        id,
        username,
        role,
        first_name AS firstName,
        last_name AS lastName
      FROM users
      WHERE role = 'support'
      ORDER BY COALESCE(last_name, username), COALESCE(first_name, username), username
    `)
    .all() as Record<string, unknown>[];

  return rows.map((row) => staffSummarySchema.parse(row));
}

export async function getPatientSummaries(actor: AuthUser) {
  const patientRows = db
    .prepare(`
      SELECT
        id,
        username,
        role,
        first_name AS firstName,
        last_name AS lastName,
        created_at AS createdAt
      FROM users
      WHERE role = 'patient'
        AND username IN (
          SELECT patient_id
          FROM patient_assignments
          WHERE staff_user_id = ?
        )
      ORDER BY COALESCE(last_name, username), COALESCE(first_name, username), username
    `)
    .all(actor.id) as Record<string, unknown>[];

  const assignmentRows = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        staff_user_id AS staffUserId,
        users.first_name AS firstName,
        users.last_name AS lastName,
        users.username AS username
      FROM patient_assignments
      JOIN users ON users.id = patient_assignments.staff_user_id
    `)
    .all() as Array<{
      patientId?: string;
      staffUserId?: number;
      firstName?: string | null;
      lastName?: string | null;
      username?: string;
    }>;

  const consentRows = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        mood_tracking AS moodTracking,
        sleep_reports AS sleepReports,
        weekly_screening AS weeklyScreening,
        gps_tracking AS gpsTracking,
        accepted_at AS acceptedAt,
        updated_at AS updatedAt
      FROM consent_records
    `)
    .all() as Record<string, unknown>[];

  const assignmentsByPatient = assignmentRows.reduce<
    Record<
      string,
      {
        staffUserIds: number[];
        staffNames: string[];
      }
    >
  >((accumulator, row) => {
    const patientId = row.patientId;
    const staffUserId = row.staffUserId;
    if (!patientId || !staffUserId) {
      return accumulator;
    }

    if (!accumulator[patientId]) {
      accumulator[patientId] = {
        staffUserIds: [],
        staffNames: [],
      };
    }

    accumulator[patientId].staffUserIds.push(Number(staffUserId));
    accumulator[patientId].staffNames.push(
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || String(row.username),
    );
    return accumulator;
  }, {});

  const consentByPatient = new Map(
    consentRows.map((row) => [
      String(row.patientId),
      consentRecordSchema.parse({
        patientId: String(row.patientId),
        moodTracking: Boolean(row.moodTracking),
        sleepReports: Boolean(row.sleepReports),
        weeklyScreening: Boolean(row.weeklyScreening),
        gpsTracking: Boolean(row.gpsTracking),
        acceptedAt: String(row.acceptedAt),
        updatedAt: String(row.updatedAt),
      }),
    ]),
  );

  return patientRows.map((row) =>
    patientSummarySchema.parse({
      ...row,
      assignedStaffUserIds: assignmentsByPatient[String(row.username)]?.staffUserIds ?? [],
      assignedStaffNames: assignmentsByPatient[String(row.username)]?.staffNames ?? [],
      consent: consentByPatient.get(String(row.username)) ?? null,
    }),
  );
}

export async function listInvites(actor: AuthUser) {
  const rows = db
    .prepare(`
      SELECT
        id,
        username,
        role,
        first_name AS firstName,
        last_name AS lastName,
        assigned_staff_user_id AS assignedStaffUserId,
        created_by_user_id AS createdByUserId,
        created_at AS createdAt,
        expires_at AS expiresAt,
        accepted_at AS acceptedAt
      FROM invites
      WHERE created_by_user_id = ?
         OR assigned_staff_user_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(actor.id, actor.id) as Record<string, unknown>[];

  return rows.map((row) => inviteSchema.parse(row));
}

export async function getConsentByPatientId(patientId: string) {
  const row = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        mood_tracking AS moodTracking,
        sleep_reports AS sleepReports,
        weekly_screening AS weeklyScreening,
        gps_tracking AS gpsTracking,
        accepted_at AS acceptedAt,
        updated_at AS updatedAt
      FROM consent_records
      WHERE patient_id = ?
      LIMIT 1
    `)
    .get(patientId) as Record<string, unknown> | undefined;

  return row ? mapConsent(row) : undefined;
}

export async function upsertConsent(
  patientId: string,
  nextConsent: UpdateConsent,
  actor: AuthUser,
  metadata: RequestMetadata,
) {
  const consent = updateConsentSchema.parse(nextConsent);

  db.prepare(`
    INSERT INTO consent_records (
      patient_id,
      mood_tracking,
      sleep_reports,
      weekly_screening,
      gps_tracking,
      accepted_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(patient_id) DO UPDATE SET
      mood_tracking = excluded.mood_tracking,
      sleep_reports = excluded.sleep_reports,
      weekly_screening = excluded.weekly_screening,
      gps_tracking = excluded.gps_tracking,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    patientId,
    consent.moodTracking ? 1 : 0,
    consent.sleepReports ? 1 : 0,
    consent.weeklyScreening ? 1 : 0,
    consent.gpsTracking ? 1 : 0,
  );

  const savedConsent = await getConsentByPatientId(patientId);
  if (!savedConsent) {
    throw new Error("Failed to save the consent record");
  }

  await createAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    actorUsername: actor.username,
    patientId,
    action: "consent.updated",
    entityType: "consent_record",
    entityId: patientId,
    details: JSON.stringify(consent),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return savedConsent;
}

export async function createAuditLog(entry: {
  actorUserId: number | null;
  actorRole: UserRole | null;
  actorUsername: string | null;
  patientId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  db.prepare(`
    INSERT INTO audit_logs (
      actor_user_id,
      actor_role,
      actor_username,
      patient_id,
      action,
      entity_type,
      entity_id,
      details,
      ip_address,
      user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.actorUserId,
    entry.actorRole,
    entry.actorUsername,
    entry.patientId,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.details,
    entry.ipAddress,
    entry.userAgent,
  );
}

export async function assertPatientAccess(user: AuthUser, patientId: string) {
  if (user.role === "patient") {
    return user.username === patientId;
  }

  return isPatientAssignedToStaff(patientId, user.id);
}

export async function getAllowedPatientIds(user: AuthUser) {
  if (user.role === "patient") {
    return [user.username];
  }

  const rows = db
    .prepare(`
      SELECT patient_id AS patientId
      FROM patient_assignments
      WHERE staff_user_id = ?
    `)
    .all(user.id) as Array<{ patientId?: string }>;

  return rows.map((row) => String(row.patientId)).filter((value) => value.length > 0);
}

export async function isConsentEnabledForPatient(
  patientId: string,
  consentKey: keyof UpdateConsent,
) {
  const consent = await getConsentByPatientId(patientId);
  return Boolean(consent?.[consentKey]);
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    maxAge: sessionTtlHours * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.cookie(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    expires: new Date(0),
    path: "/",
  });
}

export function getRequestMetadata(req: Request): RequestMetadata {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export async function getSessionContext(req: Request): Promise<SessionContext | null> {
  if (req.sessionUser && req.sessionToken) {
    return {
      user: req.sessionUser,
      token: req.sessionToken,
    };
  }

  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[sessionCookieName];
  if (!rawToken) {
    return null;
  }

  const row = db
    .prepare(`
      SELECT
        users.id AS id,
        users.username AS username,
        users.role AS role,
        users.first_name AS firstName,
        users.last_name AS lastName,
        sessions.expires_at AS expiresAt
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
      LIMIT 1
    `)
    .get(hashToken(rawToken)) as
    | {
        id?: number;
        username?: string;
        role?: UserRole;
        firstName?: string | null;
        lastName?: string | null;
        expiresAt?: string;
      }
    | undefined;

  if (!row?.id || !row.expiresAt) {
    return null;
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(rawToken));
    return null;
  }

  db.prepare(`
    UPDATE sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE token_hash = ?
  `).run(hashToken(rawToken));

  return {
    token: rawToken,
    user: authUserSchema.parse({
      id: Number(row.id),
      username: String(row.username),
      role: row.role,
      firstName: row.firstName == null ? null : String(row.firstName),
      lastName: row.lastName == null ? null : String(row.lastName),
    }),
  };
}

function getStoredUserByUsername(username: string): StoredUser | undefined {
  const row = db
    .prepare(`
      SELECT
        id,
        username,
        password AS passwordHash,
        role,
        first_name AS firstName,
        last_name AS lastName,
        created_at AS createdAt
      FROM users
      WHERE username = ?
      LIMIT 1
    `)
    .get(username) as Record<string, unknown> | undefined;

  return mapStoredUser(row);
}

async function getStoredUserById(id: number): Promise<StoredUser | undefined> {
  const row = db
    .prepare(`
      SELECT
        id,
        username,
        password AS passwordHash,
        role,
        first_name AS firstName,
        last_name AS lastName,
        created_at AS createdAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `)
    .get(id) as Record<string, unknown> | undefined;

  return mapStoredUser(row);
}

async function createSession(user: AuthUser, metadata: RequestMetadata) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(hashToken(rawToken), user.id, metadata.ipAddress, metadata.userAgent, expiresAt);

  return rawToken;
}

function parseCookies(headerValue: string | undefined) {
  return (headerValue ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function hashToken(rawToken: string) {
  return crypto
    .createHash("sha256")
    .update(`${sessionSecret}:${rawToken}`)
    .digest("hex");
}

function isPatientAssignedToStaff(patientId: string, staffUserId: number) {
  const row = db
    .prepare(`
      SELECT id
      FROM patient_assignments
      WHERE patient_id = ? AND staff_user_id = ?
      LIMIT 1
    `)
    .get(patientId, staffUserId) as { id?: number } | undefined;

  return Boolean(row?.id);
}

function getInviteById(id: number) {
  const row = db
    .prepare(`
      SELECT
        id,
        username,
        role,
        first_name AS firstName,
        last_name AS lastName,
        assigned_staff_user_id AS assignedStaffUserId,
        created_by_user_id AS createdByUserId,
        created_at AS createdAt,
        expires_at AS expiresAt,
        accepted_at AS acceptedAt
      FROM invites
      WHERE id = ?
      LIMIT 1
    `)
    .get(id) as Record<string, unknown> | undefined;

  return mapInvite(row);
}

function mapStoredUser(row: Record<string, unknown> | undefined): StoredUser | undefined {
  if (!row) {
    return undefined;
  }

  return {
    ...authUserSchema.parse({
      id: Number(row.id),
      username: String(row.username),
      role: row.role,
      firstName: row.firstName == null ? null : String(row.firstName),
      lastName: row.lastName == null ? null : String(row.lastName),
    }),
    passwordHash: String(row.passwordHash),
    createdAt: String(row.createdAt),
  };
}

function mapInvite(row: Record<string, unknown> | undefined): InviteRecord | undefined {
  if (!row) {
    return undefined;
  }

  return inviteSchema.parse({
    id: Number(row.id),
    username: String(row.username),
    role: row.role,
    firstName: row.firstName == null ? null : String(row.firstName),
    lastName: row.lastName == null ? null : String(row.lastName),
    assignedStaffUserId:
      row.assignedStaffUserId == null ? null : Number(row.assignedStaffUserId),
    createdByUserId: Number(row.createdByUserId),
    createdAt: String(row.createdAt),
    expiresAt: String(row.expiresAt),
    acceptedAt: row.acceptedAt == null ? null : String(row.acceptedAt),
  });
}

function mapPatientAssignment(
  row: Record<string, unknown> | undefined,
): PatientAssignmentRecord | undefined {
  if (!row) {
    return undefined;
  }

  return patientAssignmentSchema.parse({
    id: Number(row.id),
    patientId: String(row.patientId),
    staffUserId: Number(row.staffUserId),
    createdByUserId: Number(row.createdByUserId),
    createdAt: String(row.createdAt),
  });
}

function mapConsent(row: Record<string, unknown>): ConsentRecord {
  return consentRecordSchema.parse({
    patientId: String(row.patientId),
    moodTracking: Boolean(row.moodTracking),
    sleepReports: Boolean(row.sleepReports),
    weeklyScreening: Boolean(row.weeklyScreening),
    gpsTracking: Boolean(row.gpsTracking),
    acceptedAt: String(row.acceptedAt),
    updatedAt: String(row.updatedAt),
  });
}
