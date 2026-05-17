<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ProductRepository;

final class ProductService
{
    public function __construct(private ?ProductRepository $products = null)
    {
        $this->products ??= new ProductRepository();
    }

    public function catalog(array $filters, int $page = 1): array
    {
        return [
            'products' => $this->products->paginate($filters, $page),
            'categories' => $this->products->categories(),
            'brands' => $this->products->brands(),
            'filters' => $filters,
        ];
    }

    public function adminCatalog(array $filters, int $page = 1): array
    {
        return [
            'products' => $this->products->paginateForAdmin($filters, $page),
            'categories' => $this->products->categories(),
            'brands' => $this->products->brands(),
            'filters' => $filters,
        ];
    }

    public function featured(): array
    {
        return $this->products->featured();
    }

    public function detail(string $slug): ?array
    {
        $product = $this->products->findBySlug($slug);
        if (!$product) {
            return null;
        }
        $product['recommendations'] = $this->products->recommendations((int) $product['id']);
        $product['review_summary'] = (new ProductReviewService())->productSummary((int) $product['id']);
        return $product;
    }

    public function createFromAdmin(array $input, ?array $image = null): int
    {
        $data = $this->normalizeAdminData($input);
        $branchId = $this->branchIdFromInput($input);
        $data['public_id'] = uuid_v4();
        $data['created_by'] = user()['id'] ?? null;
        $data['main_image_path'] = $image ? $this->storeImage($image) : null;
        $id = $this->products->create($data);
        (new StockService())->upsertProductStock($id, $branchId, (int) $data['current_stock'], (int) $data['minimum_stock'], $data['maximum_stock'], (string) $data['physical_location']);
        if ($data['main_image_path']) {
            $this->registerImage($id, $data['main_image_path'], $image);
        }
        (new AuditService())->admin('products', 'created', 'product', $id, [], $data);
        return $id;
    }

