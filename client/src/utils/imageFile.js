const MAX_SIDE = 1280;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * Đọc file ảnh, thu nhỏ về tối đa 1280px và nén JPEG để payload luôn nhỏ hơn giới hạn 5MB của server
 * (ảnh gốc 5MB đổi sang base64 đã vượt giới hạn, đây là lý do tải ảnh trước đây báo lỗi).
 */
export function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Vui lòng chọn file ảnh (JPG, PNG, WebP).'));
    if (file.size > MAX_INPUT_BYTES) return reject(new Error('Ảnh quá lớn (tối đa 10MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG trong suốt -> nền trắng khi đổi sang JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này. Hãy thử file JPG hoặc PNG khác.'));
    };
    img.src = url;
  });
}
