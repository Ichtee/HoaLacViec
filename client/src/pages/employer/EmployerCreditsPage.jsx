import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, Minus, Plus } from 'lucide-react';
import {
  apiGetCreditPricing, apiGetMyCredits, apiCreateTopUp, apiGetTopUp, apiReconcileTopUp,
} from '@/services';
import { Toast, LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';

const NOTE = 'Credit chỉ dùng cho dịch vụ trên Hoa Lạc Việc, không quy đổi thành tiền và không chuyển nhượng.';
const PRICE_LABEL = {
  featured_3d: 'Tin nổi bật 3 ngày',
  featured_7d: 'Tin nổi bật 7 ngày',
  renew_14d: 'Gia hạn tin 14 ngày',
  extra_slot: 'Thêm một tin đăng ngoài hạn mức miễn phí',
  quick_shift: 'Đăng một ca lẻ (tuyển nhanh)',
};
const REASON_LABEL = { welcome: 'Credit chào mừng', admin_adjust: 'Điều chỉnh bởi quản trị viên', ...PRICE_LABEL };
const POLL_MS = 3000;
const POLL_MAX = 10; // 30 s

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;
const describe = (tx) => {
  const label = REASON_LABEL[tx.reason];
  if (tx.type === 'topup') return 'Nạp credit';
  if (tx.type === 'refund') return `Hoàn credit${label ? `: ${label}` : ''}`;
  return label || tx.note || 'Giao dịch credit';
};

function submitCheckout({ url, fields }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  Object.entries(fields || {}).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

// Mirrors quoteTopUp in server/src/config/credits.js; the server stays the authority.
function quote(topup, raw) {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n)) return { error: 'Nhập số credit muốn nạp.' };
  if (n < topup.min || n > topup.max) return { error: `Số credit từ ${topup.min} đến ${topup.max}.` };
  if (n % topup.step !== 0) return { error: `Số credit phải là bội số của ${topup.step}.` };
  const tier = topup.bonusTiers.find((t) => n >= t.minCredits);
  const bonus = tier ? Math.floor((n * tier.pct) / 100) : 0;
  return { credits: n, bonus, total: n + bonus, vnd: n * topup.vndPerCredit };
}

