import { Lock, MessageCircle, LogOut, Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const WHATSAPP_NUMBER = "5574999630510";
const WHATSAPP_ACTIVATE = encodeURIComponent(
  "Olá, criei minha conta no GastroGestão📈 e quero ativar meu acesso."
);
const WHATSAPP_SUPPORT = encodeURIComponent(
  "Olá, preciso de suporte técnico com minha conta no GastroGestão📈."
);
const WHATSAPP_ACTIVATE_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_ACTIVATE}`;
const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_SUPPORT}`;

export function BlockedScreen() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-10 w-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          Conta em Processo de Ativação
        </h1>

        <p className="mt-4 text-muted-foreground leading-relaxed">
          Olá! Recebemos seu cadastro. Para liberar o acesso total às
          ferramentas de cálculo e gestão, finalize sua assinatura com nossa
          equipe.
        </p>

        {user?.email && (
          <p className="mt-2 text-sm text-muted-foreground">
            Conta: <span className="font-medium text-foreground">{user.email}</span>
          </p>
        )}

        <a href={WHATSAPP_ACTIVATE_URL} target="_blank" rel="noopener noreferrer" className="block mt-8">
          <Button size="lg" className="w-full gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white">
            <MessageCircle className="h-5 w-5" />
            Ativar minha conta via WhatsApp
          </Button>
        </a>

        <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="block mt-3">
          <Button variant="outline" size="lg" className="w-full gap-2">
            <Headset className="h-5 w-5" />
            Falar com Suporte Técnico
          </Button>
        </a>

        <Button
          variant="ghost"
          className="mt-4 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
