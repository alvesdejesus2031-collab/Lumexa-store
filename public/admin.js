let products = [];
let currentProducts = [];
let csrfToken = "";
let selectedImage = "";

const SIZE_OPTIONS = {
  shirt: ["S", "M", "L", "XL", "XXL"],
  pants: ["32", "34", "36", "38", "40", "42", "44"],
  shoe: ["38", "39", "40", "41", "42", "43", "44"]
};

const id = (name) => document.getElementById(name);

const elements = {
  formId: id("id"),
  name: id("name"),
  category: id("category"),
  price: id("price"),
  sizeType: id("sizeType"),
  sizesBox: id("sizesBox"),
  sizeOptions: id("sizeOptions"),
  imageFile: id("imageFile"),
  imagePreview: id("imagePreview"),
  description: id("description"),
  available: id("available"),
  save: id("save"),
  clear: id("clear"),
  message: id("message"),
  list: id("list"),
  orders: id("orders"),
  logout: id("logout")
};

async function getCsrf() {
  const response = await fetch("/api/csrf");

  if (!response.ok) {
    throw new Error("Não foi possível obter o token de segurança.");
  }

  const data = await response.json();
  csrfToken = data.csrfToken;

  return csrfToken;
}

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  const headers = {
    ...(options.headers || {})
  };

  if (method !== "GET") {
    if (!csrfToken) {
      await getCsrf();
    }

    headers["Content-Type"] = "application/json";
    headers["CSRF-Token"] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    window.location.href = "/";
    return null;
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Ocorreu um erro."
    );
  }

  return data;
}


/* =========================
   TAMANHOS
========================= */

function renderSizeOptions(selectedSizes = []) {
  const type = elements.sizeType.value;

  elements.sizeOptions.innerHTML = "";

  if (!type || !SIZE_OPTIONS[type]) {
    elements.sizesBox.style.display = "none";
    return;
  }

  elements.sizesBox.style.display = "block";

  SIZE_OPTIONS[type].forEach(size => {
    const label = document.createElement("label");

    label.style.cssText = `
      display:flex;
      align-items:center;
      gap:6px;
      padding:8px 12px;
      border:1px solid #ddd;
      border-radius:10px;
      cursor:pointer;
      background:#fff;
    `;

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = size;
    checkbox.dataset.size = size;

    if (selectedSizes.includes(size)) {
      checkbox.checked = true;
    }

    const text = document.createElement("span");
    text.textContent = size;

    label.appendChild(checkbox);
    label.appendChild(text);

    elements.sizeOptions.appendChild(label);
  });
}

function getSelectedSizes() {
  return [
    ...elements.sizeOptions.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ].map(input => input.value);
}


/* =========================
   IMAGEM
========================= */

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1000;

        let width = image.width;
        let height = image.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height =
              Math.round(
                height * maxSize / width
              );

            width = maxSize;
          } else {
            width =
              Math.round(
                width * maxSize / height
              );

            height = maxSize;
          }
        }

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
          canvas.getContext("2d");

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            0.78
          )
        );
      };

      image.onerror = () => {
        reject(
          new Error(
            "Não foi possível carregar a imagem."
          )
        );
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Não foi possível ler a imagem."
        )
      );
    };

    reader.readAsDataURL(file);
  });
}

elements.imageFile.addEventListener(
  "change",
  async () => {
    const file =
      elements.imageFile.files[0];

    if (!file) {
      return;
    }

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(
          "Escolha um ficheiro de imagem."
        );
      }

      selectedImage =
        await compressImage(file);

      elements.imagePreview.src =
        selectedImage;

      elements.imagePreview.style.display =
        "block";

      elements.message.textContent =
        "Imagem carregada.";
    } catch (error) {
      selectedImage = "";

      elements.imagePreview.src = "";
      elements.imagePreview.style.display =
        "none";

      elements.message.textContent =
        error.message;
    }
  }
);


/* =========================
   TAMANHO
========================= */

elements.sizeType.addEventListener(
  "change",
  () => {
    renderSizeOptions([]);
  }
);


/* =========================
   LIMPAR FORMULÁRIO
========================= */

function clearForm() {
  elements.formId.value = "";
  elements.name.value = "";
  elements.category.value = "";
  elements.price.value = "";
  elements.description.value = "";

  elements.sizeType.value = "";

  renderSizeOptions([]);

  elements.available.checked = true;

  elements.imageFile.value = "";

  selectedImage = "";

  elements.imagePreview.src = "";
  elements.imagePreview.style.display =
    "none";

  elements.message.textContent = "";

  elements.save.textContent =
    "Guardar produto";
}

