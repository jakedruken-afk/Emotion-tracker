import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";

type UserRole = "patient" | "doctor" | "support_worker";
type LogSource = "patient" | "support_worker";
type LogType =
  | "mood"
  | "stress"
  | "sleep"
  | "meal"
  | "medication"
  | "substance"
  | "weekly_check";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type AlertType = "crisis" | "mismatch";
type ClientRole = "patient" | "support";
type ClientSessionMode = "cookie" | "header";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  BCRYPT_SALT: string;
  CORS_ORIGIN?: string;
  ADMIN_SETUP_TOKEN?: string;
  APP_BASE_URL?: string;
  INVITE_TTL_HOURS?: string;
};

type AuthUser = {
  id: number;
  role: UserRole;
  isAppAdmin: boolean;
};

type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user: AuthUser;
  };
};

type AppContext = Context<AppEnv>;
type JsonObject = Record<string, unknown>;

type D1Bindable = string | number | null | ArrayBuffer | Uint8Array;

type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
};

type D1PreparedStatement = {
  bind(...values: D1Bindable[]): D1PreparedStatement;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
};

type UserRow = {
  id: number;
  email: string;
  hashed_password: string;
  name: string;
  role: UserRole;
  patient_code: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type PublicUser = Omit<UserRow, "hashed_password">;

type PatientRow = {
  id: number;
  user_id: number;
  doctor_id: number;
  support_worker_id: number | null;
  consent_given: number;
  consent_date: string | null;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
};

type PatientListRow = PatientRow & {
  patient_email: string;
  patient_name: string;
  patient_code: string | null;
  doctor_name: string;
  support_name: string | null;
};

type LogRow = {
  id: number;
  patient_id: number;
  source: LogSource;
  type: LogType;
  value: string;
  note: string | null;
  created_at: string;
};

type DailyReportRow = {
  id: number;
  patient_id: number;
  client_patient_id: string | null;
  report_type: "morning" | "night";
  bed_time: string | null;
  wake_time: string | null;
  sleep_quality: string | null;
  wake_ups: number | null;
  felt_rested: number | null;
  meals_count: number | null;
  meals_note: string | null;
  notes: string | null;
  updated_at: string;
  edit_count: number;
  suspicious_edit_count: number;
  reliability_level: "High" | "Medium" | "Low";
  crisis_level: "none" | "watch" | "high" | "critical";
  crisis_summary: string | null;
  legacy_log_id: number | null;
  created_at: string;
};

type WeeklyScreeningRow = {
  id: number;
  patient_id: number;
  client_patient_id: string | null;
  wished_dead: number;
  family_better_off_dead: number;
  thoughts_killing_self: number;
  thoughts_killing_self_frequency: string | null;
  ever_tried_to_kill_self: number;
  attempt_timing: string;
  current_thoughts: number | null;
  depressed_hard_to_function: number;
  depressed_frequency: string | null;
  anxious_on_edge: number;
  anxious_frequency: string | null;
  hopeless: number;
  could_not_enjoy_things: number;
  keeping_to_self: number;
  more_irritable: number;
  substance_use_more_than_usual: number;
  substance_use_frequency: string | null;
  sleep_trouble: number;
  sleep_trouble_frequency: string | null;
  appetite_change: number;
  appetite_change_direction: string | null;
  support_person: string | null;
  reasons_for_living: string | null;
  coping_plan: string | null;
  needs_help_staying_safe: number | null;
  updated_at: string;
  edit_count: number;
  suspicious_edit_count: number;
  reliability_level: "High" | "Medium" | "Low";
  crisis_level: "none" | "watch" | "high" | "critical";
  crisis_summary: string | null;
  legacy_log_id: number | null;
  created_at: string;
};

type ObservationRow = {
  id: number;
  patient_id: number;
  client_patient_id: string | null;
  observation_type: "Clinical" | "Behavioral" | "Progress" | "Recommendation" | "Alert";
  observation: string;
  priority: "Low" | "Medium" | "High" | "Critical" | "Urgent";
  support_worker_name: string;
  linked_entity_type: "emotion" | "daily_report" | "weekly_screening" | "observation" | null;
  linked_entity_id: number | null;
  system_generated: number;
  status: "open" | "acknowledged";
  ownership_note: string | null;
  acknowledged_by_user_id: number | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

type MedicationRow = {
  id: number;
  patient_id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string;
  end_date: string | null;
  purpose: string | null;
  side_effects: string | null;
  adherence_notes: string | null;
  is_active: number | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type CarePlanRow = {
  patient_id: number;
  client_patient_id: string | null;
  goals: string | null;
  triggers: string | null;
  warning_signs: string | null;
  what_helps: string | null;
  support_contacts: string | null;
  preferred_follow_up_notes: string | null;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type RiskScoreRow = {
  id: number;
  patient_id: number;
  score: number;
  level: RiskLevel;
  factors: string | null;
  calculated_at: string;
};

type InviteRow = {
  id: number;
  token_hash: string;
  email: string;
  name: string;
  role: UserRole;
  doctor_id: number | null;
  support_worker_id: number | null;
  created_by_user_id: number;
  accepted_by_user_id: number | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

type StaffRow = UserRow & {
  admin_user_id: number | null;
};

type JwtPayload = {
  sub: number;
  role: UserRole;
  exp: number;
};

const roles = new Set<UserRole>(["patient", "doctor", "support_worker"]);
const logSources = new Set<LogSource>(["patient", "support_worker"]);
const logTypes = new Set<LogType>([
  "mood",
  "stress",
  "sleep",
  "meal",
  "medication",
  "substance",
  "weekly_check",
]);
const mealTypes = new Set(["breakfast", "lunch", "dinner", "snack"]);
const substances = new Set(["cocaine", "cannabis", "alcohol", "nicotine", "other"]);

const crisisKeywords = [
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "kill myself",
  "hurt myself",
  "harm myself",
  "end my life",
  "overdose",
  "violence",
  "violent",
  "hurt someone",
  "kill someone",
];

const app = new Hono<AppEnv>();
const api = new Hono<AppEnv>();

app.use(
  "/*",
  cors({
    origin: (origin, c) => {
      const allowedOrigins: string[] = (c.env.CORS_ORIGIN ?? "")
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean);

      if (allowedOrigins.length === 0) {
        return origin ?? "*";
      }

      if (origin && allowedOrigins.includes(origin)) {
        return origin;
      }

      if (origin && allowedOrigins.some((allowedOrigin) => originMatchesAllowed(origin, allowedOrigin))) {
        return origin;
      }

      return allowedOrigins[0];
    },
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-lamb-session"],
    credentials: true,
  })
);

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

function originMatchesAllowed(origin: string, allowedOrigin: string): boolean {
  if (!allowedOrigin.includes("*")) {
    return origin === allowedOrigin;
  }

  const escaped = allowedOrigin
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(origin);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(c: AppContext): Promise<JsonObject> {
  const body = await c.req.json().catch(() => null);
  if (!isJsonObject(body)) {
    throw new HttpError(400, "Expected a JSON object request body");
  }
  return body;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function requireInteger(value: unknown, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return numberValue;
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requireInteger(value, field);
}

function asBooleanFlag(value: unknown): number {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function optionalBooleanFlag(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return asBooleanFlag(value);
}

function flagToBoolean(value: number | null): boolean | null {
  return value === null ? null : value === 1;
}

function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new HttpError(400, "email must be a valid email address");
  }
  return normalized;
}

function toPublicUser(user: UserRow): PublicUser {
  const { hashed_password: _hashedPassword, ...publicUser } = user;
  return publicUser;
}

function toClientRole(role: UserRole): ClientRole {
  return role === "patient" ? "patient" : "support";
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function toClientUser(user: UserRow, isAppAdmin = false) {
  const { firstName, lastName } = splitName(user.name);
  return {
    id: user.id,
    username: user.patient_code ?? user.email,
    role: toClientRole(user.role),
    isAppAdmin,
    firstName,
    lastName,
  };
}

function roleMatchesExpected(role: UserRole, expectedRole: unknown): boolean {
  if (expectedRole == null) {
    return true;
  }

  if (expectedRole === "support") {
    return role === "doctor" || role === "support_worker";
  }

  return expectedRole === role;
}

function readSessionMode(value: unknown): ClientSessionMode {
  return value === "cookie" || value === "header" ? value : "header";
}

async function getUserById(c: AppContext, userId: number): Promise<UserRow | null> {
  return c.env.DB.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1")
    .bind(userId)
    .first<UserRow>();
}

async function isAppAdminById(db: D1Database, userId: number): Promise<boolean> {
  try {
    const row = await db.prepare("SELECT user_id FROM app_admins WHERE user_id = ?")
      .bind(userId)
      .first<{ user_id: number }>();
    return Boolean(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table: app_admins/i.test(message)) {
      return false;
    }
    throw error;
  }
}

async function hasAnyAppAdmin(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT user_id FROM app_admins LIMIT 1").first<{ user_id: number }>();
  return Boolean(row);
}

function jsonValue(value: unknown): string {
  if (value === undefined) {
    throw new HttpError(400, "value is required");
  }
  return JSON.stringify(value);
}

function parseStoredJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function valuesDiffer(left: string, right: string): boolean {
  return stableStringify(parseStoredJson(left)) !== stableStringify(parseStoredJson(right));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlDecodeToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function base64UrlDecodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(value))) as T;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function signHmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function createJWT(payload: Omit<JwtPayload, "exp">, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson({ ...payload, exp });
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(data, secret);
  return `${data}.${base64UrlEncode(signature)}`;
}

async function verifyJWT(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "Invalid token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlDecodeJson<{ alg?: string; typ?: string }>(encodedHeader);
  if (header.alg !== "HS256") {
    throw new HttpError(401, "Invalid token algorithm");
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = await signHmac(data, secret);
  const actual = base64UrlDecodeToBytes(encodedSignature);
  if (!constantTimeEqual(expected, actual)) {
    throw new HttpError(401, "Invalid token signature");
  }

  const payload = base64UrlDecodeJson<JwtPayload>(encodedPayload);
  if (!Number.isInteger(payload.sub) || !roles.has(payload.role)) {
    throw new HttpError(401, "Invalid token payload");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Token expired");
  }

  return payload;
}

async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  const hash = await derivePasswordHash(password, pepper, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, hashText] = stored.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !Number.isInteger(iterations) || !saltText || !hashText) {
    return false;
  }

  const salt = base64UrlDecodeToBytes(saltText);
  const expected = base64UrlDecodeToBytes(hashText);
  const actual = await derivePasswordHash(password, pepper, salt, iterations);
  return constantTimeEqual(actual, expected);
}

async function derivePasswordHash(
  password: string,
  pepper: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}:${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function generatePatientCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `LAMB-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function generateUniquePatientCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generatePatientCode();
    const existing = await db.prepare("SELECT id FROM users WHERE patient_code = ?").bind(code).first<{ id: number }>();
    if (!existing) {
      return code;
    }
  }
  throw new HttpError(500, "Could not generate a unique patient code");
}

function generateInviteToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64UrlEncode(new Uint8Array(digest));
}

function getInviteTtlHours(c: AppContext): number {
  const configured = Number(c.env.INVITE_TTL_HOURS ?? 168);
  return Number.isFinite(configured) && configured > 0 ? configured : 168;
}

function getAppBaseUrl(c: AppContext): string {
  const configured = c.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    return configured;
  }

  const origin = c.req.header("Origin")?.trim().replace(/\/+$/, "");
  return origin || "https://lamb-web.pages.dev";
}

function normalizeInviteRole(value: unknown): UserRole {
  const role = requireString(value, "role");
  if (role === "support") {
    return "support_worker";
  }

  if (roles.has(role as UserRole)) {
    return role as UserRole;
  }

  throw new HttpError(400, "role must be patient, doctor, support_worker, or support");
}

const authMiddleware = async (c: AppContext, next: Next) => {
  const token = getAuthToken(c);
  if (!token) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    const user = await c.env.DB.prepare("SELECT id, role, is_active FROM users WHERE id = ?")
      .bind(payload.sub)
      .first<{ id: number; role: UserRole; is_active: number }>();

    if (!user || user.is_active !== 1 || user.role !== payload.role) {
      return c.json({ error: "User is inactive or no longer exists" }, 401);
    }

    c.set("user", {
      id: user.id,
      role: user.role,
      isAppAdmin: await isAppAdminById(c.env.DB, user.id),
    });
    await next();
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};

function getAuthToken(c: AppContext): string | null {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return c.req.header("x-lamb-session") ?? null;
}

function requireRole(...allowedRoles: UserRole[]) {
  return async (c: AppContext, next: Next) => {
    const user = c.var.user;
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

function requireAppAdmin() {
  return async (c: AppContext, next: Next) => {
    if (!c.var.user.isAppAdmin) {
      return c.json({ error: "App admin access required" }, 403);
    }
    await next();
  };
}

async function getPatient(c: AppContext, patientId: number): Promise<PatientRow | null> {
  return c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(patientId).first<PatientRow>();
}

async function getPatientForUser(c: AppContext, userId: number): Promise<PatientRow | null> {
  return c.env.DB.prepare("SELECT * FROM patients WHERE user_id = ?").bind(userId).first<PatientRow>();
}

async function requirePatientAccess(c: AppContext, patientId: number): Promise<PatientRow> {
  const patient = await getPatient(c, patientId);
  if (!patient) {
    throw new HttpError(404, "Patient not found");
  }

  const user = c.var.user;
  const hasAccess =
    user.isAppAdmin ||
    (user.role === "patient" && patient.user_id === user.id) ||
    (user.role === "doctor" && patient.doctor_id === user.id) ||
    (user.role === "support_worker" && patient.support_worker_id === user.id);

  if (!hasAccess) {
    throw new HttpError(403, "Forbidden");
  }

  return patient;
}

async function auditLog(
  c: AppContext,
  userId: number,
  patientId: number | null,
  action: string
): Promise<void> {
  await c.env.DB.prepare(
    `INSERT INTO access_log (user_id, patient_id, action, ip_address, user_agent, accessed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      userId,
      patientId,
      action,
      c.req.raw.headers.get("CF-Connecting-IP"),
      c.req.raw.headers.get("User-Agent")
    )
    .run();
}

async function assertAssignedClinician(c: AppContext, patientId: number): Promise<PatientRow> {
  const patient = await requirePatientAccess(c, patientId);
  if (c.var.user.role === "patient") {
    throw new HttpError(403, "Clinician access required");
  }
  return patient;
}

async function assertCanCreateLog(c: AppContext, patientId: number, source: LogSource): Promise<PatientRow> {
  const patient = await requirePatientAccess(c, patientId);
  const user = c.var.user;

  if (user.role === "patient" && (patient.user_id !== user.id || source !== "patient")) {
    throw new HttpError(403, "Patients can only create patient-source logs for themselves");
  }

  if (user.role === "support_worker" && (patient.support_worker_id !== user.id || source !== "support_worker")) {
    throw new HttpError(403, "Support workers can only create support-worker logs for assigned patients");
  }

  if (user.role === "doctor") {
    throw new HttpError(403, "Doctors can review and edit assigned records but cannot create daily logs");
  }

  return patient;
}

api.post("/register", async (c) => {
  return c.json({ error: "Public registration is disabled. Please use an invite link." }, 403);
});

api.post("/login", async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const email = validateEmail(requireString(body.email, "email"));
    const password = requireString(body.password, "password");
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
      .bind(email)
      .first<UserRow>();

    if (!user || !(await verifyPassword(password, user.hashed_password, c.env.BCRYPT_SALT))) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = await createJWT({ sub: user.id, role: user.role }, c.env.JWT_SECRET);
    const patient = user.role === "patient" ? await getPatientForUser(c, user.id) : null;
    await auditLog(c, user.id, patient?.id ?? null, "login");

    return c.json({
      token,
      role: user.role,
      user: toPublicUser(user),
      patient_id: patient?.id ?? null,
    });
  });
});

api.get("/health", async (c) => {
  const check = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ status: check?.ok === 1 ? "ok" : "degraded", serverTime: new Date().toISOString() });
});

