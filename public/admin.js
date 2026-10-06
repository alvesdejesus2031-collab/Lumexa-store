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
let selectedImageData = null;

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
      data.error ||
      "Não foi possível obter o token de segurança."
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

    if (csrfToken) {
      headers["CSRF-Token"] = csrfToken;
    }
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

function showMessage(message, type = "success") {
  let box = document.getElementById("adminMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "adminMessage";

    box.style.position = "fixed";
    box.style.top = "20px";
    box.style.right = "20px";
    box.style.zIndex = "99999";
    box.style.padding = "14px 18px";
    box.style.borderRadius = "10px";
    box.style.fontWeight = "600";
    box.style.maxWidth = "350px";
    box.style.boxShadow = "0 8px 25px rgba(0,0,0,.18)";

    document.body.appendChild(box);
  }

  box.textContent = message;

  if (type === "error") {
    box.style.background = "#b91c1c";
    box.style.color = "#fff";
  } else {
    box.style.background = "#15803d";
    box.style.color = "#fff";
  }

  clearTimeout(window.__adminMessageTimer);

  window.__adminMessageTimer = setTimeout(() => {
    box.remove();
  }, 4000);
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
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.objectFit = "contain";
  img.style.borderRadius = "12px";

  preview.appendChild(img);
}

// ======================================================
// COMPRESSÃO DAS IMAGENS
// ======================================================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nenhuma imagem selecionada."));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione uma imagem válida."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;

        let width = img.width;
        let height = img.height;

        const ratio = Math.min(
          MAX_WIDTH / width,
          MAX_HEIGHT / height,
          1
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(
            new Error(
              "Não foi possível processar a imagem."
            )
          );

          return;
        }

        ctx.drawImage(
          img,
          0,
          0,
          width,
          height
        );

        const compressed = canvas.toDataURL(
          "image/jpeg",
          0.65
        );

        const originalKB =
          Math.round(file.size / 1024);

        const compressedKB =
          Math.round(
            (compressed.length * 3) / 4 / 1024
          );

        console.log(
          "Imagem original:",
          originalKB,
          "KB"
        );

        console.log(
          "Imagem comprimida:",
          compressedKB,
          "KB"
        );

        resolve(compressed);
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

// ======================================================
// UPLOAD PARA CLOUDINARY
// ======================================================

async function uploadImageToCloudinary(imageData) {
  if (!imageData) {
    return "";
  }

  showMessage("A enviar imagem...", "success");

  const result = await api(
    "/api/upload-image",
    {
      method: "POST",
      body: JSON.stringify({
        image: imageData
      })
    }
  );

  if (!result || !result.url) {
    throw new Error(
      "O Cloudinary não devolveu a imagem."
    );
  }

  console.log(
    "Imagem enviada para Cloudinary:",
    result.url
  );

  return result.url;
}

// ======================================================
// INPUT DE IMAGEM
// ======================================================

function setupImageInput() {
  const imageFile =
    document.getElementById("imageFile");

  if (!imageFile) {
    return;
  }

  imageFile.addEventListener(
    "change",
    async function () {
      const file = this.files?.[0];

      if (!file) {
        return;
      }

      try {
        showMessage(
          "A comprimir imagem...",
          "success"
        );

        const compressed =
          await compressImage(file);

        selectedImageData = compressed;

        showImagePreview(compressed);

        showMessage(
          "Imagem preparada. Será enviada ao Cloudinary ao guardar o produto."
        );
      } catch (error) {
        console.error(error);

        selectedImageData = null;

        showMessage(
          error.message ||
          "Erro ao processar imagem.",
          "error"
        );
      }
    }
  );
}

// ======================================================
// CARREGAR PRODUTOS
// ======================================================

async function loadProducts() {
  const productsList =
    document.getElementById("productsList");

  if (!productsList) {
    return;
  }

  productsList.innerHTML =
    "<p>A carregar produtos...</p>";

  try {
    const data = await api(
      "/api/products"
    );

    const products =
      Array.isArray(data)
        ? data
        : data.products || [];

    if (!products.length) {
      productsList.innerHTML =
        "<p>Nenhum produto cadastrado.</p>";

      return;
    }

    productsList.innerHTML = "";

    products.forEach((product) => {
      productsList.appendChild(
        createProductElement(product)
      );
    });

  } catch (error) {
    console.error(error);

    productsList.innerHTML =
      "<p>Não foi possível carregar os produtos.</p>";

    showMessage(
      error.message ||
      "Erro ao carregar produtos.",
      "error"
    );
  }
}

