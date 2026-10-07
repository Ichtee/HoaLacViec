import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  persistImage, signUploadParams, isImageStorageConfigured, MAX_IMAGE_BYTES,
} from '../src/services/imageStorageService.js';

const PNG = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;
const configure = () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = 'key123';
  process.env.CLOUDINARY_API_SECRET = 'secret456';
};
const unconfigure = () => {
  delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET;
};

test('upload signature sorts params, skips empty values and appends the secret', () => {
  const expected = crypto.createHash('sha1').update('folder=f&public_id=p&timestamp=123secret').digest('hex');
  assert.equal(signUploadParams({ timestamp: 123, public_id: 'p', folder: 'f', empty: '' }, 'secret'), expected);
});

test('without Cloudinary config, valid images keep the legacy data-URI behaviour', async (t) => {
  unconfigure();
  t.after(unconfigure);
  assert.equal(isImageStorageConfigured(), false);
  assert.equal(await persistImage(PNG, { fetchImpl: async () => { throw new Error('no network expected'); } }), PNG);
  assert.equal(await persistImage(''), '');
  assert.equal(await persistImage(undefined), '');
  assert.equal(await persistImage('https://example.com/a.png'), 'https://example.com/a.png');
});

test('images are validated for type and size before any upload', async (t) => {
  configure();
  t.after(unconfigure);
  const never = async () => { throw new Error('must not upload invalid images'); };
  await assert.rejects(persistImage('data:text/html;base64,PGgxPg==', { fetchImpl: never }), { code: 'INVALID_IMAGE' });
  await assert.rejects(persistImage('data:image/svg+xml;base64,PHN2Zz4=', { fetchImpl: never }), { code: 'INVALID_IMAGE' });
  const huge = `data:image/jpeg;base64,${'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8)}`;
  await assert.rejects(persistImage(huge, { fetchImpl: never }), { code: 'IMAGE_TOO_LARGE' });
});

test('configured storage uploads a signed form and stores only the returned URL', async (t) => {
  configure();
  t.after(unconfigure);
  let request = null;
  const fetchImpl = async (url, init) => {
    request = { url, form: init.body };
    return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/hoalacviec/id-cards/abc.png' }) };
  };
  const url = await persistImage(PNG, { folder: 'id-cards', fetchImpl });
  assert.equal(url, 'https://res.cloudinary.com/demo/image/upload/v1/hoalacviec/id-cards/abc.png');
  assert.equal(request.url, 'https://api.cloudinary.com/v1_1/demo/image/upload');

  const form = request.form;
  assert.equal(form.get('api_key'), 'key123');
  assert.equal(form.get('folder'), 'hoalacviec/id-cards');
  assert.match(form.get('public_id'), /^[a-f0-9]{32}$/, 'unguessable 128-bit id');
  assert.equal(form.get('file'), PNG);
  assert.equal(form.get('api_secret'), null, 'the secret never leaves the server');
  const signed = { folder: form.get('folder'), public_id: form.get('public_id'), timestamp: form.get('timestamp') };
  assert.equal(form.get('signature'), signUploadParams(signed, 'secret456'));
});

test('a failed upload surfaces a 502 and never falls back to storing the image in the database', async (t) => {
  configure();
  t.after(unconfigure);
  const failing = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) });
  await assert.rejects(persistImage(PNG, { fetchImpl: failing }), { code: 'IMAGE_UPLOAD_FAILED', status: 502 });
});
