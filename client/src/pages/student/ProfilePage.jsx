
import { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, Calendar, Clock, Award, Save, CheckCircle,
  Briefcase, BookOpen, Plus, Trash2, ShieldCheck, Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getStudentProfile, updateStudentProfile, getAvailability, upsertAvailability } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

const DAYS = [
  { id: 'mon', label: 'Thứ 2' },
  { id: 'tue', label: 'Thứ 3' },
  { id: 'wed', label: 'Thứ 4' },
  { id: 'thu', label: 'Thứ 5' },
  { id: 'fri', label: 'Thứ 6' },
  { id: 'sat', label: 'Thứ 7' },
  { id: 'sun', label: 'Chủ nhật' }
];

const SHIFT_SLOTS = [
  { id: 'morning', label: 'Sáng (7:00 - 12:00)' },
  { id: 'afternoon', label: 'Chiều (12:00 - 17:00)' },
  { id: 'evening', label: 'Tối (17:00 - 22:00)' }
];

const SKILL_OPTIONS = [
  'Pha chế', 'Thu ngân', 'Phục vụ bàn', 'Giao hàng Hòa Lạc',
  'Bán hàng', 'Tiếng Anh giao tiếp', 'Tổ chức sự kiện', 'Pha chế Espresso',
  'Quản lý kho', 'Giao tiếp tốt', 'Làm ca xoay'
];

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    university: 'Đại học FPT Hòa Lạc',
    studentCode: 'HE163456',
    area: 'KTX Dom A - ĐH FPT',
    bio: '',
    skills: [],
    experience: []
  });

  const [availability, setAvailability] = useState({
    mon: ['morning', 'evening'],
    tue: ['afternoon'],
    wed: ['morning', 'afternoon'],
    thu: ['evening'],
    fri: ['morning', 'afternoon', 'evening'],
    sat: ['morning', 'afternoon'],
    sun: ['evening']
  });

  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    async function loadData() {
      if (user?.id) {
        const data = await getStudentProfile(user.id);
        if (data) {
          setProfile(prev => ({ ...prev, ...data }));
        }
        const avail = await getAvailability(user.id);
        if (avail) {
          setAvailability(avail);
        }
      }
    }
    loadData();
  }, [user]);

  function toggleSlot(dayId, slotId) {
    setAvailability(prev => {
      const current = prev[dayId] || [];
      const updated = current.includes(slotId)
        ? current.filter(s => s !== slotId)
        : [...current, slotId];
      return { ...prev, [dayId]: updated };
    });
  }

  function handleAddSkill(skill) {
    if (!skill || profile.skills.includes(skill)) return;
    setProfile(prev => ({ ...prev, skills: [...prev.skills, skill] }));
    setNewSkill('');
  }

  function handleRemoveSkill(skillToRemove) {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove)
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      await updateStudentProfile(user.id, profile);
      await upsertAvailability(user.id, availability);
      setToast({ type: 'success', message: 'Cập nhật hồ sơ rảnh ca thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi lưu thông tin. Vui lòng thử lại.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-green-50 shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-green-main to-green-dark text-white font-bold text-2xl flex items-center justify-center shadow-md">
            {profile.name ? profile.name.charAt(0) : 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-text-main">{profile.name || user?.name}</h1>
              <Badge variant="success" size="sm" icon={ShieldCheck}>Đã xác thực SV</Badge>
            </div>
            <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
              <span>🎓 {profile.university}</span> • <span>Mã SV: {profile.studentCode}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-green-main text-white font-semibold text-sm hover:bg-green-dark transition-all shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu hồ sơ rảnh ca'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Personal Info & Skills */}
        <div className="space-y-6">
          {/* General Info */}
          <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card space-y-4">
            <h2 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-green-50 pb-3">
              <User className="w-4.5 h-4.5 text-green-main" /> Thông tin cá nhân
            </h2>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Họ và tên</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={profile.email || user?.email || ''}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50 text-gray-500"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Số điện thoại</label>
              <input
                type="text"
                value={profile.phone}
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                placeholder="0987xxxxxx"
                className="w-full px-3.5 py-2 rounded-xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Khu vực sinh sống tại Hòa Lạc</label>
              <select
                value={profile.area}
                onChange={e => setProfile({ ...profile, area: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main bg-white"
              >
                <option value="KTX Dom A - ĐH FPT">KTX Dom A - ĐH FPT</option>
                <option value="KTX Dom B - ĐH FPT">KTX Dom B - ĐH FPT</option>
                <option value="KTX Dom C - ĐH FPT">KTX Dom C - ĐH FPT</option>
                <option value="Thôn 3 - Tân Xã">Thôn 3 - Tân Xã</option>
                <option value="Thôn 9 - Bình Yên">Thôn 9 - Bình Yên</option>
                <option value="KTX ĐHQG Hòa Lạc">KTX ĐHQG Hòa Lạc</option>
                <option value="Thạch Hòa - Thạch Thất">Thạch Hòa - Thạch Thất</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Giới thiệu ngắn</label>
              <textarea
                rows={3}
                value={profile.bio}
                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Ví dụ: Sinh viên K17 FPT, cẩn thận, chăm chỉ, có kinh nghiệm thu ngân 6 tháng..."
                className="w-full px-3.5 py-2 rounded-xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main resize-none"
              />
            </div>
          </div>

          {/* Skills */}
          <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card space-y-4">
            <h2 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-green-50 pb-3">
              <Award className="w-4.5 h-4.5 text-green-main" /> Kỹ năng làm việc
            </h2>

            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-green-50 text-green-dark text-xs font-medium border border-green-100"
                >
                  {skill}
                  <button onClick={() => handleRemoveSkill(skill)} className="hover:text-red-500">
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="pt-2">
              <p className="text-xs text-text-muted mb-2 font-medium">Chọn nhanh kỹ năng:</p>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_OPTIONS.filter(s => !profile.skills.includes(s)).map((skill) => (
                  <button
                    key={skill}
                    onClick={() => handleAddSkill(skill)}
                    className="px-2.5 py-1 rounded-lg border border-dashed border-green-200 text-[11px] text-text-muted hover:border-green-main hover:text-green-dark transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col 2/3: Availability Schedule Grid (Rảnh Ca) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Availability Matrix */}
          <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card">
            <div className="flex items-center justify-between border-b border-green-50 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-main" /> Ma trận lịch rảnh học tập & làm việc
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Chọn các ca bạn có thể đi làm. Hệ thống sẽ tự động ghép match các công việc trùng lịch rảnh của bạn.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-50 text-pink-main text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> AI Matching Active
              </span>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-green-50">
                    <th className="py-3 px-2 text-left text-xs font-semibold text-text-muted">Buổi / Thứ</th>
                    {DAYS.map(day => (
                      <th key={day.id} className="py-3 px-2 text-xs font-semibold text-text-main">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {SHIFT_SLOTS.map(slot => (
                    <tr key={slot.id} className="hover:bg-cream/30">
                      <td className="py-4 px-2 text-left text-xs font-medium text-text-main">
                        {slot.label}
                      </td>
                      {DAYS.map(day => {
                        const isAvailable = availability[day.id]?.includes(slot.id);
                        return (
                          <td key={day.id} className="py-4 px-2">
                            <button
                              type="button"
                              onClick={() => toggleSlot(day.id, slot.id)}
                              className={clsx(
                                'w-9 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center mx-auto shadow-sm',
                                isAvailable
                                  ? 'bg-green-main text-white scale-105 shadow-md'
                                  : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-dark'
                              )}
                              title={`${day.label} - ${slot.label}`}
                            >
                              {isAvailable ? '✓' : '+'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-green-50/60 border border-green-100 flex items-center gap-3 text-xs text-text-muted">
              <div className="w-3 h-3 rounded-md bg-green-main shrink-0" />
              <span>Ô xanh đậm: Khung giờ bạn sẵn sàng đi làm tại các cửa hàng xung quanh Khu công nghệ cao / Tân Xã.</span>
            </div>
          </div>

          {/* Work Experience */}
          <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card">
            <h2 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-green-50 pb-3 mb-4">
              <Briefcase className="w-4.5 h-4.5 text-green-main" /> Kinh nghiệm làm việc đã tích lũy
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-cream/50 border border-green-50 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-main">Nhân viên thu ngân & Pha chế</h4>
                  <p className="text-xs text-green-dark font-medium mt-0.5">Highland Coffee F-Ville 2 • 6 tháng</p>
                  <p className="text-xs text-text-muted mt-2">
                    - Phục vụ đồ uống cho cán bộ FPT Software.<br />
                    - Sử dụng phần mềm iPOS thu ngân thành thạo.<br />
                    - Được đánh giá 5/5 sao thái độ làm việc.
                  </p>
                </div>
                <Badge variant="success" size="sm">Đã xác nhận</Badge>
              </div>

              <div className="p-4 rounded-2xl bg-cream/50 border border-green-50 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-main">Cộng tác viên Sự kiện FPT Kampus</h4>
                  <p className="text-xs text-green-dark font-medium mt-0.5">Ban Phong trào ĐH FPT • 3 tháng</p>
                  <p className="text-xs text-text-muted mt-2">
                    - Hỗ trợ setup âm thanh, check-in mã QR cho hơn 500 sinh viên.
                  </p>
                </div>
                <Badge variant="success" size="sm">Đã xác nhận</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
