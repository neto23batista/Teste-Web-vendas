# FarmaVida Next

E-commerce de farmácia com loja, conta do cliente e administração por unidade.
O canal online é **MIP-only**: produtos sujeitos a prescrição permanecem inativos.
A integração com InovaFarma foi removida; suas migrações históricas foram preservadas.

## Começar

Requisitos: **Node 22**, npm e **PostgreSQL**. O CI usa PostgreSQL 16.
Configure um `.env` local a partir de `.env.example`, sem substituir arquivos
existentes nem copiar credenciais de produção para os testes.

No Windows/PowerShell:

```powershell
npm.cmd ci
npm.cmd run db:migrate:deploy
npm.cmd run dev
```

O servidor de desenvolvimento usa `http://localhost:3000`. A aplicação precisa
de banco migrado, `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `AUTH_SECRET` válido.
O seed não faz parte da inicialização normal: ele apaga dados e é reservado a
ambientes locais descartáveis com confirmação explícita.

Passo a passo, ambiente de testes e comandos de validação:
[Desenvolvimento local](docs/DEVELOPMENT.md).

## Stack e fluxos

- Next.js 16, React 19 e TypeScript, com App Router e Server Actions.
- Prisma 6 e PostgreSQL; ofertas e estoque separados por unidade.
- Auth.js, autorização por perfil/unidade e MFA para a equipe.
- Lotes, validade, reservas, transferências, devoluções e comprovante de entrega.
- Tailwind CSS 4, Radix, Lucide, Framer Motion e componentes próprios.
- Stripe para cartão/Pix quando habilitado; credenciais e homologação são externas
  ao repositório. Assinaturas de reposição não fazem cobrança automática.

## Organização

```text
src/
  app/              Rotas, páginas, layouts e APIs do Next.js
  actions/          Entradas de servidor: admin/, account/ e store/
  components/       Interface por área; checkout dividido em seções
  hooks/            Estado e interações do cliente
  lib/              Regras e serviços por domínio; infraestrutura compartilhada
  types/            Tipos de integração e augmentations
prisma/             Schema, migrações históricas e seed protegido
integration/        Testes com PostgreSQL real e dados descartáveis
e2e/                Fluxos de navegador
scripts/            assets/, ops/, qa/ e quality/
docs/               Arquitetura, desenvolvimento, operação e liberação
```

O mapa dos domínios e as regras de dependência estão em
[Arquitetura](docs/ARCHITECTURE.md).

## Comandos principais

| Comando                       | Finalidade                                               |
| ----------------------------- | -------------------------------------------------------- |
| `npm run dev`                 | Desenvolvimento local                                    |
| `npm run build` / `npm start` | Build e execução de produção                             |
| `npm run check`               | Arquitetura, lint, tipos e testes locais sem banco       |
| `npm test`                    | Testes unitários, de ações e renderização de componentes |
| `npm run test:integration`    | Concorrência e rollback em PostgreSQL descartável        |
| `npm run test:e2e`            | Testes de navegador; escrita exige ambiente isolado      |
| `npm run test:design`         | Design, axe, temas, zoom, teclado e HTML sem JavaScript  |
| `npm run db:migrate:deploy`   | Aplica migrações existentes no banco configurado         |
| `npm run db:migrate`          | Cria/aplica migrações durante desenvolvimento            |
| `npm run db:seed`             | Recria dados demo; exige confirmação e recusa produção   |
| `npm run check:ratelimit`     | Verifica o rate limit configurado com chamadas reais     |
| `npm run shots`               | Capturas de QA de um servidor já disponível              |
| `npm run assets:icons`        | Regenera ícones do PWA a partir do SVG existente         |

No PowerShell, prefira `npm.cmd` no lugar de `npm`.

## Documentação de referência

- [Arquitetura e convenções](docs/ARCHITECTURE.md)
- [Sistema de design e gates de UI](docs/DESIGN-SYSTEM.md)
- [Resultados e limites da revisão de design](docs/DESIGN-VALIDATION.md)
- [Ambiente local e testes](docs/DEVELOPMENT.md)
- [Pagamentos e homologação](docs/PAYMENTS.md)
- [Operação e procedimentos sensíveis](docs/OPERATIONS.md)
- [Deploy e migrações controladas](docs/DEPLOY.md)
- [Checklist de go-live](docs/GO-LIVE.md)
- [Validação local de 02/09/2026 e pendências](docs/VALIDATION.md)

Uma suíte local verde não comprova prontidão de produção. A liberação exige
validar banco, migrações, navegador, provedores e os responsáveis pela operação.
Nenhuma credencial de produção, senha inicial ou cópia de dados pessoais deve
ser incluída no Git.