api.post("/auth/login", async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const username = requireString(body.username ?? body.email, "username");
    const password = requireString(body.password, "password");
    const sessionMode = readSessionMode(body.sessionMode);
    const user = await c.env.DB.prepare(
      `SELECT *
       FROM users
       WHERE is_active = 1
         AND (lower(email) = lower(?) OR patient_code = ?)`
    )
      .bind(username, username)
      .first<UserRow>();

    if (!user || !roleMatchesExpected(user.role, body.expectedRole)) {
      throw new HttpError(401, "Invalid username or password");
    }

    if (!(await verifyPassword(password, user.hashed_password, c.env.BCRYPT_SALT))) {
      throw new HttpError(401, "Invalid username or password");
    }

    const token = await createJWT({ sub: user.id, role: user.role }, c.env.JWT_SECRET);
    const isAppAdmin = await isAppAdminById(c.env.DB, user.id);
    const patient = user.role === "patient" ? await getPatientForUser(c, user.id) : null;
    await auditLog(c, user.id, patient?.id ?? null, "auth.login.success");

    return c.json({
      user: toClientUser(user, isAppAdmin),
      sessionMode: sessionMode === "cookie" ? "header" : sessionMode,
      sessionToken: token,
    });
  });
});

api.post("/auth/logout", async (c) => {
  const token = getAuthToken(c);
  if (token) {
    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      const patient = payload.role === "patient" ? await getPatientForUser(c, payload.sub) : null;
      await auditLog(c, payload.sub, patient?.id ?? null, "auth.logout");
    } catch {
      // Logging out should still clear the client even if the token is stale.
    }
  }

  return c.body(null, 204);
});

api.post("/admin/bootstrap", async (c) => {
  return handleRoute(c, async () => {
    const setupToken = c.env.ADMIN_SETUP_TOKEN;
    if (!setupToken) {
      throw new HttpError(503, "Admin setup is not configured");
    }

    if (await hasAnyAppAdmin(c.env.DB)) {
      throw new HttpError(409, "An app admin already exists");
    }

    const body = await readJsonObject(c);
    if (requireString(body.setupToken, "setupToken") !== setupToken) {
      throw new HttpError(403, "Invalid admin setup token");
    }

    const email = validateEmail(requireString(body.email, "email"));
    const password = requireString(body.password, "password");
    const name = requireString(body.name, "name");
    if (password.length < 8) {
      throw new HttpError(400, "password must be at least 8 characters");
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (existing) {
      throw new HttpError(409, "Email is already registered");
    }

    const hashedPassword = await hashPassword(password, c.env.BCRYPT_SALT);
    const user = await c.env.DB.prepare(
      `INSERT INTO users (email, hashed_password, name, role, patient_code, created_at, updated_at)
       VALUES (?, ?, ?, 'support_worker', NULL, datetime('now'), datetime('now'))
       RETURNING id, email, hashed_password, name, role, patient_code, is_active, created_at, updated_at`
    )
      .bind(email, hashedPassword, name)
      .first<UserRow>();

    if (!user) {
      throw new HttpError(500, "Could not create admin user");
    }

    await c.env.DB.prepare(
      `INSERT INTO app_admins (user_id, created_by_user_id, created_at)
       VALUES (?, ?, datetime('now'))`
    )
      .bind(user.id, user.id)
      .run();

    const token = await createJWT({ sub: user.id, role: user.role }, c.env.JWT_SECRET);
    await auditLog(c, user.id, null, "admin.bootstrap");

    return c.json(
      {
        user: toClientUser(user, true),
        sessionMode: "header",
        sessionToken: token,
      },
      201
    );
  });
});

api.post("/invites/accept", async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const token = requireString(body.token, "token");
    const password = requireString(body.password, "password");
    const sessionMode = readSessionMode(body.sessionMode);

    if (password.length < 8) {
      throw new HttpError(400, "password must be at least 8 characters");
    }

    const invite = await c.env.DB.prepare(
      `SELECT *
       FROM invites
       WHERE token_hash = ?
       LIMIT 1`
    )
      .bind(await hashInviteToken(token))
      .first<InviteRow>();

    if (!invite) {
      throw new HttpError(404, "This invite link is not valid");
    }

    if (invite.accepted_at) {
      throw new HttpError(409, "This invite has already been accepted");
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new HttpError(410, "This invite link has expired");
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(invite.email)
      .first<{ id: number }>();
    if (existing) {
      throw new HttpError(409, "A user already exists for this invite email");
    }

    if (invite.role === "patient" && !invite.doctor_id) {
      throw new HttpError(500, "Patient invite is missing an assigned doctor");
    }

    const hashedPassword = await hashPassword(password, c.env.BCRYPT_SALT);
    const patientCode = invite.role === "patient" ? await generateUniquePatientCode(c.env.DB) : null;
    const user = await c.env.DB.prepare(
      `INSERT INTO users (email, hashed_password, name, role, patient_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING id, email, hashed_password, name, role, patient_code, is_active, created_at, updated_at`
    )
      .bind(invite.email, hashedPassword, invite.name, invite.role, patientCode)
      .first<UserRow>();

    if (!user) {
      throw new HttpError(500, "Could not create invited user");
    }

    let patient: PatientRow | null = null;
    if (invite.role === "patient") {
      patient = await c.env.DB.prepare(
        `INSERT INTO patients (user_id, doctor_id, support_worker_id, consent_given, consent_date, created_at, updated_at)
         VALUES (?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
         RETURNING *`
      )
        .bind(user.id, invite.doctor_id, invite.support_worker_id)
        .first<PatientRow>();
    }

    await c.env.DB.prepare(
      `UPDATE invites
       SET accepted_at = datetime('now'),
           accepted_by_user_id = ?
       WHERE id = ?`
    )
      .bind(user.id, invite.id)
      .run();

    const authToken = await createJWT({ sub: user.id, role: user.role }, c.env.JWT_SECRET);
    await auditLog(c, user.id, patient?.id ?? null, "invite.accepted");

    return c.json({
      user: toClientUser(user, false),
      sessionMode: sessionMode === "cookie" ? "header" : sessionMode,
      sessionToken: authToken,
    });
  });
});

api.use("*", authMiddleware);

api.get("/auth/me", async (c) => {
  return handleRoute(c, async () => {
    const user = await getUserById(c, c.var.user.id);
    if (!user) {
      throw new HttpError(401, "Please sign in to continue");
    }

    return c.json(toClientUser(user, c.var.user.isAppAdmin));
  });
});

