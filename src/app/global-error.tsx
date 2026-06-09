"use client";

import * as React from "react";

// global-error substitui o layout raiz quando há um erro de nível raiz.
// É autocontido (estilos inline) — não depende de CSS/providers carregados.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
          background: "#f6f8fc",
          color: "#0f172a",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
            Algo deu errado
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#5b6b85" }}>
            Encontramos um problema inesperado. Tente recarregar a página.
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#5b6b85" }}>
              Código: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
