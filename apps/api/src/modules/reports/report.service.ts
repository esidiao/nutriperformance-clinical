import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { createHash } from 'crypto';

export interface ReportData {
  type: string;
  patient: {
    internalCode: string;
    age: number;
    gender: string;
  };
  professional: {
    fullName: string;
    councilType: string;
    councilNumber: string;
    councilState: string;
  };
  workspace: { name: string };
  date: string;
  nutritionalAssessment?: Record<string, unknown>;
  physicalAssessment?: Record<string, unknown>;
  supplementation?: Record<string, unknown>[];
  interactions?: Record<string, unknown>;
  bioavailability?: Record<string, unknown>;
  goals?: Record<string, unknown>[];
  professionalNotes?: string;
}

const LEGAL_DISCLAIMER = `
Este relatório foi gerado pelo sistema NutriPerformance Clinical como ferramenta de apoio profissional.
NÃO constitui diagnóstico médico, prescrição terapêutica ou tratamento clínico.
As informações devem ser interpretadas exclusivamente pelo profissional de saúde habilitado responsável pelo acompanhamento do paciente.
O sistema respeita o Código de Ética do Nutricionista (CFN), o Código de Ética do Profissional de Educação Física (CONFEF) e a LGPD (Lei 13.709/2018).
`;

@Injectable()
export class ReportService {
  async generatePDF(data: ReportData): Promise<Buffer> {
    const html = this.buildHTML(data);
    const contentHash = createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:9px;color:#666;width:100%;padding:0 15mm;box-sizing:border-box;display:flex;justify-content:space-between;">
            <span>NutriPerformance Clinical</span>
            <span>${data.workspace.name}</span>
          </div>`,
        footerTemplate: `
          <div style="font-size:8px;color:#888;width:100%;padding:0 15mm;box-sizing:border-box;display:flex;justify-content:space-between;">
            <span>Hash: ${contentHash}</span>
            <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
            <span>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</span>
          </div>`,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private buildHTML(data: ReportData): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
    .header { background: #1e40af; color: white; padding: 16px 0; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header p { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .section { margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .section-title { background: #f1f5f9; padding: 8px 12px; font-weight: 700; font-size: 12px; color: #1e40af; border-bottom: 1px solid #e5e7eb; }
    .section-body { padding: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .field { margin-bottom: 6px; }
    .field label { font-weight: 600; color: #4b5563; font-size: 10px; text-transform: uppercase; }
    .field p { color: #1a1a1a; margin-top: 1px; }
    .alert-high { background: #fef2f2; border-left: 3px solid #dc2626; padding: 8px 12px; margin: 6px 0; border-radius: 0 4px 4px 0; }
    .alert-moderate { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; margin: 6px 0; border-radius: 0 4px 4px 0; }
    .alert-low { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px 12px; margin: 6px 0; border-radius: 0 4px 4px 0; }
    .disclaimer { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 24px; font-size: 9.5px; color: #78350f; line-height: 1.6; }
    .signature-block { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .signature-line { border-top: 1px solid #374151; padding-top: 6px; text-align: center; font-size: 10px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700; }
    .badge-high { background: #fecaca; color: #dc2626; }
    .badge-moderate { background: #fde68a; color: #b45309; }
    .badge-low { background: #bbf7d0; color: #15803d; }
    .badge-contraindicated { background: #fee2e2; color: #7f1d1d; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
    th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 10px; color: #374151; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
  </style>
</head>
<body>

<div class="header">
  <h1>NutriPerformance Clinical — Relatório ${this.getReportTitle(data.type)}</h1>
  <p>${data.workspace.name} &nbsp;|&nbsp; Data: ${data.date} &nbsp;|&nbsp; ${data.professional.fullName} — ${data.professional.councilType} ${data.professional.councilNumber}-${data.professional.councilState}</p>
</div>

<!-- IDENTIFICAÇÃO DO PACIENTE (sem dados pessoais diretos — LGPD) -->
<div class="section">
  <div class="section-title">Identificação</div>
  <div class="section-body grid-3">
    <div class="field"><label>Código Interno</label><p>${data.patient.internalCode}</p></div>
    <div class="field"><label>Idade</label><p>${data.patient.age} anos</p></div>
    <div class="field"><label>Sexo</label><p>${data.patient.gender}</p></div>
  </div>
</div>

${data.nutritionalAssessment ? this.buildNutritionalSection(data.nutritionalAssessment) : ''}
${data.physicalAssessment ? this.buildPhysicalSection(data.physicalAssessment) : ''}
${data.supplementation?.length ? this.buildSupplementationSection(data.supplementation) : ''}
${data.interactions ? this.buildInteractionsSection(data.interactions) : ''}
${data.bioavailability ? this.buildBioavailabilitySection(data.bioavailability) : ''}
${data.goals?.length ? this.buildGoalsSection(data.goals) : ''}

${data.professionalNotes ? `
<div class="section">
  <div class="section-title">Observações Profissionais</div>
  <div class="section-body"><p>${data.professionalNotes}</p></div>
</div>` : ''}

<!-- ASSINATURA -->
<div class="signature-block">
  <div class="signature-line">
    ${data.professional.fullName}<br>
    ${data.professional.councilType} ${data.professional.councilNumber}-${data.professional.councilState}
  </div>
  <div class="signature-line">
    Data: _____ / _____ / _________<br>
    Assinatura e Carimbo
  </div>
</div>

<!-- AVISO LEGAL -->
<div class="disclaimer">
  <strong>AVISO LEGAL:</strong> ${LEGAL_DISCLAIMER}
</div>

</body>
</html>`;
  }

