require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

const app = express();
const PORT = process.env.PORT || 10000;

// ======================================================
// CONFIGURAÇÃO
// ======================================================

app.set("trust proxy", 1);

const isProduction =
  process.env.NODE_ENV === "production";

const WHATSAPP_NUMBER =
  process.env.WHATSAPP_NUMBER || "244937770994";

const STORE_CURRENCY =
  process.env.STORE_CURRENCY || "AOA";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "";

const ALLOWED_SIZE_TYPES = [
  "",
  "shirt",
  "pants",
  "shoe"
];

const ALLOWED_SIZES = {
  shirt: ["S", "M", "L", "XL", "XXL"],
  pants: ["32", "34", "36", "38", "40", "42", "44"],
  shoe: ["38", "39", "40", "41", "42", "43", "44"]
};

// ======================================================
// CLOUDINARY
// ======================================================
// Usa automaticamente a variável:
// CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@p3fafzni
//
// NÃO coloque API Key ou API Secret diretamente neste arquivo.

cloudinary.config();

// ======================================================
// DATABASE
// ======================================================

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não está configurada.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false
});

// ======================================================
// MIDDLEWARES
// ======================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);

// Aumentado para permitir imagens comprimidas em Base64.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ======================================================
// SESSÃO
// ======================================================

app.use(
  session({
    name: "lumexa.sid",

    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true
    }),

    secret:
      process.env.SESSION_SECRET ||
      "change-this-session-secret",

    resave: false,
    saveUninitialized: false,

    proxy: true,

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// ======================================================
// RATE LIMIT
// ======================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// ======================================================
// CSRF
// ======================================================

const csrfProtection = csrf({
  cookie: false
});

app.use((req, res, next) => {
  if (req.path === "/api/orders") {
    return next();
  }

  return csrfProtection(req, res, next);
});

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function cleanText(value, maxLength = 5000) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
}

function cleanSizes(sizeType, sizes) {
  if (!sizeType) {
    return [];
  }

  if (!ALLOWED_SIZES[sizeType]) {
    return [];
  }

  if (!Array.isArray(sizes)) {
    return [];
  }

  const allowed = ALLOWED_SIZES[sizeType];

  return [
    ...new Set(
      sizes
        .map((size) => String(size))
        .filter((size) => allowed.includes(size))
    )
  ];
}

function cleanProduct(body) {
  const name = cleanText(body.name, 150);
  const category = cleanText(body.category, 100);
  const type = cleanText(body.type, 50);

  const price = Number(body.price);

  const description = cleanText(
    body.description,
    3000
  );

  const image = cleanText(
    body.image,
    1000000
  );

  const sizeType = ALLOWED_SIZE_TYPES.includes(
    body.sizeType
  )
    ? body.sizeType
    : "";

  const sizes = cleanSizes(
    sizeType,
    body.sizes
  );

  const available =
    body.available !== false;

  return {
    name,
    category,
    type,
    price,
    description,
    image,
    sizeType,
    sizes,
    available
  };
}

function validateProduct(product) {
  if (!product.name) {
    return "O nome do produto é obrigatório.";
  }

  if (!product.category) {
    return "A categoria é obrigatória.";
  }

  if (
    !Number.isFinite(product.price) ||
    product.price < 0
  ) {
    return "O preço do produto é inválido.";
  }

  if (
    product.sizeType &&
    product.sizes.length === 0
  ) {
    return "Selecione pelo menos um tamanho.";
  }

  return null;
}

function productFromRow(row) {
  let sizes = [];

  try {
    sizes = JSON.parse(
      row.sizes_json || "[]"
    );
  } catch {
    sizes = [];
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type || "",
    price: Number(row.price),
    description: row.description || "",
    image: row.image || "",
    available: Boolean(row.available),
    sizeType: row.size_type || "",
    sizes
  };
}

function requireAdmin(req, res, next) {
  if (
    !req.session ||
    !req.session.adminId
  ) {
    return res.status(401).json({
      error: "Não autorizado."
    });
  }

  next();
}

