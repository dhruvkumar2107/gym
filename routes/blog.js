const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => {
  const { page = 1, limit = 10, category, search } = req.query;
  const offset = (page - 1) * limit;
  let sql = 'SELECT bp.*, u.full_name as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.is_published = 1';
  const params = [];
  if (category) { sql += ' AND bp.category = ?'; params.push(category); }
  if (search) { sql += ' AND (bp.title LIKE ? OR bp.excerpt LIKE ?)'; params.push('%'+search+'%','%'+search+'%'); }
  const total = get(sql.replace('SELECT bp.*, u.full_name as author_name', 'SELECT COUNT(*) as count'), params).count;
  sql += ' ORDER BY bp.published_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const posts = all(sql, params);
  posts.forEach(p => { try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; } });
  res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.get('/categories', (req, res) => {
  res.json(all('SELECT * FROM blog_categories'));
});

router.get('/:slug', (req, res) => {
  const post = get('SELECT bp.*, u.full_name as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.slug = ? AND bp.is_published = 1', [req.params.slug]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  try { post.tags = JSON.parse(post.tags); } catch(e) { post.tags = []; }
  const prevPost = get('SELECT slug, title FROM blog_posts WHERE is_published = 1 AND published_at < ? ORDER BY published_at DESC LIMIT 1', [post.published_at]);
  const nextPost = get('SELECT slug, title FROM blog_posts WHERE is_published = 1 AND published_at > ? ORDER BY published_at ASC LIMIT 1', [post.published_at]);
  res.json({ post, prevPost, nextPost });
});

router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { title, slug, featured_image, category, tags, content, excerpt, seo_title, meta_description, canonical_url, is_published } = req.body;
  const publishedAt = is_published ? new Date().toISOString() : null;
  run('INSERT INTO blog_posts (title, slug, featured_image, author_id, category, tags, content, excerpt, seo_title, meta_description, canonical_url, is_published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, slug, featured_image, req.user.id, category, JSON.stringify(tags || []), content, excerpt, seo_title || title, meta_description || excerpt, canonical_url || '', is_published ? 1 : 0, publishedAt]);
  res.json({ message: 'Blog post created' });
});

router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { title, slug, featured_image, category, tags, content, excerpt, seo_title, meta_description, canonical_url, is_published } = req.body;
  run('UPDATE blog_posts SET title=?, slug=?, featured_image=?, category=?, tags=?, content=?, excerpt=?, seo_title=?, meta_description=?, canonical_url=?, is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, slug, featured_image, category, JSON.stringify(tags || []), content, excerpt, seo_title, meta_description, canonical_url, is_published ? 1 : 0, req.params.id]);
  if (is_published) {
    const post = get('SELECT published_at FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!post.published_at) {
      run('UPDATE blog_posts SET published_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    }
  }
  res.json({ message: 'Blog post updated' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ message: 'Blog post deleted' });
});

module.exports = router;
