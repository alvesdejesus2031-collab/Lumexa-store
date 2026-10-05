require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csurf = require("csurf");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const isProduction =
  process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false
});

/* =========================
   CONFIGURAÇÃO
========================= */

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
  shirt: [
    "S",
    "M",
    "L",
    "XL",
    "XXL"
  ],

  pants: [
    "32",
    "34",
    "36",
    "38",
    "40",
    "42",
    "44"
  ],

  shoe: [
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44"
  ]
};

/* =========================
   APP
========================= */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        connectSrc: [
          "'self'"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        objectSrc: [
          "'none'"
        ],

        baseUri: [
          "'self'"
        ],

        frameAncestors: [
          "'none'"
        ]
      }
    }
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "2mb"
  })
);

/* =========================
   RATE LIMIT
========================= */

const loginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      error:
        "Muitas tentativas. Aguarde alguns minutos."
    }
  });

const orderLimiter =
  rateLimit({
    windowMs:
      10 * 60 * 1000,

    max: 30,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      error:
        "Muitos pedidos. Aguarde alguns minutos."
    }
  });

/* =========================
   SESSÃO
========================= */

app.use(
  session({
    store: new pgSession({
      pool,

      tableName:
        "user_sessions",

      createTableIfMissing:
        true
    }),

    secret:
      process.env.SESSION_SECRET ||
      "change-this-secret",

    resave: false,

    saveUninitialized: false,

    proxy: true,

    cookie: {
      httpOnly: true,

      secure: isProduction,

      sameSite: "strict",

      maxAge:
        1000 *
        60 *
        60 *
        8
    }
  })
);

/* =========================
   CSRF
========================= */

const csrfProtection =
  csurf({
    cookie: false
  });

/*
  O endpoint público de pedidos
  NÃO usa CSRF porque é usado pelo
  cliente sem autenticação.

  Os endpoints administrativos continuam
  protegidos por CSRF.
*/

app.use(
  (req, res, next) => {
    if (
      req.path ===
      "/api/orders"
    ) {
      return next();
    }

    return csrfProtection(
      req,
      res,
      next
    );
  }
);

