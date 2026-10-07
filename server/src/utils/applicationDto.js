export const LABOR_ROLES = Object.freeze(['student', 'worker', 'freelancer']);

// Chỉ lộ số điện thoại/email ứng viên cho nhà tuyển dụng từ khi có offer; trước đó dùng chat trong ứng dụng.
export const CONTACT_VISIBLE_STATUSES = Object.freeze(['offer_sent', 'offer_accepted', 'hired', 'accepted', 'approved']);

export function toApplicationDTO(application, role) {
  const data = application?.toObject ? application.toObject() : { ...application };
  if (role === 'employer' && !CONTACT_VISIBLE_STATUSES.includes(data.status)) {
    delete data.studentPhone;
    delete data.studentEmail;
    if (data.studentId && typeof data.studentId === 'object') {
      delete data.studentId.phone;
      delete data.studentId.email;
    }
    data.contactHidden = true;
  }
  if (!LABOR_ROLES.includes(role)) return data;
  delete data.internalNote;
  delete data.employerNote;
  if (Array.isArray(data.statusHistory)) {
    data.statusHistory = data.statusHistory.map(({ reason, note, ...entry }) => entry);
  }
  return data;
}
