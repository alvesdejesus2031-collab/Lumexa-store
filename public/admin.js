"use strict";

const SIZE_OPTIONS = {
  shirt: ["S", "M", "L", "XL", "XXL"],
  pants: ["32", "34", "36", "38", "40", "42", "44"],
  shoe: ["38", "39", "40", "41", "42", "43", "44"]
};

let csrfToken = "";
let products = [];
let editingId = null;

const form =
  document.getElementById("productForm");

const productId =
  document.getElementById("productId");

const nameInput =
  document.getElementById("name");

const categoryInput =
  document.getElementById("category");

const typeInput =
  document.getElementById("type");

const priceInput =
  document.getElementById("price");

const descriptionInput =
  document.getElementById("description");

const sizeType =
  document.getElementById("sizeType");

const sizesBox =
  document.getElementById("sizesBox");

const sizeOptions =
  document.getElementById("sizeOptions");

const availableInput =
  document.getElementById("available");

const imageFile =
  document.getElementById("imageFile");

const imageInput =
  document.getElementById("image");

const imagePreview =
  document.getElementById("imagePreview");

const saveBtn =
  document.getElementById("saveBtn");

const clearBtn =
  document.getElementById("clearBtn");

const formTitle =
  document.getElementById("formTitle");

const productsList =
  document.getElementById("productsList");

const ordersList =
  document.getElementById("ordersList");

const logoutBtn =
  document.getElementById("logoutBtn");


/* =========================
   CSRF
========================= */

async function getCsrfToken() {
  const response =
    await fetch("/api/csrf", {
      credentials: "same-origin"
    });

  const data =
    await response.json();

  if (!response.ok || !data.csrfToken) {
    throw new Error(
      "Não foi possível obter o token de segurança."
    );
  }

  csrfToken =
    data.csrfToken;

  return csrfToken;
}


/* =========================
   API
========================= */

async function api(
  url,
  options = {}
) {
  const method =
    (options.method || "GET").toUpperCase();

  const headers = {
    ...(options.headers || {})
  };

  if (
    method !== "GET" &&
    method !== "HEAD"
  ) {
    if (!csrfToken) {
      await getCsrfToken();
    }

    headers["CSRF-Token"] =
      csrfToken;
  }

  const response =
    await fetch(url, {
      ...options,
      headers,
      credentials:
        "same-origin"
    });

  if (
    response.status === 401
  ) {
    window.location.href = "/";
    throw new Error(
      "Sessão expirada."
    );
  }

  let data = {};

  try {
    data =
      await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Ocorreu um erro."
    );
  }

  return data;
}


/* =========================
   TAMANHOS
========================= */

function renderSizeOptions(
  selected = []
) {
  const type =
    sizeType.value;

  sizeOptions.innerHTML =
    "";

  if (!type) {
    sizesBox.classList.add(
      "hidden"
    );

    return;
  }

  sizesBox.classList.remove(
    "hidden"
  );

  const options =
    SIZE_OPTIONS[type] || [];

  options.forEach(size => {
    const label =
      document.createElement(
        "label"
      );

    label.className =
      "sizeCheck";

    const checkbox =
      document.createElement(
        "input"
      );

    checkbox.type =
      "checkbox";

    checkbox.value =
      size;

    checkbox.checked =
      selected.includes(size);

    const span =
      document.createElement(
        "span"
      );

    span.textContent =
      size;

    label.appendChild(
      checkbox
    );

    label.appendChild(
      span
    );

    sizeOptions.appendChild(
      label
    );
  });
}


function getSelectedSizes() {
  return [
    ...sizeOptions.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ].map(
    checkbox =>
      checkbox.value
  );
}


sizeType.addEventListener(
  "change",
  () => {
    renderSizeOptions([]);
  }
);


/* =========================
   IMAGEM
========================= */

