import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DB_HOST = process.env.DB_HOST || "10.13.27.212";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "root";
const DB_NAME = process.env.DB_NAME || "automation_reports";

class DBService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }

  async getLatestPassingTestcaseId(params: {
    testcaseName: string;
    sourceSystemName: string;
    sourcePropertyName: string;
    targetSystemName: string;
    targetPropertyName: string;
  }): Promise<string | null> {
    const { testcaseName, sourceSystemName, sourcePropertyName, targetSystemName, targetPropertyName } = params;

    const likePattern = `%[Source System: ${sourceSystemName},Source Property: ${sourcePropertyName}%Target System: ${targetSystemName},Target Property: ${targetPropertyName}%`;

    const sql = `SELECT testcaseId FROM ${DB_NAME}.testcase_results
      WHERE startTime >= (CURRENT_DATE - INTERVAL 30 DAY)
        AND testcaseName = ?
        AND status = 'Pass'
        AND parameters LIKE ?
      ORDER BY id DESC
      LIMIT 1;`;

    const [rows] = await this.pool.execute<any[]>(sql, [testcaseName, likePattern]);

    if (!rows || rows.length === 0) return null;

    return rows[0].testcaseId || null;
  }

  // Close pool (used in tests or shutdown)
  async close() {
    await this.pool.end();
  }
}

export default new DBService();