// ======================================================
// CRIAR CARD DO PRODUTO
// ======================================================

function createProductElement(product) {
  const card =
    document.createElement("div");

  card.className = "productAdminCard";

  const image =
    product.image ||
    "https://via.placeholder.com/300x300?text=Lumexa";

  let sizes = [];

  try {
    if (Array.isArray(product.sizes)) {
      sizes = product.sizes;
    } else if (product.sizes_json) {
      sizes =
        typeof product.sizes_json === "string"
          ? JSON.parse(product.sizes_json)
          : product.sizes_json;
    }
  } catch {
    sizes = [];
  }

  card.innerHTML = `
    <div class="productAdminImage">
      <img
        src="${escapeHtml(image)}"
        alt="${escapeHtml(product.name)}"
        loading="lazy"
      >
    </div>

    <div class="productAdminInfo">

      <h3>
        ${escapeHtml(product.name)}
      </h3>

      <p>
        <strong>
          ${formatMoney(product.price)}
        </strong>
      </p>

      ${
        product.category
          ? `<p>Categoria: ${escapeHtml(product.category)}</p>`
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

      ${
        product.size_type
          ? `
            <p>
              Tipo: ${escapeHtml(product.size_type)}
            </p>
          `
          : ""
      }

      ${
        sizes.length
          ? `
            <p>
              Tamanhos:
              ${sizes
                .map(
                  (size) =>
                    `<span>${escapeHtml(size)}</span>`
                )
                .join(", ")}
            </p>
          `
          : ""
      }

      <p>
        Estado:
        <strong>
          ${
            product.available
              ? "Disponível"
              : "Indisponível"
          }
        </strong>
      </p>

      <div class="productAdminActions">

        <button
          type="button"
          class="editProductBtn"
          data-id="${product.id}"
        >
          Editar
        </button>

        <button
          type="button"
          class="toggleProductBtn"
          data-id="${product.id}"
          data-available="${
            product.available ? "1" : "0"
          }"
        >
          ${
            product.available
              ? "Desativar"
              : "Ativar"
          }
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
  `;

  return card;
}

// ======================================================
// OBTER PRODUTO PELO ID
// ======================================================

async function getProduct(id) {
  const data = await api(
    `/api/products/${encodeURIComponent(id)}`
  );

  return data?.product || data;
}

// ======================================================
// EDITAR PRODUTO
// ======================================================

async function editProduct(id) {
  try {
    const product =
      await getProduct(id);

    if (!product) {
      throw new Error(
        "Produto não encontrado."
      );
    }

    editingProductId = id;

    const name =
      document.getElementById("name");

    const category =
      document.getElementById("category");

    const type =
      document.getElementById("type");

    const price =
      document.getElementById("price");

    const description =
      document.getElementById("description");

    const image =
      document.getElementById("image");

    const available =
      document.getElementById("available");

    const sizeType =
      document.getElementById("sizeType");

    if (name) {
      name.value =
        product.name || "";
    }

    if (category) {
      category.value =
        product.category || "";
    }

    if (type) {
      type.value =
        product.type || "";
    }

    if (price) {
      price.value =
        product.price ?? "";
    }

    if (description) {
      description.value =
        product.description || "";
    }

    if (image) {
      image.value =
        product.image || "";
    }

    if (available) {
      available.checked =
        product.available !== false;
    }

    if (sizeType) {
      sizeType.value =
        product.size_type || "";
    }

    let selectedSizes = [];

    try {
      if (Array.isArray(product.sizes)) {
        selectedSizes =
          product.sizes;
      } else if (product.sizes_json) {
        selectedSizes =
          typeof product.sizes_json === "string"
            ? JSON.parse(product.sizes_json)
            : product.sizes_json;
      }
    } catch {
      selectedSizes = [];
    }

    renderSizeOptions(
      selectedSizes
    );

    selectedImageData = null;

    showImagePreview(
      product.image || ""
    );

    const submitButton =
      document.querySelector(
        "#productForm button[type='submit']"
      );

    if (submitButton) {
      submitButton.textContent =
        "Guardar alterações";
    }

    const cancelButton =
      document.getElementById(
        "cancelEditBtn"
      );

    if (cancelButton) {
      cancelButton.classList.remove(
        "hidden"
      );
    }

    const form =
      document.getElementById(
        "productForm"
      );

    if (form) {
      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "Não foi possível editar o produto.",
      "error"
    );
  }
}

