import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "pt-BR" | "es";

export interface AppCurrency {
  code: string;
  label: string;
}

export interface AppPreferences {
  language: AppLanguage;
  currency: string;
}

const STORAGE_KEY = "gastrogestao:preferences";

export const APP_CURRENCIES: AppCurrency[] = [
  { code: "BRL", label: "Real brasileiro (BRL)" },
  { code: "USD", label: "Dólar americano (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguaio (UYU)" },
  { code: "PYG", label: "Guarani paraguaio (PYG)" },
  { code: "BOB", label: "Boliviano (BOB)" },
];

const DEFAULT_PREFERENCES: AppPreferences = {
  language: "pt-BR",
  currency: "BRL",
};

const TRANSLATIONS: Record<string, string> = {
  "Dashboard": "Panel",
  "Encomendas": "Pedidos",
  "Estoque": "Inventario",
  "Insumos": "Insumos",
  "Receitas": "Recetas",
  "Perfil": "Perfil",
  "Gerencie sua conta e fale conosco": "Gestiona tu cuenta y habla con nosotros",
  "Acesso Ativo": "Acceso activo",
  "Atendimento": "Atención",
  "Suporte WhatsApp": "Soporte por WhatsApp",
  "Tire suas dúvidas agora": "Resuelve tus dudas ahora",
  "Dar Feedback": "Enviar comentarios",
  "Como podemos melhorar o app para você?": "¿Cómo podemos mejorar la app para ti?",
  "Enviar Sugestão": "Enviar sugerencia",
  "Alterar Senha": "Cambiar contraseña",
  "Nova senha": "Nueva contraseña",
  "Confirme a senha": "Confirma la contraseña",
  "Atualizar Senha": "Actualizar contraseña",
  "Sair da conta": "Cerrar sesión",
  "Excluir minha conta permanentemente": "Eliminar mi cuenta permanentemente",
  "Atenção total!": "¡Atención!",
  "Sim, excluir tudo": "Sí, eliminar todo",
  "Bem-vindo ao": "Bienvenido a",
  "Meta de Lucro Mensal": "Meta de ganancia mensual",
  "Rumo à Meta": "Camino a la meta",
  "Alertas de Encomendas": "Alertas de pedidos",
  "Ver todas": "Ver todos",
  "Lucro Líquido Real": "Ganancia neta real",
  "Já descontando custos e taxas de venda": "Ya descontando costos y tasas de venta",
  "Anotar Custos Fixos/Variáveis": "Registrar costos fijos/variables",
  "Salvar Gasto": "Guardar gasto",
  "Ranking de Lucro Real Unitário": "Ranking de ganancia real unitaria",
  "Composição do Preço": "Composición del precio",
  "Histórico Mensal": "Historial mensual",
  "Detalhamento de Vendas": "Detalle de ventas",
  "Custos Adicionais": "Costos adicionales",
  "Nenhuma venda.": "Ninguna venta.",
  "Nenhum custo extra.": "Ningún costo extra.",
  "Faturamento": "Facturación",
  "Margem Média": "Margen promedio",
  "Configurar Receita": "Configurar receta",
  "Identificação": "Identificación",
  "Nome da receita": "Nombre de la receta",
  "Ingredientes da Receita": "Ingredientes de la receta",
  "Rende em UNIDADES": "Rinde en UNIDADES",
  "Qtd Venda (Pacote/Cento/Un)": "Cant. venta (Paquete/Ciento/Un)",
  "Preparo em minutos": "Preparación en minutos",
  "Desperdício (%)": "Desperdicio (%)",
  "Canais de Venda": "Canales de venta",
  "Custo Real do Pacote/Cento/Unidade": "Costo real del paquete/ciento/unidad",
  "Preço de Venda do Pacote/Cento/Unidade": "Precio de venta del paquete/ciento/unidad",
  "Gravar Receita": "Guardar receta",
  "Atualizar Receita": "Actualizar receta",
  "Vendidos": "Vendidos",
  "Modo Preparo": "Modo preparación",
  "Ficha Técnica": "Ficha técnica",
  "Nova": "Nueva",
  "Custos, Taxas e Canais": "Costos, tasas y canales",
  "Custo Mão de Obra/Hora": "Costo mano de obra/hora",
  "Novo Canal": "Nuevo canal",
  "Salvar": "Guardar",
  "Nome do Cliente": "Nombre del cliente",
  "Data de Entrega": "Fecha de entrega",
  "Descrição do Pedido": "Descripción del pedido",
  "Insumos Extras": "Insumos extra",
  "Adicionar Encomenda": "Agregar pedido",
  "Nenhuma encomenda pendente.": "Ningún pedido pendiente.",
  "Conta em Processo de Ativação": "Cuenta en proceso de activación",
  "Ativar minha conta via WhatsApp": "Activar mi cuenta por WhatsApp",
  "Falar com Suporte Técnico": "Hablar con soporte técnico",
  "Carregando dados...": "Cargando datos...",
  "Verificando sessão...": "Verificando sesión...",
  "Carregando painel...": "Cargando panel...",
  "Gerencie encomendas por cliente e data de entrega": "Gestiona pedidos por cliente y fecha de entrega",
  "pendentes": "pendientes",
  "Nova encomenda": "Nuevo pedido",
  "Editando encomenda": "Editando pedido",
  "Cancelar": "Cancelar",
  "Atualizar Encomenda": "Actualizar pedido",
  "Salvando...": "Guardando...",
  "Salvando": "Guardando",
  "Processando...": "Procesando...",
  "Ver Entregues (Arquivados)": "Ver entregados (archivados)",
  "Ocultar Histórico": "Ocultar historial",
  "Nenhuma encomenda arquivada.": "Ningún pedido archivado.",
  "Restaurar": "Restaurar",
  "Detalhes do Pedido": "Detalles del pedido",
  "Cliente": "Cliente",
  "O que foi pedido": "Lo que se pidió",
  "Sem descrição detalhada.": "Sin descripción detallada.",
  "Entrega prevista": "Entrega prevista",
  "Entregue": "Entregado",
  "Pendente": "Pendiente",
  "Fechar Detalhes": "Cerrar detalles",
  "Insumos Extras (ex: Topo de bolo)": "Insumos extra (ej: topper de torta)",
  "Controle de compras e itens disponíveis": "Control de compras e itens disponibles",
  "Lista de Compras": "Lista de compras",
  "Insumos em Estoque (Anotação)": "Insumos en inventario (anotación)",
  "Adicionar Item": "Agregar item",
  "Quantidade": "Cantidad",
  "Itens": "Items",
  "Item": "Item",
  "Cadastre seus insumos e custos": "Registra tus insumos y costos",
  "Novo Insumo": "Nuevo insumo",
  "Nome do insumo": "Nombre del insumo",
  "Preço de compra (R$)": "Precio de compra",
  "Qtd. na Embalagem": "Cant. en el envase",
  "Ingrediente": "Ingrediente",
  "Embalagem": "Envase",
  "Salvar Insumo": "Guardar insumo",
  "Editar": "Editar",
  "Excluir": "Eliminar",
  "Preço un.": "Precio un.",
  "Custo produção": "Costo producción",
  "Taxa": "Tasa",
  "Taxa total": "Tasa total",
  "Taxa %": "Tasa %",
  "Ex: iFood": "Ej: iFood",
  "Ex: 25": "Ej: 25",
  "Ex: 1500": "Ej: 1500",
  "Ex: 100": "Ej: 100",
  "Ex: 5": "Ej: 5",
  "R$ Valor": "Valor",
  "Variável": "Variable",
  "Fixo": "Fijo",
  "Produção": "Producción",
  "Taxa s/ venda": "Tasa sobre venta",
  "Custo total da receita": "Costo total de la receta",
  "Venda Pacote/Cento/Unidade": "Venta paquete/ciento/unidad",
  "Custo": "Costo",
  "Lucro": "Ganancia",
  "margem": "margen",
  "Duplicar": "Duplicar",
  "receitas cadastradas": "recetas registradas",
  "Ver Exemplos": "Ver ejemplos",
  "Baixar Relatório": "Descargar informe",
  "Meta de Lucro Mensal (R$)": "Meta de ganancia mensual",
  "Salvar idioma e moeda": "Guardar idioma y moneda",
  "Idioma do app": "Idioma de la app",
  "Moeda": "Moneda",
  "Preferências atualizadas!": "¡Preferencias actualizadas!",
  "Português": "Portugués",
  "Espanhol": "Español",
  "Conta": "Cuenta",
  "Conta:": "Cuenta:",
  "Olá! Recebemos seu cadastro. Para liberar o acesso total às\n          ferramentas de cálculo e gestão, finalize sua assinatura com nossa\n          equipe.": "¡Hola! Recibimos tu registro. Para liberar el acceso completo a las herramientas de cálculo y gestión, finaliza tu suscripción con nuestro equipo.",
  "Olá! Preciso de suporte com o GastroGestão.": "¡Hola! Necesito soporte con GastroGestión.",
  "Senha alterada com sucesso!": "¡Contraseña actualizada con éxito!",
  "A senha deve ter pelo menos 6 caracteres.": "La contraseña debe tener al menos 6 caracteres.",
  "As senhas não coincidem.": "Las contraseñas no coinciden.",
  "Erro ao alterar senha": "Error al cambiar la contraseña",
  "Entrar": "Entrar",
  "Criar conta": "Crear cuenta",
  "Crie sua conta": "Crea tu cuenta",
  "Entre na sua conta": "Entra en tu cuenta",
  "E-mail": "Correo electrónico",
  "Senha": "Contraseña",
  "Esqueci minha senha": "Olvidé mi contraseña",
  "Enviar": "Enviar",
  "Voltar": "Volver",
  "Página não encontrada": "Página no encontrada",
  "A página que você procura não existe ou foi movida.": "La página que buscas no existe o fue movida.",
  "Voltar ao início": "Volver al inicio",
};

