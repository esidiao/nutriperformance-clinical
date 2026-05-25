'use client';

// Dynamic import para evitar SSR error
export async function generatePrescriptionPDF(data: PrescriptionData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210; // page width mm
  const M = 18;  // margin
  const CW = W - M * 2; // content width
  let y = 0;

  // ─── Colors ───────────────────────────────────────────────────────────────
  const BLUE    = [37, 99, 235]  as [number, number, number];
  const DARK    = [17, 24, 39]   as [number, number, number];
  const GRAY    = [107, 114, 128] as [number, number, number];
  const LGRAY   = [243, 244, 246] as [number, number, number];
  const WHITE   = [255, 255, 255] as [number, number, number];
  const AMBER   = [217, 119, 6]  as [number, number, number];
  const GREEN   = [22, 163, 74]  as [number, number, number];
  const RED     = [220, 38, 38]  as [number, number, number];
  const YELLOW  = [202, 138, 4]  as [number, number, number];

  // ─── Header bar ───────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 28, 'F');

  // Logo circle
  doc.setFillColor(...WHITE);
  doc.circle(M + 7, 14, 7, 'F');
  doc.setTextColor(...BLUE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('NP', M + 7, 14.8, { align: 'center' });

  // App name
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('NutriPerformance Clinical', M + 17, 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Plataforma de Apoio Profissional · CFN · CONFEF · LGPD (Lei 13.709/2018)', M + 17, 17);

  // Doc type badge
  doc.setFillColor(255, 255, 255, 0.2);
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const badgeLabel = data.type === 'prescription' ? 'PRESCRIÇÃO NUTRICIONAL' : 'PROTOCOLO DE SUPLEMENTAÇÃO';
  doc.text(badgeLabel, W - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Nº ${data.prescriptionNumber}  ·  ${data.date}`, W - M, 20, { align: 'right' });

  y = 36;

  // ─── Professional info box ────────────────────────────────────────────────
  doc.setFillColor(...LGRAY);
  doc.roundedRect(M, y, CW, 18, 2, 2, 'F');
  doc.setTextColor(...DARK);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(data.professional.name, M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`${data.professional.council} ${data.professional.councilNumber} · ${data.professional.specialty}`, M + 4, y + 11);
  doc.text(data.professional.clinic, M + 4, y + 16);

  // Date on right
  doc.setTextColor(...DARK);
  doc.setFontSize(7.5);
  doc.text(`Data: ${data.date}`, W - M - 4, y + 6, { align: 'right' });
  doc.text(`Validade: ${data.validity}`, W - M - 4, y + 11, { align: 'right' });

  y += 24;

  // ─── Patient section ──────────────────────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.setTextColor(...WHITE);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
  doc.text('DADOS DO PACIENTE', M + 3, y + 4.8);
  y += 10;

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const patCols = [
    `Código: ${data.patient.code}`,
    `Idade: ${data.patient.age} anos`,
    `Sexo: ${data.patient.gender}`,
    `Objetivo: ${data.patient.goal}`,
  ];
  const colW = CW / patCols.length;
  patCols.forEach((t, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(t.split(':')[0] + ':', M + colW * i, y);
    doc.setFont('helvetica', 'normal');
    doc.text(t.split(':')[1]?.trim() ?? '', M + colW * i + doc.getTextWidth(t.split(':')[0] + ': '), y);
  });
  y += 10;

  // ─── Items table ──────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.setTextColor(...WHITE);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
  const sectionTitle = data.type === 'prescription' ? 'PRESCRIÇÃO ALIMENTAR / NUTRICIONAL' : 'PROTOCOLO DE SUPLEMENTAÇÃO';
  doc.text(sectionTitle, M + 3, y + 4.8);
  y += 8;

  if (data.items.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [data.type === 'supplementation'
        ? ['Suplemento', 'Dose', 'Frequência', 'Horário', 'Observações']
        : ['Item / Alimento / Nutriente', 'Quantidade', 'Frequência', 'Orientação']
      ],
      body: data.items.map((item) =>
        data.type === 'supplementation'
          ? [item.name, item.dose, item.frequency, item.timing ?? '—', item.notes ?? '—']
          : [item.name, item.dose, item.frequency, item.notes ?? '—']
      ),
      styles: { fontSize: 8, cellPadding: 3, textColor: DARK },
      headStyles: { fillColor: LGRAY, textColor: DARK, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.text('Nenhum item prescrito.', M, y + 5);
    y += 12;
  }

  // ─── Interactions warnings ─────────────────────────────────────────────────
  if (data.interactions && data.interactions.length > 0) {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
    doc.setTextColor(...AMBER);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠  INTERAÇÕES E ALERTAS IDENTIFICADOS', M + 3, y + 4.8);
    y += 10;

    data.interactions.forEach((inter) => {
      const riskColor = inter.risk === 'high' || inter.risk === 'contraindicated' ? RED
        : inter.risk === 'moderate' ? YELLOW : GREEN;
      doc.setFillColor(...riskColor);
      doc.circle(M + 2.5, y + 1, 1.5, 'F');
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(inter.pair, M + 6, y + 2.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(inter.recommendation, CW - 10);
      doc.text(lines, M + 6, y + 7);
      y += 6 + lines.length * 4;
    });
    y += 4;
  }

  // ─── Professional notes ────────────────────────────────────────────────────
  if (data.professionalNotes) {
    doc.setFillColor(...LGRAY);
    doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
    doc.setTextColor(...DARK);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES DO PROFISSIONAL', M + 3, y + 4.8);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const noteLines = doc.splitTextToSize(data.professionalNotes, CW);
    doc.text(noteLines, M, y);
    y += noteLines.length * 5 + 6;
  }

  // ─── Signature block ───────────────────────────────────────────────────────
  // Push to bottom if space available
  const signY = Math.max(y + 10, 220);

  doc.setDrawColor(...GRAY);
  doc.setLineDashPattern([1, 1], 0);

  // Left: patient signature
  doc.line(M, signY, M + 70, signY);
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura do Paciente / Responsável', M, signY + 4);

  // Right: professional signature
  doc.line(W - M - 75, signY, W - M, signY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.setFontSize(7.5);
  doc.text(data.professional.name, W - M, signY + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.text(`${data.professional.council} ${data.professional.councilNumber}`, W - M, signY + 8, { align: 'right' });

  // ─── Footer ────────────────────────────────────────────────────────────────
  const footerY = 282;
  doc.setFillColor(...LGRAY);
  doc.rect(0, footerY - 2, W, 18, 'F');

  doc.setTextColor(...AMBER);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO LEGAL:', M, footerY + 3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const legalText = 'Documento gerado pelo NutriPerformance Clinical como ferramenta de APOIO ao profissional de saúde. NÃO constitui diagnóstico médico, ' +
    'prescrição farmacêutica ou substituição de consulta. Deve ser interpretado e validado exclusivamente pelo profissional habilitado responsável. ' +
    'CFN Res. 599/2018 · CONFEF · LGPD (Lei 13.709/2018). Dados protegidos por criptografia AES-256.';
  const legalLines = doc.splitTextToSize(legalText, CW - 25);
  doc.text(legalLines, M + 17, footerY + 3);

  // Page number
  doc.setFontSize(7);
  doc.text(`Página 1 de 1  ·  Gerado em ${data.date}`, W - M, footerY + 10, { align: 'right' });

  // ─── Save ──────────────────────────────────────────────────────────────────
  const filename = `prescricao-${data.patient.code.toLowerCase().replace(/\s+/g, '-')}-${data.date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

// ─── Types ─────────────────────────────────────────────────────────────────
export interface PrescriptionItem {
  name: string;
  dose: string;
  frequency: string;
  timing?: string;
  notes?: string;
}

export interface PrescriptionInteraction {
  pair: string;
  risk: 'low' | 'moderate' | 'high' | 'contraindicated';
  recommendation: string;
}

export interface PrescriptionData {
  type: 'prescription' | 'supplementation';
  prescriptionNumber: string;
  date: string;
  validity: string;
  professional: {
    name: string;
    council: string;
    councilNumber: string;
    specialty: string;
    clinic: string;
  };
  patient: {
    code: string;
    age: number;
    gender: string;
    goal: string;
  };
  items: PrescriptionItem[];
  interactions?: PrescriptionInteraction[];
  professionalNotes?: string;
}
