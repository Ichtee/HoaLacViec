import { SePayPgClient } from 'sepay-pg-node';
import { httpError } from '../utils/httpError.js';

let override = null;
export const setSepayClientForTests = (fake) => { override = fake; };

export function getSepayClient() {
  if (override) return override;
  const { SEPAY_ENV, SEPAY_MERCHANT_ID, SEPAY_SECRET_KEY } = process.env;
  if (!SEPAY_MERCHANT_ID || !SEPAY_SECRET_KEY) {
    throw httpError(503, 'TOPUP_UNAVAILABLE', 'Tính năng nạp credit tạm thời chưa khả dụng.');
  }
  const client = new SePayPgClient({ env: SEPAY_ENV === 'production' ? 'production' : 'sandbox', merchant_id: SEPAY_MERCHANT_ID, secret_key: SEPAY_SECRET_KEY });
  return {
    initCheckoutUrl: () => client.checkout.initCheckoutUrl(),
    initOneTimePaymentFields: (p) => client.checkout.initOneTimePaymentFields(p),
    // retrieve() resolves an axios response whose body nesting is undocumented, so unwrap defensively.
    retrieveOrder: async (invoice) => {
      const body = (await client.order.retrieve(invoice)).data;
      const inner = body?.data ?? body;
      return inner?.order ?? inner;
    },
  };
}
