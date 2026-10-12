import { TopUpRequest } from '../models/TopUpRequest.js';
import { SEPAY_PAID_ORDER_STATUSES } from '../config/sepay.js';
import { getSepayClient } from './sepayClient.js';
import { grantCredits, withCreditTransaction } from './creditService.js';

// Never trusts the IPN body: status and amount always come from the order lookup at SePay.
export async function applySepayOrderPaid(invoiceNumber, { source }) {
  const topUp = await TopUpRequest.findOne({ invoiceNumber: String(invoiceNumber || '') });
  if (!topUp) return { status: 'unknown', topUp: null };
  if (topUp.status === 'paid') return { status: 'already_paid', topUp };
  const order = await getSepayClient().retrieveOrder(topUp.invoiceNumber);
  if (!SEPAY_PAID_ORDER_STATUSES.includes(order?.order_status)) return { status: 'not_paid', topUp };
  if (Number(order.order_amount) !== topUp.amountVnd) {
    const failed = await TopUpRequest.findOneAndUpdate({ _id: topUp._id, status: 'pending' }, { status: 'failed', failureReason: 'amount_mismatch' }, { new: true });
    console.warn(`[credits] amount mismatch invoice=${topUp.invoiceNumber} source=${source}`);
    return { status: 'amount_mismatch', topUp: failed || topUp };
  }
  const paid = await withCreditTransaction(async (session) => {
    const claimed = await TopUpRequest.findOneAndUpdate(
      { _id: topUp._id, status: 'pending' },
      { status: 'paid', paidAt: new Date(), sepayOrderId: String(order.order_id ?? order.id ?? '') || null },
      { new: true, session },
    );
    if (!claimed) return null;
    await grantCredits({ employerUserId: topUp.employerUserId, amount: topUp.credits, type: 'topup', reason: topUp.packId, refType: 'TopUpRequest', refId: topUp._id, session });
    return claimed;
  });
  return paid ? { status: 'granted', topUp: paid } : { status: 'already_paid', topUp: await TopUpRequest.findById(topUp._id) };
}
