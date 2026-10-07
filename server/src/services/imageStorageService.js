import crypto from 'crypto';

/**
 * Lưu ảnh xác minh (thẻ sinh viên, CCCD, giấy phép) ngoài MongoDB bằng Cloudinary.
 * Khi chưa cấu hình, ảnh vẫn được giữ dạng data URI như trước (hành vi cũ) để không làm hỏng dev/demo.
 *
 * Ảnh được tải lên với public_id ngẫu nhiên 128 bit nên URL không đoán được. Chỉ quản trị viên
 * và chủ hồ sơ nhận được URL qua API đã có kiểm soát quyền.
 */
const DATA_URI_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isImageStorageConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

export function isDataUri(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

/** Chữ ký tải lên Cloudinary: SHA-1 của các tham số sắp theo tên (trừ file, api_key) nối với API secret. */
export function signUploadParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Nhận giá trị ảnh từ client và trả về giá trị nên lưu vào DB:
 * - chuỗi rỗng / URL http(s) có sẵn: giữ nguyên
 * - data URI: kiểm tra loại và dung lượng, rồi tải lên Cloudinary nếu đã cấu hình
 */
export async function persistImage(value, { folder = 'verification', fetchImpl = fetch } = {}) {
  if (!value || !isDataUri(value)) return value || '';

  const match = DATA_URI_RE.exec(value);
  if (!match) throw httpError(400, 'INVALID_IMAGE', 'Ảnh phải là JPEG, PNG hoặc WebP hợp lệ.');
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) throw httpError(413, 'IMAGE_TOO_LARGE', 'Ảnh vượt quá dung lượng tối đa 5MB.');

  if (!isImageStorageConfigured()) return value;

  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  const signed = {
    folder: `hoalacviec/${folder}`,
    public_id: crypto.randomBytes(16).toString('hex'),
    timestamp: Math.floor(Date.now() / 1000),
  };
  const form = new FormData();
  form.append('file', value);
  form.append('api_key', apiKey);
  for (const [key, val] of Object.entries(signed)) form.append(key, String(val));
  form.append('signature', signUploadParams(signed, secret));

  const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    console.warn('[image-storage] upload failed:', data?.error?.message || response.status);
    throw httpError(502, 'IMAGE_UPLOAD_FAILED', 'Không thể lưu ảnh lúc này. Vui lòng thử lại sau.');
  }
  return data.secure_url;
}
