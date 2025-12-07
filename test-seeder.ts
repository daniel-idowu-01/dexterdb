import { Seeder } from './src/seeder';
import { config } from 'dotenv';
import { join } from 'path';

config();

async function test() {
  console.log('Testing MongoDB Seeder with Mongoose...\n');

  const seeder = new Seeder({
    dbUrl: process.env.DATABASE_URL!,
    schemaPath: join(__dirname, 'src', 'models'),
    verbose: true,
  });

  try {
    await seeder.initialize();
    
    console.log('\n Available models:');
    const models = seeder.getModels();
    models.forEach((m) => console.log(`  - ${m.name} (${m.fields.length} fields)`));

    console.log('\n Seeding User (20 records)...');
    await seeder.seed('User', 20);

    console.log('\n Seeding Post (50 records)...');
    await seeder.seed('Post', 50);

    console.log('\n All done!');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await seeder.disconnect();
  }
}

test();