  private getReportTitle(type: string): string {
    const titles: Record<string, string> = {
      nutritional_assessment: 'Avaliação Nutricional',
      physical_assessment: 'Avaliação Física',
      supplementation_analysis: 'Análise de Suplementação',
      full_clinical: 'Clínico Completo',
      evolution: 'Evolução',
      goals: 'Metas e Acompanhamento',
    };
    return titles[type] ?? 'Clínico';
  }

  private buildNutritionalSection(data: Record<string, unknown>): string {
    return `
<div class="section">
  <div class="section-title">Avaliação Nutricional</div>
  <div class="section-body">
    <div class="grid-3">
      <div class="field"><label>GET (kcal/dia)</label><p>${data['totalEnergyExpenditure'] ?? '—'}</p></div>
      <div class="field"><label>Meta Calórica</label><p>${data['caloricTarget'] ?? '—'} kcal</p></div>
      <div class="field"><label>Fórmula BMR</label><p>${data['bmrFormula'] ?? '—'}</p></div>
      <div class="field"><label>Proteína alvo</label><p>${data['proteinTargetG'] ?? '—'} g/dia</p></div>
      <div class="field"><label>Carboidrato alvo</label><p>${data['carbTargetG'] ?? '—'} g/dia</p></div>
      <div class="field"><label>Gordura alvo</label><p>${data['fatTargetG'] ?? '—'} g/dia</p></div>
    </div>
    ${data['dietaryStrategy'] ? `<div class="field" style="margin-top:10px;"><label>Estratégia Alimentar</label><p>${data['dietaryStrategy']}</p></div>` : ''}
    ${data['nutritionalDiagnosis'] ? `<div class="field" style="margin-top:8px;"><label>Diagnóstico Nutricional (Profissional)</label><p>${data['nutritionalDiagnosis']}</p></div>` : ''}
  </div>
</div>`;
  }

  private buildPhysicalSection(data: Record<string, unknown>): string {
    return `
<div class="section">
  <div class="section-title">Avaliação Física e Composição Corporal</div>
  <div class="section-body">
    <div class="grid-3">
      <div class="field"><label>Peso</label><p>${data['weightKg'] ?? '—'} kg</p></div>
      <div class="field"><label>Altura</label><p>${data['heightCm'] ?? '—'} cm</p></div>
      <div class="field"><label>IMC</label><p>${data['bmi'] ?? '—'} kg/m²</p></div>
      <div class="field"><label>% Gordura</label><p>${data['bodyFatPct'] ?? '—'}%</p></div>
      <div class="field"><label>Massa Magra</label><p>${data['leanMassKg'] ?? '—'} kg</p></div>
      <div class="field"><label>Massa Muscular</label><p>${data['muscleMassKg'] ?? '—'} kg</p></div>
      <div class="field"><label>Cintura</label><p>${data['waistCm'] ?? '—'} cm</p></div>
      <div class="field"><label>Quadril</label><p>${data['hipCm'] ?? '—'} cm</p></div>
      <div class="field"><label>RCQ</label><p>${data['waistHipRatio'] ?? '—'}</p></div>
    </div>
    <div class="grid-2" style="margin-top:10px;">
      <div class="field"><label>Nível de Atividade</label><p>${data['activityLevel'] ?? '—'}</p></div>
      <div class="field"><label>Modalidade Esportiva</label><p>${data['sportModality'] ?? '—'}</p></div>
      <div class="field"><label>Frequência Semanal</label><p>${data['weeklyFrequency'] ?? '—'} dias/sem</p></div>
      <div class="field"><label>Objetivo Principal</label><p>${data['primaryGoal'] ?? '—'}</p></div>
    </div>
  </div>
</div>`;
  }