// ======================================================
// DATABASE INIT
// ======================================================

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT DEFAULT '',
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      size_type TEXT DEFAULT '',
      sizes_json TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS name TEXT
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category TEXT
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS size_type TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sizes_json TEXT DEFAULT '[]'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const existing = await pool.query(
      `SELECT id FROM admins WHERE email = $1 LIMIT 1`,
      [ADMIN_EMAIL]
    );

    if (existing.rows.length === 0) {
      const passwordHash =
        await bcrypt.hash(
          ADMIN_PASSWORD,
          12
        );

      await pool.query(
        `
        INSERT INTO admins
          (email, password_hash)
        VALUES
          ($1, $2)
        `,
        [
          ADMIN_EMAIL,
          passwordHash
        ]
      );

      console.log("Administrador criado.");
    }
  }

  console.log("Banco de dados inicializado.");
}

// ======================================================
// CSRF
// ======================================================

app.get("/api/csrf", (req, res) => {
  res.json({
    csrfToken: req.csrfToken()
  });
});

// ======================================================
// LOGIN
// ======================================================

app.post(
  "/api/login",
  loginLimiter,
  async (req, res) => {
    try {
      const email = cleanText(
        req.body.email,
        200
      );

      const password = String(
        req.body.password || ""
      );

      if (!email || !password) {
        return res.status(400).json({
          error:
            "Email e senha são obrigatórios."
        });
      }

      const result = await pool.query(
        `
        SELECT id, email, password_hash
        FROM admins
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error:
            "Email ou senha incorretos."
        });
      }

      const admin = result.rows[0];

      const passwordOk =
        await bcrypt.compare(
          password,
          admin.password_hash
        );

      if (!passwordOk) {
        return res.status(401).json({
          error:
            "Email ou senha incorretos."
        });
      }

      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          console.error(
            "Erro ao regenerar sessão:",
            regenerateError
          );

          return res.status(500).json({
            error:
              "Não foi possível iniciar a sessão."
          });
        }

        req.session.adminId =
          admin.id;

        req.session.adminEmail =
          admin.email;

        req.session.save((saveError) => {
          if (saveError) {
            console.error(
              "Erro ao guardar sessão:",
              saveError
            );

            return res.status(500).json({
              error:
                "Não foi possível guardar a sessão."
            });
          }

          return res.json({
            ok: true
          });
        });
      });

    } catch (error) {
      console.error(
        "Erro no login:",
        error
      );

      return res.status(500).json({
        error: "Erro interno."
      });
    }
  }
);

// ======================================================
// LOGOUT
// ======================================================

app.post(
  "/api/logout",
  requireAdmin,
  (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        console.error(
          "Erro ao terminar sessão:",
          error
        );

        return res.status(500).json({
          error:
            "Não foi possível terminar a sessão."
        });
      }

      res.clearCookie("lumexa.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax"
      });

      res.json({
        ok: true
      });
    });
  }
);

// ======================================================
// VERIFICAR ADMIN
// ======================================================

app.get("/api/me", (req, res) => {
  if (
    req.session &&
    req.session.adminId
  ) {
    return res.json({
      authenticated: true,
      email:
        req.session.adminEmail || ""
    });
  }

  return res.status(401).json({
    authenticated: false
  });
});

// ======================================================
// PRODUTOS — PÚBLICO
// ======================================================

app.get(
  "/api/products",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          category,
          type,
          price,
          description,
          image,
          available,
          size_type,
          sizes_json
        FROM products
        ORDER BY id DESC
      `);

      res.json(
        result.rows.map(productFromRow)
      );
    } catch (error) {
      console.error(
        "Erro ao buscar produtos:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível carregar os produtos."
      });
    }
  }
);

// ======================================================
// UPLOAD DE IMAGEM — CLOUDINARY
// ======================================================

app.post(
  "/api/upload-image",
  requireAdmin,
  async (req, res) => {
    try {
      const image = String(
        req.body.image || ""
      );

      if (!image) {
        return res.status(400).json({
          error:
            "Nenhuma imagem foi enviada."
        });
      }

      if (
        !image.startsWith("data:image/")
      ) {
        return res.status(400).json({
          error:
            "Formato de imagem inválido."
        });
      }

      const result =
        await cloudinary.uploader.upload(
          image,
          {
            folder:
              "lumexa-store/products",

            resource_type: "image",

            transformation: [
              {
                width: 1000,
                height: 1000,
                crop: "limit",
                quality: "auto",
                fetch_format: "auto"
              }
            ]
          }
        );

      return res.json({
        ok: true,
        url: result.secure_url,
        publicId: result.public_id
      });

    } catch (error) {
      console.error(
        "ERRO AO ENVIAR IMAGEM PARA CLOUDINARY:",
        error
      );

      return res.status(500).json({
        error:
          "Não foi possível enviar a imagem."
      });
    }
  }
);

