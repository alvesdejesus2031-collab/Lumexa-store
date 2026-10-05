const SIZE_OPTIONS = {
  "": [],
  shirt: ["S", "M", "L", "XL", "XXL"],
  pants: ["32", "34", "36", "38", "40", "42", "44"],
  shoe: ["38", "39", "40", "41", "42", "43", "44"]
};

let csrfToken = "";

async function getCsrfToken() {
  const response = await fetch("/api/csrf", {
    credentials: "same-origin"
  });

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

  if (response.status === 401) {
    window.location.href = "/";
    return;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Ocorreu um erro."
    );
  }

  return data;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("pt-AO")} Kz`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderSizeOptions(selected = []) {
  const typeElement = document.querySelector("#productType");
  const sizesElement = document.querySelector("#productSizes");

  if (!typeElement || !sizesElement) {
    return;
  }

  const type = typeElement.value;
  const sizes = SIZE_OPTIONS[type] || [];

  sizesElement.innerHTML = "";

  if (!sizes.length) {
    sizesElement.innerHTML =
      `<p class="muted">Este produto não utiliza tamanhos.</p>`;
    return;
  }

  sizes.forEach((size) => {
    const checked = selected.includes(size)
      ? "checked"
      : "";

    sizesElement.innerHTML += `
      <label class="size-option">
        <input
          type="checkbox"
          name="productSize"
          value="${escapeHtml(size)}"
          ${checked}
        >
        <span>${escapeHtml(size)}</span>
      </label>
    `;
  });
}

async function loadProducts() {
  const container =
    document.querySelector("#productsList");

  if (!container) {
    return;
  }

  const data = await api("/api/admin/products");

  const products = Array.isArray(data)
    ? data
    : data.products || [];

  if (!products.length) {
    container.innerHTML =
      `<p>Nenhum produto cadastrado.</p>`;
    return;
  }

  container.innerHTML = products.map((product) => {
    const sizes = Array.isArray(product.sizes)
      ? product.sizes
      : [];

    return `
      <div class="admin-product" data-id="${product.id}">
        <div class="admin-product-image">
          ${
            product.image
              ? `<img
                  src="${escapeHtml(product.image)}"
                  alt="${escapeHtml(product.name)}"
                >`
              : ""
          }
        </div>

        <div class="admin-product-info">
          <h3>${escapeHtml(product.name)}</h3>

          <p>
            <strong>${formatMoney(product.price)}</strong>
          </p>

          <p>
            Tipo:
            ${escapeHtml(product.type || "Sem tamanho")}
          </p>

          <p>
            Disponibilidade:
            ${
              product.available
                ? "Disponível"
                : "Indisponível"
            }
          </p>

          ${
            sizes.length
              ? `<p>Tamanhos: ${sizes
                  .map(escapeHtml)
                  .join(", ")}</p>`
              : ""
          }

          ${
            product.description
              ? `<p>${escapeHtml(product.description)}</p>`
              : ""
          }
        </div>

        <div class="admin-product-actions">
          <button
            type="button"
            onclick="editProduct(${product.id})"
          >
            Editar
          </button>

          <button
            type="button"
            onclick="deleteProduct(${product.id})"
          >
            Eliminar
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function loadOrders() {
  const container =
    document.querySelector("#ordersList");

  if (!container) {
    return;
  }

  const data = await api("/api/admin/orders");

  const orders = Array.isArray(data)
    ? data
    : data.orders || [];

  if (!orders.length) {
    container.innerHTML =
      `<p>Nenhum pedido recebido.</p>`;
    return;
  }

  container.innerHTML = orders.map((order) => {
    let items = [];

    try {
      items = Array.isArray(order.items)
        ? order.items
        : JSON.parse(order.items || "[]");
    } catch {
      items = [];
    }

    const itemsHtml = items.map((item) => {
      let text =
        `${item.name} × ${item.quantity}`;

      if (item.size) {
        text += ` — Tamanho: ${item.size}`;
      }

      return `<li>${escapeHtml(text)}</li>`;
    }).join("");

    return `
      <div class="admin-order">
        <div class="admin-order-header">
          <strong>
            Pedido #${escapeHtml(order.id)}
          </strong>

          <span>
            ${formatMoney(order.total)}
          </span>
        </div>

        <p>
          Cliente:
          ${escapeHtml(
            order.customer_name ||
            order.name ||
            "Não informado"
          )}
        </p>

        <p>
          Telefone:
          ${escapeHtml(
            order.phone ||
            "Não informado"
          )}
        </p>

        <p>
          Data:
          ${escapeHtml(
            order.created_at ||
            ""
          )}
        </p>

        <ul>
          ${itemsHtml}
        </ul>
      </div>
    `;
  }).join("");
}

