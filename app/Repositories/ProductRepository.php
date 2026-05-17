<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Services\BranchService;

final class ProductRepository extends BaseRepository
{
    public function paginate(array $filters = [], int $page = 1, int $perPage = 16): array
    {
        return $this->paginateProducts($filters, $page, $perPage, true);
    }

    public function paginateForAdmin(array $filters = [], int $page = 1, int $perPage = 16): array
    {
        return $this->paginateProducts($filters, $page, $perPage, false);
    }

    private function paginateProducts(array $filters = [], int $page = 1, int $perPage = 16, bool $publicOnly = true): array
    {
        $where = ['p.deleted_at IS NULL'];
        $params = [];
        $branchId = $this->branchIdForFilters($filters, !$publicOnly);
        [$stockJoin, $stockSelect] = $this->stockJoin($branchId, $params);

        if ($publicOnly) {
            $where[] = 'p.is_active = 1';
            $where[] = "p.visibility = 'public'";
        }

        if (!empty($filters['q'])) {
            $where[] = '(p.name LIKE :q OR p.active_ingredient LIKE :q OR p.ean LIKE :q OR b.name LIKE :q)';
            $params['q'] = '%' . $filters['q'] . '%';
        }
        if (!empty($filters['category'])) {
            $where[] = 'c.slug = :category';
            $params['category'] = $filters['category'];
        }
        if (!empty($filters['brand'])) {
            $where[] = 'b.id = :brand';
            $params['brand'] = (int) $filters['brand'];
        }
        if (isset($filters['requires_prescription']) && $filters['requires_prescription'] !== '') {
            $where[] = 'p.requires_prescription = :requires_prescription';
            $params['requires_prescription'] = (int) $filters['requires_prescription'];
        }
        if (isset($filters['generic']) && $filters['generic'] !== '') {
            $where[] = 'p.is_generic = :generic';
            $params['generic'] = (int) $filters['generic'];
        }
        if (!empty($filters['promotion'])) {
            $where[] = 'p.promotional_price IS NOT NULL AND p.promotional_price > 0 AND p.promotional_price < p.sale_price';
        }
        if (($filters['price_min'] ?? '') !== '') {
            $where[] = 'COALESCE(NULLIF(p.promotional_price, 0), p.sale_price) >= :price_min';
            $params['price_min'] = (float) $filters['price_min'];
        }
        if (($filters['price_max'] ?? '') !== '') {
            $where[] = 'COALESCE(NULLIF(p.promotional_price, 0), p.sale_price) <= :price_max';
            $params['price_max'] = (float) $filters['price_max'];
        }
        if (!empty($filters['stock'])) {
            if ($filters['stock'] === 'low') {
                $where[] = 'COALESCE(ef.quantidade, p.current_stock) <= COALESCE(ef.estoque_minimo, p.minimum_stock) AND COALESCE(ef.quantidade, p.current_stock) > 0';
            } elseif ($filters['stock'] === 'zero') {
                $where[] = 'COALESCE(ef.quantidade, p.current_stock) <= 0';
            } elseif ($filters['stock'] === 'available') {
                $where[] = 'COALESCE(ef.quantidade, p.current_stock) > 0';
            }
        }

        $perPage = max(1, min(100, $perPage));
        $offset = max(0, ($page - 1) * $perPage);
        $sql = "SELECT p.*, {$stockSelect}, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name
                FROM products p
                {$stockJoin}
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN brands b ON b.id = p.brand_id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY p.is_active DESC, COALESCE(ef.quantidade, p.current_stock) > 0 DESC, p.is_featured DESC, p.name ASC
                LIMIT :limit OFFSET :offset";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value, is_int($value) ? \PDO::PARAM_INT : \PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function featured(int $limit = 8): array
    {
        $params = [];
        [$stockJoin, $stockSelect] = $this->stockJoin((new BranchService())->currentId(), $params);
        $stmt = $this->db->prepare("SELECT p.*, {$stockSelect}, c.name AS category_name, b.name AS brand_name
            FROM products p
            {$stockJoin}
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN brands b ON b.id = p.brand_id
            WHERE p.deleted_at IS NULL AND p.is_active = 1 AND p.visibility = 'public'
            ORDER BY p.is_featured DESC, p.updated_at DESC
            LIMIT :limit");
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value, \PDO::PARAM_INT);
        }
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function findBySlug(string $slug): ?array
    {
        $params = ['slug' => $slug];
        [$stockJoin, $stockSelect] = $this->stockJoin((new BranchService())->currentId(), $params);
        $stmt = $this->db->prepare("SELECT p.*, {$stockSelect}, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name
            FROM products p
            {$stockJoin}
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN brands b ON b.id = p.brand_id
            WHERE p.slug = :slug AND p.deleted_at IS NULL AND p.is_active = 1 AND p.visibility = 'public'
            LIMIT 1");
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function find(int $id, ?int $branchId = null): ?array
    {
        $params = ['id' => $id];
        [$stockJoin, $stockSelect] = $this->stockJoin($branchId ?? (new BranchService())->currentId(), $params);
        $stmt = $this->db->prepare("SELECT p.*, {$stockSelect}
            FROM products p
            {$stockJoin}
            WHERE p.id = :id AND p.deleted_at IS NULL LIMIT 1");
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function categories(): array
    {
        return $this->db->query('SELECT * FROM categories WHERE deleted_at IS NULL AND is_active = 1 ORDER BY display_order, name')->fetchAll();
    }

    public function brands(): array
    {
        return $this->db->query('SELECT * FROM brands WHERE is_active = 1 ORDER BY name')->fetchAll();
    }

    public function recommendations(int $productId, int $limit = 4): array
    {
        $params = ['id' => $productId];
        [$stockJoin, $stockSelect] = $this->stockJoin((new BranchService())->currentId(), $params);
        $stmt = $this->db->prepare("SELECT p.*, {$stockSelect}
            FROM product_recommendations pr
            INNER JOIN products p ON p.id = pr.recommended_product_id
            {$stockJoin}
            WHERE pr.product_id = :id AND pr.is_active = 1 AND p.deleted_at IS NULL AND p.is_active = 1 AND p.visibility = 'public'
            ORDER BY pr.priority DESC
            LIMIT :limit");
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value, \PDO::PARAM_INT);
        }
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("INSERT INTO products (
            public_id, category_id, brand_id, name, slug, internal_code, ean, sku,
            short_description, full_description, active_ingredient, presentation,
            anvisa_registration, registration_holder, sale_price, promotional_price, cost_price,
            current_stock, minimum_stock, maximum_stock, physical_location, aisle, shelf, drawer, sector,
            requires_prescription, prescription_type, remote_sale_policy, is_generic, is_thermosensitive,
            temperature_min_c, temperature_max_c, allows_delivery, allows_pickup, is_featured, is_active, visibility,
            search_keywords, main_image_path, created_by
        ) VALUES (
            :public_id, :category_id, :brand_id, :name, :slug, :internal_code, :ean, :sku,
            :short_description, :full_description, :active_ingredient, :presentation,
            :anvisa_registration, :registration_holder, :sale_price, :promotional_price, :cost_price,
            :current_stock, :minimum_stock, :maximum_stock, :physical_location, :aisle, :shelf, :drawer, :sector,
            :requires_prescription, :prescription_type, :remote_sale_policy, :is_generic, :is_thermosensitive,
            :temperature_min_c, :temperature_max_c, :allows_delivery, :allows_pickup, :is_featured, :is_active, :visibility,
            :search_keywords, :main_image_path, :created_by
        )");
        $stmt->execute($data);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $sets = [];
        foreach ($data as $key => $value) {
            $sets[] = "{$key} = :{$key}";
        }
        $data['id'] = $id;
        $sql = 'UPDATE products SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE id = :id';
        $this->db->prepare($sql)->execute($data);
    }

    private function branchIdForFilters(array $filters, bool $admin): ?int
    {
        if ($admin && is_admin_geral() && (($filters['id_filial'] ?? 'all') === 'all' || ($filters['id_filial'] ?? '') === '')) {
            return null;
        }
        if (isset($filters['id_filial']) && $filters['id_filial'] !== 'all' && (int) $filters['id_filial'] > 0) {
            return (int) $filters['id_filial'];
        }
        return (new BranchService())->currentId();
    }

    private function stockJoin(?int $branchId, array &$params): array
    {
        $select = 'COALESCE(ef.quantidade, p.current_stock) AS current_stock,
            COALESCE(ef.estoque_minimo, p.minimum_stock) AS minimum_stock,
            COALESCE(ef.estoque_maximo, p.maximum_stock) AS maximum_stock,
            COALESCE(ef.localizacao, p.physical_location) AS physical_location';

        if ($branchId === null) {
            return [
                'LEFT JOIN (
                    SELECT id_produto, SUM(quantidade) AS quantidade, MIN(estoque_minimo) AS estoque_minimo, MAX(estoque_maximo) AS estoque_maximo, MIN(localizacao) AS localizacao
                    FROM estoque_filial
                    GROUP BY id_produto
                ) ef ON ef.id_produto = p.id',
                $select,
            ];
        }

        $params['stock_filial_id'] = $branchId;
        return ['LEFT JOIN estoque_filial ef ON ef.id_produto = p.id AND ef.id_filial = :stock_filial_id', $select];
    }
}
