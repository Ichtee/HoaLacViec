import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShoppingBag, Utensils, Bike, Truck, Package, Printer,
  MapPin, Clock, DollarSign, Phone, FileText, CheckCircle, ShieldCheck, Loader2, Navigation, CreditCard
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  createTask,
  updateUserProfile,
  apiVietmapAutocomplete,
  apiVietmapPlace,
  apiVietmapRoute,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';

const CATEGORIES = [
  { id: 'di_cho', label: 'Đi chợ / Mua cơm', icon: ShoppingBag, desc: 'Mua hộ đồ ăn, nước uống, đồ tạp hóa tại căng tin, tiệm tạp hóa' },
  { id: 'nau_an', label: 'Nấu ăn hộ', icon: Utensils, desc: 'Chuẩn bị cơm trưa/tối cho phòng KTX hoặc nhóm bạn' },
  { id: 'xe_om', label: 'Xe ôm sinh viên', icon: Bike, desc: 'Chở đi học, ra bến xe, sang ĐH FPT, ĐHQG, Tân Xã' },
  { id: 'chuyen_do', label: 'Chuyển đồ / Dọn phòng', icon: Truck, desc: 'Phụ vác vali, thùng đồ, chuyển phòng KTX hoặc trọ' },
  { id: 'lay_ship', label: 'Nhận ship / Lấy hàng', icon: Package, desc: 'Nhận hộ kiện hàng Shopee/Lazada tại cổng, gửi bưu kiện' },
  { id: 'khac', label: 'Việc khác', icon: Printer, desc: 'In ấn tài liệu, photo bài giảng, việc vặt linh tinh' },
];

