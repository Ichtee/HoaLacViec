import { CheckCircle2, Clock, AlertCircle, RefreshCw, ShieldCheck, ArrowRight, Search, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Input, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';

export default function StudentVerificationPanel({
  loading,
  existingStudentVerification,
  editingStudent,
  setEditingStudent,
  university,
  setUniversity,
  uniSearch,
  setUniSearch,
  isUniDropdownOpen,
  setIsUniDropdownOpen,
  loadingUnis,
  studentCode,
  setStudentCode,
  major,
  setMajor,
  transport,
  setTransport,
  uniDropdownRef,
  filteredUniversities,
  handleSubmitStudent,
  user,
}) {
  return (
            existingStudentVerification && (existingStudentVerification.verificationStatus === 'pending' || existingStudentVerification.status === 'pending') && !editingStudent ? (
              /* Already submitted and pending */
              <div className="space-y-6 text-center py-6 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-text-main">
                    Hồ sơ sinh viên đang chờ Admin duyệt
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Thông tin sinh viên của bạn đã được gửi tới Ban Quản Trị Hoa Lạc Việc. Chúng tôi sẽ phê duyệt tài khoản của bạn sớm nhất.
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
                    Thay đổi thông tin sinh viên
                  </Button>
                </div>
              </div>
            ) : existingStudentVerification && (existingStudentVerification.verificationStatus === 'approved' || existingStudentVerification.verified) ? (
              /* Already approved */
              <div className="text-center py-8 space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-green-100 text-green-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-green-dark">Tài khoản sinh viên đã được phê duyệt!</h3>
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
                      Sau khi gửi thông tin, Ban Quản Trị sẽ xác thực và kích hoạt tài khoản sinh viên cho bạn.
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
                      <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
                      Hồ sơ sinh viên trước đây bị từ chối:
                    </p>
                    <p className="pl-5.5">
                      {existingStudentVerification.rejectionReason || 'Thông tin mã số sinh viên không trùng khớp hoặc không hợp lệ. Vui lòng cập nhật lại.'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Searchable University Combobox */}
                  <div className="relative" ref={uniDropdownRef}>
                    <label className="block text-xs font-bold text-text-main mb-1.5">
                      Trường Đại học / Cao đẳng <span className="text-red-700">*</span>
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 p-1"
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
                                    <span className="text-[10px] text-gray-500 font-mono flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
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

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    className="w-full sm:w-auto px-8 shadow-sm"
                  >
                    Gửi thông tin xác minh SV <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </form>
            )
  );
}
