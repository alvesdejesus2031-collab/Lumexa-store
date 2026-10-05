require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const { authenticator } = require("otplib");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

const port = Number(process.env.PORT || 3000);
const whatsapp =
  process.env.WHATSAPP_NUMBER || "244937770994";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is required.");
  process.exit(1);
}

if (
  !process.env.ADMIN_EMAIL ||
  !process.env.ADMIN_PASSWORD
) {
  console.error(
    "ADMIN_EMAIL and ADMIN_PASSWORD are required."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      image TEXT DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      size_type TEXT NOT NULL DEFAULT '',
      sizes_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  /*
    Compatibilidade com instalações antigas.
    Se a tabela products já existia, estas colunas
    serão adicionadas sem apagar os produtos existentes.
  */

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS size_type TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sizes_json TEXT NOT NULL DEFAULT '[]'
  `);

  const email = String(process.env.ADMIN_EMAIL)
    .toLowerCase()
    .trim();

  const existing = await pool.query(
    "SELECT id FROM admins WHERE email = $1",
    [email]
  );

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash(
      String(process.env.ADMIN_PASSWORD),
      12
    );

    await pool.query(
      `INSERT INTO admins
       (email, password_hash, totp_secret)
       VALUES ($1, $2, $3)`,
      [
        email,
        passwordHash,
        process.env.ADMIN_TOTP_SECRET || null
      ]
    );

    console.log("Initial admin created.");
  }
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        scriptSrc: ["'self'"],

        connectSrc: ["'self'"],

        frameAncestors: ["'none'"],

        objectSrc: ["'none'"],

        baseUri: ["'self'"],

        formAction: ["'self'"]
      }
    },

    referrerPolicy: {
      policy: "no-referrer"
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
    limit: "50kb"
  })
);

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    proxy: true,

    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      "Too many login attempts. Try again later."
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", apiLimiter);

const csrfProtection = csrf();

app.use(csrfProtection);

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

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

function cleanSizes(sizeType, sizes) {
  if (!ALLOWED_SIZE_TYPES.includes(sizeType)) {
    return {
      sizeType: "",
      sizes: []
    };
  }

  if (!sizeType) {
    return {
      sizeType: "",
      sizes: []
    };
  }

  if (!Array.isArray(sizes)) {
    return {
      sizeType,
      sizes: []
    };
  }

  const allowed = ALLOWED_SIZES[sizeType];

  const clean = [
    ...new Set(
      sizes
        .map(x => String(x))
        .filter(x => allowed.includes(x))
    )
  ];

  return {
    sizeType,
    sizes: clean
  };
}

function validateProduct(product) {
  if (
    !product ||
    typeof product.name !== "string" ||
    product.name.trim().length < 1 ||
    typeof product.category !== "string" ||
    product.category.trim().length < 1 ||
    !Number.isInteger(Number(product.price)) ||
    Number(product.price) < 0
  ) {
    return false;
  }

  if (
    product.sizeType !== undefined &&
    !ALLOWED_SIZE_TYPES.includes(
      String(product.sizeType)
    )
  ) {
    return false;
  }

  return true;
}

function cleanProduct(product) {
  const sizeInfo = cleanSizes(
    String(product.sizeType || ""),
    product.sizes
  );

  return {
    name: product.name
      .trim()
      .slice(0, 120),

    category: product.category
      .trim()
      .slice(0, 80),

    description: String(
      product.description || ""
    ).slice(0, 1000),

    price: Number(product.price),

    image: String(
      product.image || ""
    ).slice(0, 2000000),

    available: !!product.available,

    sizeType: sizeInfo.sizeType,

    sizes: sizeInfo.sizes
  };
}

app.get("/api/csrf", (req, res) => {
  res.json({
    csrfToken: req.csrfToken()
  });
});

app.post(
  "/api/login",
  loginLimiter,
  async (req, res) => {
    try {
      const {
        email,
        password,
        code
      } = req.body || {};

      const result = await pool.query(
        "SELECT * FROM admins WHERE email = $1",
        [
          String(email || "")
            .toLowerCase()
            .trim()
        ]
      );

      const admin = result.rows[0];

      if (
        !admin ||
        !(await bcrypt.compare(
          String(password || ""),
          admin.password_hash
        ))
      ) {
        return res.status(401).json({
          error: "Invalid credentials"
        });
      }

      if (admin.totp_secret) {
        if (
          !code ||
          !authenticator.check(
            String(code),
            admin.totp_secret
          )
        ) {
          return res.status(401).json({
            error:
              "Two-factor authentication required"
          });
        }
      }

      req.session.regenerate(err => {
        if (err) {
          console.error(err);

          return res.status(500).json({
            error: "Session error"
          });
        }

        req.session.adminId = admin.id;

        req.session.save(saveError => {
          if (saveError) {
            console.error(saveError);

            return res.status(500).json({
              error: "Session save error"
            });
          }

          res.json({
            ok: true
          });
        });
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Login error"
      });
    }
  }
);

app.post(
  "/api/logout",
  requireAdmin,
  (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({
          error: "Logout error"
        });
      }

      res.json({
        ok: true
      });
    });
  }
);

app.get("/api/me", (req, res) => {
  res.json({
    admin: !!req.session.adminId
  });
});

app.get(
  "/api/products",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          category,
          description,
          price,
          image,
          available,
          size_type,
          sizes_json
        FROM products
        ORDER BY id DESC
      `);

      const products = result.rows.map(
        product => ({
          ...product,

          sizeType:
            product.size_type || "",

          sizes:
            JSON.parse(
              product.sizes_json || "[]"
            )
        })
      );

      res.json(products);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load products"
      });
    }
  }
);