api.get("/admin/overview", requireAppAdmin(), async (c) => {
  return handleRoute(c, async () => {
    const [users, patients, invites] = await Promise.all([
      c.env.DB.prepare(
        `SELECT users.*, app_admins.user_id AS admin_user_id
         FROM users
         LEFT JOIN app_admins ON app_admins.user_id = users.id
         ORDER BY datetime(users.created_at) DESC, users.id DESC`
      ).all<StaffRow>(),
      c.env.DB.prepare(
        `SELECT
           patients.*,
           patient_user.email AS patient_email,
           patient_user.name AS patient_name,
           patient_user.patient_code AS patient_code,
           doctor_user.name AS doctor_name,
           support_user.name AS support_name
         FROM patients
         INNER JOIN users AS patient_user ON patient_user.id = patients.user_id
         INNER JOIN users AS doctor_user ON doctor_user.id = patients.doctor_id
         LEFT JOIN users AS support_user ON support_user.id = patients.support_worker_id
         ORDER BY datetime(patients.created_at) DESC`
      ).all<PatientListRow>(),
      listInvitesForUser(c),
    ]);

    await auditLog(c, c.var.user.id, null, "admin.overview");
    return c.json({
      users: (users.results ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientRole: toClientRole(user.role),
        patientCode: user.patient_code,
        isActive: user.is_active === 1,
        isAppAdmin: user.admin_user_id != null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
      patients: (patients.results ?? []).map(toPatientSummary),
      invites,
      metrics: {
        totalUsers: users.results?.length ?? 0,
        activeUsers: (users.results ?? []).filter((user) => user.is_active === 1).length,
        patients: (patients.results ?? []).length,
        pendingInvites: invites.filter((invite) => invite.acceptedAt == null).length,
      },
    });
  });
});

api.post("/admin/users", requireAppAdmin(), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const email = validateEmail(requireString(body.email, "email"));
    const password = requireString(body.password, "password");
    const name = requireString(body.name, "name");
    const role = normalizeInviteRole(body.role);

    if (role === "patient") {
      throw new HttpError(400, "Patient accounts must be created from an invite link");
    }

    if (password.length < 8) {
      throw new HttpError(400, "password must be at least 8 characters");
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (existing) {
      throw new HttpError(409, "Email is already registered");
    }

    const hashedPassword = await hashPassword(password, c.env.BCRYPT_SALT);
    const user = await c.env.DB.prepare(
      `INSERT INTO users (email, hashed_password, name, role, patient_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
       RETURNING id, email, hashed_password, name, role, patient_code, is_active, created_at, updated_at`
    )
      .bind(email, hashedPassword, name, role)
      .first<UserRow>();

    if (!user) {
      throw new HttpError(500, "Could not create user");
    }

    if (body.isAppAdmin === true || body.isAppAdmin === 1) {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO app_admins (user_id, created_by_user_id, created_at)
         VALUES (?, ?, datetime('now'))`
      )
        .bind(user.id, c.var.user.id)
        .run();
    }

    await auditLog(c, c.var.user.id, null, "admin.user.created");
    return c.json({ user: toPublicUser(user), isAppAdmin: body.isAppAdmin === true || body.isAppAdmin === 1 }, 201);
  });
});

api.patch("/admin/users/:id", requireAppAdmin(), async (c) => {
  return handleRoute(c, async () => {
    const userId = requireInteger(c.req.param("id"), "id");
    const body = await readJsonObject(c);
    const isActive = asBooleanFlag(body.isActive ?? body.is_active);

    if (userId === c.var.user.id && isActive !== 1) {
      throw new HttpError(400, "You cannot deactivate your own admin account");
    }

    const user = await c.env.DB.prepare(
      `UPDATE users
       SET is_active = ?, updated_at = datetime('now')
       WHERE id = ?
       RETURNING id, email, hashed_password, name, role, patient_code, is_active, created_at, updated_at`
    )
      .bind(isActive, userId)
      .first<UserRow>();

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    await auditLog(c, c.var.user.id, null, isActive === 1 ? "admin.user.activated" : "admin.user.deactivated");
    return c.json({ user: toPublicUser(user) });
  });
});

api.get("/staff", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const rows = await c.env.DB.prepare(
      `SELECT users.*, app_admins.user_id AS admin_user_id
       FROM users
       LEFT JOIN app_admins ON app_admins.user_id = users.id
       WHERE users.is_active = 1
         AND users.role IN ('doctor', 'support_worker')
       ORDER BY users.role, lower(users.name)`
    ).all<StaffRow>();

    await auditLog(c, c.var.user.id, null, "view_staff");
    return c.json((rows.results ?? []).map(toStaffSummary));
  });
});

api.get("/invites", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const invites = await listInvitesForUser(c);
    await auditLog(c, c.var.user.id, null, "view_invites");
    return c.json(invites);
  });
});

api.post("/invites", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const role = normalizeInviteRole(body.role);
    if (role !== "patient" && !c.var.user.isAppAdmin) {
      throw new HttpError(403, "Only app admins can invite staff accounts");
    }

    const email = validateEmail(requireString(body.email ?? body.username, "email"));
    const nameParts = [optionalString(body.firstName), optionalString(body.lastName)].filter(Boolean).join(" ").trim();
    const name = optionalString(body.name) ?? (nameParts.length > 0 ? nameParts : email);

    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (existingUser) {
      throw new HttpError(409, "Email is already registered");
    }

    const existingInvite = await c.env.DB.prepare(
      `SELECT id
       FROM invites
       WHERE email = ?
         AND accepted_at IS NULL
         AND datetime(expires_at) > datetime('now')
       LIMIT 1`
    )
      .bind(email)
      .first<{ id: number }>();
    if (existingInvite) {
      throw new HttpError(409, "A live invite already exists for that email");
    }

    let doctorId: number | null = null;
    let supportWorkerId: number | null = null;

    if (role === "patient") {
      doctorId = optionalInteger(body.doctor_id ?? body.doctorId ?? body.assignedDoctorId, "doctor_id");
      supportWorkerId = optionalInteger(
        body.support_worker_id ?? body.supportWorkerId ?? body.assignedStaffUserId,
        "support_worker_id"
      );

      if (!c.var.user.isAppAdmin && c.var.user.role === "doctor") {
        doctorId = c.var.user.id;
      }

      if (!c.var.user.isAppAdmin && c.var.user.role === "support_worker") {
        supportWorkerId = c.var.user.id;
      }

      if (!doctorId) {
        throw new HttpError(400, "A patient invite must include an assigned doctor");
      }

      await requireActiveUserRole(c, doctorId, "doctor");
      if (supportWorkerId) {
        await requireActiveUserRole(c, supportWorkerId, "support_worker");
      }
    }

    const rawToken = generateInviteToken();
    const tokenHash = await hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + getInviteTtlHours(c) * 60 * 60 * 1000).toISOString();

    const invite = await c.env.DB.prepare(
      `INSERT INTO invites (
         token_hash,
         email,
         name,
         role,
         doctor_id,
         support_worker_id,
         created_by_user_id,
         expires_at,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       RETURNING *`
    )
      .bind(tokenHash, email, name, role, doctorId, supportWorkerId, c.var.user.id, expiresAt)
      .first<InviteRow>();

    if (!invite) {
      throw new HttpError(500, "Could not create invite");
    }

    await auditLog(c, c.var.user.id, null, "invite.created");
    return c.json(toInviteResponse(invite, `${getAppBaseUrl(c)}/activate/${rawToken}`), 201);
  });
});

api.post("/patient-assignments", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const staffUserId = requireInteger(body.staffUserId, "staffUserId");
    const staffUser = await getUserById(c, staffUserId);

    if (!staffUser || (staffUser.role !== "doctor" && staffUser.role !== "support_worker")) {
      throw new HttpError(400, "Staff user does not exist or is inactive");
    }

    if (staffUser.role === "doctor") {
      await c.env.DB.prepare(
        `UPDATE patients
         SET doctor_id = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(staffUser.id, patient.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `UPDATE patients
         SET support_worker_id = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(staffUser.id, patient.id)
        .run();
    }

    await auditLog(c, c.var.user.id, patient.id, "patient.assignment.updated");
    return c.json({ patientId: patient.id, staffUserId: staffUser.id, staffRole: staffUser.role }, 201);
  });
});

api.get("/patients", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const whereClause = c.var.user.isAppAdmin
      ? ""
      : "WHERE patients.doctor_id = ? OR patients.support_worker_id = ?";
    const stmt = c.env.DB.prepare(
      `SELECT
         patients.*,
         patient_user.email AS patient_email,
         patient_user.name AS patient_name,
         patient_user.patient_code AS patient_code,
         doctor_user.name AS doctor_name,
         support_user.name AS support_name
       FROM patients
       INNER JOIN users AS patient_user ON patient_user.id = patients.user_id
       INNER JOIN users AS doctor_user ON doctor_user.id = patients.doctor_id
       LEFT JOIN users AS support_user ON support_user.id = patients.support_worker_id
       ${whereClause}
       ORDER BY datetime(patients.created_at) DESC`
    );
    const rows = c.var.user.isAppAdmin
      ? await stmt.all<PatientListRow>()
      : await stmt.bind(c.var.user.id, c.var.user.id).all<PatientListRow>();

    await auditLog(c, c.var.user.id, null, "view_patients");
    return c.json((rows.results ?? []).map(toPatientSummary));
  });
});

api.get("/consent/me", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const patient = await getPatientForUser(c, c.var.user.id);
    if (!patient) {
      throw new HttpError(404, "Patient not found");
    }
    await auditLog(c, c.var.user.id, patient.id, "view_consent");
    return c.json(toConsentRecord(patient));
  });
});

api.put("/consent/me", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    await readJsonObject(c);
    const patient = await getPatientForUser(c, c.var.user.id);
    if (!patient) {
      throw new HttpError(404, "Patient not found");
    }

    const updated = await c.env.DB.prepare(
      `UPDATE patients
       SET consent_given = 1,
           consent_date = COALESCE(consent_date, datetime('now')),
           updated_at = datetime('now')
       WHERE id = ?
       RETURNING *`
    )
      .bind(patient.id)
      .first<PatientRow>();

    await auditLog(c, c.var.user.id, patient.id, "update_consent");
    return c.json(toConsentRecord(updated ?? patient));
  });
});

api.get("/emotions/:patientId", async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const logs = await logsByType(c, patient.id, "mood");
    await auditLog(c, c.var.user.id, patient.id, "view_emotions");
    return c.json(logs.map((log) => toEmotionRecord(log, patient)));
  });
});

api.post("/emotions", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const log = await insertCompatibilityLog(c, patient.id, "patient", "mood", body, optionalString(body.notes));
    await auditLog(c, c.var.user.id, patient.id, "create_emotion");
    return c.json(toEmotionRecord(log, patient), 201);
  });
});

api.patch("/emotions/:id", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const log = await updateCompatibilityLog(c, requireInteger(c.req.param("id"), "id"), body, optionalString(body.notes));
    const patient = await getPatient(c, log.patient_id);
    if (!patient) {
      throw new HttpError(404, "Patient not found");
    }
    await auditLog(c, c.var.user.id, patient.id, "edit_emotion");
    return c.json(toEmotionRecord(log, patient));
  });
});

api.get("/daily-reports/:patientId", async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const reports = await dailyReportsByPatient(c, patient.id);
    await auditLog(c, c.var.user.id, patient.id, "view_daily_reports");
    return c.json(reports.map(dailyReportRowToRecord));
  });
});

api.post("/daily-reports", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const log = await insertCompatibilityLog(c, patient.id, "patient", "sleep", body, optionalString(body.notes));
    const report = await insertDailyReport(c, patient, body, log.id);
    await auditLog(c, c.var.user.id, patient.id, "create_daily_report");
    return c.json(dailyReportRowToRecord(report), 201);
  });
});

api.patch("/daily-reports/:id", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const report = await updateDailyReport(c, requireInteger(c.req.param("id"), "id"), body);
    await auditLog(c, c.var.user.id, report.patient_id, "edit_daily_report");
    return c.json(dailyReportRowToRecord(report));
  });
});

api.get("/weekly-screenings/:patientId", async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const screenings = await weeklyScreeningsByPatient(c, patient.id);
    await auditLog(c, c.var.user.id, patient.id, "view_weekly_screenings");
    return c.json(screenings.map(weeklyScreeningRowToRecord));
  });
});

api.post("/weekly-screenings", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const log = await insertCompatibilityLog(c, patient.id, "patient", "weekly_check", body, optionalString(body.reasonsForLiving));
    const screening = await insertWeeklyScreening(c, patient, body, log.id);
    await auditLog(c, c.var.user.id, patient.id, "create_weekly_screening");
    return c.json(weeklyScreeningRowToRecord(screening), 201);
  });
});

api.patch("/weekly-screenings/:id", requireRole("patient"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const screening = await updateWeeklyScreening(c, requireInteger(c.req.param("id"), "id"), body);
    await auditLog(c, c.var.user.id, screening.patient_id, "edit_weekly_screening");
    return c.json(weeklyScreeningRowToRecord(screening));
  });
});

api.get("/logs", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const whereClause = c.var.user.isAppAdmin ? "" : "AND (patients.doctor_id = ? OR patients.support_worker_id = ?)";
    const stmt = c.env.DB.prepare(
      `SELECT logs.*, patients.user_id
       FROM logs
       INNER JOIN patients ON patients.id = logs.patient_id
       WHERE logs.type = 'mood'
         ${whereClause}
       ORDER BY datetime(logs.created_at) DESC, logs.id DESC
       LIMIT 100`
    );
    const rows = c.var.user.isAppAdmin
      ? await stmt.all<LogRow & { user_id: number }>()
      : await stmt.bind(c.var.user.id, c.var.user.id).all<LogRow & { user_id: number }>();

    const patientIds = [...new Set((rows.results ?? []).map((row) => row.patient_id))];
    const patients = await Promise.all(patientIds.map((id) => getPatient(c, id)));
    const patientMap = new Map(
      patients
        .filter((patient): patient is PatientRow => patient !== null)
        .map((patient) => [patient.id, patient])
    );
    const observationMap = await observationsForLinkedEntities(c, patientIds, "emotion");

    await auditLog(c, c.var.user.id, null, "view_logs");
    return c.json(
      (rows.results ?? []).flatMap((log) => {
        const patient = patientMap.get(log.patient_id);
        return patient
          ? [{ ...toEmotionRecord(log, patient), observations: (observationMap.get(log.id) ?? []).map(observationRowToRecord) }]
          : [];
      })
    );
  });
});

api.get("/daily-reports", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const reports = await listDailyReportsForClinician(c);
    await auditLog(c, c.var.user.id, null, "daily_report.list.view");
    return c.json(reports.map(dailyReportRowToRecord));
  });
});
api.get("/weekly-screenings", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const screenings = await listWeeklyScreeningsForClinician(c);
    await auditLog(c, c.var.user.id, null, "weekly_screening.list.view");
    return c.json(screenings.map(weeklyScreeningRowToRecord));
  });
});
api.get("/observations", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const observations = await listObservationsForClinician(c);
    await auditLog(c, c.var.user.id, null, "observation.list.view");
    return c.json(observations.map(observationRowToRecord));
  });
});
api.get("/observations/:patientId", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const observations = await observationsByPatient(c, patient.id);
    await auditLog(c, c.var.user.id, patient.id, "observation.patient.view");
    return c.json(observations.map(observationRowToRecord));
  });
});
api.post("/observations", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const observation = await insertObservation(c, patient, body);
    await auditLog(c, c.var.user.id, patient.id, "observation.created");
    return c.json(observationRowToRecord(observation), 201);
  });
});
api.patch("/observations/:id/acknowledge", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const observation = await acknowledgeObservation(c, requireInteger(c.req.param("id"), "id"), body);
    await auditLog(c, c.var.user.id, observation.patient_id, "observation.acknowledged");
    return c.json(observationRowToRecord(observation));
  });
});
api.get("/entry-revisions/:patientId", requireRole("doctor", "support_worker"), async (c) => c.json([]));
api.get("/medications", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const medications = await listMedicationsForClinician(c);
    await auditLog(c, c.var.user.id, null, "medication.list.view");
    return c.json(medications.map(medicationRowToRecord));
  });
});
api.post("/medications", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const medication = await insertMedication(c, patient, body);
    await auditLog(c, c.var.user.id, patient.id, "medication.created");
    return c.json(medicationRowToRecord(medication), 201);
  });
});
api.get("/medications/:patientId", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const medications = await medicationsByPatient(c, patient.id);
    await auditLog(c, c.var.user.id, patient.id, "medication.patient.view");
    return c.json(medications.map(medicationRowToRecord));
  });
});
api.patch("/medications/:id", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const medication = await updateMedication(c, requireInteger(c.req.param("id"), "id"), body);
    await auditLog(c, c.var.user.id, medication.patient_id, "medication.updated");
    return c.json(medicationRowToRecord(medication));
  });
});
api.get("/care-plan/:patientId", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const carePlan = await getCarePlanByPatientId(c, patient.id);
    await auditLog(c, c.var.user.id, patient.id, "care_plan.patient.view");
    return c.json(carePlan ? carePlanRowToRecord(carePlan) : null);
  });
});
api.post("/care-plan", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(body.patientId, "patientId"));
    const carePlan = await insertCarePlan(c, patient, body);
    await auditLog(c, c.var.user.id, patient.id, "care_plan.created");
    return c.json(carePlanRowToRecord(carePlan), 201);
  });
});
api.patch("/care-plan/:patientId", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patient = await resolveAccessiblePatient(c, requireString(c.req.param("patientId"), "patientId"));
    const carePlan = await updateCarePlan(c, patient, body);
    await auditLog(c, c.var.user.id, patient.id, "care_plan.updated");
    return c.json(carePlanRowToRecord(carePlan));
  });
});
api.get("/pilot-metrics", requireRole("doctor", "support_worker"), async (c) => c.json(emptyPilotMetrics()));
api.get("/demo-mode", requireRole("doctor", "support_worker"), async (c) =>
  c.json({ enabled: false, syntheticOnly: true, activeScenarioId: null, scenarios: [] })
);

api.get("/patients/:id", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const patientId = requireInteger(c.req.param("id"), "id");
    const patient = await assertAssignedClinician(c, patientId);
    const logs = await c.env.DB.prepare(
      `SELECT *
       FROM logs
       WHERE patient_id = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 50`
    )
      .bind(patientId)
      .all<LogRow>();

    await auditLog(c, c.var.user.id, patientId, "view_profile");
    return c.json({
      patient,
      recent_logs: (logs.results ?? []).map(serializeLog),
    });
  });
});

api.post("/logs", async (c) => {
  return handleRoute(c, async () => {
    const body = await readJsonObject(c);
    const patientId = requireInteger(body.patient_id, "patient_id");
    const source = requireString(body.source, "source") as LogSource;
    const type = requireString(body.type, "type") as LogType;

    if (!logSources.has(source)) {
      throw new HttpError(400, "source must be patient or support_worker");
    }

    if (!logTypes.has(type)) {
      throw new HttpError(400, "Invalid log type");
    }

    await assertCanCreateLog(c, patientId, source);
    validateStructuredLog(type, body.value);

    const insertedLog = await c.env.DB.prepare(
      `INSERT INTO logs (patient_id, source, type, value, note, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       RETURNING *`
    )
      .bind(patientId, source, type, jsonValue(body.value), optionalString(body.note))
      .first<LogRow>();

    if (!insertedLog) {
      throw new HttpError(500, "Could not create log");
    }

    await insertStructuredLog(c, insertedLog, body.value);
    await checkForMismatch(c, insertedLog);
    await checkForCrisisLanguage(c, patientId, body.value, optionalString(body.note));
    await auditLog(c, c.var.user.id, patientId, "create_log");

    return c.json({ log: serializeLog(insertedLog) }, 201);
  });
});

api.patch("/logs/:id", async (c) => {
  return handleRoute(c, async () => {
    const logId = requireInteger(c.req.param("id"), "id");
    const body = await readJsonObject(c);
    const existing = await c.env.DB.prepare(
      `SELECT logs.*
       FROM logs
       WHERE logs.id = ?`
    )
      .bind(logId)
      .first<LogRow>();

    if (!existing) {
      throw new HttpError(404, "Log not found");
    }

    const patient = await requirePatientAccess(c, existing.patient_id);
    const user = c.var.user;
    const isAuthor =
      (user.role === "patient" && patient.user_id === user.id && existing.source === "patient") ||
      (user.role === "support_worker" && patient.support_worker_id === user.id && existing.source === "support_worker");

    const isAssignedEditor =
      (user.role === "doctor" && patient.doctor_id === user.id) ||
      (user.role === "support_worker" && patient.support_worker_id === user.id);

    if (!isAuthor && !isAssignedEditor) {
      throw new HttpError(403, "Forbidden");
    }

    const nextValue = body.value === undefined ? existing.value : jsonValue(body.value);
    const nextNote = body.note === undefined ? existing.note : optionalString(body.note);
    validateStructuredLog(existing.type, parseStoredJson(nextValue));

    await c.env.DB.prepare(
      `UPDATE logs
       SET value = ?, note = ?
       WHERE id = ?`
    )
      .bind(nextValue, nextNote, existing.id)
      .run();

    await c.env.DB.prepare(
      `INSERT INTO log_edits (log_id, old_value, new_value, edited_by_user_id, edited_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        existing.id,
        JSON.stringify({ value: parseStoredJson(existing.value), note: existing.note }),
        JSON.stringify({ value: parseStoredJson(nextValue), note: nextNote }),
        user.id
      )
      .run();

    const updated = await c.env.DB.prepare("SELECT * FROM logs WHERE id = ?").bind(existing.id).first<LogRow>();
    await auditLog(c, user.id, existing.patient_id, "edit_log");

    return c.json({ log: updated ? serializeLog(updated) : null });
  });
});

api.get("/patients/:id/summary", async (c) => {
  return handleRoute(c, async () => {
    const patientId = requireInteger(c.req.param("id"), "id");
    const patient = await requirePatientAccess(c, patientId);
    const since = patient.last_visit_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [mood, stress, sleep, meals, medication] = await Promise.all([
      summarizeNumericLogs(c, patientId, "mood", since, ["score", "rating", "mood", "value"]),
      summarizeNumericLogs(c, patientId, "stress", since, ["score", "rating", "stress", "value"]),
      summarizeNumericLogs(c, patientId, "sleep", since, ["hours", "duration", "sleep_hours", "value"]),
      summarizeMeals(c, patientId, since),
      summarizeMedication(c, patientId, since),
    ]);

    let latestRisk = await c.env.DB.prepare(
      `SELECT *
       FROM risk_scores
       WHERE patient_id = ?
       ORDER BY datetime(calculated_at) DESC, id DESC
       LIMIT 1`
    )
      .bind(patientId)
      .first<RiskScoreRow>();

    if (!latestRisk) {
      latestRisk = await calculateAndStoreRisk(c, patientId);
    }

    await auditLog(c, c.var.user.id, patientId, "view_summary");
    return c.json({
      patient_id: patientId,
      since,
      mood,
      stress,
      sleep,
      meals,
      medication_adherence: medication,
      risk_score: latestRisk ? serializeRiskScore(latestRisk) : null,
    });
  });
});

api.post("/patients/:id/calculate-risk", requireRole("doctor", "support_worker"), async (c) => {
  return handleRoute(c, async () => {
    const patientId = requireInteger(c.req.param("id"), "id");
    await assertAssignedClinician(c, patientId);
    const riskScore = await calculateAndStoreRisk(c, patientId);
    await auditLog(c, c.var.user.id, patientId, "calculate_risk");
    return c.json({ risk_score: serializeRiskScore(riskScore) }, 201);
  });
});

app.route("/api", api);

app.notFound((c) => c.json({ error: "Not found" }, 404));

async function requireActiveUserRole(c: AppContext, userId: number, role: UserRole): Promise<void> {
  const user = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = ? AND is_active = 1")
    .bind(userId, role)
    .first<{ id: number }>();
  if (!user) {
    throw new HttpError(400, `${role} id ${userId} does not exist or is inactive`);
  }
}

async function resolveAccessiblePatient(c: AppContext, identifier: string): Promise<PatientRow> {
  const trimmed = identifier.trim();
  const numericId = Number(trimmed);
  let patient: PatientRow | null = null;

  if (Number.isInteger(numericId) && numericId > 0) {
    patient = await getPatient(c, numericId);
  }

  if (!patient) {
    patient = await c.env.DB.prepare(
      `SELECT patients.*
       FROM patients
       INNER JOIN users ON users.id = patients.user_id
       WHERE users.patient_code = ? OR lower(users.email) = lower(?)
       LIMIT 1`
    )
      .bind(trimmed, trimmed)
      .first<PatientRow>();
  }

  if (!patient) {
    throw new HttpError(404, "Patient not found");
  }

  return requirePatientAccess(c, patient.id);
}

async function logsByType(c: AppContext, patientId: number, type: LogType): Promise<LogRow[]> {
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM logs
     WHERE patient_id = ? AND type = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 100`
  )
    .bind(patientId, type)
    .all<LogRow>();

  return rows.results ?? [];
}

async function dailyReportsByPatient(c: AppContext, patientId: number): Promise<DailyReportRow[]> {
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM daily_reports
     WHERE patient_id = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 100`
  )
    .bind(patientId)
    .all<DailyReportRow>();

  return rows.results ?? [];
}

async function weeklyScreeningsByPatient(c: AppContext, patientId: number): Promise<WeeklyScreeningRow[]> {
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM weekly_screenings
     WHERE patient_id = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 100`
  )
    .bind(patientId)
    .all<WeeklyScreeningRow>();

  return rows.results ?? [];
}

async function listDailyReportsForClinician(c: AppContext): Promise<DailyReportRow[]> {
  const whereClause = c.var.user.isAppAdmin ? "" : "WHERE patients.doctor_id = ? OR patients.support_worker_id = ?";
  const stmt = c.env.DB.prepare(
    `SELECT daily_reports.*
     FROM daily_reports
     INNER JOIN patients ON patients.id = daily_reports.patient_id
     ${whereClause}
     ORDER BY datetime(daily_reports.created_at) DESC, daily_reports.id DESC
     LIMIT 200`
  );
  const rows = c.var.user.isAppAdmin
    ? await stmt.all<DailyReportRow>()
    : await stmt.bind(c.var.user.id, c.var.user.id).all<DailyReportRow>();

  return rows.results ?? [];
}

async function listWeeklyScreeningsForClinician(c: AppContext): Promise<WeeklyScreeningRow[]> {
  const whereClause = c.var.user.isAppAdmin ? "" : "WHERE patients.doctor_id = ? OR patients.support_worker_id = ?";
  const stmt = c.env.DB.prepare(
    `SELECT weekly_screenings.*
     FROM weekly_screenings
     INNER JOIN patients ON patients.id = weekly_screenings.patient_id
     ${whereClause}
     ORDER BY datetime(weekly_screenings.created_at) DESC, weekly_screenings.id DESC
     LIMIT 200`
  );
  const rows = c.var.user.isAppAdmin
    ? await stmt.all<WeeklyScreeningRow>()
    : await stmt.bind(c.var.user.id, c.var.user.id).all<WeeklyScreeningRow>();

  return rows.results ?? [];
}

async function insertDailyReport(
  c: AppContext,
  patient: PatientRow,
  body: JsonObject,
  legacyLogId: number | null
): Promise<DailyReportRow> {
  const inserted = await c.env.DB.prepare(
    `INSERT INTO daily_reports (
       patient_id, client_patient_id, report_type, bed_time, wake_time, sleep_quality,
       wake_ups, felt_rested, meals_count, meals_note, notes, legacy_log_id,
       updated_at, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     RETURNING *`
  )
    .bind(
      patient.id,
      typeof body.patientId === "string" ? body.patientId : String(patient.id),
      body.reportType === "night" ? "night" : "morning",
      optionalString(body.bedTime),
      optionalString(body.wakeTime),
      optionalString(body.sleepQuality),
      optionalNumber(body.wakeUps),
      optionalBooleanFlag(body.feltRested),
      optionalNumber(body.mealsCount),
      optionalString(body.mealsNote),
      optionalString(body.notes),
      legacyLogId
    )
    .first<DailyReportRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not create daily report");
  }

  return inserted;
}

async function updateDailyReport(c: AppContext, reportId: number, body: JsonObject): Promise<DailyReportRow> {
  const existing = await c.env.DB.prepare("SELECT * FROM daily_reports WHERE id = ?")
    .bind(reportId)
    .first<DailyReportRow>();
  if (!existing) {
    throw new HttpError(404, "Daily report not found");
  }

  const patient = await requirePatientAccess(c, existing.patient_id);
  if (c.var.user.role !== "patient" || patient.user_id !== c.var.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  const updated = await c.env.DB.prepare(
    `UPDATE daily_reports
     SET report_type = ?,
         bed_time = ?,
         wake_time = ?,
         sleep_quality = ?,
         wake_ups = ?,
         felt_rested = ?,
         meals_count = ?,
         meals_note = ?,
         notes = ?,
         updated_at = datetime('now'),
         edit_count = edit_count + 1
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      body.reportType === "night" ? "night" : "morning",
      optionalString(body.bedTime),
      optionalString(body.wakeTime),
      optionalString(body.sleepQuality),
      optionalNumber(body.wakeUps),
      optionalBooleanFlag(body.feltRested),
      optionalNumber(body.mealsCount),
      optionalString(body.mealsNote),
      optionalString(body.notes),
      existing.id
    )
    .first<DailyReportRow>();

  if (!updated) {
    throw new HttpError(500, "Could not update daily report");
  }

  if (existing.legacy_log_id !== null) {
    await updateCompatibilityLog(c, existing.legacy_log_id, body, optionalString(body.notes));
  }

  return updated;
}

async function insertWeeklyScreening(
  c: AppContext,
  patient: PatientRow,
  body: JsonObject,
  legacyLogId: number | null
): Promise<WeeklyScreeningRow> {
  const inserted = await c.env.DB.prepare(
    `INSERT INTO weekly_screenings (
       patient_id, client_patient_id, wished_dead, family_better_off_dead,
       thoughts_killing_self, thoughts_killing_self_frequency, ever_tried_to_kill_self,
       attempt_timing, current_thoughts, depressed_hard_to_function, depressed_frequency,
       anxious_on_edge, anxious_frequency, hopeless, could_not_enjoy_things,
       keeping_to_self, more_irritable, substance_use_more_than_usual,
       substance_use_frequency, sleep_trouble, sleep_trouble_frequency, appetite_change,
       appetite_change_direction, support_person, reasons_for_living, coping_plan,
       needs_help_staying_safe, legacy_log_id, updated_at, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     RETURNING *`
  )
    .bind(
      patient.id,
      typeof body.patientId === "string" ? body.patientId : String(patient.id),
      asBooleanFlag(body.wishedDead),
      asBooleanFlag(body.familyBetterOffDead),
      asBooleanFlag(body.thoughtsKillingSelf),
      optionalString(body.thoughtsKillingSelfFrequency),
      asBooleanFlag(body.everTriedToKillSelf),
      optionalString(body.attemptTiming) ?? "none",
      optionalBooleanFlag(body.currentThoughts),
      asBooleanFlag(body.depressedHardToFunction),
      optionalString(body.depressedFrequency),
      asBooleanFlag(body.anxiousOnEdge),
      optionalString(body.anxiousFrequency),
      asBooleanFlag(body.hopeless),
      asBooleanFlag(body.couldNotEnjoyThings),
      asBooleanFlag(body.keepingToSelf),
      asBooleanFlag(body.moreIrritable),
      asBooleanFlag(body.substanceUseMoreThanUsual),
      optionalString(body.substanceUseFrequency),
      asBooleanFlag(body.sleepTrouble),
      optionalString(body.sleepTroubleFrequency),
      asBooleanFlag(body.appetiteChange),
      optionalString(body.appetiteChangeDirection),
      optionalString(body.supportPerson),
      optionalString(body.reasonsForLiving),
      optionalString(body.copingPlan),
      optionalBooleanFlag(body.needsHelpStayingSafe),
      legacyLogId
    )
    .first<WeeklyScreeningRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not create weekly screening");
  }

  return inserted;
}

async function updateWeeklyScreening(c: AppContext, screeningId: number, body: JsonObject): Promise<WeeklyScreeningRow> {
  const existing = await c.env.DB.prepare("SELECT * FROM weekly_screenings WHERE id = ?")
    .bind(screeningId)
    .first<WeeklyScreeningRow>();
  if (!existing) {
    throw new HttpError(404, "Weekly screening not found");
  }

  const patient = await requirePatientAccess(c, existing.patient_id);
  if (c.var.user.role !== "patient" || patient.user_id !== c.var.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  const updated = await c.env.DB.prepare(
    `UPDATE weekly_screenings
     SET wished_dead = ?,
         family_better_off_dead = ?,
         thoughts_killing_self = ?,
         thoughts_killing_self_frequency = ?,
         ever_tried_to_kill_self = ?,
         attempt_timing = ?,
         current_thoughts = ?,
         depressed_hard_to_function = ?,
         depressed_frequency = ?,
         anxious_on_edge = ?,
         anxious_frequency = ?,
         hopeless = ?,
         could_not_enjoy_things = ?,
         keeping_to_self = ?,
         more_irritable = ?,
         substance_use_more_than_usual = ?,
         substance_use_frequency = ?,
         sleep_trouble = ?,
         sleep_trouble_frequency = ?,
         appetite_change = ?,
         appetite_change_direction = ?,
         support_person = ?,
         reasons_for_living = ?,
         coping_plan = ?,
         needs_help_staying_safe = ?,
         updated_at = datetime('now'),
         edit_count = edit_count + 1
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      asBooleanFlag(body.wishedDead),
      asBooleanFlag(body.familyBetterOffDead),
      asBooleanFlag(body.thoughtsKillingSelf),
      optionalString(body.thoughtsKillingSelfFrequency),
      asBooleanFlag(body.everTriedToKillSelf),
      optionalString(body.attemptTiming) ?? "none",
      optionalBooleanFlag(body.currentThoughts),
      asBooleanFlag(body.depressedHardToFunction),
      optionalString(body.depressedFrequency),
      asBooleanFlag(body.anxiousOnEdge),
      optionalString(body.anxiousFrequency),
      asBooleanFlag(body.hopeless),
      asBooleanFlag(body.couldNotEnjoyThings),
      asBooleanFlag(body.keepingToSelf),
      asBooleanFlag(body.moreIrritable),
      asBooleanFlag(body.substanceUseMoreThanUsual),
      optionalString(body.substanceUseFrequency),
      asBooleanFlag(body.sleepTrouble),
      optionalString(body.sleepTroubleFrequency),
      asBooleanFlag(body.appetiteChange),
      optionalString(body.appetiteChangeDirection),
      optionalString(body.supportPerson),
      optionalString(body.reasonsForLiving),
      optionalString(body.copingPlan),
      optionalBooleanFlag(body.needsHelpStayingSafe),
      existing.id
    )
    .first<WeeklyScreeningRow>();

  if (!updated) {
    throw new HttpError(500, "Could not update weekly screening");
  }

  if (existing.legacy_log_id !== null) {
    await updateCompatibilityLog(c, existing.legacy_log_id, body, optionalString(body.reasonsForLiving));
  }

  return updated;
}

async function observationsByPatient(c: AppContext, patientId: number): Promise<ObservationRow[]> {
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM observations
     WHERE patient_id = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 100`
  )
    .bind(patientId)
    .all<ObservationRow>();

  return rows.results ?? [];
}

async function listObservationsForClinician(c: AppContext): Promise<ObservationRow[]> {
  const whereClause = c.var.user.isAppAdmin ? "" : "WHERE patients.doctor_id = ? OR patients.support_worker_id = ?";
  const stmt = c.env.DB.prepare(
    `SELECT observations.*
     FROM observations
     INNER JOIN patients ON patients.id = observations.patient_id
     ${whereClause}
     ORDER BY datetime(observations.created_at) DESC, observations.id DESC
     LIMIT 200`
  );
  const rows = c.var.user.isAppAdmin
    ? await stmt.all<ObservationRow>()
    : await stmt.bind(c.var.user.id, c.var.user.id).all<ObservationRow>();

  return rows.results ?? [];
}

async function getObservationById(c: AppContext, observationId: number): Promise<ObservationRow | null> {
  return c.env.DB.prepare("SELECT * FROM observations WHERE id = ?")
    .bind(observationId)
    .first<ObservationRow>();
}

async function observationsForLinkedEntities(
  c: AppContext,
  patientIds: number[],
  linkedEntityType: "emotion" | "daily_report" | "weekly_screening"
): Promise<Map<number, ObservationRow[]>> {
  if (patientIds.length === 0) {
    return new Map();
  }

  const placeholders = patientIds.map(() => "?").join(", ");
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM observations
     WHERE linked_entity_type = ?
       AND patient_id IN (${placeholders})
     ORDER BY datetime(created_at) DESC, id DESC`
  )
    .bind(linkedEntityType, ...patientIds)
    .all<ObservationRow>();

  const byLinkedId = new Map<number, ObservationRow[]>();
  for (const row of rows.results ?? []) {
    if (row.linked_entity_id === null) {
      continue;
    }
    const current = byLinkedId.get(row.linked_entity_id) ?? [];
    current.push(row);
    byLinkedId.set(row.linked_entity_id, current);
  }
  return byLinkedId;
}

async function displayNameForUser(c: AppContext, userId: number): Promise<string> {
  const row = await c.env.DB.prepare("SELECT name, email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ name: string; email: string }>();
  return row?.name ?? row?.email ?? `User ${userId}`;
}

function readObservationType(value: unknown): ObservationRow["observation_type"] {
  return value === "Behavioral" || value === "Progress" || value === "Recommendation" || value === "Alert"
    ? value
    : "Clinical";
}

function readObservationPriority(value: unknown): ObservationRow["priority"] {
  return value === "Low" || value === "High" || value === "Critical" || value === "Urgent" ? value : "Medium";
}

function readLinkedEntityType(value: unknown): ObservationRow["linked_entity_type"] {
  return value === "emotion" || value === "daily_report" || value === "weekly_screening" || value === "observation"
    ? value
    : null;
}

async function insertObservation(c: AppContext, patient: PatientRow, body: JsonObject): Promise<ObservationRow> {
  const linkedEntityType = readLinkedEntityType(body.linkedEntityType);
  const linkedEntityId = optionalInteger(body.linkedEntityId, "linkedEntityId");
  if ((linkedEntityType === null) !== (linkedEntityId === null)) {
    throw new HttpError(400, "Linked entity type and linked entity ID must be provided together");
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO observations (
       patient_id, client_patient_id, observation_type, observation, priority,
       support_worker_name, linked_entity_type, linked_entity_id, system_generated, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     RETURNING *`
  )
    .bind(
      patient.id,
      typeof body.patientId === "string" ? body.patientId : String(patient.id),
      readObservationType(body.observationType),
      requireString(body.observation, "observation"),
      readObservationPriority(body.priority),
      optionalString(body.supportWorkerName) ?? (await displayNameForUser(c, c.var.user.id)),
      linkedEntityType,
      linkedEntityId,
      asBooleanFlag(body.systemGenerated)
    )
    .first<ObservationRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not create observation");
  }

  return inserted;
}

