// Run only against a disposable local replica set seeded for manual demo checks.
// The backend on port 5000 must use this same database with verification bypass disabled.
const isolatedUri = 'mongodb://127.0.0.1:27018/hlv_codex_e2e_replica_20261006?replicaSet=rsCodex';
if (process.env.MONGO_URI !== isolatedUri || process.env.DEMO_E2E_ISOLATED !== '1') {
  throw new Error('Refusing to mutate data: set MONGO_URI to the isolated replica test database and DEMO_E2E_ISOLATED=1.');
}
const base = 'http://127.0.0.1:5000/api';
const runId = Date.now();
const results = [];

async function call(name, method, path, token, body, expected = [200]) {
  try {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    const ok = expected.includes(response.status);
    results.push({ name, status: response.status, ok, code: data.code || '', error: data.error || '' });
    return { ok, data, status: response.status };
  } catch (error) {
    results.push({ name, status: 'NETWORK', ok: false, error: error.message });
    return { ok: false, data: {}, status: 'NETWORK' };
  }
}

async function login(name, email) {
  const response = await call(`${name}: đăng nhập`, 'POST', '/auth/login', null, { email, password: '123456' });
  return response.data.token;
}

const student = await login('Sinh viên A', 'khoa.nguyen@student.fpt.edu.vn');
const student2 = await login('Sinh viên B', 'linh.tran@student.fpt.edu.vn');
const employer = await login('Nhà tuyển dụng', 'cafexanh@hoalacviec.vn');
const otherEmployer = await login('Nhà tuyển dụng khác', 'svmarket@hoalacviec.vn');
const admin = await login('Quản trị viên', 'admin@hoalacviec.vn');

await call('Health', 'GET', '/health');
const jobs = await call('Danh sách việc công khai', 'GET', '/jobs');
await call('Chi tiết việc công khai', 'GET', `/jobs/${jobs.data.jobs?.[0]?._id || jobs.data.items?.[0]?._id}`);
await call('Danh sách việc vặt', 'GET', '/tasks');
await call('Danh sách blog', 'GET', '/blogs');
for (const [role, token] of [['Sinh viên', student], ['Nhà tuyển dụng', employer], ['Admin', admin]]) {
  await call(`${role}: phiên đăng nhập`, 'GET', '/auth/me', token);
  await call(`${role}: thông báo`, 'GET', '/notifications', token);
}
await call('Sinh viên: đơn ứng tuyển', 'GET', '/applications', student);
await call('Sinh viên: việc đã lưu', 'GET', '/saved-jobs', student);
await call('Sinh viên: lịch làm', 'GET', '/shifts', student);
await call('Sinh viên: nghỉ phép', 'GET', '/time-off', student);
await call('Nhà tuyển dụng: tin của tôi', 'GET', '/jobs/employer/my-jobs', employer);
await call('Nhà tuyển dụng: ứng viên', 'GET', '/applications', employer);
await call('Nhà tuyển dụng: nhân viên', 'GET', '/employments', employer);
await call('Nhà tuyển dụng: lịch ca', 'GET', '/shifts', employer);
await call('Nhà tuyển dụng: mẫu ca', 'GET', '/shift-templates', employer);
await call('Admin: thống kê', 'GET', '/admin/stats', admin);
await call('Admin: người dùng', 'GET', '/admin/users', admin);
await call('Admin: tin tuyển dụng', 'GET', '/admin/jobs', admin);
await call('Admin: xác minh', 'GET', '/admin/verifications', admin);
await call('Admin: báo cáo', 'GET', '/reports', admin);

