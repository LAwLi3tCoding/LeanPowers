const STRICT_SIGNALS = [
  "authorization",
  "concurrency",
  "credentialGated",
  "dataRisk",
  "destructive",
  "irreversible",
  "largeRefactor",
  "migration",
  "payment",
  "privacy",
  "production",
  "reviewHighRisk",
  "security",
];

const STANDARD_SIGNALS = [
  "behaviorChange",
  "boundedUncertainty",
  "dataModelChange",
  "defect",
  "dependencyChange",
  "externalSystem",
  "multiFile",
  "publicBoundaryChange",
  "scopeExpanded",
  "validationFailed",
];

export function classifyRisk(signals = {}) {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return "standard";
  }

  if (
    signals.preferredMode === "strict" ||
    STRICT_SIGNALS.some((signal) => signals[signal] === true)
  ) {
    return "strict";
  }

  if (
    signals.preferredMode === "standard" ||
    signals.causeKnown === false ||
    STANDARD_SIGNALS.some((signal) => signals[signal] === true)
  ) {
    return "standard";
  }

  const leanEligible =
    signals.clear === true &&
    signals.local === true &&
    signals.reversible === true &&
    signals.establishedValidation === true;
  return leanEligible ? "lean" : "standard";
}

export function selectInitialWorkflow({
  engineeringWork = true,
  explicitWorkflow = null,
  learningRequest = false,
  causeKnown = true,
  deliveryOnly = false,
  deliveryRequested = false,
  needsShaping = false,
  reviewRequested = false,
  verificationCurrent = false,
  verificationRequested = false,
} = {}) {
  if (!engineeringWork) {
    return null;
  }
  if (explicitWorkflow !== null) {
    if (explicitWorkflow === "ship" && !verificationCurrent) {
      return "verify";
    }
    if (["adapt", "build", "debug", "review", "shape", "ship", "verify"].includes(explicitWorkflow)) {
      return explicitWorkflow;
    }
  }
  if (learningRequest) {
    return "adapt";
  }
  if (deliveryOnly) {
    return verificationCurrent ? "ship" : "verify";
  }
  if (causeKnown === false) {
    return "debug";
  }
  if (reviewRequested) {
    return "review";
  }
  if (needsShaping) {
    return "shape";
  }
  if (verificationRequested) {
    return "verify";
  }
  return "build";
}
