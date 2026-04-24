import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db 
} from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  increment,
  limit
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Package, 
  Wrench, 
  ReceiptText, 
  Wallet, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Download, 
  Share2,
  ChevronRight,
  AlertTriangle,
  Menu,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatDate, cn } from './lib/utils';
import { 
  Tab, 
  ItemEstoque, 
  ServicoRealizado, 
  Orcamento, 
  TransacaoCaixa,
  PecaUsada,
  PecaOrcamento,
  MaoDeObraOrcamento
} from './types';
import { downloadOrcamento, shareOrcamentoWhatsApp } from './services/pdfService';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// --- COMPONENTS ---

const DashboardView = ({ 
  estoque, 
  servicos, 
  caixa, 
  orcamentos 
}: { 
  estoque: ItemEstoque[], 
  servicos: ServicoRealizado[], 
  caixa: TransacaoCaixa[], 
  orcamentos: Orcamento[] 
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const faturamentoDia = servicos
      .filter(s => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d >= today;
      })
      .reduce((acc, s) => acc + s.total, 0);

    const servicosHoje = servicos.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return d >= today;
    }).length;

    const estoqueBaixo = estoque.filter(i => i.quantidade < 5).length;
    
    const saldoCaixa = caixa.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    
    const orcamentosPendentes = orcamentos.length;

    return { faturamentoDia, servicosHoje, estoqueBaixo, saldoCaixa, orcamentosPendentes };
  }, [estoque, servicos, caixa, orcamentos]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Painel de Controle</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Faturamento Hoje" value={formatCurrency(stats.faturamentoDia)} color="text-brand" />
        <StatCard label="Serviços Hoje" value={stats.servicosHoje} color="text-brand" />
        <StatCard label="Estoque Baixo" value={stats.estoqueBaixo} color={stats.estoqueBaixo > 0 ? "text-orange-500" : "text-gray-400"} />
        <StatCard label="Caixa Atual" value={formatCurrency(stats.saldoCaixa)} color="text-brand" />
        <StatCard label="Orçamentos" value={stats.orcamentosPendentes} color="text-brand" />
      </div>

      <div className="bg-card-dark p-6 rounded-2xl border border-gray-800">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" /> Itens em Alerta (Estoque Baixo)
        </h3>
        <div className="space-y-3">
          {estoque.filter(i => i.quantidade < 5).map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-black/30 rounded-xl">
              <div>
                <p className="font-medium">{item.nome}</p>
                <p className="text-xs text-gray-500">{item.marca}</p>
              </div>
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold", item.quantidade === 0 ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-500")}>
                {item.quantidade} un
              </span>
            </div>
          ))}
          {estoque.filter(i => i.quantidade < 5).length === 0 && (
            <p className="text-gray-500 text-sm italic">Nenhum item com estoque baixo.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: string | number, color?: string }) => (
  <div className="bg-card-dark p-4 rounded-2xl border border-gray-800 flex flex-col justify-between h-32">
    <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">{label}</span>
    <span className={cn("text-xl font-display font-bold", color)}>{value}</span>
  </div>
);

