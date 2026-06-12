/**
 * Valida URLs de fotos reais para os produtos do seed.
 *
 * Para cada produto há uma lista de candidatas (em ordem de preferência).
 * O script testa cada URL (status 200 + content-type image/*) e escolhe a
 * primeira aprovada que ainda não foi usada por outro produto (evita fotos
 * repetidas). O resultado vai para prisma/product-images.json — consumido
 * pelo prisma/seed.ts. Produto sem URL aprovada fica de fora (fallback emoji).
 *
 * Uso: node scripts/check-product-images.cjs
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const U = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const P = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

/** name → candidatas (ordem de preferência) */
const candidates = {
  // ── Medicamentos ────────────────────────────────────────────────
  "Dipirona Sódica 1g 10 comprimidos": [U("photo-1584308666744-24d5c474f2ae"), P("3683074"), U("photo-1550572017-edd951aa8f72")],
  "Paracetamol 750mg 20 comprimidos": [U("photo-1587854692152-cbe660dbde88"), P("159211"), U("photo-1607619056574-7b8d3ee536b2")],
  "Ibuprofeno 400mg 30 cápsulas": [U("photo-1471864190281-a93a3070b6de"), P("208512"), U("photo-1628771065518-0d82f1938462")],
  "Amoxicilina 500mg 21 cápsulas": [U("photo-1628771065518-0d82f1938462"), P("593451"), U("photo-1603807008857-ad66b70431e2")],
  "Losartana 50mg 30 comprimidos": [U("photo-1550572017-edd951aa8f72"), U("photo-1626716493137-b67fe9501e76"), P("3683074")],
  "Omeprazol 20mg 28 cápsulas": [U("photo-1607619056574-7b8d3ee536b2"), P("208512"), U("photo-1587854692152-cbe660dbde88")],
  "Loratadina 10mg 12 comprimidos": [U("photo-1626716493137-b67fe9501e76"), P("159211"), U("photo-1584308666744-24d5c474f2ae")],
  "Buscopan Composto 20 comprimidos": [U("photo-1603807008857-ad66b70431e2"), P("593451"), U("photo-1471864190281-a93a3070b6de")],

  // ── Saúde ───────────────────────────────────────────────────────
  "Termômetro Digital Clínico": [U("photo-1583947215259-38e31be8751f"), P("3873118"), U("photo-1576091160550-2173dba999ef")],
  "Álcool em Gel 70% 500ml": [U("photo-1585435557343-3b092031a831"), P("4202325"), U("photo-1605289982774-9a6fef564df8")],
  "Máscara Cirúrgica Tripla 50un": [U("photo-1584744982491-665216d95f8b"), P("3987142"), U("photo-1584036561566-baf8f5f1b144")],
  "Soro Fisiológico 0,9% 500ml": [U("photo-1576091160399-112ba8d25d1f"), P("4210557"), U("photo-1559839734-2b71ea197ec2")],
  "Oxímetro de Dedo Digital": [U("photo-1612277795421-9bc7706a4a34"), P("4225880"), U("photo-1579154204601-01588f351e67")],

  // ── Dermocosméticos ────────────────────────────────────────────
  "Protetor Solar Anthelios FPS 70": [U("photo-1556227834-09f1de7a7d14"), P("4465124"), U("photo-1526947425960-945c6e72858f")],
  "Gel de Limpeza Facial Effaclar 150ml": [U("photo-1556228720-195a672e8a03"), P("4047186"), U("photo-1571781926291-c477ebfd024b")],
  "Hidratante Facial CeraVe 52g": [U("photo-1576602976047-174e57a47881"), P("3762875"), U("photo-1598440947619-2c35fc9aa908")],
  "Sérum Vitamina C 30ml": [U("photo-1620916566398-39f1143ab7be"), P("4465124"), U("photo-1608248543803-ba4f8c70ae0b")],

  // ── Mamãe & Bebê ───────────────────────────────────────────────
  "Fralda Premium Tamanho M 64un": [U("photo-1515488042361-ee00e0ddd4e4"), P("5938567"), U("photo-1519689680058-324335c77eba")],
  "Lenço Umedecido 96un": [U("photo-1576092768241-dec231879fc3"), P("7282589"), U("photo-1515488042361-ee00e0ddd4e4")],
  "Pomada para Assaduras 45g": [U("photo-1519689680058-324335c77eba"), P("3845456"), U("photo-1544126592-807ade215a0b")],
  "Shampoo Infantil Sem Lágrimas 200ml": [U("photo-1544126592-807ade215a0b"), P("3845407"), U("photo-1576092768241-dec231879fc3")],

  // ── Vitaminas & Suplementos ────────────────────────────────────
  "Vitamina C 1g 30 comprimidos": [U("photo-1577174881658-0f30ed549adc"), P("1435735"), U("photo-1610725664285-7c57e6eeac3f")],
  "Vitamina D3 2000UI 60 cápsulas": [U("photo-1610725664285-7c57e6eeac3f"), P("4004612"), U("photo-1616671276441-2f2c277b8bf6")],
  "Ômega 3 1000mg 120 cápsulas": [U("photo-1616671276441-2f2c277b8bf6"), P("4004626"), U("photo-1577174881658-0f30ed549adc")],
  "Magnésio Quelato 60 cápsulas": [U("photo-1607006344380-b6775a0824a7"), P("3683098"), U("photo-1626716493137-b67fe9501e76")],
  "Multivitamínico A-Z 60 comprimidos": [U("photo-1579722820308-d74e571900a9"), P("3850689"), U("photo-1607006344380-b6775a0824a7")],
  "Colágeno Hidrolisado + Vit C 300g": [U("photo-1593095948071-474c5cc2989d"), P("4397840"), U("photo-1579722820308-d74e571900a9")],

  // ── Higiene & Cuidados ─────────────────────────────────────────
  "Creme Dental Branqueador 90g": [U("photo-1611930022073-b7a4ba5fcccd"), P("298611"), U("photo-1604719312566-8912e9227c6a")],
  "Enxaguante Bucal Sem Álcool 500ml": [U("photo-1625772452859-1c03d5bf1137"), P("4202924"), U("photo-1611930022073-b7a4ba5fcccd")],
  "Desodorante Roll-on 48h 50ml": [U("photo-1629198688000-71f23e745b6e"), P("4202926"), U("photo-1556228578-8c89e6adf883")],
  "Sabonete Líquido Antibacteriano 250ml": [U("photo-1606787366850-de6330128bfc"), P("4202325"), U("photo-1585435557343-3b092031a831")],

  // ── Beleza ─────────────────────────────────────────────────────
  "Batom Matte Longa Duração": [U("photo-1586495777744-4413f21062fa"), P("324655"), U("photo-1512496015851-a90fb38ba796")],
  "Base Líquida HD 30ml": [U("photo-1631214540242-3cd8c4b0b3b8"), P("2533266"), U("photo-1522335789203-aabd1fc54bc9")],
  "Máscara de Cílios Volume": [U("photo-1512496015851-a90fb38ba796"), P("2253833"), U("photo-1586495777744-4413f21062fa")],

  // ── Equipamentos ───────────────────────────────────────────────
  "Aparelho de Pressão Digital de Braço": [U("photo-1615486363973-f79f875a4b7b"), P("7659564"), U("photo-1505751172876-fa1923c5c528")],
  "Nebulizador Inalador Compacto": [U("photo-1584036561566-baf8f5f1b144"), P("4226219"), U("photo-1559757148-5c350d0d3c56")],
  "Glicosímetro + 50 tiras": [U("photo-1579154204601-01588f351e67"), P("6823567"), U("photo-1615486363973-f79f875a4b7b")],
  "Balança Digital Corporal": [U("photo-1518611012118-696072aa579a"), P("4498152"), U("photo-1535914254981-b5012eebbd15")],
};