async function acknowledgeObservation(c: AppContext, observationId: number, body: JsonObject): Promise<ObservationRow> {
  const existing = await getObservationById(c, observationId);
  if (!existing) {
    throw new HttpError(404, "Observation not found");
  }

  await requirePatientAccess(c, existing.patient_id);

  if (existing.observation_type !== "Alert" && existing.priority !== "Critical") {
    throw new HttpError(400, "Only alert observations or critical-priority notes can be acknowledged");
  }

  if (existing.acknowledged_by_user_id !== null && existing.acknowledged_by_user_id !== c.var.user.id) {
    throw new HttpError(409, `This alert is already owned by ${existing.acknowledged_by_name ?? "another support worker"}`);
  }

  const updated = await c.env.DB.prepare(
    `UPDATE observations
     SET status = 'acknowledged',
         ownership_note = ?,
         acknowledged_by_user_id = ?,
         acknowledged_by_name = ?,
         acknowledged_at = datetime('now')
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      optionalString(body.ownershipNote),
      c.var.user.id,
      await displayNameForUser(c, c.var.user.id),
      existing.id
    )
    .first<ObservationRow>();

  if (!updated) {
    throw new HttpError(500, "Could not acknowledge observation");
  }

  return updated;
}

async function medicationsByPatient(c: AppContext, patientId: number): Promise<MedicationRow[]> {
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM medications
     WHERE patient_id = ?
     ORDER BY COALESCE(is_active, 1) DESC, datetime(COALESCE(updated_at, created_at)) DESC, id DESC`
  )
    .bind(patientId)
    .all<MedicationRow>();

  return rows.results ?? [];
}

