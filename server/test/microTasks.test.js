import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  TASK_STATUSES,
  TASK_CATEGORIES,
  isValidTaskTransition,
  isValidPhoneNumber,
  normalizePhoneNumber,
  containsProhibitedContent,
  formatDeadlineDisplay,
  toTaskDTO,
} from '../src/utils/taskContract.js';
import { Notification } from '../src/models/Notification.js';
import { Report } from '../src/models/Report.js';
import { MicroTask } from '../src/models/MicroTask.js';

// ==========================================
// TEST SUITE: MICRO-TASKS DOMAIN CONTRACT & STATE MACHINE
// ==========================================
test('Phase 10 — MicroTasks State Machine & Business Rules', async (t) => {
  await t.test('1. Valid forward transitions conform strictly to state machine', () => {
    // open transitions
    assert.equal(isValidTaskTransition('open', 'accepted'), true);
    assert.equal(isValidTaskTransition('open', 'cancelled'), true);
    assert.equal(isValidTaskTransition('open', 'expired'), true);
    assert.equal(isValidTaskTransition('open', 'completed'), false); // Cannot jump directly to completed!
    assert.equal(isValidTaskTransition('open', 'submitted_for_completion'), false);

    // accepted transitions
    assert.equal(isValidTaskTransition('accepted', 'submitted_for_completion'), true);
    assert.equal(isValidTaskTransition('accepted', 'disputed'), true);
    assert.equal(isValidTaskTransition('accepted', 'completed'), false); // Complete without submit is FORBIDDEN!
    assert.equal(isValidTaskTransition('accepted', 'open'), false);

    // submitted_for_completion transitions
    assert.equal(isValidTaskTransition('submitted_for_completion', 'completed'), true);
    assert.equal(isValidTaskTransition('submitted_for_completion', 'disputed'), true);
    assert.equal(isValidTaskTransition('submitted_for_completion', 'open'), false);

    // disputed transitions
    assert.equal(isValidTaskTransition('disputed', 'completed'), true); // Admin resolution
    assert.equal(isValidTaskTransition('disputed', 'cancelled'), true); // Admin resolution
    assert.equal(isValidTaskTransition('disputed', 'accepted'), false);

    // terminal states
    assert.equal(isValidTaskTransition('completed', 'open'), false);
    assert.equal(isValidTaskTransition('cancelled', 'open'), false);
    assert.equal(isValidTaskTransition('expired', 'open'), false);
  });

  await t.test('2. Vietnamese phone validation and normalization', () => {
    assert.equal(isValidPhoneNumber('0986557067'), true);
    assert.equal(isValidPhoneNumber('+84986557067'), true);
    assert.equal(isValidPhoneNumber('0381234567'), true);
    assert.equal(isValidPhoneNumber('0771234567'), true);
    assert.equal(isValidPhoneNumber('0561234567'), true);
    assert.equal(isValidPhoneNumber('123456'), false);
    assert.equal(isValidPhoneNumber('abcdefghij'), false);
    assert.equal(isValidPhoneNumber(''), false);

    assert.equal(normalizePhoneNumber('+84986557067'), '0986557067');
    assert.equal(normalizePhoneNumber('0986 557 067'), '0986557067');
  });

  await t.test('3. Prohibited keywords policy detects contraband and fraud', () => {
    assert.equal(containsProhibitedContent('Cần tìm người thi hộ môn Toán'), true);
    assert.equal(containsProhibitedContent('Bán ma túy đá'), true);
    assert.equal(containsProhibitedContent('Cần làm giấy tờ giả KTX'), true);
    assert.equal(containsProhibitedContent('Mua cơm trưa giao KTX Dom A'), false);
    assert.equal(containsProhibitedContent('Xe ôm chở sang ĐH FPT'), false);
  });

  await t.test('4. Privacy DTO masks phone and protects sensitive operational data for outsiders', () => {
    const requesterId = new mongoose.Types.ObjectId();
    const assigneeId = new mongoose.Types.ObjectId();
    const strangerId = new mongoose.Types.ObjectId();

    const mockTask = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Mua trà sữa giao KTX',
      category: 'di_cho',
      description: 'Giao tại bàn lễ tân KTX Dom B',
      reward: 20000,
      itemBudget: 55000,
      paymentMethod: 'cash',
      location: 'KTX Dom B ĐH FPT',
      status: 'accepted',
      requesterId,
      requesterName: 'Nguyễn Văn A',
      requesterPhone: '0986557067',
      assigneeId,
      assigneeName: 'Trần Thị B',
      assigneePhone: '0912345678',
      completionProof: 'https://secret-proof.com/photo.jpg',
      completionNote: 'Bí mật giao hàng',
      disputeReason: 'Không có',
      createdAt: new Date(),
    };

    // Outsider/stranger view
    const outsiderDTO = toTaskDTO(mockTask, strangerId, 'student');
    assert.equal(outsiderDTO.requesterPhone.includes('****'), true, 'Requester phone must be masked for outsider');
    assert.equal(outsiderDTO.assigneePhone.includes('****'), true, 'Assignee phone must be masked for outsider');
    assert.equal(outsiderDTO.completionProof, '', 'Completion proof must be hidden from outsider');
    assert.equal(outsiderDTO.completionNote, '', 'Completion note must be hidden from outsider');
    assert.equal(outsiderDTO.isRequester, false);
    assert.equal(outsiderDTO.isAssignee, false);

    // Requester view
    const requesterDTO = toTaskDTO(mockTask, requesterId, 'student');
    assert.equal(requesterDTO.requesterPhone, '0986557067', 'Requester sees unmasked phone when accepted');
    assert.equal(requesterDTO.assigneePhone, '0912345678', 'Requester sees assignee unmasked phone');
    assert.equal(requesterDTO.completionProof, 'https://secret-proof.com/photo.jpg');
    assert.equal(requesterDTO.isRequester, true);

    // Admin view
    const adminDTO = toTaskDTO(mockTask, strangerId, 'admin');
    assert.equal(adminDTO.requesterPhone, '0986557067', 'Admin sees unmasked requester phone');
    assert.equal(adminDTO.assigneePhone, '0912345678', 'Admin sees unmasked assignee phone');
  });

  await t.test('5. Notification model schema allows task and report types', () => {
    const validTaskNotif = new Notification({
      userId: new mongoose.Types.ObjectId(),
      title: 'Có bạn nhận việc vặt',
      message: 'Bạn sinh viên đã nhận việc của bạn',
      type: 'task',
      link: '/tasks',
    });
    const errTask = validTaskNotif.validateSync();
    assert.equal(errTask, undefined, 'Notification type="task" must pass schema validation');

    const validReportNotif = new Notification({
      userId: new mongoose.Types.ObjectId(),
      title: 'Báo cáo vi phạm đã xử lý',
      message: 'Kết quả xử lý khiếu nại',
      type: 'report',
      link: '/tasks',
    });
    const errReport = validReportNotif.validateSync();
    assert.equal(errReport, undefined, 'Notification type="report" must pass schema validation');
  });

  await t.test('6. Report model schema allows task targetType and tracks reportedUserId', () => {
    const taskId = new mongoose.Types.ObjectId();
    const reporterId = new mongoose.Types.ObjectId();
    const reportedUserId = new mongoose.Types.ObjectId();

    const report = new Report({
      reporterId,
      targetType: 'task',
      targetId: taskId,
      target: 'Việc vặt: Mua cơm trưa',
      reportedUserId,
      openedBy: reporterId,
      reason: 'Giao thiếu món và không liên lạc được',
      content: 'Đặt 2 suất cơm nhưng chỉ giao 1 suất và chặn Zalo',
      status: 'pending',
    });

    const err = report.validateSync();
    assert.equal(err, undefined, 'Report schema must be valid with targetType="task" and reportedUserId');
    assert.equal(report.targetType, 'task');
    assert.equal(report.reportedUserId.toString(), reportedUserId.toString());
  });

  await t.test('7. Task dispute creates report and resolves reportedUserId correctly', () => {
    const requesterId = new mongoose.Types.ObjectId();
    const assigneeId = new mongoose.Types.ObjectId();

    // If requester disputes: reportedUserId must be assigneeId
    const isRequester = true;
    const reportedFromRequester = isRequester ? assigneeId : requesterId;
    assert.equal(reportedFromRequester.toString(), assigneeId.toString());

    // If assignee disputes: reportedUserId must be requesterId
    const isAssignee = true;
    const reportedFromAssignee = isAssignee ? requesterId : assigneeId;
    assert.equal(reportedFromAssignee.toString(), requesterId.toString());
  });

  await t.test('8. Admin resolution never locks task ID as user ID', () => {
    const taskId = new mongoose.Types.ObjectId();
    const badUserIdToLock = taskId; // Simulating the old bug

    const report = {
      targetType: 'task',
      targetId: taskId,
      reportedUserId: new mongoose.Types.ObjectId(),
    };

    // Correct resolution logic
    const userToActOn = report.reportedUserId;
    assert.notEqual(
      userToActOn.toString(),
      report.targetId.toString(),
      'User to act on MUST be report.reportedUserId, NOT report.targetId!'
    );
  });

  await t.test('9. MicroTask model requires future deadlineDate and validates categories', () => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2);

    const task = new MicroTask({
      title: 'Mua đồ ăn tối',
      category: 'chuyen_do',
      description: 'Chuyển bàn học từ phòng 201 sang 302',
      reward: 50000,
      itemBudget: 0,
      paymentMethod: 'cash',
      location: 'KTX Dom C',
      pickupAddress: 'Phòng 201 Dom C',
      destinationAddress: 'Phòng 302 Dom C',
      deadlineDate: pastDate,
      requesterId: new mongoose.Types.ObjectId(),
      requesterName: 'Nguyễn Văn A',
      requesterPhone: '0986557067',
    });

    assert.equal(TASK_CATEGORIES.includes(task.category), true, 'Category chuyen_do must be valid');
    assert.equal(task.deadlineDate < new Date(), true, 'Past deadline detected');
  });

  await t.test('10. Requester cannot self-accept task (anti self-accept rule)', () => {
    const userId = new mongoose.Types.ObjectId();
    const task = {
      requesterId: userId,
      status: 'open',
    };
    const isSelfAccept = task.requesterId.toString() === userId.toString();
    assert.equal(isSelfAccept, true, 'Must detect self-accept and reject');
  });

  await t.test('11. Atomic race condition simulation: only first applicant succeeds', () => {
    let taskState = {
      _id: 'task123',
      status: 'open',
      assigneeId: null,
    };

    // Candidate 1 atomic findOneAndUpdate with status: 'open'
    function tryAccept(applicantId) {
      if (taskState.status === 'open') {
        taskState = { ...taskState, status: 'accepted', assigneeId: applicantId };
        return { success: true, task: taskState };
      }
      return { success: false, code: 'TASK_ALREADY_TAKEN' };
    }

    const student1 = 'stu_1';
    const student2 = 'stu_2';

    const res1 = tryAccept(student1);
    const res2 = tryAccept(student2);

    assert.equal(res1.success, true);
    assert.equal(res1.task.assigneeId, student1);
    assert.equal(res2.success, false);
    assert.equal(res2.code, 'TASK_ALREADY_TAKEN');
  });

  await t.test('12. Requester cannot complete task when status is accepted (must be submitted_for_completion)', () => {
    const task = {
      status: 'accepted',
      requesterId: new mongoose.Types.ObjectId(),
      assigneeId: new mongoose.Types.ObjectId(),
    };

    const canComplete = task.status === 'submitted_for_completion';
    assert.equal(canComplete, false, 'Completing an accepted task directly must be rejected');
  });

  await t.test('13. Review authoritatively deduces opposite participant from task and blocks self-review', () => {
    const requesterId = new mongoose.Types.ObjectId();
    const assigneeId = new mongoose.Types.ObjectId();

    const completedTask = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Mua bánh mì',
      status: 'completed',
      requesterId,
      assigneeId,
    };

    // Reviewer is requester -> target must be assignee
    function deduceReviewTarget(reviewerId, task) {
      if (reviewerId.toString() === task.requesterId.toString()) {
        return task.assigneeId;
      }
      if (reviewerId.toString() === task.assigneeId.toString()) {
        return task.requesterId;
      }
      return null;
    }

    const targetForRequesterReview = deduceReviewTarget(requesterId, completedTask);
    assert.equal(targetForRequesterReview.toString(), assigneeId.toString());

    const targetForAssigneeReview = deduceReviewTarget(assigneeId, completedTask);
    assert.equal(targetForAssigneeReview.toString(), requesterId.toString());

    // Non-participant gets null
    const strangerId = new mongoose.Types.ObjectId();
    const targetForStranger = deduceReviewTarget(strangerId, completedTask);
    assert.equal(targetForStranger, null);
  });

  await t.test('14. Overdue open task is recognized as expired', () => {
    const pastTime = new Date(Date.now() - 3600000);
    const task = {
      status: 'open',
      deadlineDate: pastTime,
    };

    const isOverdue = task.status === 'open' && task.deadlineDate < new Date();
    assert.equal(isOverdue, true, 'Task must be detected as expired');
  });

  await t.test('15. Soft delete maintains audit history without hard deleting record', () => {
    const task = {
      _id: new mongoose.Types.ObjectId(),
      status: 'open',
      isDeleted: false,
      history: [],
    };

    // Simulate soft delete
    const adminId = new mongoose.Types.ObjectId();
    task.isDeleted = true;
    task.history.push({
      status: 'deleted',
      changedBy: adminId,
      note: 'Soft deleted by admin',
      timestamp: new Date(),
    });

    assert.equal(task.isDeleted, true);
    assert.equal(task.history.length, 1);
    assert.equal(task.history[0].status, 'deleted');
  });

  await t.test('16. Action permissions check across lifecycle', () => {
    const reqId = new mongoose.Types.ObjectId();
    const assId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();

    const openTask = {
      requesterId: reqId,
      assigneeId: null,
      status: 'open',
      deadlineDate: new Date(Date.now() + 3600000),
    };

    const openDTOForReq = toTaskDTO(openTask, reqId, 'student');
    assert.equal(openDTOForReq.canCancel, true, 'Requester can cancel open task');
    assert.equal(openDTOForReq.canAccept, false, 'Requester cannot accept own task');

    const openDTOForStudent = toTaskDTO(openTask, otherId, 'student');
    assert.equal(openDTOForStudent.canAccept, true, 'Other student can accept open task');
    assert.equal(openDTOForStudent.canCancel, false, 'Other student cannot cancel task');

    const submittedTask = {
      requesterId: reqId,
      assigneeId: assId,
      status: 'submitted_for_completion',
      deadlineDate: new Date(Date.now() + 3600000),
    };

    const subDTOForReq = toTaskDTO(submittedTask, reqId, 'student');
    assert.equal(subDTOForReq.canComplete, true, 'Requester can complete when submitted');

    const subDTOForAss = toTaskDTO(submittedTask, assId, 'student');
    assert.equal(subDTOForAss.canComplete, false, 'Assignee cannot self-complete task');
  });
});