/* =========================
   BANCO DE DADOS
========================= */

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
      category TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(14,2) NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      size_type TEXT NOT NULL DEFAULT '',
      sizes_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  /* Compatibilidade com bases antigas */

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS
    size_type TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS
    sizes_json TEXT NOT NULL DEFAULT '[]'
  `);

  if (
    ADMIN_EMAIL &&
    ADMIN_PASSWORD
  ) {
    const existing =
      await pool.query(
        "SELECT id FROM admins WHERE email = $1 LIMIT 1",
        [ADMIN_EMAIL]
      );

    if (
      existing.rows.length === 0
    ) {
      const hash =
        await bcrypt.hash(
          ADMIN_PASSWORD,
          12
        );

      await pool.query(
        `
        INSERT INTO admins
        (email, password_hash)
        VALUES ($1, $2)
        `,
        [
          ADMIN_EMAIL,
          hash
        ]
      );
    }
  }
}

/* =========================
   FUNÇÕES AUXILIARES
========================= */

function cleanText(
  value,
  maxLength = 5000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function cleanSizes(
  sizeType,
  sizes
) {
  if (
    !ALLOWED_SIZE_TYPES.includes(
      sizeType
    )
  ) {
    return [];
  }

  if (!sizeType) {
    return [];
  }

  if (!Array.isArray(sizes)) {
    return [];
  }

  const allowed =
    ALLOWED_SIZES[sizeType];

  return [
    ...new Set(
      sizes
        .map(value =>
          String(value)
        )
        .filter(value =>
          allowed.includes(value)
        )
    )
  ];
}

function cleanProduct(
  body
) {
  const sizeType =
    ALLOWED_SIZE_TYPES.includes(
      body.sizeType
    )
      ? body.sizeType
      : "";

  const sizes =
    cleanSizes(
      sizeType,
      body.sizes
    );

  const price =
    Number(body.price);

  return {
    name: cleanText(
      body.name,
      200
    ),

    category: cleanText(
      body.category,
      100
    ),

    type: cleanText(
      body.type,
      100
    ),

    description: cleanText(
      body.description,
      5000
    ),

    price:
      Number.isFinite(price) &&
      price >= 0
        ? price
        : 0,

    image: cleanText(
      body.image,
      1500000
    ),

    available:
      body.available !== false,

    sizeType,

    sizes
  };
}

function validateProduct(
  product
) {
  if (!product.name) {
    return "O nome do produto é obrigatório.";
  }

  if (!product.category) {
    return "A categoria é obrigatória.";
  }

  if (
    !Number.isFinite(
      product.price
    ) ||
    product.price < 0
  ) {
    return "O preço é inválido.";
  }

  if (
    product.sizeType &&
    product.sizes.length === 0
  ) {
    return "Selecione pelo menos um tamanho.";
  }

  return null;
}

function productFromRow(
  row
) {
  let sizes = [];

  try {
    sizes =
      JSON.parse(
        row.sizes_json || "[]"
      );
  } catch {
    sizes = [];
  }

  return {
    id: row.id,

    name: row.name,

    category:
      row.category,

    type:
      row.type,

    description:
      row.description,

    price:
      Number(row.price),

    image:
      row.image,

    available:
      Boolean(row.available),

    sizeType:
      row.size_type || "",

    sizes:
      Array.isArray(sizes)
        ? sizes
        : []
  };
}

function requireAdmin(
  req,
  res,
  next
) {
  if (
    !req.session ||
    !req.session.adminId
  ) {
    return res
      .status(401)
      .json({
        error:
          "Não autorizado."
      });
  }

  next();
}

/* =========================
   CSRF TOKEN
========================= */

app.get(
  "/api/csrf",
  (req, res) => {
    res.json({
      csrfToken:
        req.csrfToken()
    });
  }
);

/* =========================
   AUTENTICAÇÃO
========================= */

app.post(
  "/api/login",
  loginLimiter,
  async (req, res) => {
    try {
      const email =
        cleanText(
          req.body.email,
          200
        ).toLowerCase();

      const password =
        String(
          req.body.password || ""
        );

      if (
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            error:
              "Email e senha são obrigatórios."
          });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM admins
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [email]
        );

      if (
        result.rows.length === 0
      ) {
        return res
          .status(401)
          .json({
            error:
              "Credenciais inválidas."
          });
      }

      const admin =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          admin.password_hash
        );

      if (!valid) {
        return res
          .status(401)
          .json({
            error:
              "Credenciais inválidas."
          });
      }

      req.session.adminId =
        admin.id;

      req.session.adminEmail =
        admin.email;

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Erro interno."
        });
    }
  }
);

app.post(
  "/api/logout",
  requireAdmin,
  (req, res) => {
    req.session.destroy(
      () => {
        res.json({
          ok: true
        });
      }
    );
  }
);

app.get(
  "/api/me",
  (req, res) => {
    if (
      req.session &&
      req.session.adminId
    ) {
      return res.json({
        loggedIn: true,

        email:
          req.session
            .adminEmail || ""
      });
    }

    res.json({
      loggedIn: false
    });
  }
);

/* =========================
   PRODUTOS PÚBLICOS
========================= */

app.get(
  "/api/products",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM products
          ORDER BY id DESC
          `
        );

      res.json(
        result.rows.map(
          productFromRow
        )
      );
    } catch (error) {
      console.error(
        "PRODUCTS ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível carregar os produtos."
        });
    }
  }
);

/* =========================
   ADMIN — PRODUTOS
========================= */

app.post(
  "/api/products",
  requireAdmin,
  async (req, res) => {
    try {
      const product =
        cleanProduct(
          req.body
        );

      const validation =
        validateProduct(
          product
        );

      if (validation) {
        return res
          .status(400)
          .json({
            error:
              validation
          });
      }

      const result =
        await pool.query(
          `
          INSERT INTO products
          (
            name,
            category,
            type,
            description,
            price,
            image,
            available,
            size_type,
            sizes_json
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING *
          `,
          [
            product.name,
            product.category,
            product.type,
            product.description,
            product.price,
            product.image,
            product.available,
            product.sizeType,
            JSON.stringify(
              product.sizes
            )
          ]
        );

      res.json({
        ok: true,

        product:
          productFromRow(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(
        "CREATE PRODUCT ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível criar o produto."
        });
    }
  }
);

app.put(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID inválido."
          });
      }

      const product =
        cleanProduct(
          req.body
        );

      const validation =
        validateProduct(
          product
        );

      if (validation) {
        return res
          .status(400)
          .json({
            error:
              validation
          });
      }

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            name = $1,
            category = $2,
            type = $3,
            description = $4,
            price = $5,
            image = $6,
            available = $7,
            size_type = $8,
            sizes_json = $9,
            updated_at = NOW()
          WHERE id = $10
          RETURNING *
          `,
          [
            product.name,
            product.category,
            product.type,
            product.description,
            product.price,
            product.image,
            product.available,
            product.sizeType,
            JSON.stringify(
              product.sizes
            ),
            id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
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
        "UPDATE PRODUCT ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível atualizar o produto."
        });
    }
  }
);

app.delete(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID inválido."
          });
      }

      const result =
        await pool.query(
          `
          DELETE FROM products
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Produto não encontrado."
          });
      }

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "DELETE PRODUCT ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível eliminar o produto."
        });
    }
  }
);

/* =========================
   PEDIDOS
========================= */

