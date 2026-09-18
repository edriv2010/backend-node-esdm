
import express from "express"; import cors from "cors"; import dotenv from "dotenv"; import bcrypt from "bcryptjs"; import jwt from "jsonwebtoken"; import fs from "fs";
dotenv.config();
const app=express();
app.use(cors({origin:true, credentials:true, allowedHeaders:["Content-Type","Authorization","ngrok-skip-browser-warning"]}));
app.use(express.json());

const SHEET_ID = process.env.SHEET_ID || "1roBOQObjwmY1PsNBn8PEUQ4Z7nDNKm3DHQ7MP9lmkH4";
const GID_LAPHAR = process.env.GID_LAPHAR || "1891536161";
const EN_LOCAL_GID = process.env.EN_LOCAL_GID || "0";

const DB_PATH="./src/database.json";
function loadDB(){ if(!fs.existsSync(DB_PATH)){ const init={users:[{id:1,username:"admin",password_hash:bcrypt.hashSync("admin123",10),role:"admin",nama:"Administrator"}], petugas:[{id:1,username:"petugas1",password_hash:bcrypt.hashSync("petugas123",10),nama:"Petugas Lapangan 1",nip:"198001012010011001",jabatan:"Monitoring",wilayah:"Sumatera",role:"petugas"},{id:2,username:"petugas2",password_hash:bcrypt.hashSync("petugas123",10),nama:"Petugas Lapangan 2",nip:"198001012010011002",jabatan:"FO",wilayah:"Jawa",role:"petugas"}]}; fs.writeFileSync(DB_PATH,JSON.stringify(init,null,2)); return init;} const d=JSON.parse(fs.readFileSync(DB_PATH,"utf-8")); if(!d.petugas) d.petugas=[]; return d; }
function saveDB(d){ fs.writeFileSync(DB_PATH,JSON.stringify(d,null,2)); }
let db=loadDB();

app.get("/",(req,res)=>res.send(`OK PUSDATIN SHEET ASLI - SHEET_ID:${SHEET_ID} GID:${GID_LAPHAR} EN_LOCAL_GID:${EN_LOCAL_GID} - ${new Date().toISOString()}`));

// AMBIL DARI GOOGLE SHEET ASLI - BUKAN HARDCODE
app.get("/api/contacts", async (req,res)=>{
  try{
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${EN_LOCAL_GID}`;
    const csvUrlLaphar = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_LAPHAR}`;
    const [r1,r2] = await Promise.all([fetch(csvUrl), fetch(csvUrlLaphar)]);
    const csv = await r1.text();
    const csvLaphar = await r2.text();
    res.json({ SHEET_ID, GID_LAPHAR, EN_LOCAL_GID, csvUrl, csvUrlLaphar, csv: csv.slice(0,30000), csvLaphar: csvLaphar.slice(0,30000), source:"GOOGLE_SHEET_ASLI_BUKAN_HARDCODE" });
  }catch(e){ res.status(500).json({error:e.message, source:"SHEET_FETCH_ERROR"}); }
});

app.post("/api/login",(req,res)=>{
  const {username,password}=req.body;
  let user=db.users.find(u=>u.username===username); let from="users";
  if(!user){ user=db.petugas.find(p=>p.username===username); from="petugas"; }
  if(!user) return res.status(401).json({error:"User tidak ditemukan"});
  if(!bcrypt.compareSync(password,user.password_hash)) return res.status(401).json({error:"Password salah"});
  const token=jwt.sign({id:user.id,username:user.username,role:user.role,nama:user.nama,from},process.env.JWT_SECRET||"sheet-asli",{expiresIn:"8h"});
  res.json({token,user:{id:user.id,username:user.username,role:user.role,nama:user.nama,from}});
});
function auth(req,res,next){ const h=req.headers.authorization; if(!h) return res.status(401).json({error:"No token"}); try{ req.user=jwt.verify(h.replace("Bearer ",""),process.env.JWT_SECRET||"sheet-asli"); next(); }catch{ res.status(401).json({error:"Token invalid"}); } }
function adminOnly(req,res,next){ if(req.user.role!=="admin") return res.status(403).json({error:"Admin only"}); next(); }
app.get("/api/petugas",auth,adminOnly,(req,res)=>res.json(db.petugas.map(p=>({id:p.id,username:p.username,nama:p.nama,nip:p.nip,jabatan:p.jabatan,wilayah:p.wilayah,role:p.role}))));
app.post("/api/petugas",auth,adminOnly,(req,res)=>{
  const {username,password,nama,nip,jabatan,wilayah}=req.body;
  if(!username||!password||!nama) return res.status(400).json({error:"Wajib isi"});
  if(db.users.find(u=>u.username===username)||db.petugas.find(p=>p.username===username)) return res.status(400).json({error:"Username sudah ada"});
  const np={id:db.petugas.length?Math.max(...db.petugas.map(p=>p.id))+1:1,username,password_hash:bcrypt.hashSync(password,10),nama,nip:nip||"",jabatan:jabatan||"Petugas",wilayah:wilayah||"",role:"petugas"}; db.petugas.push(np); saveDB(db); res.json({message:"Ditambahkan"});
});
app.delete("/api/petugas/:id",auth,adminOnly,(req,res)=>{ const id=parseInt(req.params.id); const idx=db.petugas.findIndex(x=>x.id===id); if(idx<0) return res.status(404).json({error:"Tidak ditemukan"}); db.petugas.splice(idx,1); saveDB(db); res.json({message:"Dihapus"}); });

app.listen(process.env.PORT||4000,'0.0.0.0',()=>console.log(`Backend SHEET ASLI jalan - SHEET_ID:${SHEET_ID} - GID:${GID_LAPHAR} - EN_LOCAL_GID dari .env - CORS allow ngrok`));
