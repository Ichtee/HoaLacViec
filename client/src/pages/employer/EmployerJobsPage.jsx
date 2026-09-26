import { useState, useEffect, useMemo } from 'react';
import {
  Briefcase, Plus, Edit, Trash2, MapPin,
  DollarSign, Users, ExternalLink,
  PauseCircle, PlayCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getEmployerMyJobs,
  createJob,
  updateJob,
  deleteJob,
  getEmployerProfile,
  updateUserProfile,
} from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';
import LocationPicker from '@/components/LocationPicker';
import { formatVND, isValidCoordinate } from '@/utils';
import { getProvinces, getDistricts, getWards, resolveAreaCode } from '@/services/provinces';

export default function EmployerJobsPage() {
  const { user, updateUser } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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

  function buildFullAddress(detail, ward, district, province) {
    const rawDetail = (detail || '').trim();
    if (!rawDetail) {
      return [ward, district, province].filter(Boolean).join(', ');
    }
    // Remove trailing ", Việt Nam" if user copy-pasted from Google Maps
    let cleanDetail = rawDetail.replace(/,?\s*Việt\s*Nam\s*$/i, '').trim();

    // Avoid duplicating administrative units if already typed in detail
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

  // Computed full address for preview only — NOT stored in formData each keystroke
  const fullAddressPreview = useMemo(
    () => buildFullAddress(detailAddress, selectedWardName, selectedDistrictName, selectedProvinceName),
    [detailAddress, selectedWardName, selectedDistrictName, selectedProvinceName]
  );

  // New Job Form State
  const [formData, setFormData] = useState({
    title: '',
    jobType: 'Theo ca',
    salaryAmount: 25000,
    salaryUnit: 'hour',
    contactPhone: user?.phone || '',
    address: '',
    area: 'tan_xa',
    lat: null,
    lng: null,
    locationStatus: 'unconfirmed',
    locationSource: null,
    shiftDetail: '',
    slots: 1,
    description: '',
    requirements: '',
    benefits: ''
  });

  const [editingJob, setEditingJob] = useState(null);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await getEmployerMyJobs();
      const list = Array.isArray(res) ? res : (res?.items || res?.jobs || []);
      setJobs(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Initialize all 63 provinces from open-api.vn
  async function initProvinces() {
    try {
      const pList = await getProvinces();
      setProvinces(pList);

      // Default to Thành phố Hà Nội (code: 1)
      const hanoi = pList.find(p => p.code === 1 || p.name.includes('Hà Nội')) || pList[0];
      if (hanoi) {
        setSelectedProvinceCode(String(hanoi.code));
        setSelectedProvinceName(hanoi.name);

        const dList = await getDistricts(hanoi.code);
        setDistricts(dList);

        // Default to Huyện Thạch Thất (code: 276)
        const thachThat = dList.find(d => d.code === 276 || d.name.includes('Thạch Thất')) || dList[0];
        if (thachThat) {
          setSelectedDistrictCode(String(thachThat.code));
          setSelectedDistrictName(thachThat.name);

          const wList = await getWards(thachThat.code);
          setWards(wList);

          const tanXa = wList.find(w => w.name.includes('Tân Xã')) || wList[0];
          if (tanXa) {
            setSelectedWardCode(String(tanXa.code));
            setSelectedWardName(tanXa.name);
            const full = buildFullAddress(detailAddress, tanXa.name, thachThat.name, hanoi.name);
            setFormData(prev => ({
              ...prev,
              address: full,
            }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadJobs();
    initProvinces();
    if (user?.id || user?.profileId) {
      getEmployerProfile(user?.profileId || user?.id)
        .then(profile => {
          if (profile?.contactPhone) {
            setEmployerPhone(profile.contactPhone);
            setFormData(prev => ({
              ...prev,
              contactPhone: prev.contactPhone || profile.contactPhone
            }));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Phone synchronization with user
  useEffect(() => {
    if (user?.phone) {
      setEmployerPhone(prev => prev || user.phone);
      setFormData(prev => ({
        ...prev,
        contactPhone: prev.contactPhone || user.phone
      }));
    }
  }, [user?.phone]);

  // Cascading Handlers
  async function handleProvinceChange(e) {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedDistrictCode('');
    setSelectedDistrictName('');
    setSelectedWardCode('');
    setSelectedWardName('');
    setDistricts([]);
    setWards([]);

    const prov = provinces.find(p => String(p.code) === String(code));
    setSelectedProvinceName(prov ? prov.name : '');

    // Requirement 6: Editing address resets confirmed location status until pin is reconfirmed
    setFormData(prev => ({
      ...prev,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));
    setGeoCustomVerified(false);

    if (code) {
      setLoadingDistricts(true);
      try {
        const dList = await getDistricts(code);
        setDistricts(dList);
      } finally {
        setLoadingDistricts(false);
      }
    }
  }

  async function handleDistrictChange(e) {
    const code = e.target.value;
    setSelectedDistrictCode(code);
    setSelectedWardCode('');
    setSelectedWardName('');
    setWards([]);

    const dist = districts.find(d => String(d.code) === String(code));
    setSelectedDistrictName(dist ? dist.name : '');

    // Requirement Phase 3 item 1: Editing address resets confirmed location status to unconfirmed
    setFormData(prev => ({
      ...prev,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));

    if (code) {
      setLoadingWards(true);
      try {
        const wList = await getWards(code);
        setWards(wList);
      } finally {
        setLoadingWards(false);
      }
    }
  }

  function handleWardChange(e) {
    const code = e.target.value;
    setSelectedWardCode(code);

    const ward = wards.find(w => String(w.code) === String(code));
    const wName = ward ? ward.name : '';
    setSelectedWardName(wName);

    const resolvedArea = resolveAreaCode(selectedProvinceName, selectedDistrictName, wName);
    setFormData(prev => ({
      ...prev,
      area: resolvedArea,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));
  }

  // Update detailAddress: editing address resets location status to unconfirmed
  function handleDetailAddressChange(val) {
    setDetailAddress(val);
    setFormData(prev => ({
      ...prev,
      locationStatus: 'unconfirmed',
      locationConfirmedAt: null,
    }));
  }

  function handleOpenCreate() {
    setEditingJob(null);
    setDetailAddress('');
    setSelectedProvinceCode('');
    setSelectedProvinceName('');
    setSelectedDistrictCode('');
    setSelectedDistrictName('');
    setSelectedWardCode('');
    setSelectedWardName('');
    setDistricts([]);
    setWards([]);
    setFormData({
      title: '',
      jobType: 'Theo ca',
      salaryAmount: 25000,
      salaryUnit: 'hour',
      contactPhone: user?.phone || employerPhone || '',
      address: '',
      area: 'other',
      lat: null,
      lng: null,
      locationStatus: 'unconfirmed',
      locationSource: null,
      shiftDetail: '',
      slots: 1,
      description: '',
      requirements: '',
      benefits: '',
    });
    setIsModalOpen(true);
  }

  async function handleOpenEdit(job) {
    setEditingJob(job);
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
      slots: job.slots || 2,
      description: job.description || '',
      requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : (job.requirements || ''),
      benefits: Array.isArray(job.benefits) ? job.benefits.join('\n') : (job.benefits || ''),
    });
    setIsModalOpen(true);
  }

  async function handleSubmitJob(e) {
    e.preventDefault();
    try {
      setSubmitting(true);

      const finalAddress = fullAddressPreview || formData.address;
      const isConfirmed = isValidCoordinate(formData.lat, formData.lng) && formData.locationStatus === 'confirmed';
      const locationPayload = isConfirmed
        ? {
            lat: Number(Number(formData.lat).toFixed(6)),
            lng: Number(Number(formData.lng).toFixed(6)),
          }
        : null;

      const inputPhone = formData.contactPhone?.trim() || user?.phone || employerPhone || '';
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
        slots: Number(formData.slots) || 2,
        shiftDetail: formData.shiftDetail,
        description: formData.description,
        requirements: formData.requirements
          ? formData.requirements.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        benefits: [],
        status: editingJob ? editingJob.status : 'approved',
      };

      if (editingJob) {
        const targetId = editingJob._id || editingJob.id;
        await updateJob(targetId, payload);
        setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, ...payload } : j));
        setToast({ type: 'success', message: 'Cập nhật tin tuyển dụng thành công!' });
      } else {
        const newJob = await createJob(payload);
        setJobs(prev => [newJob, ...prev]);
        setToast({
          type: 'success',
          message: isConfirmed
            ? 'Tạo tin tuyển dụng thành công! Đã ghim vị trí quán lên Bản đồ việc làm.'
            : 'Đã lưu tin tuyển dụng (chưa ghim vị trí, chưa bật chấm công GPS).'
        });
      }

      if (inputPhone && !user?.phone) {
        try {
          await updateUserProfile({ phone: inputPhone });
          updateUser?.({ ...user, phone: inputPhone });
        } catch {}
      }

      setIsModalOpen(false);
      setEditingJob(null);
      setDetailAddress('');
      setMapLinkInput('');
      setGeoCustomVerified(false);
      setGeoError('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi lưu tin tuyển dụng.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(job) {
    const newStatus = job.status === 'closed' ? 'approved' : 'closed';
    const targetId = job._id || job.id;
    await updateJob(targetId, { status: newStatus });
    setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: newStatus } : j));
    setToast({ type: 'info', message: `Đã cập nhật trạng thái tin tuyển dụng: ${newStatus === 'approved' ? 'Hoạt động' : 'Tạm đóng'}` });
  }

  async function handleDeleteJob(job) {
    if (!confirm('Bạn có chắc muốn xóa bài đăng tuyển dụng này?')) return;
    const targetId = job._id || job.id;
    await deleteJob(targetId);
    setJobs(prev => prev.filter(j => (j._id || j.id) !== targetId));
    setToast({ type: 'success', message: 'Đã xóa tin tuyển dụng.' });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-pink-main" /> Quản lý tin tuyển dụng
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Đăng tin tuyển dụng và liên kết địa chỉ Google Maps để sinh viên tìm kiếm và đến quán dễ dàng.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all self-start sm:self-center shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin tuyển mới
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách bài đăng...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-4">
          <Briefcase className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="font-bold text-base text-text-main">Chưa có bài đăng tuyển dụng nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Hãy đăng tin tuyển dụng ca làm để tiếp cận ngay hàng ngàn sinh viên ĐH FPT, KTX ĐHQG đang tìm việc quanh bạn!
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map(job => {
            const isClosed = job.status === 'closed';
            return (
              <div
                key={job._id || job.id}
                className={clsx(
                  'p-5 rounded-3xl border shadow-card space-y-3 flex flex-col justify-between transition-all',
                  isClosed
                    ? 'bg-gray-50/90 border-gray-200 opacity-80 hover:opacity-100'
                    : 'bg-white border-green-100 hover:border-green-300'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={clsx(
                        'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider',
                        isClosed ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-700'
                      )}>
                        {job.type === 'shift' ? 'Theo ca' : 'Part-time'}
                      </span>
                      <h3 className={clsx(
                        'font-bold text-base mt-1 line-clamp-1',
                        isClosed ? 'text-gray-500 line-through' : 'text-text-main'
                      )}>
                        {job.title}
                      </h3>
                    </div>

                    {job.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Chờ duyệt
                      </span>
                    ) : job.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shrink-0" title={job.rejectionReason || 'Chưa đạt tiêu chuẩn'}>
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Bị từ chối
                      </span>
                    ) : isClosed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 border border-gray-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                        Đã đóng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Đang tuyển
                      </span>
                    )}
                  </div>

                  {job.status === 'rejected' && job.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
                      <strong>Lý do từ chối:</strong> {job.rejectionReason}
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="mt-2 p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[11px]">
                      Tin tuyển dụng đang được Quản trị viên Hòa Lạc Việc kiểm duyệt trước khi hiển thị công khai.
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-xs text-text-muted">
                    <div className="flex items-center gap-1.5 text-orange-600 font-bold">
                      <DollarSign className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>{formatVND(job.salaryAmount || 25000)}/giờ</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="truncate">{job.address || 'Hòa Lạc'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-green-dark shrink-0" />
                      <span>Cần tuyển: {job.slots || 1} bạn</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs gap-2">
                  <button
                    onClick={() => handleToggleStatus(job)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm',
                      isClosed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                    )}
                  >
                    {isClosed ? (
                      <><PlayCircle className="w-4 h-4" /> Mở lại tin</>
                    ) : (
                      <><PauseCircle className="w-4 h-4 text-amber-700" /> Tạm dừng tuyển</>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {(job.address || job.location?.lat) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address || `${job.location?.lat},${job.location?.lng}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-semibold border border-transparent hover:border-blue-200"
                        title="Mở tìm kiếm địa chỉ này trên Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleOpenEdit(job)}
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors border border-transparent hover:border-pink-200"
                      title="Chỉnh sửa tin tuyển dụng này"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
                      title="Xóa tin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal create/edit job */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingJob ? "Chỉnh sửa tin tuyển dụng" : "Đăng bài tuyển dụng & Ghim vị trí Bản đồ"}
        >
          <form onSubmit={handleSubmitJob} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-text-main mb-1">Tiêu đề công việc *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Tuyển Nhân viên Pha chế ca Tối (17h-22h)"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-text-main mb-1">Loại hình</label>
                <select
                  value={formData.jobType}
                  onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main bg-white"
                >
                  <option value="Theo ca">Theo ca linh hoạt</option>
                  <option value="Part-time">Part-time cố định</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-text-main mb-1">Mức lương (VNĐ/giờ) *</label>
                <input
                  type="number"
                  required
                  min={15000}
                  step={1000}
                  value={formData.salaryAmount}
                  onChange={e => setFormData({ ...formData, salaryAmount: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>

              <div>
                <label className="block font-bold text-text-main mb-1">SĐT / Zalo của quán *</label>
                <input
                  type="tel"
                  required
                  placeholder="0987654321"
                  value={formData.contactPhone}
                  onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
            </div>

            {/* Địa điểm làm việc */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-gray-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                  <MapPin className="w-4 h-4 text-pink-main" /> Địa điểm làm việc
                </label>
                <span className="text-[11px] text-gray-500 font-medium">Khu vực Hòa Lạc & lân cận</span>
              </div>

              {/* 3 Dropdowns: Tỉnh, Huyện, Xã */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Tỉnh / Thành phố
                  </label>
                  <select
                    value={selectedProvinceCode}
                    onChange={handleProvinceChange}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-medium text-text-main text-xs focus:ring-2 focus:ring-pink-main focus:outline-none"
                  >
                    <option value="">-- Tỉnh / Thành phố --</option>
                    {provinces.map(p => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Quận / Huyện
                  </label>
                  <select
                    value={selectedDistrictCode}
                    onChange={handleDistrictChange}
                    disabled={!selectedProvinceCode || loadingDistricts}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-medium text-text-main text-xs focus:ring-2 focus:ring-pink-main focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {loadingDistricts ? 'Đang tải...' : '-- Quận / Huyện --'}
                    </option>
                    {districts.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Phường / Xã
                  </label>
                  <select
                    value={selectedWardCode}
                    onChange={handleWardChange}
                    disabled={!selectedDistrictCode || loadingWards}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-medium text-text-main text-xs focus:ring-2 focus:ring-pink-main focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {loadingWards ? 'Đang tải...' : '-- Phường / Xã --'}
                    </option>
                    {wards.map(w => (
                      <option key={w.code} value={w.code}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tên quán & Địa chỉ cụ thể */}
              <div className="space-y-2 pt-1">
                <label className="block text-[11px] font-medium text-gray-700">
                  Tên quán / Số nhà, ngõ, đường cụ thể:
                </label>
                <input
                  type="text"
                  value={detailAddress}
                  onChange={e => handleDetailAddressChange(e.target.value)}
                  placeholder="Ví dụ: Cà phê Mộc, Số 10 Thôn 3, hoặc Km 29 Đại lộ Thăng Long..."
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main font-medium text-xs text-text-main placeholder:text-gray-400"
                />

                {/* Interactive Leaflet Location Picker with OpenStreetMap & Nominatim candidates */}
                <div className="pt-2">
                  <LocationPicker
                    value={{
                      lat: formData.lat,
                      lng: formData.lng,
                      locationStatus: formData.locationStatus,
                      locationSource: formData.locationSource,
                    }}
                    onChange={({ lat, lng, locationStatus, locationSource, formattedAddress }) => {
                      setFormData(prev => ({
                        ...prev,
                        lat,
                        lng,
                        locationStatus,
                        locationSource,
                      }));
                      if (formattedAddress && !detailAddress) {
                        setDetailAddress(formattedAddress);
                      }
                    }}
                    addressHint={fullAddressPreview || detailAddress}
                  />
                </div>
              </div>

              {/* Địa chỉ hiển thị trên bài đăng */}
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                    Địa chỉ hiển thị trên tin tuyển dụng:
                  </span>
                  <p className="font-semibold text-gray-800 truncate mt-0.5">
                    {fullAddressPreview || 'Chưa có thông tin'}
                  </p>
                </div>
                {fullAddressPreview && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressPreview)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-blue-600 hover:text-blue-700 font-medium text-xs flex items-center gap-1 ml-2"
                  >
                    Kiểm tra <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-text-main mb-1">Số lượng sinh viên cần tuyển</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.slots}
                  onChange={e => setFormData({ ...formData, slots: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
              <div>
                <label className="block font-bold text-text-main mb-1">Khung ca dự kiến</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Sáng: 7h-12h | Tối: 17h-22h"
                  value={formData.shiftDetail}
                  onChange={e => setFormData({ ...formData, shiftDetail: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Mô tả công việc</label>
              <textarea
                rows={2}
                placeholder="Nêu rõ công việc hàng ngày: Pha chế đồ uống, dọn dẹp quầy bar, phục vụ khách..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main resize-none"
              />
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Yêu cầu & Quyền lợi</label>
              <textarea
                rows={2}
                value={formData.requirements}
                onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="Ví dụ: Chăm chỉ, đúng giờ, làm được ca xoay. Bao cơm ca, thưởng doanh số..."
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main resize-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              >
                {submitting
                  ? (editingJob ? 'Đang lưu...' : 'Đang tạo bài...')
                  : (editingJob ? 'Lưu thay đổi' : 'Đăng tin & Ghim Bản Đồ')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
