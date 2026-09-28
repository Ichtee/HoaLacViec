import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Briefcase, ArrowLeft, MapPin, DollarSign,
  Phone, CheckCircle2, AlertCircle, Save,
  Building2, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getJob,
  createJob,
  updateJob,
  getEmployerProfile,
  updateUserProfile,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import LocationPicker from '@/components/LocationPicker';
import { isValidCoordinate } from '@/utils';
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
  const [visiblePositionsCount, setVisiblePositionsCount] = useState(5);

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
    slots: 2,
    positions: [
      { title: '', shift: PRESET_SHIFTS[0] },
      { title: '', shift: PRESET_SHIFTS[1] || PRESET_SHIFTS[0] },
    ],
    description: '',
    requirements: '',
    benefits: '',
    status: 'approved',
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
          ? job.positions.map(p => ({ title: p.title || '', shift: p.shift || PRESET_SHIFTS[0] }))
          : [{ title: job.title || '', shift: job.shiftDetail || PRESET_SHIFTS[0] }];

        const initialSlots = job.slots || initialPositions.length || 1;
        if (initialPositions.length < initialSlots) {
          for (let i = initialPositions.length; i < initialSlots; i++) {
            initialPositions.push({
              title: '',
              shift: PRESET_SHIFTS[i % PRESET_SHIFTS.length] || PRESET_SHIFTS[0],
            });
          }
        } else if (initialPositions.length > initialSlots) {
          initialPositions = initialPositions.slice(0, initialSlots);
        }

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
          slots: initialSlots,
          description: job.description || '',
          requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : (job.requirements || ''),
          benefits: Array.isArray(job.benefits) ? job.benefits.join('\n') : (job.benefits || ''),
          status: job.status || 'approved',
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

  // Slots input auto-renders rows
  function handleSlotsChange(val) {
    if (val === '') {
      setFormData(prev => ({ ...prev, slots: '' }));
      return;
    }
    const num = Math.min(30, Math.max(1, parseInt(val, 10) || 1));
    setFormData(prev => {
      const current = prev.positions || [];
      let updated = [...current];
      if (updated.length < num) {
        for (let i = updated.length; i < num; i++) {
          updated.push({
            title: '',
            shift: PRESET_SHIFTS[i % PRESET_SHIFTS.length] || PRESET_SHIFTS[0],
          });
        }
      } else if (updated.length > num) {
        updated = updated.slice(0, num);
      }
      return {
        ...prev,
        slots: num,
        positions: updated,
      };
    });
  }

  function handleSlotsBlur() {
    if (!formData.slots || Number(formData.slots) < 1) {
      handleSlotsChange(1);
    }
  }

  function handleStepSlots(delta) {
    const current = Number(formData.slots) || (formData.positions?.length || 1);
    const nextVal = Math.min(30, Math.max(1, current + delta));
    handleSlotsChange(nextVal);
  }

  function handlePositionChange(index, field, value) {
    setFormData(prev => {
      const updated = [...(prev.positions || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, positions: updated };
    });
  }

  const totalPositions = (formData.positions || []).length;
  const displayedPositions = (formData.positions || []).slice(0, visiblePositionsCount);
  const remainingPositionsCount = Math.max(0, totalPositions - visiblePositionsCount);
  const nextBatchCount = Math.min(5, remainingPositionsCount);

  function handleShowMorePositions() {
    setVisiblePositionsCount(prev => prev + Math.min(5, totalPositions - prev));
  }

  function handleCollapsePositions() {
    setVisiblePositionsCount(5);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);

      // Validate positions
      const emptyPosIndex = (formData.positions || []).findIndex(p => !p.title || !p.title.trim());
      if (emptyPosIndex !== -1) {
        if (visiblePositionsCount <= emptyPosIndex) {
          setVisiblePositionsCount(Math.ceil((emptyPosIndex + 1) / 5) * 5);
        }
        setToast({
          type: 'error',
          message: `Vui lòng nhập tên vị trí cho ứng viên thứ ${emptyPosIndex + 1}.`,
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
      const validPositions = (formData.positions || []).filter(p => p.title && p.title.trim());
      const finalPositions = validPositions.length > 0
        ? validPositions
        : [{ title: formData.title || 'Nhân viên', shift: PRESET_SHIFTS[0] }];

      const computedShiftDetail = finalPositions
        .map(p => `${p.title} (${p.shift})`)
        .join(' | ');

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
        slots: Number(formData.slots) || finalPositions.length || 2,
        positions: finalPositions,
        shiftDetail: computedShiftDetail || formData.shiftDetail,
        description: formData.description,
        requirements: formData.requirements
          ? formData.requirements.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        benefits: [],
        status: isEditing ? formData.status : 'approved',
      };

      if (isEditing) {
        await updateJob(jobId, payload);
        setToast({ type: 'success', message: 'Cập nhật tin tuyển dụng thành công!' });
      } else {
        await createJob(payload);
        setToast({
          type: 'success',
          message: isConfirmed
            ? 'Tạo tin tuyển dụng thành công! Đã ghim vị trí quán lên Bản đồ việc làm.'
            : 'Đã lưu tin tuyển dụng thành công!'
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

        {/* CARD 2: SỐ LƯỢNG & VỊ TRÍ TUYỂN DỤNG (AUTO RENDER) */}
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
                  Nhập số lượng ứng viên cần tuyển, hệ thống tự động tạo đủ số dòng vị trí & ca làm tương ứng.
                </p>
              </div>
            </div>

            {/* Ô nhập số lượng ứng viên cần tuyển */}
            <div className="flex items-center gap-2 bg-pink-50/60 p-1.5 rounded-2xl border border-pink-200 shadow-xs shrink-0 self-start sm:self-auto">
              <span className="text-xs font-bold text-gray-700 pl-2">Số ứng viên cần tuyển:</span>
              <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-pink-200">
                <button
                  type="button"
                  onClick={() => handleStepSlots(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-black text-sm transition-colors"
                  title="Giảm 1 ứng viên"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.slots}
                  onChange={e => handleSlotsChange(e.target.value)}
                  onBlur={handleSlotsBlur}
                  className="w-12 py-1 text-center font-black text-sm text-pink-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleStepSlots(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-black text-sm transition-colors"
                  title="Tăng 1 ứng viên"
                >
                  +
                </button>
              </div>
              <span className="text-xs font-bold text-pink-800 pr-2">bạn</span>
            </div>
          </div>

          {/* Auto-rendered rows (hiển thị tối đa 5 vị trí ban đầu, có nút Xem thêm) */}
          <div className="space-y-3 pt-2">
            {displayedPositions.map((pos, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-pink-50/30 p-3 rounded-2xl border border-pink-100 hover:border-pink-200 transition-all animate-scale-in"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-pink-700 bg-pink-200/80 w-7 h-7 rounded-xl flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-700 sm:hidden">
                    Ứng viên {idx + 1}:
                  </span>
                </div>

                {/* Ô 1: Vị trí tuyển */}
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder={`Tên vị trí ứng viên ${idx + 1} (Ví dụ: Thu ngân, Pha chế, Dọn bàn...)`}
                    value={pos.title}
                    onChange={e => handlePositionChange(idx, 'title', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main text-xs font-semibold text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Ô 2: Dropdown Ca làm việc */}
                <div className="w-full sm:w-72">
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
              </div>
            ))}

            {/* Nút Xem thêm khi tổng số ứng viên > 5 */}
            {totalPositions > 5 && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-pink-100/60 mt-3">
                <span className="text-xs text-gray-500 font-medium">
                  Đang hiển thị <strong className="text-pink-600 font-bold">{displayedPositions.length}</strong> / {totalPositions} vị trí ứng viên
                </span>

                <div className="flex items-center gap-2">
                  {remainingPositionsCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleShowMorePositions}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-100 hover:bg-pink-200 text-pink-800 font-bold text-xs transition-colors shadow-xs"
                    >
                      <ChevronDown className="w-4 h-4 text-pink-600" />
                      Xem thêm ({nextBatchCount === remainingPositionsCount ? `còn lại ${remainingPositionsCount} vị trí` : `thêm ${nextBatchCount} vị trí`})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCollapsePositions}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                      Thu gọn (chỉ hiển thị 5 vị trí)
                    </button>
                  )}
                </div>
              </div>
            )}
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
                <p className="text-[11px] text-gray-400">Chọn địa chỉ hành chính và ghim vị trí chuẩn xác để sinh viên chấm công GPS</p>
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
              {isValidCoordinate(formData.lat, formData.lng) && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${formData.lat},${formData.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline shrink-0 flex items-center gap-1 font-bold ml-2"
                >
                  Xem Maps <ExternalLink className="w-3.5 h-3.5" />
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