const job = await call('Nhà tuyển dụng: tạo tin nháp', 'POST', '/jobs', employer, {
  title: `Tin thử demo ${runId}`,
  storeName: 'Café Xanh Hòa Lạc',
  description: 'Tuyển nhân viên ca linh hoạt cho bản kiểm tra.',
  salaryAmount: 30000,
  salaryUnit: 'hour',
  slots: 2,
  address: 'Khu Công nghệ cao Hòa Lạc, Hà Nội',
  status: 'draft',
}, [201]);
const jobId = job.data._id;
if (jobId) {
  const templateDate = new Date(Date.now() + 21 * 86400000);
  const template = await call('Nhà tuyển dụng: tạo mẫu ca gắn tin của mình', 'POST', '/shift-templates', employer, {
    jobId, positionTitle: 'Nhân viên phục vụ', dayOfWeek: templateDate.getUTCDay(),
    startTime: '13:00', endTime: '17:00',
  }, [201]);
  await call('Nhà tuyển dụng khác: chặn tạo mẫu trên tin không sở hữu', 'POST', '/shift-templates', otherEmployer, {
    jobId, positionTitle: 'Nhân viên phục vụ', dayOfWeek: templateDate.getUTCDay(),
    startTime: '13:00', endTime: '17:00',
  }, [403]);
  if (template.data.template?._id) {
    await call('Nhà tuyển dụng: sửa mẫu ca', 'PUT', `/shift-templates/${template.data.template._id}`, employer, { wageOverride: 35000 });
    await call('Nhà tuyển dụng: tạo ca từ mẫu', 'POST', '/shifts/generate-from-templates', employer, {
      startDate: templateDate.toISOString().slice(0, 10), endDate: templateDate.toISOString().slice(0, 10), jobId,
    });
  }
  await call('Nhà tuyển dụng: gửi duyệt tin', 'POST', `/jobs/${jobId}/submit`, employer, {});
  await call('Admin: duyệt tin', 'POST', `/admin/jobs/${jobId}/approve`, admin, {});
  await call('Người dùng: xem tin sau duyệt', 'GET', `/jobs/${jobId}`);
  await call('Sinh viên: lưu tin', 'POST', `/saved-jobs/toggle/${jobId}`, student, {});
  const application = await call('Sinh viên: ứng tuyển', 'POST', '/applications', student, {
    jobId,
    studentPhone: '0981234567',
    selectedPosition: 'Nhân viên phục vụ',
    selectedShift: 'Ca sáng',
    note: 'Đơn thử nghiệm tự động',
  }, [201]);
  const applicationId = application.data.application?._id;
  if (applicationId) {
    await call('Sinh viên: chặn nộp đơn trùng', 'POST', '/applications', student, { jobId }, [409]);
    await call('Nhà tuyển dụng: sàng lọc', 'PUT', `/applications/${applicationId}`, employer, { status: 'screening' });
    await call('Nhà tuyển dụng: gửi offer', 'POST', `/applications/${applicationId}/offer`, employer, {
      position: 'Nhân viên phục vụ', wage: 30000, wageUnit: 'hour', expiryDays: 3,
    });
    const accepted = await call('Sinh viên: nhận offer', 'POST', `/applications/${applicationId}/accept-offer`, student, {});
    const employmentId = accepted.data.employment?._id;
    if (employmentId) {
      const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const shift = await call('Nhà tuyển dụng: tạo ca nháp', 'POST', '/shifts', employer, {
        employmentId, jobId, date, startTime: '08:00', endTime: '12:00', isDraft: true,
      }, [201]);
      const shiftId = shift.data.shift?._id;
      if (shiftId) {
        await call('Nhà tuyển dụng: kiểm tra lịch', 'POST', '/shifts/preflight', employer, { shiftIds: [shiftId] });
        await call('Nhà tuyển dụng: công bố ca', 'POST', '/shifts/publish', employer, { shiftIds: [shiftId] });
        await call('Sinh viên: xem ca đã công bố', 'GET', `/shifts/${shiftId}`, student);
        await call('Nhà tuyển dụng: ghi nhận vào ca', 'POST', `/shifts/${shiftId}/attendance/start`, employer, {
          actualTime: `${date}T08:00:00+07:00`, note: 'Kiểm tra demo',
        });
        await call('Nhà tuyển dụng: ghi nhận hết ca', 'POST', `/shifts/${shiftId}/attendance/end`, employer, {
          actualTime: `${date}T12:00:00+07:00`, note: 'Kiểm tra demo',
        });
        await call('Nhà tuyển dụng: duyệt công', 'POST', `/shifts/${shiftId}/approve`, employer, { approvedMinutes: 240 });
        await call('Nhà tuyển dụng: sẵn sàng tính lương', 'POST', `/shifts/${shiftId}/payroll-ready`, employer, {});
        await call('Nhà tuyển dụng: xác nhận thanh toán', 'POST', `/shifts/${shiftId}/pay`, employer, {
          paymentReference: `DEMO-${runId}`,
        });
      }
      const leave = await call('Sinh viên: xin nghỉ', 'POST', '/time-off', student, {
        employmentId, startDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 14 * 86400000).toISOString(), reason: 'Đơn thử nghiệm',
      }, [201]);
      if (leave.data.request?._id) {
        await call('Nhà tuyển dụng: duyệt nghỉ', 'PUT', `/time-off/${leave.data.request._id}/status`, employer, { status: 'approved' });
      }
    }
  }
  await call('Nhà tuyển dụng: tạm dừng tin', 'POST', `/jobs/${jobId}/pause`, employer, {});
  await call('Nhà tuyển dụng: gửi mở lại tin', 'POST', `/jobs/${jobId}/reopen`, employer, {});
  await call('Admin: duyệt lại tin', 'POST', `/admin/jobs/${jobId}/approve`, admin, {});
}