async function listMedicationsForClinician(c: AppContext): Promise<MedicationRow[]> {
  const whereClause = c.var.user.isAppAdmin ? "" : "WHERE patients.doctor_id = ? OR patients.support_worker_id = ?";
  const stmt = c.env.DB.prepare(
    `SELECT medications.*
     FROM medications
     INNER JOIN patients ON patients.id = medications.patient_id
     ${whereClause}
     ORDER BY medications.patient_id ASC, COALESCE(medications.is_active, 1) DESC, datetime(COALESCE(medications.updated_at, medications.created_at)) DESC`
  );
  const rows = c.var.user.isAppAdmin
    ? await stmt.all<MedicationRow>()
    : await stmt.bind(c.var.user.id, c.var.user.id).all<MedicationRow>();

  return rows.results ?? [];
}

async function getMedicationById(c: AppContext, medicationId: number): Promise<MedicationRow | null> {
  return c.env.DB.prepare("SELECT * FROM medications WHERE id = ?").bind(medicationId).first<MedicationRow>();
}

async function insertMedication(c: AppContext, patient: PatientRow, body: JsonObject): Promise<MedicationRow> {
  const inserted = await c.env.DB.prepare(
    `INSERT INTO medications (
       patient_id, name, dosage, frequency, start_date, end_date, purpose,
       side_effects, adherence_notes, is_active, updated_by, updated_at, created_at
     )
     VALUES (?, ?, ?, ?, date('now'), NULL, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     RETURNING *`
  )
    .bind(
      patient.id,
      requireString(body.medicationName, "medicationName"),
      optionalString(body.dose) ?? "",
      optionalString(body.schedule) ?? "",
      optionalString(body.purpose),
      optionalString(body.sideEffects),
      optionalString(body.adherenceNotes),
      body.isActive === false ? 0 : 1,
      optionalString(body.updatedBy) ?? (await displayNameForUser(c, c.var.user.id))
    )
    .first<MedicationRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not create medication");
  }

  return inserted;
}

