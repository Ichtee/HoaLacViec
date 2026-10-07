import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  Lock,
} from 'lucide-react';
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
import { getRoleLabel } from './verify/constants.js';
import RoleTabCard from './verify/RoleTabCard.jsx';
import StudentVerificationPanel from './verify/StudentVerificationPanel.jsx';
import WorkerVerificationPanel from './verify/WorkerVerificationPanel.jsx';
import EmployerVerificationPanel from './verify/EmployerVerificationPanel.jsx';

// Nhãn trạng thái trên thẻ vai trò. Class viết sẵn để Tailwind nhận diện được.
const BADGE_TONES = {
  green: { approved: 'bg-green-100 text-green-800', idle: 'bg-green-50 text-green-700' },
  blue: { approved: 'bg-blue-100 text-blue-800', idle: 'bg-blue-50 text-blue-700' },
  purple: { approved: 'bg-purple-100 text-purple-800', idle: 'bg-purple-50 text-purple-700' },
};

function statusBadge(tone, idleLabel, { pending, approved, rejected }) {
  if (pending) return { className: 'bg-amber-100 text-amber-800', label: '⏳ Chờ duyệt' };
  if (approved) return { className: BADGE_TONES[tone].approved, label: '✓ Đã duyệt' };
  if (rejected) return { className: 'bg-red-100 text-red-800', label: '✕ Bị từ chối' };
  return { className: BADGE_TONES[tone].idle, label: idleLabel };
}

