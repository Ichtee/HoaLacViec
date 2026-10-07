import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  Bike,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { Modal } from '@/components/Modal.jsx';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { formatVND } from '@/utils';

const PRESET_SHIFTS = [
  'Ca Sáng (7h - 12h)',
  'Ca Chiều (12h - 17h)',
  'Ca Tối (17h - 22h)',
  'Ca Xoay / Linh hoạt theo lịch học',
  'Full-time cuối tuần (Thứ 7 & CN)',
];
const HOURS_PER_WEEK = ['Dưới 10 giờ', '10 - 20 giờ', '20 - 30 giờ', 'Trên 30 giờ', 'Linh hoạt theo lịch học'];
const TRANSPORTS = ['Xe máy', 'Xe đạp / xe điện', 'Xe buýt', 'Đi bộ'];
const EXPERIENCE_LEVELS = ['Chưa có kinh nghiệm', 'Dưới 6 tháng', '6 - 12 tháng', 'Trên 1 năm'];
const SKILLS = ['Giao tiếp tốt', 'Nhanh nhẹn', 'Làm được ca tối', 'Làm được cuối tuần', 'Biết pha chế', 'Biết thu ngân', 'Tiếng Anh cơ bản', 'Có laptop'];
const INTRO_SUGGESTIONS = [
  'Em có thể đi làm đúng giờ và nhận ca linh hoạt theo lịch học.',
  'Em chăm chỉ, học nhanh và sẵn sàng được đào tạo.',
  'Em ở gần khu vực quán nên di chuyển thuận tiện.',
];
const INTRO_MAX = 500;

/** Ghép các lựa chọn thành lời nhắn nhiều dòng để nhà tuyển dụng đọc nhanh. */
export function buildApplicationNote({ position, shift, startDate, hoursPerWeek, transport, experience, skills, intro }) {
  const lines = [`[Vị trí: ${position}] [Ca: ${shift}]`];
  if (startDate) lines.push(`Có thể bắt đầu từ: ${startDate.split('-').reverse().join('/')}`);
  if (hoursPerWeek) lines.push(`Thời lượng mỗi tuần: ${hoursPerWeek}`);
  if (transport) lines.push(`Phương tiện: ${transport}`);
  if (experience) lines.push(`Kinh nghiệm: ${experience}`);
  if (skills.length) lines.push(`Kỹ năng: ${skills.join(', ')}`);
  if (intro.trim()) lines.push(`Giới thiệu: ${intro.trim()}`);
  return lines.join('\n');
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <fieldset className="space-y-3 min-w-0">
      <legend className="flex items-center gap-2 text-sm font-bold text-text-main mb-1">
        <span className="w-7 h-7 rounded-xl bg-green-50 text-green-dark flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
        {title}
      </legend>
      {hint && <p className="text-xs text-text-muted -mt-1">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Chip({ selected, onClick, children, role = 'radio' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
        selected ? 'bg-green-main border-green-main text-white' : 'bg-white border-gray-200 text-text-main hover:border-green-main'
      )}
    >
      {children}
    </button>
  );
}

const inputClass = 'w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main text-sm text-text-main bg-white';

/**
 * Hộp thoại ứng tuyển chi tiết. Gọi onSubmit({ name, phone, position, shift, note }).
 * Nên render với key khác nhau mỗi lần mở để trạng thái form được đặt lại.
 */
