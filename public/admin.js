// ======================================================
// LUMEXA STORE — ADMIN.JS
// ======================================================

const SIZE_OPTIONS = {
  "": [],
  shirt: ["S", "M", "L", "XL", "XXL"],
  pants: ["32", "34", "36", "38", "40", "42", "44"],
  shoe: ["38", "39", "40", "41", "42", "43", "44"]
};

let csrfToken = "";
let editingProductId = null;

// ======================================================
// SEGURANÇA / API
// ======================================================

async function getCsrfToken() {
  const response = await fetch("/api/csrf", {
    method: "GET",
    credentials: "same-origin"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Não foi possível obter o token de segurança."
    );
  }

  csrfToken = data.csrfToken;
  return csrfToken;
}

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  const headers = {
    ...(options.headers || {})
  };

  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    headers["CSRF-Token"] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin"
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = "/";
    return null;
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Ocorreu um erro."
    );
  }

  return data;
}

// ======================================================
// AUXILIARES
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("pt-AO")} Kz`;
}

// ======================================================
// TAMANHOS
// ======================================================

function renderSizeOptions(selectedSizes = []) {
  const sizeType = document.getElementById("sizeType");
  const sizesBox = document.getElementById("sizesBox");
  const sizeOptions = document.getElementById("sizeOptions");

  if (!sizeType || !sizesBox || !sizeOptions) {
    return;
  }

  const type = sizeType.value;
  const sizes = SIZE_OPTIONS[type] || [];

  sizeOptions.innerHTML = "";

  if (!sizes.length) {
    sizesBox.classList.add("hidden");
    return;
  }

  sizesBox.classList.remove("hidden");

  sizes.forEach((size) => {
    const label = document.createElement("label");
    label.className = "sizeOption";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = size;
    checkbox.checked = selectedSizes.includes(size);

    label.appendChild(checkbox);

    const text = document.createElement("span");
    text.textContent = size;

    label.appendChild(text);
    sizeOptions.appendChild(label);
  });
}

function getSelectedSizes() {
  const checkboxes = document.querySelectorAll(
    "#sizeOptions input[type='checkbox']:checked"
  );

  return Array.from(checkboxes)
    .map((checkbox) => checkbox.value);
}

// ======================================================
// IMAGEM
// ======================================================

function showImagePreview(image) {
  const preview = document.getElementById("imagePreview");
  const imageInput = document.getElementById("image");

  if (!preview) {
    return;
  }

  preview.innerHTML = "";

  if (!image) {
    if (imageInput) {
      imageInput.value = "";
    }

    return;
  }

  if (imageInput) {
    imageInput.value = image;
  }

  const img = document.createElement("img");

  img.src = image;
  img.alt = "Pré-visualização do produto";

  img.style.maxWidth = "250px";
  img.style.maxHeight = "250px";
  img.style.objectFit = "contain";

  preview.appendChild(img);
}


/*
========================================================
COMPRESSÃO DAS IMAGENS
========================================================

- Máximo de 1000px
- WebP quando disponível
- Qualidade 72%
- Compressão adicional se ficar pesada
*/

function compressImage(file) {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const img = new Image();

      img.onload = () => {

        const maxSize = 1000;

        let width = img.width;
        let height = img.height;

        // Reduz imagens muito grandes
        if (width > maxSize || height > maxSize) {

          const ratio = Math.min(
            maxSize / width,
            maxSize / height
          );

          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "Não foi possível processar a imagem."
            )
          );
          return;
        }

        context.drawImage(
          img,
          0,
          0,
          width,
          height
        );

        // Tenta WebP primeiro
        let result = canvas.toDataURL(
          "image/webp",
          0.72
        );

        // Se não suportar WebP, usa JPEG
        if (!result.startsWith("data:image/webp")) {

          result = canvas.toDataURL(
            "image/jpeg",
            0.72
          );
        }

        // Se estiver muito grande
        if (result.length > 450000) {

          const format =
            result.startsWith("data:image/webp")
              ? "image/webp"
              : "image/jpeg";

          result = canvas.toDataURL(
            format,
            0.58
          );
        }

        // Última redução
        if (result.length > 350000) {

          const format =
            result.startsWith("data:image/webp")
              ? "image/webp"
              : "image/jpeg";

          result = canvas.toDataURL(
            format,
            0.45
          );
        }

        console.log(
          "Imagem original:",
          Math.round(file.size / 1024),
          "KB"
        );

        console.log(
          "Imagem comprimida:",
          Math.round(
            (result.length * 0.75) / 1024
          ),
          "KB"
        );

        resolve(result);
      };

      img.onerror = () => {
        reject(
          new Error(
            "Não foi possível processar a imagem."
          )
        );
      };

      img.src = reader.result;
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

async function handleImageChange(event) {

  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {

    alert(
      "Selecione uma imagem válida."
    );

    event.target.value = "";
    return;
  }

  try {

    const image = await compressImage(file);

    showImagePreview(image);

  } catch (error) {

    console.error(error);

    alert(
      "Não foi possível carregar a imagem."
    );
  }
}

// ======================================================
// LIMPAR FORMULÁRIO
// ======================================================

function clearForm() {

  const form = document.getElementById("productForm");

  if (form) {
    form.reset();
  }

  editingProductId = null;

  const productId =
    document.getElementById("productId");

  if (productId) {
    productId.value = "";
  }

  const available =
    document.getElementById("available");

  if (available) {
    available.checked = true;
  }

  const image =
    document.getElementById("image");

  if (image) {
    image.value = "";
  }

  const imageFile =
    document.getElementById("imageFile");

  if (imageFile) {
    imageFile.value = "";
  }

  const formTitle =
    document.getElementById("formTitle");

  if (formTitle) {
    formTitle.textContent =
      "Adicionar produto";
  }

  const saveBtn =
    document.getElementById("saveBtn");

  if (saveBtn) {
    saveBtn.textContent =
      "Guardar produto";
  }

  showImagePreview("");

  renderSizeOptions([]);
}

// ======================================================
// GUARDAR PRODUTO
// ======================================================

async function saveProduct(event) {

  event.preventDefault();

  const name =
    document.getElementById("name")?.value.trim();

  const category =
    document.getElementById("category")?.value.trim();

  const type =
    document.getElementById("type")?.value.trim() || "";

  const priceValue =
    document.getElementById("price")?.value;

  const description =
    document.getElementById("description")?.value.trim() || "";

  const image =
    document.getElementById("image")?.value || "";

  const available =
    document.getElementById("available")?.checked ?? true;

  const sizeType =
    document.getElementById("sizeType")?.value || "";

  const sizes =
    getSelectedSizes();

  if (!name) {
    alert("Digite o nome do produto.");
    document.getElementById("name")?.focus();
    return;
  }

  if (!category) {
    alert("Digite a categoria do produto.");
    document.getElementById("category")?.focus();
    return;
  }

  if (
    priceValue === "" ||
    priceValue === null ||
    priceValue === undefined ||
    !Number.isFinite(Number(priceValue)) ||
    Number(priceValue) < 0
  ) {
    alert("Digite um preço válido.");
    document.getElementById("price")?.focus();
    return;
  }

  if (sizeType && sizes.length === 0) {
    alert("Selecione pelo menos um tamanho.");
    return;
  }

  const payload = {
    name,
    category,
    type,
    price: Number(priceValue),
    description,
    image,
    available,
    sizeType,
    sizes
  };

  try {

    const id =
      editingProductId ||
      document.getElementById("productId")?.value;

    let result;

    if (id) {

      result = await api(
        `/api/products/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

    } else {

      result = await api(
        "/api/products",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
    }

    if (!result) {
      return;
    }

    alert(
      id
        ? "Produto atualizado com sucesso!"
        : "Produto guardado com sucesso!"
    );

    clearForm();

    await getCsrfToken();
    await loadProducts();

  } catch (error) {

    console.error(
      "Erro ao guardar produto:",
      error
    );

    alert(
      error.message ||
      "Não foi possível guardar o produto."
    );
  }
}