elements.clear.addEventListener(
  "click",
  clearForm
);


/* =========================
   EDITAR PRODUTO
========================= */

function editProduct(product) {
  elements.formId.value = product.id;
  elements.name.value =
    product.name || "";

  elements.category.value =
    product.category || "";

  elements.price.value =
    product.price ?? "";

  elements.description.value =
    product.description || "";

  elements.available.checked =
    !!product.available;

  elements.sizeType.value =
    product.sizeType || "";

  renderSizeOptions(
    Array.isArray(product.sizes)
      ? product.sizes
      : []
  );

  selectedImage =
    product.image || "";

  if (selectedImage) {
    elements.imagePreview.src =
      selectedImage;

    elements.imagePreview.style.display =
      "block";
  } else {
    elements.imagePreview.src = "";
    elements.imagePreview.style.display =
      "none";
  }

  elements.save.textContent =
    "Atualizar produto";

  elements.message.textContent =
    "Editando produto.";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   APAGAR PRODUTO
========================= */

async function deleteProduct(productId) {
  const product =
    currentProducts.find(
      item =>
        Number(item.id) ===
        Number(productId)
    );

  if (!product) {
    return;
  }

  const confirmed =
    window.confirm(
      `Apagar "${product.name}"?`
    );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      `/api/products/${product.id}`,
      {
        method: "DELETE"
      }
    );

    elements.message.textContent =
      "Produto apagado.";

    await loadProducts();
  } catch (error) {
    elements.message.textContent =
      error.message;
  }
}


/* =========================
   EVENTOS DOS PRODUTOS
========================= */

elements.list.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "button[data-action]"
      );

    if (!button) {
      return;
    }

    const productId =
      Number(button.dataset.id);

    const product =
      currentProducts.find(
        item =>
          Number(item.id) ===
          productId
      );

    if (!product) {
      return;
    }

    if (
      button.dataset.action ===
      "edit"
    ) {
      editProduct(product);
    }

    if (
      button.dataset.action ===
      "delete"
    ) {
      deleteProduct(productId);
    }
  }
);


/* =========================
   GUARDAR PRODUTO
========================= */

elements.save.addEventListener(
  "click",
  async () => {
    try {
      const name =
        elements.name.value.trim();

      const category =
        elements.category.value.trim();

      const price =
        Number(elements.price.value);

      const sizeType =
        elements.sizeType.value;

      const sizes =
        getSelectedSizes();

      if (!name) {
        throw new Error(
          "Digite o nome do produto."
        );
      }

      if (!category) {
        throw new Error(
          "Digite a categoria."
        );
      }

      if (
        !Number.isInteger(price) ||
        price < 0
      ) {
        throw new Error(
          "Digite um preço válido."
        );
      }

      if (
        sizeType &&
        sizes.length === 0
      ) {
        throw new Error(
          "Selecione pelo menos um tamanho."
        );
      }

      const product = {
        name,
        category,
        price,
        description:
          elements.description.value,

        image: selectedImage,

        available:
          elements.available.checked,

        sizeType,
        sizes
      };

      const productId =
        elements.formId.value;

      if (productId) {
        await api(
          `/api/products/${productId}`,
          {
            method: "PUT",
            body: JSON.stringify(product)
          }
        );

        elements.message.textContent =
          "Produto atualizado com sucesso.";
      } else {
        await api(
          "/api/products",
          {
            method: "POST",
            body: JSON.stringify(product)
          }
        );

        elements.message.textContent =
          "Produto criado com sucesso.";
      }

      clearForm();

      await loadProducts();

    } catch (error) {
      elements.message.textContent =
        error.message;
    }
  }
);


/* =========================
   MOSTRAR PRODUTOS
========================= */

