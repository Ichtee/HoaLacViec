import { Briefcase, CheckCircle2, Clock, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Input, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';
import { WORKER_PROFESSIONS } from './constants.js';

export default function WorkerVerificationPanel({
  loading,
  existingWorkerVerification,
  editingWorker,
  setEditingWorker,
  workerIdCardNumber,
  setWorkerIdCardNumber,
  workerProfession,
  setWorkerProfession,
  workerTransport,
  setWorkerTransport,
  workerBio,
  setWorkerBio,
  handleSubmitWorker,
  user,
}) {
  return (
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
                      Thông tin Căn cước công dân (CCCD) của bạn đã được gửi tới Ban Quản Trị Hoa Lạc Việc. Chúng tôi sẽ phê duyệt tài khoản lao động tự do của bạn trong thời gian sớm nhất.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 text-xs space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Họ và tên:</span>
                      <span className="font-semibold text-text-main">{user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Số điện thoại:</span>
                      <span className="font-semibold text-text-main">{user?.phone || '---'}</span>
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
                      Thay đổi thông tin xác minh
                    </Button>
                  </div>
                </div>
              ) : existingWorkerVerification && (existingWorkerVerification.verificationStatus === 'approved' || existingWorkerVerification.verified) ? (
                /* Already approved */
                <div className="text-center py-8 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-blue-700">Tài khoản lao động tự do đã được phê duyệt!</h3>
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
                        Xác minh thông tin (Lao động tự do)
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
                        Hồ sơ xác minh trước đây bị từ chối:
                      </p>
                      <p className="pl-5.5">
                        {existingWorkerVerification.rejectionReason || 'Số CCCD hoặc thông tin không trùng khớp. Vui lòng kiểm tra và cập nhật lại.'}
                      </p>
                    </div>
                  )}


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

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={loading}
                      className="w-full sm:w-auto px-8 shadow-sm bg-blue-600 hover:bg-blue-700"
                    >
                      Gửi thông tin xác minh <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              )}
            </div>
  );
}
