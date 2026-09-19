import mongoose from 'mongoose';

const microTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['di_cho', 'nau_an', 'xe_om', 'chuyen_do', 'lay_ship', 'khac'],
    default: 'di_cho',
  },
  description: { type: String, required: true },
  reward: { type: Number, required: true }, // Số tiền thù lao (VNĐ)
  location: { type: String, required: true }, // Ví dụ: KTX Dom A ĐH FPT, KTX ĐHQG, Chợ Tân Xã...
  deadline: { type: String, default: 'Hôm nay' }, // Thời gian cần làm
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName: { type: String, required: true },
  requesterPhone: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'accepted', 'completed', 'cancelled'],
    default: 'open',
  },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assigneeName: { type: String, default: '' },
  assigneePhone: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

export const MicroTask = mongoose.model('MicroTask', microTaskSchema);

