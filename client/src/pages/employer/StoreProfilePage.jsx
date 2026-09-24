import { useState, useEffect } from 'react';
import {
  Building2, MapPin, Phone, Mail, Clock, ShieldCheck, Upload, Save,
  FileCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getEmployerProfile, updateEmployerProfile } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function StoreProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    storeName: '',
    address: '',
    phone: '',
    email: '',
    category: 'Cà phê & Đồ uống',
    businessLicense: '',
    description: '',
    verificationStatus: 'pending',
    openingHours: '',
    wageRange: ''
  });

  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (user?.id) {
        const data = await getEmployerProfile(user.id);
        if (data) {
          setProfile(prev => ({
            ...prev,
            ...data,
            storeName: data.storeName || user.name || '',
            phone: data.contactPhone || data.phone || user.phone || '',
            email: data.email || user.email || '',
            address: data.address || '',
            businessLicense: data.businessLicense || '',
            description: data.description || '',
            verificationStatus: data.verified || user.status === 'active' ? 'verified' : 'pending',
          }));
        } else {
          setProfile(prev => ({
            ...prev,
            storeName: user.name || '',
            phone: user.phone || '',
            email: user.email || '',
            verificationStatus: user.status === 'active' ? 'verified' : 'pending',
          }));
        }
      }
    }
    loadData();
  }, [user]);

  async function handleSave() {
    try {
      setSaving(true);
      await updateEmployerProfile(user.id, profile);
      setToast({ type: 'success', message: 'Cập nhật thông tin cửa hàng thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi lưu thông tin cửa hàng.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-main to-purple-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-text-main">{profile.storeName || user?.name}</h1>
              {profile.verificationStatus === 'verified' ? (
                <Badge variant="success" size="sm" icon={ShieldCheck}>Đã xác minh GPKD</Badge>
              ) : (
                <Badge variant="warning" size="sm" icon={Clock}>Đang chờ duyệt xác minh</Badge>
              )}
            </div>
            {profile.address && (
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-400" /> {profile.address}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-pink-main text-white font-semibold text-xs hover:bg-pink-dark transition-all shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu thông tin'}
        </button>
      </div>

      {/* Form Details */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-green-50 shadow-card space-y-6">
        <h2 className="text-lg font-bold text-text-main border-b border-green-50 pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-pink-main" /> Hồ sơ gian hàng & Xác minh pháp lý
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Tên cửa hàng / Doanh nghiệp</label>
            <input
              type="text"
              value={profile.storeName || user?.name || ''}
              onChange={e => setProfile({ ...profile, storeName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Mô hình kinh doanh</label>
            <select
              value={profile.category}
              onChange={e => setProfile({ ...profile, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main bg-white"
            >
              <option value="Cà phê & Đồ uống">Cà phê & Đồ uống</option>
              <option value="Cửa hàng tiện lợi / Siêu thị mini">Cửa hàng tiện lợi / Siêu thị mini</option>
              <option value="Nhà hàng & Quán ăn">Nhà hàng & Quán ăn</option>
              <option value="Tổ chức sự kiện & Tiệc">Tổ chức sự kiện & Tiệc</option>
              <option value="Trung tâm tiếng Anh / Gia sư">Trung tâm tiếng Anh / Gia sư</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Số điện thoại liên hệ tuyển dụng</label>
            <input
              type="text"
              value={profile.phone}
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Mã đăng ký GPKD / Mã định danh</label>
            <input
              type="text"
              value={profile.businessLicense}
              onChange={e => setProfile({ ...profile, businessLicense: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Địa chỉ chi tiết tại khu vực Hòa Lạc</label>
          <input
            type="text"
            value={profile.address}
            onChange={e => setProfile({ ...profile, address: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Giới thiệu về cửa hàng & Văn hóa làm việc</label>
          <textarea
            rows={4}
            value={profile.description}
            onChange={e => setProfile({ ...profile, description: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-pink-main resize-none"
          />
        </div>

        {/* Verification Status Card */}
        <div className="p-4 rounded-2xl bg-pink-50/60 border border-pink-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className={clsx("w-8 h-8 shrink-0", profile.verificationStatus === 'verified' ? "text-green-600" : "text-amber-500")} />
            <div>
              <h4 className="text-xs font-bold text-text-main">Trạng thái huy hiệu "Nhà tuyển dụng uy tín"</h4>
              <p className="text-[11px] text-text-muted">
                {profile.verificationStatus === 'verified'
                  ? 'Giấy phép kinh doanh đã được Admin kiểm duyệt & phê duyệt.'
                  : 'Hồ sơ đang chờ ban quản trị kiểm tra và cấp huy hiệu uy tín.'}
              </p>
            </div>
          </div>
          <Badge variant={profile.verificationStatus === 'verified' ? "success" : "warning"} size="sm">
            {profile.verificationStatus === 'verified' ? 'ĐÃ XÁC THỰC' : 'ĐANG CHỜ DUYỆT'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
