import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { calculateOperationalHealth } from "@/lib/control-tower/health";

type Projeto = {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  percentual: number | null;
  data_fim: string | null;
  cliente?: { id: string; nome: string } | null;
  etapa?: { id: string; nome: string; ordem: number } | null;
  responsavel?: { id: string; nome: string } | null;
};

type Pendencia = {
  id: string;
  projeto_id: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  created_at: string;
  responsavel?: { id: string; nome: string } | null;
};

type Marco = {
  id: string;
  projeto_id: string;
  nome: string;
  status: string;
  data_prevista: string | null;
};

type Acao = {
  id: string;
  projeto_id: string;
  titulo: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  created_at: string;
};

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localDate(value: string | null) {
  if (!value) return null;

  const [y, m, d] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}

function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasAte(value: string | null) {
  const data = localDate(value);

  if (!data) return null;

  data.setHours(0, 0, 0, 0);

  return Math.round(
    (data.getTime() - hoje().getTime()) /
      86400000
  );
}

function diasAberta(createdAt?: string | null) {
  if (!createdAt) return 0;

  const criada = new Date(createdAt);

  if (Number.isNaN(criada.getTime())) {
    return 0;
  }

  criada.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor(
      (hoje().getTime() - criada.getTime()) /
        86400000
    )
  );
}

function aberto(status?: string | null) {
  const s = normalize(status);

  return (
    s !== "concluida" &&
    s !== "concluido" &&
    s !== "cancelada" &&
    s !== "cancelado" &&
    s !== "finalizado"
  );
}

function vencido(data: string | null) {
  const dias = diasAte(data);
  return dias !== null && dias < 0;
}

function isPendencia(tipo?: string | null) {
  return normalize(tipo) === "pendencia";
}

function isImpedimento(tipo?: string | null) {
  return normalize(tipo) === "impedimento";
}

function prioridadeCritica(
  prioridade?: string | null
) {
  return normalize(prioridade) === "critica";
}

function prioridadeAlta(
  prioridade?: string | null
) {
  return normalize(prioridade) === "alta";
}

