let products = [];
let cart = [];

const SIZE_LABELS = {
  shirt: "Tamanho",
  pants: "Tamanho",
  shoe: "Tamanho"
};

const SIZE_NAMES = {
  shirt: "Camisa",
  pants: "Calça",
  shoe: "Sapato"
};

const search = document.getElementById("search");
const category = document.getElementById("cat");
const productsContainer =
  document.getElementById("products");

const cartElement =
  document.getElementById("cart");

const cartItems =
  document.getElementById("cartItems");

const totalElement =
  document.getElementById("total");

const customerName =
  document.getElementById("customerName");

const customerPhone =
  document.getElementById("customerPhone");

const orderButton =
  document.getElementById("orderBtn");

const closeCartButton =
  document.getElementById("closeCart");

const viewProductsButton =
  document.getElementById("viewProducts");

const adminButton =
  document.getElementById("adminBtn");

const modal =
  document.getElementById("modal");

const closeModalButton =
  document.getElementById("closeModal");

const loginButton =
  document.getElementById("login");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const codeInput =
  document.getElementById("code");

const loginMessage =
  document.getElementById("loginMsg");


/* =========================
   CARREGAR PRODUTOS
========================= */

async function loadProducts() {
  try {
    const response =
      await fetch("/api/products");

    if (!response.ok) {
      throw new Error(
        "Não foi possível carregar os produtos."
      );
    }

    products =
      await response.json();

    populateCategories();
    renderProducts();

  } catch (error) {
    productsContainer.innerHTML =
      `<p>${error.message}</p>`;
  }
}


/* =========================
   CATEGORIAS
========================= */

function populateCategories() {
  const categories = [
    ...new Set(
      products
        .map(product => product.category)
        .filter(Boolean)
    )
  ];

  category.innerHTML =
    '<option value="">Todas as categorias</option>';

  categories.forEach(item => {
    const option =
      document.createElement("option");

    option.value = item;
    option.textContent = item;

    category.appendChild(option);
  });
}


/* =========================
   FILTRO
========================= */

function getFilteredProducts() {
  const searchText =
    search.value
      .trim()
      .toLowerCase();

  const selectedCategory =
    category.value;

  return products.filter(product => {
    const matchesSearch =
      !searchText ||
      product.name
        .toLowerCase()
        .includes(searchText) ||
      String(product.description || "")
        .toLowerCase()
        .includes(searchText);

    const matchesCategory =
      !selectedCategory ||
      product.category ===
        selectedCategory;

    return (
      product.available &&
      matchesSearch &&
      matchesCategory
    );
  });
}


/* =========================
   TAMANHOS
========================= */