// --- ESTOQUE ---
const EstoqueView = ({ estoque, userId }: { estoque: ItemEstoque[], userId: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = estoque.filter(i => 
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (data: any) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, `usuarios/${userId}/estoque`, editingItem.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, `usuarios/${userId}/estoque`), {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      // Close keyboard
      (document.activeElement as HTMLElement)?.blur();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este item?')) {
      await deleteDoc(doc(db, `usuarios/${userId}/estoque`, id));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Estoque</h2>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-brand p-3 rounded-full shadow-lg shadow-brand/20">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input 
          type="text" 
          placeholder="Buscar peça ou código..." 
          className="w-full pl-12 pr-4 py-3 rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filtered.map(item => (
          <div key={item.id} className="bg-card-dark p-4 rounded-2xl border border-gray-800 flex justify-between items-center group">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold">{item.nome}</p>
                {item.quantidade < 5 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
              </div>
              <p className="text-xs text-gray-500">{item.marca} • {item.codigo || 'S/ Código'}</p>
              <p className="text-brand font-bold mt-1">{formatCurrency(item.valorVenda)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-2">
                <p className="text-xs text-gray-500 uppercase font-bold">Qtd</p>
                <p className={cn("text-lg font-bold", item.quantidade === 0 ? "text-red-500" : "text-white")}>{item.quantidade}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 bg-gray-800 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card-dark w-full max-w-md p-6 rounded-3xl border border-gray-800">
            <h3 className="text-xl font-bold mb-6">{editingItem ? 'Editar Peça' : 'Nova Peça'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              handleSave({
                ...data,
                quantidade: Number(data.quantidade),
                valorCusto: Number(data.valorCusto),
                valorVenda: Number(data.valorVenda)
              });
            }} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Nome da Peça</label>
                <input name="nome" defaultValue={editingItem?.nome} required className="w-full rounded-xl px-4 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Código</label>
                  <input name="codigo" defaultValue={editingItem?.codigo} className="w-full rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Marca</label>
                  <input name="marca" defaultValue={editingItem?.marca} className="w-full rounded-xl px-4 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Quantidade</label>
                  <input name="quantidade" type="number" defaultValue={editingItem?.quantidade || 0} required className="w-full rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">V. Custo</label>
                  <input name="valorCusto" type="number" step="0.01" defaultValue={editingItem?.valorCusto || 0} className="w-full rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">V. Venda</label>
                  <input name="valorVenda" type="number" step="0.01" defaultValue={editingItem?.valorVenda || 0} required className="w-full rounded-xl px-4 py-2" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Categoria</label>
                <input name="categoria" defaultValue={editingItem?.categoria} className="w-full rounded-xl px-4 py-2" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand font-bold uppercase text-xs tracking-widest">Salvar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// --- SERVIÇOS ---
const ServicosView = ({ servicos, estoque, userId }: { servicos: ServicoRealizado[], estoque: ItemEstoque[], userId: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPecas, setSelectedPecas] = useState<PecaUsada[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const totalPecas = selectedPecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
    const maoDeObra = Number(data.maoDeObra);
    const total = totalPecas + maoDeObra;

    try {
      // 1. Registrar Serviço
      const servicoRef = await addDoc(collection(db, `usuarios/${userId}/servicos`), {
        cliente: data.cliente,
        whatsapp: data.whatsapp,
        moto: data.moto,
        placa: data.placa,
        servicoRealizado: data.servicoRealizado,
        pecasUsadas: selectedPecas,
        maoDeObra,
        formaPagamento: data.formaPagamento,
        total,
        createdAt: serverTimestamp()
      });

      // 2. Registrar no Caixa
      await addDoc(collection(db, `usuarios/${userId}/caixa`), {
        tipo: 'entrada',
        valor: total,
        descricao: `Srv: ${data.cliente} - ${data.moto}`,
        formaPagamento: data.formaPagamento,
        data: serverTimestamp()
      });

      // 3. Dar baixa no estoque
      for (const peca of selectedPecas) {
        await updateDoc(doc(db, `usuarios/${userId}/estoque`, peca.id), {
          quantidade: increment(-peca.quantidade)
        });
      }

      setIsModalOpen(false);
      setSelectedPecas([]);
      // Close keyboard
      (document.activeElement as HTMLElement)?.blur();
    } catch (e) {
      console.error(e);
    }
  };

  const addPecaToServico = (item: ItemEstoque) => {
    const existing = selectedPecas.find(p => p.id === item.id);
    if (existing) {
      setSelectedPecas(selectedPecas.map(p => p.id === item.id ? { ...p, quantidade: p.quantidade + 1 } : p));
    } else {
      setSelectedPecas([...selectedPecas, { id: item.id, nome: item.nome, quantidade: 1, valorUnitario: item.valorVenda }]);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Serviços</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-brand p-3 rounded-full shadow-lg shadow-brand/20">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {servicos.map(s => (
          <div key={s.id} className="bg-card-dark p-4 rounded-2xl border border-gray-800">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold">{s.cliente}</p>
                <p className="text-xs text-gray-500">{s.moto} • {s.placa}</p>
              </div>
              <span className="text-brand font-bold">{formatCurrency(s.total)}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="bg-black/50 px-2 py-0.5 rounded text-[10px] text-gray-400 capitalize">{s.formaPagamento}</span>
              <span className="bg-black/50 px-2 py-0.5 rounded text-[10px] text-gray-400">
                {formatDate(s.createdAt?.toDate ? s.createdAt.toDate() : s.createdAt)}
              </span>
            </div>
            <p className="text-sm text-gray-300 line-clamp-2">{s.servicoRealizado}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card-dark w-full max-w-2xl mx-auto rounded-3xl border border-gray-800 p-6 min-h-max">
            <h3 className="text-xl font-bold mb-6">Lançar Novo Serviço</h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cliente" name="cliente" required />
                <Input label="WhatsApp" name="whatsapp" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Moto / Modelo" name="moto" required />
                <Input label="Placa" name="placa" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase font-bold">Adicionar Peças do estoque</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Filtrar peças..." 
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {estoque.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <button 
                      key={item.id} 
                      type="button" 
                      onClick={() => addPecaToServico(item)}
                      className="whitespace-nowrap px-3 py-1.5 bg-black rounded-lg text-xs border border-gray-800 hover:border-brand transition-colors"
                    >
                      {item.nome} ({item.quantidade})
                    </button>
                  ))}
                </div>
              </div>

              {selectedPecas.length > 0 && (
                <div className="bg-black/30 rounded-2xl p-4 border border-gray-800/50">
                  <h4 className="text-xs uppercase font-bold text-gray-500 mb-2">Peças Selecionadas</h4>
                  {selectedPecas.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-800 last:border-0">
                      <span>{p.nome} (x{p.quantidade})</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(p.valorUnitario * p.quantidade)}</span>
                        <button type="button" onClick={() => setSelectedPecas(selectedPecas.filter(sp => sp.id !== p.id))} className="text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Mão de Obra (R$)</label>
                  <input name="maoDeObra" type="number" step="0.01" required className="w-full rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Pagamento</label>
                  <select name="formaPagamento" className="w-full rounded-xl px-4 py-2">
                    <option>Pix</option>
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Serviço Realizado</label>
                <textarea name="servicoRealizado" rows={3} required className="w-full rounded-xl px-4 py-2 resize-none" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand font-bold uppercase text-xs tracking-widest">Registrar e Finalizar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// --- ORÇAMENTOS ---
const OrcamentosView = ({ orcamentos, estoque, userId }: { orcamentos: Orcamento[], estoque: ItemEstoque[], userId: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pecas, setPecas] = useState<PecaOrcamento[]>([]);
  const [servicos, setServicos] = useState<MaoDeObraOrcamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const totalPecas = pecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
    const totalServicos = servicos.reduce((acc, s) => acc + s.valor, 0);

    const orcamento = {
      cliente: data.cliente,
      whatsapp: data.whatsapp,
      moto: data.moto,
      placa: data.placa,
      pecas,
      servicos,
      total: totalPecas + totalServicos,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, `usuarios/${userId}/orcamentos`), orcamento);
      setIsModalOpen(false);
      setPecas([]);
      setServicos([]);
      // Close keyboard
      (document.activeElement as HTMLElement)?.blur();
    } catch (e) {
      console.error(e);
    }
  };

  const addPeca = (item: ItemEstoque) => {
    setPecas([...pecas, { nome: item.nome, quantidade: 1, valorUnitario: item.valorVenda }]);
  };

  const addManualServico = () => {
    setServicos([...servicos, { descricao: '', valor: 0 }]);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Orçamentos</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-brand p-3 rounded-full shadow-lg shadow-brand/20">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {orcamentos.map(o => (
          <div key={o.id} className="bg-card-dark p-4 rounded-2xl border border-gray-800">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold">{o.cliente}</p>
                <p className="text-xs text-gray-500">{o.moto} • {o.placa}</p>
              </div>
              <span className="text-brand font-bold">{formatCurrency(o.total)}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => downloadOrcamento(o)}
                className="flex-1 flex gap-2 items-center justify-center py-2 bg-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
              <button 
                onClick={() => shareOrcamentoWhatsApp(o)}
                className="flex-1 flex gap-2 items-center justify-center py-2 bg-brand/10 text-brand rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-card-dark w-full max-w-2xl mx-auto rounded-3xl border border-gray-800 p-6">
            <h3 className="text-xl font-bold mb-6">Novo Orçamento Profissional</h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cliente" name="cliente" required />
                <Input label="WhatsApp" name="whatsapp" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Moto" name="moto" required />
                <Input label="Placa" name="placa" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-gray-500 uppercase font-bold">Peças</label>
                </div>
                <div className="relative mb-2">
                   <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                   <input type="text" placeholder="Adicionar do estoque..." className="w-full pl-10 pr-4 py-2 text-sm rounded-xl" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {estoque.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <button key={item.id} type="button" onClick={() => addPeca(item)} className="whitespace-nowrap px-3 py-1 bg-black rounded text-xs">
                      {item.nome}
                    </button>
                  ))}
                </div>
                {pecas.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={p.nome} onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, nome: e.target.value } : pi))} className="flex-1 rounded-lg px-3 py-1.5 text-sm" />
                    <input type="number" value={p.quantidade} onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, quantidade: Number(e.target.value) } : pi))} className="w-16 rounded-lg px-2 py-1.5 text-sm text-center" />
                    <input type="number" step="0.01" value={p.valorUnitario} onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, valorUnitario: Number(e.target.value) } : pi))} className="w-24 rounded-lg px-2 py-1.5 text-sm" />
                    <button type="button" onClick={() => setPecas(pecas.filter((_, iIdx) => iIdx !== idx))} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500 uppercase font-bold">Mão de Obra</label>
                  <button type="button" onClick={addManualServico} className="text-brand flex items-center gap-1 text-xs font-bold"><Plus className="w-3 h-3" /> ADICIONAR</button>
                </div>
                {servicos.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input placeholder="Descrição" value={s.descricao} onChange={e => setServicos(servicos.map((si, iIdx) => iIdx === idx ? { ...si, descricao: e.target.value } : si))} className="flex-1 rounded-lg px-3 py-1.5 text-sm" />
                    <input type="number" step="0.01" placeholder="Valor" value={s.valor === 0 ? '' : s.valor} onChange={e => setServicos(servicos.map((si, iIdx) => iIdx === idx ? { ...si, valor: Number(e.target.value) } : si))} className="w-24 rounded-lg px-2 py-1.5 text-sm" />
                    <button type="button" onClick={() => setServicos(servicos.filter((_, iIdx) => iIdx !== idx))} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand font-bold uppercase text-xs tracking-widest">Gerar Orçamento</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// --- CAIXA ---
const CaixaView = ({ caixa, userId }: { caixa: TransacaoCaixa[], userId: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'entrada' | 'saida'>('entrada');

  const stats = useMemo(() => {
    const entradas = caixa.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const saidas = caixa.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);
    
    // Payment methods breakdown
    const pix = caixa.filter(t => t.formaPagamento === 'Pix' && t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const dinheiro = caixa.filter(t => t.formaPagamento === 'Dinheiro' && t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const cartao = caixa.filter(t => t.formaPagamento === 'Cartão' && t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);

    return { current: entradas - saidas, entradas, saidas, pix, dinheiro, cartao };
  }, [caixa]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await addDoc(collection(db, `usuarios/${userId}/caixa`), {
        tipo: data.tipo,
        valor: Number(data.valor),
        descricao: data.descricao,
        formaPagamento: data.formaPagamento,
        data: serverTimestamp()
      });
      setIsModalOpen(false);
      (document.activeElement as HTMLElement)?.blur();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Fluxo de Caixa</h2>
        <div className="flex gap-2">
          <button onClick={() => { setTransactionType('entrada'); setIsModalOpen(true); }} className="bg-green-500 p-2 rounded-xl text-white">
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={() => { setTransactionType('saida'); setIsModalOpen(true); }} className="bg-red-500 p-2 rounded-xl text-white">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>
      </div>

      <div className="bg-card-dark p-6 rounded-3xl border border-gray-800 text-center space-y-4">
        <div>
          <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Saldo Disponível</p>
          <p className="text-4xl font-display font-bold text-brand">{formatCurrency(stats.current)}</p>
        </div>
        
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="bg-black/30 p-2 rounded-xl">
            <p className="text-[8px] text-gray-500 uppercase font-black">Pix</p>
            <p className="text-xs font-bold text-white leading-tight">{formatCurrency(stats.pix)}</p>
          </div>
          <div className="bg-black/30 p-2 rounded-xl">
            <p className="text-[8px] text-gray-500 uppercase font-black">Dinheiro</p>
            <p className="text-xs font-bold text-white leading-tight">{formatCurrency(stats.dinheiro)}</p>
          </div>
          <div className="bg-black/30 p-2 rounded-xl">
            <p className="text-[8px] text-gray-500 uppercase font-black">Cartão</p>
            <p className="text-xs font-bold text-white leading-tight">{formatCurrency(stats.cartao)}</p>
          </div>
        </div>

        <div className="flex justify-center gap-6 pt-4 border-t border-gray-800">
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total Entradas</p>
            <p className="text-green-500 font-bold">{formatCurrency(stats.entradas)}</p>
          </div>
          <div className="w-px bg-gray-800" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total Saídas</p>
            <p className="text-red-500 font-bold">{formatCurrency(stats.saidas)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {caixa.map(t => (
          <div key={t.id} className="bg-card-dark/50 p-4 rounded-2xl border border-gray-800/50 flex justify-between items-center transition-all">
            <div className="flex gap-3 items-center">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", t.tipo === 'entrada' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                {t.tipo === 'entrada' ? <ChevronRight className="-rotate-90 w-5 h-5" /> : <ChevronRight className="rotate-90 w-5 h-5" />}
              </div>
              <div>
                <p className="font-medium text-sm">{t.descricao}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold">{t.formaPagamento} • {formatDate(t.data?.toDate ? t.data.toDate() : t.data)}</p>
              </div>
            </div>
            <p className={cn("font-bold", t.tipo === 'entrada' ? "text-green-500" : "text-red-500")}>
              {t.tipo === 'entrada' ? '+' : '-'}{formatCurrency(t.valor)}
            </p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-card-dark w-full max-w-md p-6 rounded-3xl border border-gray-800">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold">Lançar {transactionType === 'entrada' ? 'Entrada' : 'Saída'}</h3>
              <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", transactionType === 'entrada' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
                {transactionType}
              </div>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <input type="hidden" name="tipo" value={transactionType} />
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Valor</label>
                <input name="valor" type="number" step="0.01" autoFocus required className="w-full rounded-xl px-4 py-3 text-lg font-bold text-brand" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Descrição</label>
                <input name="descricao" required placeholder="Ex: Venda de óleo, Pagamento luz..." className="w-full rounded-xl px-4 py-3" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Forma de Pagamento</label>
                <select name="formaPagamento" className="w-full rounded-xl px-4 py-3 font-bold">
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className={cn("flex-1 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest text-white shadow-lg", transactionType === 'entrada' ? "bg-green-600 shadow-green-500/20" : "bg-red-600 shadow-red-500/20")}>Confirmar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};


const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">{label}</label>
    <input {...props} className="w-full rounded-xl px-4 py-2" />
  </div>
);

// --- MAIN APP COMPONENT ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  
  // Data State
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [servicos, setServicos] = useState<ServicoRealizado[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [caixa, setCaixa] = useState<TransacaoCaixa[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubEstoque = onSnapshot(query(collection(db, `usuarios/${user.uid}/estoque`), orderBy('nome')), (snap) => {
      setEstoque(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemEstoque)));
    });

    const unsubServicos = onSnapshot(query(collection(db, `usuarios/${user.uid}/servicos`), orderBy('createdAt', 'desc')), (snap) => {
      setServicos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServicoRealizado)));
    });

    const unsubOrcamentos = onSnapshot(query(collection(db, `usuarios/${user.uid}/orcamentos`), orderBy('createdAt', 'desc')), (snap) => {
      setOrcamentos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Orcamento)));
    });

    const unsubCaixa = onSnapshot(query(collection(db, `usuarios/${user.uid}/caixa`), orderBy('data', 'desc'), limit(50)), (snap) => {
      setCaixa(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransacaoCaixa)));
    });

    return () => {
      unsubEstoque();
      unsubServicos();
      unsubOrcamentos();
      unsubCaixa();
    };
  }, [user]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-black">
      <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <LoginView />;

  return (
    <div className="min-h-screen bg-bg-dark pb-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-bg-dark/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-display font-bold tracking-tighter">MIX <span className="text-brand">MOTO</span></h1>
        <button onClick={() => signOut(auth)} className="text-gray-500 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Content */}
      <main className="pt-20 px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'inicio' && <DashboardView estoque={estoque} servicos={servicos} caixa={caixa} orcamentos={orcamentos} />}
            {activeTab === 'estoque' && <EstoqueView estoque={estoque} userId={user.uid} />}
            {activeTab === 'servicos' && <ServicosView servicos={servicos} estoque={estoque} userId={user.uid} />}
            {activeTab === 'orcamentos' && <OrcamentosView orcamentos={orcamentos} estoque={estoque} userId={user.uid} />}
            {activeTab === 'caixa' && <CaixaView caixa={caixa} userId={user.uid} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card-dark border-t border-gray-800 px-6 py-4 flex justify-between items-center z-40 pb-safe">
        <NavButton active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} icon={LayoutDashboard} label="Início" />
        <NavButton active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} icon={Package} label="Estoque" />
        <NavButton active={activeTab === 'servicos'} onClick={() => setActiveTab('servicos')} icon={Wrench} label="Serviços" />
        <NavButton active={activeTab === 'orcamentos'} onClick={() => setActiveTab('orcamentos')} icon={ReceiptText} label="Orçamentos" />
        <NavButton active={activeTab === 'caixa'} onClick={() => setActiveTab('caixa')} icon={Wallet} label="Caixa" />
      </nav>
    </div>
  );
}

