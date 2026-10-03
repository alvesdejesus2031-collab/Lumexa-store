require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const { authenticator } = require("otplib");
const path = require("path");

const app = express();
const db = new Database("lumexa.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  image TEXT DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);`);

const now = () => new Date().toISOString();
const port = Number(process.env.PORT || 3000);
const whatsapp = process.env.WHATSAPP_NUMBER || "244937770994";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("replace-with")) {
  console.error("Set a strong SESSION_SECRET in .env before production.");
  process.exit(1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  referrerPolicy: { policy: "no-referrer" }
}));
app.use(express.json({limit:"100kb"}));
app.use(express.urlencoded({extended:false, limit:"50kb"}));

app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: "." }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000*60*60*8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15*60*1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: {error:"Too many login attempts. Try again later."}
});
const apiLimiter = rateLimit({
  windowMs: 60*1000, max: 120, standardHeaders: true, legacyHeaders: false
});
app.use("/api/", apiLimiter);

const csrfProtection = csrf();

function requireAdmin(req,res,next){
  if (!req.session.adminId) return res.status(401).json({error:"Unauthorized"});
  next();
}
function validateProduct(p){
  return p && typeof p.name==="string" && p.name.trim().length>=1 &&
    typeof p.category==="string" && p.category.trim().length>=1 &&
    Number.isInteger(Number(p.price)) && Number(p.price)>=0;
}
function cleanProduct(p){
  return {
    name:p.name.trim().slice(0,120), category:p.category.trim().slice(0,80),
    description:String(p.description||"").slice(0,1000),
    price:Number(p.price), image:String(p.image||"").slice(0,2000),
    available:p.available ? 1 : 0
  };
}

app.get("/api/csrf", (req,res)=>res.json({csrfToken:req.csrfToken()}));
app.use(csrfProtection);

app.post("/api/login", loginLimiter, async (req,res)=>{
  const {email,password,code} = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE email=?").get(String(email||"").toLowerCase().trim());
  if(!admin || !(await bcrypt.compare(String(password||""), admin.password_hash)))
    return res.status(401).json({error:"Invalid credentials"});
  if(admin.totp_secret){
    if(!code || !authenticator.check(String(code), admin.totp_secret))
      return res.status(401).json({error:"Two-factor authentication required"});
  }
  req.session.regenerate(err=>{
    if(err) return res.status(500).json({error:"Session error"});
    req.session.adminId=admin.id;
    res.json({ok:true});
  });
});
app.post("/api/logout", requireAdmin, (req,res)=>{
  req.session.destroy(()=>res.json({ok:true}));
});
app.get("/api/me",(req,res)=>res.json({admin:!!req.session.adminId}));

app.get("/api/products",(req,res)=>{
  const rows=db.prepare("SELECT id,name,category,description,price,image,available FROM products ORDER BY id DESC").all();
  res.json(rows);
});
app.post("/api/products", requireAdmin,(req,res)=>{
  if(!validateProduct(req.body)) return res.status(400).json({error:"Invalid product"});
  const p=cleanProduct(req.body), t=now();
  const info=db.prepare("INSERT INTO products(name,category,description,price,image,available,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(p.name,p.category,p.description,p.price,p.image,p.available,t,t);
  res.json({id:info.lastInsertRowid});
});
app.put("/api/products/:id", requireAdmin,(req,res)=>{
  if(!validateProduct(req.body)) return res.status(400).json({error:"Invalid product"});
  const p=cleanProduct(req.body);
  db.prepare("UPDATE products SET name=?,category=?,description=?,price=?,image=?,available=?,updated_at=? WHERE id=?")
    .run(p.name,p.category,p.description,p.price,p.image,p.available,now(),Number(req.params.id));
  res.json({ok:true});
});
app.delete("/api/products/:id", requireAdmin,(req,res)=>{
  db.prepare("DELETE FROM products WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
});

app.get("/api/orders", requireAdmin,(req,res)=>{
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all());
});
app.post("/api/orders",(req,res)=>{
  const {customerName,customerPhone,items}=req.body||{};
  if(!customerName || !customerPhone || !Array.isArray(items) || !items.length)
    return res.status(400).json({error:"Incomplete order"});
  const ids=items.map(x=>Number(x.id)).filter(Number.isInteger);
  const placeholders=ids.map(()=>"?").join(",");
  const products=ids.length?db.prepare(`SELECT id,name,price,available FROM products WHERE id IN (${placeholders})`).all(...ids):[];
  let total=0, safeItems=[];
  for(const item of items){
    const p=products.find(x=>x.id===Number(item.id));
    const qty=Math.max(1,Math.min(99,Number(item.qty)||1));
    if(!p || !p.available) return res.status(400).json({error:"A product is unavailable"});
    total += p.price*qty;
    safeItems.push({id:p.id,name:p.name,price:p.price,qty});
  }
  const info=db.prepare("INSERT INTO orders(customer_name,customer_phone,items_json,total,status,created_at) VALUES(?,?,?,?,?,?)")
    .run(String(customerName).slice(0,100),String(customerPhone).slice(0,40),JSON.stringify(safeItems),total,"new",now());
  const lines=safeItems.map(x=>`- ${x.name} x${x.qty}: ${x.price*x.qty} AOA`).join("\\n");
  const msg=`Olá, Lumexa Store! Quero fazer este pedido:\\n\\n${lines}\\n\\nTotal: ${total} AOA\\nNome: ${String(customerName).slice(0,100)}\\nTelefone: ${String(customerPhone).slice(0,40)}\\nPedido #${info.lastInsertRowid}`;
  res.json({ok:true,orderId:info.lastInsertRowid, whatsappUrl:`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`});
});

app.use(express.static(path.join(__dirname,"public"),{
  extensions:["html"], dotfiles:"deny"
}));
app.use((req,res)=>res.status(404).sendFile(path.join(__dirname,"public","index.html")));

app.listen(port,()=>console.log(`Lumexa Store running on port ${port}`));