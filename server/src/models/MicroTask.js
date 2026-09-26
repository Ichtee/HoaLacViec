import mongoose from 'mongoose';

const microTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['di_cho', 'nau_an', 'xe_om', 'chuyen_do', 'lay_ship', 'khac'],
      default: 'di_cho',
      required: true,
    },
    description: { type: String, required: true, trim: true },
    reward: { type: Number, required: true, min: 5000 }, // Tiền công thực nhận (VNĐ)
    itemBudget: { type: Number, default: 0, min: 0 }, // Tiền tạm ứng mua hàng/chi phí thêm (VNĐ)
    paymentMethod: {
      type: String,
      enum: ['cash', 'banking'],
      default: 'cash',
    },
    location: { type: String, required: true, trim: true }, // Địa điểm chính
    pickupAddress: { type: String, default: '', trim: true }, // Điểm xuất phát (xe_om / chuyen_do)
    destinationAddress: { type: String, default: '', trim: true }, // Điểm đến (xe_om / chuyen_do)
    deadline: { type: String, default: 'Hôm nay' }, // Text display representation
    deadlineDate: { type: Date, required: true }, // Nguồn sự thật thời hạn hoàn thành
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterName: { type: String, required: true, trim: true },
    requesterPhone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['open', 'accepted', 'submitted_for_completion', 'completed', 'disputed', 'cancelled', 'expired'],
      default: 'open',
    },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assigneeName: { type: String, default: '', trim: true },
    assigneePhone: { type: String, default: '', trim: true },
    completionProof: { type: String, default: '', trim: true }, // Minh chứng hoàn thành (hình ảnh, link, mô tả)
    completionNote: { type: String, default: '', trim: true },
    disputeReason: { type: String, default: '', trim: true },
    disputeReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
    cancelReason: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
    history: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

microTaskSchema.index({ status: 1, isDeleted: 1 });
microTaskSchema.index({ requesterId: 1 });
microTaskSchema.index({ assigneeId: 1 });
microTaskSchema.index({ deadlineDate: 1 });
microTaskSchema.index({ createdAt: -1 });

export const MicroTask = mongoose.model('MicroTask', microTaskSchema);
