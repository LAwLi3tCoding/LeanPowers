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
  "diagnosisRequested",
  "externalSystem",
  "multiFile",
  "publicBoundaryChange",
  "scopeExpanded",
  "validationFailed",
];

const INTERNAL_REVIEW_PHASE = "review"; // Internal same-turn phase; never a user handoff.

function isTrue(value) {
  return value === true;
}

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
  diagnosisRequested = false,
  deliveryOnly = false,
  deliveryRequested = false,
  grillingRequested = false,
  needsShaping = false,
  reviewRequested = false,
  risk = "standard",
  independentReview = false,
  verificationCurrent = false,
  verificationRequested = false,
} = {}) {
  if (engineeringWork !== true) {
    return null;
  }
  const explicitWorkflowSignal =
    typeof explicitWorkflow === "string" ? explicitWorkflow : null;
  const normalizedSignals = {
    learningRequest: isTrue(learningRequest),
    diagnosisRequested: isTrue(diagnosisRequested),
    deliveryOnly: isTrue(deliveryOnly),
    deliveryRequested: isTrue(deliveryRequested),
    grillingRequested: isTrue(grillingRequested),
    needsShaping: isTrue(needsShaping),
    reviewRequested: isTrue(reviewRequested),
    risk,
    independentReview: isTrue(independentReview),
    verificationCurrent: isTrue(verificationCurrent),
    verificationRequested: isTrue(verificationRequested),
    causeKnown: causeKnown === false ? false : isTrue(causeKnown),
  };

  if (explicitWorkflow !== null) {
    if (explicitWorkflowSignal === "ship") {
      if (!normalizedSignals.verificationCurrent) return "verify";
      if (
        risk === "strict" &&
        normalizedSignals.independentReview !== true
      ) {
        return INTERNAL_REVIEW_PHASE;
      }
    }
    if ([
      "adapt",
      "build",
      "debug",
      "review",
      "shape",
      "ship",
      "verify",
    ].includes(explicitWorkflowSignal)) {
      return explicitWorkflowSignal;
    }
  }
  if (normalizedSignals.learningRequest) {
    return "adapt";
  }
  if (normalizedSignals.deliveryOnly) {
    if (!normalizedSignals.verificationCurrent) return "verify";
    return risk === "strict"
      && !normalizedSignals.independentReview
      ? INTERNAL_REVIEW_PHASE
      : "ship";
  }
  if (normalizedSignals.reviewRequested) {
    return "review";
  }
  if (normalizedSignals.needsShaping || normalizedSignals.grillingRequested) {
    return "shape";
  }
  if (normalizedSignals.verificationRequested) {
    return "verify";
  }
  if (normalizedSignals.diagnosisRequested || normalizedSignals.causeKnown === false) {
    return "debug";
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
  const normalizedVerificationRequested = isTrue(verificationRequested);
  const normalizedDeliveryRequested = isTrue(deliveryRequested);
  const normalizedCrossArtifactClaim = isTrue(crossArtifactClaim);
  const normalizedEvidenceCurrent = isTrue(evidenceCurrent);
  const normalizedIndependentReview = isTrue(independentReview);
  if (current === "review") {
    if (risk === "strict" && !normalizedIndependentReview) return "incomplete";
    if (reviewVerdict === "changes_required") {
      return repairOwner === "debug" ? "debug" : "build";
    }
    if (reviewVerdict !== "pass") return "incomplete";
    if (
      normalizedEvidenceCurrent &&
      !normalizedVerificationRequested &&
      !normalizedDeliveryRequested &&
      !normalizedCrossArtifactClaim
    ) {
      return null;
    }
    return "verify";
  }
  if (current !== "build" && current !== "debug") {
    return null;
  }
  if (risk === "strict") {
    return INTERNAL_REVIEW_PHASE;
  }
  if (
    !normalizedEvidenceCurrent ||
    normalizedVerificationRequested ||
    normalizedDeliveryRequested ||
    normalizedCrossArtifactClaim
  ) {
    return "verify";
  }
  return null;
}