export function ApplyJobModal({ isOpen, onClose, job, unitLabel, storeName, user, defaultPhone, matchResult, applying, error, onSubmit }) {
  const positions = job?.positions || [];
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || defaultPhone || '');
  const [positionIndex, setPositionIndex] = useState(0);
  const [presetShift, setPresetShift] = useState(PRESET_SHIFTS[0]);
  const [startDate, setStartDate] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(HOURS_PER_WEEK[4]);
  const [transport, setTransport] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState([]);
  const [intro, setIntro] = useState('');
  const [showReview, setShowReview] = useState(false);

  const chosen = positions.length > 0
    ? { position: positions[positionIndex]?.title || job.title, shift: positions[positionIndex]?.shift || 'Ca xoay' }
    : { position: job?.title || '', shift: presetShift };

  const note = useMemo(
    () => buildApplicationNote({ ...chosen, startDate, hoursPerWeek, transport, experience, skills, intro }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen.position, chosen.shift, startDate, hoursPerWeek, transport, experience, skills, intro]
  );

  function toggleSkill(skill) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  function appendSuggestion(text) {
    setIntro((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${text}` : text;
      return next.slice(0, INTRO_MAX);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name: name.trim(), phone: phone.trim(), position: chosen.position, shift: chosen.shift, note });
  }

  const today = new Date().toISOString().slice(0, 10);
  const address = job?.address?.split(',').slice(-3).join(',').trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ứng tuyển công việc" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 text-sm">
        {/* Tóm tắt tin */}
        <div className="p-4 bg-green-50/70 border border-green-100 rounded-2xl flex items-start gap-3">
          <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0', avatarColorClass(storeName))}>
            {avatarInitial(storeName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-dark">Bạn đang ứng tuyển</p>
            <h4 className="font-bold text-base text-text-main leading-snug">{job.title}</h4>
            <p className="text-text-muted text-xs">{storeName}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-main">
              <span className="inline-flex items-center gap-1.5 font-bold text-orange-700"><Wallet className="w-3.5 h-3.5" />{formatVND(job.salaryAmount)}{unitLabel}</span>
              {address && <span className="inline-flex items-center gap-1.5 min-w-0"><MapPin className="w-3.5 h-3.5 text-red-700 shrink-0" /><span className="truncate">{address}</span></span>}
            </div>
          </div>
        </div>

        {matchResult && (
          <div
            className={clsx(
              'p-3 rounded-2xl border text-xs flex items-start gap-2.5',
              matchResult.hasConflict ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-100 text-green-900'
            )}
          >
            {matchResult.hasConflict ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />}
            <p>
              {matchResult.hasConflict
                ? 'Một số ca của tin này có thể trùng lịch học/lịch rảnh của bạn. Hãy cân nhắc chọn ca khác hoặc ghi chú cho nhà tuyển dụng.'
                : <>Công việc này khớp <strong>{matchResult.score}%</strong> với lịch rảnh và vị trí của bạn.</>}
            </p>
          </div>
        )}

        {/* 1. Liên hệ */}
        <Section icon={User} title="Thông tin liên hệ" hint="Nhà tuyển dụng dùng thông tin này để hẹn phỏng vấn.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="apply-name" className="block text-xs font-bold text-text-main mb-1">Họ và tên <span className="text-red-700">*</span></label>
              <input id="apply-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" className={inputClass} />
            </div>
            <div>
              <label htmlFor="apply-phone" className="block text-xs font-bold text-text-main mb-1">Số điện thoại / Zalo <span className="text-red-700">*</span></label>
              <div className="relative">
                <Phone className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input id="apply-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ví dụ: 0987654321" className={clsx(inputClass, 'pl-9')} />
              </div>
            </div>
          </div>
          {user?.email && <p className="text-xs text-text-muted">Email tài khoản: <strong className="text-text-main">{user.email}</strong></p>}
        </Section>

        {/* 2. Vị trí & ca */}
        <Section icon={Clock} title="Vị trí & ca làm việc" hint={positions.length > 1 ? 'Chọn vị trí bạn muốn ứng tuyển.' : undefined}>
          {positions.length > 0 ? (
            <div role="radiogroup" aria-label="Vị trí ứng tuyển" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {positions.map((p, idx) => {
                const selected = idx === positionIndex;
                return (
                  <button
                    key={`${p.title}-${idx}`}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPositionIndex(idx)}
                    className={clsx(
                      'text-left p-3 rounded-2xl border-2 transition-all',
                      selected ? 'border-green-main bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-200'
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold text-text-main text-sm">{p.title}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-green-main shrink-0" />}
                    </span>
                    <span className="block text-xs text-text-muted mt-0.5">{p.shift}</span>
                    {p.quantity ? <span className="inline-block mt-1.5 text-[11px] font-semibold text-green-dark bg-white/80 border border-green-100 rounded-full px-2 py-0.5">Tuyển {p.quantity} bạn</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div role="radiogroup" aria-label="Ca làm việc" className="flex flex-wrap gap-2">
              {PRESET_SHIFTS.map((shift) => (
                <Chip key={shift} selected={presetShift === shift} onClick={() => setPresetShift(shift)}>{shift}</Chip>
              ))}
            </div>
          )}
        </Section>

        {/* 3. Khả năng làm việc */}
        <Section icon={Calendar} title="Khả năng làm việc">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="apply-start" className="block text-xs font-bold text-text-main mb-1">Có thể bắt đầu từ</label>
              <input id="apply-start" type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="apply-hours" className="block text-xs font-bold text-text-main mb-1">Thời lượng mỗi tuần</label>
              <select id="apply-hours" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className={inputClass}>
                {HOURS_PER_WEEK.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-text-main mb-1.5 flex items-center gap-1.5"><Bike className="w-3.5 h-3.5" /> Phương tiện đi lại</p>
            <div role="radiogroup" aria-label="Phương tiện đi lại" className="flex flex-wrap gap-2">
              {TRANSPORTS.map((t) => (
                <Chip key={t} selected={transport === t} onClick={() => setTransport(transport === t ? '' : t)}>{t}</Chip>
              ))}
            </div>
          </div>
        </Section>

        {/* 4. Kinh nghiệm */}
        <Section icon={Sparkles} title="Kinh nghiệm & giới thiệu" hint="Càng cụ thể, bạn càng dễ được chọn vào vòng phỏng vấn.">
          <div>
            <p className="text-xs font-bold text-text-main mb-1.5">Kinh nghiệm làm việc</p>
            <div role="radiogroup" aria-label="Kinh nghiệm làm việc" className="flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <Chip key={level} selected={experience === level} onClick={() => setExperience(experience === level ? '' : level)}>{level}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-text-main mb-1.5">Điểm mạnh của bạn</p>
            <div role="group" aria-label="Kỹ năng" className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => (
                <Chip key={skill} role="checkbox" selected={skills.includes(skill)} onClick={() => toggleSkill(skill)}>{skill}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="apply-intro" className="block text-xs font-bold text-text-main">Giới thiệu bản thân</label>
              <span className={clsx('text-[11px]', intro.length > INTRO_MAX - 40 ? 'text-amber-700 font-semibold' : 'text-text-muted')}>{intro.length}/{INTRO_MAX}</span>
            </div>
            <textarea
              id="apply-intro"
              rows={4}
              maxLength={INTRO_MAX}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Ví dụ: Em từng làm phục vụ quán cafe 3 tháng, chăm chỉ, đúng giờ, có xe máy đi lại..."
              className={clsx(inputClass, 'resize-none')}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-text-muted self-center mr-1">Gợi ý:</span>
              {INTRO_SUGGESTIONS.map((text) => (
                <button key={text} type="button" onClick={() => appendSuggestion(text)} className="text-[11px] px-2.5 py-1 rounded-full bg-green-50 text-green-dark hover:bg-green-100 text-left">
                  + {text}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Xem lại */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowReview((v) => !v)}
            aria-expanded={showReview}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 text-xs font-bold text-text-main hover:bg-gray-100"
          >
            <span className="inline-flex items-center gap-2"><Eye className="w-4 h-4" /> Xem lại nội dung gửi cho nhà tuyển dụng</span>
            <span className="text-text-muted font-normal">{showReview ? 'Ẩn' : 'Hiện'}</span>
          </button>
          {showReview && (
            <pre className="px-4 py-3 text-xs text-text-main whitespace-pre-wrap font-sans leading-relaxed bg-white">{`${name || '(chưa nhập tên)'} · ${phone || '(chưa nhập SĐT)'}\n${note}`}</pre>
          )}
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Số điện thoại/Zalo của bạn chỉ được chia sẻ với chủ quán này để sắp xếp phỏng vấn. Không ai được thu phí khi bạn ứng tuyển — nếu bị yêu cầu đặt cọc, hãy báo cáo tin.</span>
        </div>

        {error && <p role="alert" className="text-red-700 font-semibold text-xs">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-text-muted font-bold text-sm">
            Hủy
          </button>
          <button type="submit" disabled={applying} className="px-6 py-2.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-sm disabled:opacity-50 shadow-sm">
            {applying ? 'Đang gửi hồ sơ...' : 'Xác nhận nộp đơn'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
