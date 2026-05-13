<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Session;
use App\Services\CartService;

final class CartController extends Controller
{
    public function show(Request $request): void
    {
        $this->render('store/cart', ['title' => 'Sacola', 'summary' => (new CartService())->summary()]);
    }

    public function add(Request $request): void
    {
        try {
            $summary = (new CartService())->add((int) $request->input('product_id'), (int) $request->input('quantity', 1));
            $this->json(['ok' => true, 'summary' => $summary]);
        } catch (\Throwable $exception) {
            $this->json(['ok' => false, 'error' => $exception->getMessage()], 422);
        }
    }

    public function update(Request $request): void
    {
        try {
            $summary = (new CartService())->update((int) $request->input('item_id'), (int) $request->input('quantity', 1));
            $this->json(['ok' => true, 'summary' => $summary]);
        } catch (\Throwable $exception) {
            $this->json(['ok' => false, 'error' => $exception->getMessage()], 422);
        }
    }

    public function remove(Request $request): void
    {
        try {
            $this->json(['ok' => true, 'summary' => (new CartService())->remove((int) $request->input('item_id'))]);
        } catch (\Throwable $exception) {
            $this->json(['ok' => false, 'error' => $exception->getMessage()], 422);
        }
    }
}
