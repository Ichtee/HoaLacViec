import { Building2, Upload, CheckCircle2, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { Input, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';
import { STORE_TYPES } from './constants.js';

export default function EmployerVerificationPanel({
  loading,
  existingVerification,
  storeName,
  setStoreName,
  storeType,
  setStoreType,
  legalName,
  setLegalName,
  businessAddress,
  setBusinessAddress,
  contactPhone,
  setContactPhone,
  idCardNumber,
  setIdCardNumber,
  description,
  setDescription,
  storePhoto,
  setStorePhoto,
  handleEmployerImageUpload,
  handleSubmitEmployer,
}) {
  return (
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

                    {existingVerification.documents?.[0]?.url && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-[11px] text-text-muted mb-1.5 font-medium">Ảnh cửa hàng / biển hiệu đã gửi:</p>
                        <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                          <img
                            src={existingVerification.documents[0].url}
                            alt="Ảnh cửa hàng"
                            className="w-full h-44 object-cover"
                          />
                        </div>
                      </div>
                    )}
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
                      <Building2 className="w-5 h-5 text-green-dark" />
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


                  <Input
                    id="emp-idcard"
                    label="Số CCCD / CMND người đại diện (nếu có)"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    placeholder="12 chữ số CCCD"
                  />


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

                  {/* Store Photo Upload */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-main">
                      Ảnh chụp Biển hiệu / Cửa hàng
                    </label>
                    {storePhoto ? (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-green-50/40 p-3 max-w-sm w-full">
                        <img
                          src={storePhoto}
                          alt="Ảnh cửa hàng"
                          className="w-full aspect-video object-cover rounded-xl shadow-sm"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-green-dark font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Đã chọn ảnh
                          </span>
                          <button
                            type="button"
                            onClick={() => setStorePhoto('')}
                            className="text-xs text-red-700 hover:underline font-medium"
                          >
                            Đổi ảnh khác
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-6 aspect-video max-w-sm w-full border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-green-50/30 transition-all group">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-text-muted group-hover:text-green-dark group-hover:scale-105 transition-all mb-2">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-semibold text-text-main">Tải lên ảnh chụp biển hiệu / cửa hàng</p>
                        <p className="text-[11px] text-text-muted mt-1">Hỗ trợ JPG, PNG (tỉ lệ 16:9, tối đa 5MB)</p>
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
                      className="w-full sm:w-auto px-8 shadow-sm bg-green-600 hover:bg-green-700"
                    >
                      Gửi hồ sơ đợi xét duyệt <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              )}
            </div>
  );
}
