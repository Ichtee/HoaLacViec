import mongoose from 'mongoose';

export async function connectDB() {
  const primaryUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/hoalacviec';

  let conn = null;

  if (primaryUri) {
    try {
      conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 3500 });
      console.log(`[MongoDB] Connected to Primary: ${conn.connection.host}/${conn.connection.name}`);
    } catch (primaryErr) {
      console.warn(`[MongoDB] Primary connection failed (${primaryErr.message}). Attempting fallback to local MongoDB...`);
    }
  }

  if (!conn) {
    try {
      conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3500 });
      console.log(`[MongoDB] Connected to Local: ${conn.connection.host}/${conn.connection.name}`);
    } catch (localErr) {
      console.error(`[MongoDB] Connection Error: ${localErr.message}`);
      process.exit(1);
    }
  }

  // Auto-migrate location data on startup (idempotent, safe for local and production Atlas)
  try {
    const { runLocationMigration } = await import('../scripts/migrateLocations.js');
    await runLocationMigration({ apply: true });
  } catch (migErr) {
    console.warn('[Migration] Auto-migration on startup skipped or failed:', migErr.message);
  }

  return conn;
}