function createSizeSelector(product) {
  if (
    !product.sizeType ||
    !Array.isArray(product.sizes) ||
    !product.sizes.length
  ) {
    return null;
  }

  const wrapper =
    document.createElement("div");

  wrapper.style.cssText = `
    margin-top:12px;
  `;

  const label =
    document.createElement("label");

  label.textContent =
    `${SIZE_NAMES[product.sizeType] || "Produto"} — tamanho:`;

  label.style.cssText = `
    display:block;
    font-weight:600;
    margin-bottom:6px;
  `;

  const select =
    document.createElement("select");

  select.className =
    "product-size";

  select.dataset.productId =
    product.id;

  select.style.cssText = `
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:10px;
    background:white;
  `;

  const firstOption =
    document.createElement("option");

  firstOption.value = "";
  firstOption.textContent =
    "Escolher tamanho";

  select.appendChild(firstOption);

  product.sizes.forEach(size => {
    const option =
      document.createElement("option");

    option.value = size;
    option.textContent = size;

    select.appendChild(option);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  return wrapper;
}


/* =========================
   MOSTRAR PRODUTOS
========================= */

function renderProducts() {
  productsContainer.innerHTML = "";

  const filtered =
    getFilteredProducts();

  if (!filtered.length) {
    productsContainer.innerHTML =
      "<p>Nenhum produto encontrado.</p>";

    return;
  }

  filtered.forEach(product => {
    const card =
      document.createElement("article");

    card.className = "panel";

    if (product.image) {
      const image =
        document.createElement("img");

      image.src = product.image;
      image.alt = product.name;

      image.style.cssText = `
        width:100%;
        height:240px;
        object-fit:cover;
        border-radius:14px;
        margin-bottom:12px;
      `;

      card.appendChild(image);
    }

    const title =
      document.createElement("h3");

    title.textContent =
      product.name;

    card.appendChild(title);

    const categoryText =
      document.createElement("p");

    categoryText.textContent =
      product.category;

    card.appendChild(categoryText);

    if (product.description) {
      const description =
        document.createElement("p");

      description.textContent =
        product.description;

      card.appendChild(description);
    }

    const price =
      document.createElement("strong");

    price.textContent =
      `${Number(product.price).toLocaleString("pt-AO")} AOA`;

    price.style.display = "block";
    price.style.margin = "10px 0";

    card.appendChild(price);

    const sizeSelector =
      createSizeSelector(product);

    if (sizeSelector) {
      card.appendChild(sizeSelector);
    }

    const addButton =
      document.createElement("button");

    addButton.type = "button";
    addButton.textContent =
      "Adicionar ao pedido";

    addButton.dataset.action =
      "add-cart";

    addButton.dataset.id =
      product.id;

    addButton.style.marginTop =
      "12px";

    card.appendChild(addButton);

    productsContainer.appendChild(card);
  });
}


/* =========================
   ADICIONAR AO CARRINHO
========================= */

function addToCart(productId, size) {
  const product =
    products.find(
      item =>
        Number(item.id) ===
        Number(productId)
    );

  if (!product) {
    return;
  }

  const hasSizes =
    product.sizeType &&
    Array.isArray(product.sizes) &&
    product.sizes.length > 0;

  if (hasSizes && !size) {
    alert(
      "Escolha um tamanho antes de adicionar o produto."
    );

    return;
  }

  const existing =
    cart.find(item =>
      Number(item.id) ===
        Number(product.id) &&
      item.size === (size || "")
    );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1,
      size: size || ""
    });
  }

  renderCart();

  cartElement.classList.add("open");
}


/* =========================
   EVENTOS DOS PRODUTOS
========================= */

productsContainer.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        'button[data-action="add-cart"]'
      );

    if (!button) {
      return;
    }

    const productId =
      Number(button.dataset.id);

    const card =
      button.closest(".panel");

    const sizeSelect =
      card
        ? card.querySelector(
            ".product-size"
          )
        : null;

    const size =
      sizeSelect
        ? sizeSelect.value
        : "";

    addToCart(
      productId,
      size
    );
  }
);


/* =========================
   CARRINHO
========================= */

function renderCart() {
  cartItems.innerHTML = "";

  if (!cart.length) {
    cartItems.innerHTML =
      "<p>O seu pedido está vazio.</p>";

    totalElement.textContent =
      "Total: 0 AOA";

    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    const row =
      document.createElement("div");

    row.style.cssText = `
      padding:12px 0;
      border-bottom:1px solid #eee;
    `;

    const name =
      document.createElement("strong");

    let itemName =
      `${item.name} × ${item.qty}`;

    if (item.size) {
      itemName +=
        ` — Tamanho: ${item.size}`;
    }

    name.textContent =
      itemName;

    row.appendChild(name);

    const subtotal =
      item.price * item.qty;

    total += subtotal;

    const price =
      document.createElement("p");

    price.textContent =
      `${Number(subtotal).toLocaleString("pt-AO")} AOA`;

    row.appendChild(price);

    const controls =
      document.createElement("div");

    controls.style.cssText = `
      display:flex;
      gap:8px;
      align-items:center;
    `;

    const minus =
      document.createElement("button");

    minus.type = "button";
    minus.textContent = "−";
    minus.dataset.cartAction =
      "minus";
    minus.dataset.index = index;

    const quantity =
      document.createElement("span");

    quantity.textContent =
      String(item.qty);

    const plus =
      document.createElement("button");

    plus.type = "button";
    plus.textContent = "+";
    plus.dataset.cartAction =
      "plus";
    plus.dataset.index = index;

    const remove =
      document.createElement("button");

    remove.type = "button";
    remove.textContent =
      "Remover";
    remove.dataset.cartAction =
      "remove";
    remove.dataset.index = index;

    remove.className =
      "ghost";

    controls.appendChild(minus);
    controls.appendChild(quantity);
    controls.appendChild(plus);
    controls.appendChild(remove);

    row.appendChild(controls);

    cartItems.appendChild(row);
  });

  totalElement.textContent =
    `Total: ${Number(total).toLocaleString("pt-AO")} AOA`;
}