function showImagePreview(
  src
) {
  imagePreview.innerHTML =
    "";

  if (!src) {
    return;
  }

  const image =
    document.createElement(
      "img"
    );

  image.src =
    src;

  image.alt =
    "Pré-visualização";

  imagePreview.appendChild(
    image
  );
}


function compressImage(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const image =
          new Image();

        image.onload = () => {
          const maxSize =
            1000;

          let width =
            image.width;

          let height =
            image.height;

          if (
            width >
              maxSize ||
            height >
              maxSize
          ) {
            if (
              width >
              height
            ) {
              height =
                Math.round(
                  height *
                    (maxSize /
                      width)
                );

              width =
                maxSize;
            } else {
              width =
                Math.round(
                  width *
                    (maxSize /
                      height)
                );

              height =
                maxSize;
            }
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            width;

          canvas.height =
            height;

          const ctx =
            canvas.getContext(
              "2d"
            );

          ctx.drawImage(
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

        image.onerror =
          () =>
            reject(
              new Error(
                "Imagem inválida."
              )
            );

        image.src =
          reader.result;
      };

      reader.onerror =
        () =>
          reject(
            new Error(
              "Não foi possível ler a imagem."
            )
          );

      reader.readAsDataURL(
        file
      );
    }
  );
}


imageFile.addEventListener(
  "change",
  async () => {
    const file =
      imageFile.files &&
      imageFile.files[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Escolha uma imagem válida."
      );

      imageFile.value =
        "";

      return;
    }

    try {
      saveBtn.disabled =
        true;

      saveBtn.textContent =
        "A preparar imagem...";

      const compressed =
        await compressImage(
          file
        );

      imageInput.value =
        compressed;

      showImagePreview(
        compressed
      );
    } catch (error) {
      alert(
        error.message
      );
    } finally {
      saveBtn.disabled =
        false;

      saveBtn.textContent =
        editingId
          ? "Atualizar produto"
          : "Guardar produto";
    }
  }
);


/* =========================
   FORMULÁRIO
========================= */

