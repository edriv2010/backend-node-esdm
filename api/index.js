import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const app = express();
app.use(cors({origin:"*"}));
app.use(express.json());

const SHEET_ID = process.env.SHEET_ID || "1roBOQObjwmY1PsNBn8PEUQ4Z7nDNKm3DHQ7MP9lmkH4";
const GID_LAPHAR = process.env.GID_LAPHAR || "1891536161";
const EN_LOCAL_GID = process.env.EN_LOCAL_GID || "0";

// DB in-memory untuk Vercel
let db = {
  users: [{id:1, username:"admin", password_hash: bcrypt.hashSync("admin123",10), role:"admin", nama:"Administrator"}],
  petugas: []
};

// Parser CSV yang bener (handle koma di dalam quote)
function parseCSV(csvText){
  const lines = csvText.split("\n").filter(l=>l.trim());
  if(lines.length < 2) return [];
  const header = lines[0].split(",").map(h=>h.trim().toLowerCase());
  return lines.slice(1).map((line, idx)=>{
    // split simple, kalau sheet kamu gak ada koma di dalam cell aman
    const cols = line.split(",").map(c=>c.replace(/^"|"$/g,'').trim());
    const get = (name) => {
      const i = header.indexOf(name);
      return i >=0? cols[i] : "";
    };
    return {
      id: idx+1,
      tanggal: get("tanggal") || cols[0] || "",
      jam: get("jam") || cols[1] || "",
      pos: get("pos") || get("pos pga") || cols[2] || "",
      link: (get("link") || cols[3] || "ICON").toUpperCase(),
      wilayah: get("wilayah") || cols[4] || "",
      kendala: (get("kendala") || cols[5] || "").toUpperCase(),
      durasi: get("durasi") || cols[6] || "0",
      rfo: get("rfo") || get("keterangan") || cols[7] || ""
    };
  }).filter(x=>x.tanggal && x.pos);
}

app.get("/",(req,res)=>res.json({message:"ESDM Backend LIVE ssss ✅", SHEET_ID, GID_LAPHAR, EN_LOCAL_GID}));

app.get("/api/sheet", async (req,res)=>{
  try{
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${EN_LOCAL_GID}`;
    res.json("csvUrl":csvUrl);
	const r = await fetch(csvUrl);
    if(!r.ok) throw new Error("Gagal fetch sheet: "+r.status);
    const csv = await r.text();
    const data = parseCSV(csv);
    res.json(data);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Biar kompatibel sama App.jsx lama yang manggil /api/contacts
app.get("/api/contacts", async (req,res)=>{
  try{
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${EN_LOCAL_GID}`;
    const csvUrlLaphar = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_LAPHAR}`;
    const [r1,r2] = await Promise.all([fetch(csvUrl), fetch(csvUrlLaphar)]);
    const [csv, csvLaphar] = [await r1.text(), await r2.text()];
    res.json({
      data: parseCSV(csv),
      laphar: parseCSV(csvLaphar),
      source: "GOOGLE_SHEET_ASLI"
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/login",(req,res)=>{
  const {username,password}=req.body;
  const user=db.users.find(u=>u.username===username);
  if(!user ||!bcrypt.compareSync(password,user.password_hash)) return res.status(401).json({error:"Login salah"});
  const token=jwt.sign({id:user.id,username:user.username,role:user.role}, process.env.JWT_SECRET||"sheet-asli",{expiresIn:"8h"});
  res.json({token, user});
});

export default app;