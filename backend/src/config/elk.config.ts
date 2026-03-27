import dotenv from "dotenv";

dotenv.config();

export const elkConfig = {
  url: process.env.ELK_URL || "http://10.13.27.30:5601/internal/search/es",
  username: process.env.ELK_USERNAME || "oim_automation",
  password: process.env.ELK_PASSWORD || "password",
  index: process.env.ELK_INDEX || "oim_automation_logs*",
};

export const serverConfig = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};