const INLINE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bReceitas\b/g, "Recetas"],
  [/\breceitas\b/g, "recetas"],
  [/\bEncomendas\b/g, "Pedidos"],
  [/\bencomendas\b/g, "pedidos"],
  [/\bInsumos\b/g, "Insumos"],
  [/\bEstoque\b/g, "Inventario"],
  [/\bPerfil\b/g, "Perfil"],
  [/\bDashboard\b/g, "Panel"],
  [/\bVendas\b/g, "Ventas"],
  [/\bVenda\b/g, "Venta"],
  [/\bLucro Líquido Real\b/g, "Ganancia neta real"],
  [/\bLucro Líquido\b/g, "Ganancia neta"],
  [/\bLucro\b/g, "Ganancia"],
  [/\bFaturamento\b/g, "Facturación"],
  [/\bMargem Média\b/g, "Margen promedio"],
  [/\bMargem\b/g, "Margen"],
  [/\bmargem\b/g, "margen"],
  [/\bHistórico\b/g, "Historial"],
  [/\bHistórico Mensal\b/g, "Historial mensual"],
  [/\bCustos\b/g, "Costos"],
  [/\bCusto\b/g, "Costo"],
  [/\bcusto\b/g, "costo"],
  [/\bTaxas\b/g, "Tasas"],
  [/\bTaxa\b/g, "Tasa"],
  [/\btaxa\b/g, "tasa"],
  [/\bCanais\b/g, "Canales"],
  [/\bCanal\b/g, "Canal"],
  [/\bPrepar(o|o)\b/g, "Preparación"],
  [/\bPreparo\b/g, "Preparación"],
  [/\bDesperdício\b/g, "Desperdicio"],
  [/\bIngredientes\b/g, "Ingredientes"],
  [/\bItens\b/g, "Items"],
  [/\bitens\b/g, "items"],
  [/\bVendidos\b/g, "Vendidos"],
  [/\bFaz\b/g, "Rinde"],
  [/\bVende\b/g, "Vende"],
  [/\bun\b/g, "un"],
  [/\bNova\b/g, "Nueva"],
  [/\bNovo\b/g, "Nuevo"],
  [/\bSalvar\b/g, "Guardar"],
  [/\bAtualizar\b/g, "Actualizar"],
  [/\bAdicionar\b/g, "Agregar"],
  [/\bExcluir\b/g, "Eliminar"],
  [/\bEditar\b/g, "Editar"],
  [/\bRestaurar\b/g, "Restaurar"],
  [/\bCancelar\b/g, "Cancelar"],
  [/\bCarregando\b/g, "Cargando"],
  [/\bNenhuma\b/g, "Ninguna"],
  [/\bNenhum\b/g, "Ningún"],
  [/\bpendentes\b/g, "pendientes"],
  [/\bcadastradas\b/g, "registradas"],
  [/\bAcesso Ativo\b/g, "Acceso activo"],
  [/\bAtendimento\b/g, "Atención"],
  [/\bAlterar Senha\b/g, "Cambiar contraseña"],
  [/\bSair da conta\b/g, "Cerrar sesión"],
  [/\bIdioma do app\b/g, "Idioma de la app"],
  [/\bMoeda\b/g, "Moneda"],
];

