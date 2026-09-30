export function normalizeTransactionError(error) {
  if (error?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(error?.message || '')) {
    const unavailable = new Error('Thao tác này cần MongoDB replica set hoặc MongoDB Atlas để bảo đảm dữ liệu nhất quán.');
    unavailable.status = 503;
    unavailable.code = 'TRANSACTION_UNAVAILABLE';
    return unavailable;
  }
  return error;
}
