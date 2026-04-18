import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova Senha — GastroGestão📈" },
      { name: "description", content: "Defina sua nova senha" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Check URL hash for recovery token
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate({ to: "/" }), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nova Senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina sua nova senha abaixo.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-100 p-4 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Senha alterada com sucesso! Redirecionando...
            </div>
          </div>
        ) : !isRecovery ? (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full">Solicitar novo link</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 text-base"
            />
            <Input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 text-base"
            />

            {error && (
              <p className="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Salvando..." : "Definir nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
