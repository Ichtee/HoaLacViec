export const LABOR_ROLES = Object.freeze(['student', 'worker', 'freelancer']);

export function toApplicationDTO(application, role) {
  const data = application?.toObject ? application.toObject() : { ...application };
  if (!LABOR_ROLES.includes(role)) return data;
  delete data.internalNote;
  delete data.employerNote;
  if (Array.isArray(data.statusHistory)) {
    data.statusHistory = data.statusHistory.map(({ reason, note, ...entry }) => entry);
  }
  return data;
}
