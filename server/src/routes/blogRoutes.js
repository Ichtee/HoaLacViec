import express from 'express';
import { Blog } from '../models/Blog.js';

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

    // Increment views
    blog.views += 1;
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

// POST /api/blogs (Tạo bài viết)
router.post('/', async (req, res) => {
  try {
    const { title, slug, summary, content, category, coverImage, tags, featured } = req.body;
    const cleanSlug = slug || title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

    const newBlog = await Blog.create({
      title,
      slug: cleanSlug,
      summary,
      content,
      category: category || 'kinh_nghiem',
      coverImage: coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60',
      tags: tags || ['hoa_lac', 'sinh_vien'],
      featured: Boolean(featured),
    });

    res.status(201).json(newBlog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