const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all", active ? "text-brand" : "text-gray-500")}>
    <Icon className={cn("w-6 h-6", active && "scale-110")} />
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

// --- LOGIN VIEW ---
const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Este email já está em uso.');
      else if (err.code === 'auth/weak-password') setError('A senha deve ter pelo menos 6 caracteres.');
      else setError('Email ou senha inválidos.');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Email de recuperação enviado!');
      setError('');
    } catch (err) {
      setError('Erro ao enviar email de recuperação.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="inline-block p-4 rounded-3xl bg-brand/10 mb-4">
            <Wrench className="w-12 h-12 text-brand" />
          </motion.div>
          <h1 className="text-4xl font-display font-bold tracking-tighter">MIX <span className="text-brand">MOTO</span></h1>
          <p className="text-gray-500 mt-2">Sistema Profissional para Oficina</p>
        </div>

        <div className="bg-card-dark p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-6">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            <div className="relative">
              <Input label="Senha" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-8 text-gray-500"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-gray-500">
                <input type="checkbox" className="rounded bg-black border-gray-800" defaultChecked /> Manter conectado
              </label>
              {!isRegistering && (
                <button type="button" onClick={handleForgotPassword} className="text-brand font-bold hover:underline">
                  Esqueci minha senha
                </button>
              )}
            </div>

            {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm font-medium text-center">{message}</p>}

            <button type="submit" className="w-full py-4 rounded-2xl bg-brand font-bold uppercase tracking-widest text-sm shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              {isRegistering ? 'Criar Conta' : 'Entrar'}
            </button>
            
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-center text-xs text-gray-500 font-bold uppercase tracking-wider hover:text-white transition-colors"
            >
              {isRegistering ? 'Já tenho uma conta' : 'Criar nova conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
