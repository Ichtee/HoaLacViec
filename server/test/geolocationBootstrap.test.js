import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeLocationBootstrap,
  BOOTSTRAP_OPTIONS,
  DENIED_GUIDANCE_MESSAGE,
  INSECURE_CONTEXT_MESSAGE,
  checkIsSecureContext,
} from '../../client/src/utils/locationBootstrap.js';

function createMockNavigator({
  hasGeolocation = true,
  hasPermissions = true,
  initialPermissionState = 'prompt',
  coords = { latitude: 21.0134, longitude: 105.5263, accuracy: 15 },
  gpsError = null,
} = {}) {
  let getCurrentPositionCallCount = 0;
  let lastOptionsPassed = null;
  let permissionObj = null;

  if (hasPermissions) {
    permissionObj = {
      state: initialPermissionState,
      onchange: null,
    };
  }

  const geolocation = hasGeolocation
    ? {
        getCurrentPosition: (successCb, errorCb, options) => {
          getCurrentPositionCallCount++;
          lastOptionsPassed = options;
          if (gpsError) {
            errorCb(gpsError);
          } else {
            successCb({ coords, timestamp: Date.now() });
          }
        },
      }
    : null;

  const permissions = hasPermissions
    ? {
        query: async ({ name }) => {
          if (name !== 'geolocation') throw new Error('Unsupported permission');
          return permissionObj;
        },
      }
    : null;

  return {
    navigatorObj: { geolocation, permissions },
    permissionObj,
    getCallCount: () => getCurrentPositionCallCount,
    getLastOptions: () => lastOptionsPassed,
  };
}

