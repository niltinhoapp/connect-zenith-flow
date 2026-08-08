/**
 * Ajuda contextual por rota — conteúdo em linguagem simples para o lojista.
 * O painel do Copiloto mostra o item cujo `match` casa com a rota atual.
 * (Frente Claude: experiência/ativação. Sem dependência do Core.)
 */
export interface RouteHelp {
  match: string; // prefixo da rota
  title: string;
  intro: string;
  tips: string[];
  links?: { label: string; to: string }[];
}

export const ROUTE_HELP: RouteHelp[] = [
  {
    match: "/automacoes/builder",
    title: "Construtor de automações",
    intro: "Monte o fluxo arrastando blocos: um gatilho, condições, esperas e ações.",
    tips: [
      "Comece pelo gatilho (o que inicia o fluxo) e ligue os blocos com o ⛓.",
      "Em condições, use os ramos “sim/não” para caminhos diferentes.",
      "Clique num bloco para editar as propriedades no painel da direita.",
      "Salve e ative — nada dispara enquanto o fluxo estiver em rascunho.",
    ],
    links: [{ label: "Ver meus fluxos", to: "/automacoes" }],
  },
  {
    match: "/automacoes",
    title: "Automações",
    intro: "Fluxos que trabalham por você — enviam mensagens, criam notas, movem negócios.",
    tips: [
      "Clique em “Gerar com IA” e descreva o que quer em português.",
      "Ative/pause um fluxo pelo interruptor à direita.",
      "Use o menu ⋯ para testar, duplicar ou excluir.",
    ],
    links: [{ label: "Nova automação", to: "/automacoes/builder" }],
  },
  {
    match: "/whatsapp",
    title: "WhatsApp",
    intro: "Central de conversas com a API oficial da Meta — atenda e responda seus clientes.",
    tips: [
      "Conecte o número em Configurações → Integrações antes de usar.",
      "A caixa de entrada (à esquerda) lista as conversas; clique para abrir.",
      "Selecione uma conversa e use a IA para resumir ou rascunhar a resposta.",
      "Fora da janela de 24h, use um template para reengajar.",
    ],
  },
  {
    match: "/clientes",
    title: "Clientes",
    intro: "Sua base de contatos. Cadastre, segmente e acompanhe cada cliente.",
    tips: [
      "Use os filtros (Ativos, Trial, VIP) para segmentar.",
      "Ao criar um cliente, automações de “Cliente criado” disparam sozinhas.",
      "Abra um cliente para ver a linha do tempo e as notas.",
    ],
    links: [{ label: "Ver automações", to: "/automacoes" }],
  },
  {
    match: "/crm",
    title: "CRM — Negócios",
    intro: "Acompanhe oportunidades pelo funil: do primeiro contato ao fechamento.",
    tips: [
      "Arraste o cartão de uma coluna para outra para mudar o estágio.",
      "Cada coluna é uma etapa do funil; avance conforme o negócio evolui.",
      "Ganhar ou mover um negócio pode disparar automações.",
    ],
  },
  {
    match: "/relatorios",
    title: "Relatórios",
    intro: "Acompanhe os números do seu negócio ao longo do tempo.",
    tips: [
      "Use os filtros de período para escolher o intervalo (semana, mês...).",
      "Cada indicador mostra um número e a tendência em relação ao período anterior.",
      "Compare períodos para ver o que melhorou e onde focar.",
    ],
  },
  {
    match: "/configuracoes",
    title: "Configurações",
    intro: "Sua conta, empresa, segurança e integrações — tudo em um só lugar.",
    tips: [
      "Perfil: seu nome e senha. Empresa: nome e módulos ativos.",
      "Segurança: ative a verificação em duas etapas e encerre outras sessões.",
      "Integrações: conecte o WhatsApp oficial para enviar e receber mensagens.",
      "Defina papéis e permissões da sua equipe em Papéis.",
    ],
  },
  {
    match: "/dashboard",
    title: "Dashboard",
    intro: "Visão geral do seu dia: conversas, clientes e negócios num lugar só.",
    tips: [
      "Os cartões no topo resumem os números principais (clientes, conversas, negócios).",
      "Cada número reflete os dados reais da sua empresa, atualizados automaticamente.",
      "Use os atalhos para pular direto para onde precisa agir.",
    ],
  },
];

/** Acha a ajuda da rota atual (o prefixo mais específico vence). */
export function helpForRoute(pathname: string): RouteHelp {
  const found = [...ROUTE_HELP]
    .sort((a, b) => b.match.length - a.match.length)
    .find((h) => pathname.startsWith(h.match));
  return (
    found ?? {
      match: "/",
      title: "Ajuda + IA",
      intro: "Precisa de uma mão? Descreva o que quer fazer que a gente te guia.",
      tips: ["Explore o menu à esquerda.", "Volte aqui a qualquer momento pelo botão de ajuda."],
    }
  );
}