const PreferencesContext = createContext<{
  preferences: AppPreferences;
  setPreferences: (preferences: AppPreferences) => void;
} | null>(null);

function readPreferences(): AppPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: AppPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function getAppPreferences(): AppPreferences {
  return readPreferences();
}

export function formatCurrency(value: number, currency = readPreferences().currency): string {
  const language = readPreferences().language;
  const locale = language === "es" ? "es-ES" : "pt-BR";
  return value.toLocaleString(locale, { style: "currency", currency });
}

function translateText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const exact = TRANSLATIONS[trimmed];
  if (exact) return text.replace(trimmed, exact);

  return INLINE_TRANSLATIONS.reduce((next, [pattern, replacement]) => {
    return next.replace(pattern, replacement);
  }, text);
}

function translateDocument(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>("input[placeholder], textarea[placeholder]").forEach((element) => {
    if (!element.dataset.originalPlaceholder) {
      element.dataset.originalPlaceholder = element.getAttribute("placeholder") ?? "";
    }
    const placeholder = element.dataset.originalPlaceholder;
    if (!placeholder) return;
    element.setAttribute("placeholder", language === "es" ? translateText(placeholder) : placeholder);
  });
  if (language !== "es") return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const next = translateText(node.nodeValue ?? "");
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = useState<AppPreferences>(() => readPreferences());

  const value = useMemo(() => ({
    preferences,
    setPreferences: (next: AppPreferences) => {
      savePreferences(next);
      setPreferencesState(next);
    },
  }), [preferences]);

  useEffect(() => {
    translateDocument(preferences.language);
    const observer = new MutationObserver(() => translateDocument(preferences.language));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [preferences.language]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}
