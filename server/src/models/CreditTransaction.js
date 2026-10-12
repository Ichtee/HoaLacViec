import mongoose from 'mongoose';

const creditTransactionSchema = new mongoose.Schema({
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, validate: { validator: (v) => v !== 0, message: 'amount must be non-zero' } }, // + grant, - spend
  type: { type: String, enum: ['topup', 'welcome', 'spend', 'refund', 'adjust'], required: true },
  reason: { type: String, default: '' }, // CREDIT_PRICES key, 'welcome', pack id or 'admin_adjust'
  refType: { type: String, enum: ['Job', 'QuickShift', 'TopUpRequest', null], default: null },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  balanceAfter: { type: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  note: { type: String, default: '' },
}, { timestamps: true });

// At most one welcome grant per employer.
creditTransactionSchema.index(
  { employerUserId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'welcome' } },
);

export const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);