// ======================================================
// CARREGAR PRODUTOS
// ======================================================

async function loadProducts() {

  const container =
    document.getElementById("productsList");

  if (!container) {
    return;
  }

  try {

    const data =
      await api("/api/products");

    if (!Array.isArray(data)) {
      throw new Error(
        "Formato de produtos inválido."
      );
    }

    if (data.length === 0) {

      container.innerHTML = `
        <p class="muted">
          Ainda não existem produtos.
        </p>
      `;

      return;
    }

    container.innerHTML =
      data.map((product) => {

        const sizes =
          Array.isArray(product.sizes)
            ? product.sizes
            : [];

        return `
          <article
            class="adminCard"
            data-id="${product.id}"
          >

            ${
              product.image
                ? `
                  <img
                    src="${escapeHtml(product.image)}"
                    alt="${escapeHtml(product.name)}"
                    class="adminProductImage"
                  >
                `
                : ""
            }

            <div class="adminCardContent">

              <h3>
                ${escapeHtml(product.name)}
              </h3>

              <p>
                <strong>
                  ${formatMoney(product.price)}
                </strong>
              </p>

              <p>
                Categoria:
                ${escapeHtml(product.category)}
              </p>

              ${
                product.type
                  ? `
                    <p>
                      Tipo:
                      ${escapeHtml(product.type)}
                    </p>
                  `
                  : ""
              }

              ${
                product.description
                  ? `
                    <p>
                      ${escapeHtml(product.description)}
                    </p>
                  `
                  : ""
              }

              <p>
                Estado:
                ${
                  product.available
                    ? "Disponível"
                    : "Indisponível"
                }
              </p>

              ${
                product.sizeType
                  ? `
                    <p>
                      Tamanhos:
                      ${
                        sizes
                          .map(escapeHtml)
                          .join(", ")
                      }
                    </p>
                  `
                  : `
                    <p>
                      Sem tamanhos
                    </p>
                  `
              }

              <div class="formActions">

                <button
                  type="button"
                  class="editProductBtn"
                  data-id="${product.id}"
                >
                  Editar
                </button>

                <button
                  type="button"
                  class="deleteProductBtn"
                  data-id="${product.id}"
                >
                  Eliminar
                </button>

              </div>

            </div>

          </article>
        `;

      }).join("");

  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );

    container.innerHTML = `
      <p>
        Não foi possível carregar os produtos.
      </p>
    `;
  }
}