const task = await call('Sinh viên A: đăng việc vặt', 'POST', '/tasks', student, {
  title: `Mua hộ đồ dùng ${runId}`, category: 'di_cho', description: 'Mua hộ một số đồ dùng ở gần trường.',
  reward: 20000, location: 'Đại học FPT Hòa Lạc', phone: '0981234567',
  deadlineDate: new Date(Date.now() + 3 * 86400000).toISOString(),
}, [201]);
const taskId = task.data._id || task.data.id;
if (taskId) {
  await call('Sinh viên A: chặn tự nhận việc', 'POST', `/tasks/${taskId}/accept`, student, {}, [400]);
  await call('Sinh viên B: nhận việc vặt', 'POST', `/tasks/${taskId}/accept`, student2, { assigneePhone: '0977654321' });
  await call('Sinh viên B: gửi hoàn thành', 'POST', `/tasks/${taskId}/submit-completion`, student2, { completionNote: 'Đã hoàn thành' });
  await call('Sinh viên A: xác nhận hoàn thành', 'POST', `/tasks/${taskId}/complete`, student, {});
  await call('Sinh viên B: đánh giá sau việc vặt', 'POST', '/reviews', student2, {
    transactionType: 'task', transactionId: taskId, rating: 5, comment: 'Giao việc rõ ràng và đúng hẹn.',
  }, [201]);
  await call('Sinh viên B: chặn đánh giá trùng', 'POST', '/reviews', student2, {
    transactionType: 'task', transactionId: taskId, rating: 5, comment: 'Đánh giá lặp.',
  }, [409]);
}

if (jobId) {
  const report = await call('Sinh viên: gửi báo cáo tin', 'POST', '/reports', student2, {
    targetType: 'job', targetId: jobId, reason: 'Kiểm tra', content: 'Báo cáo thử nghiệm trong database cô lập.',
  }, [201]);
  if (report.data.report?._id) {
    await call('Admin: xử lý báo cáo', 'POST', `/reports/${report.data.report._id}/resolve`, admin, {
      status: 'resolved', action: 'no_action', resolutionNote: 'Báo cáo thử nghiệm, không có vi phạm.',
    });
  }
}

const blog = await call('Admin: tạo blog', 'POST', '/blogs', admin, {
  title: `Bài thử demo ${runId}`, summary: 'Tóm tắt cho bài viết thử nghiệm.',
  content: 'Nội dung thử nghiệm bài viết.', category: 'kinh_nghiem',
}, [201]);
if (blog.data._id) {
  await call('Admin: sửa blog', 'PUT', `/blogs/${blog.data._id}`, admin, { summary: 'Tóm tắt đã chỉnh sửa.' });
  await call('Người dùng: xem blog', 'GET', `/blogs/${blog.data._id}`);
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${String(result.status).padEnd(7)} ${result.name}${result.error ? ` — ${result.error}` : ''}`);
}
console.log(`TOTAL ${results.filter(r => r.ok).length}/${results.length}`);
if (results.some(r => !r.ok)) process.exitCode = 1;
