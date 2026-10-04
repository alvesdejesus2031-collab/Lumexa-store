let products = [];
let cart = [];

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const codeEl = document.getElementById("code");
const loginEl = document.getElementById("login");
const loginMsgEl = document.getElementById("loginMsg");
const modalEl = document.getElementById("modal");
const adminBtnEl = document.getElementById("adminBtn");
const customerNameEl = document.getElementById("customerName");
const customerPhoneEl = document.getElementById("customerPhone");

const fmt = n =>
  new Intl.NumberFormat("pt-AO").format(n) + " AOA";

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin"
  });

  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }

  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status}`);
  }

  return data;
}

async function getCsrfToken() {
  const data = await api("/api/csrf");
  return data.csrfToken;
}

async function load() {
  products = await api("/api/products");
  render();
  cats();
}

function cats() {
  const categories = [...new Set(products.map(p => p.category))];

  document.querySelector("#cat").innerHTML =
    '<option value="">Todas as categorias</option>' +
    categories
      .map(x => `<option value="${esc(x)}">${esc(x)}</option>`)
      .join("");
}

function render() {
  const q = document.querySelector("#search").value.toLowerCase();
  const cat = document.querySelector("#cat").value;

  document.querySelector("#products").innerHTML =
    products
      .filter(
        p =>
          (!cat || p.category === cat) &&
          p.name.toLowerCase().includes(q)
      )
      .map(
        p => `
        <article class="card ${p.available ? "" : "unavailable"}">
          <div class="pic">
            ${
              p.image
                ? `<img src="${esc(p.image)}" alt="">`
                : "Sem imagem"
            }
          </div>

          <div class="body">
            <span class="badge">${esc(p.category)}</span>
            <h3>${esc(p.name)}</h3>
            <div>${esc(p.description)}</div>
            <div class="price">${fmt(p.price)}</div>

            ${
              p.available
                ? `<button onclick="add(${p.id})">Adicionar ao pedido</button>`
                : `<span class="badge">Indisponível</span>`
            }
          </div>
        </article>
      `
      )
      .join("") || "<p>Nenhum produto encontrado.</p>";
}

function esc(s) {
  return String(s).replace(
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

function add(id) {
  const item = cart.find(x => x.id === id);

  if (item) {
    item.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }

  updateCart();
  toggleCart(true);
}

function updateCart() {
  document.querySelector("#cartItems").innerHTML =
    cart
      .map(x => {
        const p = products.find(p => p.id === x.id);

        return `
          <div class="cartItem">
            <span>${esc(p.name)} × ${x.qty}</span>
            <b>${fmt(p.price * x.qty)}</b>
          </div>
        `;
      })
      .join("") || "<p>O carrinho está vazio.</p>";

  const total = cart.reduce(
    (sum, x) =>
      sum + products.find(p => p.id === x.id).price * x.qty,
    0
  );

  document.querySelector("#total").textContent = fmt(total);
}

function toggleCart(force) {
  const cartEl = document.querySelector("#cart");

  cartEl.classList.toggle(
    "open",
    force ?? !cartEl.classList.contains("open")
  );
}

document.querySelector("#search").oninput = render;
document.querySelector("#cat").onchange = render;

document.querySelector("#orderBtn").onclick = async () => {
  try {
    if (!cart.length) {
      throw new Error("Adicione produtos.");
    }

    const data = await api("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerName: customerNameEl.value,
        customerPhone: customerPhoneEl.value,
        items: cart
      })
    });

    location.href = data.whatsappUrl;
  } catch (error) {
    alert(error.message);
  }
};

adminBtnEl.onclick = () => {
  modalEl.classList.remove("hidden");
  loginMsgEl.textContent = "";
};

function closeModal() {
  modalEl.classList.add("hidden");
}

loginEl.onclick = async () => {
  loginMsgEl.textContent = "A entrar...";

  try {
    const csrfToken = await getCsrfToken();

    await api("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({
        email: emailEl.value.trim(),
        password: passwordEl.value,
        code: codeEl.value.trim()
      })
    });

    location.href = "/admin.html";
  } catch (error) {
    loginMsgEl.textContent = error.message;
  }
};

load().catch(error => {
  console.error(error);
});
