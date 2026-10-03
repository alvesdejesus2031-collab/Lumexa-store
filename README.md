# Lumexa Store

Loja online de várias categorias com:
- catálogo público;
- carrinho;
- pedidos enviados para WhatsApp +244 937 770 994;
- painel administrativo protegido por sessão no servidor;
- bcrypt para senha;
- CSRF;
- rate limiting;
- Helmet/CSP;
- SQLite para produtos, pedidos e sessões;
- disponibilidade de produtos;
- suporte opcional a TOTP/2FA.

## Instalação

Requer Node.js 20+.

1. Copie `.env.example` para `.env`.
2. Defina uma `SESSION_SECRET` longa e aleatória.
3. Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
4. Instale: `npm install`
5. Antes do primeiro arranque, crie o administrador com o comando abaixo:

```bash
node -e "require('dotenv').config(); const Database=require('better-sqlite3'); const bcrypt=require('bcrypt'); const db=new Database('lumexa.sqlite'); db.exec('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,totp_secret TEXT,created_at TEXT NOT NULL)'); bcrypt.hash(process.env.ADMIN_PASSWORD,12).then(h=>{db.prepare('INSERT INTO admins(email,password_hash,created_at) VALUES(?,?,?)').run(process.env.ADMIN_EMAIL.toLowerCase().trim(),h,new Date().toISOString()); console.log('Admin criado');})"
```

6. `npm start`
7. Coloque a aplicação atrás de HTTPS (por exemplo, um proxy reverso/serviço de hospedagem com TLS).

### 2FA
Para ativar TOTP, gere um segredo Base32 e coloque-o na coluna `totp_secret` do administrador. O login passa a exigir o código do autenticador.

## Segurança

Nenhum sistema web pode prometer segurança absoluta. Esta base evita colocar a senha de administrador no código público e faz a autorização no servidor. Em produção, use HTTPS, mantenha Node/dependências atualizados, faça backups do SQLite e use uma conta de hospedagem com proteção adequada.

## Personalização

O catálogo é intencionalmente genérico para a Lumexa Store: várias categorias. Produtos podem ser criados/editados/excluídos no painel.
