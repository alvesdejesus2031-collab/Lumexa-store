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
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;

        let width = img.width;
        let height = img.height;

        // Redimensionar mantendo a proporção
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
            new Error("Não foi possível processar a imagem.")
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

        // JPEG comprimido
        const quality = 0.65;

        const compressed = canvas.toDataURL(
          "image/jpeg",
          quality
        );

        // Mostrar no console o tamanho aproximado
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

        console.log(
          "Redução:",
          Math.round(
            (1 - compressedKB / originalKB) * 100
          ) + "%"
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


