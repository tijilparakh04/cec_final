const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const pool = new Pool({ connectionString: String(process.env.DATABASE_URL || "") });



pool.on("error", (err) => {
  console.error("Unexpected DB error", err);
});

module.exports = pool;