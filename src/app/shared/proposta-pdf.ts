import { jsPDF } from 'jspdf';
import { Proposta } from '../core/models';

const UNIT_LABELS: Record<string, string> = {
  vaga: 'vaga',
  participante: 'participante',
  encontro: 'encontro',
  projeto: 'projeto fechado',
  hora: 'hora',
};

function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Gera o PDF da proposta no navegador (sem Cloud Function) e dispara o download. */
export function downloadPropostaPdf(p: Proposta): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 20;
  let y = 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(107, 20, 40);
  doc.text('Trovalim Consultoria', marginX, y);
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  y += 8;
  doc.text('Proposta Comercial', marginX, y);

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Para: ${p.clientName}`, marginX, y);
  if (p.contactName) {
    y += 5;
    doc.text(`Contato: ${p.contactName}`, marginX, y);
  }
  if (p.email) {
    y += 5;
    doc.text(`E-mail: ${p.email}`, marginX, y);
  }

  if (p.escopo) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Escopo', marginX, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(p.escopo, 170);
    doc.text(lines, marginX, y);
    y += lines.length * 5;
  }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Itens', marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFillColor(107, 20, 40);
  doc.setTextColor(255, 255, 255);
  doc.rect(marginX, y - 4, 170, 6, 'F');
  doc.text('Item', marginX + 2, y);
  doc.text('Unidade', marginX + 85, y);
  doc.text('Qtd.', marginX + 120, y);
  doc.text('Valor', marginX + 168, y, { align: 'right' });
  y += 7;

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  for (const item of p.items) {
    if (y > 265) {
      doc.addPage();
      y = 25;
    }
    doc.text(item.name, marginX + 2, y);
    doc.text(UNIT_LABELS[item.unit] || item.unit, marginX + 85, y);
    doc.text(String(item.qty), marginX + 120, y);
    doc.text(currency(item.baseValue * item.qty), marginX + 168, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, marginX + 170, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', marginX + 120, y);
  doc.text(currency(p.total), marginX + 168, y, { align: 'right' });

  if (p.condicoes) {
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Condições', marginX, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(p.condicoes, 170);
    doc.text(lines, marginX, y);
  }

  doc.save(`proposta-${p.clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