function renderProducts() {
  elements.list.innerHTML = "";

  if (!currentProducts.length) {
    elements.list.innerHTML =
      "<p>Nenhum produto cadastrado.</p>";

    return;
  }

  currentProducts.forEach(product => {
    const card =
      document.createElement("article");

    card.className = "panel";

    card.style.cssText = `
      width:100%;
      max-width:420px;
    `;

    if (product.image) {
      const image =
        document.createElement("img");

      image.src = product.image;
      image.alt = product.name;

      image.style.cssText = `
        width:100%;
        height:220px;
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

    const category =
      document.createElement("p");

    category.textContent =
      `Categoria: ${product.category}`;

    card.appendChild(category);

    const price =
      document.createElement("p");

    price.textContent =
      `Preço: ${Number(product.price).toLocaleString("pt-AO")} AOA`;

    card.appendChild(price);

    const availability =
      document.createElement("p");

    availability.textContent =
      product.available
        ? "Disponível"
        : "Indisponível";

    card.appendChild(
      availability
    );

    if (
      product.sizeType &&
      Array.isArray(product.sizes) &&
      product.sizes.length
    ) {
      const sizes =
        document.createElement("p");

      sizes.textContent =
        `Tamanhos: ${product.sizes.join(", ")}`;

      card.appendChild(sizes);
    }

    if (product.description) {
      const description =
        document.createElement("p");

      description.textContent =
        product.description;

      card.appendChild(description);
    }

    const buttons =
      document.createElement("div");

    buttons.style.cssText = `
      display:flex;
      gap:10px;
      margin-top:15px;
      flex-wrap:wrap;
    `;

    const editButton =
      document.createElement("button");

    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.dataset.action = "edit";
    editButton.dataset.id =
      product.id;

    const deleteButton =
      document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Apagar";
    deleteButton.dataset.action =
      "delete";
    deleteButton.dataset.id =
      product.id;

    deleteButton.className =
      "ghost";

    buttons.appendChild(editButton);
    buttons.appendChild(deleteButton);

    card.appendChild(buttons);

    elements.list.appendChild(card);
  });
}


/* =========================
   CARREGAR PRODUTOS
========================= */

async function loadProducts() {
  try {
    const data =
      await api("/api/products");

    if (!data) {
      return;
    }

    products =
      Array.isArray(data)
        ? data
        : [];

    currentProducts = products;

    renderProducts();

  } catch (error) {
    elements.list.innerHTML =
      `<p>${error.message}</p>`;
  }
}


/* =========================
   PEDIDOS
========================= */

function renderOrders(orders) {
  elements.orders.innerHTML = "";

  if (!orders.length) {
    elements.orders.innerHTML =
      "<p>Nenhum pedido recebido.</p>";

    return;
  }

  orders.forEach(order => {
    const box =
      document.createElement("div");

    box.className = "panel";

    box.style.cssText = `
      width:100%;
      margin:12px 0;
    `;

    const title =
      document.createElement("h3");

    title.textContent =
      `Pedido #${order.id}`;

    box.appendChild(title);

    const customer =
      document.createElement("p");

    customer.textContent =
      `Cliente: ${order.customer_name}`;

    box.appendChild(customer);

    const phone =
      document.createElement("p");

    phone.textContent =
      `Telefone: ${order.customer_phone}`;

    box.appendChild(phone);

    const status =
      document.createElement("p");

    status.textContent =
      `Estado: ${order.status}`;

    box.appendChild(status);

    const total =
      document.createElement("p");

    total.textContent =
      `Total: ${Number(order.total).toLocaleString("pt-AO")} AOA`;

    box.appendChild(total);

    let items = [];

    try {
      items =
        JSON.parse(
          order.items_json || "[]"
        );
    } catch {
      items = [];
    }

    if (items.length) {
      const list =
        document.createElement("ul");

      items.forEach(item => {
        const li =
          document.createElement("li");

        let text =
          `${item.name} x${item.qty}`;

        if (item.size) {
          text +=
            ` — Tamanho: ${item.size}`;
        }

        text +=
          ` — ${Number(
            item.price * item.qty
          ).toLocaleString("pt-AO")} AOA`;

        li.textContent = text;

        list.appendChild(li);
      });

      box.appendChild(list);
    }

    elements.orders.appendChild(box);
  });
}

async function loadOrders() {
  try {
    const data =
      await api("/api/orders");

    if (!data) {
      return;
    }

    renderOrders(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (error) {
    elements.orders.innerHTML =
      `<p>${error.message}</p>`;
  }
}


/* =========================
   LOGOUT
========================= */

elements.logout.addEventListener(
  "click",
  async () => {
    try {
      await api(
        "/api/logout",
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      window.location.href = "/";

    } catch (error) {
      elements.message.textContent =
        error.message;
    }
  }
);


/* =========================
   INICIALIZAÇÃO
========================= */

async function init() {
  try {
    await getCsrf();

    await loadProducts();

    await loadOrders();

  } catch (error) {
    elements.message.textContent =
      error.message;
  }
}

init();