export default function EmployerCreditsPage() {
  const [params] = useSearchParams();
  const topupId = params.get('topup');
  const result = params.get('result');
  const [pricing, setPricing] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [amount, setAmount] = useState('100');
  const [toast, setToast] = useState(null);
  // idle | polling | paid | error | cancel | pending (still unconfirmed after 30 s)
  const [returnState, setReturnState] = useState(topupId ? (result === 'error' || result === 'cancel' ? result : 'polling') : 'idle');
  const [grantedCredits, setGrantedCredits] = useState(0);
  const [checking, setChecking] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      setMe(await apiGetMyCredits());
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được số dư credit.' });
    }
  }, []);

  useEffect(() => {
    Promise.all([
      apiGetCreditPricing().then(setPricing).catch((err) => setToast({ type: 'error', message: err.message || 'Không tải được bảng giá.' })),
      loadMe(),
    ]).finally(() => setLoading(false));
  }, [loadMe]);

  useEffect(() => {
    if (returnState !== 'polling') return undefined;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const { topUp } = await apiGetTopUp(topupId);
        if (topUp.status === 'paid') {
          clearInterval(timer);
          setGrantedCredits(topUp.credits);
          setReturnState('paid');
          loadMe();
          return;
        }
        if (topUp.status === 'failed' || topUp.status === 'cancelled') {
          clearInterval(timer);
          setReturnState(topUp.status === 'failed' ? 'error' : 'cancel');
          return;
        }
      } catch {
        // keep polling until the window ends
      }
      if (tries >= POLL_MAX) { clearInterval(timer); setReturnState('pending'); }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [returnState, topupId, loadMe]);

  async function recheck() {
    setChecking(true);
    try {
      const { topUp } = await apiReconcileTopUp(topupId);
      if (topUp.status === 'paid') {
        setGrantedCredits(topUp.credits);
        setReturnState('paid');
        loadMe();
      } else {
        setToast({ type: 'error', message: 'Chưa nhận được thanh toán. Nếu bạn đã chuyển tiền, vui lòng thử lại sau ít phút.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không kiểm tra được giao dịch.' });
    } finally {
      setChecking(false);
    }
  }

  async function buy(credits) {
    setBuying(true);
    try {
      const { checkout } = await apiCreateTopUp(credits);
      submitCheckout(checkout);
      setBuying(false); // page may be restored from bfcache
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo yêu cầu nạp credit.' });
      setBuying(false);
    }
  }

  const banner = {
    polling: ['bg-blue-50 text-blue-700', 'Đang xác nhận thanh toán...'],
    paid: ['bg-green-50 text-green-700', `Đã cộng ${grantedCredits} credit`],
    error: ['bg-red-50 text-red-700', 'Thanh toán không thành công. Bạn chưa bị trừ credit, vui lòng thử lại.'],
    cancel: ['bg-amber-50 text-amber-700', 'Bạn đã huỷ thanh toán. Không có khoản nào được cộng.'],
    pending: ['bg-amber-50 text-amber-700', 'Chưa xác nhận được thanh toán. Nếu bạn đã chuyển tiền, hãy kiểm tra lại.'],
  }[returnState];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader
        icon={Coins}
        title="Credit của cửa hàng"
        description="Dùng credit để mua tin nổi bật, gia hạn tin và đăng ca lẻ."
        badge={me && <span className="badge">{me.balance} credit</span>}
      />

      {banner && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold flex flex-wrap items-center justify-between gap-2 ${banner[0]}`} role="status">
          <span>{banner[1]}</span>
          {returnState === 'pending' && (
            <button className="btn btn-primary btn-sm" onClick={recheck} disabled={checking}>Kiểm tra lại</button>
          )}
        </div>
      )}

      {loading ? <LoadingPage /> : !pricing ? (
        <EmptyState icon={<Coins />} title="Chưa tải được bảng giá" description="Vui lòng tải lại trang." className="bg-white rounded-3xl border border-green-100" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-text-main">Nạp credit</h2>
            {(() => {
              const t = pricing.topup;
              const q = quote(t, amount);
              const stepBy = (d) => setAmount(String(Math.min(t.max, Math.max(t.min, (Number(amount) || 0) + d * t.step))));
              return (
                <form className="card p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!q.error && !buying) buy(q.credits); }}>
                  <div>
                    <label htmlFor="topup-amount" className="block text-sm font-semibold text-text-main mb-2">Số credit muốn nạp</label>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Giảm ${t.step} credit`} onClick={() => stepBy(-1)} className="w-11 h-11 shrink-0 rounded-xl border border-stone-300 bg-white flex items-center justify-center hover:bg-stone-50">
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        id="topup-amount"
                        inputMode="numeric"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        aria-invalid={Boolean(q.error)}
                        aria-describedby="topup-hint"
                        className="h-11 w-full min-w-0 rounded-xl border border-stone-300 px-4 text-center text-xl font-extrabold text-text-main focus:outline-none focus:ring-2 focus:ring-green-main"
                      />
                      <button type="button" aria-label={`Tăng ${t.step} credit`} onClick={() => stepBy(1)} className="w-11 h-11 shrink-0 rounded-xl border border-stone-300 bg-white flex items-center justify-center hover:bg-stone-50">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Chọn nhanh">
                      {t.quick.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={Number(amount) === n}
                          onClick={() => setAmount(String(n))}
                          className={`h-10 px-4 rounded-full border text-sm font-semibold ${Number(amount) === n ? 'bg-green-main text-white border-green-main' : 'bg-white text-text-main border-stone-300 hover:border-green-main'}`}
                        >
                          {n} credit
                        </button>
                      ))}
                    </div>
                  </div>

                  <div id="topup-hint" aria-live="polite" className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm">
                    {q.error ? (
                      <p className="text-red-700 font-semibold">{q.error}</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="flex justify-between gap-3"><span className="text-text-muted">Bạn thanh toán</span><strong className="text-text-main text-base">{vnd(q.vnd)}</strong></p>
                        <p className="flex justify-between gap-3"><span className="text-text-muted">Bạn nhận được</span><strong className="text-green-dark text-base">{q.total} credit{q.bonus ? ` (tặng ${q.bonus})` : ''}</strong></p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-text-muted">
                    1 credit = {vnd(t.vndPerCredit)}. {t.bonusTiers.slice().reverse().map((b) => `Nạp từ ${b.minCredits} credit tặng thêm ${b.pct}%`).join('; ')}.
                  </p>
                  <button type="submit" className="btn btn-primary btn-md w-full" disabled={Boolean(q.error) || buying}>
                    {buying ? 'Đang chuyển đến cổng thanh toán...' : q.error ? 'Nạp credit' : `Nạp ${vnd(q.vnd)}`}
                  </button>
                </form>
              );
            })()}
            <p className="text-xs text-text-muted">{NOTE}</p>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-bold text-text-main">Bảng giá dịch vụ</h2>
            <ul className="divide-y divide-stone-100 text-sm">
              {Object.entries(pricing.prices).map(([key, cost]) => (
                <li key={key} className="flex justify-between gap-3 py-2">
                  <span className="text-text-main min-w-0">{PRICE_LABEL[key] || key}</span>
                  <span className="font-semibold text-text-main shrink-0">{cost} credit</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">
              Mỗi cửa hàng được đăng {pricing.freeActiveListings} tin miễn phí cùng lúc (hiện dùng {me?.activeListings ?? 0}/{pricing.freeActiveListings}), mỗi tin hiển thị {pricing.listingDays} ngày.{pricing.slotCooldownDays ? ` Tin đã đóng hoặc hết hạn vẫn giữ chỗ thêm ${pricing.slotCooldownDays} ngày.` : ''}
            </p>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-bold text-text-main">Lịch sử credit</h2>
            {!me?.transactions?.length ? (
              <p className="text-sm text-text-muted">Chưa có giao dịch nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted border-b border-stone-200">
                      <th className="py-2 pr-3 font-semibold">Thời gian</th>
                      <th className="py-2 pr-3 font-semibold">Nội dung</th>
                      <th className="py-2 pr-3 font-semibold text-right">Credit</th>
                      <th className="py-2 font-semibold text-right">Số dư</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.transactions.map((tx) => (
                      <tr key={tx._id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString('vi-VN')}</td>
                        <td className="py-2 pr-3">{describe(tx)}</td>
                        <td className={`py-2 pr-3 text-right font-semibold whitespace-nowrap ${tx.amount > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">{tx.balanceAfter ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
