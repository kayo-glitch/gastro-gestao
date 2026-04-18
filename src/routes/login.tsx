import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — GastroGestão📈" },
      { name: "description", content: "Entre na sua conta GastroGestão📈" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccess("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">GastroGestão📈</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignUp ? "Crie sua conta" : "Entre na sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 text-base"
          />
          <Input
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 text-base"
          />

          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-green-100 p-3 text-center text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {success}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        {!isSignUp && (
          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-sm font-medium text-primary underline">
              Esqueci minha senha
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccess(""); }}
            className="font-medium text-primary underline"
          >
            {isSignUp ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}
