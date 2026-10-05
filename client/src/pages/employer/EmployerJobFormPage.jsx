import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Briefcase, ArrowLeft, MapPin, DollarSign,
  Phone, CheckCircle2, AlertCircle, Save,
  Building2, ExternalLink, Plus, Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getJob,
  createJob,
  submitJobForReview,
  updateJob,
  getEmployerProfile,
  updateUserProfile,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import LocationPicker from '@/components/LocationPicker';
import { isValidCoordinate, getGoogleMapsDirectionsUrl } from '@/utils';
import { getProvinces, getDistricts, getWards, resolveAreaCode } from '@/services/provinces';

export const PRESET_SHIFTS = [
  'Ca sáng (07:00 - 12:00)',
  'Ca chiều (12:00 - 17:00)',
  'Ca tối (17:00 - 22:00)',
  'Ca đêm (22:00 - 06:00)',
  'Ca xoay / Linh hoạt theo lịch học',
  'Ca full-time (08:00 - 17:00)',
  'Ca cuối tuần (Thứ 7 & Chủ Nhật)',
];

export default function EmployerJobFormPage() {
  const { id: jobId } = useParams();
  const isEditing = Boolean(jobId);
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [employerPhone, setEmployerPhone] = useState(user?.phone || '');

  // Dynamic Provinces, Districts, Wards from open-api.vn
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');
  const [detailAddress, setDetailAddress] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    jobType: 'Theo ca',
    salaryAmount: 25000,
    salaryUnit: 'hour',
    contactPhone: user?.phone || '',
    address: '',
    area: 'other',
    lat: null,
    lng: null,
    locationStatus: 'unconfirmed',
    locationSource: null,
    shiftDetail: '',
    slots: 1,
    positions: [
      { title: '', shift: PRESET_SHIFTS[0], quantity: 1 },
    ],
    description: '',
    requirements: '',
    benefits: '',
    status: 'pending',
  });

  function buildFullAddress(detail, ward, district, province) {
    const rawDetail = (detail || '').trim();
    if (!rawDetail) {
      return [ward, district, province].filter(Boolean).join(', ');
    }
    let cleanDetail = rawDetail.replace(/,?\s*Việt\s*Nam\s*$/i, '').trim();
    const parts = [cleanDetail];
    if (ward && !cleanDetail.toLowerCase().includes(ward.toLowerCase().replace('xã ', '').replace('phường ', '').replace('thị trấn ', ''))) {
      parts.push(ward);
    }
    if (district && !cleanDetail.toLowerCase().includes(district.toLowerCase().replace('huyện ', '').replace('quận ', '').replace('thị xã ', '').replace('thành phố ', ''))) {
      parts.push(district);
    }
    if (province && !cleanDetail.toLowerCase().includes(province.toLowerCase().replace('tỉnh ', '').replace('thành phố ', ''))) {
      parts.push(province);
    }
    return parts.filter(Boolean).join(', ');
  }

  const fullAddressPreview = useMemo(() => {
    return buildFullAddress(detailAddress, selectedWardName, selectedDistrictName, selectedProvinceName);
  }, [detailAddress, selectedWardName, selectedDistrictName, selectedProvinceName]);

  // Load initial provinces and employer phone
  useEffect(() => {
    async function initData() {
      try {
        const provs = await getProvinces();
        setProvinces(provs);
      } catch (err) {
        console.error('Lỗi tải danh mục hành chính:', err);
      }

      if (!user?.phone) {
        try {
          const profile = await getEmployerProfile();
          if (profile?.contactPhone) {
            setEmployerPhone(profile.contactPhone);
            setFormData(prev => ({
              ...prev,
              contactPhone: prev.contactPhone || profile.contactPhone
            }));
          }
        } catch {}
      }
    }
    initData();
  }, [user]);

  // Load job data if editing
  useEffect(() => {
    if (!isEditing) return;

    async function loadJobData() {
      try {
        setLoading(true);
        const job = await getJob(jobId);
        if (!job) {
          setToast({ type: 'error', message: 'Không tìm thấy thông tin việc làm.' });
          navigate('/employer/jobs');
          return;
        }

        const pCode = job.addressComponents?.provinceCode || job.provinceCode || '';
        const dCode = job.addressComponents?.districtCode || job.districtCode || '';
        const wCode = job.addressComponents?.wardCode || job.wardCode || '';
        const pName = job.addressComponents?.provinceName || job.provinceName || '';
        const dName = job.addressComponents?.districtName || job.districtName || '';
        const wName = job.addressComponents?.wardName || job.wardName || '';
        const addrLine = job.addressComponents?.addressLine || job.detailAddress || job.address?.split(',')[0] || '';

        setSelectedProvinceCode(pCode);
        setSelectedProvinceName(pName);
        setSelectedDistrictCode(dCode);
        setSelectedDistrictName(dName);
        setSelectedWardCode(wCode);
        setSelectedWardName(wName);
        setDetailAddress(addrLine);

        if (pCode) {
          getDistricts(pCode).then(setDistricts).catch(() => {});
        }
        if (dCode) {
          getWards(dCode).then(setWards).catch(() => {});
        }

        const hasValidCoords = isValidCoordinate(job.location?.lat, job.location?.lng);
        let initialPositions = (job.positions && job.positions.length > 0)
          ? job.positions.map(p => ({
              title: p.title || '',
              shift: p.shift || PRESET_SHIFTS[0],
              quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1,
            }))
          : [{ title: job.title || '', shift: job.shiftDetail || PRESET_SHIFTS[0], quantity: job.slots || 1 }];

        const computedSlots = initialPositions.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0);

        setFormData({
          title: job.title || '',
          jobType: job.type === 'shift' ? 'Theo ca' : 'Part-time',
          salaryAmount: job.salaryAmount || 25000,
          salaryUnit: job.salaryUnit || 'hour',
          contactPhone: job.contactPhone || user?.phone || employerPhone || '',
          address: job.address || '',
          area: job.area || 'other',
          lat: hasValidCoords ? job.location.lat : null,
          lng: hasValidCoords ? job.location.lng : null,
          locationStatus: job.locationStatus || (hasValidCoords ? 'confirmed' : 'unconfirmed'),
          locationSource: job.locationSource || (hasValidCoords ? 'map_pin' : null),
          shiftDetail: job.shiftDetail || 'Sáng: 7h-12h | Tối: 17h-22h',
          positions: initialPositions,
          slots: computedSlots,
          description: job.description || '',
          requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : (job.requirements || ''),
          benefits: Array.isArray(job.benefits) ? job.benefits.join('\n') : (job.benefits || ''),
          status: job.status || 'pending',
        });
      } catch (err) {
        setToast({ type: 'error', message: err.message || 'Lỗi khi tải thông tin việc làm' });
      } finally {
        setLoading(false);
      }
    }

    loadJobData();
  }, [jobId, isEditing]);

  // Handle Province change
  async function handleProvinceChange(e) {
    const pCode = e.target.value;
    setSelectedProvinceCode(pCode);
    const pObj = provinces.find(p => String(p.code) === String(pCode));
    const pName = pObj ? pObj.name : '';
    setSelectedProvinceName(pName);

    setSelectedDistrictCode('');
    setSelectedDistrictName('');
    setSelectedWardCode('');
    setSelectedWardName('');
    setDistricts([]);
    setWards([]);

    setFormData(prev => ({
      ...prev,
      area: 'other',
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));

    if (pCode) {
      try {
        setLoadingDistricts(true);
        const dList = await getDistricts(pCode);
        setDistricts(dList);
      } catch (err) {
        console.error('Lỗi tải quận huyện:', err);
      } finally {
        setLoadingDistricts(false);
      }
    }
  }

  // Handle District change
  async function handleDistrictChange(e) {
    const dCode = e.target.value;
    setSelectedDistrictCode(dCode);
    const dObj = districts.find(d => String(d.code) === String(dCode));
    const dName = dObj ? dObj.name : '';
    setSelectedDistrictName(dName);

    setSelectedWardCode('');
    setSelectedWardName('');
    setWards([]);

    setFormData(prev => ({
      ...prev,
      area: 'other',
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));

    if (dCode) {
      try {
        setLoadingWards(true);
        const wList = await getWards(dCode);
        setWards(wList);
      } catch (err) {
        console.error('Lỗi tải xã phường:', err);
      } finally {
        setLoadingWards(false);
      }
    }
  }

  // Handle Ward change
  function handleWardChange(e) {
    const wCode = e.target.value;
    setSelectedWardCode(wCode);
    const wObj = wards.find(w => String(w.code) === String(wCode));
    const wName = wObj ? wObj.name : '';
    setSelectedWardName(wName);

    const resolvedArea = resolveAreaCode(selectedProvinceName, selectedDistrictName, wName);
    setFormData(prev => ({
      ...prev,
      area: resolvedArea,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));
  }

  function handleDetailAddressChange(val) {
    setDetailAddress(val);
    setFormData(prev => ({
      ...prev,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));
  }

  function handleAddPosition() {
    setFormData(prev => ({
      ...prev,
      positions: [
        ...(prev.positions || []),
        { title: '', shift: PRESET_SHIFTS[0], quantity: 1 },
      ],
    }));
  }

  function handleRemovePosition(index) {
    setFormData(prev => {
      const updated = (prev.positions || []).filter((_, i) => i !== index);
      return {
        ...prev,
        positions: updated.length > 0 ? updated : [{ title: '', shift: PRESET_SHIFTS[0], quantity: 1 }],
      };
    });
  }

  function handlePositionChange(index, field, value) {
    setFormData(prev => {
      const updated = [...(prev.positions || [])];
      if (field === 'quantity') {
        const val = value === '' ? '' : Math.max(1, Math.min(50, parseInt(value, 10) || 1));
        updated[index] = { ...updated[index], quantity: val };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, positions: updated };
    });
  }

  const totalSlots = (formData.positions || []).reduce((sum, p) => sum + (Number(p.quantity) || 1), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);

      // Validate positions
      const emptyPosIndex = (formData.positions || []).findIndex(p => !p.title || !p.title.trim());
      if (emptyPosIndex !== -1) {
        setToast({
          type: 'error',
          message: `Vui lòng nhập tên vị trí cho dòng thứ ${emptyPosIndex + 1}.`,
        });
        setSubmitting(false);
        return;
      }

      const finalAddress = fullAddressPreview || formData.address;
      const isConfirmed = isValidCoordinate(formData.lat, formData.lng) && formData.locationStatus === 'confirmed';
      const locationPayload = isConfirmed
        ? {
            lat: Number(Number(formData.lat).toFixed(6)),
            lng: Number(Number(formData.lng).toFixed(6)),
          }
        : null;

      const inputPhone = formData.contactPhone?.trim() || user?.phone || employerPhone || '';
      const finalPositions = (formData.positions || []).map(p => ({
        title: (p.title || '').trim() || formData.title || 'Nhân viên',
        shift: p.shift || PRESET_SHIFTS[0],
        quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1,
      }));

      const computedShiftDetail = finalPositions
        .map(p => `${p.title} (${p.shift} - SL: ${p.quantity})`)
        .join(' | ');

      const computedTotalSlots = finalPositions.reduce((sum, p) => sum + p.quantity, 0);

      const payload = {
        title: formData.title,
        type: formData.jobType === 'Theo ca' ? 'shift' : 'part_time',
        storeName: user?.name || 'Cửa hàng',
        employerId: user?.profileId || user?.id,
        salaryAmount: Number(formData.salaryAmount) || 25000,
        salaryUnit: formData.salaryUnit,
        contactPhone: inputPhone,
        area: formData.area || 'other',
        address: finalAddress,
        addressComponents: {
          addressLine: detailAddress.trim(),
          wardCode: selectedWardCode || null,
          wardName: selectedWardName || '',
          districtCode: selectedDistrictCode || null,
          districtName: selectedDistrictName || '',
          provinceCode: selectedProvinceCode || null,
          provinceName: selectedProvinceName || '',
        },
        provinceCode: selectedProvinceCode || null,
        districtCode: selectedDistrictCode || null,
        wardCode: selectedWardCode || null,
        location: locationPayload,
        locationStatus: isConfirmed ? 'confirmed' : formData.locationStatus || 'unconfirmed',
        locationSource: isConfirmed ? (formData.locationSource || 'map_pin') : null,
        slots: computedTotalSlots,
        positions: finalPositions,
        shiftDetail: computedShiftDetail || formData.shiftDetail,
        description: formData.description,
        requirements: formData.requirements
          ? formData.requirements.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        benefits: [],
        status: 'pending',
      };

      if (isEditing) {
        await updateJob(jobId, payload);
        if (['draft', 'rejected'].includes(formData.status)) {
          await submitJobForReview(jobId);
        }
        setToast({ type: 'success', message: 'Đã lưu thay đổi. Nếu tin đang hoạt động, nội dung mới sẽ chờ quản trị viên duyệt lại.' });
      } else {
        await createJob(payload);
        setToast({
          type: 'success',
          message: isConfirmed
            ? 'Đã gửi tin chờ duyệt và lưu vị trí quán.'
            : 'Đã gửi tin tuyển dụng chờ quản trị viên duyệt.'
        });
      }

      if (inputPhone && !user?.phone) {
        try {
          await updateUserProfile({ phone: inputPhone });
          updateUser?.({ ...user, phone: inputPhone });
        } catch {}
      }

      setTimeout(() => {
        navigate('/employer/jobs');
      }, 1200);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi lưu tin tuyển dụng.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-500">Đang tải thông tin việc làm...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-pink-100 shadow-xs">
        <div>
          <Link
            to="/employer/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-pink-600 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách tin tuyển dụng
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-pink-main" />
            {isEditing ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng bài tuyển dụng & Ghim bản đồ'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isEditing
              ? 'Cập nhật lại vị trí tuyển dụng, ca làm việc hoặc địa chỉ điểm danh của quán.'
              : 'Điền đầy đủ thông tin để tiếp cận ngay hàng ngàn sinh viên ĐH FPT & ĐHQG tại Hòa Lạc.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => navigate('/employer/jobs')}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs transition-all"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="job-form"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Đăng tin tuyển dụng')}
          </button>
        </div>
      </div>

      <form id="job-form" onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1: THÔNG TIN CƠ BẢN */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Thông tin cơ bản</h2>
              <p className="text-[11px] text-gray-400">Tiêu đề, hình thức và mức thu nhập cho ứng viên</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-bold text-gray-800 text-xs mb-1.5">
                Tiêu đề công việc <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Tuyển Nhân viên Pha chế & Phục vụ ca Tối (Quán Café Xanh)"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-gray-800 text-xs mb-1.5">Loại hình việc làm</label>
                <select
                  value={formData.jobType}
                  onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main bg-white text-xs font-semibold text-gray-800"
                >
                  <option value="Theo ca">Theo ca linh hoạt</option>
                  <option value="Part-time">Part-time cố định</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 text-xs mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-orange-500" /> Mức lương (VNĐ/giờ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={15000}
                  step={1000}
                  value={formData.salaryAmount}
                  onChange={e => setFormData({ ...formData, salaryAmount: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-bold text-orange-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 text-xs mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-green-600" /> SĐT / Zalo liên hệ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0987654321"
                  value={formData.contactPhone}
                  onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: VỊ TRÍ TUYỂN DỤNG & SỐ LƯỢNG */}
        <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-50 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-pink-main" /> Vị trí tuyển dụng & Ca làm việc
                  <span className="text-red-500">*</span>
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Thêm các vị trí, chọn ca làm và nhập số lượng ứng viên cần tuyển cho từng vị trí.
                </p>
              </div>
            </div>

            {/* Nút thêm vị trí */}
            <button
              type="button"
              onClick={handleAddPosition}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm vị trí
            </button>
          </div>

          {/* Danh sách các dòng vị trí */}
          <div className="space-y-3 pt-1">
            {(formData.positions || []).map((pos, idx) => (
              <div
                key={idx}
                className="flex flex-col md:flex-row md:items-center gap-3 bg-pink-50/30 p-3 rounded-2xl border border-pink-100 hover:border-pink-200 transition-all animate-scale-in"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-pink-700 bg-pink-200/80 w-7 h-7 rounded-xl flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-700 md:hidden">
                    Vị trí {idx + 1}:
                  </span>
                </div>

                {/* Ô 1: Vị trí tuyển */}
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Tên vị trí (Ví dụ: Phục vụ bàn, Thu ngân, Pha chế...)"
                    value={pos.title}
                    onChange={e => handlePositionChange(idx, 'title', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Ô 2: Dropdown Ca làm việc */}
                <div className="w-full md:w-64">
                  <select
                    value={pos.shift}
                    onChange={e => handlePositionChange(idx, 'shift', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-800"
                  >
                    {PRESET_SHIFTS.map((s, sIdx) => (
                      <option key={sIdx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Ô 3: Số lượng cần tuyển */}
                <div className="flex items-center gap-1.5 shrink-0 bg-white px-2.5 py-1.5 rounded-xl border border-gray-200">
                  <span className="text-xs font-bold text-gray-600 whitespace-nowrap">SL:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={pos.quantity === '' ? '' : (pos.quantity ?? 1)}
                    onChange={e => handlePositionChange(idx, 'quantity', e.target.value)}
                    className="w-12 text-center font-bold text-xs text-pink-700 focus:outline-none"
                    title="Số lượng cần tuyển cho vị trí này"
                  />
                  <span className="text-xs text-gray-500 font-medium">bạn</span>
                </div>

                {/* Nút Xoá dòng vị trí */}
                {(formData.positions || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePosition(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 self-end md:self-auto cursor-pointer"
                    title="Xóa vị trí này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Footer tổng kết số lượng */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-pink-100/60 mt-3">
              <span className="text-xs text-gray-600 font-medium">
                Tổng cộng: <strong className="text-pink-600 font-bold">{totalSlots}</strong> ứng viên cần tuyển ({formData.positions?.length || 0} vị trí)
              </span>

              <button
                type="button"
                onClick={handleAddPosition}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm vị trí khác
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: ĐỊA CHỈ & GHIM VỊ TRÍ BẢN ĐỒ */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-red-500" /> Địa điểm làm việc & Ghim Bản đồ (GPS)
                </h2>
                <p className="text-[11px] text-gray-400">Ghim đúng cửa vào nơi làm việc để chỉ đường và chấm công GPS chính xác</p>
              </div>
            </div>

            {formData.locationStatus === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã ghim GPS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" /> Chưa ghim GPS
              </span>
            )}
          </div>

          {/* 3 Selects: Tỉnh / Huyện / Xã */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-800 text-xs mb-1">Tỉnh / Thành phố *</label>
              <select
                required
                value={selectedProvinceCode}
                onChange={handleProvinceChange}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-medium"
              >
                <option value="">-- Chọn Tỉnh / TP --</option>
                {provinces.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-800 text-xs mb-1">Quận / Huyện *</label>
              <select
                required
                disabled={!selectedProvinceCode || loadingDistricts}
                value={selectedDistrictCode}
                onChange={handleDistrictChange}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-medium disabled:bg-gray-50"
              >
                <option value="">{loadingDistricts ? 'Đang tải...' : '-- Chọn Quận / Huyện --'}</option>
                {districts.map(d => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-800 text-xs mb-1">Xã / Phường *</label>
              <select
                required
                disabled={!selectedDistrictCode || loadingWards}
                value={selectedWardCode}
                onChange={handleWardChange}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-medium disabled:bg-gray-50"
              >
                <option value="">{loadingWards ? 'Đang tải...' : '-- Chọn Xã / Phường --'}</option>
                {wards.map(w => (
                  <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Chi tiết địa chỉ */}
          <div>
            <label className="block font-bold text-gray-800 text-xs mb-1">
              Số nhà, tên đường, thôn, xóm *
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Số 12 ngõ 8, Thôn 3, cạnh cổng Đại học FPT..."
              value={detailAddress}
              onChange={e => handleDetailAddressChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Full address preview */}
          {fullAddressPreview && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-600 line-clamp-1">
                <strong>Địa chỉ hoàn chỉnh:</strong> {fullAddressPreview}
              </span>
              {(fullAddressPreview || formData.address) && (
                <a
                  href={getGoogleMapsDirectionsUrl({
                    address: fullAddressPreview || formData.address,
                    locationStatus: formData.locationStatus,
                    location: { lat: formData.lat, lng: formData.lng },
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline shrink-0 flex items-center gap-1 font-bold ml-2"
                >
                  {formData.locationStatus === 'confirmed' && isValidCoordinate(formData.lat, formData.lng)
                    ? 'Kiểm tra chỉ đường'
                    : 'Tìm địa chỉ'} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Location Picker Component */}
          <LocationPicker
            key={`loc-${formData.lat}-${formData.lng}-${selectedWardCode || 'none'}`}
            initialAddress={fullAddressPreview}
            addressQuery={fullAddressPreview}
            initialLat={formData.lat}
            initialLng={formData.lng}
            initialStatus={formData.locationStatus}
            onLocationChange={locData => {
              setFormData(prev => ({
                ...prev,
                lat: locData.lat,
                lng: locData.lng,
                locationStatus: locData.locationStatus,
                locationSource: locData.locationSource,
                locationConfirmedAt: locData.locationConfirmedAt,
              }));
            }}
          />
        </div>

        {/* CARD 4: MÔ TẢ & YÊU CẦU */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Mô tả công việc & Yêu cầu</h2>
              <p className="text-[11px] text-gray-400">Nêu rõ nhiệm vụ hàng ngày và tiêu chuẩn tuyển dụng</p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-800 text-xs mb-1.5">Mô tả công việc chi tiết</label>
            <textarea
              rows={3}
              placeholder="Nêu rõ công việc hàng ngày: Pha chế đồ uống, dọn dẹp quầy bar, phục vụ khách, kiểm kê hàng hóa cuối ca..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs resize-none"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-800 text-xs mb-1.5">Yêu cầu & Quyền lợi (mỗi ý 1 dòng)</label>
            <textarea
              rows={3}
              placeholder="Ví dụ:&#10;- Chăm chỉ, đúng giờ, giao tiếp thân thiện&#10;- Ưu tiên sinh viên có thể làm ca xoay&#10;- Bao cơm ca, thưởng doanh số theo tháng"
              value={formData.requirements}
              onChange={e => setFormData({ ...formData, requirements: e.target.value })}
              className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-main text-xs resize-none"
            />
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/employer/jobs')}
            className="px-6 py-3 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs transition-all"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Đăng tin tuyển dụng ngay')}
          </button>
        </div>
      </form>
    </div>
  );
}
