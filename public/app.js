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
    throw new Error(
      data.error || `Erro ${response.status}`
    );
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
  updateCart();
}

function cats() {
  const categories = [
    ...new Set(products.map(p => p.category))
  ];

  document.querySelector("#cat").innerHTML =
    '<option value="">Todas as categorias</option>' +
    categories
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");
}

function render() {
  const q =
    document
      .querySelector("#search")
      .value
      .toLowerCase();

  const cat =
    document.querySelector("#cat").value;

  document.querySelector("#products").innerHTML =
    products
      .filter(
        p =>
          (!cat || p.category === cat) &&
          p.name.toLowerCase().includes(q)
      )
      .map(
        p => `
          <article class="card ${
            p.available ? "" : "unavailable"
          }">

            <div class="pic">
              ${
                p.image
                  ? `<img
                      src="${esc(p.image)}"
                      alt="${esc(p.name)}"
                    >`
                  : "Sem imagem"
              }
            </div>

            <div class="body">

              <span class="badge">
                ${esc(p.category)}
              </span>

              <h3>${esc(p.name)}</h3>

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
                      class="addProduct"
                      data-id="${p.id}"
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
        `
      )
      .join("") ||
    "<p>Nenhum produto encontrado.</p>";
}

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
  );
}

function add(id) {
  const product = products.find(
    p => p.id === Number(id)
  );

  if (!product || !product.available) {
    return;
  }

  const item = cart.find(
    x => x.id === Number(id)
  );

  if (item) {
    item.qty++;
  } else {
    cart.push({
      id: Number(id),
      qty: 1
    });
  }

  updateCart();
  toggleCart(true);
}

function updateCart() {
  const cartItemsEl =
    document.querySelector("#cartItems");

  if (!cartItemsEl) {
    return;
  }

  cartItemsEl.innerHTML =
    cart
      .map(item => {
        const product = products.find(
          p => p.id === item.id
        );

        if (!product) {
          return "";
        }

        return `
          <div class="cartItem">

            <span>
              ${esc(product.name)} × ${item.qty}
            </span>

            <b>
              ${fmt(product.price * item.qty)}
            </b>

          </div>
        `;
      })
      .join("") ||
    "<p>O carrinho está vazio.</p>";

  const total = cart.reduce(
    (sum, item) => {
      const product = products.find(
        p => p.id === item.id
      );

      return product
        ? sum + product.price * item.qty
        : sum;
    },
    0
  );

  const totalEl =
    document.querySelector("#total");

  if (totalEl) {
    totalEl.textContent = fmt(total);
  }
}

function toggleCart(force) {
  const cartEl =
    document.querySelector("#cart");

  if (!cartEl) {
    return;
  }

  cartEl.classList.toggle(
    "open",
    force !== undefined
      ? force
      : !cartEl.classList.contains("open")
  );
}

/* PESQUISA */

document
  .querySelector("#search")
  .addEventListener(
    "input",
    render
  );

document
  .querySelector("#cat")
  .addEventListener(
    "change",
    render
  );

/* ADICIONAR PRODUTO */

document
  .querySelector("#products")
  .addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(".addProduct");

      if (!button) {
        return;
      }

      add(
        Number(button.dataset.id)
      );
    }
  );

/* FECHAR CARRINHO */

const cartCloseButton =
  document.querySelector(
    "#closeCart"
  );

if (cartCloseButton) {
  cartCloseButton.addEventListener(
    "click",
    () => {
      toggleCart(false);
    }
  );
}

/* ENVIAR PEDIDO */

document
  .querySelector("#orderBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        if (!cart.length) {
          throw new Error(
            "Adicione produtos ao pedido."
          );
        }

        if (
          !customerNameEl.value.trim()
        ) {
          throw new Error(
            "Digite o seu nome."
          );
        }

        if (
          !customerPhoneEl.value.trim()
        ) {
          throw new Error(
            "Digite o seu telefone."
          );
        }

        const data =
          await api(
            "/api/orders",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                customerName:
                  customerNameEl.value.trim(),

                customerPhone:
                  customerPhoneEl.value.trim(),

                items: cart
              })
            }
          );

        location.href =
          data.whatsappUrl;

      } catch (error) {

        alert(error.message);

      }
    }
  );

/* ABRIR ADMINISTRADOR */

adminBtnEl.addEventListener(
  "click",
  () => {

    modalEl.classList.remove(
      "hidden"
    );

    loginMsgEl.textContent = "";
  }
);

/* FECHAR ADMINISTRADOR PELO X */

const closeModalButton =
  document.querySelector(
    "#closeModal"
  );

if (closeModalButton) {

  closeModalButton.addEventListener(
    "click",
    () => {

      modalEl.classList.add(
        "hidden"
      );

      emailEl.value = "";
      passwordEl.value = "";
      codeEl.value = "";
      loginMsgEl.textContent = "";
    }
  );
}

/* VER PRODUTOS */

const viewProductsButton =
  document.querySelector(
    "#viewProducts"
  );

if (viewProductsButton) {

  viewProductsButton.addEventListener(
    "click",
    () => {

      document
        .querySelector("#products")
        .scrollIntoView({
          behavior: "smooth"
        });
    }
  );
}

/* LOGIN DO ADMINISTRADOR */

loginEl.addEventListener(
  "click",
  async () => {

    loginMsgEl.textContent =
      "A entrar...";

    try {

      const csrfToken =
        await getCsrfToken();

      await api(
        "/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-CSRF-Token":
              csrfToken
          },

          body: JSON.stringify({

            email:
              emailEl.value.trim(),

            password:
              passwordEl.value,

            code:
              codeEl.value.trim()

          })
        }
      );

      location.href =
        "/admin.html";

    } catch (error) {

      loginMsgEl.textContent =
        error.message;

    }
  }
);

/* CARREGAR LOJA */

load().catch(
  error => {
    console.error(error);
  }
);