    public function updateFromAdmin(int $id, array $input, ?array $image = null): void
    {
        $data = $this->normalizeAdminData($input, false);
        $branchId = $this->branchIdFromInput($input);
        $data['updated_by'] = user()['id'] ?? null;
        if ($image && ($image['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            $data['main_image_path'] = $this->storeImage($image);
            $this->registerImage($id, $data['main_image_path'], $image);
        }
        $this->products->update($id, $data);
        (new StockService())->upsertProductStock($id, $branchId, (int) $data['current_stock'], (int) $data['minimum_stock'], $data['maximum_stock'], (string) $data['physical_location']);
        (new AuditService())->admin('products', 'updated', 'product', $id, [], $data);
    }

    private function normalizeAdminData(array $input, bool $create = true): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $slug = trim((string) ($input['slug'] ?? '')) ?: str_slug($name);
        $prescriptionType = (string) ($input['prescription_type'] ?? 'none');
        $requiresPrescription = $prescriptionType !== 'none' || !empty($input['requires_prescription']);
        $remotePolicy = match ($prescriptionType) {
            'controlled', 'psychotropic' => 'blocked',
            'simple', 'antibiotic' => 'requires_pharmacist_validation',
            default => 'allowed',
        };
        $visibility = (string) ($input['visibility'] ?? 'public');
        if (!in_array($visibility, ['public', 'restricted', 'admin_only'], true)) {
            $visibility = 'public';
        }

        return [
            'category_id' => ($input['category_id'] ?? '') !== '' ? (int) $input['category_id'] : null,
            'brand_id' => ($input['brand_id'] ?? '') !== '' ? (int) $input['brand_id'] : null,
            'name' => $name,
            'slug' => $slug,
            'internal_code' => trim((string) ($input['internal_code'] ?? '')),
            'ean' => trim((string) ($input['ean'] ?? '')) ?: null,
            'sku' => trim((string) ($input['sku'] ?? '')) ?: trim((string) ($input['internal_code'] ?? '')),
            'short_description' => trim((string) ($input['short_description'] ?? '')),
            'full_description' => trim((string) ($input['full_description'] ?? '')),
            'active_ingredient' => trim((string) ($input['active_ingredient'] ?? '')) ?: null,
            'presentation' => trim((string) ($input['presentation'] ?? '')) ?: null,
            'anvisa_registration' => trim((string) ($input['anvisa_registration'] ?? '')) ?: null,
            'registration_holder' => trim((string) ($input['registration_holder'] ?? '')) ?: null,
            'sale_price' => (float) ($input['sale_price'] ?? 0),
            'promotional_price' => ($input['promotional_price'] ?? '') !== '' ? (float) $input['promotional_price'] : null,
            'cost_price' => ($input['cost_price'] ?? '') !== '' ? (float) $input['cost_price'] : null,
            'current_stock' => (int) ($input['current_stock'] ?? 0),
            'minimum_stock' => (int) ($input['minimum_stock'] ?? 0),
            'maximum_stock' => ($input['maximum_stock'] ?? '') !== '' ? (int) $input['maximum_stock'] : null,
            'physical_location' => trim((string) ($input['physical_location'] ?? '')),
            'aisle' => trim((string) ($input['aisle'] ?? '')),
            'shelf' => trim((string) ($input['shelf'] ?? '')),
            'drawer' => trim((string) ($input['drawer'] ?? '')),
            'sector' => trim((string) ($input['sector'] ?? '')),
            'requires_prescription' => $requiresPrescription ? 1 : 0,
            'prescription_type' => $prescriptionType,
            'remote_sale_policy' => $remotePolicy,
            'is_generic' => !empty($input['is_generic']) ? 1 : 0,
            'is_thermosensitive' => !empty($input['is_thermosensitive']) ? 1 : 0,
            'temperature_min_c' => ($input['temperature_min_c'] ?? '') !== '' ? (float) $input['temperature_min_c'] : null,
            'temperature_max_c' => ($input['temperature_max_c'] ?? '') !== '' ? (float) $input['temperature_max_c'] : null,
            'allows_delivery' => !empty($input['allows_delivery']) ? 1 : 0,
            'allows_pickup' => !empty($input['allows_pickup']) ? 1 : 0,
            'is_featured' => !empty($input['is_featured']) ? 1 : 0,
            'is_active' => !empty($input['is_active']) ? 1 : 0,
            'visibility' => $visibility,
            'search_keywords' => trim($name . ' ' . (string) ($input['active_ingredient'] ?? '') . ' ' . (string) ($input['ean'] ?? '')),
        ];
    }

    private function storeImage(array $file): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('Falha no upload da imagem.');
        }
        $max = 4 * 1024 * 1024;
        if ((int) $file['size'] > $max) {
            throw new \RuntimeException('Imagem excede 4MB.');
        }
        $mime = mime_content_type((string) $file['tmp_name']) ?: (string) $file['type'];
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowed[$mime])) {
            throw new \RuntimeException('Formato de imagem invalido.');
        }
        $dir = PUBLIC_PATH . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'products';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $name = uuid_v4() . '.' . $allowed[$mime];
        $target = $dir . DIRECTORY_SEPARATOR . $name;
        if (!move_uploaded_file((string) $file['tmp_name'], $target) && !rename((string) $file['tmp_name'], $target)) {
            throw new \RuntimeException('Nao foi possivel salvar a imagem.');
        }
        return '/assets/img/products/' . $name;
    }

    private function registerImage(int $productId, string $path, ?array $file): void
    {
        \App\Core\Database::connection()->prepare('INSERT INTO product_images (product_id, storage_path, original_name, mime_type, file_size, is_main, uploaded_by) VALUES (:product, :path, :original, :mime, :size, 1, :user)')
            ->execute([
                'product' => $productId,
                'path' => $path,
                'original' => substr((string) ($file['name'] ?? ''), 0, 190),
                'mime' => (string) ($file['type'] ?? 'image/jpeg'),
                'size' => (int) ($file['size'] ?? 0),
                'user' => user()['id'] ?? null,
            ]);
    }

    private function branchIdFromInput(array $input): int
    {
        if (is_admin_geral() && isset($input['id_filial']) && $input['id_filial'] !== '' && $input['id_filial'] !== 'all') {
            $branchId = (int) $input['id_filial'];
        } else {
            $branchId = (new BranchService())->currentId();
        }
        (new BranchService())->assertCanAccess($branchId);
        return $branchId;
    }
}
