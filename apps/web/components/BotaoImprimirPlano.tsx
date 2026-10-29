'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  montarImpressaoDoPlano, SemIdentidadeProfissional,
  type RefeicaoDoPlano, type SubstituicaoDoItem,
} from '@/lib/plano-para-impressao';

/**
 * Gera a folha do plano para o PACIENTE.
 *
 * Pedido da nutricionista (29/10/2026): depois de fechar o planejamento, ter
 * o plano impresso para entregar — com as refeições e as substituições.
 * Antes isso só existia em `/prescriptions/new`, uma tela separada: ela
 * montaria o plano aqui e redigitaria tudo lá. É provavelmente o que ela
 * chamou de "eles nunca chegaram até o final".
 *
 * A MONTAGEM NÃO MORA AQUI, de propósito: está em `lib/plano-para-impressao`,
 * onde se testa. Este arquivo só busca os dados e trata a falha.
 */
export function BotaoImprimirPlano({
  planoId, pacienteId, refeicoes, totais,
}: {
  planoId: string;
  pacienteId: string;
  refeicoes: RefeicaoDoPlano[];
  totais?: { kcal?: number; proteinasG?: number; carboidratosG?: number; lipidiosG?: number };
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem assina. Buscado aqui e não no clique porque, faltando, o botão deve
  // avisar ANTES — e não depois de a profissional achar que imprimiu.
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => api.usuarios.eu(), retry: false });

  // O paciente é buscado aqui porque a tela do plano não o carrega: ela
  // trabalha com o plano. Documento sem nome de paciente não identifica
  // ninguém — mesmo motivo do registro de conselho.
  const pac = useQuery({
    queryKey: ['patient', pacienteId],
    queryFn: () => api.patients.get(pacienteId),
    enabled: !!pacienteId,
  });

  const temItem = refeicoes.some((r) => r.itens.length > 0);

  async function imprimir() {
    setErro(null);
    setGerando(true);
    try {
      // As trocas vêm da mesma rota que alimenta a lista na tela: uma fonte só.
      let porAlimento: Record<string, SubstituicaoDoItem[]> = {};
      try {
        const subs: any = await api.mealPlans.substituicoes(planoId);
        for (const it of subs?.itens ?? []) {
          const nome = it?.lista?.origem?.nome;
          if (!nome) continue;
          porAlimento[nome] = (it.lista.substituicoes ?? []).map((s: any) => ({
            nome: s.nome, quantidadeG: s.quantidadeG, medidaTexto: s.medidaTexto,
          }));
        }
      } catch {
        // Sem trocas a folha ainda serve: o plano é o que o paciente executa.
        // Falhar a impressão inteira por causa da coluna opcional seria pior.
        porAlimento = {};
      }

      const dados = montarImpressaoDoPlano({
        plano: { id: planoId },
        refeicoes,
        substituicoesPorAlimento: porAlimento,
        paciente: {
          nome: pac.data?.name ?? '',
          codigo: pac.data?.internalCode,
          idade: pac.data?.age,
          sexo: pac.data?.gender,
        },
        profissional: eu.data
          ? {
            nome: eu.data.nome,
            conselho: eu.data.conselho,
            conselhoNumero: eu.data.conselhoNumero,
            conselhoUf: eu.data.conselhoUf,
          }
          : null,
        totais,
      });

      const { generatePrescriptionPDF } = await import('@/lib/pdf/generatePrescription');
      await generatePrescriptionPDF(dados);
    } catch (e) {
      setErro(
        e instanceof SemIdentidadeProfissional
          ? e.message
          : 'Não foi possível gerar o documento. Tente novamente.',
      );
    } finally {
      setGerando(false);
    }
  }

  const semIdentidade = !eu.isLoading && (!eu.data?.conselho || !eu.data?.conselhoNumero);

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={imprimir}
        disabled={gerando || eu.isLoading || pac.isLoading || !temItem || semIdentidade}
      >
        {gerando
          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando…</>
          : <><Printer className="h-3.5 w-3.5 mr-1.5" /> Plano do paciente (PDF)</>}
      </Button>

      {!temItem && (
        <p className="text-[11px] text-muted-foreground">
          Acrescente alimentos ao plano para poder imprimir.
        </p>
      )}

      {semIdentidade && (
        <p className="text-[11px] text-amber-700 dark:text-amber-500">
          Seu perfil não tem registro de conselho. Um documento clínico não pode
          ser emitido sem o nome e o registro de quem assina.
        </p>
      )}

      {erro && <p className="text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}
