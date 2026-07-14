const STRICT_SIGNALS = [
  "authorization",
  "authentication",
  "concurrency",
  "credentialGated",
  "credentials",
  "cryptography",
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
  "secrets",
  "signatureVerification",
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
  risk = "standard",
  independentReview = false,
  verificationCurrent = false,
  verificationRequested = false,
} = {}) {
  if (!engineeringWork) {
    return null;
  }
  if (explicitWorkflow !== null) {
    if (explicitWorkflow === "ship") {
      if (!verificationCurrent) return "verify";
      if (risk === "strict" && !independentReview) return "review";
    }
    if (["adapt", "build", "debug", "review", "shape", "ship", "verify"].includes(explicitWorkflow)) {
      return explicitWorkflow;
    }
  }
  if (learningRequest) {
    return "adapt";
  }
  if (deliveryOnly) {
    if (!verificationCurrent) return "verify";
    return risk === "strict" && !independentReview ? "review" : "ship";
  }
  if (reviewRequested) {
    return "review";
  }
  if (needsShaping) {
    return "shape";
  }
  if (causeKnown === false) {
    return "debug";
  }
  if (verificationRequested) {
    return "verify";
  }
  return "build";
}

export function requiredGates(risk) {
  return risk === "strict"
    ? ["independent_review", "current_evidence"]
    : ["current_evidence"];
}

export function selectNextWorkflow({
  current,
  risk = "standard",
  evidenceCurrent = false,
  independentReview = false,
  reviewVerdict = null,
  repairOwner = "build",
  verificationRequested = false,
  deliveryRequested = false,
  crossArtifactClaim = false,
} = {}) {
  if (current === "review") {
    if (risk === "strict" && !independentReview) return "incomplete";
    if (reviewVerdict === "changes_required") {
      return repairOwner === "debug" ? "debug" : "build";
    }
    if (reviewVerdict !== "pass") return "incomplete";
    if (
      evidenceCurrent &&
      !verificationRequested &&
      !deliveryRequested &&
      !crossArtifactClaim
    ) {
      return null;
    }
    return "verify";
  }
  if (current !== "build" && current !== "debug") {
    return null;
  }
  if (risk === "strict") {
    return "review";
  }
  if (
    !evidenceCurrent ||
    verificationRequested ||
    deliveryRequested ||
    crossArtifactClaim
  ) {
    return "verify";
  }
  return null;
}