async function deleteProduct(id) {
  const confirmed = confirm(
    "Tem certeza que deseja eliminar este produto?"
  );

  if (!confirmed) {
    return;
  }

  await api(`/api/admin/products/${id}`, {
    method: "DELETE"
  });

  await getCsrfToken();
  await loadProducts();
}

async function editProduct(id) {
  const data = await api("/api/admin/products");
  const products = Array.isArray(data)
    ? data
    : data.products || [];

  const product = products.find(
    (item) => Number(item.id) === Number(id)
  );

  if (!product) {
    alert("Produto não encontrado.");
    return;
  }

  const idElement =
    document.querySelector("#productId");

  const nameElement =
    document.querySelector("#productName");

  const priceElement =
    document.querySelector("#productPrice");

  const typeElement =
    document.querySelector("#productType");

  const descriptionElement =
    document.querySelector("#productDescription");

  const availableElement =
    document.querySelector("#productAvailable");

  const imageElement =
    document.querySelector("#productImage");

  if (idElement) {
    idElement.value = product.id;
  }

  if (nameElement) {
    nameElement.value = product.name || "";
  }

  if (priceElement) {
    priceElement.value = product.price || "";
  }

  if (typeElement) {
    typeElement.value = product.type || "";
  }

  if (descriptionElement) {
    descriptionElement.value =
      product.description || "";
  }

  if (availableElement) {
    availableElement.checked =
      Boolean(product.available);
  }

  if (imageElement) {
    imageElement.value =
      product.image || "";
  }

  renderSizeOptions(
    Array.isArray(product.sizes)
      ? product.sizes
      : []
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function getSelectedSizes() {
  return Array.from(
    document.querySelectorAll(
      'input[name="productSize"]:checked'
    )
  ).map((input) => input.value);
}

async function saveProduct(event) {
  event.preventDefault();

  const id =
    document.querySelector("#productId")?.value;

  const name =
    document.querySelector("#productName")?.value
      .trim();

  const price =
    document.querySelector("#productPrice")?.value;

  const type =
    document.querySelector("#productType")?.value || "";

  const description =
    document
      .querySelector("#productDescription")
      ?.value
      .trim() || "";

  const image =
    document
      .querySelector("#productImage")
      ?.value
      .trim() || "";

  const available =
    document
      .querySelector("#productAvailable")
      ?.checked ?? true;

  const sizes = getSelectedSizes();

  if (!name) {
    alert("Digite o nome do produto.");
    return;
  }

  if (!price || Number(price) < 0) {
    alert("Digite um preço válido.");
    return;
  }

  const payload = {
    name,
    price: Number(price),
    type,
    description,
    image,
    available,
    sizes
  };

  if (id) {
    await api(
      `/api/admin/products/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      }
    );
  } else {
    await api(
      "/api/admin/products",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  }

  alert(
    id
      ? "Produto atualizado com sucesso!"
      : "Produto criado com sucesso!"
  );

  const form =
    document.querySelector("#productForm");

  if (form) {
    form.reset();
  }

  const idElement =
    document.querySelector("#productId");

  if (idElement) {
    idElement.value = "";
  }

  renderSizeOptions([]);

  await getCsrfToken();
  await loadProducts();
}

async function logout() {
  try {
    await api("/api/logout", {
      method: "POST"
    });
  } finally {
    window.location.href = "/";
  }
}

async function init() {
  try {
    await getCsrfToken();

    const me = await api("/api/me");

    /*
     * IMPORTANTE:
     * O servidor retorna "authenticated".
     * Não usar "loggedIn" aqui.
     */
    if (!me.authenticated) {
      window.location.href = "/";
      return;
    }

    renderSizeOptions([]);

    const typeElement =
      document.querySelector("#productType");

    if (typeElement) {
      typeElement.addEventListener(
        "change",
        () => {
          renderSizeOptions([]);
        }
      );
    }

    const form =
      document.querySelector("#productForm");

    if (form) {
      form.addEventListener(
        "submit",
        saveProduct
      );
    }

    const logoutButton =
      document.querySelector("#logoutButton");

    if (logoutButton) {
      logoutButton.addEventListener(
        "click",
        logout
      );
    }

    await loadProducts();
    await loadOrders();

  } catch (error) {
    console.error(error);

    alert(
      error.message ||
      "Ocorreu um erro."
    );
  }
}

init();