// ======================================================
// CRIAR PRODUTO — ADMIN
// ======================================================

app.post(
  "/api/products",
  requireAdmin,
  async (req, res) => {
    try {
      const product =
        cleanProduct(req.body);

      const validation =
        validateProduct(product);

      if (validation) {
        return res.status(400).json({
          error: validation
        });
      }

      const result = await pool.query(
        `
        INSERT INTO products
        (
          name,
          category,
          type,
          price,
          description,
          image,
          available,
          size_type,
          sizes_json
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING
          id,
          name,
          category,
          type,
          price,
          description,
          image,
          available,
          size_type,
          sizes_json
        `,
        [
          product.name,
          product.category,
          product.type,
          product.price,
          product.description,
          product.image,
          product.available,
          product.sizeType,
          JSON.stringify(
            product.sizes
          )
        ]
      );

      res.status(201).json({
        ok: true,
        product:
          productFromRow(
            result.rows[0]
          )
      });

    } catch (error) {
      console.error(
        "ERRO AO CRIAR PRODUTO:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível criar o produto."
      });
    }
  }
);

// ======================================================
// EDITAR PRODUTO — ADMIN
// ======================================================

app.put(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID do produto inválido."
        });
      }

      const product =
        cleanProduct(req.body);

      const validation =
        validateProduct(product);

      if (validation) {
        return res.status(400).json({
          error: validation
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET
          name = $1,
          category = $2,
          type = $3,
          price = $4,
          description = $5,
          image = $6,
          available = $7,
          size_type = $8,
          sizes_json = $9
        WHERE id = $10
        RETURNING
          id,
          name,
          category,
          type,
          price,
          description,
          image,
          available,
          size_type,
          sizes_json
        `,
        [
          product.name,
          product.category,
          product.type,
          product.price,
          product.description,
          product.image,
          product.available,
          product.sizeType,
          JSON.stringify(
            product.sizes
          ),
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Produto não encontrado."
        });
      }

      res.json({
        ok: true,
        product:
          productFromRow(
            result.rows[0]
          )
      });

    } catch (error) {
      console.error(
        "ERRO AO EDITAR PRODUTO:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível editar o produto."
      });
    }
  }
);

// ======================================================
// APAGAR PRODUTO — ADMIN
// ======================================================

app.delete(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID do produto inválido."
        });
      }

      const result = await pool.query(
        `
        DELETE FROM products
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Produto não encontrado."
        });
      }

      res.json({
        ok: true
      });

    } catch (error) {
      console.error(
        "ERRO AO APAGAR PRODUTO:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível apagar o produto."
      });
    }
  }
);

// ======================================================
// PEDIDOS — CLIENTE
// ======================================================