async function updateMedication(c: AppContext, medicationId: number, body: JsonObject): Promise<MedicationRow> {
  const existing = await getMedicationById(c, medicationId);
  if (!existing) {
    throw new HttpError(404, "Medication not found");
  }

  await requirePatientAccess(c, existing.patient_id);

  const updated = await c.env.DB.prepare(
    `UPDATE medications
     SET name = ?,
         dosage = ?,
         frequency = ?,
         purpose = ?,
         side_effects = ?,
         adherence_notes = ?,
         is_active = ?,
         updated_by = ?,
         updated_at = datetime('now'),
         end_date = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(end_date, date('now')) END
     WHERE id = ?
     RETURNING *`
  )
    .bind(
      requireString(body.medicationName, "medicationName"),
      optionalString(body.dose) ?? "",
      optionalString(body.schedule) ?? "",
      optionalString(body.purpose),
      optionalString(body.sideEffects),
      optionalString(body.adherenceNotes),
      body.isActive === false ? 0 : 1,
      optionalString(body.updatedBy) ?? (await displayNameForUser(c, c.var.user.id)),
      body.isActive === false ? 0 : 1,
      existing.id
    )
    .first<MedicationRow>();

  if (!updated) {
    throw new HttpError(500, "Could not update medication");
  }

  return updated;
}

async function getCarePlanByPatientId(c: AppContext, patientId: number): Promise<CarePlanRow | null> {
  return c.env.DB.prepare("SELECT * FROM care_plans WHERE patient_id = ?").bind(patientId).first<CarePlanRow>();
}

