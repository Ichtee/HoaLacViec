/** Chỉ đọc: đếm hồ sơ xác thực theo trạng thái, để đối chiếu hàng chờ trên trang tổng quan admin. */
import 'dotenv/config';
import mongoose from 'mongoose';
import { EmployerVerification } from '../models/EmployerVerification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';

await mongoose.connect(process.env.MONGO_URI);
const [ev, evPendingUsers, stores, sp] = await Promise.all([
  EmployerVerification.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  EmployerVerification.distinct('employerUserId'),
  EmployerProfile.aggregate([{ $group: { _id: '$verified', n: { $sum: 1 } } }]),
  StudentProfile.aggregate([{ $group: { _id: { status: '$verificationStatus', verified: '$verified', type: '$profileType' }, n: { $sum: 1 } } }]),
]);
console.log('EmployerVerification theo status:', JSON.stringify(ev));
console.log('EmployerProfile theo verified   :', JSON.stringify(stores));
console.log('Chủ quán đã có bản ghi EmployerVerification:', evPendingUsers.length);
console.log('StudentProfile (status, verified, type):');
console.table(sp.map((r) => ({ ...r._id, n: r.n })));
const unsubmittedStores = await EmployerProfile.countDocuments({ verified: false, userId: { $nin: evPendingUsers } });
console.log('EmployerProfile chưa verified và CHƯA nộp hồ sơ (server vẫn trả là pending):', unsubmittedStores);
await mongoose.disconnect();
