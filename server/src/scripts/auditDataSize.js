/** Chỉ đọc: kích thước collection, tài liệu lớn nhất, ảnh base64 còn nằm trong DB, và độ trễ tới Atlas. */
import 'dotenv/config';
import mongoose from 'mongoose';

const t0 = Date.now();
await mongoose.connect(process.env.MONGO_URI);
const connectMs = Date.now() - t0;
const db = mongoose.connection.db;

const pings = [];
for (let i = 0; i < 5; i++) { const t = Date.now(); await db.command({ ping: 1 }); pings.push(Date.now() - t); }
console.log(`Kết nối: ${connectMs}ms; ping tới Atlas từ máy này: ${pings.join(', ')}ms`);
const hello = await db.admin().command({ hello: 1 });
console.log('Atlas host:', hello.me || hello.primary, '| tags:', JSON.stringify(hello.tags || {}));

const rows = [];
for (const { name } of await db.listCollections().toArray()) {
  const stats = await db.command({ collStats: name });
  rows.push({ collection: name, docs: stats.count, avgKB: +(stats.avgObjSize / 1024 || 0).toFixed(1), totalMB: +(stats.size / 1048576).toFixed(2), indexes: stats.nindexes });
}
rows.sort((a, b) => b.totalMB - a.totalMB);
console.table(rows.slice(0, 15));

// Trường chứa ảnh base64 (data:) theo collection
const checks = {
  jobs: ['coverImage'],
  blogs: ['coverImage'],
  studentprofiles: ['studentCardPhoto', 'idCardFrontPhoto', 'idCardBackPhoto'],
  employerverifications: ['documents.url'],
  users: ['avatar'],
};
for (const [coll, fields] of Object.entries(checks)) {
  for (const f of fields) {
    const n = await db.collection(coll).countDocuments({ [f]: { $regex: '^data:' } }).catch(() => 'n/a');
    if (n) console.log(`base64 trong ${coll}.${f}: ${n}`);
  }
}
for (const coll of ['jobs', 'studentprofiles', 'employerverifications', 'users', 'blogs']) {
  const top = await db.collection(coll).aggregate([{ $project: { s: { $bsonSize: '$$ROOT' } } }, { $sort: { s: -1 } }, { $limit: 1 }]).toArray().catch(() => []);
  if (top[0]) console.log(`Tài liệu lớn nhất ${coll}: ${(top[0].s / 1024).toFixed(0)}KB`);
}
await mongoose.disconnect();