app.post(
  "/api/products",
  requireAdmin,
  async (req, res) => {
    try {
      if (!validateProduct(req.body)) {
        return res.status(400).json({
          error: "Invalid product"
        });
      }

      const product =
        cleanProduct(req.body);

      const result = await pool.query(
        `INSERT INTO products
         (
           name,
           category,
           description,
           price,
           image,
           available,
           size_type,
           sizes_json
         )
         VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          product.name,
          product.category,
          product.description,
          product.price,
          product.image,
          product.available,
          product.sizeType,
          JSON.stringify(product.sizes)
        ]
      );

      res.json({
        id: result.rows[0].id
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Could not create product"
      });
    }
  }
);

app.put(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      if (!validateProduct(req.body)) {
        return res.status(400).json({
          error: "Invalid product"
        });
      }

      const product =
        cleanProduct(req.body);

      await pool.query(
        `UPDATE products
         SET
           name = $1,
           category = $2,
           description = $3,
           price = $4,
           image = $5,
           available = $6,
           size_type = $7,
           sizes_json = $8,
           updated_at = NOW()
         WHERE id = $9`,
        [
          product.name,
          product.category,
          product.description,
          product.price,
          product.image,
          product.available,
          product.sizeType,
          JSON.stringify(product.sizes),
          Number(req.params.id)
        ]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Could not update product"
      });
    }
  }
);

app.delete(
  "/api/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      await pool.query(
        "DELETE FROM products WHERE id = $1",
        [Number(req.params.id)]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Could not delete product"
      });
    }
  }
);

app.get(
  "/api/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM orders
         ORDER BY id DESC
         LIMIT 200`
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Could not load orders"
      });
    }
  }
);

app.post(
  "/api/orders",
  async (req, res) => {
    try {
      const {
        customerName,
        customerPhone,
        items
      } = req.body || {};

      if (
        !customerName ||
        !customerPhone ||
        !Array.isArray(items) ||
        !items.length
      ) {
        return res.status(400).json({
          error:
            "Incomplete order"
        });
      }

      if (items.length > 50) {
        return res.status(400).json({
          error:
            "Too many products"
        });
      }

      const ids = items
        .map(item => Number(item.id))
        .filter(Number.isInteger);

      if (!ids.length) {
        return res.status(400).json({
          error:
            "Invalid products"
        });
      }

      const result = await pool.query(
        `SELECT
           id,
           name,
           price,
           available,
           size_type,
           sizes_json
         FROM products
         WHERE id = ANY($1::int[])`,
        [ids]
      );

      const products = result.rows;

      let total = 0;

      const safeItems = [];

      for (const item of items) {
        const product =
          products.find(
            x =>
              x.id ===
              Number(item.id)
          );

        const qty = Math.max(
          1,
          Math.min(
            99,
            Number(item.qty) || 1
          )
        );

        if (
          !product ||
          !product.available
        ) {
          return res.status(400).json({
            error:
              "A product is unavailable"
          });
        }

        let availableSizes = [];

        try {
          availableSizes =
            JSON.parse(
              product.sizes_json ||
                "[]"
            );
        } catch {
          availableSizes = [];
        }

        let selectedSize =
          item.size
            ? String(item.size)
            : "";

        if (
          product.size_type &&
          availableSizes.length
        ) {
          if (
            !availableSizes.includes(
              selectedSize
            )
          ) {
            return res.status(400).json({
              error:
                "Selecione um tamanho válido."
            });
          }
        } else {
          selectedSize = "";
        }

        total +=
          product.price * qty;

        safeItems.push({
          id: product.id,

          name: product.name,

          price: product.price,

          qty,

          size: selectedSize
        });
      }

      const orderResult =
        await pool.query(
          `INSERT INTO orders
           (
             customer_name,
             customer_phone,
             items_json,
             total,
             status
           )
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id`,
          [
            String(customerName)
              .slice(0, 100),

            String(customerPhone)
              .slice(0, 40),

            JSON.stringify(
              safeItems
            ),

            total,

            "new"
          ]
        );

      const orderId =
        orderResult.rows[0].id;

      const lines =
        safeItems
          .map(item => {
            const sizeText =
              item.size
                ? ` | Tamanho: ${item.size}`
                : "";

            return (
              `- ${item.name}` +
              ` x${item.qty}` +
              `${sizeText}` +
              `: ` +
              `${item.price * item.qty}` +
              ` AOA`
            );
          })
          .join("\n");

      const message =
        `Olá, Lumexa Store! ` +
        `Quero fazer este pedido:\n\n` +

        `${lines}\n\n` +

        `Total: ${total} AOA\n` +

        `Nome: ${String(
          customerName
        ).slice(0, 100)}\n` +

        `Telefone: ${String(
          customerPhone
        ).slice(0, 40)}\n` +

        `Pedido #${orderId}`;

      res.json({
        ok: true,

        orderId,

        whatsappUrl:
          `https://wa.me/${whatsapp}` +
          `?text=` +
          encodeURIComponent(
            message
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Could not create order"
      });
    }
  }
);

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    ),
    {
      extensions: ["html"],
      dotfiles: "deny"
    }
  )
);

app.use(
  (req, res) => {
    res
      .status(404)
      .sendFile(
        path.join(
          __dirname,
          "public",
          "index.html"
        )
      );
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(error);

    if (
      error.code ===
      "EBADCSRFTOKEN"
    ) {
      return res.status(403).json({
        error:
          "Invalid CSRF token"
      });
    }

    res.status(500).json({
      error:
        "Internal server error"
    });
  }
);

async function start() {
  try {
    await initDatabase();

    app.listen(
      port,
      () => {
        console.log(
          `Lumexa Store running on port ${port}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Startup error:",
      error
    );

    process.exit(1);
  }
}

start();