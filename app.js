let products = [];
let cart = [];

const fmt = n =>
  new Intl.NumberFormat("pt-AO").format(n) + " AOA";

async function api(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    cache: "no-store"
  });

  const d = await r.json();

  if (!r.ok) {
    throw new Error(d.error || "Erro");
  }

  return d;
}

/* =========================
   CARREGAR PRODUTOS
========================= */

async function load() {
  try {
    products = await api("/api/products");

    // Pré-calcula valores usados frequentemente
    products.forEach(p => {
      p.searchName = String(p.name || "").toLowerCase();
      p.searchCategory = String(p.category || "").toLowerCase();
    });

    cats();
    render();

  } catch (e) {
    console.error("Erro ao carregar produtos:", e);

    document.querySelector("#products").innerHTML =
      "<p>Não é possível carregar os produtos.</p>";
  }
}

/* =========================
   CATEGORIAS
========================= */

function cats() {
  const c = [
    ...new Set(
      products
        .map(p => p.category)
        .filter(Boolean)
    )
  ];

  document.querySelector("#cat").innerHTML =
    '<option value="">Todas as categorias</option>' +
    c.map(x =>
      `<option value="${esc(x)}">${esc(x)}</option>`
    ).join("");
}

/* =========================
   MOSTRAR PRODUTOS
========================= */

function render() {
  const q =
    document.querySelector("#search").value
      .trim()
      .toLowerCase();

  const cat =
    document.querySelector("#cat").value;

  const filtered = products.filter(p =>
    (!cat || p.category === cat) &&
    (!q || p.searchName.includes(q))
  );

  const html = filtered.map(p => `
    <article class="card ${p.available ? "" : "unavailable"}">

      <div class="pic">

        ${
          p.image
            ? `
              <img
                src="${esc(p.image)}"
                alt="${esc(p.name)}"
                loading="lazy"
                decoding="async"
                width="400"
                height="400"
              >
            `
            : "Sem imagem"
        }

      </div>

      <div class="body">

        <span class="badge">
          ${esc(p.category)}
        </span>

        <h3>
          ${esc(p.name)}
        </h3>

        <div>
          ${esc(p.description || "")}
        </div>

        <div class="price">
          ${fmt(p.price)}
        </div>

        ${
          p.available
            ? `
              <button
                type="button"
                onclick="add(${p.id})"
              >
                Adicionar ao pedido
              </button>
            `
            : `
              <span class="badge">
                Indisponível
              </span>
            `
        }

      </div>

    </article>
  `).join("");

  document.querySelector("#products").innerHTML =
    html || "<p>Nenhum produto encontrado.</p>";
}

/* =========================
   SEGURANÇA HTML
========================= */

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}

/* =========================
   CARRINHO
========================= */

function add(id) {
  const product = products.find(p => p.id === id);

  if (!product || !product.available) {
    return;
  }

  const item = cart.find(a => a.id === id);

  if (item) {
    item.qty++;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }

  updateCart();
  toggleCart(true);
}

/* =========================
   ATUALIZAR CARRINHO
========================= */

function updateCart() {
  let total = 0;

  const html = cart.map(x => {
    const p = products.find(p => p.id === x.id);

    if (!p) return "";

    const subtotal = Number(p.price) * x.qty;

    total += subtotal;

    return `
      <div class="cartItem">

        <span>
          ${esc(p.name)} × ${x.qty}
        </span>

        <b>
          ${fmt(subtotal)}
        </b>

      </div>
    `;
  }).join("");

  document.querySelector("#cartItems").innerHTML =
    html || "<p>O carrinho está vazio.</p>";

  document.querySelector("#total").textContent =
    fmt(total);
}

/* =========================
   ABRIR / FECHAR CARRINHO
========================= */

function toggleCart(force) {
  const cartElement =
    document.querySelector("#cart");

  cartElement.classList.toggle(
    "open",
    force ?? !cartElement.classList.contains("open")
  );
}

/* =========================
   PESQUISA
========================= */

let searchTimer;

document.querySelector("#search").addEventListener(
  "input",
  () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      render();
    }, 120);
  }
);

document.querySelector("#cat").addEventListener(
  "change",
  render
);

/* =========================
   PEDIDO WHATSAPP
========================= */

document.querySelector("#orderBtn").onclick =
  async () => {

    try {

      if (!cart.length) {
        throw new Error("Adicione produtos.");
      }

      const customerName =
        document.querySelector("#customerName").value;

      const customerPhone =
        document.querySelector("#customerPhone").value;

      const d = await api(
        "/api/orders",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            customerName,
            customerPhone,
            items: cart
          })
        }
      );

      location.href = d.whatsappUrl;

    } catch (e) {

      alert(e.message);

    }
  };

/* =========================
   ADMINISTRADOR
========================= */

const adminBtn =
  document.querySelector("#adminBtn");

const modal =
  document.querySelector("#modal");

adminBtn.onclick = () => {
  modal.classList.remove("hidden");
};

function closeModal() {
  modal.classList.add("hidden");
}

document.querySelector("#closeModal").onclick =
  closeModal;

/* =========================
   LOGIN
========================= */

document.querySelector("#login").onclick =
  async () => {

    const loginMsg =
      document.querySelector("#loginMsg");

    loginMsg.textContent = "";

    try {

      const t =
        await api("/api/csrf");

      const email =
        document.querySelector("#email").value;

      const password =
        document.querySelector("#password").value;

      const code =
        document.querySelector("#code").value;

      await api(
        "/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "CSRF-Token": t.csrfToken
          },

          body: JSON.stringify({
            email,
            password,
            code
          })
        }
      );

      location.href = "/admin.html";

    } catch (e) {

      loginMsg.textContent =
        e.message;

    }
  };

/* =========================
   INICIAR
========================= */

load();
