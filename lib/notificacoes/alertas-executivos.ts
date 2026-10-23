type Severidade = "Crítico" | "Atenção";

export type AlertaExecutivo = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  tipo: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  prazo: string | null;
  responsavel_nome: string | null;
  prioridade: string | null;
};

type SupabaseLike = any;

function aberto(status: string | null | undefined) {
  const valor = String(status ?? "").trim();

  return ![
    "Concluída",
    "Concluído",
    "Cancelada",
    "Cancelado",
  ].includes(valor);
}

function dias(data: string | null | undefined) {
  if (!data) return null;

  const [ano, mes, dia] = data.split("-").map(Number);

  if (!ano || !mes || !dia) return null;

  const alvo = new Date(ano, mes - 1, dia);

  const agora = new Date();

  const hoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  );

  return Math.round(
    (alvo.getTime() - hoje.getTime()) / 86400000,
  );
}

export async function gerarAlertasExecutivos(
  supabase: SupabaseLike,
): Promise<AlertaExecutivo[]> {
  const [pr, ar, pe, mr] = await Promise.all([
    supabase
      .from("projetos")
      .select(`
        id,
        nome,
        status,
        prioridade,
        data_fim,
        responsavel_id,
        responsavel:usuarios!projetos_responsavel_id_fkey(
          id,
          nome
        )
      `),

    supabase
      .from("projeto_acoes")
      .select(`
        id,
        projeto_id,
        titulo,
        prioridade,
        status,
        responsavel_id,
        prazo,
        responsavel:usuarios!projeto_acoes_responsavel_id_fkey(
          id,
          nome
        )
      `),

    supabase
      .from("projeto_pendencias")
      .select(`
        id,
        projeto_id,
        titulo,
        tipo,
        prioridade,
        status,
        responsavel_id,
        prazo,
        responsavel:usuarios!projeto_pendencias_responsavel_id_fkey(
          id,
          nome
        )
      `),

    supabase
      .from("projeto_marcos")
      .select(`
        id,
        projeto_id,
        nome,
        status,
        data_prevista
      `),
  ]);

  const erro =
    pr.error ||
    ar.error ||
    pe.error ||
    mr.error;

  if (erro) {
    throw new Error(erro.message);
  }

  const projetos: any[] = pr.data ?? [];
  const acoes: any[] = ar.data ?? [];
  const pendencias: any[] = pe.data ?? [];
  const marcos: any[] = mr.data ?? [];

  const projetosMap = new Map(
    projetos.map(projeto => [projeto.id, projeto]),
  );

  const alertas: AlertaExecutivo[] = [];

  const adicionar = (alerta: AlertaExecutivo) => {
    alertas.push(alerta);
  };

  // =========================================================
  // AÇÕES
  // =========================================================

  for (const acao of acoes) {
    if (!aberto(acao.status)) continue;

    const projeto: any = projetosMap.get(acao.projeto_id);

    if (!projeto) continue;

    const diferenca = dias(acao.prazo);
    const responsavel =
      acao.responsavel?.nome ?? null;

    if (diferenca !== null && diferenca < 0) {
      adicionar({
        id: `av-${acao.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Ação vencida",
        severidade: "Crítico",
        titulo: acao.titulo,
        descricao: `Vencida há ${Math.abs(diferenca)} dia(s).`,
        prazo: acao.prazo,
        responsavel_nome: responsavel,
        prioridade: acao.prioridade,
      });
    } else if (acao.prioridade === "Crítica") {
      adicionar({
        id: `ac-${acao.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Ação crítica",
        severidade: "Crítico",
        titulo: acao.titulo,
        descricao:
          diferenca === null
            ? "Ação crítica sem prazo."
            : diferenca === 0
              ? "Ação crítica vence hoje."
              : `Ação crítica vence em ${diferenca} dia(s).`,
        prazo: acao.prazo,
        responsavel_nome: responsavel,
        prioridade: acao.prioridade,
      });
    } else if (
      diferenca !== null &&
      diferenca >= 0 &&
      diferenca <= 3
    ) {
      adicionar({
        id: `ap-${acao.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Prazo próximo",
        severidade: "Atenção",
        titulo: acao.titulo,
        descricao:
          diferenca === 0
            ? "Vence hoje."
            : `Vence em ${diferenca} dia(s).`,
        prazo: acao.prazo,
        responsavel_nome: responsavel,
        prioridade: acao.prioridade,
      });
    }

    if (!acao.prazo) {
      adicionar({
        id: `asp-${acao.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Sem prazo",
        severidade: "Atenção",
        titulo: acao.titulo,
        descricao: "Ação aberta sem prazo definido.",
        prazo: null,
        responsavel_nome: responsavel,
        prioridade: acao.prioridade,
      });
    }

    if (!acao.responsavel_id) {
      adicionar({
        id: `asr-${acao.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Sem responsável",
        severidade: "Atenção",
        titulo: acao.titulo,
        descricao: "Ação aberta sem responsável definido.",
        prazo: acao.prazo,
        responsavel_nome: null,
        prioridade: acao.prioridade,
      });
    }
  }

  // =========================================================
  // PENDÊNCIAS / IMPEDIMENTOS
  // =========================================================

  for (const pendencia of pendencias) {
    if (
      !aberto(pendencia.status) ||
      pendencia.tipo !== "Impedimento"
    ) {
      continue;
    }

    const projeto: any =
      projetosMap.get(pendencia.projeto_id);

    if (!projeto) continue;

    const diferenca = dias(pendencia.prazo);

    if (
      pendencia.prioridade === "Crítica" ||
      (diferenca !== null && diferenca < 0)
    ) {
      adicionar({
        id: `imp-${pendencia.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Impedimento crítico",
        severidade: "Crítico",
        titulo: pendencia.titulo,
        descricao:
          diferenca !== null && diferenca < 0
            ? `Vencido há ${Math.abs(diferenca)} dia(s).`
            : "Impedimento crítico aberto.",
        prazo: pendencia.prazo,
        responsavel_nome:
          pendencia.responsavel?.nome ?? null,
        prioridade: pendencia.prioridade,
      });
    }
  }

  // =========================================================
  // MARCOS
  // =========================================================

  for (const marco of marcos) {
    if (!aberto(marco.status)) continue;

    const projeto: any =
      projetosMap.get(marco.projeto_id);

    if (!projeto) continue;

    const diferenca =
      dias(marco.data_prevista);

    if (
      diferenca !== null &&
      diferenca < 0
    ) {
      adicionar({
        id: `mv-${marco.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Marco vencido",
        severidade: "Crítico",
        titulo: marco.nome,
        descricao:
          `Marco vencido há ${Math.abs(diferenca)} dia(s).`,
        prazo: marco.data_prevista,
        responsavel_nome:
          projeto.responsavel?.nome ?? null,
        prioridade: projeto.prioridade,
      });
    }
  }

  // =========================================================
  // PROJETOS
  // =========================================================

  for (const projeto of projetos) {
    const acoesAbertas = acoes.filter(
      acao =>
        acao.projeto_id === projeto.id &&
        aberto(acao.status),
    );

    const diferenca =
      dias(projeto.data_fim);

    if (
      projeto.status === "Finalizado" &&
      acoesAbertas.length
    ) {
      adicionar({
        id: `fa-${projeto.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Inconsistência",
        severidade: "Crítico",
        titulo:
          "Projeto finalizado com ações abertas",
        descricao:
          `${acoesAbertas.length} ação(ões) ainda abertas.`,
        prazo: projeto.data_fim,
        responsavel_nome:
          projeto.responsavel?.nome ?? null,
        prioridade: projeto.prioridade,
      });
    }

    if (
      ["Pausado", "Bloqueado"].includes(projeto.status) &&
      acoesAbertas.length
    ) {
      adicionar({
        id: `pa-${projeto.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: projeto.status,
        severidade:
          projeto.status === "Bloqueado"
            ? "Crítico"
            : "Atenção",
        titulo:
          `${projeto.status} com ações abertas`,
        descricao:
          `${acoesAbertas.length} ação(ões) exigem acompanhamento.`,
        prazo: projeto.data_fim,
        responsavel_nome:
          projeto.responsavel?.nome ?? null,
        prioridade: projeto.prioridade,
      });
    }

    if (
      !["Finalizado", "Cancelado"].includes(projeto.status) &&
      diferenca !== null &&
      diferenca < 0
    ) {
      adicionar({
        id: `pv-${projeto.id}`,
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tipo: "Projeto atrasado",
        severidade: "Crítico",
        titulo: "Prazo do projeto vencido",
        descricao:
          `Vencido há ${Math.abs(diferenca)} dia(s).`,
        prazo: projeto.data_fim,
        responsavel_nome:
          projeto.responsavel?.nome ?? null,
        prioridade: projeto.prioridade,
      });
    }
  }

  alertas.sort(
    (a, b) =>
      (a.severidade === "Crítico" ? 0 : 1) -
        (b.severidade === "Crítico" ? 0 : 1) ||
      (a.prazo ?? "9999").localeCompare(
        b.prazo ?? "9999",
      ),
  );

  return alertas;
}