test('Geolocation Bootstrap & Permission Lifecycle Tests', async (t) => {
  // 1. permission=prompt: getCurrentPosition được gọi đúng một lần khi mount
  await t.test('1. permission=prompt: getCurrentPosition được gọi đúng một lần khi mount', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'prompt' });
    const didRequestRef = { current: false };

    let currentStatus = 'idle';
    let currentCoords = null;

    const result = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { currentStatus = s; },
        onCoordsChange: (c) => { currentCoords = c; },
      },
    });

    assert.equal(result.executed, true);
    assert.equal(mock.getCallCount(), 1, 'getCurrentPosition must be called exactly once');
    assert.equal(currentStatus, 'success');
    assert.deepEqual(currentCoords, { latitude: 21.0134, longitude: 105.5263, accuracy: 15 });

    // Validate options: enableHighAccuracy: true, timeout: 12000, maximumAge: 60000
    assert.deepEqual(mock.getLastOptions(), {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  });

  // 2. React StrictMode không gọi hai lần
  await t.test('2. React StrictMode không gọi hai lần', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'prompt' });
    const didRequestRef = { current: false };

    // Simulate 1st run of useEffect in StrictMode
    const firstRun = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
    });
    assert.equal(firstRun.executed, true);
    assert.equal(mock.getCallCount(), 1);

    // Simulate 2nd run of useEffect in StrictMode (same ref)
    const secondRun = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
    });
    assert.equal(secondRun.executed, false);
    assert.equal(secondRun.reason, 'STRICT_MODE_GUARD');
    assert.equal(mock.getCallCount(), 1, 'Must NOT trigger a 2nd getCurrentPosition call');
  });

  // 3. permission=granted: lấy location âm thầm
  await t.test('3. permission=granted: lấy location âm thầm', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'granted' });
    const didRequestRef = { current: false };

    let currentStatus = 'idle';
    let currentCoords = null;

    const result = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { currentStatus = s; },
        onCoordsChange: (c) => { currentCoords = c; },
      },
    });

    assert.equal(result.executed, true);
    assert.equal(result.status, 'granted');
    assert.equal(mock.getCallCount(), 1);
    assert.equal(currentStatus, 'success');
    assert.notEqual(currentCoords, null);
  });

  // 4. permission=denied: không gọi GPS lặp lại, hiện hướng dẫn
  await t.test('4. permission=denied: không gọi GPS lặp lại, hiện hướng dẫn', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'denied' });
    const didRequestRef = { current: false };

    let currentStatus = 'idle';
    let errorMessage = null;

    const result = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { currentStatus = s; },
        onError: (e) => { errorMessage = e; },
      },
    });

    assert.equal(result.executed, true);
    assert.equal(result.status, 'denied');
    assert.equal(mock.getCallCount(), 0, 'Must NOT call getCurrentPosition when permission is already denied');
    assert.equal(currentStatus, 'denied');
    assert.equal(errorMessage, DENIED_GUIDANCE_MESSAGE);
    assert.ok(errorMessage.includes('Cài đặt trang web → Vị trí → Cho phép'));
  });

  // 5. Insecure context: không gọi GPS
  await t.test('5. insecure context: không gọi GPS', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'prompt' });
    const didRequestRef = { current: false };

    let currentStatus = 'idle';
    let errorMessage = null;

    // Simulate LAN IP HTTP (e.g. http://192.168.1.10:5173)
    const isSecure = checkIsSecureContext({
      isSecureContext: false,
      location: { hostname: '192.168.1.10', protocol: 'http:' },
    });
    assert.equal(isSecure, false);

    const result = await executeLocationBootstrap({
      isSecure,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { currentStatus = s; },
        onError: (e) => { errorMessage = e; },
      },
    });

    assert.equal(result.executed, true);
    assert.equal(result.status, 'insecure');
    assert.equal(mock.getCallCount(), 0, 'Must NEVER invoke GPS in insecure context');
    assert.equal(currentStatus, 'insecure');
    assert.equal(errorMessage, INSECURE_CONTEXT_MESSAGE);

    // Verify localhost is secure
    assert.equal(
      checkIsSecureContext({
        isSecureContext: true,
        location: { hostname: 'localhost', protocol: 'http:' },
      }),
      true
    );
  });

  // 6. Permissions API không hỗ trợ: fallback vẫn hoạt động
  await t.test('6. Permissions API không hỗ trợ: fallback vẫn hoạt động', async () => {
    const mock = createMockNavigator({ hasPermissions: false });
    const didRequestRef = { current: false };

    let currentStatus = 'idle';
    let currentCoords = null;

    const result = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { currentStatus = s; },
        onCoordsChange: (c) => { currentCoords = c; },
      },
    });

    assert.equal(result.executed, true);
    assert.equal(result.status, 'fallback');
    assert.equal(mock.getCallCount(), 1, 'Must invoke getCurrentPosition directly as fallback');
    assert.equal(currentStatus, 'success');
    assert.deepEqual(currentCoords, { latitude: 21.0134, longitude: 105.5263, accuracy: 15 });
  });

  // 7. JobList không tạo request thứ hai
  await t.test('7. JobList không tạo request thứ hai (đọc từ shared state)', async () => {
    // Simulating global LocationContext + JobList consumption
    const mock = createMockNavigator({ initialPermissionState: 'prompt' });
    const bootstrapRef = { current: false };

    let globalCoords = null;
    let globalStatus = 'idle';

    // 1. Root bootstrap executes on app startup
    await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef: bootstrapRef,
      callbacks: {
        onStatusChange: (s) => { globalStatus = s; },
        onCoordsChange: (c) => { globalCoords = c; },
      },
    });

    assert.equal(mock.getCallCount(), 1, 'Bootstrap called GPS once');
    assert.equal(globalStatus, 'success');

    // 2. JobListPage mounts
    // JobListPage only reads from globalContext without calling requestGpsLocation on mount
    function simulateJobListPageMount(context) {
      // Reads existing coordinates directly from context
      const userLocation = context.coords
        ? { lat: context.coords.latitude, lng: context.coords.longitude }
        : null;
      return { userLocation, renderedDistance: Boolean(userLocation) };
    }

    const jobListPageState = simulateJobListPageMount({ coords: globalCoords, status: globalStatus });
    assert.equal(jobListPageState.renderedDistance, true);
    assert.equal(mock.getCallCount(), 1, 'JobListPage mount did NOT trigger a second request');
  });

  // 8. permission onchange cập nhật trạng thái
  await t.test('8. permission onchange cập nhật trạng thái (prompt -> granted, granted -> denied, denied -> prompt)', async () => {
    const mock = createMockNavigator({ initialPermissionState: 'denied' });
    const didRequestRef = { current: false };

    let status = 'idle';
    let coords = null;
    let permState = null;
    let errMsg = null;

    const result = await executeLocationBootstrap({
      isSecure: true,
      navigatorObj: mock.navigatorObj,
      didRequestRef,
      callbacks: {
        onStatusChange: (s) => { status = s; },
        onCoordsChange: (c) => { coords = c; },
        onPermissionChange: (p) => { permState = p; },
        onError: (e) => { errMsg = e; },
      },
    });

    assert.equal(status, 'denied');
    assert.equal(mock.getCallCount(), 0);

    // User changes permission: denied -> prompt (e.g. clicked Reset Permissions in browser)
    mock.permissionObj.state = 'prompt';
    mock.permissionObj.onchange();

    assert.equal(status, 'idle', 'Should transition to idle when permission resets to prompt');
    assert.equal(permState, 'prompt');
    assert.equal(errMsg, null);

    // User changes permission: prompt -> granted
    mock.permissionObj.state = 'granted';
    mock.permissionObj.onchange();

    assert.equal(mock.getCallCount(), 1, 'Must acquire location once granted');
    assert.equal(status, 'success');
    assert.equal(permState, 'granted');
    assert.deepEqual(coords, { latitude: 21.0134, longitude: 105.5263, accuracy: 15 });

    // User changes permission: granted -> denied
    mock.permissionObj.state = 'denied';
    mock.permissionObj.onchange();

    assert.equal(status, 'denied');
    assert.equal(permState, 'denied');
    assert.equal(coords, null, 'Must wipe coords from state on denied');
    assert.equal(errMsg, DENIED_GUIDANCE_MESSAGE);
  });
});
