export interface ItemEstoque {
  id: string;
  nome: string;
  codigo?: string;
  marca?: string;
  quantidade: number;
  valorCusto?: number;
  valorVenda: number;
  categoria?: string;
  updatedAt: any;
}

export interface PecaUsada {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorCusto?: number; // Store cost at time of sale
}

export interface ServicoRealizado {
  id: string;
  cliente: string;
  whatsapp: string;
  moto: string;
  placa?: string;
  servicoRealizado: string; // Brief description
  pecasUsadas: PecaUsada[];
  servicos: MaoDeObraOrcamento[]; // Dynamic labor list
  total: number;
  formaPagamento: 'Pix' | 'Dinheiro' | 'Cartão';
  createdAt: any;
}

export interface PecaOrcamento {
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface MaoDeObraOrcamento {
  descricao: string;
  valor: number;
}

export interface Orcamento {
  id: string;
  cliente: string;
  whatsapp: string;
  moto: string;
  placa?: string;
  pecas: PecaOrcamento[];
  servicos: MaoDeObraOrcamento[];
  total: number;
  createdAt: any;
}

export interface TransacaoCaixa {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  formaPagamento: 'Pix' | 'Dinheiro' | 'Cartão';
  data: any;
}

export type Tab = 'inicio' | 'estoque' | 'servicos' | 'orcamentos' | 'caixa';