export async function GET() {
  try {
    const permissao =
      await requirePermission("visualizar");

    if (!permissao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permissao.error,
        },
        {
          status: permissao.status,
        }
      );
    }

    const supabase = await createClient();

    const [
      projetosRes,
      pendenciasRes,
      marcosRes,
      acoesRes,
    ] = await Promise.all([
      supabase
        .from("projetos")
        .select(`
          id,
          nome,
          status,
          prioridade,
          percentual,
          data_fim,
          cliente:clientes(id,nome),
          etapa:etapas(id,nome,ordem),
          responsavel:usuarios!projetos_responsavel_id_fkey(id,nome)
        `)
        .order("updated_at", {
          ascending: false,
        }),

      supabase
        .from("projeto_pendencias")
        .select(`
          id,
          projeto_id,
          titulo,
          tipo,
          prioridade,
          status,
          prazo,
          created_at,
          responsavel:usuarios!projeto_pendencias_responsavel_id_fkey(id,nome)
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

      supabase
        .from("projeto_acoes")
        .select(`
          id,
          projeto_id,
          titulo,
          status,
          prioridade,
          prazo,
          created_at
        `),
    ]);

    const erro =
      projetosRes.error ||
      pendenciasRes.error ||
      marcosRes.error ||
      acoesRes.error;

    if (erro) {
      return NextResponse.json(
        {
          success: false,
          error: erro.message,
        },
        {
          status: 500,
        }
      );
    }

    const projetos =
      (projetosRes.data ?? []) as unknown as Projeto[];

    const pendencias =
      (pendenciasRes.data ?? []) as unknown as Pendencia[];

    const marcos =
      (marcosRes.data ?? []) as unknown as Marco[];

    const acoes =
      (acoesRes.data ?? []) as unknown as Acao[];

    const pendenciasPorProjeto =
      new Map<string, Pendencia[]>();

    const marcosPorProjeto =
      new Map<string, Marco[]>();

    const acoesPorProjeto =
      new Map<string, Acao[]>();

    for (const item of pendencias) {
      const lista =
        pendenciasPorProjeto.get(
          item.projeto_id
        ) ?? [];

      lista.push(item);

      pendenciasPorProjeto.set(
        item.projeto_id,
        lista
      );
    }

    for (const item of marcos) {
      const lista =
        marcosPorProjeto.get(
          item.projeto_id
        ) ?? [];

      lista.push(item);

      marcosPorProjeto.set(
        item.projeto_id,
        lista
      );
    }

    for (const item of acoes) {
      const lista =
        acoesPorProjeto.get(
          item.projeto_id
        ) ?? [];

      lista.push(item);

      acoesPorProjeto.set(
        item.projeto_id,
        lista
      );
    }

    const projetoMap = new Map(
      projetos.map((p) => [p.id, p])
    );

    const detalhes = projetos.map(
      (projeto) => {
        const p =
          pendenciasPorProjeto.get(
            projeto.id
          ) ?? [];

        const m =
          marcosPorProjeto.get(
            projeto.id
          ) ?? [];

        const a =
          acoesPorProjeto.get(
            projeto.id
          ) ?? [];

        const registrosAbertos =
          p.filter((x) =>
            aberto(x.status)
          );

        const pendenciasAbertas =
          registrosAbertos.filter(
            (x) => isPendencia(x.tipo)
          );

        const impedimentosAbertos =
          registrosAbertos.filter(
            (x) =>
              isImpedimento(x.tipo)
          );

        const acoesAbertas =
          a.filter((x) =>
            aberto(x.status)
          );

        const marcosAbertos =
          m.filter((x) =>
            aberto(x.status)
          );

        const pendenciasVencidas =
          pendenciasAbertas.filter(
            (x) => vencido(x.prazo)
          );

        const pendenciasHoje =
          pendenciasAbertas.filter(
            (x) =>
              diasAte(x.prazo) === 0
          );

        const pendencias48h =
          pendenciasAbertas.filter(
            (x) => {
              const d =
                diasAte(x.prazo);

              return (
                d !== null &&
                d >= 1 &&
                d <= 2
              );
            }
          );

        const pendencias72h =
          pendenciasAbertas.filter(
            (x) =>
              diasAte(x.prazo) === 3
          );

        const pendenciasSemPrazo =
          pendenciasAbertas.filter(
            (x) => !x.prazo
          );

        const maiorAgingPendenciaDias =
          pendenciasAbertas.length
            ? Math.max(
                ...pendenciasAbertas.map(
                  (x) =>
                    diasAberta(
                      x.created_at
                    )
                )
              )
            : 0;

        const impedimentosCriticos =
          impedimentosAbertos.filter(
            (x) =>
              prioridadeCritica(
                x.prioridade
              ) ||
              vencido(x.prazo)
          );

        const marcosAtrasados =
          marcosAbertos.filter(
            (x) =>
              vencido(
                x.data_prevista
              )
          );

        const acoesVencidas =
          acoesAbertas.filter(
            (x) =>
              vencido(x.prazo)
          );

        const projetoFechado =
          !aberto(projeto.status);

        const diasProjeto =
          diasAte(
            projeto.data_fim
          );

        const lateDays =
          !projetoFechado &&
          diasProjeto !== null &&
          diasProjeto < 0
            ? Math.abs(diasProjeto)
            : 0;

        const healthResult =
          calculateOperationalHealth({
            status:
              projeto.status,

            prioridade:
              projeto.prioridade,

            lateDays,

            hasOwner:
              Boolean(
                projeto.responsavel?.nome
              ),

            hasDeadline:
              Boolean(
                projeto.data_fim
              ),

            pendenciasVencidas:
              pendenciasVencidas.length,

            impedimentosAbertos:
              impedimentosAbertos.length,

            impedimentosCriticos:
              impedimentosCriticos.length,

            marcosAtrasados:
              marcosAtrasados.length,

            acoesVencidas:
              acoesVencidas.length,
          });

        const {
          saude,
          score,
          motivos,
          regra: regraSaude,
        } = healthResult;
        const proximaAcao =
          [...acoesAbertas]
            .sort((x, y) => {
              const dx =
                diasAte(x.prazo);

              const dy =
                diasAte(y.prazo);

              if (
                dx === null &&
                dy === null
              )
                return 0;

              if (dx === null)
                return 1;

              if (dy === null)
                return -1;

              return dx - dy;
            })[0] ?? null;

        return {
          ...projeto,

          saude,
          score,
          lateDays,
          motivos,
          regraSaude,

          proximaAcao:
            proximaAcao
              ? {
                  id:
                    proximaAcao.id,
                  titulo:
                    proximaAcao.titulo,
                  prioridade:
                    proximaAcao.prioridade,
                  prazo:
                    proximaAcao.prazo,
                  vencida:
                    vencido(
                      proximaAcao.prazo
                    ),
                }
              : null,

          detalhesAlertas: {
            pendenciasAbertas:
              pendenciasAbertas.map(
                (x) => ({
                  id: x.id,
                  titulo:
                    x.titulo,
                  prioridade:
                    x.prioridade,
                  prazo:
                    x.prazo,
                  created_at:
                    x.created_at,
                  agingDias:
                    diasAberta(
                      x.created_at
                    ),
                  responsavel:
                    x.responsavel ??
                    null,
                })
              ),

            pendenciasVencidas:
              pendenciasVencidas.map(
                (x) => ({
                  id: x.id,
                  titulo:
                    x.titulo,
                  prioridade:
                    x.prioridade,
                  prazo:
                    x.prazo,
                  created_at:
                    x.created_at,
                  agingDias:
                    diasAberta(
                      x.created_at
                    ),
                })
              ),

            impedimentos:
              impedimentosAbertos.map(
                (x) => ({
                  id: x.id,
                  titulo:
                    x.titulo,
                  prioridade:
                    x.prioridade,
                  prazo:
                    x.prazo,
                })
              ),

            marcosAtrasados:
              marcosAtrasados.map(
                (x) => ({
                  id: x.id,
                  nome: x.nome,
                  data_prevista:
                    x.data_prevista,
                })
              ),

            acoesVencidas:
              acoesVencidas.map(
                (x) => ({
                  id: x.id,
                  titulo:
                    x.titulo,
                  prioridade:
                    x.prioridade,
                  prazo:
                    x.prazo,
                })
              ),
          },

          indicadores: {
            projetoAtrasado:
              lateDays > 0,

            diasAtraso:
              lateDays,

            pendenciasAbertas:
              pendenciasAbertas.length,

            pendenciasVencidas:
              pendenciasVencidas.length,

            pendenciasHoje:
              pendenciasHoje.length,

            pendencias48h:
              pendencias48h.length,

            pendencias72h:
              pendencias72h.length,

            pendenciasSemPrazo:
              pendenciasSemPrazo.length,

            maiorAgingPendenciaDias,

            impedimentosAbertos:
              impedimentosAbertos.length,

            impedimentosCriticos:
              impedimentosCriticos.length,

            marcosAtrasados:
              marcosAtrasados.length,

            acoesAbertas:
              acoesAbertas.length,

            acoesVencidas:
              acoesVencidas.length,
          },
        };
      }
    );

    const ativos =
      detalhes.filter((x) =>
        aberto(x.status)
      );

    const proximosMarcos =
      marcos
        .filter((m) => {
          if (
            !aberto(m.status)
          )
            return false;

          const dias =
            diasAte(
              m.data_prevista
            );

          return (
            dias !== null &&
            dias >= 0 &&
            dias <= 15
          );
        })
        .sort((a, b) => {
          const da =
            diasAte(
              a.data_prevista
            ) ?? 99999;

          const db =
            diasAte(
              b.data_prevista
            ) ?? 99999;

          return da - db;
        })
        .map((m) => {
          const projeto =
            projetoMap.get(
              m.projeto_id
            );

          return {
            ...m,
            projeto:
              projeto
                ? {
                    id:
                      projeto.id,
                    nome:
                      projeto.nome,
                    cliente:
                      projeto.cliente ??
                      null,
                  }
                : null,
          };
        });

    const resumo = {
      total:
        detalhes.length,

      ativos:
        ativos.length,

      estaveis:
        ativos.filter(
          (x) =>
            x.saude ===
            "Estável"
        ).length,

      atencao:
        ativos.filter(
          (x) =>
            x.saude ===
            "Atenção"
        ).length,

      criticos:
        ativos.filter(
          (x) =>
            x.saude ===
            "Crítico"
        ).length,

      atrasados:
        ativos.filter(
          (x) =>
            x.indicadores
              .projetoAtrasado
        ).length,

      bloqueados:
        ativos.filter(
          (x) =>
            normalize(x.status) ===
            "bloqueado"
        ).length,

      semPrazo:
        ativos.filter(
          (x) =>
            !x.data_fim
        ).length,

      pendenciasAbertas:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendenciasAbertas,
          0
        ),

      pendenciasVencidas:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendenciasVencidas,
          0
        ),

      pendenciasHoje:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendenciasHoje,
          0
        ),

      pendencias48h:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendencias48h,
          0
        ),

      pendencias72h:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendencias72h,
          0
        ),

      pendenciasSemPrazo:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .pendenciasSemPrazo,
          0
        ),

      maiorAgingPendenciaDias:
        ativos.length
          ? Math.max(
              0,
              ...ativos.map(
                (x) =>
                  x.indicadores
                    .maiorAgingPendenciaDias
              )
            )
          : 0,

      impedimentos:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .impedimentosAbertos,
          0
        ),

      impedimentosCriticos:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .impedimentosCriticos,
          0
        ),

      marcosAtrasados:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .marcosAtrasados,
          0
        ),

      acoesAbertas:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .acoesAbertas,
          0
        ),

      acoesVencidas:
        ativos.reduce(
          (s, x) =>
            s +
            x.indicadores
              .acoesVencidas,
          0
        ),

      proximosMarcos:
        proximosMarcos.length,
    };

    const ranking =
      [...ativos]
        .filter(
          (x) =>
            x.score > 0
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .slice(0, 10);

    const porStatus =
      Object.entries(
        detalhes.reduce<
          Record<string, number>
        >((acc, projeto) => {
          acc[
            projeto.status
          ] =
            (
              acc[
                projeto.status
              ] ?? 0
            ) + 1;

          return acc;
        }, {})
      )
        .map(
          ([nome, total]) => ({
            nome,
            total,
          })
        )
        .sort(
          (a, b) =>
            b.total -
            a.total
        );

    const porEtapa =
      Object.entries(
        ativos.reduce<
          Record<string, number>
        >((acc, projeto) => {
          const nome =
            projeto.etapa
              ?.nome ??
            "Sem etapa";

          acc[nome] =
            (acc[nome] ?? 0) +
            1;

          return acc;
        }, {})
      )
        .map(
          ([nome, total]) => ({
            nome,
            total,
          })
        )
        .sort(
          (a, b) =>
            b.total -
            a.total
        );

    return NextResponse.json({
      success: true,
      atualizadoEm:
        new Date().toISOString(),

      resumo,

      ranking,

      projetos:
        ativos,

      proximosMarcos,

      porStatus,

      porEtapa,
    });
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[API /api/dashboard/executivo]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao montar dashboard executivo.",
      },
      {
        status: 500,
      }
    );
  }
}

