const { sequelize } = require('../src/config/database');
const path = require('path');
const fs = require('fs');

const runSeeders = async () => {
    try {
        console.log('🌱 Running seeders...');
        
        const seedersPath = path.join(__dirname, '../src/database/seeders');
        const files = fs.readdirSync(seedersPath).sort();
        
        for (const file of files) {
            console.log(`📄 Running seeder: ${file}`);
            const seeder = require(path.join(seedersPath, file));
            await seeder.up(sequelize.getQueryInterface(), sequelize);
        }
        
        console.log('✅ Seeders completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeder failed:', error);
        process.exit(1);
    }
};

runSeeders();