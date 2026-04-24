import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';

export const generateOrcamentoPDF = (orcamento: Orcamento) => {
  const doc = new jsPDF();

  // Header Colors
  const brandColor = [0, 153, 255]; // #0099ff
  const darkColor = [11, 11, 11]; // #0b0b0b

  // Logo Placeholder / Name
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MIX MOTO', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SISTEMA DE GESTÃO DE OFICINA', 105, 28, { align: 'center' });

  // Client Info
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', 15, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${orcamento.cliente}`, 15, 65);
  doc.text(`WhatsApp: ${orcamento.whatsapp}`, 15, 70);
  doc.text(`Moto: ${orcamento.moto}`, 15, 75);
  doc.text(`Placa: ${orcamento.placa || 'N/A'}`, 15, 80);
  const dateStr = formatDate(orcamento.createdAt?.toDate ? orcamento.createdAt.toDate() : orcamento.createdAt);
  doc.text(`Data: ${dateStr}`, 140, 65);

  // Table - Peças
  let finalY = 90;
  if (orcamento.pecas.length > 0) {
    autoTable(doc, {
      startY: 90,
      head: [['Peça', 'Qtd', 'V. Unit', 'Subtotal']],
      body: orcamento.pecas.map(p => [
        p.nome,
        p.quantidade,
        formatCurrency(p.valorUnitario),
        formatCurrency(p.quantidade * p.valorUnitario)
      ]),
      headStyles: { fillColor: brandColor as any },
      theme: 'grid'
    });
    finalY = (doc as any).lastAutoTable.finalY;
  }

  // Table - Mão de Obra
  if (orcamento.servicos.length > 0) {
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Descrição do Serviço', 'Valor']],
      body: orcamento.servicos.map(s => [s.descricao, formatCurrency(s.valor)]),
      headStyles: { fillColor: brandColor as any },
      theme: 'grid'
    });
    finalY = (doc as any).lastAutoTable.finalY;
  }

  // Total
  const totalY = finalY + 15;
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.rect(130, totalY - 8, 65, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrency(orcamento.total)}`, 135, totalY);

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text('Obrigado pela preferência! Mix Moto - Especialistas em Duas Rodas.', 105, 285, { align: 'center' });

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