export default function VerifyAccountPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'employer'
  const [loading, setLoading] = useState(false);
  const [, setFetchingStatus] = useState(true);
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
  const [workerIdCardNumber, setWorkerIdCardNumber] = useState('');
  const [workerProfession, setWorkerProfession] = useState('Giao hàng / Shipper');
  const [workerTransport, setWorkerTransport] = useState('xe_may');
  const [workerBio, setWorkerBio] = useState('');

  // Employer verification form & state
  const [existingVerification, setExistingVerification] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('Quán cà phê');
  const [legalName, setLegalName] = useState(user?.name || '');
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [description, setDescription] = useState('');
  const [storePhoto, setStorePhoto] = useState('');

  // Auto-fill phone and name if user object updates
  useEffect(() => {
    if (user?.phone) {
      if (!contactPhone) setContactPhone(user.phone);
    }
    if (user?.name) {
      if (!legalName) setLegalName(user.name);
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
          if (['pending', 'approved'].includes(empData.status) || empData.verified) {
            hasEmployer = true;
          }
          if (empData.storeName) setStoreName(empData.storeName);
          if (empData.legalName) setLegalName(empData.legalName);
          if (empData.businessAddress) setBusinessAddress(empData.businessAddress);
          if (empData.contactPhone) setContactPhone(empData.contactPhone);
          if (empData.idCardNumber) setIdCardNumber(empData.idCardNumber);
          if (empData.documents?.[0]?.url) setStorePhoto(empData.documents[0].url);
        }

        if (stuRes.status === 'fulfilled' && stuRes.value) {
          const stuData = stuRes.value;
          const status = stuData.verificationStatus || stuData.status;
          if (status && status !== 'draft') {
            setExistingStudentVerification(stuData);
            if (['pending', 'approved'].includes(status) || stuData.verified) {
              hasStudent = true;
            }
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
          if (status && status !== 'draft') {
            setExistingWorkerVerification(wrkData);
            if (['pending', 'approved'].includes(status) || wrkData.verified) {
              hasWorker = true;
            }
            if (wrkData.idCardNumber) setWorkerIdCardNumber(wrkData.idCardNumber);
            if (wrkData.profession) setWorkerProfession(wrkData.profession);
            if (wrkData.transport) setWorkerTransport(wrkData.transport);
          }
        }

        // Auto select tab based on existing submission or user role
        if (hasWorker && !hasStudent && !hasEmployer) {
          setActiveTab('worker');
        } else if (hasEmployer && !hasStudent && !hasWorker) {
          setActiveTab('employer');
        } else if (hasStudent) {
          setActiveTab('student');
        } else if (user?.role === 'worker' || user?.role === 'freelancer') {
          setActiveTab('worker');
        } else if (user?.role === 'employer') {
          setActiveTab('employer');
        } else {
          setActiveTab('student');
        }
      } catch {
        // No record yet
      } finally {
        setFetchingStatus(false);
      }
    }
    checkVerification();
  }, []);

  // Compute if any role has already been submitted (pending or approved)
  const isStudentSubmitted = Boolean(
    existingStudentVerification && (
      ['pending', 'approved'].includes(existingStudentVerification.verificationStatus) ||
      ['pending', 'approved'].includes(existingStudentVerification.status) ||
      existingStudentVerification.verified
    )
  );

  const isWorkerSubmitted = Boolean(
    existingWorkerVerification && (
      ['pending', 'approved'].includes(existingWorkerVerification.verificationStatus) ||
      ['pending', 'approved'].includes(existingWorkerVerification.status) ||
      existingWorkerVerification.verified
    )
  );

  const isEmployerSubmitted = Boolean(
    existingVerification && (
      ['pending', 'approved'].includes(existingVerification.status) ||
      existingVerification.verified
    )
  );

  // If one role is submitted, only that role is allowed and others are locked
  const lockedRole = isStudentSubmitted
    ? 'student'
    : isWorkerSubmitted
    ? 'worker'
    : isEmployerSubmitted
    ? 'employer'
    : (user?.role === 'student' && isStudentSubmitted)
    ? 'student'
    : (user?.role === 'worker' && isWorkerSubmitted)
    ? 'worker'
    : (user?.role === 'employer' && isEmployerSubmitted)
    ? 'employer'
    : null;

  // Keep activeTab locked to submitted role so user cannot navigate to others
  useEffect(() => {
    if (lockedRole && activeTab !== lockedRole) {
      setActiveTab(lockedRole);
    }
  }, [lockedRole]);

  // Submit worker verification
  async function handleSubmitWorker(e) {
    e.preventDefault();
    if (lockedRole && lockedRole !== 'worker') {
      setError(`Bạn đã nộp hồ sơ xác minh cho vai trò ${getRoleLabel(lockedRole)}. Không thể nộp thêm vai trò Lao động tự do.`);
      return;
    }
    const cleanId = (workerIdCardNumber || '').trim().replace(/\s+/g, '');
    if (!cleanId) {
      setError('Vui lòng nhập số Căn cước công dân (CCCD).');
      return;
    }
    if (!/^[0-9]{9,12}$/.test(cleanId)) {
      setError('Số CCCD không hợp lệ (phải gồm 9 đến 12 chữ số).');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await submitWorkerVerification({
        idCardNumber: cleanId,
        idCardFrontPhoto: '',
        idCardBackPhoto: '',
        profession: workerProfession,
        transport: workerTransport,
        bio: workerBio.trim(),
        fullName: (user?.name || '').trim(),
        phone: (user?.phone || '').trim(),
      });

      updateUser(res.user);
      setExistingWorkerVerification(res.profile);
      setEditingWorker(false);
      setActiveTab('worker');
      setSuccess('Thông tin Căn cước công dân đã được gửi thành công! Ban Quản Trị sẽ xét duyệt để kích hoạt tài khoản lao động tự do của bạn.');
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi hồ sơ xác minh lao động tự do. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Submit student verification
  async function handleSubmitStudent(e) {
    e.preventDefault();
    if (lockedRole && lockedRole !== 'student') {
      setError(`Bạn đã nộp hồ sơ xác minh cho vai trò ${getRoleLabel(lockedRole)}. Không thể nộp thêm vai trò Sinh viên.`);
      return;
    }
    if (!studentCode.trim()) {
      setError('Vui lòng nhập mã số sinh viên.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedUni = (university || uniSearch || 'Đại học FPT Hòa Lạc').trim();
      const res = await submitStudentVerification({
        studentCardPhoto: studentCardPhoto || '',
        university: selectedUni,
        studentCode: studentCode.trim().toUpperCase(),
        major: major.trim(),
        transport,
      });

      updateUser(res.user);
      setExistingStudentVerification(res.profile);
      setEditingStudent(false);
      setActiveTab('student');
      setSuccess('Hồ sơ thẻ sinh viên đã được gửi thành công! Ban Quản Trị sẽ xét duyệt để kích hoạt tài khoản của bạn.');
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi hồ sơ xác minh sinh viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Handle employer store photo image upload
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

  // Submit employer verification
  async function handleSubmitEmployer(e) {
    e.preventDefault();
    if (lockedRole && lockedRole !== 'employer') {
      setError(`Bạn đã nộp hồ sơ xác minh cho vai trò ${getRoleLabel(lockedRole)}. Không thể nộp thêm vai trò Nhà tuyển dụng.`);
      return;
    }
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
        ? [{ name: 'Ảnh cửa hàng / biển hiệu', url: storePhoto, type: 'store_photo' }]
        : [];

      const res = await submitEmployerVerification({
        storeName: storeName.trim(),
        storeType,
        legalName: legalName.trim(),
        businessAddress: businessAddress.trim(),
        contactPhone: contactPhone.trim(),
        idCardNumber: idCardNumber.trim(),
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

  function selectTab(role) {
    setActiveTab(role);
    setError('');
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

        {/* Single-Role Verification Policy Banner */}
        {lockedRole ? (
          <div className="p-4 bg-blue-50/90 rounded-2xl border border-blue-200 text-xs text-blue-900 flex items-start gap-3 shadow-xs animate-fade-in">
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-blue-900">
                Hồ sơ đã gửi cho vai trò: <span className="underline font-extrabold">{getRoleLabel(lockedRole)}</span>
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Theo quy định của hệ thống Hoa Lạc Việc, mỗi tài khoản chỉ được đăng ký xác minh <strong>1 vai trò duy nhất</strong>. Hai vai trò còn lại đã được khóa tự động để bảo đảm tính nhất quán dữ liệu của bạn.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-amber-900">
                Quy định xác minh tài khoản:
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Vui lòng chọn <strong>1 trong 3 vai trò</strong> bên dưới để nhập thông tin xác minh. <strong>Lưu ý:</strong> Sau khi đã gửi hồ sơ cho một vai trò, bạn sẽ <em>không thể chọn để gửi 2 vai trò còn lại</em>.
              </p>
            </div>
          </div>
        )}

        {/* Selection Cards / Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          <RoleTabCard
            role="student"
            tone="green"
            Icon={GraduationCap}
            title="Tôi là Sinh viên"
            description="Nhập mã sinh viên và trường học để kích hoạt tài khoản sinh viên Hòa Lạc."
            badge={statusBadge('green', 'Xác minh SV', {
              pending: existingStudentVerification?.verificationStatus === 'pending' || existingStudentVerification?.status === 'pending',
              approved: existingStudentVerification?.verificationStatus === 'approved' || existingStudentVerification?.verified,
              rejected: existingStudentVerification?.verificationStatus === 'rejected',
            })}
            active={activeTab === 'student'}
            lockedRole={lockedRole}
            onSelect={selectTab}
          />
          <RoleTabCard
            role="worker"
            tone="blue"
            Icon={Briefcase}
            title="Tôi là Lao động tự do"
            description="Nhập số Căn cước công dân để nhận ca làm part-time và việc vặt."
            badge={statusBadge('blue', 'Xác minh CCCD', {
              pending: existingWorkerVerification?.verificationStatus === 'pending' || existingWorkerVerification?.status === 'pending',
              approved: existingWorkerVerification?.verificationStatus === 'approved' || existingWorkerVerification?.verified,
              rejected: existingWorkerVerification?.verificationStatus === 'rejected',
            })}
            active={activeTab === 'worker'}
            lockedRole={lockedRole}
            onSelect={selectTab}
          />
          <RoleTabCard
            role="employer"
            tone="purple"
            Icon={Building2}
            title="Tôi là Nhà tuyển dụng"
            description="Đăng ký đối tác cửa hàng tại Hòa Lạc để đăng tin tuyển dụng ca part-time."
            badge={statusBadge('purple', 'Duyệt quán', {
              pending: existingVerification?.status === 'pending',
              approved: existingVerification?.status === 'approved',
              rejected: existingVerification?.status === 'rejected',
            })}
            active={activeTab === 'employer'}
            lockedRole={lockedRole}
            onSelect={selectTab}
          />
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-green-100 min-h-[480px]">
          {activeTab === 'student' ? (
            <StudentVerificationPanel
              user={user}
              loading={loading}
              existingStudentVerification={existingStudentVerification}
              editingStudent={editingStudent}
              setEditingStudent={setEditingStudent}
              university={university}
              setUniversity={setUniversity}
              uniSearch={uniSearch}
              setUniSearch={setUniSearch}
              isUniDropdownOpen={isUniDropdownOpen}
              setIsUniDropdownOpen={setIsUniDropdownOpen}
              loadingUnis={loadingUnis}
              uniDropdownRef={uniDropdownRef}
              filteredUniversities={filteredUniversities}
              studentCode={studentCode}
              setStudentCode={setStudentCode}
              major={major}
              setMajor={setMajor}
              transport={transport}
              setTransport={setTransport}
              handleSubmitStudent={handleSubmitStudent}
            />
          ) : activeTab === 'worker' ? (
            <WorkerVerificationPanel
              user={user}
              loading={loading}
              existingWorkerVerification={existingWorkerVerification}
              editingWorker={editingWorker}
              setEditingWorker={setEditingWorker}
              workerIdCardNumber={workerIdCardNumber}
              setWorkerIdCardNumber={setWorkerIdCardNumber}
              workerProfession={workerProfession}
              setWorkerProfession={setWorkerProfession}
              workerTransport={workerTransport}
              setWorkerTransport={setWorkerTransport}
              workerBio={workerBio}
              setWorkerBio={setWorkerBio}
              handleSubmitWorker={handleSubmitWorker}
            />
          ) : (
            <EmployerVerificationPanel
              loading={loading}
              existingVerification={existingVerification}
              storeName={storeName}
              setStoreName={setStoreName}
              storeType={storeType}
              setStoreType={setStoreType}
              legalName={legalName}
              setLegalName={setLegalName}
              businessAddress={businessAddress}
              setBusinessAddress={setBusinessAddress}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
              idCardNumber={idCardNumber}
              setIdCardNumber={setIdCardNumber}
              description={description}
              setDescription={setDescription}
              storePhoto={storePhoto}
              setStorePhoto={setStorePhoto}
              handleEmployerImageUpload={handleEmployerImageUpload}
              handleSubmitEmployer={handleSubmitEmployer}
            />
          )}
        </div>
      </div>
    </div>
  );
}
