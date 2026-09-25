import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Briefcase, Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, MapPin,
  Clock, DollarSign, Users, Eye, CheckCircle, Navigation, Crosshair, ExternalLink, Sparkles,
  Loader2, AlertCircle, PauseCircle, PlayCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs, createJob, updateJob, deleteJob, resolveMapLink, searchPlaces, getEmployerProfile, updateUserProfile } from '@/services';
import { loadGoogleMapsScript } from '@/services/googleMaps';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { formatVND } from '@/utils';
import { getProvinces, getDistricts, getWards, getWardCoordinates } from '@/services/provinces';

// Quick client-side parser for coordinates and Google Maps URLs
function parseGoogleCoordsClient(input) {
  if (!input || typeof input !== 'string') return null;
  const text = input.trim();

  // 1. Raw coordinates (e.g. "21.03752, 105.51203" or "21.03752 105.51203")
  const rawMatch = text.match(/^(-?\d+\.\d{3,})[,\s]+(-?\d+\.\d{3,})$/);
  if (rawMatch) {
    return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };
  }

  // 2. DMS coordinates: 21°02'15.0"N 105°30'44.3"E
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([NSEW])/gi;
  const dmsMatches = [...text.matchAll(dmsRegex)];
  if (dmsMatches.length >= 2) {
    const toDec = (deg, min, sec, dir) => {
      let d = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
      if (dir === 'S' || dir === 'W') d = -d;
      return Math.round(d * 100000) / 100000;
    };
    return {
      lat: toDec(dmsMatches[0][1], dmsMatches[0][2], dmsMatches[0][3], dmsMatches[0][4].toUpperCase()),
      lng: toDec(dmsMatches[1][1], dmsMatches[1][2], dmsMatches[1][3], dmsMatches[1][4].toUpperCase())
    };
  }

  // 3. URL with @lat,lng
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // 4. URL with query / q / destination / ll
  const qMatch = text.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+)[,+](-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 5. Protobuf coordinates !3dlat!4dlng in Google Maps URLs
  const protoMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    return { lat: parseFloat(protoMatch[1]), lng: parseFloat(protoMatch[2]) };
  }

  return null;
}

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
  const detailAddressInputRef = useRef(null);

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
    address: 'Xã Tân Xã, Huyện Thạch Thất, Thành phố Hà Nội',
    area: 'tan_xa',
    lat: 21.0175,
    lng: 105.5220,
    shiftDetail: '',
    slots: 1,
    description: '',
    requirements: '',
    benefits: ''
  });

  const [editingJob, setEditingJob] = useState(null);

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

  useEffect(() => {
    if (user?.phone) {
      setEmployerPhone(prev => prev || user.phone);
      setFormData(prev => ({
        ...prev,
        contactPhone: prev.contactPhone || user.phone
      }));
    }
  }, [user?.phone]);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await getJobs({ storeName: user?.name, employerId: user?.id });
      const list = Array.isArray(res) ? res : (res?.jobs || []);
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

  // Initialize Google Places Autocomplete when modal is open and API Key is present
  useEffect(() => {
    if (!isModalOpen || !detailAddressInputRef.current) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey)
      .then((googleMaps) => {
        if (!detailAddressInputRef.current) return;
        const autocomplete = new googleMaps.places.Autocomplete(detailAddressInputRef.current, {
          componentRestrictions: { country: 'vn' },
          fields: ['address_components', 'geometry', 'formatted_address', 'name'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const placeName = place.name || place.formatted_address;
            setDetailAddress(placeName);
            setFormData(prev => ({
              ...prev,
              lat,
              lng,
            }));
            setGeoCustomVerified(true);
            setMapLinkInput(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        });
      })
      .catch(() => {});
  }, [isModalOpen]);

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

    const coords = getWardCoordinates(selectedProvinceName, selectedDistrictName, wName);
    setFormData(prev => ({
      ...prev,
      area: coords.area,
      lat: coords.lat,
      lng: coords.lng,
    }));
    // Reset custom verified if ward is manually changed, unless already custom pinned
  }

  // Google Maps Link & Coordinate Extraction State
  const [mapLinkInput, setMapLinkInput] = useState('');
  const [resolvingGeo, setResolvingGeo] = useState(false);
  const [geoCustomVerified, setGeoCustomVerified] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geoNotFound, setGeoNotFound] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [suggestedPlaces, setSuggestedPlaces] = useState([]);
  const [showManualLink, setShowManualLink] = useState(false);
  const debounceTimerRef = useRef(null);

  // Search Google Maps places via SerpApi with intelligent local context
  async function handleSearchSerpApiPlaces(overrideQuery) {
    const raw = (overrideQuery !== undefined ? overrideQuery : detailAddress || '').trim();
    if (!raw || raw.length < 2) {
      setGeoError('Vui lòng nhập tên quán từ 2 ký tự (VD: "Xôi Bánh Mỳ cô Hà" hoặc "Cà phê Mộc")');
      return;
    }
    setGeoError('');
    setGeoNotFound(false);
    setSearchingPlaces(true);
    try {
      // Build location-aware query so Google Maps knows to look around Thạch Thất / Hòa Lạc
      let query = raw;
      const lower = raw.toLowerCase();
      const areaParts = [selectedWardName, selectedDistrictName, 'Hà Nội'].filter(Boolean);
      const areaContext = areaParts.join(', ');

      if (!lower.includes('hòa lạc') && !lower.includes('thạch thất') && !lower.includes('hà nội')) {
        query = areaContext ? `${raw}, ${areaContext}` : `${raw}, Hòa Lạc, Hà Nội`;
      }

      const center = { lat: Number(formData.lat) || 21.0128, lng: Number(formData.lng) || 105.5255 };
      let res = await searchPlaces(query, center);

      // Fallback: try raw query if scoped search returned 0
      if ((!res?.places || res.places.length === 0) && query !== raw) {
        res = await searchPlaces(raw, center);
      }

      if (res?.places && res.places.length > 0) {
        setSuggestedPlaces(res.places);
        setGeoError('');
        setGeoNotFound(false);
      } else {
        setSuggestedPlaces([]);
        setGeoNotFound(true);
        setGeoError('');
      }
    } catch (err) {
      setGeoError(err.message || 'Lỗi khi gọi Google Maps');
      setSuggestedPlaces([]);
    } finally {
      setSearchingPlaces(false);
    }
  }

  // Update detailAddress without burning SerpApi requests while typing
  function handleDetailAddressChange(val) {
    setDetailAddress(val);
    if (suggestedPlaces.length > 0) {
      setSuggestedPlaces([]);
    }
    if (geoError) setGeoError('');
    if (geoNotFound) setGeoNotFound(false);
  }

  function handleSelectSerpPlace(place) {
    setDetailAddress(place.title);
    setFormData(prev => ({
      ...prev,
      lat: place.lat,
      lng: place.lng,
      address: place.address || prev.address,
    }));
    setGeoCustomVerified(true);
    setSuggestedPlaces([]);
    setMapLinkInput(`${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`);
  }

  // Auto parse as user types or pastes
  async function handleResolveMapLink(inputVal) {
    const val = (inputVal !== undefined ? inputVal : mapLinkInput).trim();
    if (!val) {
      setGeoError('Vui lòng nhập link Google Maps hoặc tọa độ');
      return;
    }
    setGeoError('');

    // 1. Instant client-side regex parse
    const clientParsed = parseGoogleCoordsClient(val);
    if (clientParsed) {
      setFormData(prev => ({ ...prev, lat: clientParsed.lat, lng: clientParsed.lng }));
      setGeoCustomVerified(true);
      setGeoError('');
      return;
    }

    // 2. Call backend redirect resolver (for maps.app.goo.gl short links)
    try {
      setResolvingGeo(true);
      const res = await resolveMapLink(val);
      if (res?.lat && res?.lng) {
        setFormData(prev => ({ ...prev, lat: res.lat, lng: res.lng }));
        setGeoCustomVerified(true);
        setGeoError('');
      } else {
        setGeoError('Không tìm thấy tọa độ. Bạn có thể mở Google Maps rồi copy số tọa độ (VD: 21.0375, 105.5120) dán vào đây.');
      }
    } catch {
      setGeoError('Không thể phân giải link. Bạn hãy copy số tọa độ trên Google Maps (VD: 21.0375, 105.5120) dán vào đây.');
    } finally {
      setResolvingGeo(false);
    }
  }

  // Get current device GPS location for store owner
  function handleGetDeviceLocation() {
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setResolvingGeo(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }));
        setGeoCustomVerified(true);
        setResolvingGeo(false);
        setMapLinkInput(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        console.warn('Geo error:', err);
        setResolvingGeo(false);
        setGeoError('Không thể lấy vị trí GPS: Vui lòng cho phép quyền truy cập vị trí trên trình duyệt.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function handleOpenCreate() {
    setEditingJob(null);
    setDetailAddress('');
    setFormData({
      title: '',
      jobType: 'Theo ca',
      salaryAmount: 25000,
      salaryUnit: 'hour',
      contactPhone: user?.phone || employerPhone || '',
      address: 'Xã Tân Xã, Huyện Thạch Thất, Thành phố Hà Nội',
      area: 'tan_xa',
      lat: 21.0175,
      lng: 105.5220,
      shiftDetail: '',
      slots: 1,
      description: '',
      requirements: '',
      benefits: '',
    });
    setGeoCustomVerified(false);
    setGeoError('');
    setGeoNotFound(false);
    setIsModalOpen(true);
  }

  function handleOpenEdit(job) {
    setEditingJob(job);
    setDetailAddress(job.address?.split(',')[0] || '');
    setFormData({
      title: job.title || '',
      jobType: job.type === 'shift' ? 'Theo ca' : 'Part-time',
      salaryAmount: job.salaryAmount || 25000,
      salaryUnit: job.salaryUnit || 'hour',
      contactPhone: job.contactPhone || user?.phone || employerPhone || '',
      address: job.address || '',
      area: job.area || 'tan_xa',
      lat: job.location?.lat || 21.0175,
      lng: job.location?.lng || 105.5220,
      shiftDetail: job.shiftDetail || 'Sáng: 7h-12h | Tối: 17h-22h',
      slots: job.slots || 2,
      description: job.description || '',
      requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : (job.requirements || ''),
      benefits: Array.isArray(job.benefits) ? job.benefits.join('\n') : (job.benefits || ''),
    });
    setGeoCustomVerified(Boolean(job.location?.lat && job.location?.lng));
    setGeoError('');
    setGeoNotFound(false);
    setIsModalOpen(true);
  }

  async function handleSubmitJob(e) {
    e.preventDefault();
    try {
      setSubmitting(true);

      const finalAddress = fullAddressPreview || formData.address;
      let finalLat = Number(formData.lat);
      let finalLng = Number(formData.lng);

      if (!geoCustomVerified && finalAddress) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(finalAddress)}`,
            { headers: { 'Accept-Language': 'vi', 'User-Agent': 'HoaLacViec/1.0' } }
          );
          const geoData = await geoRes.json();
          if (geoData?.[0]?.lat && geoData?.[0]?.lon) {
            finalLat = parseFloat(geoData[0].lat);
            finalLng = parseFloat(geoData[0].lon);
          }
        } catch {}
      }

      const inputPhone = formData.contactPhone?.trim() || user?.phone || employerPhone || '';
      const payload = {
        title: formData.title,
        type: formData.jobType === 'Theo ca' ? 'shift' : 'part_time',
        storeName: user?.name || 'Cửa hàng',
        employerId: user?.profileId || user?.id,
        salaryAmount: Number(formData.salaryAmount) || 25000,
        salaryUnit: formData.salaryUnit,
        contactPhone: inputPhone,
        area: formData.area,
        address: finalAddress,
        location: {
          lat: finalLat,
          lng: finalLng,
        },
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
        setToast({ type: 'success', message: 'Tạo tin tuyển dụng thành công! Đã ghim vị trí quán lên Bản đồ việc làm.' });
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

              {/* Tên quán & Tìm kiếm vị trí Google Maps */}
              <div className="space-y-2 pt-1">
                <label className="block text-[11px] font-medium text-gray-700">
                  Tên quán / Địa chỉ cụ thể:
                </label>
                <div className="relative">
                  <input
                    ref={detailAddressInputRef}
                    type="text"
                    value={detailAddress}
                    onChange={e => handleDetailAddressChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchSerpApiPlaces();
                      }
                    }}
                    placeholder="Ví dụ: Highlands Coffee, Quán Cơm 68, Cà phê Mộc..."
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main font-medium text-xs text-text-main placeholder:text-gray-400 pr-24"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchSerpApiPlaces()}
                    disabled={searchingPlaces || !detailAddress.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-pink-main hover:bg-pink-dark disabled:opacity-40 text-white font-semibold text-xs transition-all flex items-center gap-1 shadow-sm"
                  >
                    {searchingPlaces ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Tìm vị trí
                  </button>
                </div>

                {/* Tiện ích trợ giúp nhanh */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGetDeviceLocation}
                      disabled={resolvingGeo}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors py-0.5 font-medium"
                      title="Lấy vị trí GPS nếu bạn đang ở tại quán"
                    >
                      <Crosshair className="w-3 h-3 text-blue-500" />
                      <span>Lấy vị trí hiện tại của bạn</span>
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setShowManualLink(prev => !prev)}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors py-0.5 font-medium"
                    >
                      <Navigation className="w-3 h-3 text-blue-500" />
                      <span>{showManualLink ? 'Ẩn ô dán link' : 'Hoặc dán link Google Maps'}</span>
                    </button>
                  </div>

                  {searchingPlaces && (
                    <span className="text-pink-600 flex items-center gap-1 animate-pulse font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm kiếm...
                    </span>
                  )}
                </div>

                {/* Hộp dán link mở rộng (khi cần) */}
                {showManualLink && (
                  <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 space-y-1.5 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={mapLinkInput}
                        onChange={e => setMapLinkInput(e.target.value)}
                        placeholder="Dán link Google Maps (maps.app.goo.gl/...)..."
                        className="flex-1 p-2 rounded-lg border border-blue-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveMapLink(mapLinkInput)}
                        disabled={resolvingGeo || !mapLinkInput.trim()}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 disabled:opacity-50"
                      >
                        {resolvingGeo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Xác nhận'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Danh sách gợi ý từ Google Maps */}
                {suggestedPlaces.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-2 space-y-1 max-h-56 overflow-y-auto z-10 animate-fade-in">
                    <p className="text-[11px] font-semibold text-gray-500 px-1.5 py-0.5">
                      Gợi ý địa điểm từ Google Maps (bấm để chọn):
                    </p>
                    {suggestedPlaces.map((place, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSerpPlace(place)}
                        className="p-2.5 hover:bg-pink-50/70 rounded-xl cursor-pointer transition-all border border-transparent hover:border-pink-100 flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-main flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-pink-main group-hover:text-white transition-colors">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-gray-800 truncate">{place.title}</p>
                            <p className="text-[11px] text-gray-500 truncate">{place.address}</p>
                            {place.rating && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                ⭐ {place.rating} ({place.reviews || 0} đánh giá)
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-semibold bg-white group-hover:bg-pink-main group-hover:text-white text-gray-700 rounded-lg border border-gray-200 group-hover:border-transparent shrink-0 shadow-sm transition-all"
                        >
                          Chọn
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Khi không tìm thấy trên Google Maps (Fallback mượt mà) */}
                {geoNotFound && !suggestedPlaces.length && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950">
                      <span>💡 Quán chưa đăng ký trên Google Maps? Không sao cả!</span>
                    </div>
                    <p className="text-blue-800 text-[11px] leading-relaxed">
                      Bạn vẫn đăng tin bình thường với tên quán <strong>"{detailAddress}"</strong>. Hệ thống sẽ tự động ghim vị trí quán tại trung tâm <strong>{selectedWardName || 'Xã / Phường bạn đã chọn'}</strong> trên Bản đồ.
                    </p>
                    <p className="text-[11px] text-blue-700">
                      👉 <em>Mẹo chuẩn từng mét:</em> Bấm <strong>"Lấy vị trí hiện tại của bạn"</strong> ở trên nếu bạn đang ngồi tại quán.
                    </p>
                  </div>
                )}

                {/* Thông báo lỗi nhẹ nhàng khác nếu có */}
                {geoError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{geoError}</span>
                  </div>
                )}

                {/* Thẻ xác nhận đã định vị vị trí thành công */}
                {geoCustomVerified && (
                  <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">Đã định vị thành công trên Google Maps</p>
                        <p className="text-[11px] text-emerald-700 truncate">{detailAddress || 'Tọa độ GPS chính xác'}</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${formData.lat},${formData.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-semibold text-[11px] flex items-center gap-1 shrink-0 bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Xem bản đồ
                    </a>
                  </div>
                )}
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