app.post(
  "/api/orders",
  orderLimiter,
  async (req, res) => {
    try {
      const customerName =
        cleanText(
          req.body.customerName,
          150
        );

      const customerPhone =
        cleanText(
          req.body.customerPhone,
          50
        );

      const items =
        Array.isArray(req.body.items)
          ? req.body.items
          : [];

      if (
        !customerName ||
        !customerPhone ||
        items.length === 0
      ) {
        return res.status(400).json({
          error:
            "Nome, telefone e produtos são obrigatórios."
        });
      }

      const productIds = [
        ...new Set(
          items
            .map((item) =>
              Number(item.id)
            )
            .filter((id) =>
              Number.isInteger(id)
            )
        )
      ];

      if (
        productIds.length === 0
      ) {
        return res.status(400).json({
          error:
            "Produtos inválidos."
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            name,
            category,
            type,
            price,
            description,
            image,
            available,
            size_type,
            sizes_json
          FROM products
          WHERE id = ANY($1::int[])
          `,
          [productIds]
        );

      const productMap =
        new Map();

      for (
        const row of result.rows
      ) {
        productMap.set(
          Number(row.id),
          productFromRow(row)
        );
      }

      const finalItems = [];
      let total = 0;

      for (
        const item of items
      ) {
        const id =
          Number(item.id);

        const product =
          productMap.get(id);

        if (!product) {
          return res.status(400).json({
            error:
              "Um dos produtos não existe."
          });
        }

        if (!product.available) {
          return res.status(400).json({
            error:
              `O produto "${product.name}" não está disponível.`
          });
        }

        const quantity =
          Math.max(
            1,
            Math.min(
              99,
              Number(item.quantity) || 1
            )
          );

        let size = "";

        if (product.sizeType) {
          size = cleanText(
            item.size,
            20
          );

          if (
            !product.sizes.includes(
              size
            )
          ) {
            return res.status(400).json({
              error:
                `Selecione um tamanho válido para "${product.name}".`
            });
          }
        }

        const subtotal =
          Number(product.price) *
          quantity;

        total += subtotal;

        finalItems.push({
          id: product.id,
          name: product.name,
          price: Number(
            product.price
          ),
          quantity,
          size
        });
      }

      total =
        Math.round(
          total * 100
        ) / 100;

      await pool.query(
        `
        INSERT INTO orders
        (
          customer_name,
          customer_phone,
          items_json,
          total
        )
        VALUES
        ($1,$2,$3,$4)
        `,
        [
          customerName,
          customerPhone,
          JSON.stringify(
            finalItems
          ),
          total
        ]
      );

      let message =
        `Olá! Quero fazer um pedido na Lumexa Store.%0A%0A`;

      message +=
        `Cliente: ${encodeURIComponent(
          customerName
        )}%0A`;

      message +=
        `Telefone: ${encodeURIComponent(
          customerPhone
        )}%0A%0A`;

      for (
        const item of finalItems
      ) {
        message +=
          `• ${encodeURIComponent(
            item.name
          )} x ${item.quantity}`;

        if (item.size) {
          message +=
            ` — Tamanho: ${encodeURIComponent(
              item.size
            )}`;
        }

        message +=
          ` — ${encodeURIComponent(
            Number(
              item.price
            ).toLocaleString(
              "pt-PT"
            )
          )} ${STORE_CURRENCY}%0A`;
      }

      message +=
        `%0ATotal: ${encodeURIComponent(
          total.toLocaleString(
            "pt-PT"
          )
        )} ${STORE_CURRENCY}`;

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

      res.status(201).json({
        ok: true,
        total,
        whatsappUrl
      });

    } catch (error) {
      console.error(
        "ERRO AO CRIAR PEDIDO:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível criar o pedido."
      });
    }
  }
);

// ======================================================
// LISTAR PEDIDOS — ADMIN
// ======================================================

app.get(
  "/api/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            customer_name,
            customer_phone,
            items_json,
            total,
            created_at
          FROM orders
          ORDER BY id DESC
        `);

      const orders =
        result.rows.map((row) => {
          let items = [];

          try {
            items =
              JSON.parse(
                row.items_json || "[]"
              );
          } catch {
            items = [];
          }

          return {
            id: row.id,
            customerName:
              row.customer_name,
            customerPhone:
              row.customer_phone,
            items,
            total:
              Number(row.total),
            createdAt:
              row.created_at
          };
        });

      res.json(orders);

    } catch (error) {
      console.error(
        "ERRO AO BUSCAR PEDIDOS:",
        error
      );

      res.status(500).json({
        error:
          "Não foi possível carregar os pedidos."
      });
    }
  }
);

// ======================================================
// ARQUIVOS PÚBLICOS
// ======================================================

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

// ======================================================
// FALLBACK
// ======================================================

app.use(
  (req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith(
        "/api/"
      )
    ) {
      return res.sendFile(
        path.join(
          __dirname,
          "public",
          "index.html"
        )
      );
    }

    next();
  }
);

// ======================================================
// ERROS
// ======================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "ERRO:",
      err
    );

    if (
      err.code ===
      "EBADCSRFTOKEN"
    ) {
      return res.status(403).json({
        error:
          "Invalid CSRF token."
      });
    }

    res.status(
      err.status || 500
    ).json({
      error:
        "Erro interno do servidor."
    });
  }
);

// ======================================================
// INICIAR
// ======================================================

initDatabase()
  .then(() => {
    app.listen(
      PORT,
      () => {
        console.log(
          `Lumexa Store rodando na porta ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "Falha ao inicializar o banco de dados:",
      error
    );

    process.exit(1);
  });
