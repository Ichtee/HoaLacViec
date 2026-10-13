import { useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from '@/services';
import { fileToImageDataUrl } from '@/utils/imageFile.js';

/** Chọn ảnh -> nén -> tải lên server, trả URL qua onChange. folder: 'jobs' | 'blogs' | 'store'. */
export function ImageUploadField({ label, hint, value, onChange, folder = 'jobs' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      setBroken(false);
      onChange(await uploadImage(await fileToImageDataUrl(file), folder));
    } catch (err) {
      setError(err.message || 'Không tải được ảnh. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="block font-bold text-gray-800 text-xs mb-1.5">{label}</p>
      {hint && <p className="text-[11px] text-gray-500 mb-2">{hint}</p>}
      {value ? (
        <div className="relative max-w-sm rounded-2xl overflow-hidden border border-green-100 bg-gray-50">
          <img src={value} alt="Ảnh đã chọn" onError={() => setBroken(true)} onLoad={() => setBroken(false)} className="w-full aspect-video object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Xóa ảnh"
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-red-700 shadow hover:bg-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 max-w-sm aspect-video rounded-2xl border-2 border-dashed border-gray-300 hover:border-green-main bg-gray-50/50 cursor-pointer text-xs font-semibold text-gray-600">
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
          {busy ? 'Đang tải ảnh...' : 'Chọn ảnh (JPG, PNG, WebP)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={busy} className="sr-only" />
        </label>
      )}
      {broken && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">Không hiển thị được ảnh này (đường dẫn hỏng hoặc bị chặn). Hãy tải ảnh lên từ máy.</p>}
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