async function insertCarePlan(c: AppContext, patient: PatientRow, body: JsonObject): Promise<CarePlanRow> {
  const existing = await getCarePlanByPatientId(c, patient.id);
  if (existing) {
    throw new HttpError(409, "A care plan already exists for this patient");
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO care_plans (
       patient_id, client_patient_id, goals, triggers, warning_signs, what_helps,
       support_contacts, preferred_follow_up_notes, updated_by, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     RETURNING *`
  )
    .bind(
      patient.id,
      typeof body.patientId === "string" ? body.patientId : String(patient.id),
      optionalString(body.goals),
      optionalString(body.triggers),
      optionalString(body.warningSigns),
      optionalString(body.whatHelps),
      optionalString(body.supportContacts),
      optionalString(body.preferredFollowUpNotes),
      optionalString(body.updatedBy) ?? (await displayNameForUser(c, c.var.user.id))
    )
    .first<CarePlanRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not create care plan");
  }

  return inserted;
}

async function updateCarePlan(c: AppContext, patient: PatientRow, body: JsonObject): Promise<CarePlanRow> {
  const updated = await c.env.DB.prepare(
    `UPDATE care_plans
     SET goals = ?,
         triggers = ?,
         warning_signs = ?,
         what_helps = ?,
         support_contacts = ?,
         preferred_follow_up_notes = ?,
         updated_by = ?,
         updated_at = datetime('now')
     WHERE patient_id = ?
     RETURNING *`
  )
    .bind(
      optionalString(body.goals),
      optionalString(body.triggers),
      optionalString(body.warningSigns),
      optionalString(body.whatHelps),
      optionalString(body.supportContacts),
      optionalString(body.preferredFollowUpNotes),
      optionalString(body.updatedBy) ?? (await displayNameForUser(c, c.var.user.id)),
      patient.id
    )
    .first<CarePlanRow>();

  if (!updated) {
    throw new HttpError(404, "Care plan not found");
  }

  return updated;
}

async function insertCompatibilityLog(
  c: AppContext,
  patientId: number,
  source: LogSource,
  type: LogType,
  value: unknown,
  note: string | null
): Promise<LogRow> {
  await assertCanCreateLog(c, patientId, source);
  const insertedLog = await c.env.DB.prepare(
    `INSERT INTO logs (patient_id, source, type, value, note, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     RETURNING *`
  )
    .bind(patientId, source, type, jsonValue(value), note)
    .first<LogRow>();

  if (!insertedLog) {
    throw new HttpError(500, "Could not create log");
  }

  await checkForCrisisLanguage(c, patientId, value, note);
  return insertedLog;
}

async function updateCompatibilityLog(
  c: AppContext,
  logId: number,
  value: unknown,
  note: string | null
): Promise<LogRow> {
  const existing = await c.env.DB.prepare("SELECT * FROM logs WHERE id = ?").bind(logId).first<LogRow>();
  if (!existing) {
    throw new HttpError(404, "Log not found");
  }

  const patient = await requirePatientAccess(c, existing.patient_id);
  if (c.var.user.role === "patient" && (patient.user_id !== c.var.user.id || existing.source !== "patient")) {
    throw new HttpError(403, "Forbidden");
  }

  const nextValue = jsonValue(value);
  await c.env.DB.prepare("UPDATE logs SET value = ?, note = ? WHERE id = ?")
    .bind(nextValue, note, existing.id)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO log_edits (log_id, old_value, new_value, edited_by_user_id, edited_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      existing.id,
      JSON.stringify({ value: parseStoredJson(existing.value), note: existing.note }),
      JSON.stringify({ value, note }),
      c.var.user.id
    )
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM logs WHERE id = ?").bind(existing.id).first<LogRow>();
  if (!updated) {
    throw new HttpError(500, "Could not update log");
  }

  await checkForCrisisLanguage(c, existing.patient_id, value, note);
  return updated;
}

function toConsentRecord(patient: PatientRow) {
  const acceptedAt = patient.consent_date ?? patient.created_at;
  return {
    patientId: String(patient.id),
    moodTracking: patient.consent_given === 1,
    sleepReports: patient.consent_given === 1,
    weeklyScreening: patient.consent_given === 1,
    gpsTracking: false,
    acknowledgeStaffedHours: patient.consent_given === 1,
    acknowledgeEmergencyLimits: patient.consent_given === 1,
    acceptedAt,
    updatedAt: patient.updated_at,
  };
}

function toPatientSummary(row: PatientListRow) {
  const { firstName, lastName } = splitName(row.patient_name);
  return {
    id: row.user_id,
    username: row.patient_code ?? row.patient_email,
    role: "patient" as const,
    firstName,
    lastName,
    createdAt: row.created_at,
    assignedStaffUserIds: [row.doctor_id, row.support_worker_id].filter((id): id is number => id != null),
    assignedStaffNames: [row.doctor_name, row.support_name].filter((name): name is string => Boolean(name)),
    consent: row.consent_given === 1 ? toConsentRecord(row) : null,
  };
}

function toStaffSummary(row: StaffRow) {
  const { firstName, lastName } = splitName(row.name);
  return {
    id: row.id,
    username: row.email,
    role: "support" as const,
    backendRole: row.role,
    isAppAdmin: row.admin_user_id != null,
    firstName,
    lastName,
  };
}

function toInviteResponse(invite: InviteRow, activationUrl?: string) {
  const { firstName, lastName } = splitName(invite.name);
  return {
    id: invite.id,
    username: invite.email,
    email: invite.email,
    role: toClientRole(invite.role),
    backendRole: invite.role,
    firstName,
    lastName,
    assignedStaffUserId: invite.support_worker_id ?? invite.doctor_id,
    assignedDoctorId: invite.doctor_id,
    assignedSupportWorkerId: invite.support_worker_id,
    createdByUserId: invite.created_by_user_id,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
    acceptedAt: invite.accepted_at,
    ...(activationUrl ? { activationUrl } : {}),
  };
}

async function listInvitesForUser(c: AppContext) {
  const baseQuery = `SELECT *
    FROM invites
    __WHERE__
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 100`;

  if (c.var.user.isAppAdmin) {
    const rows = await c.env.DB.prepare(baseQuery.replace("__WHERE__", "")).all<InviteRow>();
    return (rows.results ?? []).map((invite) => toInviteResponse(invite));
  }

  const rows = await c.env.DB.prepare(
    baseQuery.replace(
      "__WHERE__",
      `WHERE created_by_user_id = ?
          OR doctor_id = ?
          OR support_worker_id = ?`
    )
  )
    .bind(c.var.user.id, c.var.user.id, c.var.user.id)
    .all<InviteRow>();

  return (rows.results ?? []).map((invite) => toInviteResponse(invite));
}

function entryMeta(log: LogRow) {
  return {
    updatedAt: log.created_at,
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High" as const,
    crisisLevel: "none" as const,
    crisisSummary: null,
  };
}

function recordPatientId(value: unknown, patient: PatientRow): string {
  return isJsonObject(value) && typeof value.patientId === "string" ? value.patientId : String(patient.id);
}

function toEmotionRecord(log: LogRow, patient: PatientRow) {
  const value = parseStoredJson(log.value);
  const body = isJsonObject(value) ? value : {};
  return {
    id: log.id,
    patientId: recordPatientId(value, patient),
    emotion: typeof body.emotion === "string" ? body.emotion : "Worried",
    notes: typeof body.notes === "string" ? body.notes : null,
    sleepHours: typeof body.sleepHours === "number" ? body.sleepHours : null,
    stressLevel: typeof body.stressLevel === "number" ? body.stressLevel : null,
    cravingLevel: typeof body.cravingLevel === "number" ? body.cravingLevel : null,
    substanceUseToday: typeof body.substanceUseToday === "boolean" ? body.substanceUseToday : null,
    moneyChangedToday: typeof body.moneyChangedToday === "boolean" ? body.moneyChangedToday : null,
    medicationAdherence: typeof body.medicationAdherence === "string" ? body.medicationAdherence : null,
    missedMedicationName: typeof body.missedMedicationName === "string" ? body.missedMedicationName : null,
    missedMedicationReason: typeof body.missedMedicationReason === "string" ? body.missedMedicationReason : null,
    latitude: typeof body.latitude === "number" ? body.latitude : null,
    longitude: typeof body.longitude === "number" ? body.longitude : null,
    accuracyMeters: typeof body.accuracyMeters === "number" ? body.accuracyMeters : null,
    locationCapturedAt: typeof body.locationCapturedAt === "string" ? body.locationCapturedAt : null,
    timestamp: log.created_at,
    ...entryMeta(log),
  };
}

function toDailyReportRecord(log: LogRow, patient: PatientRow) {
  const value = parseStoredJson(log.value);
  const body = isJsonObject(value) ? value : {};
  return {
    id: log.id,
    patientId: recordPatientId(value, patient),
    reportType: body.reportType === "night" ? "night" : "morning",
    bedTime: typeof body.bedTime === "string" ? body.bedTime : null,
    wakeTime: typeof body.wakeTime === "string" ? body.wakeTime : null,
    sleepQuality: typeof body.sleepQuality === "string" ? body.sleepQuality : null,
    wakeUps: typeof body.wakeUps === "number" ? body.wakeUps : null,
    feltRested: typeof body.feltRested === "boolean" ? body.feltRested : null,
    mealsCount: typeof body.mealsCount === "number" ? body.mealsCount : null,
    mealsNote: typeof body.mealsNote === "string" ? body.mealsNote : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    timestamp: log.created_at,
    ...entryMeta(log),
  };
}

function dailyReportRowToRecord(row: DailyReportRow) {
  return {
    id: row.id,
    patientId: row.client_patient_id ?? String(row.patient_id),
    reportType: row.report_type,
    bedTime: row.bed_time,
    wakeTime: row.wake_time,
    sleepQuality: row.sleep_quality,
    wakeUps: row.wake_ups,
    feltRested: flagToBoolean(row.felt_rested),
    mealsCount: row.meals_count,
    mealsNote: row.meals_note,
    notes: row.notes,
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    editCount: row.edit_count,
    suspiciousEditCount: row.suspicious_edit_count,
    reliabilityLevel: row.reliability_level,
    crisisLevel: row.crisis_level,
    crisisSummary: row.crisis_summary,
  };
}

function toWeeklyScreeningRecord(log: LogRow, patient: PatientRow) {
  const value = parseStoredJson(log.value);
  const body = isJsonObject(value) ? value : {};
  return {
    patientId: recordPatientId(value, patient),
    wishedDead: Boolean(body.wishedDead),
    familyBetterOffDead: Boolean(body.familyBetterOffDead),
    thoughtsKillingSelf: Boolean(body.thoughtsKillingSelf),
    thoughtsKillingSelfFrequency:
      typeof body.thoughtsKillingSelfFrequency === "string" ? body.thoughtsKillingSelfFrequency : null,
    everTriedToKillSelf: Boolean(body.everTriedToKillSelf),
    attemptTiming: typeof body.attemptTiming === "string" ? body.attemptTiming : "none",
    currentThoughts: typeof body.currentThoughts === "boolean" ? body.currentThoughts : null,
    depressedHardToFunction: Boolean(body.depressedHardToFunction),
    depressedFrequency: typeof body.depressedFrequency === "string" ? body.depressedFrequency : null,
    anxiousOnEdge: Boolean(body.anxiousOnEdge),
    anxiousFrequency: typeof body.anxiousFrequency === "string" ? body.anxiousFrequency : null,
    hopeless: Boolean(body.hopeless),
    couldNotEnjoyThings: Boolean(body.couldNotEnjoyThings),
    keepingToSelf: Boolean(body.keepingToSelf),
    moreIrritable: Boolean(body.moreIrritable),
    substanceUseMoreThanUsual: Boolean(body.substanceUseMoreThanUsual),
    substanceUseFrequency: typeof body.substanceUseFrequency === "string" ? body.substanceUseFrequency : null,
    sleepTrouble: Boolean(body.sleepTrouble),
    sleepTroubleFrequency: typeof body.sleepTroubleFrequency === "string" ? body.sleepTroubleFrequency : null,
    appetiteChange: Boolean(body.appetiteChange),
    appetiteChangeDirection: typeof body.appetiteChangeDirection === "string" ? body.appetiteChangeDirection : null,
    supportPerson: typeof body.supportPerson === "string" ? body.supportPerson : null,
    reasonsForLiving: typeof body.reasonsForLiving === "string" ? body.reasonsForLiving : null,
    copingPlan: typeof body.copingPlan === "string" ? body.copingPlan : null,
    needsHelpStayingSafe: typeof body.needsHelpStayingSafe === "boolean" ? body.needsHelpStayingSafe : null,
    id: log.id,
    timestamp: log.created_at,
    ...entryMeta(log),
  };
}

function weeklyScreeningRowToRecord(row: WeeklyScreeningRow) {
  return {
    id: row.id,
    patientId: row.client_patient_id ?? String(row.patient_id),
    wishedDead: row.wished_dead === 1,
    familyBetterOffDead: row.family_better_off_dead === 1,
    thoughtsKillingSelf: row.thoughts_killing_self === 1,
    thoughtsKillingSelfFrequency: row.thoughts_killing_self_frequency,
    everTriedToKillSelf: row.ever_tried_to_kill_self === 1,
    attemptTiming: row.attempt_timing,
    currentThoughts: flagToBoolean(row.current_thoughts),
    depressedHardToFunction: row.depressed_hard_to_function === 1,
    depressedFrequency: row.depressed_frequency,
    anxiousOnEdge: row.anxious_on_edge === 1,
    anxiousFrequency: row.anxious_frequency,
    hopeless: row.hopeless === 1,
    couldNotEnjoyThings: row.could_not_enjoy_things === 1,
    keepingToSelf: row.keeping_to_self === 1,
    moreIrritable: row.more_irritable === 1,
    substanceUseMoreThanUsual: row.substance_use_more_than_usual === 1,
    substanceUseFrequency: row.substance_use_frequency,
    sleepTrouble: row.sleep_trouble === 1,
    sleepTroubleFrequency: row.sleep_trouble_frequency,
    appetiteChange: row.appetite_change === 1,
    appetiteChangeDirection: row.appetite_change_direction,
    supportPerson: row.support_person,
    reasonsForLiving: row.reasons_for_living,
    copingPlan: row.coping_plan,
    needsHelpStayingSafe: flagToBoolean(row.needs_help_staying_safe),
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    editCount: row.edit_count,
    suspiciousEditCount: row.suspicious_edit_count,
    reliabilityLevel: row.reliability_level,
    crisisLevel: row.crisis_level,
    crisisSummary: row.crisis_summary,
  };
}

function observationRowToRecord(row: ObservationRow) {
  return {
    id: row.id,
    patientId: row.client_patient_id ?? String(row.patient_id),
    observationType: row.observation_type,
    observation: row.observation,
    priority: row.priority,
    supportWorkerName: row.support_worker_name,
    linkedEntityType: row.linked_entity_type,
    linkedEntityId: row.linked_entity_id,
    systemGenerated: row.system_generated === 1,
    status: row.status,
    ownershipNote: row.ownership_note,
    acknowledgedByUserId: row.acknowledged_by_user_id,
    acknowledgedByName: row.acknowledged_by_name,
    acknowledgedAt: row.acknowledged_at,
    timestamp: row.created_at,
  };
}

function medicationRowToRecord(row: MedicationRow) {
  return {
    id: row.id,
    patientId: String(row.patient_id),
    medicationName: row.name,
    dose: row.dosage,
    schedule: row.frequency,
    purpose: row.purpose,
    sideEffects: row.side_effects,
    adherenceNotes: row.adherence_notes,
    isActive: row.is_active !== 0,
    updatedBy: row.updated_by ?? "Unknown",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function carePlanRowToRecord(row: CarePlanRow) {
  return {
    patientId: row.client_patient_id ?? String(row.patient_id),
    goals: row.goals,
    triggers: row.triggers,
    warningSigns: row.warning_signs,
    whatHelps: row.what_helps,
    supportContacts: row.support_contacts,
    preferredFollowUpNotes: row.preferred_follow_up_notes,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyRate() {
  return { numerator: 0, denominator: 0, percent: 0 };
}

function emptyPilotMetrics() {
  return {
    activationRate: emptyRate(),
    consentComprehensionRate: emptyRate(),
    dailyCheckInCompletionRate: emptyRate(),
    dailyReportCompletionRate: emptyRate(),
    weeklyScreenCompletionRate: emptyRate(),
    clinicallyUsableEntryRate: emptyRate(),
    editRate: emptyRate(),
    suspiciousEditRate: emptyRate(),
    reliabilityFlagRate: emptyRate(),
    missedMedicationDetailCaptureRate: emptyRate(),
    mealsCompletenessRate: emptyRate(),
    consistencyRate: emptyRate(),
    criticalAlertAcknowledgementRate: emptyRate(),
    criticalAlertSlaRate: emptyRate(),
    averageCriticalAlertAcknowledgementMinutes: null,
    averageSubmissionToReviewMinutes: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function validateStructuredLog(type: LogType, value: unknown): void {
  if (type === "medication") {
    if (!isJsonObject(value)) {
      throw new HttpError(400, "medication value must be an object");
    }
    requireInteger(value.medication_id, "value.medication_id");
    if (value.taken !== undefined && typeof value.taken !== "boolean" && value.taken !== 0 && value.taken !== 1) {
      throw new HttpError(400, "value.taken must be a boolean");
    }
  }

  if (type === "substance") {
    if (!isJsonObject(value)) {
      throw new HttpError(400, "substance value must be an object");
    }
    const substance = requireString(value.substance, "value.substance");
    if (!substances.has(substance)) {
      throw new HttpError(400, "value.substance must be cocaine, cannabis, alcohol, nicotine, or other");
    }
  }

  if (type === "meal") {
    if (!isJsonObject(value)) {
      throw new HttpError(400, "meal value must be an object");
    }
    const mealType = requireString(value.meal_type, "value.meal_type");
    if (!mealTypes.has(mealType)) {
      throw new HttpError(400, "value.meal_type must be breakfast, lunch, dinner, or snack");
    }
  }
}

async function insertStructuredLog(c: AppContext, log: LogRow, value: unknown): Promise<void> {
  if (!isJsonObject(value)) {
    return;
  }

  if (log.type === "medication") {
    await c.env.DB.prepare(
      `INSERT INTO medication_logs (medication_id, log_id, taken, missed_reason, logged_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        requireInteger(value.medication_id, "value.medication_id"),
        log.id,
        asBooleanFlag(value.taken),
        optionalString(value.missed_reason)
      )
      .run();
  }

  if (log.type === "substance") {
    await c.env.DB.prepare(
      `INSERT INTO substance_logs (patient_id, substance, amount, frequency, log_id, logged_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        log.patient_id,
        requireString(value.substance, "value.substance"),
        optionalString(value.amount),
        optionalString(value.frequency),
        log.id
      )
      .run();
  }

  if (log.type === "meal") {
    await c.env.DB.prepare(
      `INSERT INTO meal_logs (patient_id, meal_type, description, skipped, log_id, logged_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        log.patient_id,
        requireString(value.meal_type, "value.meal_type"),
        optionalString(value.description),
        asBooleanFlag(value.skipped),
        log.id
      )
      .run();
  }
}

async function checkForMismatch(c: AppContext, log: LogRow): Promise<void> {
  const patientLog = await latestLogForSource(c, log.patient_id, log.type, "patient");
  const supportLog = await latestLogForSource(c, log.patient_id, log.type, "support_worker");
  if (!patientLog || !supportLog || !valuesDiffer(patientLog.value, supportLog.value)) {
    return;
  }

  await createAlert(
    c,
    log.patient_id,
    "mismatch",
    `Newest patient and support-worker ${log.type} entries do not match.`
  );
}

async function latestLogForSource(
  c: AppContext,
  patientId: number,
  type: LogType,
  source: LogSource
): Promise<LogRow | null> {
  return c.env.DB.prepare(
    `SELECT *
     FROM logs
     WHERE patient_id = ? AND type = ? AND source = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`
  )
    .bind(patientId, type, source)
    .first<LogRow>();
}

async function checkForCrisisLanguage(
  c: AppContext,
  patientId: number,
  value: unknown,
  note: string | null
): Promise<void> {
  const text = `${stableStringify(value)} ${note ?? ""}`.toLowerCase();
  const matchedKeyword = crisisKeywords.find((keyword) => text.includes(keyword));
  if (!matchedKeyword) {
    return;
  }

  await createAlert(
    c,
    patientId,
    "crisis",
    `Potential crisis language detected: "${matchedKeyword}". Immediate clinical review recommended.`
  );
}

async function createAlert(
  c: AppContext,
  patientId: number,
  type: AlertType,
  message: string
): Promise<void> {
  await c.env.DB.prepare(
    `INSERT INTO alerts (patient_id, type, message, acknowledged, created_at)
     VALUES (?, ?, ?, 0, datetime('now'))`
  )
    .bind(patientId, type, message)
    .run();
}

function serializeLog(log: LogRow) {
  return {
    ...log,
    value: parseStoredJson(log.value),
  };
}

function serializeRiskScore(riskScore: RiskScoreRow) {
  return {
    ...riskScore,
    factors: riskScore.factors ? parseStoredJson(riskScore.factors) : null,
  };
}

async function summarizeNumericLogs(
  c: AppContext,
  patientId: number,
  type: LogType,
  since: string,
  keys: string[]
) {
  const rows = await c.env.DB.prepare(
    `SELECT value, created_at
     FROM logs
     WHERE patient_id = ? AND type = ? AND datetime(created_at) >= datetime(?)
     ORDER BY datetime(created_at) ASC, id ASC`
  )
    .bind(patientId, type, since)
    .all<{ value: string; created_at: string }>();

  const values = (rows.results ?? [])
    .map((row) => extractNumericValue(parseStoredJson(row.value), keys))
    .filter((value): value is number => value !== null);

  return {
    count: rows.results?.length ?? 0,
    numeric_count: values.length,
    average: average(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    first: values[0] ?? null,
    latest: values[values.length - 1] ?? null,
    change: values.length >= 2 ? values[values.length - 1] - values[0] : null,
  };
}

async function summarizeMeals(c: AppContext, patientId: number, since: string) {
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) AS skipped
     FROM meal_logs
     WHERE patient_id = ? AND datetime(logged_at) >= datetime(?)`
  )
    .bind(patientId, since)
    .first<{ total: number; skipped: number | null }>();

  const total = row?.total ?? 0;
  const skipped = row?.skipped ?? 0;
  return {
    total,
    skipped,
    eaten: total - skipped,
    skipped_rate: total > 0 ? skipped / total : null,
  };
}

async function summarizeMedication(c: AppContext, patientId: number, since: string) {
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN medication_logs.taken = 1 THEN 1 ELSE 0 END) AS taken
     FROM medication_logs
     INNER JOIN medications ON medications.id = medication_logs.medication_id
     WHERE medications.patient_id = ? AND datetime(medication_logs.logged_at) >= datetime(?)`
  )
    .bind(patientId, since)
    .first<{ total: number; taken: number | null }>();

  const total = row?.total ?? 0;
  const taken = row?.taken ?? 0;
  return {
    total,
    taken,
    missed: total - taken,
    adherence_rate: total > 0 ? taken / total : null,
  };
}

async function calculateAndStoreRisk(c: AppContext, patientId: number): Promise<RiskScoreRow> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const logs = await c.env.DB.prepare(
    `SELECT *
     FROM logs
     WHERE patient_id = ? AND datetime(created_at) >= datetime(?)
     ORDER BY datetime(created_at) ASC, id ASC`
  )
    .bind(patientId, since)
    .all<LogRow>();

  const mealSummary = await summarizeMeals(c, patientId, since);
  const medicationSummary = await summarizeMedication(c, patientId, since);
  const substanceCount = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM substance_logs
     WHERE patient_id = ? AND datetime(logged_at) >= datetime(?)`
  )
    .bind(patientId, since)
    .first<{ total: number }>();

  let score = 0;
  const factors: Record<string, unknown> = {};

  const moodValues = numericSeries(logs.results ?? [], "mood", ["score", "rating", "mood", "value"]);
  if (moodValues.length >= 2) {
    const moodDrop = Math.max(0, moodValues[0] - moodValues[moodValues.length - 1]);
    const contribution = Math.min(25, moodDrop * 5);
    score += contribution;
    factors.mood_change = { first: moodValues[0], latest: moodValues[moodValues.length - 1], contribution };
  }

  const lowMoodCount = moodValues.filter((value) => value <= 2).length;
  if (lowMoodCount > 0) {
    const contribution = Math.min(15, lowMoodCount * 3);
    score += contribution;
    factors.low_mood_entries = { count: lowMoodCount, contribution };
  }

  const stressValues = numericSeries(logs.results ?? [], "stress", ["score", "rating", "stress", "value"]);
  if (stressValues.length >= 2) {
    const stressIncrease = Math.max(0, stressValues[stressValues.length - 1] - stressValues[0]);
    const contribution = Math.min(20, stressIncrease * 4);
    score += contribution;
    factors.stress_change = {
      first: stressValues[0],
      latest: stressValues[stressValues.length - 1],
      contribution,
    };
  }

  const highStressCount = stressValues.filter((value) => value >= 8).length;
  if (highStressCount > 0) {
    const contribution = Math.min(15, highStressCount * 3);
    score += contribution;
    factors.high_stress_entries = { count: highStressCount, contribution };
  }

  if (mealSummary.skipped > 0) {
    const contribution = Math.min(20, mealSummary.skipped * 4);
    score += contribution;
    factors.missed_meals = { count: mealSummary.skipped, contribution };
  }

  if (medicationSummary.missed > 0) {
    const contribution = Math.min(25, medicationSummary.missed * 5);
    score += contribution;
    factors.missed_medication = { count: medicationSummary.missed, contribution };
  }

  const substanceUse = substanceCount?.total ?? 0;
  if (substanceUse > 0) {
    const contribution = Math.min(25, substanceUse * 6);
    score += contribution;
    factors.substance_use = { count: substanceUse, contribution };
  }

  const crisisLogCount = (logs.results ?? []).filter((log) => {
    const text = `${log.value} ${log.note ?? ""}`.toLowerCase();
    return crisisKeywords.some((keyword) => text.includes(keyword));
  }).length;
  if (crisisLogCount > 0) {
    const contribution = Math.min(30, crisisLogCount * 15);
    score += contribution;
    factors.crisis_language = { count: crisisLogCount, contribution };
  }

  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  const level = riskLevel(normalizedScore);
  const inserted = await c.env.DB.prepare(
    `INSERT INTO risk_scores (patient_id, score, level, factors, calculated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     RETURNING *`
  )
    .bind(patientId, normalizedScore, level, JSON.stringify({ window_days: 30, factors }))
    .first<RiskScoreRow>();

  if (!inserted) {
    throw new HttpError(500, "Could not store risk score");
  }

  return inserted;
}

function numericSeries(logs: LogRow[], type: LogType, keys: string[]): number[] {
  return logs
    .filter((log) => log.type === type)
    .map((log) => extractNumericValue(parseStoredJson(log.value), keys))
    .filter((value): value is number => value !== null);
}

function extractNumericValue(value: unknown, keys: string[]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!isJsonObject(value)) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    const numberValue = typeof candidate === "number" ? candidate : Number(candidate);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function riskLevel(score: number): RiskLevel {
  if (score >= 75) {
    return "CRITICAL";
  }
  if (score >= 50) {
    return "HIGH";
  }
  if (score >= 25) {
    return "MEDIUM";
  }
  return "LOW";
}

async function handleRoute(c: AppContext, handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
}

class HttpError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 500 | 503,
    message: string
  ) {
    super(message);
  }
}

export default app;
