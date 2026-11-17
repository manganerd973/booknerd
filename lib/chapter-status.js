export const WORKFLOW_STATUSES = new Set(['draft', 'scheduled', 'published', 'proofreading']);
export function normalizeWorkflowStatus(value, status = 'draft') {
  if (WORKFLOW_STATUSES.has(value)) return value;
  if (['editing', 'ready'].includes(value)) return 'proofreading';
  if (value === 'translating') return 'draft';
  return status === 'published' ? 'published' : 'draft';
}
