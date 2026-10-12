import mongoose from 'mongoose';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { CreditTransaction } from '../models/CreditTransaction.js';
import { CREDIT_PRICES } from '../config/credits.js';
import { httpError } from '../utils/httpError.js';

export const withCreditTransaction = (fn) => mongoose.connection.transaction((session) => fn(session));

const noProfile = () => httpError(404, 'EMPLOYER_PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ nhà tuyển dụng.');

// Adjusts the balance and writes the ledger row atomically; opens its own transaction unless one is passed.
async function applyDelta({ employerUserId, delta, type, reason, refType = null, refId = null, createdBy = null, note = '', session = null }) {
  if (!session) return withCreditTransaction((s) => applyDelta({ employerUserId, delta, type, reason, refType, refId, createdBy, note, session: s }));
  const filter = delta < 0 ? { userId: employerUserId, creditBalance: { $gte: -delta } } : { userId: employerUserId };
  const profile = await EmployerProfile.findOneAndUpdate(filter, { $inc: { creditBalance: delta } }, { new: true, session });
  if (!profile) {
    if (!(await EmployerProfile.exists({ userId: employerUserId }).session(session))) throw noProfile();
    throw httpError(402, 'INSUFFICIENT_CREDITS', 'Không đủ credit. Vui lòng nạp thêm.');
  }
  const [transaction] = await CreditTransaction.create(
    [{ employerUserId, amount: delta, type, reason, refType, refId, balanceAfter: profile.creditBalance, createdBy, note }],
    { session },
  );
  return { balance: profile.creditBalance, transaction };
}

export function grantCredits({ amount, ...rest }) {
  if (!(amount > 0)) throw httpError(400, 'INVALID_AMOUNT', 'Số credit không hợp lệ.');
  return applyDelta({ ...rest, delta: amount });
}

const priceOf = (reason) => {
  const cost = CREDIT_PRICES[reason];
  if (!cost) throw httpError(400, 'UNKNOWN_CREDIT_REASON', 'Loại giao dịch credit không hợp lệ.');
  return cost;
};

export const spendCredits = ({ reason, ...rest }) => applyDelta({ ...rest, reason, delta: -priceOf(reason), type: 'spend' });

export const refundCredits = ({ reason, ...rest }) => applyDelta({ ...rest, reason, delta: priceOf(reason), type: 'refund' });

export async function getBalance(employerUserId) {
  const p = await EmployerProfile.findOne({ userId: employerUserId }).select('creditBalance').lean();
  if (!p) throw noProfile();
  return p.creditBalance;
}
