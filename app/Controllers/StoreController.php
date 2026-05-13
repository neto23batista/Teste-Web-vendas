<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Services\ProductService;

final class StoreController extends Controller
{
    public function home(Request $request): void
    {
        $this->render('store/home', [
            'title' => 'FarmaVida',
            'description' => 'Compre medicamentos e produtos de cuidado na FarmaVida com receita protegida, pagamento seguro, entrega local e retirada na loja.',
            'products' => (new ProductService())->featured(),
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    public function catalog(Request $request): void
    {
        $data = (new ProductService())->catalog([
            'q' => $request->input('q', ''),
            'category' => $request->input('category', ''),
            'brand' => $request->input('brand', ''),
            'requires_prescription' => $request->input('requires_prescription', ''),
            'generic' => $request->input('generic', ''),
            'promotion' => $request->input('promotion', ''),
            'price_min' => $request->input('price_min', ''),
            'price_max' => $request->input('price_max', ''),
            'stock' => $request->input('stock', ''),
        ], (int) $request->input('page', 1));
        $this->render('store/catalog', array_merge($data, [
            'title' => 'Catalogo',
            'description' => 'Catalogo FarmaVida com medicamentos, dermocosmeticos, genericos, promocoes, filtros por laboratorio, receita e disponibilidade.',
            'pharmacy' => $this->pharmacy(),
        ]));
    }

    public function product(Request $request): void
    {
        $product = (new ProductService())->detail((string) $request->param('slug'));
        if (!$product) {
            http_response_code(404);
            echo view('errors/404', ['title' => 'Produto nao encontrado']);
            return;
        }
        $this->render('store/product', [
            'title' => $product['name'],
            'description' => trim((string) ($product['short_description'] ?? '')) ?: 'Produto FarmaVida com compra segura, informacoes farmaceuticas e disponibilidade controlada.',
            'product' => $product,
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    public function autocomplete(Request $request): void
    {
        $q = trim((string) $request->input('q', ''));
        if (strlen($q) < 2) {
            $this->json(['items' => []]);
            return;
        }
        $stmt = Database::connection()->prepare("SELECT id, name, slug, active_ingredient FROM products WHERE deleted_at IS NULL AND is_active = 1 AND visibility = 'public' AND (name LIKE :q OR active_ingredient LIKE :q OR ean LIKE :q) ORDER BY name LIMIT 10");
        $stmt->execute(['q' => '%' . $q . '%']);
        $this->json(['items' => $stmt->fetchAll()]);
    }

    public function institutional(Request $request): void
    {
        $this->render('legal/institutional', [
            'title' => 'Informacoes da farmacia',
            'description' => 'Dados institucionais da FarmaVida, responsavel farmaceutico, licencas sanitarias e canais de atendimento.',
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    public function privacy(Request $request): void
    {
        $this->render('legal/privacy', [
            'title' => 'Politica de privacidade',
            'description' => 'Politica de privacidade FarmaVida para dados pessoais, receitas, LGPD, seguranca e direitos do titular.',
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    public function terms(Request $request): void
    {
        $this->render('legal/terms', [
            'title' => 'Termos de uso',
            'description' => 'Termos de uso FarmaVida para compras, receitas, pagamentos, entrega, retirada, privacidade e responsabilidades.',
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    public function clinicalFaq(Request $request): void
    {
        $this->render('legal/clinical_faq', [
            'title' => 'FAQ clinico',
            'description' => 'Duvidas frequentes sobre receitas, medicamentos controlados, validacao farmaceutica e compra segura.',
            'pharmacy' => $this->pharmacy(),
        ]);
    }

    private function pharmacy(): array
    {
        return Database::connection()->query('SELECT * FROM pharmacy_profiles WHERE is_active = 1 ORDER BY id DESC LIMIT 1')->fetch() ?: [];
    }
}
