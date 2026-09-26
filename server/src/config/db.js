import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hoalacviec';
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Auto-migrate location data on startup (idempotent, safe for local and production Atlas)
    try {
      const { runLocationMigration } = await import('../scripts/migrateLocations.js');
      await runLocationMigration({ apply: true });
    } catch (migErr) {
      console.warn('[Migration] Auto-migration on startup skipped or failed:', migErr.message);
    }
  } catch (error) {
    console.error(`[MongoDB] Connection Error: ${error.message}`);
    process.exit(1);
  }
}