// ======================================================
// LIMPAR FORMULÁRIO
// ======================================================

function resetProductForm() {
  const form =
    document.getElementById(
      "productForm"
    );

  if (form) {
    form.reset();
  }

  editingProductId = null;
  selectedImageData = null;

  const imageFile =
    document.getElementById(
      "imageFile"
    );

  if (imageFile) {
    imageFile.value = "";
  }

  const image =
    document.getElementById("image");

  if (image) {
    image.value = "";
  }

  const preview =
    document.getElementById(
      "imagePreview"
    );

  if (preview) {
    preview.innerHTML = "";
  }

  renderSizeOptions([]);

  const submitButton =
    document.querySelector(
      "#productForm button[type='submit']"
    );

  if (submitButton) {
    submitButton.textContent =
      "Guardar produto";
  }

  const cancelButton =
    document.getElementById(
      "cancelEditBtn"
    );

  if (cancelButton) {
    cancelButton.classList.add(
      "hidden"
    );
  }
}

// ======================================================
// GUARDAR PRODUTO
// ======================================================

async function saveProduct(event) {
  event.preventDefault();

  const name =
    document.getElementById("name");

  const category =
    document.getElementById("category");

  const type =
    document.getElementById("type");

  const price =
    document.getElementById("price");

  const description =
    document.getElementById(
      "description"
    );

  const image =
    document.getElementById("image");

  const available =
    document.getElementById(
      "available"
    );

  const sizeType =
    document.getElementById(
      "sizeType"
    );

  if (!name?.value.trim()) {
    showMessage(
      "Digite o nome do produto.",
      "error"
    );

    return;
  }

  if (
    !price?.value ||
    Number(price.value) < 0
  ) {
    showMessage(
      "Digite um preço válido.",
      "error"
    );

    return;
  }

  try {
    let imageUrl =
      image?.value.trim() || "";

    // ----------------------------------------------
    // SE EXISTE NOVA IMAGEM
    // ENVIA PARA CLOUDINARY
    // ----------------------------------------------

    if (selectedImageData) {
      imageUrl =
        await uploadImageToCloudinary(
          selectedImageData
        );
    }

    // ----------------------------------------------
    // TAMANHOS
    // ----------------------------------------------

    const selectedSizes =
      getSelectedSizes();

    const payload = {
      name:
        name.value.trim(),

      category:
        category?.value.trim() || "",

      type:
        type?.value.trim() || "",

      price:
        Number(price.value),

      description:
        description?.value.trim() || "",

      image:
        imageUrl,

      available:
        available
          ? available.checked
          : true,

      size_type:
        sizeType?.value || "",

      sizes:
        selectedSizes
    };

    let result;

    // ----------------------------------------------
    // EDITAR
    // ----------------------------------------------

    if (editingProductId) {
      result = await api(
        `/api/products/${encodeURIComponent(
          editingProductId
        )}`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

      showMessage(
        "Produto atualizado com sucesso."
      );

    } else {

      // --------------------------------------------
      // CRIAR
      // --------------------------------------------

      result = await api(
        "/api/products",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      showMessage(
        "Produto criado com sucesso."
      );
    }

    console.log(
      "Produto salvo:",
      result
    );

    resetProductForm();

    await loadProducts();

  } catch (error) {
    console.error(
      "ERRO AO GUARDAR PRODUTO:",
      error
    );

    showMessage(
      error.message ||
      "Não foi possível guardar o produto.",
      "error"
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
      `/api/products/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    showMessage(
      "Produto eliminado com sucesso."
    );

    if (
      String(editingProductId) ===
      String(id)
    ) {
      resetProductForm();
    }

    await loadProducts();

  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "Não foi possível eliminar o produto.",
      "error"
    );
  }
}

// ======================================================
// ATIVAR / DESATIVAR
// ======================================================

async function toggleProduct(
  id,
  currentAvailable
) {
  try {
    const product =
      await getProduct(id);

    if (!product) {
      throw new Error(
        "Produto não encontrado."
      );
    }

    const newAvailable =
      !currentAvailable;

    const payload = {
      name:
        product.name || "",

      category:
        product.category || "",

      type:
        product.type || "",

      price:
        Number(product.price || 0),

      description:
        product.description || "",

      image:
        product.image || "",

      available:
        newAvailable,

      size_type:
        product.size_type || "",

      sizes:
        Array.isArray(product.sizes)
          ? product.sizes
          : (() => {
              try {
                return product.sizes_json
                  ? JSON.parse(
                      product.sizes_json
                    )
                  : [];
              } catch {
                return [];
              }
            })()
    };

    await api(
      `/api/products/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      }
    );

    showMessage(
      newAvailable
        ? "Produto ativado."
        : "Produto desativado."
    );

    await loadProducts();

  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "Não foi possível alterar o estado do produto.",
      "error"
    );
  }
}

