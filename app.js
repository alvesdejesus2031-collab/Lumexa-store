let products=[],cart=[];
const fmt=n=>new Intl.NumberFormat("pt-AO").format(n)+" AOA";
async function api(url,opt={}){const r=await fetch(url,opt);const d=await r.json();if(!r.ok)throw new Error(d.error||"Erro");return d}
async function load(){products=await api("/api/products");render();cats()}
function cats(){const c=[...new Set(products.map(p=>p.category))];document.querySelector("#cat").innerHTML='<option value="">Todas as categorias</option>'+c.map(x=>`<option>${esc(x)}</option>`).join("")}
function render(){const q=document.querySelector("#search").value.toLowerCase(),cat=document.querySelector("#cat").value;
document.querySelector("#products").innerHTML=products.filter(p=>(!cat||p.category===cat)&&p.name.toLowerCase().includes(q)).map(p=>`<article class="card ${p.available?'':'unavailable'}"><div class="pic">${p.image?`<img src="${esc(p.image)}" alt="">`:"Sem imagem"}</div><div class="body"><span class="badge">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div>${esc(p.description)}</div><div class="price">${fmt(p.price)}</div>${p.available?`<button onclick="add(${p.id})">Adicionar ao pedido</button>`:`<span class="badge">Indisponível</span>`}</div></article>`).join("")||"<p>Nenhum produto encontrado.</p>"}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function add(id){let x=cart.find(a=>a.id===id);if(x)x.qty++;else cart.push({id,qty:1});updateCart();toggleCart(true)}
function updateCart(){document.querySelector("#cartItems").innerHTML=cart.map(x=>{let p=products.find(p=>p.id===x.id);return `<div class="cartItem"><span>${esc(p.name)} × ${x.qty}</span><b>${fmt(p.price*x.qty)}</b></div>`}).join("")||"<p>O carrinho está vazio.</p>";document.querySelector("#total").textContent=fmt(cart.reduce((s,x)=>s+products.find(p=>p.id===x.id).price*x.qty,0))}
function toggleCart(force){document.querySelector("#cart").classList.toggle("open",force??!document.querySelector("#cart").classList.contains("open"))}
document.querySelector("#search").oninput=render;document.querySelector("#cat").onchange=render;document.querySelector("#orderBtn").onclick=async()=>{try{if(!cart.length)throw Error("Adicione produtos.");let d=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerName:customerName.value,customerPhone:customerPhone.value,items:cart})});location.href=d.whatsappUrl}catch(e){alert(e.message)}};
document.querySelector("#adminBtn").onclick=()=>modal.classList.remove("hidden");function closeModal(){modal.classList.add("hidden")}
document.querySelector("#login").onclick=async()=>{try{const t=await api("/api/csrf");await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json","CSRF-Token":t.csrfToken},body:JSON.stringify({email:email.value,password:password.value,code:code.value})});location.href="/admin.html"}catch(e){loginMsg.textContent=e.message}}
load();