function check(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      const ok =
        res.statusCode === 200 &&
        String(res.headers["content-type"] || "").startsWith("image/");
      res.destroy();
      resolve(ok);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

module.exports = { candidates };

// Só roda a validação quando chamado diretamente (permite importar `candidates`).
if (require.main !== module) return;

(async () => {
  const result = {};
  const used = new Set();
  let okCount = 0;
  for (const [name, urls] of Object.entries(candidates)) {
    let chosen = null;
    for (const url of urls) {
      if (used.has(url)) continue; // sem fotos repetidas entre produtos
      // eslint-disable-next-line no-await-in-loop
      if (await check(url)) {
        chosen = url;
        break;
      }
    }
    // 2ª passada: aceita repetida se nada exclusivo passou
    if (!chosen) {
      for (const url of urls) {
        // eslint-disable-next-line no-await-in-loop
        if (await check(url)) {
          chosen = url;
          break;
        }
      }
    }
    if (chosen) {
      result[name] = chosen;
      used.add(chosen);
      okCount++;
      console.log(`OK   ${name}`);
    } else {
      console.log(`FAIL ${name} (mantém emoji)`);
    }
  }
  const out = path.join(__dirname, "..", "prisma", "product-images.json");
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `\n${okCount}/${Object.keys(candidates).length} produtos com foto real → ${path.relative(process.cwd(), out)}`
  );
})();
