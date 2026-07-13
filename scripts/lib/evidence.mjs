const RESULTS = new Set(["pass", "fail", "unavailable"]);
const PROVENANCE = new Set(["live", "simulated"]);
const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateEvidence(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }

  const errors = [];
  requireText(entry, "revision_fingerprint", errors);
  requireText(entry, "command", errors);
  requireText(entry, "scope", errors);
  requireText(entry, "summary", errors);

  if (typeof entry.summary === "string" && entry.summary.length > 1000) {
    errors.push("summary must be at most 1000 characters");
  }
  if (!RESULTS.has(entry.result)) {
    errors.push("result must be pass, fail, or unavailable");
  }
  if (!PROVENANCE.has(entry.provenance)) {
    errors.push("provenance must be live or simulated");
  }
  if (
    typeof entry.timestamp !== "string" ||
    !OFFSET_TIMESTAMP.test(entry.timestamp) ||
    Number.isNaN(Date.parse(entry.timestamp))
  ) {
    errors.push("timestamp must be an ISO-8601 value with a timezone");
  }

  if (entry.result === "pass" && entry.exit_code !== 0) {
    errors.push("exit_code must be 0 when result is pass");
  } else if (
    entry.result === "fail" &&
    (!Number.isInteger(entry.exit_code) || entry.exit_code === 0)
  ) {
    errors.push("exit_code must be a non-zero integer when result is fail");
  } else if (entry.result === "unavailable" && entry.exit_code !== null) {
    errors.push("exit_code must be null when result is unavailable");
  }

  return errors;
}

export function evidenceRemainsValid(entry, revision) {
  const fingerprint =
    typeof revision === "string" ? revision : revision?.fingerprint;
  return (
    validateEvidence(entry).length === 0 &&
    typeof fingerprint === "string" &&
    entry.revision_fingerprint === fingerprint
  );
}

export function evidenceSupportsCompletion(entry, revision) {
  return (
    evidenceRemainsValid(entry, revision) &&
    entry.provenance === "live" &&
    entry.result === "pass"
  );
}

function requireText(entry, field, errors) {
  if (typeof entry[field] !== "string" || entry[field].trim() === "") {
    errors.push(`${field} must be a non-empty string`);
  }
}
