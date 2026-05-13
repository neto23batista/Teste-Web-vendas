<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Session;
use App\Repositories\ProductRepository;
use PDO;
use RuntimeException;

final class CartService
{
    public function current(): array
    {
        $cartId = Session::get('cart_id');
        if (!$cartId) {
            return $this->createCart();
        }

        $stmt = Database::connection()->prepare("SELECT * FROM carts WHERE id = :id AND status = 'active' LIMIT 1");
        $stmt->execute(['id' => $cartId]);
        $cart = $stmt->fetch(PDO::FETCH_ASSOC);
        return $cart ?: $this->createCart();
    }

    public function items(int $cartId): array
    {
        $stmt = Database::connection()->prepare("SELECT ci.*, p.name, p.slug, p.main_image_path, p.current_stock, p.remote_sale_policy
            FROM cart_items ci
            INNER JOIN products p ON p.id = ci.product_id
            WHERE ci.cart_id = :cart_id
            ORDER BY ci.id");
        $stmt->execute(['cart_id' => $cartId]);
        return $stmt->fetchAll();
    }

    public function add(int $productId, int $quantity = 1): array
    {
        $quantity = max(1, $quantity);
        $product = (new ProductRepository())->find($productId);
        if (!$product || (int) $product['is_active'] !== 1 || ($product['visibility'] ?? '') !== 'public') {
            throw new RuntimeException('Produto indisponivel.');
        }
        if ((int) $product['current_stock'] < $quantity && (int) $product['allow_pre_sale'] !== 1) {
            throw new RuntimeException('Estoque insuficiente.');
        }
        if (in_array($product['remote_sale_policy'], ['blocked', 'pickup_only'], true)) {
            throw new RuntimeException('Este medicamento exige orientacao farmaceutica e nao pode ser vendido automaticamente.');
        }

        $cart = $this->current();
        $unit = $this->priceFor($product);

        Database::transaction(function (PDO $pdo) use ($cart, $productId, $quantity, $unit, $product): void {
            $stmt = $pdo->prepare('SELECT * FROM cart_items WHERE cart_id = :cart_id AND product_id = :product_id LIMIT 1');
            $stmt->execute(['cart_id' => $cart['id'], 'product_id' => $productId]);
            $item = $stmt->fetch();
            if ($item) {
                $newQty = (int) $item['quantity'] + $quantity;
                if ((int) $product['current_stock'] < $newQty && (int) $product['allow_pre_sale'] !== 1) {
                    throw new RuntimeException('Estoque insuficiente.');
                }
                $pdo->prepare('UPDATE cart_items SET quantity = :qty, unit_price = :unit, line_total = :total, updated_at = NOW() WHERE id = :id')
                    ->execute(['qty' => $newQty, 'unit' => $unit, 'total' => $newQty * $unit, 'id' => $item['id']]);
            } else {
                $pdo->prepare('INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, promotional_unit_price, line_total, requires_prescription, prescription_type) VALUES (:cart_id, :product_id, :qty, :unit, :promo, :total, :requires, :type)')
                    ->execute([
                        'cart_id' => $cart['id'],
                        'product_id' => $productId,
                        'qty' => $quantity,
                        'unit' => (float) $product['sale_price'],
                        'promo' => $product['promotional_price'] !== null ? (float) $product['promotional_price'] : null,
                        'total' => $quantity * $unit,
                        'requires' => (int) $product['requires_prescription'],
                        'type' => $product['prescription_type'],
                    ]);
            }
            $this->recalculate((int) $cart['id']);
        });

        return $this->summary();
    }

    public function update(int $itemId, int $quantity): array
    {
        $quantity = max(1, $quantity);
        $cart = $this->current();
        $stmt = Database::connection()->prepare('SELECT ci.*, p.current_stock, p.allow_pre_sale, p.sale_price, p.promotional_price FROM cart_items ci INNER JOIN products p ON p.id = ci.product_id WHERE ci.id = :id AND ci.cart_id = :cart_id LIMIT 1');
        $stmt->execute(['id' => $itemId, 'cart_id' => $cart['id']]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$item) {
            throw new RuntimeException('Item nao encontrado.');
        }
        if ((int) $item['current_stock'] < $quantity && (int) $item['allow_pre_sale'] !== 1) {
            throw new RuntimeException('Estoque insuficiente.');
        }

        $unit = $item['promotional_price'] !== null ? (float) $item['promotional_price'] : (float) $item['sale_price'];
        Database::connection()->prepare('UPDATE cart_items SET quantity = :qty, line_total = :total, updated_at = NOW() WHERE id = :id')
            ->execute(['qty' => $quantity, 'total' => $quantity * $unit, 'id' => $itemId]);
        $this->recalculate((int) $item['cart_id']);
        return $this->summary();
    }

    public function remove(int $itemId): array
    {
        $cart = $this->current();
        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT cart_id FROM cart_items WHERE id = :id AND cart_id = :cart_id');
        $stmt->execute(['id' => $itemId, 'cart_id' => $cart['id']]);
        $cartId = (int) ($stmt->fetchColumn() ?: 0);
        if ($cartId === 0) {
            throw new RuntimeException('Item nao encontrado.');
        }
        $pdo->prepare('DELETE FROM cart_items WHERE id = :id AND cart_id = :cart_id')->execute(['id' => $itemId, 'cart_id' => $cart['id']]);
        if ($cartId > 0) {
            $this->recalculate($cartId);
        }
        return $this->summary();
    }

    public function summary(): array
    {
        $cart = $this->current();
        $items = $this->items((int) $cart['id']);
        return ['cart' => $cart, 'items' => $items, 'count' => array_sum(array_column($items, 'quantity'))];
    }

    private function createCart(): array
    {
        $customerId = Session::get('customer_id');
        $shareToken = bin2hex(random_bytes(32));
        $stmt = Database::connection()->prepare("INSERT INTO carts (public_id, customer_id, session_id_hash, share_token_hash, status, expires_at)
            VALUES (:public_id, :customer_id, :session, :share, 'active', DATE_ADD(NOW(), INTERVAL 72 HOUR))");
        $stmt->execute([
            'public_id' => uuid_v4(),
            'customer_id' => $customerId ?: null,
            'session' => hash('sha256', session_id()),
            'share' => hash('sha256', $shareToken),
        ]);
        $id = (int) Database::connection()->lastInsertId();
        Session::put('cart_id', $id);
        Session::put('cart_share_token', $shareToken);
        return $this->current();
    }

    private function priceFor(array $product): float
    {
        $promo = $product['promotional_price'] !== null ? (float) $product['promotional_price'] : null;
        return $promo !== null && $promo > 0 ? $promo : (float) $product['sale_price'];
    }

    private function recalculate(int $cartId): void
    {
        $stmt = Database::connection()->prepare('SELECT COALESCE(SUM(line_total), 0) FROM cart_items WHERE cart_id = :id');
        $stmt->execute(['id' => $cartId]);
        $subtotal = (float) $stmt->fetchColumn();
        Database::connection()->prepare('UPDATE carts SET subtotal = :subtotal, grand_total = :total, last_activity_at = NOW(), updated_at = NOW() WHERE id = :id')
            ->execute(['subtotal' => $subtotal, 'total' => $subtotal, 'id' => $cartId]);
    }
}
