import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['kinh_nghiem', 'canh_bao', 'cam_nang', 'phong_van', 'doi_song'],
    default: 'kinh_nghiem',
  },
  coverImage: { type: String, default: '' },
  author: {
    name: { type: String, default: 'Ban Biên Tập Hoa Lạc Việc' },
    role: { type: String, default: 'Admin' },
    avatar: { type: String, default: '' },
  },
  tags: [{ type: String }],
  views: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

export const Blog = mongoose.model('Blog', blogSchema);

