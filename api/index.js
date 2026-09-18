import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: "ESDM Backend LIVE ✅", status: "ok", vercel: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, live: true });
});

export default app;