// ======================================================
// EDITAR PRODUTO
// ======================================================

async function editProduct(id) {

  try {

    const data =
      await api("/api/products");

    if (!Array.isArray(data)) {
      throw new Error(
        "Não foi possível carregar os produtos."
      );
    }

    const product =
      data.find(
        (item) =>
          Number(item.id) === Number(id)
      );

    if (!product) {

      alert(
        "Produto não encontrado."
      );

      return;
    }

    editingProductId =
      product.id;

    document.getElementById(
      "productId"
    ).value = product.id;

    document.getElementById(
      "name"
    ).value = product.name || "";

    document.getElementById(
      "category"
    ).value = product.category || "";

    document.getElementById(
      "type"
    ).value = product.type || "";

    document.getElementById(
      "price"
    ).value = product.price ?? "";

    document.getElementById(
      "description"
    ).value =
      product.description || "";

    document.getElementById(
      "available"
    ).checked =
      Boolean(product.available);

    document.getElementById(
      "image"
    ).value =
      product.image || "";

    document.getElementById(
      "sizeType"
    ).value =
      product.sizeType || "";

    renderSizeOptions(
      Array.isArray(product.sizes)
        ? product.sizes
        : []
    );

    showImagePreview(
      product.image || ""
    );

    document.getElementById(
      "formTitle"
    ).textContent =
      "Editar produto";

    document.getElementById(
      "saveBtn"
    ).textContent =
      "Atualizar produto";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {

    console.error(
      "Erro ao editar:",
      error
    );

    alert(
      error.message ||
      "Não foi possível editar o produto."
    );
  }
}

// ======================================================
// ELIMINAR PRODUTO
// ======================================================

async function deleteProduct(id) {

  const confirmed =
    window.confirm(
      "Tem certeza que deseja eliminar este produto?"
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

    alert(
      "Produto eliminado com sucesso!"
    );

    await getCsrfToken();
    await loadProducts();

  } catch (error) {

    console.error(
      "Erro ao eliminar:",
      error
    );

    alert(
      error.message ||
      "Não foi possível eliminar o produto."
    );
  }
}

// ======================================================
// PEDIDOS
// ======================================================

async function loadOrders() {

  const container =
    document.getElementById("ordersList");

  if (!container) {
    return;
  }

  try {

    const data =
      await api("/api/orders");

    if (!Array.isArray(data)) {
      throw new Error(
        "Formato de pedidos inválido."
      );
    }

    if (data.length === 0) {

      container.innerHTML = `
        <p class="muted">
          Ainda não existem pedidos.
        </p>
      `;

      return;
    }

    container.innerHTML =
      data.map((order) => {

        const items =
          Array.isArray(order.items)
            ? order.items
            : [];

        const itemsHtml =
          items.map((item) => {

            let text =
              `${item.name} × ${item.quantity}`;

            if (item.size) {
              text +=
                ` — Tamanho: ${item.size}`;
            }

            text +=
              ` — ${formatMoney(item.price)}`;

            return `
              <li>
                ${escapeHtml(text)}
              </li>
            `;

          }).join("");

        const date =
          order.createdAt
            ? new Date(
                order.createdAt
              ).toLocaleString("pt-PT")
            : "";

        return `
          <article class="orderCard">

            <div class="sectionTitle">

              <div>
                <h3>
                  Pedido #${order.id}
                </h3>

                <p class="muted">
                  ${escapeHtml(date)}
                </p>
              </div>

              <strong>
                ${formatMoney(order.total)}
              </strong>

            </div>

            <p>
              <strong>Cliente:</strong>
              ${escapeHtml(
                order.customerName || ""
              )}
            </p>

            <p>
              <strong>Telefone:</strong>
              ${escapeHtml(
                order.customerPhone || ""
              )}
            </p>

            <p>
              <strong>Produtos:</strong>
            </p>

            <ul>
              ${itemsHtml}
            </ul>

          </article>
        `;

      }).join("");

  } catch (error) {

    console.error(
      "Erro ao carregar pedidos:",
      error
    );

    container.innerHTML = `
      <p>
        Não foi possível carregar os pedidos.
      </p>
    `;
  }
}

// ======================================================
// LOGOUT
// ======================================================

async function logout() {

  try {

    await api(
      "/api/logout",
      {
        method: "POST"
      }
    );

  } catch (error) {

    console.error(
      "Erro ao sair:",
      error
    );

  } finally {

    window.location.href = "/";
  }
}

// ======================================================
// EVENTOS
// ======================================================

function setupEvents() {

  const productForm =
    document.getElementById("productForm");

  if (productForm) {
    productForm.addEventListener(
      "submit",
      saveProduct
    );
  }

  const sizeType =
    document.getElementById("sizeType");

  if (sizeType) {

    sizeType.addEventListener(
      "change",
      () => {
        renderSizeOptions([]);
      }
    );
  }

  const imageFile =
    document.getElementById("imageFile");

  if (imageFile) {

    imageFile.addEventListener(
      "change",
      handleImageChange
    );
  }

  const clearBtn =
    document.getElementById("clearBtn");

  if (clearBtn) {

    clearBtn.addEventListener(
      "click",
      clearForm
    );
  }

  const logoutBtn =
    document.getElementById("logoutBtn");

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      logout
    );
  }

  const productsList =
    document.getElementById("productsList");

  if (productsList) {

    productsList.addEventListener(
      "click",
      (event) => {

        const editButton =
          event.target.closest(
            ".editProductBtn"
          );

        if (editButton) {

          const id =
            editButton.dataset.id;

          editProduct(id);

          return;
        }

        const deleteButton =
          event.target.closest(
            ".deleteProductBtn"
          );

        if (deleteButton) {

          const id =
            deleteButton.dataset.id;

          deleteProduct(id);
        }

      }
    );
  }
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function init() {

  try {

    await getCsrfToken();

    const me =
      await api("/api/me");

    if (!me || !me.authenticated) {

      window.location.href = "/";
      return;
    }

    setupEvents();

    renderSizeOptions([]);

    await loadProducts();

    await loadOrders();

  } catch (error) {

    console.error(
      "Erro ao iniciar administração:",
      error
    );

    alert(
      error.message ||
      "Ocorreu um erro ao carregar a administração."
    );
  }
}

// ======================================================
// INICIAR
// ======================================================

init();


