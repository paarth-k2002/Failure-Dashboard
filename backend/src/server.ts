import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import logsRoutes from "./routes/logs.routes";
import { errorHandler } from "./middleware/error.middleware";
import { serverConfig } from "./config/elk.config";

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [serverConfig.frontendUrl, "http://10.13.28.204:3000","http://10.13.28.204:8080","http://localhost:8080"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/logs", logsRoutes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = serverConfig.port;

app.listen(PORT,  () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${serverConfig.nodeEnv}`);
  console.log(`🔗 Frontend URL: ${serverConfig.frontendUrl}`);
});

export default app;