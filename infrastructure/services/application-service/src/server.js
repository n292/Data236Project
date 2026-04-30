require("dotenv").config();
const { startConsumer } = require("./kafka/consumer");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const applicationRoutes = require("./routes/applicationRoutes");

const app = express();

// Ensure uploads directory exists before multer tries to write to it
const uploadsDir = path.join(__dirname, "uploads", "resumes");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.get("/health", (req, res) => {
  res.json({ message: "Application service is running" });
});

app.use("/applications", applicationRoutes);

const PORT = process.env.PORT || 5003;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startConsumer().catch(console.error);