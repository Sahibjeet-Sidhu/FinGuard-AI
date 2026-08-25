require('dotenv').config();
const app = require('./app');
const { initializeSchema } = require('./database/schema');

initializeSchema();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`FinGuard AI server running on http://localhost:${PORT}`);
});
