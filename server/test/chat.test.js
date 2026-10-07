import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Application } from '../src/models/Application.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { Notification } from '../src/models/Notification.js';
import { toApplicationDTO } from '../src/utils/applicationDto.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-chat';
const { default: app } = await import('../src/app.js');

const studentId = '507f1f77bcf86cd799439061';
const employerId = '507f1f77bcf86cd799439062';
const strangerId = '507f1f77bcf86cd799439063';
const applicationId = '507f1f77bcf86cd799439064';
const convoId = '507f1f77bcf86cd799439065';

test('employer contact details stay hidden until an offer is sent', () => {
  const base = { status: 'screening', studentPhone: '0900', studentEmail: 'a@b.c', studentName: 'A' };
  const hidden = toApplicationDTO(base, 'employer');
  assert.equal(hidden.studentPhone, undefined);
  assert.equal(hidden.studentEmail, undefined);
  assert.equal(hidden.contactHidden, true);
  const shown = toApplicationDTO({ ...base, status: 'offer_sent' }, 'employer');
  assert.equal(shown.studentPhone, '0900');
  assert.equal(shown.contactHidden, undefined);
  assert.equal(toApplicationDTO(base, 'admin').studentPhone, '0900');
});

test('application chat: only the two parties can open, read and send', async (t) => {
  const originals = {
    userFindById: User.findById,
    appFindById: Application.findById,
    cFindOne: Conversation.findOne, cCreate: Conversation.create, cFindById: Conversation.findById, cUpdateOne: Conversation.updateOne,
    mFind: Message.find, mCreate: Message.create, mCount: Message.countDocuments,
    notify: Notification.create,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; Application.findById = originals.appFindById;
    Conversation.findOne = originals.cFindOne; Conversation.create = originals.cCreate;
    Conversation.findById = originals.cFindById; Conversation.updateOne = originals.cUpdateOne;
    Message.find = originals.mFind; Message.create = originals.mCreate; Message.countDocuments = originals.mCount;
    Notification.create = originals.notify;
    await new Promise((resolve) => server.close(resolve));
  });

  const users = {
    [studentId]: { _id: studentId, name: 'Sinh viên', role: 'student', status: 'active', tokenVersion: 0 },
    [employerId]: { _id: employerId, name: 'Chủ quán', role: 'employer', status: 'active', tokenVersion: 0 },
    [strangerId]: { _id: strangerId, name: 'Người lạ', role: 'student', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)] || null;
  Application.findById = () => ({
    populate: () => ({
      lean: async () => ({
        _id: applicationId, studentId, studentName: 'Sinh viên', employerUserId: employerId,
        jobId: { title: 'Pha chế', storeName: 'Quán A' },
      }),
    }),
  });

  let stored = null;
  const convoDoc = () => ({
    _id: convoId, kind: 'application', refId: applicationId, title: 'Ứng tuyển: Pha chế',
    participants: [
      { userId: studentId, name: 'Sinh viên', lastReadAt: new Date(0) },
      { userId: employerId, name: 'Quán A', lastReadAt: new Date(0) },
    ],
    lastMessageAt: null, lastMessagePreview: '', lastSenderId: null,
  });
  Conversation.findOne = async () => stored;
  Conversation.create = async (data) => { stored = { ...convoDoc(), ...data }; return stored; };
  Conversation.findById = async () => stored;
  const updates = [];
  Conversation.updateOne = async (f, u) => { updates.push(u); return {}; };
  Message.countDocuments = async () => 2;
  const messages = [];
  Message.create = async (data) => { const m = { ...data, _id: `m${messages.length}`, createdAt: new Date() }; messages.push(m); return m; };
  Message.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => messages }) }) });
  const notes = [];
  Notification.create = async (n) => { notes.push(n); return n; };

  const call = async (id, path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/chats${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  const open = { kind: 'application', refId: applicationId };
  assert.equal((await call(strangerId, '/open', 'POST', open)).status, 403);
  assert.equal((await call(studentId, '/open', 'POST', { kind: 'application', refId: 'bad' })).status, 400);

  const opened = await call(studentId, '/open', 'POST', open);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.otherName, 'Quán A');
  assert.equal(opened.body.unread, 2);
  assert.equal((await call(employerId, '/open', 'POST', open)).body.otherName, 'Sinh viên');
  assert.equal(stored.participants.length, 2);

  // Non-participants cannot read or write
  assert.equal((await call(strangerId, `/${convoId}/messages`)).status, 404);
  assert.equal((await call(strangerId, `/${convoId}/messages`, 'POST', { body: 'hi' })).status, 404);

  // Validation
  assert.equal((await call(studentId, `/${convoId}/messages`, 'POST', { body: '   ' })).body.code, 'INVALID_MESSAGE');
  assert.equal((await call(studentId, `/${convoId}/messages`, 'POST', { body: 'x'.repeat(1001) })).body.code, 'INVALID_MESSAGE');

  const sent = await call(studentId, `/${convoId}/messages`, 'POST', { body: 'Chào quán, mình rảnh tối nay ạ' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.mine, true);
  assert.equal(String(notes.at(-1).userId), employerId);
  assert.equal(notes.at(-1).link, '/employer/messages');
  assert.ok(updates.some((u) => u.$set?.lastMessagePreview === 'Chào quán, mình rảnh tối nay ạ'));

  const read = await call(employerId, `/${convoId}/messages`);
  assert.equal(read.status, 200);
  assert.equal(read.body.messages.length, 1);
  assert.equal(read.body.messages[0].mine, false);
  assert.ok(updates.some((u) => u.$set?.['participants.$.lastReadAt']), 'reading marks the conversation read');
});
