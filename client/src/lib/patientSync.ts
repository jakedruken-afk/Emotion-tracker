export type PatientDraftKey = "mood" | "morning" | "night" | "weekly";

export type PatientSyncQueueItem = {
  id: string;
  patientId: string;
  label: string;
  url: string;
  method: "POST" | "PATCH";
  data: unknown;
  createdAt: string;
  retryCount: number;
  crisisLevel: "none" | "high" | "critical";
};

export type PatientSubmissionReceipt = {
  id: string;
  label: string;
  status: "draft" | "queued" | "synced" | "failed";
  detail: string;
  updatedAt: string;
};

type StoredDraft<TValue> = {
  updatedAt: string;
  value: TValue;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function getDraftStorageKey(patientId: string, draftKey: PatientDraftKey) {
  return `lamb_patient_draft:${patientId}:${draftKey}`;
}

function getQueueStorageKey(patientId: string) {
  return `lamb_patient_sync_queue:${patientId}`;
}

function getReceiptStorageKey(patientId: string) {
  return `lamb_patient_sync_receipts:${patientId}`;
}

function readJson<TValue>(key: string): TValue | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageKey(key: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(key);
}

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadPatientDraft<TValue>(patientId: string, draftKey: PatientDraftKey) {
  return readJson<StoredDraft<TValue>>(getDraftStorageKey(patientId, draftKey));
}

export function savePatientDraft<TValue>(
  patientId: string,
  draftKey: PatientDraftKey,
  value: TValue,
) {
  writeJson(getDraftStorageKey(patientId, draftKey), {
    updatedAt: new Date().toISOString(),
    value,
  } satisfies StoredDraft<TValue>);
}

export function clearPatientDraft(patientId: string, draftKey: PatientDraftKey) {
  removeStorageKey(getDraftStorageKey(patientId, draftKey));
}

export function loadPatientSyncQueue(patientId: string) {
  return readJson<PatientSyncQueueItem[]>(getQueueStorageKey(patientId)) ?? [];
}

export function savePatientSyncQueue(patientId: string, queue: PatientSyncQueueItem[]) {
  writeJson(getQueueStorageKey(patientId), queue);
}

export function enqueuePatientSyncItem(
  patientId: string,
  item: Omit<PatientSyncQueueItem, "id" | "patientId" | "createdAt" | "retryCount">,
) {
  const queue = loadPatientSyncQueue(patientId);
  const queuedItem: PatientSyncQueueItem = {
    id: createLocalId(),
    patientId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    ...item,
  };

  queue.push(queuedItem);
  savePatientSyncQueue(patientId, queue);
  return queuedItem;
}

export function loadPatientSubmissionReceipts(patientId: string) {
  return readJson<PatientSubmissionReceipt[]>(getReceiptStorageKey(patientId)) ?? [];
}

export function savePatientSubmissionReceipts(
  patientId: string,
  receipts: PatientSubmissionReceipt[],
) {
  writeJson(getReceiptStorageKey(patientId), receipts.slice(0, 8));
}

export function upsertPatientSubmissionReceipt(
  patientId: string,
  receipt: Omit<PatientSubmissionReceipt, "updatedAt"> & { updatedAt?: string },
) {
  const receipts = loadPatientSubmissionReceipts(patientId);
  const nextReceipt: PatientSubmissionReceipt = {
    ...receipt,
    updatedAt: receipt.updatedAt ?? new Date().toISOString(),
  };
  const withoutExisting = receipts.filter((current) => current.id !== nextReceipt.id);

  withoutExisting.unshift(nextReceipt);
  savePatientSubmissionReceipts(patientId, withoutExisting);
  return nextReceipt;
}

export function markPatientQueueRetry(
  patientId: string,
  queueItemId: string,
  retryCount: number,
) {
  const queue = loadPatientSyncQueue(patientId).map((item) =>
    item.id === queueItemId
      ? {
          ...item,
          retryCount,
        }
      : item,
  );
  savePatientSyncQueue(patientId, queue);
}

export function removePatientSyncQueueItem(patientId: string, queueItemId: string) {
  const queue = loadPatientSyncQueue(patientId).filter((item) => item.id !== queueItemId);
  savePatientSyncQueue(patientId, queue);
}