app.post(
  "/api/orders",
  orderLimiter,
  async (req, res) => {
    try {
      const customerName =
        cleanText(
          req.body.customerName,
          200
        );

      const customerPhone =
        cleanText(
          req.body.customerPhone,
          50
        );

      const items =
        Array.isArray(
          req.body.items
        )
          ? req.body.items
          : [];

      if (!customerName) {
        return res
          .status(400)
          .json({
            error:
              "Digite o seu nome."
          });
      }

      if (!customerPhone) {
        return res
          .status(400)
          .json({
            error:
              "Digite o seu telefone."
          });
      }

      if (
        items.length === 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "O pedido está vazio."
          });
      }

      const normalizedItems =
        [];

      let total = 0;

      for (
        const item of items
      ) {
        const id =
          Number(item.id);

        const qty =
          Number(item.qty);

        const size =
          cleanText(
            item.size,
            20
          );

        if (
          !Number.isInteger(id) ||
          !Number.isInteger(qty) ||
          qty < 1 ||
          qty > 99
        ) {
          return res
            .status(400)
            .json({
              error:
                "Produto ou quantidade inválida."
            });
        }

        const result =
          await pool.query(
            `
            SELECT *
            FROM products
            WHERE id = $1
            LIMIT 1
            `,
            [id]
          );

        if (
          result.rows.length === 0
        ) {
          return res
            .status(400)
            .json({
              error:
                "Um dos produtos não existe."
            });
        }

        const product =
          productFromRow(
            result.rows[0]
          );

        if (
          !product.available
        ) {
          return res
            .status(400)
            .json({
              error:
                `O produto "${product.name}" não está disponível.`
            });
        }

        if (
          product.sizeType &&
          product.sizes.length > 0
        ) {
          if (
            !product.sizes.includes(
              size
            )
          ) {
            return res
              .status(400)
              .json({
                error:
                  `Escolha um tamanho válido para "${product.name}".`
              });
          }
        }

        const subtotal =
          Number(
            product.price
          ) * qty;

        total += subtotal;

        normalizedItems.push({
          id:
            product.id,

          name:
            product.name,

          price:
            Number(
              product.price
            ),

          qty,

          size
        });
      }

      const result =
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
          RETURNING id
          `,
          [
            customerName,
            customerPhone,
            JSON.stringify(
              normalizedItems
            ),
            total
          ]
        );

      const orderId =
        result.rows[0].id;

      let message =
        `Olá! Quero fazer o pedido #${orderId}%0A%0A`;

      message +=
        `Nome: ${encodeURIComponent(
          customerName
        )}%0A`;

      message +=
        `Telefone: ${encodeURIComponent(
          customerPhone
        )}%0A%0A`;

      for (
        const item of normalizedItems
      ) {
        message +=
          `${encodeURIComponent(
            item.name
          )} x${item.qty}`;

        if (item.size) {
          message +=
            ` — Tamanho: ${encodeURIComponent(
              item.size
            )}`;
        }

        message +=
          `%0A`;
      }

      message +=
        `%0ATotal: ${encodeURIComponent(
          total.toFixed(2)
        )} ${encodeURIComponent(
          STORE_CURRENCY
        )}`;

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

      res.json({
        ok: true,

        orderId,

        whatsappUrl
      });
    } catch (error) {
      console.error(
        "ORDER ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível criar o pedido."
        });
    }
  }
);

/* =========================
   ADMIN — PEDIDOS
========================= */

app.get(
  "/api/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM orders
          ORDER BY id DESC
          LIMIT 100
          `
        );

      const orders =
        result.rows.map(
          row => {
            let items = [];

            try {
              items =
                JSON.parse(
                  row.items_json ||
                    "[]"
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
                Number(
                  row.total
                ),

              createdAt:
                row.created_at
            };
          }
        );

      res.json(orders);
    } catch (error) {
      console.error(
        "ORDERS ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Não foi possível carregar os pedidos."
        });
    }
  }
);

/* =========================
   FICHEIROS PÚBLICOS
========================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    ),
    {
      index:
        "index.html"
    }
  )
);

/* =========================
   FALLBACK
========================= */

app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================
   ERROS
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error.code ===
      "EBADCSRFTOKEN"
    ) {
      return res
        .status(403)
        .json({
          error:
            "Token CSRF inválido."
        });
    }

    res
      .status(500)
      .json({
        error:
          "Erro interno do servidor."
      });
  }
);

/* =========================
   INICIAR
========================= */

initDatabase()
  .then(() => {
    app.listen(
      PORT,
      () => {
        console.log(
          `Lumexa Store running on port ${PORT}`
        );
      }
    );
  })
  .catch(error => {
    console.error(
      "DATABASE START ERROR:",
      error
    );

    process.exit(1);
  });