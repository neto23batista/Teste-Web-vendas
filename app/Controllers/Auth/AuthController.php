<?php

declare(strict_types=1);

namespace App\Controllers\Auth;

use App\Controllers\Controller;
use App\Core\Request;
use App\Core\Session;
use App\Services\AuthService;

final class AuthController extends Controller
{
    public function loginForm(Request $request): void
    {
        $this->render('auth/login', ['title' => 'Entrar']);
    }

    public function login(Request $request): void
    {
        if ((new AuthService())->login((string) $request->input('email'), (string) $request->input('password'), $request, false)) {
            $this->redirect('/cliente', 'Login realizado.');
            return;
        }
        Session::flash('error', 'E-mail ou senha invalidos.');
        $this->redirect('/login');
    }

    public function adminLoginForm(Request $request): void
    {
        $this->render('auth/admin_login', ['title' => 'Admin FarmaVida']);
    }

    public function adminLogin(Request $request): void
    {
        if ((new AuthService())->login((string) $request->input('email'), (string) $request->input('password'), $request, true)) {
            $this->redirect('/admin', 'Login administrativo realizado.');
            return;
        }
        Session::flash('error', 'Credenciais administrativas invalidas.');
        $this->redirect('/admin/login');
    }

    public function registerForm(Request $request): void
    {
        $this->render('auth/register', ['title' => 'Criar conta']);
    }

    public function register(Request $request): void
    {
        try {
            (new AuthService())->registerCustomer($request->all(), $request);
            Session::flash('success', 'Cadastro criado. Entre para continuar.');
            $this->redirect('/login');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/cadastro');
        }
    }

    public function logout(Request $request): void
    {
        (new AuthService())->logout();
        $this->redirect('/');
    }

    public function forgotForm(Request $request): void
    {
        $this->render('auth/forgot', ['title' => 'Recuperar senha']);
    }

    public function forgot(Request $request): void
    {
        (new AuthService())->requestPasswordReset((string) $request->input('email'), $request);
        Session::flash('success', 'Se o e-mail existir, enviaremos um link seguro.');
        $this->redirect('/esqueci-senha');
    }

    public function resetForm(Request $request): void
    {
        $this->render('auth/reset', ['title' => 'Redefinir senha', 'token' => $request->input('token', '')]);
    }

    public function reset(Request $request): void
    {
        try {
            if ((new AuthService())->resetPassword((string) $request->input('token'), (string) $request->input('password'))) {
                Session::flash('success', 'Senha redefinida.');
                $this->redirect('/login');
                return;
            }
            Session::flash('error', 'Token invalido ou expirado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
        }
        $this->redirect('/redefinir-senha?token=' . urlencode((string) $request->input('token')));
    }
}
