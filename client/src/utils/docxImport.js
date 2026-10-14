import DOMPurify from 'dompurify';
import { fileToImageDataUrl } from '@/utils/imageFile.js';

/**
 * Đọc file .docx trong trình duyệt và giữ nguyên bố cục (đoạn, in đậm, danh sách, bảng, ảnh đúng vị trí) dưới dạng HTML.
 * Mỗi ảnh được nén rồi gửi qua `uploadImg(dataUrl) -> url` để bài viết không phải chứa base64.
 * Trả về { title, summary, html }: dòng đầu = tiêu đề (bỏ khỏi html vì trang đã hiện tiêu đề).
 * ponytail: chỉ .docx (mammoth không đọc .doc cũ); màu chữ/font/căn lề không được giữ, chỉ cấu trúc.
 */
export async function parseDocx(file, uploadImg) {
  if (!/\.docx$/i.test(file?.name || '')) throw new Error('Vui lòng chọn file Word đuôi .docx (không hỗ trợ .doc cũ).');
  if (file.size > 10 * 1024 * 1024) throw new Error('File quá lớn (tối đa 10MB).');

  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const blob = await (await fetch(`data:${image.contentType};base64,${await image.read('base64')}`)).blob();
          return { src: await uploadImg(await fileToImageDataUrl(new File([blob], 'docx-image', { type: blob.type }))) };
        } catch {
          return { src: '' }; // ảnh lỗi/định dạng lạ (EMF...) thì bỏ, không chặn cả bài
        }
      }),
    },
  );

  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(value), 'text/html');
  doc.querySelectorAll('img[src=""]').forEach(img => img.remove());

  const first = [...doc.body.children].find(el => el.textContent.trim());
  const title = first?.textContent.trim();
  if (!title) throw new Error('Không đọc được nội dung văn bản trong file này.');
  if (!first.querySelector('img')) first.remove();

  const summary = (doc.body.querySelector('p')?.textContent.trim() || title).slice(0, 200);
  return { title, summary, html: doc.body.innerHTML.trim() || `<p>${title}</p>` };
}
