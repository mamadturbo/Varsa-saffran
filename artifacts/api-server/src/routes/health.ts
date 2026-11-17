import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from '@workspace/db';
import { s3Storage } from '../modules/files/storage';

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
router.get('/readyz',async(_req,res)=>{
  try {
    await pool.query("SELECT 1 FROM store_config WHERE id='main'").then(result=>{if(!result.rowCount)throw new Error('migration_required');});
    await s3Storage().ready();
    res.json({status:'ready'});
  } catch {res.status(503).json({status:'not_ready'});}
});

export default router;