// ======================================================
// LOGOUT
// ======================================================

async function logoutAdmin() {
  try {
    await api(
      "/api/admin/logout",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

  } catch (error) {
    console.error(
      "Erro ao sair:",
      error
    );
  }

  window.location.href = "/";
}

// ======================================================
// EVENTOS
// ======================================================

function setupEvents() {

  // ----------------------------------------------
  // FORMULÁRIO
  // ----------------------------------------------

  const form =
    document.getElementById(
      "productForm"
    );

  if (form) {
    form.addEventListener(
      "submit",
      saveProduct
    );
  }

  // ----------------------------------------------
  // TAMANHOS
  // ----------------------------------------------

  const sizeType =
    document.getElementById(
      "sizeType"
    );

  if (sizeType) {
    sizeType.addEventListener(
      "change",
      () => {
        renderSizeOptions([]);
      }
    );
  }

  // ----------------------------------------------
  // IMAGEM
  // ----------------------------------------------

  setupImageInput();

  // ----------------------------------------------
  // CANCELAR EDIÇÃO
  // ----------------------------------------------

  const cancelEdit =
    document.getElementById(
      "cancelEditBtn"
    );

  if (cancelEdit) {
    cancelEdit.addEventListener(
      "click",
      resetProductForm
    );
  }

  // ----------------------------------------------
  // LOGOUT
  // ----------------------------------------------

  const logoutButton =
    document.getElementById(
      "logoutBtn"
    );

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logoutAdmin
    );
  }

  // ----------------------------------------------
  // PRODUTOS
  // ----------------------------------------------

  document.addEventListener(
    "click",
    async (event) => {

      const editButton =
        event.target.closest(
          ".editProductBtn"
        );

      if (editButton) {
        await editProduct(
          editButton.dataset.id
        );

        return;
      }

      const deleteButton =
        event.target.closest(
          ".deleteProductBtn"
        );

      if (deleteButton) {
        await deleteProduct(
          deleteButton.dataset.id
        );

        return;
      }

      const toggleButton =
        event.target.closest(
          ".toggleProductBtn"
        );

      if (toggleButton) {

        const id =
          toggleButton.dataset.id;

        const available =
          toggleButton.dataset.available ===
          "1";

        await toggleProduct(
          id,
          available
        );
      }
    }
  );
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function initAdmin() {
  try {

    await getCsrfToken();

    setupEvents();

    renderSizeOptions([]);

    await loadProducts();

  } catch (error) {

    console.error(
      "ERRO AO INICIAR ADMIN:",
      error
    );

    showMessage(
      error.message ||
      "Não foi possível iniciar o painel.",
      "error"
    );
  }
}

// ======================================================
// START
// ======================================================

document.addEventListener(
  "DOMContentLoaded",
  initAdmin
);


