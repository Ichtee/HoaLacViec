import express from 'express';
import { Blog } from '../models/Blog.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/blogs
router.get('/', async (req, res) => {
  try {
    const { category, search, tag, limit = 20 } = req.query;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }
    if (tag) {
      filter.tags = tag;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const blogs = await Blog.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .limit(Number(limit));

    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/:idOrSlug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    let blog = null;
    if (param.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findById(param);
    }
    if (!blog) {
      blog = await Blog.findOne({ slug: param });
    }

    if (!blog) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    // Increment views safely
    blog.views = (blog.views || 0) + 1;
    await blog.save();

    // Related blogs
    const related = await Blog.find({
      _id: { $ne: blog._id },
      category: blog.category,
    }).limit(3);

    res.json({ blog, related });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export function generateBlogSlug(title) {
  const base = (title || 'bai-viet')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'bai-viet'}-${Date.now().toString().slice(-4)}`;
}

const ALLOWED_CATEGORIES = ['kinh_nghiem', 'canh_bao', 'cam_nang', 'phong_van', 'doi_song'];

function parseTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return ['hoa_lac', 'sinh_vien'];
}

// POST /api/blogs (Tạo bài viết mới - Chỉ Admin)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, slug, summary, content, category, coverImage, tags, featured } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Tiêu đề bài viết không được để trống.' });
    }
    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: 'Tóm tắt bài viết không được để trống.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung bài viết không được để trống.' });
    }

    const validatedCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'kinh_nghiem';
    const cleanSlug = slug && slug.trim() ? slug.trim() : generateBlogSlug(title);

    // Check slug collision
    const existingSlug = await Blog.findOne({ slug: cleanSlug });
    const finalSlug = existingSlug ? `${cleanSlug}-${Date.now().toString().slice(-3)}` : cleanSlug;

    const newBlog = await Blog.create({
      title: title.trim(),
      slug: finalSlug,
      summary: summary.trim(),
      content: content.trim(),
      category: validatedCategory,
      coverImage: (coverImage || '').trim() || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60',
      tags: parseTags(tags),
      featured: Boolean(featured),
      author: {
        name: (req.body.author?.name || req.user?.name || 'Ban Biên Tập Hoa Lạc Việc').trim(),
        role: 'Admin',
        avatar: req.body.author?.avatar || req.user?.avatar || '',
      },
    });

    res.status(201).json(newBlog);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi khi tạo bài viết mới.' });
  }
});

// PUT /api/blogs/:id (Chỉnh sửa bài viết - Chỉ Admin)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết cần chỉnh sửa.' });
    }

    const { title, slug, summary, content, category, coverImage, tags, featured } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
      blog.title = title.trim();
    }
    if (summary !== undefined) {
      if (!summary.trim()) return res.status(400).json({ error: 'Tóm tắt không được để trống.' });
      blog.summary = summary.trim();
    }
    if (content !== undefined) {
      if (!content.trim()) return res.status(400).json({ error: 'Nội dung không được để trống.' });
      blog.content = content.trim();
    }
    if (category !== undefined && ALLOWED_CATEGORIES.includes(category)) {
      blog.category = category;
    }
    if (coverImage !== undefined) {
      blog.coverImage = coverImage.trim();
    }
    if (tags !== undefined) {
      blog.tags = parseTags(tags);
    }
    if (featured !== undefined) {
      blog.featured = Boolean(featured);
    }
    if (slug && slug.trim() && slug.trim() !== blog.slug) {
      const duplicate = await Blog.findOne({ slug: slug.trim(), _id: { $ne: blog._id } });
      if (duplicate) {
        return res.status(400).json({ error: 'Slug đường dẫn bài viết này đã tồn tại.' });
      }
      blog.slug = slug.trim();
    }

    await blog.save();
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi khi cập nhật bài viết.' });
  }
});

// DELETE /api/blogs/:id (Xóa bài viết - Chỉ Admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết cần xóa.' });
    }
    res.json({ message: 'Đã xóa bài viết thành công.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi khi xóa bài viết.' });
  }
});

export default router;

