const app = require('./app');
const db = require('./config/db');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const frontendIndex = path.resolve(__dirname, '../../frontend/dist/index.html');

db.init().then(() => {
  console.log(`Frontend build: ${frontendIndex}`);
  console.log(`Frontend index exists: ${fs.existsSync(frontendIndex)}`);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AccrediGuard AI backend listening on 0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
