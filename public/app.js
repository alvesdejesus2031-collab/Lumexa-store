"use strict";

let products = [];
let cart = [];

/* =========================
   ELEMENTOS DA PÁGINA
========================= */

const productsContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("cat");
const viewProductsButton = document.getElementById("viewProducts");

const cartElement = document.getElementById("cart");
const closeCartButton = document.getElementById("closeCart");
const cartItemsElement = document.getElementById("cartItems");
const totalElement = document.getElementById("total");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const orderButton = document.getElementById("orderBtn");

const adminButton = document.getElementById("adminBtn");
const modal = document.getElementById("modal");
const closeModalButton = document.getElementById("closeModal");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const codeInput = document.getElementById("code");
const loginButton = document.getElementById("login");
const loginMessage = document.getElementById("loginMsg");


/* =========================
   UTILITÁRIOS
========================= */

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} Kz`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
  Pede ao Cloudinary uma versão reduzida da imagem:
  - w_500    -> largura máxima de 500 px
  - c_limit  -> só reduz, nunca aumenta imagens pequenas
  - q_auto   -> qualidade automática (menos peso, boa aparência)
  - f_auto   -> formato mais leve que o telemóvel suportar (WebP, etc.)
  Se o link não for do Cloudinary, devolve o link original.
*/
function smallImage(url, width = 500) {
  if (!url || !String(url).includes("/upload/")) {
    return url;
  }

  return String(url).replace(
    "/upload/",
    `/upload/w_${width},c_limit,q_auto,f_auto/`
  );
}


/* =========================
   CARREGAR PRODUTOS
========================= */

async function loadProducts() {
  try {
    const response = await fetch("/api/products", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Não foi possível carregar os produtos.");
    }

    products = await response.json();

    buildCategories();
    renderProducts();
    renderCart();

  } catch (error) {
    console.error(error);

    productsContainer.innerHTML = `
      <div class="empty">
        <p>Não foi possível carregar os produtos.</p>
      </div>
    `;
  }
}


/* =========================
   CATEGORIAS
========================= */

function buildCategories() {
  const current = categorySelect.value;

  const categories = [
    ...new Set(
      products
        .map(product => String(product.category || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "pt"));

  categorySelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todas as categorias";
  categorySelect.appendChild(allOption);

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  if (categories.includes(current)) {
    categorySelect.value = current;
  }
}


/* =========================
   PRODUTOS
========================= */

function renderProducts() {
  const search = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  const filtered = products.filter(product => {
    const text = [
      product.name,
      product.category,
      product.type,
      product.description
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || text.includes(search);
    const matchesCategory = !category || product.category === category;

    return matchesSearch && matchesCategory;
  });

  productsContainer.innerHTML = "";

  if (!filtered.length) {
    productsContainer.innerHTML = `
      <div class="empty">
        <p>Nenhum produto encontrado.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(product => {
    const card = document.createElement("article");
    card.className = "productCard";

    /* IMAGEM (versão reduzida pelo Cloudinary) */

    if (product.image) {
      const image = document.createElement("img");
      image.src = smallImage(product.image);
      image.alt = product.name;
      image.loading = "lazy";
      card.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "productContent";

    const categoryText = document.createElement("p");
    categoryText.className = "productCategory";
    categoryText.textContent = product.category || "Produto";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.className = "productDescription";
    description.textContent = product.description || "";

    const price = document.createElement("p");
    price.className = "productPrice";
    price.textContent = formatMoney(product.price);

    content.appendChild(categoryText);
    content.appendChild(title);

    if (product.description) {
      content.appendChild(description);
    }

    content.appendChild(price);

    /* TAMANHOS */

    if (
      product.sizeType &&
      Array.isArray(product.sizes) &&
      product.sizes.length
    ) {
      const sizeLabel = document.createElement("label");
      sizeLabel.className = "sizeLabel";
      sizeLabel.textContent = "Tamanho:";

      const sizeSelect = document.createElement("select");
      sizeSelect.className = "productSize";
      sizeSelect.dataset.productId = product.id;

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Escolher tamanho";
      sizeSelect.appendChild(placeholder);

      product.sizes.forEach(size => {
        const option = document.createElement("option");
        option.value = size;
        option.textContent = size;
        sizeSelect.appendChild(option);
      });

      content.appendChild(sizeLabel);
      content.appendChild(sizeSelect);
    }

    /* BOTÃO */

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "addToCart";
    addButton.textContent = product.available
      ? "Adicionar ao pedido"
      : "Indisponível";
    addButton.disabled = !product.available;
    addButton.dataset.productId = product.id;

    content.appendChild(addButton);

    card.appendChild(content);
    productsContainer.appendChild(card);
  });
}


/* =========================
   ADICIONAR AO CARRINHO
========================= */

productsContainer.addEventListener("click", event => {
  const button = event.target.closest(".addToCart");

  if (!button) {
    return;
  }

  const id = Number(button.dataset.productId);
  const product = products.find(item => Number(item.id) === id);

  if (!product) {
    return;
  }

  let size = "";

  if (
    product.sizeType &&
    Array.isArray(product.sizes) &&
    product.sizes.length
  ) {
    const select = productsContainer.querySelector(
      `.productSize[data-product-id="${id}"]`
    );

    size = select ? select.value : "";

    if (!size) {
      alert(`Escolha o tamanho de "${product.name}".`);
      return;
    }
  }

  const existing = cart.find(
    item => Number(item.id) === id && item.size === size
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1,
      size
    });
  }

  renderCart();
  cartElement.classList.add("open");
});


/* =========================
   CARRINHO
========================= */