/* =========================
   CONTROLOS DO CARRINHO
========================= */

cartItems.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "button[data-cart-action]"
      );

    if (!button) {
      return;
    }

    const index =
      Number(button.dataset.index);

    if (!cart[index]) {
      return;
    }

    const action =
      button.dataset.cartAction;

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
  }
);


/* =========================
   FECHAR CARRINHO
========================= */

closeCartButton.addEventListener(
  "click",
  () => {
    cartElement.classList.remove(
      "open"
    );
  }
);


/* =========================
   VER PRODUTOS
========================= */

viewProductsButton.addEventListener(
  "click",
  () => {
    document
      .getElementById("products")
      .scrollIntoView({
        behavior: "smooth"
      });
  }
);


/* =========================
   PESQUISA / CATEGORIA
========================= */

search.addEventListener(
  "input",
  renderProducts
);

category.addEventListener(
  "change",
  renderProducts
);


/* =========================
   ADMIN
========================= */

adminButton.addEventListener(
  "click",
  () => {
    modal.classList.remove("hidden");

    emailInput.focus();
  }
);

closeModalButton.addEventListener(
  "click",
  () => {
    modal.classList.add("hidden");
  }
);

modal.addEventListener(
  "click",
  event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  }
);


/* =========================
   LOGIN ADMIN
========================= */

loginButton.addEventListener(
  "click",
  async () => {
    loginMessage.textContent =
      "A entrar...";

    try {
      const csrfResponse =
        await fetch("/api/csrf");

      const csrfData =
        await csrfResponse.json();

      const response =
        await fetch("/api/login", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "CSRF-Token":
              csrfData.csrfToken
          },

          body: JSON.stringify({
            email:
              emailInput.value,

            password:
              passwordInput.value,

            code:
              codeInput.value
          })
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Não foi possível entrar."
        );
      }

      window.location.href =
        "/admin.html";

    } catch (error) {
      loginMessage.textContent =
        error.message;
    }
  }
);


/* =========================
   ENTER NO LOGIN
========================= */

[
  emailInput,
  passwordInput,
  codeInput
].forEach(input => {
  input.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        loginButton.click();
      }
    }
  );
});


/* =========================
   ENVIAR PEDIDO
========================= */

orderButton.addEventListener(
  "click",
  async () => {
    if (!cart.length) {
      alert(
        "Adicione pelo menos um produto."
      );
      return;
    }

    const name =
      customerName.value.trim();

    const phone =
      customerPhone.value.trim();

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

    const invalidSize =
      cart.find(item => {
        const product =
          products.find(
            p =>
              Number(p.id) ===
              Number(item.id)
          );

        return (
          product &&
          product.sizeType &&
          Array.isArray(product.sizes) &&
          product.sizes.length &&
          !item.size
        );
      });

    if (invalidSize) {
      alert(
        `Escolha o tamanho de "${invalidSize.name}".`
      );
      return;
    }

    orderButton.disabled = true;
    orderButton.textContent =
      "A preparar pedido...";

    try {
      /* Obter token CSRF */
      const csrfResponse =
        await fetch("/api/csrf");

      if (!csrfResponse.ok) {
        throw new Error(
          "Não foi possível obter o token de segurança."
        );
      }

      const csrfData =
        await csrfResponse.json();

      /* Criar pedido */
      const response =
        await fetch("/api/orders", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "CSRF-Token":
              csrfData.csrfToken
          },

          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,

            items: cart.map(item => ({
              id: item.id,
              qty: item.qty,
              size: item.size || ""
            }))
          })
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Não foi possível criar o pedido."
        );
      }

      cart = [];

      renderCart();

      window.open(
        data.whatsappUrl,
        "_blank"
      );

    } catch (error) {
      alert(error.message);

    } finally {
      orderButton.disabled = false;

      orderButton.textContent =
        "Enviar pedido pelo WhatsApp";
    }
  }
);
