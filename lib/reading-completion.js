export function verifyChapterCompletion({ previouslyCompleted = false, requested = false, progress = 0, elapsedSeconds = 0, previousProgress = 0, previousSeconds = 0, suspicious = false, offlineEvidence = false } = {}) {
  if (previouslyCompleted) return { accepted: true, newlyCompleted: false };
  const naturalProgress = Number(previousProgress || 0) >= 20 || Number(previousSeconds || 0) > 0 || offlineEvidence;
  const accepted = Boolean(requested && Number(progress || 0) >= 95 && Number(elapsedSeconds || 0) >= 8 && naturalProgress && !suspicious);
  return { accepted, newlyCompleted: accepted };
}
