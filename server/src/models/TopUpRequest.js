import mongoose from 'mongoose';

const topUpRequestSchema = new mongoose.Schema({
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packId: { type: String, required: true },
  amountVnd: { type: Number, required: true },
  credits: { type: Number, required: true },
  invoiceNumber: { type: String, required: true, unique: true, match: /^HLV[A-Z0-9]{8}$/ }, // sent to SePay as order_invoice_number
  status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'voided'], default: 'pending' },
  sepayOrderId: { type: String, default: null },
  paidAt: { type: Date, default: null },
  failureReason: { type: String, default: '' },
}, { timestamps: true });

export const TopUpRequest = mongoose.model('TopUpRequest', topUpRequestSchema);
