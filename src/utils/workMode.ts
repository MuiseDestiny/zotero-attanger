import { getPref, setPref } from "./prefs";

export type WorkMode = "stored" | "linked" | "copy";

function normalizeWorkMode(value: unknown): WorkMode | undefined {
  if (value === "stored" || value === "linked" || value === "copy") {
    return value;
  }
  // Development builds briefly used "keep" for the stored mode.
  if (value === "keep") return "stored";
  return undefined;
}

function legacyWorkMode(): WorkMode {
  const destination = getPref("destDir");
  return getPref("attachType") === "linking" &&
    typeof destination === "string" &&
    Boolean(destination.trim())
    ? "linked"
    : "stored";
}

export function getWorkMode(): WorkMode {
  return normalizeWorkMode(getPref("workMode")) || legacyWorkMode();
}

/**
 * Runs once per profile. Existing options keep their old meaning: linked mode
 * still honors autoMove and moveWithoutDeleting, and source-folder imports
 * delete their input unless the old keep-original option was enabled.
 */
export function initializeWorkMode(): WorkMode {
  const configured = normalizeWorkMode(getPref("workMode"));
  if (configured) {
    if (configured !== getPref("workMode")) setPref("workMode", configured);
    return configured;
  }
  const mode = legacyWorkMode();
  setPref("deleteSourceAfterImport", getPref("moveWithoutDeleting") !== true);
  setPref("workMode", mode);
  return mode;
}

export function setWorkMode(mode: WorkMode) {
  if (!normalizeWorkMode(mode)) return;
  setPref("workMode", mode);
  // Keep the legacy preference meaningful if an older version is reinstalled.
  setPref("attachType", mode === "linked" ? "linking" : "importing");
}

export function shouldMoveNewAttachments() {
  return getWorkMode() === "linked" && getPref("autoMove") === true;
}

export function shouldMirrorAttachments() {
  return getWorkMode() === "copy";
}
