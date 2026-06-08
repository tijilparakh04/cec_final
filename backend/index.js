require("dotenv").config();
// For admin JWT debugging
if (process.env.ADMIN_JWT_SECRET) {
  console.log('[admin] ADMIN_JWT_SECRET loaded (length):', String(process.env.ADMIN_JWT_SECRET).length);
}
const express = require("express");
const cors    = require("cors");
const routes  = require("./routes");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Allow larger admin edits (facts payload can be big)
app.use(express.json({ limit: '20mb' }));
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`CEC API running on http://localhost:${PORT}`);
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":***@")}`);
});