form.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const name =
      nameInput.value.trim();

    const category =
      categoryInput.value.trim();

    const type =
      typeInput.value.trim();

    const price =
      Number(
        priceInput.value
      );

    const description =
      descriptionInput.value.trim();

    const selectedSizes =
      getSelectedSizes();

    if (!name) {
      alert(
        "Digite o nome do produto."
      );

      return;
    }

    if (!category) {
      alert(
        "Digite a categoria."
      );

      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      alert(
        "Digite um preço válido."
      );

      return;
    }

    if (
      sizeType.value &&
      selectedSizes.length === 0
    ) {
      alert(
        "Selecione pelo menos um tamanho."
      );

      return;
    }

    const product = {
      name,

      category,

      type,

      description,

      price,

      image:
        imageInput.value || "",

      available:
        availableInput.checked,

      sizeType:
        sizeType.value,

      sizes:
        selectedSizes
    };

    try {
      saveBtn.disabled =
        true;

      saveBtn.textContent =
        editingId
          ? "A atualizar..."
          : "A guardar...";

      if (editingId) {
        await api(
          `/api/products/${editingId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                product
              )
          }
        );
      } else {
        await api(
          "/api/products",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                product
              )
          }
        );
      }

      alert(
        editingId
          ? "Produto atualizado com sucesso."
          : "Produto guardado com sucesso."
      );

      clearForm();

      await loadProducts();

    } catch (error) {
      alert(
        error.message
      );
    } finally {
      saveBtn.disabled =
        false;

      saveBtn.textContent =
        editingId
          ? "Atualizar produto"
          : "Guardar produto";
    }
  }
);


/* =========================
   LIMPAR FORMULÁRIO
========================= */

function clearForm() {
  editingId =
    null;

  productId.value =
    "";

  nameInput.value =
    "";

  categoryInput.value =
    "";

  typeInput.value =
    "";

  priceInput.value =
    "";

  descriptionInput.value =
    "";

  sizeType.value =
    "";

  availableInput.checked =
    true;

  imageFile.value =
    "";

  imageInput.value =
    "";

  imagePreview.innerHTML =
    "";

  sizesBox.classList.add(
    "hidden"
  );

  sizeOptions.innerHTML =
    "";

  formTitle.textContent =
    "Adicionar produto";

  saveBtn.textContent =
    "Guardar produto";
}


clearBtn.addEventListener(
  "click",
  clearForm
);


/* =========================
   PRODUTOS
========================= */

async function loadProducts() {
  try {
    products =
      await api(
        "/api/products"
      );

    renderProducts();

  } catch (error) {
    productsList.innerHTML =
      `<p class="muted">${escapeHtml(
        error.message
      )}</p>`;
  }
}


function renderProducts() {
  productsList.innerHTML =
    "";

  if (!products.length) {
    productsList.innerHTML =
      `<p class="muted">
        Ainda não existem produtos.
      </p>`;

    return;
  }

  products.forEach(
    product => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "adminCard";

      if (product.image) {
        const image =
          document.createElement(
            "img"
          );

        image.src =
          product.image;

        image.alt =
          product.name;

        image.className =
          "adminProductImage";

        card.appendChild(
          image
        );
      }

      const content =
        document.createElement(
          "div"
        );

      content.className =
        "adminCardContent";

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        product.name;

      const category =
        document.createElement(
          "p"
        );

      category.innerHTML =
        `<strong>Categoria:</strong> ${escapeHtml(
          product.category
        )}`;

      const type =
        document.createElement(
          "p"
        );

      type.innerHTML =
        `<strong>Tipo:</strong> ${escapeHtml(
          product.type || "—"
        )}`;

      const price =
        document.createElement(
          "p"
        );

      price.innerHTML =
        `<strong>Preço:</strong> ${formatMoney(
          product.price
        )}`;

      const availability =
        document.createElement(
          "p"
        );

      availability.innerHTML =
        `<strong>Estado:</strong> ${
          product.available
            ? "Disponível"
            : "Indisponível"
        }`;

      const sizes =
        document.createElement(
          "p"
        );

      if (
        product.sizeType &&
        product.sizes.length
      ) {
        sizes.innerHTML =
          `<strong>Tamanhos:</strong> ${product.sizes
            .map(
              escapeHtml
            )
            .join(", ")}`;
      } else {
        sizes.innerHTML =
          `<strong>Tamanhos:</strong> Sem tamanhos`;
      }

      const buttons =
        document.createElement(
          "div"
        );

      buttons.className =
        "cardActions";

      const editButton =
        document.createElement(
          "button"
        );

      editButton.type =
        "button";

      editButton.textContent =
        "Editar";

      editButton.dataset.action =
        "edit";

      editButton.dataset.id =
        product.id;

      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "danger";

      deleteButton.textContent =
        "Eliminar";

      deleteButton.dataset.action =
        "delete";

      deleteButton.dataset.id =
        product.id;

      buttons.appendChild(
        editButton
      );

      buttons.appendChild(
        deleteButton
      );

      content.appendChild(
        title
      );

      content.appendChild(
        category
      );

      content.appendChild(
        type
      );

      content.appendChild(
        price
      );

      content.appendChild(
        availability
      );

      content.appendChild(
        sizes
      );

      content.appendChild(
        buttons
      );

      card.appendChild(
        content
      );

      productsList.appendChild(
        card
      );
    }
  );
}


/* =========================
   AÇÕES DOS PRODUTOS
========================= */

productsList.addEventListener(
  "click",
  async event => {
    const button =
      event.target.closest(
        "button[data-action]"
      );

    if (!button) {
      return;
    }

    const id =
      Number(
        button.dataset.id
      );

    const product =
      products.find(
        item =>
          Number(item.id) ===
          id
      );

    if (!product) {
      return;
    }

    if (
      button.dataset.action ===
      "edit"
    ) {
      editProduct(
        product
      );

      return;
    }

    if (
      button.dataset.action ===
      "delete"
    ) {
      const confirmed =
        confirm(
          `Eliminar "${product.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await api(
          `/api/products/${id}`,
          {
            method: "DELETE"
          }
        );

        await loadProducts();

      } catch (error) {
        alert(
          error.message
        );
      }
    }
  }
);