  private buildSupplementationSection(supplements: Record<string, unknown>[]): string {
    const rows = supplements
      .map(
        (s) => `
      <tr>
        <td>${s['supplementName']}</td>
        <td>${s['category'] ?? '—'}</td>
        <td>${s['dose']} / ${s['frequency']}</td>
        <td>${s['timing'] ?? '—'}</td>
        <td><span class="badge badge-${s['riskLevel'] ?? 'low'}">${s['riskLevel'] ?? '—'}</span></td>
      </tr>`,
      )
      .join('');

    return `
<div class="section">
  <div class="section-title">Suplementação</div>
  <div class="section-body">
    <table>
      <thead><tr><th>Suplemento</th><th>Categoria</th><th>Dose / Frequência</th><th>Horário</th><th>Risco</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
  }

  private buildInteractionsSection(interactions: Record<string, unknown>): string {
    const items = (interactions['interactionsFound'] as Record<string, unknown>[]) ?? [];
    if (!items.length) return '';

    const alerts = items
      .map((i) => {
        const level = String(i['riskLevel'] ?? 'low');
        const cls =
          level === 'high' || level === 'contraindicated'
            ? 'alert-high'
            : level === 'moderate'
              ? 'alert-moderate'
              : 'alert-low';
        return `
        <div class="${cls}">
          <strong>${i['entityA']} × ${i['entityB']}</strong>
          <span class="badge badge-${level}" style="margin-left:8px;">${level}</span>
          <p style="margin-top:4px;">${i['mechanism'] ?? ''}</p>
          ${i['recommendation'] ? `<p style="margin-top:3px;font-weight:600;">→ ${i['recommendation']}</p>` : ''}
          <p style="font-size:9px;color:#666;margin-top:3px;">Evidência: ${i['evidenceQuality'] ?? '—'} | Confiança: ${i['confidenceLevel'] ?? '—'} | Fonte: ${i['source'] ?? '—'}</p>
        </div>`;
      })
      .join('');

    return `
<div class="section">
  <div class="section-title">Análise de Interações</div>
  <div class="section-body">
    <p style="font-size:10px;color:#4b5563;margin-bottom:10px;">Risco geral: <strong>${interactions['overallRiskLevel']}</strong></p>
    ${alerts}
  </div>
</div>`;
  }

  private buildBioavailabilitySection(data: Record<string, unknown>): string {
    return `
<div class="section">
  <div class="section-title">Análise de Biodisponibilidade</div>
  <div class="section-body">
    <p>${data['overallAssessment'] ?? '—'}</p>
    ${data['referralNeeded'] ? `<div class="alert-high" style="margin-top:10px;"><strong>Encaminhamento recomendado:</strong> ${data['referralReason']}</div>` : ''}
  </div>
</div>`;
  }

  private buildGoalsSection(goals: Record<string, unknown>[]): string {
    const rows = goals
      .map(
        (g) => `
      <tr>
        <td>${g['goalType']}</td>
        <td>${g['description']}</td>
        <td>${g['baselineValue'] ?? '—'} → ${g['targetValue'] ?? '—'} ${g['targetUnit'] ?? ''}</td>
        <td>${g['targetDate'] ?? '—'}</td>
        <td>${g['isAchieved'] ? '✓ Atingida' : 'Em andamento'}</td>
      </tr>`,
      )
      .join('');

    return `
<div class="section">
  <div class="section-title">Metas e Acompanhamento</div>
  <div class="section-body">
    <table>
      <thead><tr><th>Tipo</th><th>Descrição</th><th>Baseline → Meta</th><th>Prazo</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
  }
}
