import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  Briefcase,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Camera,
  ArrowRight,
  Search,
  ChevronDown,
  Check,
  IdCard,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  submitStudentVerification,
  getStudentVerification,
  submitWorkerVerification,
  getWorkerVerification,
  getEmployerVerification,
  submitEmployerVerification,
  getUniversities,
  updateUserProfile,
} from '@/services';
import { Input, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';

const STORE_TYPES = [
  { value: 'Quán cà phê', label: 'Quán cà phê / Trà sữa' },
  { value: 'Quán ăn / Nhà hàng', label: 'Quán ăn / Nhà hàng' },
  { value: 'Cửa hàng tiện lợi', label: 'Cửa hàng tiện lợi / Siêu thị mini' },
  { value: 'Shop thời trang / Phụ kiện', label: 'Shop thời trang / Phụ kiện' },
  { value: 'Tiệm photocopy / In ấn', label: 'Tiệm photocopy / In ấn' },
  { value: 'Khác', label: 'Mô hình kinh doanh khác' },
];

const WORKER_PROFESSIONS = [
  { value: 'Giao hàng / Shipper', label: 'Giao hàng / Shipper' },
  { value: 'Phục vụ bàn / Pha chế', label: 'Phục vụ bàn / Pha chế' },
  { value: 'Bán hàng / Thu ngân', label: 'Bán hàng / Thu ngân' },
  { value: 'Tạp vụ / Dọn dẹp / Buồng phòng', label: 'Tạp vụ / Dọn dẹp / Buồng phòng' },
  { value: 'Thợ sửa chữa / Kỹ thuật', label: 'Thợ sửa chữa / Điện nước / Kỹ thuật' },
  { value: 'Bảo vệ / Lễ tân', label: 'Bảo vệ / Trông xe / Lễ tân' },
  { value: 'Gia sư / Trợ giảng', label: 'Gia sư / Trợ giảng' },
  { value: 'Lao động phổ thông tự do', label: 'Lao động phổ thông tự do khác' },
];

export default function VerifyAccountPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'employer'
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Student verification form & state
  const [existingStudentVerification, setExistingStudentVerification] = useState(null);
  const [editingStudent, setEditingStudent] = useState(false);
  const [university, setUniversity] = useState('Đại học FPT Hòa Lạc');
  const [uniSearch, setUniSearch] = useState('Đại học FPT Hòa Lạc');
  const [universityList, setUniversityList] = useState([]);
  const [isUniDropdownOpen, setIsUniDropdownOpen] = useState(false);
  const [loadingUnis, setLoadingUnis] = useState(false);
  const uniDropdownRef = useRef(null);

  const [studentCode, setStudentCode] = useState('');
  const [major, setMajor] = useState('Kỹ thuật phần mềm');
  const [transport, setTransport] = useState('xe_may');
  const [studentCardPhoto, setStudentCardPhoto] = useState('');

  // Fetch universities from API (Hipolabs)
  useEffect(() => {
    async function loadUniversities() {
      try {
        setLoadingUnis(true);
        const data = await getUniversities();
        if (Array.isArray(data) && data.length > 0) {
          setUniversityList(data);
        }
      } catch (err) {
        console.warn('Failed to load universities:', err);
      } finally {
        setLoadingUnis(false);
      }
    }
    loadUniversities();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (uniDropdownRef.current && !uniDropdownRef.current.contains(e.target)) {
        setIsUniDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered universities based on user typing
  const filteredUniversities = useMemo(() => {
    if (!uniSearch.trim()) return universityList;
    const q = uniSearch.toLowerCase().trim();
    return universityList.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.domain && u.domain.toLowerCase().includes(q))
    );
  }, [universityList, uniSearch]);

  // Worker verification form & state
  const [existingWorkerVerification, setExistingWorkerVerification] = useState(null);
  const [editingWorker, setEditingWorker] = useState(false);
  const [workerFullName, setWorkerFullName] = useState(user?.name || '');
  const [workerPhone, setWorkerPhone] = useState(user?.phone || '');
  const [workerIdCardNumber, setWorkerIdCardNumber] = useState('');
  const [workerProfession, setWorkerProfession] = useState('Giao hàng / Shipper');
  const [workerTransport, setWorkerTransport] = useState('xe_may');
  const [workerBio, setWorkerBio] = useState('');
  const [workerIdCardFront, setWorkerIdCardFront] = useState('');
  const [workerIdCardBack, setWorkerIdCardBack] = useState('');

  // Employer verification form & state
  const [existingVerification, setExistingVerification] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('Quán cà phê');
  const [legalName, setLegalName] = useState(user?.name || '');
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [description, setDescription] = useState('');
  const [storePhoto, setStorePhoto] = useState('');

  // Auto-fill phone and name if user object updates
  useEffect(() => {
    if (user?.phone) {
      if (!contactPhone) setContactPhone(user.phone);
      if (!workerPhone) setWorkerPhone(user.phone);
    }
    if (user?.name) {
      if (!legalName) setLegalName(user.name);
      if (!workerFullName) setWorkerFullName(user.name);
    }
  }, [user]);

  // Fetch verification status for student, worker, and employer on load
  useEffect(() => {
    async function checkVerification() {
      try {
        setFetchingStatus(true);
        const [empRes, stuRes, wrkRes] = await Promise.allSettled([
          getEmployerVerification(),
          getStudentVerification(),
          getWorkerVerification(),
        ]);

        let hasEmployer = false;
        let hasStudent = false;
        let hasWorker = false;

        if (empRes.status === 'fulfilled' && empRes.value && empRes.value.status && empRes.value.status !== 'draft') {
          const empData = empRes.value;
          setExistingVerification(empData);
          hasEmployer = true;
          if (empData.storeName) setStoreName(empData.storeName);
          if (empData.legalName) setLegalName(empData.legalName);
          if (empData.businessAddress) setBusinessAddress(empData.businessAddress);
          if (empData.contactPhone) setContactPhone(empData.contactPhone);
          if (empData.idCardNumber) setIdCardNumber(empData.idCardNumber);
          if (empData.taxCode) setTaxCode(empData.taxCode);
        }

        if (stuRes.status === 'fulfilled' && stuRes.value) {
          const stuData = stuRes.value;
          const status = stuData.verificationStatus || stuData.status;
          if (status !== 'draft' || stuData.studentCardPhoto) {
            setExistingStudentVerification(stuData);
            hasStudent = true;
            if (stuData.university) {
              setUniversity(stuData.university);
              setUniSearch(stuData.university);
            }
            if (stuData.studentCode) setStudentCode(stuData.studentCode);
            if (stuData.major) setMajor(stuData.major);
            if (stuData.transport) setTransport(stuData.transport);
            if (stuData.studentCardPhoto) setStudentCardPhoto(stuData.studentCardPhoto);
          }
        }

        if (wrkRes.status === 'fulfilled' && wrkRes.value) {
          const wrkData = wrkRes.value;
          const status = wrkData.verificationStatus || wrkData.status;
          if (status !== 'draft' || wrkData.idCardFrontPhoto || wrkData.idCardNumber) {
            setExistingWorkerVerification(wrkData);
            hasWorker = true;
            if (wrkData.idCardNumber) setWorkerIdCardNumber(wrkData.idCardNumber);
            if (wrkData.profession) setWorkerProfession(wrkData.profession);
            if (wrkData.transport) setWorkerTransport(wrkData.transport);
            if (wrkData.idCardFrontPhoto) setWorkerIdCardFront(wrkData.idCardFrontPhoto);
            if (wrkData.idCardBackPhoto) setWorkerIdCardBack(wrkData.idCardBackPhoto);
          }
        }

        // Auto select tab based on existing submission or user role
        if (user?.role === 'worker' || user?.role === 'freelancer' || (hasWorker && !hasStudent && !hasEmployer)) {
          setActiveTab('worker');
        } else if (hasEmployer && !hasStudent && !hasWorker) {
          setActiveTab('employer');
        } else {
          setActiveTab('student');
        }
      } catch (err) {
        // No record yet
      } finally {
        setFetchingStatus(false);
      }
    }
    checkVerification();
  }, []);

  // Handle worker ID card front upload
  function handleWorkerFrontUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh quá lớn (tối đa 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setWorkerIdCardFront(uploadEvent.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  // Handle worker ID card back upload
  function handleWorkerBackUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh quá lớn (tối đa 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setWorkerIdCardBack(uploadEvent.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  // Submit worker verification
  async function handleSubmitWorker(e) {
    e.preventDefault();
    const cleanId = (workerIdCardNumber || '').trim().replace(/\s+/g, '');
    if (!cleanId) {
      setError('Vui lòng nhập số Căn cước công dân (CCCD).');
      return;
    }
    if (!/^[0-9]{9,12}$/.test(cleanId)) {
      setError('Số CCCD không hợp lệ (phải gồm 9 đến 12 chữ số).');
      return;
    }
    if (!workerIdCardFront) {
      setError('Vui lòng tải lên ảnh chụp mặt trước Căn cước công dân của bạn.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await submitWorkerVerification({
        idCardNumber: cleanId,
        idCardFrontPhoto: workerIdCardFront,
        idCardBackPhoto: workerIdCardBack,
        profession: workerProfession,
        transport: workerTransport,
        bio: workerBio.trim(),
        fullName: workerFullName.trim(),
        phone: workerPhone.trim(),
      });

      updateUser(res.user);
      setExistingWorkerVerification(res.profile);
      setEditingWorker(false);
      setSuccess('Hồ sơ Căn cước công dân đã được gửi thành công! Ban Quản Trị sẽ xét duyệt để kích hoạt tài khoản lao động tự do của bạn.');
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi hồ sơ xác minh lao động tự do. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Handle student card image upload
  function handleStudentImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh quá lớn (tối đa 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setStudentCardPhoto(uploadEvent.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  // Handle employer document image upload
  function handleEmployerImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh quá lớn (tối đa 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setStorePhoto(uploadEvent.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  // Submit student verification
  async function handleSubmitStudent(e) {
    e.preventDefault();
    if (!studentCode.trim()) {
      setError('Vui lòng nhập mã số sinh viên.');
      return;
    }
    if (!studentCardPhoto) {
      setError('Vui lòng tải lên ảnh chụp thẻ sinh viên của bạn để xác minh.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedUni = (university || uniSearch || 'Đại học FPT Hòa Lạc').trim();
      const res = await submitStudentVerification({
        studentCardPhoto,
        university: selectedUni,
        studentCode: studentCode.trim().toUpperCase(),
        major: major.trim(),
        transport,
      });

      updateUser(res.user);
      setExistingStudentVerification(res.profile);
      setEditingStudent(false);
      setSuccess('Hồ sơ thẻ sinh viên đã được gửi thành công! Ban Quản Trị sẽ xét duyệt để kích hoạt tài khoản của bạn.');
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi hồ sơ xác minh sinh viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Submit employer verification
  async function handleSubmitEmployer(e) {
    e.preventDefault();
    if (!storeName.trim()) {
      setError('Vui lòng nhập tên cửa hàng / cơ sở.');
      return;
    }
    if (!legalName.trim()) {
      setError('Vui lòng nhập họ tên người đại diện / chủ quán.');
      return;
    }
    if (!businessAddress.trim()) {
      setError('Vui lòng nhập địa chỉ kinh doanh tại Hòa Lạc.');
      return;
    }
    if (!contactPhone.trim()) {
      setError('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const documents = storePhoto
        ? [{ name: 'Ảnh biển hiệu / Cửa hàng', url: storePhoto, type: 'store_photo' }]
        : [];

      const res = await submitEmployerVerification({
        storeName: storeName.trim(),
        storeType,
        legalName: legalName.trim(),
        businessAddress: businessAddress.trim(),
        contactPhone: contactPhone.trim(),
        idCardNumber: idCardNumber.trim(),
        taxCode: taxCode.trim(),
        description: description.trim(),
        documents,
      });

      setExistingVerification(res.verification);
      updateUser({ role: 'employer', status: 'pending', phone: contactPhone.trim() });
      if (contactPhone.trim() && !user?.phone) {
        updateUserProfile({ phone: contactPhone.trim() }).catch(() => {});
      }
      setSuccess('Hồ sơ đã được gửi thành công! Ban Quản Trị sẽ xét duyệt trong vòng 24 giờ.');
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi hồ sơ xác minh. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-cream to-pink-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-green-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Chờ xác minh
              </span>
              <span className="text-xs text-text-muted">ID: {user?.id?.slice(-6) || '---'}</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main">
              Xin chào, <span className="text-green-dark">{user?.name}</span>!
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Vui lòng chọn loại tài khoản để hoàn tất bước xác minh và kích hoạt tài khoản của bạn.
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-text-muted hover:text-red-600 hover:border-red-200 text-xs font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex items-center gap-2.5 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 rounded-2xl border border-green-200 text-xs text-green-800 font-medium flex items-center gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-main" />
            <span>{success}</span>
          </div>
        )}

        {/* Selection Cards / Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Student Tab Card */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setError('');
            }}
            className={clsx(
              'p-4 sm:p-5 rounded-3xl border-2 text-left transition-all duration-200 relative overflow-hidden',
              activeTab === 'student'
                ? 'bg-white border-green-main shadow-md ring-2 ring-green-100'
                : 'bg-white/80 border-gray-200 hover:border-green-200 hover:bg-white'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center text-xl font-bold mb-3">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                existingStudentVerification?.verificationStatus === 'pending' || existingStudentVerification?.status === 'pending'
                  ? "bg-amber-100 text-amber-800"
                  : existingStudentVerification?.verificationStatus === 'approved' || existingStudentVerification?.verified
                  ? "bg-green-100 text-green-800"
                  : existingStudentVerification?.verificationStatus === 'rejected'
                  ? "bg-red-100 text-red-800"
                  : "bg-green-50 text-green-700"
              )}>
                {existingStudentVerification?.verificationStatus === 'pending' || existingStudentVerification?.status === 'pending'
                  ? '⏳ Chờ duyệt'
                  : existingStudentVerification?.verificationStatus === 'approved' || existingStudentVerification?.verified
                  ? '✓ Đã duyệt'
                  : existingStudentVerification?.verificationStatus === 'rejected'
                  ? '✕ Bị từ chối'
                  : 'Duyệt thẻ SV'}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-text-main">Tôi là Sinh viên</h3>
            <p className="text-[11px] sm:text-xs text-text-muted mt-1 leading-relaxed">
              Tải thẻ sinh viên hoặc học viên để kích hoạt tài khoản sinh viên Hòa Lạc.
            </p>
          </button>

          {/* Worker Tab Card */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('worker');
              setError('');
            }}
            className={clsx(
              'p-4 sm:p-5 rounded-3xl border-2 text-left transition-all duration-200 relative overflow-hidden',
              activeTab === 'worker'
                ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-100'
                : 'bg-white/80 border-gray-200 hover:border-blue-200 hover:bg-white'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold mb-3">
                <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                existingWorkerVerification?.verificationStatus === 'pending' || existingWorkerVerification?.status === 'pending'
                  ? "bg-amber-100 text-amber-800"
                  : existingWorkerVerification?.verificationStatus === 'approved' || existingWorkerVerification?.verified
                  ? "bg-blue-100 text-blue-800"
                  : existingWorkerVerification?.verificationStatus === 'rejected'
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-50 text-blue-700"
              )}>
                {existingWorkerVerification?.verificationStatus === 'pending' || existingWorkerVerification?.status === 'pending'
                  ? '⏳ Chờ duyệt'
                  : existingWorkerVerification?.verificationStatus === 'approved' || existingWorkerVerification?.verified
                  ? '✓ Đã duyệt'
                  : existingWorkerVerification?.verificationStatus === 'rejected'
                  ? '✕ Bị từ chối'
                  : 'Duyệt CCCD'}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-text-main">Tôi là Lao động tự do</h3>
            <p className="text-[11px] sm:text-xs text-text-muted mt-1 leading-relaxed">
              Xác minh bằng CCCD để nhận ca làm part-time và chợ việc vặt sinh viên.
            </p>
          </button>

          {/* Employer Tab Card */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('employer');
              setError('');
            }}
            className={clsx(
              'p-4 sm:p-5 rounded-3xl border-2 text-left transition-all duration-200 relative overflow-hidden',
              activeTab === 'employer'
                ? 'bg-white border-purple-600 shadow-md ring-2 ring-purple-100'
                : 'bg-white/80 border-gray-200 hover:border-purple-200 hover:bg-white'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-bold mb-3">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                existingVerification?.status === 'pending'
                  ? "bg-amber-100 text-amber-800"
                  : existingVerification?.status === 'approved'
                  ? "bg-purple-100 text-purple-800"
                  : existingVerification?.status === 'rejected'
                  ? "bg-red-100 text-red-800"
                  : "bg-purple-50 text-purple-700"
              )}>
                {existingVerification?.status === 'pending'
                  ? '⏳ Chờ duyệt'
                  : existingVerification?.status === 'approved'
                  ? '✓ Đã duyệt'
                  : existingVerification?.status === 'rejected'
                  ? '✕ Bị từ chối'
                  : 'Duyệt quán'}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-text-main">Tôi là Nhà tuyển dụng</h3>
            <p className="text-[11px] sm:text-xs text-text-muted mt-1 leading-relaxed">
              Đăng ký đối tác cửa hàng tại Hòa Lạc để đăng tin tuyển dụng ca part-time.
            </p>
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-green-100">
          {activeTab === 'student' ? (
            existingStudentVerification && (existingStudentVerification.verificationStatus === 'pending' || existingStudentVerification.status === 'pending') && !editingStudent ? (
              /* Already submitted and pending */
              <div className="space-y-6 text-center py-6 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-text-main">
                    Hồ sơ thẻ sinh viên đang chờ Admin duyệt
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Thông tin và ảnh chụp thẻ sinh viên của bạn đã được gửi tới Ban Quản Trị Hoa Lạc Việc. Chúng tôi sẽ phê duyệt tài khoản của bạn sớm nhất.
                  </p>
                </div>

                {/* Summary Box */}
                <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Họ và tên:</span>
                    <span className="font-semibold text-text-main">{user?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Email:</span>
                    <span className="font-semibold text-text-main">{user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Mã số sinh viên:</span>
                    <span className="font-semibold text-text-main">{existingStudentVerification.studentCode || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Trường ĐH / CĐ:</span>
                    <span className="font-semibold text-text-main">{existingStudentVerification.university || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Chuyên ngành:</span>
                    <span className="font-semibold text-text-main">{existingStudentVerification.major || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Trạng thái:</span>
                    <span className="font-bold text-amber-700">⏳ Đang chờ Admin duyệt</span>
                  </div>

                  {existingStudentVerification.studentCardPhoto && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-[11px] text-text-muted mb-1.5 font-medium">Ảnh thẻ sinh viên đã nộp:</p>
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                        <img
                          src={existingStudentVerification.studentCardPhoto}
                          alt="Thẻ sinh viên"
                          className="w-full h-44 object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Kiểm tra lại
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingStudent(true)}
                    className="text-xs text-green-dark"
                  >
                    Thay đổi thông tin / Nộp lại thẻ
                  </Button>
                </div>
              </div>
            ) : existingStudentVerification && (existingStudentVerification.verificationStatus === 'approved' || existingStudentVerification.verified) ? (
              /* Already approved */
              <div className="text-center py-8 space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-green-100 text-green-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-green-dark">Thẻ sinh viên đã được phê duyệt!</h3>
                <p className="text-xs text-text-muted">
                  Tài khoản sinh viên của bạn đã được kích hoạt thành công.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/student')}
                >
                  Vào trang Việc làm Sinh viên <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ) : (
              /* Student Verification Form */
              <form onSubmit={handleSubmitStudent} className="space-y-5">
                <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-main" />
                      Xác minh thông tin sinh viên
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Sau khi gửi thẻ, Ban Quản Trị sẽ xác thực và kích hoạt tài khoản sinh viên cho bạn.
                    </p>
                  </div>
                  {editingStudent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingStudent(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Hủy cập nhật
                    </Button>
                  )}
                </div>

                {existingStudentVerification?.verificationStatus === 'rejected' && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      Hồ sơ thẻ sinh viên trước đây bị từ chối:
                    </p>
                    <p className="pl-5.5">
                      {existingStudentVerification.rejectionReason || 'Ảnh thẻ mờ hoặc thông tin không trùng khớp. Vui lòng chụp rõ nét thẻ sinh viên và cập nhật lại.'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Searchable University Combobox */}
                  <div className="relative" ref={uniDropdownRef}>
                    <label className="block text-xs font-bold text-text-main mb-1.5">
                      Trường Đại học / Cao đẳng <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={uniSearch}
                        onChange={(e) => {
                          setUniSearch(e.target.value);
                          setUniversity(e.target.value);
                          setIsUniDropdownOpen(true);
                        }}
                        onFocus={() => setIsUniDropdownOpen(true)}
                        placeholder="Gõ hoặc bấm để chọn trường..."
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all placeholder-gray-400 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setIsUniDropdownOpen(!isUniDropdownOpen)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        aria-label="Toggle university list"
                      >
                        <ChevronDown
                          className={clsx(
                            'w-4 h-4 transition-transform duration-200',
                            isUniDropdownOpen && 'rotate-180'
                          )}
                        />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {isUniDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-modal border border-green-100 py-1.5 z-50 max-h-60 overflow-y-auto animate-scale-in">
                        {loadingUnis ? (
                          <div className="p-3 text-center text-xs text-text-muted">
                            ⏳ Đang tải danh sách trường từ hệ thống...
                          </div>
                        ) : filteredUniversities.length > 0 ? (
                          <>
                            <div className="px-3 py-1 text-[11px] font-semibold text-text-muted bg-gray-50 uppercase tracking-wider flex justify-between">
                              <span>Gợi ý ({filteredUniversities.length})</span>
                              <span className="text-[10px] text-green-700">Bấm để chọn</span>
                            </div>
                            {filteredUniversities.map((u, idx) => {
                              const isSelected =
                                (university || '').toLowerCase() === (u.name || '').toLowerCase();
                              return (
                                <button
                                  key={`${u.name}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setUniversity(u.name);
                                    setUniSearch(u.name);
                                    setIsUniDropdownOpen(false);
                                  }}
                                  className={clsx(
                                    'w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between hover:bg-green-50/70 border-b border-gray-50 last:border-0',
                                    isSelected
                                      ? 'bg-green-50 text-green-dark font-bold'
                                      : 'text-text-main'
                                  )}
                                >
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    {isSelected && <Check className="w-3.5 h-3.5 text-green-main flex-shrink-0" />}
                                    <span className="truncate">{u.name}</span>
                                  </div>
                                  {u.domain && (
                                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                                      {u.domain}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </>
                        ) : (
                          <div className="p-3 text-xs text-text-muted text-center space-y-1.5">
                            <p>Không có kết quả trong danh mục khớp với "{uniSearch}".</p>
                            <button
                              type="button"
                              onClick={() => {
                                setUniversity(uniSearch.trim());
                                setIsUniDropdownOpen(false);
                              }}
                              className="px-3 py-1 bg-green-50 text-green-dark text-xs font-semibold rounded-xl hover:bg-green-100 transition-colors inline-block"
                            >
                              ✓ Sử dụng tên trường này: "{uniSearch}"
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Input
                    id="stu-code"
                    label="Mã số sinh viên"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="Ví dụ: HE180123"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="stu-major"
                    label="Chuyên ngành học"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Kỹ thuật phần mềm, Quản trị..."
                  />

                  <Select
                    id="stu-transport"
                    label="Phương tiện di chuyển chính"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    options={[
                      { value: 'xe_may', label: 'Xe máy' },
                      { value: 'di_bo', label: 'Đi bộ' },
                      { value: 'xe_buyt', label: 'Xe buýt' },
                      { value: 'xe_dap', label: 'Xe đạp' },
                      { value: 'xe_dap_dien', label: 'Xe đạp điện' },
                      { value: 'o_to', label: 'Ô tô' },
                    ]}
                  />
                </div>

                {/* Student Card Photo Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-text-main">
                    Ảnh chụp Thẻ sinh viên (Mặt trước) <span className="text-red-500">*</span>
                  </label>

                  {studentCardPhoto ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-green-50/40 p-3 max-w-sm">
                      <img
                        src={studentCardPhoto}
                        alt="Thẻ sinh viên"
                        className="w-full h-44 object-cover rounded-xl shadow-sm"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Đã chọn ảnh
                        </span>
                        <button
                          type="button"
                          onClick={() => setStudentCardPhoto('')}
                          className="text-xs text-red-600 hover:underline font-medium"
                        >
                          Đổi ảnh khác
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-green-400 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-green-50/30 transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-text-muted group-hover:text-green-dark group-hover:scale-105 transition-all mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-text-main">Bấm để tải ảnh hoặc chụp thẻ sinh viên</p>
                      <p className="text-[11px] text-text-muted mt-1">Hỗ trợ định dạng JPG, PNG (tối đa 5MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStudentImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    className="w-full sm:w-auto px-8 shadow-sm"
                  >
                    Gửi hồ sơ thẻ SV đợi xét duyệt <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </form>
            )
          ) : activeTab === 'worker' ? (
            /* Worker Verification Section */
            <div>
              {existingWorkerVerification && (existingWorkerVerification.verificationStatus === 'pending' || existingWorkerVerification.status === 'pending') && !editingWorker ? (
                /* Already submitted and pending */
                <div className="space-y-6 text-center py-6 animate-fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="text-xl font-bold text-text-main">
                      Hồ sơ Căn cước công dân đang chờ Admin duyệt
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Thông tin và ảnh chụp Căn cước công dân (CCCD) của bạn đã được gửi tới Ban Quản Trị Hoa Lạc Việc. Chúng tôi sẽ phê duyệt tài khoản lao động tự do của bạn trong thời gian sớm nhất.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 text-xs space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Họ và tên:</span>
                      <span className="font-semibold text-text-main">{workerFullName || user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Số điện thoại:</span>
                      <span className="font-semibold text-text-main">{workerPhone || user?.phone || '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Email:</span>
                      <span className="font-semibold text-text-main">{user?.email || '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Số CCCD:</span>
                      <span className="font-semibold text-text-main">{existingWorkerVerification.idCardNumber || workerIdCardNumber || '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Nghề nghiệp / Lĩnh vực:</span>
                      <span className="font-semibold text-text-main">{existingWorkerVerification.profession || workerProfession || 'Lao động tự do'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Trạng thái:</span>
                      <span className="font-bold text-blue-700">⏳ Đang chờ Admin duyệt</span>
                    </div>

                    {/* CCCD Photos */}
                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <p className="text-[11px] text-text-muted font-medium">Ảnh Căn cước công dân đã nộp:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {existingWorkerVerification.idCardFrontPhoto && (
                          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <p className="text-[10px] text-gray-500 font-semibold px-2 py-1 bg-gray-50 border-b border-gray-100">Mặt trước</p>
                            <img
                              src={existingWorkerVerification.idCardFrontPhoto}
                              alt="CCCD Mặt trước"
                              className="w-full h-32 object-cover"
                            />
                          </div>
                        )}
                        {existingWorkerVerification.idCardBackPhoto && (
                          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <p className="text-[10px] text-gray-500 font-semibold px-2 py-1 bg-gray-50 border-b border-gray-100">Mặt sau</p>
                            <img
                              src={existingWorkerVerification.idCardBackPhoto}
                              alt="CCCD Mặt sau"
                              className="w-full h-32 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Kiểm tra lại
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingWorker(true)}
                      className="text-xs text-blue-600"
                    >
                      Thay đổi thông tin / Nộp lại CCCD
                    </Button>
                  </div>
                </div>
              ) : existingWorkerVerification && (existingWorkerVerification.verificationStatus === 'approved' || existingWorkerVerification.verified) ? (
                /* Already approved */
                <div className="text-center py-8 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-blue-700">Căn cước công dân đã được phê duyệt!</h3>
                  <p className="text-xs text-text-muted">
                    Tài khoản người lao động tự do của bạn đã được kích hoạt thành công.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/student')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Vào trang Tìm việc & Nhận nhiệm vụ <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                /* Worker Verification Form */
                <form onSubmit={handleSubmitWorker} className="space-y-5">
                  <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        Xác minh Căn cước công dân (Lao động tự do)
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        Dành cho người lao động, thợ sửa chữa, shipper... nhận việc làm theo ca và nhận chợ việc vặt.
                      </p>
                    </div>
                    {editingWorker && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingWorker(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Hủy cập nhật
                      </Button>
                    )}
                  </div>

                  {existingWorkerVerification?.verificationStatus === 'rejected' && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        Hồ sơ CCCD trước đây bị từ chối:
                      </p>
                      <p className="pl-5.5">
                        {existingWorkerVerification.rejectionReason || 'Ảnh chụp CCCD bị mờ, lóa sáng hoặc số CCCD không hợp lệ. Vui lòng chụp rõ nét và cập nhật lại.'}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="wrk-name"
                      label="Họ và tên theo CCCD"
                      value={workerFullName}
                      onChange={(e) => setWorkerFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                    />

                    <Input
                      id="wrk-phone"
                      label="Số điện thoại liên hệ"
                      type="tel"
                      value={workerPhone}
                      onChange={(e) => setWorkerPhone(e.target.value)}
                      placeholder="0981234567"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="wrk-idcard"
                      label="Số Căn cước công dân (CCCD)"
                      value={workerIdCardNumber}
                      onChange={(e) => setWorkerIdCardNumber(e.target.value)}
                      placeholder="12 chữ số trên thẻ CCCD"
                      required
                    />

                    <Select
                      id="wrk-profession"
                      label="Lĩnh vực / Nghề nghiệp mong muốn"
                      value={workerProfession}
                      onChange={(e) => setWorkerProfession(e.target.value)}
                      options={WORKER_PROFESSIONS}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      id="wrk-transport"
                      label="Phương tiện di chuyển chính"
                      value={workerTransport}
                      onChange={(e) => setWorkerTransport(e.target.value)}
                      options={[
                        { value: 'xe_may', label: 'Xe máy' },
                        { value: 'di_bo', label: 'Đi bộ' },
                        { value: 'xe_buyt', label: 'Xe buýt' },
                        { value: 'xe_dap', label: 'Xe đạp' },
                        { value: 'xe_dap_dien', label: 'Xe đạp điện' },
                        { value: 'o_to', label: 'Ô tô' },
                      ]}
                    />

                    <Input
                      id="wrk-bio"
                      label="Kinh nghiệm / Giới thiệu bản thân ngắn gọn"
                      value={workerBio}
                      onChange={(e) => setWorkerBio(e.target.value)}
                      placeholder="Đã có kinh nghiệm phục vụ / giao hàng, sẵn sàng làm ca tối..."
                    />
                  </div>

                  {/* 2 CCCD Photo Uploads: Front and Back */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Front Photo */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-text-main">
                        Ảnh chụp CCCD (Mặt trước) <span className="text-red-500">*</span>
                      </label>
                      {workerIdCardFront ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-blue-50/40 p-3">
                          <img
                            src={workerIdCardFront}
                            alt="CCCD Mặt trước"
                            className="w-full h-40 object-cover rounded-xl shadow-sm"
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Đã chọn ảnh mặt trước
                            </span>
                            <button
                              type="button"
                              onClick={() => setWorkerIdCardFront('')}
                              className="text-xs text-red-600 hover:underline font-medium"
                            >
                              Đổi ảnh
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-blue-50/30 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-text-muted group-hover:text-blue-600 group-hover:scale-105 transition-all mb-2">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-semibold text-text-main">Tải ảnh CCCD (Mặt trước)</p>
                          <p className="text-[11px] text-text-muted mt-1">Chụp rõ họ tên và số CCCD</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleWorkerFrontUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Back Photo */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-text-main">
                        Ảnh chụp CCCD (Mặt sau) <span className="text-xs text-text-muted font-normal">(Tùy chọn)</span>
                      </label>
                      {workerIdCardBack ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-blue-50/40 p-3">
                          <img
                            src={workerIdCardBack}
                            alt="CCCD Mặt sau"
                            className="w-full h-40 object-cover rounded-xl shadow-sm"
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Đã chọn ảnh mặt sau
                            </span>
                            <button
                              type="button"
                              onClick={() => setWorkerIdCardBack('')}
                              className="text-xs text-red-600 hover:underline font-medium"
                            >
                              Đổi ảnh
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-blue-50/30 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-text-muted group-hover:text-blue-600 group-hover:scale-105 transition-all mb-2">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-semibold text-text-main">Tải ảnh CCCD (Mặt sau)</p>
                          <p className="text-[11px] text-text-muted mt-1">Chụp rõ phần chip và đặc điểm</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleWorkerBackUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={loading}
                      className="w-full sm:w-auto px-8 shadow-sm bg-blue-600 hover:bg-blue-700"
                    >
                      Gửi hồ sơ CCCD đợi xét duyệt <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Employer Verification Section */
            <div>
              {existingVerification && existingVerification.status === 'pending' ? (
                /* Already submitted and pending */
                <div className="space-y-6 text-center py-6 animate-fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="text-xl font-bold text-text-main">
                      Hồ sơ của bạn đang chờ Admin duyệt
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Thông tin cơ sở <strong>"{existingVerification.storeName}"</strong> đã được chuyển tới Ban Quản Trị Hoa Lạc Việc. Chúng tôi thường phê duyệt hồ sơ trong vòng 24h làm việc.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Cơ sở:</span>
                      <span className="font-semibold text-text-main">{existingVerification.storeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Người đại diện:</span>
                      <span className="font-semibold text-text-main">{existingVerification.legalName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Địa chỉ:</span>
                      <span className="font-semibold text-text-main">{existingVerification.businessAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Số điện thoại:</span>
                      <span className="font-semibold text-text-main">{existingVerification.contactPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Trạng thái:</span>
                      <span className="font-bold text-amber-700">⏳ Đang chờ duyệt</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Kiểm tra lại
                    </Button>
                    <a
                      href="https://zalo.me"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost btn btn-sm text-xs text-green-dark"
                    >
                      Liên hệ hỗ trợ nhanh
                    </a>
                  </div>
                </div>
              ) : existingVerification && existingVerification.status === 'approved' ? (
                /* Already approved */
                <div className="text-center py-8 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-green-100 text-green-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-green-dark">Hồ sơ của bạn đã được phê duyệt!</h3>
                  <p className="text-xs text-text-muted">
                    Chào mừng bạn đến với mạng lưới đối tác nhà tuyển dụng của Hoa Lạc Việc.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/employer')}
                  >
                    Vào trang Quản lý Tuyển dụng <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                /* New or Re-submission Employer Form */
                <form onSubmit={handleSubmitEmployer} className="space-y-5">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      Đăng ký hồ sơ Cửa hàng / Cơ sở kinh doanh
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Sau khi gửi hồ sơ, Ban Quản Trị sẽ xác thực và kích hoạt tài khoản tuyển dụng cho bạn.
                    </p>
                  </div>

                  {existingVerification?.status === 'rejected' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700">
                      <strong>Hồ sơ trước đây chưa được duyệt:</strong> {existingVerification.rejectionReason || 'Vui lòng bổ sung giấy tờ và thông tin chính xác.'}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="emp-store-name"
                      label="Tên cửa hàng / Cơ sở tuyển dụng"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ví dụ: Cà phê Highland FPT, Tiệm bánh X..."
                      required
                    />

                    <Select
                      id="emp-store-type"
                      label="Loại hình kinh doanh"
                      value={storeType}
                      onChange={(e) => setStoreType(e.target.value)}
                      options={STORE_TYPES}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="emp-legal-name"
                      label="Họ và tên Người đại diện / Quản lý"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                    />

                    <Input
                      id="emp-phone"
                      label="Số điện thoại liên hệ"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="0981234567"
                      required
                    />
                  </div>

                  <Input
                    id="emp-address"
                    label="Địa chỉ cơ sở tại Hòa Lạc"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Thôn 3 Tân Xã, Cổng số 1 ĐH FPT Hòa Lạc..."
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="emp-tax"
                      label="Mã số thuế doanh nghiệp / hộ KD (nếu có)"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      placeholder="Để trống nếu chưa có"
                    />

                    <Input
                      id="emp-idcard"
                      label="Số CCCD / CMND người đại diện"
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value)}
                      placeholder="12 chữ số CCCD"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1.5">
                      Giới thiệu ngắn về cửa hàng / nhu cầu tuyển dụng
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Cửa hàng chuyên phục vụ đồ uống cho sinh viên, cần tuyển nhân viên part-time ca sáng/tối..."
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-400"
                    />
                  </div>

                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-main">
                      Ảnh chụp Biển hiệu cửa hàng hoặc Giấy tờ kinh doanh
                    </label>
                    {storePhoto ? (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-purple-200 bg-purple-50/40 p-3 max-w-sm">
                        <img
                          src={storePhoto}
                          alt="Ảnh cửa hàng"
                          className="w-full h-44 object-cover rounded-xl shadow-sm"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Đã chọn ảnh
                          </span>
                          <button
                            type="button"
                            onClick={() => setStorePhoto('')}
                            className="text-xs text-red-600 hover:underline font-medium"
                          >
                            Đổi ảnh khác
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-purple-50/30 transition-all group">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-text-muted group-hover:text-purple-600 group-hover:scale-105 transition-all mb-2">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-semibold text-text-main">Tải lên ảnh chụp biển hiệu cửa hàng</p>
                        <p className="text-[11px] text-text-muted mt-1">Hỗ trợ JPG, PNG (tối đa 5MB)</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEmployerImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={loading}
                      className="w-full sm:w-auto px-8 shadow-sm bg-purple-600 hover:bg-purple-700"
                    >
                      Gửi hồ sơ đợi xét duyệt <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
