import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';

export const generateOrcamentoPDF = (orcamento: Orcamento) => {
  const doc = new jsPDF();

  // Header Colors
  const purpleColor = [168, 85, 247]; // #a855f7
  const blueColor = [59, 130, 246]; // #3b82f6
  const yellowColor = [250, 204, 21]; // #facc15
  const darkColor = [11, 11, 11]; // #0b0b0b

  // Logo / Header Section
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 50, 'F');
  
  // Decorative lines (vaporwave style)
  doc.setDrawColor(purpleColor[0], purpleColor[1], purpleColor[2]);
  doc.setLineWidth(0.5);
  doc.line(0, 48, 210, 48);
  doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.line(0, 49, 210, 49);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('MIX MOTO', 105, 22, { align: 'center' });
  
  // Highlight box for "CHOCOLATE"
  doc.setFillColor(yellowColor[0], yellowColor[1], yellowColor[2]);
  doc.roundedRect(90, 25, 30, 6, 2, 2, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CHOCOLATE', 105, 29.5, { align: 'center' });

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('WhatsApp: (18) 99757-1933', 105, 38, { align: 'center' });
  doc.text('CNPJ: 07.887.543/0001-30', 105, 43, { align: 'center' });

  // Client Info Section
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO DE SERVIÇOS', 15, 60);
  
  doc.setDrawColor(230, 230, 230);
  doc.line(15, 63, 195, 63);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 15, 72);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${orcamento.cliente}`, 15, 78);
  doc.text(`WhatsApp: ${orcamento.whatsapp}`, 15, 83);
  doc.text(`Moto: ${orcamento.moto}`, 15, 88);
  doc.text(`Placa: ${orcamento.placa || 'N/A'}`, 15, 93);
  
  const dateStr = formatDate(orcamento.createdAt?.toDate ? orcamento.createdAt.toDate() : orcamento.createdAt);
  doc.text(`Data: ${dateStr}`, 145, 78);

  let currentY = 105;

  // Table - Peças
  const subtotalPecas = orcamento.pecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
  if (orcamento.pecas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('PEÇAS E COMPONENTES', 15, currentY - 3);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Peça/Produto', 'Qtd', 'V. Unit', 'Total']],
      body: orcamento.pecas.map(p => [
        p.nome,
        p.quantidade,
        formatCurrency(p.valorUnitario),
        formatCurrency(p.quantidade * p.valorUnitario)
      ]),
      headStyles: { fillColor: [59, 130, 246] as any, fontStyle: 'bold' },
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal Peças: ${formatCurrency(subtotalPecas)}`, 195, currentY, { align: 'right' });
    currentY += 12;
  }

  // Table - Mão de Obra
  const subtotalServicos = orcamento.servicos.reduce((acc, s) => acc + s.valor, 0);
  if (orcamento.servicos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('MÃO DE OBRA / SERVIÇOS', 15, currentY - 3);

    autoTable(doc, {
      startY: currentY,
      head: [['Descrição do Serviço', 'Valor']],
      body: orcamento.servicos.map(s => [s.descricao, formatCurrency(s.valor)]),
      headStyles: { fillColor: [50, 50, 50] as any, fontStyle: 'bold' },
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal Serviços: ${formatCurrency(subtotalServicos)}`, 195, currentY, { align: 'right' });
    currentY += 15;
  }

  // Summary / Grand Total box
  if (currentY > 260) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(59, 130, 246);
  doc.rect(130, currentY, 65, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrency(orcamento.total)}`, 135, currentY + 10);

  // Bottom Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Este orçamento tem validade de 5 dias úteis.', 105, 285, { align: 'center' });
  doc.text('Mix Moto - (18) 99757-1933 - @mixmoto.oficina', 105, 290, { align: 'center' });

  return doc;
};

export const downloadOrcamento = (orcamento: Orcamento) => {
  const doc = generateOrcamentoPDF(orcamento);
  doc.save(`Orcamento_${orcamento.cliente.replace(/\s+/g, '_')}.pdf`);
};

export const shareOrcamentoWhatsApp = async (orcamento: Orcamento) => {
  const text = `*MIX MOTO - ORÇAMENTO*%0A%0A` +
               `*Cliente:* ${orcamento.cliente}%0A` +
               `*Moto:* ${orcamento.moto}%0A%0A` +
               `*SERVIÇOS:*%0A` +
               orcamento.servicos.map(s => `- ${s.descricao}: ${formatCurrency(s.valor)}`).join('%0A') + `%0A%0A` +
               `*PEÇAS:*%0A` +
               orcamento.pecas.map(p => `- ${p.nome} (x${p.quantidade}): ${formatCurrency(p.valorUnitario * p.quantidade)}`).join('%0A') + `%0A%0A` +
               `*TOTAL GERAL: ${formatCurrency(orcamento.total)}*%0A%0A` +
               `Mix Moto - Qualidade e Segurança!`;
               
  const whatsappUrl = `https://wa.me/55${orcamento.whatsapp.replace(/\D/g, '')}?text=${text}`;
  window.open(whatsappUrl, '_blank');
};