/* =========================
   EDITAR
========================= */

function editProduct(
  product
) {
  editingId =
    product.id;

  productId.value =
    product.id;

  nameInput.value =
    product.name || "";

  categoryInput.value =
    product.category || "";

  typeInput.value =
    product.type || "";

  priceInput.value =
    product.price ?? "";

  descriptionInput.value =
    product.description || "";

  availableInput.checked =
    Boolean(
      product.available
    );

  imageInput.value =
    product.image || "";

  sizeType.value =
    product.sizeType || "";

  renderSizeOptions(
    product.sizes || []
  );

  showImagePreview(
    product.image || ""
  );

  formTitle.textContent =
    "Editar produto";

  saveBtn.textContent =
    "Atualizar produto";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   PEDIDOS
========================= */

async function loadOrders() {
  try {
    const orders =
      await api(
        "/api/orders"
      );

    renderOrders(
      orders
    );

  } catch (error) {
    ordersList.innerHTML =
      `<p class="muted">${escapeHtml(
        error.message
      )}</p>`;
  }
}


function renderOrders(
  orders
) {
  ordersList.innerHTML =
    "";

  if (!orders.length) {
    ordersList.innerHTML =
      `<p class="muted">
        Ainda não existem pedidos.
      </p>`;

    return;
  }

  orders.forEach(
    order => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "orderCard";

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        `Pedido #${order.id}`;

      const customer =
        document.createElement(
          "p"
        );

      customer.innerHTML =
        `<strong>Cliente:</strong> ${escapeHtml(
          order.customerName
        )}`;

      const phone =
        document.createElement(
          "p"
        );

      phone.innerHTML =
        `<strong>Telefone:</strong> ${escapeHtml(
          order.customerPhone
        )}`;

      const items =
        document.createElement(
          "div"
        );

      items.className =
        "orderItems";

      (order.items || []).forEach(
        item => {
          const row =
            document.createElement(
              "p"
            );

          let text =
            `${item.name} × ${item.qty}`;

          if (item.size) {
            text +=
              ` — Tamanho: ${item.size}`;
          }

          row.textContent =
            text;

          items.appendChild(
            row
          );
        }
      );

      const total =
        document.createElement(
          "p"
        );

      total.innerHTML =
        `<strong>Total:</strong> ${formatMoney(
          order.total
        )}`;

      const date =
        document.createElement(
          "p"
        );

      date.className =
        "muted";

      date.textContent =
        formatDate(
          order.createdAt
        );

      card.appendChild(
        title
      );

      card.appendChild(
        customer
      );

      card.appendChild(
        phone
      );

      card.appendChild(
        items
      );

      card.appendChild(
        total
      );

      card.appendChild(
        date
      );

      ordersList.appendChild(
        card
      );
    }
  );
}


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
  "click",
  async () => {
    try {
      await api(
        "/api/logout",
        {
          method: "POST"
        }
      );

      window.location.href =
        "/";

    } catch (error) {
      alert(
        error.message
      );
    }
  }
);


/* =========================
   UTILITÁRIOS
========================= */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function formatMoney(
  value
) {
  return `${Number(
    value || 0
  ).toLocaleString(
    "pt-PT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )} Kz`;
}


function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "pt-PT"
  );
}


/* =========================
   INICIALIZAÇÃO
========================= */

async function init() {
  try {
    await getCsrfToken();

    const me =
      await api(
        "/api/me"
      );

    if (!me.loggedIn) {
      window.location.href =
        "/";

      return;
    }

    renderSizeOptions([]);

    await loadProducts();

    await loadOrders();

  } catch (error) {
    console.error(
      error
    );

    alert(
      error.message
    );
  }
}

init();