function VietmapAddressAutocomplete({
  label,
  value,
  placeholder,
  required = false,
  isConfirmed = false,
  onChange,
  onSelect,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (text) => {
    onChange(text);
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiVietmapAutocomplete(text.trim(), '21.0128,105.5255', controller.signal);
        const rawItems = res?.items || res?.suggestions || [];
        if (rawItems.length > 0) {
          const mapped = rawItems.map((item) => ({
            refId: item.refId,
            title: item.display || item.name || item.title || '',
            address: item.currentAddress || item.legacyAddress || item.address || '',
          }));
          setSuggestions(mapped.slice(0, 8));
          setOpen(mapped.length > 0);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[VietmapSuggest]', err.message);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  };

  const handleSelect = async (item) => {
    setOpen(false);
    setSuggestions([]);
    try {
      setLoading(true);
      const place = await apiVietmapPlace(item.refId);
      if (place && typeof place.lat === 'number' && typeof place.lng === 'number') {
        onSelect({
          address: place.display || place.formattedAddress || item.title,
          lat: place.lat,
          lng: place.lng,
          refId: item.refId,
        });
      } else {
        onSelect({
          address: item.title,
          lat: null,
          lng: null,
          refId: item.refId,
        });
      }
    } catch {
      onSelect({
        address: item.title,
        lat: null,
        lng: null,
        refId: item.refId,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-text-main">
          {label} {required && <span className="text-red-700">*</span>}
        </label>
        {isConfirmed && (
          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Tọa độ Vietmap xác nhận
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all bg-white"
        />
        <MapPin className="w-4 h-4 text-green-dark absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 text-orange-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-modal overflow-hidden z-50 max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
          {suggestions.map((item, idx) => (
            <li
              key={item.refId || idx}
              onClick={() => handleSelect(item)}
              className="p-3 hover:bg-green-50/70 cursor-pointer transition-colors flex items-start gap-2.5"
            >
              <MapPin className="w-4 h-4 text-green-dark shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-text-main text-xs truncate">{item.title}</p>
                {item.address && <p className="text-[11px] text-text-muted truncate mt-0.5">{item.address}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CreateMicroTaskPage() {
  const navigate = useNavigate();
  const { user, updateUser, isAuthenticated } = useAuth();

  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  // Initialize deadline to +3 hours from now in local timezone
  const defaultDeadline = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 3);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  })();

  const [formData, setFormData] = useState({
    title: '',
    category: 'di_cho',
    reward: 30000,
    itemBudget: 0,
    paymentMethod: 'cash',
    location: '',
    locationCoordinates: null,
    locationRefId: null,
    locationStatus: 'unconfirmed',
    pickupAddress: '',
    pickup: null,
    destinationAddress: '',
    destination: null,
    route: null,
    deadlineDate: defaultDeadline,
    description: '',
    phone: user?.phone || '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/tasks/create', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (user?.phone && !formData.phone) {
      setFormData((prev) => ({ ...prev, phone: user.phone }));
    }
  }, [user]);

  async function updateEstimatedRoute(pPoint, dPoint) {
    if (!pPoint || !dPoint || typeof pPoint.lat !== 'number' || typeof dPoint.lat !== 'number') return;
    try {
      setCalculatingRoute(true);
      const res = await apiVietmapRoute({
        origin: { lat: pPoint.lat, lng: pPoint.lng },
        destination: { lat: dPoint.lat, lng: dPoint.lng },
        vehicle: 'motorcycle',
      });
      const routeData = res?.route || (res?.success ? res : null);
      if (routeData) {
        setFormData((prev) => ({
          ...prev,
          route: routeData,
        }));
      }
    } catch (err) {
      console.warn('[RouteCalc]', err.message);
    } finally {
      setCalculatingRoute(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.title.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập tiêu đề việc cần nhờ.' });
      return;
    }

    if (!formData.reward || Number(formData.reward) < 5000) {
      setToast({ type: 'error', message: 'Mức tiền công tối thiểu là 5.000 VNĐ.' });
      return;
    }

    const isRouteCategory = ['xe_om', 'chuyen_do'].includes(formData.category);
    if (isRouteCategory && (!formData.pickupAddress || !formData.destinationAddress)) {
      setToast({ type: 'error', message: 'Vui lòng điền đủ cả điểm đón và điểm đến.' });
      return;
    }

    if (!isRouteCategory && !formData.location) {
      setToast({ type: 'error', message: 'Vui lòng nhập địa chỉ / địa điểm thực hiện việc vặt.' });
      return;
    }

    if (!formData.deadlineDate) {
      setToast({ type: 'error', message: 'Vui lòng chọn thời hạn cần xong việc.' });
      return;
    }

    if (new Date(formData.deadlineDate) <= new Date()) {
      setToast({ type: 'error', message: 'Thời hạn hoàn thành phải ở thời gian tương lai.' });
      return;
    }

    if (!formData.phone.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập số điện thoại để người nhận việc liên lạc.' });
      return;
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setToast({ type: 'error', message: 'Vui lòng mô tả chi tiết công việc từ ít nhất 10 ký tự.' });
      return;
    }

    try {
      setSubmitting(true);
      await createTask({
        ...formData,
        reward: Number(formData.reward),
        itemBudget: Number(formData.itemBudget) || 0,
      });

      if (formData.phone && !user?.phone) {
        updateUserProfile({ phone: formData.phone.trim() }).catch(() => {});
        if (updateUser) updateUser({ ...user, phone: formData.phone.trim() });
      }

      setToast({ type: 'success', message: 'Đăng việc thành công! Đang chuyển về Chợ Việc Vặt...' });
      setTimeout(() => {
        navigate('/tasks?tab=my_posted');
      }, 1200);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi đăng việc vặt.' });
    } finally {
      setSubmitting(false);
    }
  }

  const isRouteCategory = ['xe_om', 'chuyen_do'].includes(formData.category);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Toast Notification */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Navigation Back */}
      <button
        type="button"
        onClick={() => navigate('/tasks')}
        className="inline-flex items-center gap-2 text-text-muted hover:text-green-dark text-sm font-semibold mb-6 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Quay lại Chợ Việc Vặt
      </button>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-green-100 shadow-card overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-6 sm:p-8 text-white relative">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold mb-3 border border-white/30">
              Chợ Việc Vặt Siêu Địa Phương Hòa Lạc
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Đăng việc vặt cần nhờ sinh viên
            </h1>
            <p className="text-orange-100 text-xs sm:text-sm mt-2 leading-relaxed">
              Mô tả chi tiết công việc bạn cần nhờ (mua cơm, ship đồ, xe ôm, chuyển phòng...) để các bạn sinh viên xung quanh nhận làm và hỗ trợ bạn nhanh nhất.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Section 1: Tiêu đề & Danh mục */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-dark flex items-center gap-2 pb-2 border-b border-gray-100">
              <FileText className="w-4 h-4" /> 1. Thông tin công việc cần nhờ
            </h2>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1.5">
                Tiêu đề việc cần nhờ <span className="text-red-700">*</span>
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={120}
                placeholder="VD: Nhờ mua cơm trưa giao KTX Dom A, Xe ôm sang KTX ĐHQG..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Tiêu đề ngắn gọn, rõ ràng giúp các bạn sinh viên dễ dàng nhận diện và bấm nhận việc ngay.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-2">
                Phân loại danh mục <span className="text-red-700">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = formData.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-green-main bg-green-50/80 ring-2 ring-green-main/40 shadow-xs'
                          : 'border-gray-200 hover:border-green-200 hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-green-main text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-text-main leading-tight">{cat.label}</span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-2 line-clamp-2 leading-tight">{cat.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Chi phí & Thù lao */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-dark flex items-center gap-2 pb-2 border-b border-gray-100">
              <DollarSign className="w-4 h-4" /> 2. Tiền công thù lao & Chi phí mua sắm
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Tiền công thù lao (VNĐ) <span className="text-red-700">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5000"
                    min="5000"
                    required
                    value={formData.reward}
                    onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                    className="w-full pl-9 pr-12 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-green-dark focus:outline-none focus:ring-2 focus:ring-green-main"
                  />
                  <DollarSign className="w-4 h-4 text-green-dark absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <span className="text-xs font-semibold text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    VNĐ
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Số tiền người nhận việc sẽ nhận được khi xong.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Tiền ứng mua hộ (nếu có)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5000"
                    min="0"
                    value={formData.itemBudget}
                    onChange={(e) => setFormData({ ...formData, itemBudget: e.target.value })}
                    placeholder="0"
                    className="w-full pl-9 pr-12 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-main"
                  />
                  <CreditCard className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <span className="text-xs font-semibold text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    VNĐ
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Số tiền cần ứng trước để thanh toán tiền cơm, tạp hóa...</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">Hình thức trả tiền</label>
                <select aria-label="Hình thức trả tiền"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-main bg-white"
                >
                  <option value="cash">Tiền mặt trực tiếp khi nhận</option>
                  <option value="banking">Chuyển khoản ngân hàng / QR</option>
                </select>
                <p className="text-[11px] text-text-muted mt-1">Thỏa thuận cách thanh toán thuận tiện nhất.</p>
              </div>
            </div>
          </div>

          {/* Section 3: Địa điểm thực hiện */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-dark flex items-center gap-2 pb-2 border-b border-gray-100">
              <MapPin className="w-4 h-4" /> 3. Địa điểm thực hiện công việc
            </h2>

            {isRouteCategory ? (
              <div className="space-y-3 p-4 bg-green-50/60 rounded-2xl border border-green-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <VietmapAddressAutocomplete
                    label="Điểm đón / xuất phát"
                    required
                    value={formData.pickupAddress}
                    placeholder="VD: Cổng 1 ĐH FPT, KTX Dom E..."
                    isConfirmed={Boolean(formData.pickup?.lat)}
                    onChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        pickupAddress: val,
                        pickup: null,
                        route: null,
                      }));
                    }}
                    onSelect={(place) => {
                      setFormData((prev) => {
                        const nextPickup = {
                          address: place.address,
                          lat: place.lat,
                          lng: place.lng,
                          refId: place.refId,
                          status: 'confirmed',
                        };
                        if (prev.destination?.lat) {
                          updateEstimatedRoute(nextPickup, prev.destination);
                        }
                        return {
                          ...prev,
                          pickupAddress: place.address,
                          pickup: nextPickup,
                        };
                      });
                    }}
                  />

                  <VietmapAddressAutocomplete
                    label="Điểm đến"
                    required
                    value={formData.destinationAddress}
                    placeholder="VD: Chợ Tân Xã, KTX ĐHQG, Bến xe bus..."
                    isConfirmed={Boolean(formData.destination?.lat)}
                    onChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        destinationAddress: val,
                        destination: null,
                        route: null,
                      }));
                    }}
                    onSelect={(place) => {
                      setFormData((prev) => {
                        const nextDest = {
                          address: place.address,
                          lat: place.lat,
                          lng: place.lng,
                          refId: place.refId,
                          status: 'confirmed',
                        };
                        if (prev.pickup?.lat) {
                          updateEstimatedRoute(prev.pickup, nextDest);
                        }
                        return {
                          ...prev,
                          destinationAddress: place.address,
                          destination: nextDest,
                        };
                      });
                    }}
                  />
                </div>

                {calculatingRoute && (
                  <div className="flex items-center gap-2 text-xs text-green-dark bg-white/80 p-3 rounded-xl border border-green-200">
                    <Loader2 className="w-4 h-4 animate-spin text-green-dark" />
                    <span>Đang đo cự ly và thời gian di chuyển bằng xe máy qua Vietmap Route v4...</span>
                  </div>
                )}

                {formData.route && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                      <Navigation className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Lộ trình Vietmap: <strong>{formData.route.distanceKm} km</strong> (~<strong>{formData.route.durationMin} phút</strong> đi xe máy)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Xe máy
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <VietmapAddressAutocomplete
                  label="Địa chỉ cụ thể / Nơi nhận giao hàng"
                  required
                  value={formData.location}
                  placeholder="VD: KTX Dom A ĐH FPT, Phòng 302, Thôn 3 Thạch Hòa..."
                  isConfirmed={Boolean(formData.locationCoordinates?.lat)}
                  onChange={(val) => {
                    setFormData((prev) => ({
                      ...prev,
                      location: val,
                      locationCoordinates: null,
                      locationRefId: null,
                      locationStatus: 'unconfirmed',
                    }));
                  }}
                  onSelect={(place) => {
                    setFormData((prev) => ({
                      ...prev,
                      location: place.address,
                      locationCoordinates: { lat: place.lat, lng: place.lng },
                      locationRefId: place.refId,
                      locationStatus: 'confirmed',
                    }));
                  }}
                />
              </div>
            )}
          </div>

          {/* Section 4: Thời hạn & Liên hệ */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-dark flex items-center gap-2 pb-2 border-b border-gray-100">
              <Clock className="w-4 h-4" /> 4. Thời gian cần xong & Thông tin liên hệ
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Thời hạn cần xong (Hạn chót) <span className="text-red-700">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.deadlineDate}
                  onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-main bg-white"
                />
                <p className="text-[11px] text-text-muted mt-1">Quá thời hạn này, việc sẽ tự động đóng nếu chưa có ai nhận.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Số điện thoại di động / Zalo <span className="text-red-700">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    placeholder="VD: 0987654321"
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-main"
                  />
                  <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  🛡️ SĐT được bảo mật và chỉ hiển thị đầy đủ cho bạn sinh viên nhận việc.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Mô tả chi tiết */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-dark flex items-center gap-2 pb-2 border-b border-gray-100">
              <FileText className="w-4 h-4" /> 5. Mô tả chi tiết yêu cầu
            </h2>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1.5">
                Nội dung chi tiết việc cần nhờ <span className="text-red-700">*</span>
              </label>
              <textarea
                rows={4}
                required
                minLength={10}
                maxLength={2000}
                value={formData.description}
                placeholder="Ghi rõ tên món đồ cần mua, số lượng, lưu ý giao nhận, số phòng hoặc bất kỳ yêu cầu cụ thể nào..."
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main leading-relaxed"
              />
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Quy định cộng đồng & An toàn việc vặt Hòa Lạc:</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Nghiêm cấm các hành vi gian lận, thi hộ/làm bài hộ, vận chuyển hàng cấm hoặc yêu cầu đặt cọc tiền giữ chỗ. Mọi hành vi vi phạm sẽ bị khóa tài khoản vĩnh viễn và xử lý theo quy định của nhà trường.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng việc...</span>
                </>
              ) : (
                'Đăng việc ngay lên Chợ'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
