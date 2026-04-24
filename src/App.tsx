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
  Minus,
  Search, 
  Trash2, 
  Edit2, 
  Download, 
  Share2,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
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
    // Current date filtering
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const faturamentoDia = servicos
      .filter(s => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d >= today;
      })
      .reduce((acc, s) => acc + s.total, 0);

    const faturamentoMes = servicos
      .filter(s => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d >= startOfMonth;
      })
      .reduce((acc, s) => acc + s.total, 0);

    const lucroMes = servicos
      .filter(s => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d >= startOfMonth;
      })
      .reduce((acc, s) => {
        const custoTotalPecas = s.pecasUsadas.reduce((sum, p) => sum + (p.quantidade * (p.valorCusto || p.valorUnitario * 0.7)), 0); 
        return acc + (s.total - custoTotalPecas);
      }, 0);

    const servicosHoje = servicos.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return d >= today;
    }).length;

    const totalItensEstoque = estoque.reduce((acc, i) => acc + i.quantidade, 0);
    const valorTotalEstoque = estoque.reduce((acc, i) => acc + (i.quantidade * (i.valorVenda || 0)), 0);
    const estoqueBaixoList = estoque.filter(i => i.quantidade < 5);
    
    const saldoCaixa = caixa.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    
    const orcamentosPendentes = orcamentos.length;

    return { 
      faturamentoDia, 
      faturamentoMes,
      lucroMes,
      servicosHoje, 
      estoqueBaixoCount: estoqueBaixoList.length, 
      estoqueBaixoList,
      saldoCaixa, 
      orcamentosPendentes,
      totalItensEstoque,
      valorTotalEstoque
    };
  }, [estoque, servicos, caixa, orcamentos]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Caixa" value={formatCurrency(stats.saldoCaixa)} color="from-green-500/20 to-green-500/5" text="text-green-500" icon={<Wallet className="w-4 h-4 text-green-500" />} />
        <StatCard label="Lucro Mês" value={formatCurrency(stats.lucroMes)} color="from-brand/20 to-brand/5" text="text-brand" icon={<TrendingUp className="w-4 h-4 text-brand" />} />
        <StatCard label="Hoje" value={formatCurrency(stats.faturamentoDia)} color="from-blue-500/20 to-blue-500/5" text="text-blue-400" icon={<LayoutDashboard className="w-4 h-4 text-blue-400" />} />
        <StatCard label="Serviços" value={stats.servicosHoje} color="from-purple-500/20 to-purple-500/5" text="text-purple-400" icon={<Wrench className="w-4 h-4 text-purple-400" />} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card-dark p-6 rounded-3xl border border-gray-800 shadow-xl shadow-black/40">
          <h3 className="text-sm font-black uppercase text-gray-500 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Alerta de Estoque
          </h3>
          <div className="space-y-3">
            {stats.estoqueBaixoList.length > 0 ? (
              stats.estoqueBaixoList.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-black/30 rounded-xl border border-gray-800/30">
                  <div>
                    <p className="font-bold text-sm">{item.nome}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{item.marca}</p>
                  </div>
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", item.quantidade === 0 ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-500")}>
                    {item.quantidade} un
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 text-xs font-bold uppercase tracking-widest italic">Tudo em dia no estoque!</p>
              </div>
            )}
            {stats.estoqueBaixoCount > 3 && (
              <p className="text-brand text-[10px] font-black uppercase tracking-widest text-center pt-2">+ {stats.estoqueBaixoCount - 3} itens em alerta</p>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-card-dark to-[#0f0f0f] p-6 rounded-3xl border border-gray-800 flex flex-col justify-center items-center text-center shadow-xl shadow-black/40">
           <Package className="w-10 h-10 text-brand mb-3 opacity-30" />
           <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest leading-loose">Inventário Geral</p>
           <p className="text-3xl font-display font-black text-white">{stats.totalItensEstoque}</p>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Peças e produtos</p>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, text, icon }: { label: string, value: string | number, color?: string, text?: string, icon?: React.ReactNode }) => (
  <div className={cn("bg-card-dark p-4 rounded-[2rem] border border-gray-800 overflow-hidden relative group transition-all", color ? `bg-gradient-to-br ${color}` : "bg-card-dark")}>
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-gray-400 text-[9px] uppercase font-black tracking-widest">{label}</span>
      </div>
      <span className={cn("text-lg font-display font-black tracking-tight", text)}>{value}</span>
    </div>
    <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-500">
       {icon}
    </div>
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
  const [selectedServicos, setSelectedServicos] = useState<MaoDeObraOrcamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const totalPecas = selectedPecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
    const totalServicos = selectedServicos.reduce((acc, s) => acc + s.valor, 0);
    const total = totalPecas + totalServicos;

    try {
      // 1. Registrar Serviço
      await addDoc(collection(db, `usuarios/${userId}/servicos`), {
        cliente: data.cliente,
        whatsapp: data.whatsapp,
        moto: data.moto,
        placa: data.placa,
        servicoRealizado: data.servicoRealizado,
        pecasUsadas: selectedPecas,
        servicos: selectedServicos,
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
      setSelectedServicos([]);
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
      setSelectedPecas([...selectedPecas, { 
        id: item.id, 
        nome: item.nome, 
        quantidade: 1, 
        valorUnitario: item.valorVenda,
        valorCusto: item.valorCusto || 0 // Store cost at time of selection
      }]);
    }
  };

  const addManualServico = () => {
    setSelectedServicos([...selectedServicos, { descricao: '', valor: 0 }]);
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
              <div className="text-right">
                <p className="text-brand font-bold">{formatCurrency(s.total)}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold">{s.formaPagamento}</p>
              </div>
            </div>
            <div className="text-xs text-gray-400 space-y-1 mt-2">
               <p className="line-clamp-1 italic">"{s.servicoRealizado}"</p>
               <div className="flex items-center gap-2">
                 <span className="bg-black/40 px-2 py-0.5 rounded border border-gray-800">{s.pecasUsadas.length} peças</span>
                 <span className="bg-black/40 px-2 py-0.5 rounded border border-gray-800">{s.servicos?.length || 0} m. obra</span>
               </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card-dark w-full max-w-2xl mx-auto rounded-3xl border border-gray-800 p-6 min-h-max">
            <h3 className="text-xl font-bold mb-6">Registrar Serviço Concluído</h3>
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
                <label className="text-xs text-gray-500 uppercase font-bold">Peças Usadas</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Filtrar estoque..." className="w-full pl-10 pr-4 py-2 text-sm rounded-xl" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {estoque.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <button key={item.id} type="button" onClick={() => addPecaToServico(item)} className="whitespace-nowrap px-3 py-1.5 bg-black rounded-lg text-[10px] border border-gray-800">
                      {item.nome}
                    </button>
                  ))}
                </div>
                {selectedPecas.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs py-2 bg-black/20 px-3 rounded-lg">
                    <span>{p.nome} (x{p.quantidade})</span>
                    <button type="button" onClick={() => setSelectedPecas(selectedPecas.filter(sp => sp.id !== p.id))} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500 uppercase font-bold">Mão de Obra</label>
                  <button type="button" onClick={addManualServico} className="text-brand flex items-center gap-1 text-[10px] font-bold"><Plus className="w-3 h-3" /> ADICIONAR ITEM</button>
                </div>
                {selectedServicos.map((s, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input placeholder="Descrição" value={s.descricao} onChange={e => setSelectedServicos(selectedServicos.map((si, iIdx) => iIdx === idx ? { ...si, descricao: e.target.value } : si))} className="flex-1 rounded-xl px-3 py-2 text-sm" />
                    <input type="number" step="0.01" placeholder="R$" value={s.valor === 0 ? '' : s.valor} onChange={e => setSelectedServicos(selectedServicos.map((si, iIdx) => iIdx === idx ? { ...si, valor: Number(e.target.value) } : si))} className="w-20 rounded-xl px-3 py-2 text-sm" />
                    <button type="button" onClick={() => setSelectedServicos(selectedServicos.filter((_, iIdx) => iIdx !== idx))} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Pagamento</label>
                <select name="formaPagamento" className="w-full rounded-xl px-4 py-2 font-bold">
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Notas Internas</label>
                <textarea name="servicoRealizado" rows={2} required className="w-full rounded-xl px-4 py-2 text-sm resize-none" placeholder="Ex: O barulho era corrente solta..." />
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-gray-800 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Peças Total:</span>
                  <span>{formatCurrency(selectedPecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0))}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Mão de Obra:</span>
                  <span>{formatCurrency(selectedServicos.reduce((acc, s) => acc + s.valor, 0))}</span>
                </div>
                <div className="flex justify-between font-bold text-brand border-t border-gray-800 pt-2 mt-2">
                  <span>TOTAL GERAL:</span>
                  <span>{formatCurrency(selectedPecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0) + selectedServicos.reduce((acc, s) => acc + s.valor, 0))}</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-brand font-bold uppercase text-xs tracking-widest shadow-lg shadow-brand/20">Finalizar Serviço</button>
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

  const addManualPeca = () => {
    setPecas([...pecas, { nome: '', quantidade: 1, valorUnitario: 0 }]);
  };

  const addManualServico = () => {
    setServicos([...servicos, { descricao: '', valor: 0 }]);
  };

  const totals = useMemo(() => {
    const subtotalPecas = pecas.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
    const subtotalServicos = servicos.reduce((acc, s) => acc + s.valor, 0);
    return {
      pecas: subtotalPecas,
      servicos: subtotalServicos,
      total: subtotalPecas + subtotalServicos
    };
  }, [pecas, servicos]);

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
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500 uppercase font-bold">Peças</label>
                  <button type="button" onClick={addManualPeca} className="text-brand flex items-center gap-1 text-[10px] font-bold"><Plus className="w-3 h-3" /> ADICIONAR MANUAL</button>
                </div>
                <div className="relative mb-2">
                   <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                   <input type="text" placeholder="Puxar do estoque..." className="w-full pl-10 pr-4 py-2 text-sm rounded-xl" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {searchTerm && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {estoque.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                      <button key={item.id} type="button" onClick={() => { addPeca(item); setSearchTerm(''); }} className="whitespace-nowrap px-3 py-1.5 bg-black rounded-lg text-[10px] border border-gray-800">
                        {item.nome} ({item.quantidade} un)
                      </button>
                    ))}
                  </div>
                )}
                {pecas.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-black/20 p-2 rounded-xl border border-gray-800/50">
                    <input 
                      placeholder="Nome da peça" 
                      value={p.nome} 
                      onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, nome: e.target.value } : pi))} 
                      className="flex-1 bg-transparent border-0 text-xs focus:ring-0 p-1" 
                    />
                    <input 
                       type="number" 
                       placeholder="Qt"
                       value={p.quantidade} 
                       onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, quantidade: Number(e.target.value) } : pi))} 
                       className="w-12 bg-transparent border-0 text-xs text-center focus:ring-0 p-1 font-bold" 
                    />
                    <input 
                       type="number" 
                       step="0.01" 
                       placeholder="R$"
                       value={p.valorUnitario === 0 ? '' : p.valorUnitario} 
                       onChange={e => setPecas(pecas.map((pi, iIdx) => iIdx === idx ? { ...pi, valorUnitario: Number(e.target.value) } : pi))} 
                       className="w-20 bg-transparent border-0 text-xs text-right focus:ring-0 p-1 text-brand font-bold" 
                    />
                    <button type="button" onClick={() => setPecas(pecas.filter((_, iIdx) => iIdx !== idx))} className="text-red-500 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500 uppercase font-bold">Mão de Obra</label>
                  <button type="button" onClick={addManualServico} className="text-brand flex items-center gap-1 text-[10px] font-bold"><Plus className="w-3 h-3" /> ADICIONAR SERVIÇO</button>
                </div>
                {servicos.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-black/20 p-2 rounded-xl border border-gray-800/50">
                    <input 
                      placeholder="Descrição do serviço" 
                      value={s.descricao} 
                      onChange={e => setServicos(servicos.map((si, iIdx) => iIdx === idx ? { ...si, descricao: e.target.value } : si))} 
                      className="flex-1 bg-transparent border-0 text-xs focus:ring-0 p-1" 
                    />
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="R$" 
                      value={s.valor === 0 ? '' : s.valor} 
                      onChange={e => setServicos(servicos.map((si, iIdx) => iIdx === idx ? { ...si, valor: Number(e.target.value) } : si))} 
                      className="w-20 bg-transparent border-0 text-xs text-right focus:ring-0 p-1 text-brand font-bold" 
                    />
                    <button type="button" onClick={() => setServicos(servicos.filter((_, iIdx) => iIdx !== idx))} className="text-red-500 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="bg-black/60 p-4 rounded-2xl border border-gray-800 space-y-2">
                 <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                   <span>Subtotal Peças:</span>
                   <span>{formatCurrency(totals.pecas)}</span>
                 </div>
                 <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                   <span>Subtotal Mão de Obra:</span>
                   <span>{formatCurrency(totals.servicos)}</span>
                 </div>
                 <div className="flex justify-between font-display font-bold text-brand border-t border-gray-800 pt-2 mt-2">
                   <span className="text-sm">TOTAL GERAL:</span>
                   <span className="text-lg">{formatCurrency(totals.total)}</span>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-gray-800 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-brand font-bold uppercase text-xs tracking-widest shadow-lg shadow-brand/20">Gerar Orçamento</button>
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
  const [tipo, setTipo] = useState<'entrada' | 'saída'>('entrada');

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtradas = caixa.map(t => ({
      ...t,
      dateObj: t.data?.toDate ? t.data.toDate() : new Date(t.data)
    }));

    const hoje = filtradas.filter(t => t.dateObj.toLocaleDateString() === todayStr);
    const semana = filtradas.filter(t => t.dateObj >= startOfWeek);
    const mes = filtradas.filter(t => t.dateObj >= startOfMonth);

    const calcSum = (list: any[]) => list.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    const calcEntradas = (list: any[]) => list.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
    const calcSaidas = (list: any[]) => list.filter(t => t.tipo === 'saída' || t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);

    return {
      saldo: calcSum(filtradas),
      entradasHoje: calcEntradas(hoje),
      saidasHoje: calcSaidas(hoje),
      totalSemana: calcSum(semana),
      totalMes: calcSum(mes)
    };
  }, [caixa]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await addDoc(collection(db, `usuarios/${userId}/caixa`), {
        tipo,
        valor: Number(data.valor),
        descricao: data.descricao,
        formaPagamento: data.formaPagamento || 'Dinheiro',
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
           <button onClick={() => { setTipo('saída'); setIsModalOpen(true); }} className="bg-red-500/10 text-red-500 p-2 rounded-xl border border-red-500/20"><Minus className="w-5 h-5" /></button>
           <button onClick={() => { setTipo('entrada'); setIsModalOpen(true); }} className="bg-brand p-2 rounded-xl shadow-lg shadow-brand/20"><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card-dark p-4 rounded-2xl border border-gray-800">
           <p className="text-[10px] text-gray-500 uppercase font-black">Saldo Total</p>
           <p className="text-xl font-bold text-brand">{formatCurrency(stats.saldo)}</p>
        </div>
        <div className="bg-card-dark p-4 rounded-2xl border border-gray-800">
           <p className="text-[10px] text-gray-500 uppercase font-black">Total Mês</p>
           <p className="text-xl font-bold text-white">{formatCurrency(stats.totalMes)}</p>
        </div>
      </div>

      <div className="bg-card-dark p-6 rounded-3xl border border-gray-800">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Movimentação Hoje</h3>
            <span className="text-[10px] text-gray-500 font-bold uppercase">{new Date().toLocaleDateString('pt-BR')}</span>
         </div>
         <div className="grid grid-cols-2 gap-6">
            <div>
               <p className="text-[10px] text-green-500 uppercase font-black">Entradas</p>
               <p className="text-lg font-bold">{formatCurrency(stats.entradasHoje)}</p>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-red-500 uppercase font-black">Saídas</p>
               <p className="text-lg font-bold">{formatCurrency(stats.saidasHoje)}</p>
            </div>
         </div>
         <div className="mt-4 pt-4 border-t border-gray-800">
             <div className="flex justify-between items-center">
                <p className="text-xs text-gray-400">Total na Semana</p>
                <p className="text-sm font-bold">{formatCurrency(stats.totalSemana)}</p>
             </div>
         </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-black text-gray-500 uppercase px-2">Histórico Recente</h3>
        {caixa.slice(0, 15).map(t => (
          <div key={t.id} className="bg-card-dark p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl", t.tipo === 'entrada' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                {t.tipo === 'entrada' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{t.descricao}</p>
                <p className="text-[10px] text-gray-500">{formatDate(t.data?.toDate ? t.data.toDate() : t.data)} • {t.formaPagamento}</p>
              </div>
            </div>
            <p className={cn("font-bold text-sm", t.tipo === 'entrada' ? "text-green-500" : "text-red-500")}>
              {t.tipo === 'entrada' ? '+' : '-'}{formatCurrency(t.valor)}
            </p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card-dark w-full max-w-sm rounded-3xl border border-gray-800 p-6">
            <h3 className="text-xl font-bold mb-4">Lançar {tipo}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Valor (R$)" name="valor" type="number" step="0.01" required />
              <Input label="Descrição" name="descricao" required />
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Forma de Pagamento</label>
                <select name="formaPagamento" className="w-full rounded-xl px-4 py-2 font-bold">
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className={cn("flex-1 py-3 rounded-xl font-bold text-white", tipo === 'entrada' ? "bg-brand" : "bg-red-500")}>
                  Salvar
                </button>
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

const Header = () => (
  <div className="relative overflow-hidden bg-[#0b0b0b] pt-8 pb-12 px-6 rounded-b-[3rem] border-b border-gray-800 mb-8">
    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
      <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[150%] bg-gradient-to-br from-purple-600 via-blue-500 to-transparent blur-[120px] rotate-12" />
    </div>
    
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl shadow-lg shadow-purple-500/20">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-4xl font-display font-black tracking-tighter bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse whitespace-nowrap uppercase">
          MIX MOTO
        </h1>
      </div>
      
      <div className="bg-yellow-400 px-3 py-0.5 rounded-full mb-3 transform -rotate-1 shadow-lg shadow-yellow-400/20">
        <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">CHOCOLATE</span>
      </div>
      
      <div className="flex items-center gap-3 text-gray-500">
        <div className="w-8 h-px bg-gray-800" />
        <span className="text-[10px] font-bold tracking-widest uppercase">(18) 99757-1933</span>
        <div className="w-8 h-px bg-gray-800" />
      </div>
    </div>
  </div>
);

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
      <Header />
      <div className="fixed top-4 right-4 z-50">
        <button onClick={() => signOut(auth)} className="bg-black/40 backdrop-blur-md p-2 rounded-xl text-gray-500 hover:text-red-500 transition-colors border border-gray-800">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <main className="px-6 max-w-lg mx-auto">
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
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-[#0b0b0b] overflow-hidden">
      {/* Vaporwave background effects */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-purple-600/30 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/30 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex flex-col items-center gap-2 mb-8">
             <div className="p-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-[2rem] shadow-2xl shadow-purple-500/20 mb-4">
                <TrendingUp className="w-12 h-12 text-white" />
             </div>
             <h1 className="text-5xl font-display font-black tracking-tighter bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent uppercase">
               MIX MOTO
             </h1>
             <div className="bg-yellow-400 px-4 py-1 rounded-full transform -rotate-2 shadow-lg -mt-2">
                <span className="text-xs font-black text-black tracking-widest uppercase">CHOCOLATE</span>
             </div>
          </div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] pt-4">Sistema de Gestão Profissional</h2>
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
