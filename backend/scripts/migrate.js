const { sequelize } = require('../src/config/database');
const path = require('path');
const fs = require('fs');

const runMigrations = async () => {
    try {
        console.log('🔄 Running migrations...');
        
        // Get all migration files
        const migrationsPath = path.join(__dirname, '../src/database/migrations');
        const files = fs.readdirSync(migrationsPath).sort();
        
        for (const file of files) {
            console.log(`📄 Running migration: ${file}`);
            const migration = require(path.join(migrationsPath, file));
            await migration.up(sequelize.getQueryInterface(), sequelize);
        }
        
        console.log('✅ Migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

const rollbackMigrations = async () => {
    try {
        console.log('🔄 Rolling back migrations...');
        
        const migrationsPath = path.join(__dirname, '../src/database/migrations');
        const files = fs.readdirSync(migrationsPath).sort().reverse();
        
        for (const file of files) {
            console.log(`📄 Rolling back: ${file}`);
            const migration = require(path.join(migrationsPath, file));
            await migration.down(sequelize.getQueryInterface(), sequelize);
        }
        
        console.log('✅ Rollback completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        process.exit(1);
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--rollback')) {
    rollbackMigrations();
} else {
    runMigrations();
}