function renderCart() {
  cartItemsElement.innerHTML = "";

  if (!cart.length) {
    cartItemsElement.innerHTML = `
      <p class="muted">O seu pedido está vazio.</p>
    `;
    totalElement.textContent = "Total: 0 Kz";
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cartItem";

    total += item.price * item.qty;

    const info = document.createElement("div");

    let title = item.name;

    if (item.size) {
      title += ` — ${item.size}`;
    }

    info.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <small>${formatMoney(item.price)} × ${item.qty}</small>
    `;

    const controls = document.createElement("div");
    controls.className = "cartControls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.dataset.action = "minus";
    minus.dataset.index = index;

    const quantity = document.createElement("span");
    quantity.textContent = item.qty;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.dataset.action = "plus";
    plus.dataset.index = index;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.action = "remove";
    remove.dataset.index = index;

    controls.appendChild(minus);
    controls.appendChild(quantity);
    controls.appendChild(plus);
    controls.appendChild(remove);

    row.appendChild(info);
    row.appendChild(controls);

    cartItemsElement.appendChild(row);
  });

  totalElement.textContent = `Total: ${formatMoney(total)}`;
}


/* =========================
   CONTROLOS DO CARRINHO
========================= */

cartItemsElement.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (!cart[index]) {
    return;
  }

  if (action === "plus") {
    cart[index].qty += 1;
  }

  if (action === "minus") {
    cart[index].qty -= 1;

    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
  }

  if (action === "remove") {
    cart.splice(index, 1);
  }

  renderCart();
});


/* =========================
   FECHAR CARRINHO
========================= */

closeCartButton.addEventListener("click", () => {
  cartElement.classList.remove("open");
});


/* =========================
   VER PRODUTOS
========================= */

viewProductsButton.addEventListener("click", () => {
  document.getElementById("products").scrollIntoView({
    behavior: "smooth"
  });
});


/* =========================
   PESQUISA E CATEGORIA
========================= */

searchInput.addEventListener("input", renderProducts);
categorySelect.addEventListener("change", renderProducts);


/* =========================
   ADMIN (janela de login)
========================= */

function openAdminModal() {
  modal.classList.remove("hidden");
  emailInput.focus();
}

function closeAdminModal() {
  modal.classList.add("hidden");
  loginMessage.textContent = "";

  /* Limpa o #admin do endereço */
  if (location.hash === "#admin") {
    history.replaceState(
      null,
      "",
      location.pathname + location.search
    );
  }
}

adminButton.addEventListener("click", openAdminModal);
closeModalButton.addEventListener("click", closeAdminModal);

modal.addEventListener("click", event => {
  if (event.target === modal) {
    closeAdminModal();
  }
});

/*
  O botão "Administrador" fica escondido no HTML.
  O login só abre quando o endereço termina em #admin.
  Exemplo: https://teusite.com/#admin
*/
function checkAdminHash() {
  if (location.hash === "#admin") {
    openAdminModal();
  }
}

window.addEventListener("hashchange", checkAdminHash);


/* =========================
   LOGIN
========================= */

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const code = codeInput.value.trim();

  if (!email) {
    loginMessage.textContent = "Digite o email.";
    return;
  }

  if (!password) {
    loginMessage.textContent = "Digite a senha.";
    return;
  }

  loginButton.disabled = true;
  loginMessage.textContent = "A entrar...";

  try {
    const csrfResponse = await fetch("/api/csrf", {
      credentials: "same-origin"
    });

    const csrfData = await csrfResponse.json();

    if (!csrfResponse.ok || !csrfData.csrfToken) {
      throw new Error("Não foi possível obter o token de segurança.");
    }

    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": csrfData.csrfToken
      },
      credentials: "same-origin",
      body: JSON.stringify({ email, password, code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível entrar.");
    }

    window.location.href = "/admin.html";

  } catch (error) {
    loginMessage.textContent = error.message;

  } finally {
    loginButton.disabled = false;
  }
});


/* =========================
   PEDIDO
========================= */

orderButton.addEventListener("click", async () => {
  if (!cart.length) {
    alert("Adicione pelo menos um produto ao pedido.");
    return;
  }

  const name = customerName.value.trim();
  const phone = customerPhone.value.trim();

  if (!name) {
    alert("Digite o seu nome.");
    customerName.focus();
    return;
  }

  if (!phone) {
    alert("Digite o seu telefone.");
    customerPhone.focus();
    return;
  }

  /* Verificar tamanhos */

  for (const item of cart) {
    const product = products.find(
      p => Number(p.id) === Number(item.id)
    );

    if (
      product &&
      product.sizeType &&
      Array.isArray(product.sizes) &&
      product.sizes.length &&
      !item.size
    ) {
      alert(`Escolha o tamanho de "${product.name}".`);
      return;
    }
  }

  orderButton.disabled = true;
  orderButton.textContent = "A preparar pedido...";

  try {
    /* /api/orders é público no servidor, por isso não envia CSRF */

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        customerName: name,
        customerPhone: phone,
        items: cart.map(item => ({
          id: item.id,
          quantity: item.qty,
          size: item.size || ""
        }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível criar o pedido.");
    }

    /* Só limpa o carrinho depois de o pedido ser criado */

    cart = [];
    renderCart();

    if (data.whatsappUrl) {
      window.open(data.whatsappUrl, "_blank");
    }

  } catch (error) {
    alert(error.message);

  } finally {
    orderButton.disabled = false;
    orderButton.textContent = "Enviar pedido pelo WhatsApp";
  }
});


/* =========================
   INICIAR
========================= */

loadProducts();
checkAdminHash();

