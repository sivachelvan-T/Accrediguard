export function bandBadgeClass(band) {
  if (!band) return 'badge-gray';
  if (band.startsWith('Strong')) return 'badge-green';
  if (band.startsWith('Adequate')) return 'badge-green';
  if (band.startsWith('Partial')) return 'badge-yellow';
  if (band.startsWith('Weak')) return 'badge-red';
  return 'badge-red'; // Insufficient
}

export function confidenceBadgeClass(label) {
  if (!label) return 'badge-gray';
  if (label === 'HIGH CONFIDENCE') return 'badge-green';
  if (label === 'MEDIUM CONFIDENCE') return 'badge-yellow';
  if (label === 'LOW CONFIDENCE') return 'badge-yellow';
  if (label === 'CONTRADICTORY EVIDENCE') return 'badge-purple';
  return 'badge-red'; // INSUFFICIENT EVIDENCE / REQUIRES HUMAN REVIEW
}

export function scoreColor(score) {
  if (score >= 85) return '#15803d';
  if (score >= 70) return '#0d9488';
  if (score >= 50) return '#b45309';
  if (score >= 30) return '#c2410c';
  return '#b91c1c';
}

export function reviewStatusBadgeClass(status) {
  if (status === 'APPROVED') return 'badge-green';
  if (status === 'REJECTED') return 'badge-red';
  if (status === 'PARTIAL') return 'badge-yellow';
  if (status === 'NEEDS_HUMAN_REVIEW') return 'badge-purple';
  return 'badge-gray';
}
