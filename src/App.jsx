import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  ArrowUpRight, 
  LayoutDashboard, 
  FileText, 
  ChevronRight,
  DollarSign,
  Trash2,
  Package,
  Menu, // Mobile Menu Icon
  X     // Close Menu Icon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// REPLACE WITH YOUR REAL KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-credit-app"; 

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

const Badge = ({ type }) => {
  const isPurchase = type === 'purchase';
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
      isPurchase 
        ? 'bg-red-100 text-red-700' 
        : 'bg-green-100 text-green-700'
    }`}>
      {isPurchase ? 'Debit' : 'Credit'}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  
  // Mobile Menu State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  
  // UI Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  
  // Forms
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');

  const [transType, setTransType] = useState('purchase'); 
  const [transAmount, setTransAmount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState(1);

  // --- Auth & Data Fetching ---

  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error("Auth Error:", e));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'customers');
    return onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  // --- Logic ---

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!user || !newCustomerName) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), {
        name: newCustomerName, phone: newCustomerPhone, balance: 0, createdAt: serverTimestamp()
        });
        setNewCustomerName(''); setNewCustomerPhone(''); setIsAddCustomerModalOpen(false);
    } catch(e) { console.error(e); }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!user || !newProductName) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), {
        name: newProductName, price: parseFloat(newProductPrice) || 0, stock: parseInt(newProductStock) || 0, createdAt: serverTimestamp()
        });
        setNewProductName(''); setNewProductPrice(''); setNewProductStock(''); setIsAddProductModalOpen(false);
    } catch(e) { console.error(e); }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !selectedCustomerId || !transAmount) return;
    const amount = parseFloat(transAmount);
    
    // Inventory Logic
    let finalDesc = transDesc;
    if (transType === 'purchase' && selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        if (product.stock < purchaseQty) { alert("Insufficient stock!"); return; }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', selectedProductId), {
          stock: product.stock - parseInt(purchaseQty)
        });
        finalDesc = `${product.name} (x${purchaseQty})`;
      }
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        customerId: selectedCustomerId, type: transType, amount, description: finalDesc, date: transDate, createdAt: serverTimestamp()
        });

        const customer = customers.find(c => c.id === selectedCustomerId);
        const newBalance = transType === 'purchase' ? (customer.balance || 0) + amount : (customer.balance || 0) - amount;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', selectedCustomerId), { balance: newBalance });

        setTransAmount(''); setTransDesc(''); setSelectedProductId(''); setIsTransactionModalOpen(false);
    } catch(e) { console.error(e); }
  };

  const handleDeleteCustomer = async (id) => {
    if(confirm("Delete customer?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', id));
        if (selectedCustomerId === id) setView('dashboard');
    }
  };
  
  const handleDeleteProduct = async (id) => {
    if(confirm("Delete product?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
  };

  const totalOutstanding = useMemo(() => customers.reduce((acc, curr) => acc + (curr.balance || 0), 0), [customers]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
  const customerTransactions = useMemo(() => transactions.filter(t => t.customerId === selectedCustomerId), [transactions, selectedCustomerId]);

  // Auto-set amount from inventory selection
  useEffect(() => {
    if (transType === 'purchase' && selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) setTransAmount((product.price * purchaseQty).toFixed(2));
    }
  }, [selectedProductId, purchaseQty, products, transType]);

  // Mobile Helper: Close sidebar when clicking a link
  const navTo = (v) => {
    setView(v);
    setIsSidebarOpen(false);
  }

  if (!user) return <div className="h-screen flex items-center justify-center text-slate-500">Connecting...</div>;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* --- MOBILE SIDEBAR OVERLAY --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR --- */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-auto
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard size={20} className="text-blue-400"/>
            Credit<span className="text-blue-400">Ledger</span>
          </h1>
          {/* Close Button (Mobile Only) */}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button onClick={() => navTo('dashboard')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <Users size={18} /> Customers
          </button>
          <button onClick={() => navTo('inventory')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${view === 'inventory' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <Package size={18} /> Inventory
          </button>
          
          <div className="pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Total Outstanding</div>
          <div className="px-4">
            <div className="text-2xl font-bold text-white">${totalOutstanding.toFixed(2)}</div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { setIsAddCustomerModalOpen(true); setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium border border-slate-700">
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
             {/* Hamburger Menu Button (Mobile Only) */}
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
               <Menu size={24} />
             </button>
             <h2 className="text-lg font-semibold text-slate-800 capitalize">{view.replace('-', ' ')}</h2>
          </div>
          <div className="text-xs md:text-sm text-slate-500 hidden sm:block">
             {new Date().toLocaleDateString()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
          
          {view === 'dashboard' && (
            <div className="max-w-6xl mx-auto pb-20">
              {/* Stats Grid - Stacks on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
                 <Card className="p-5 md:p-6 border-l-4 border-l-blue-500 flex justify-between items-center">
                    <div><p className="text-sm text-slate-500 font-medium">Active Customers</p><h3 className="text-2xl md:text-3xl font-bold text-slate-800">{customers.length}</h3></div>
                    <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Users size={24} /></div>
                 </Card>
                 <Card className="p-5 md:p-6 border-l-4 border-l-red-500 flex justify-between items-center">
                    <div><p className="text-sm text-slate-500 font-medium">Total Credit</p><h3 className="text-2xl md:text-3xl font-bold text-slate-800">${totalOutstanding.toFixed(2)}</h3></div>
                    <div className="p-3 bg-red-50 rounded-full text-red-600"><ArrowUpRight size={24} /></div>
                 </Card>
                 <Card className="p-5 md:p-6 border-l-4 border-l-purple-500 flex justify-between items-center">
                    <div><p className="text-sm text-slate-500 font-medium">Products</p><h3 className="text-2xl md:text-3xl font-bold text-slate-800">{products.length}</h3></div>
                    <div className="p-3 bg-purple-50 rounded-full text-purple-600"><Package size={24} /></div>
                 </Card>
              </div>

              {/* Customers Table - Horizontal Scroll on Mobile */}
              <Card className="overflow-hidden">
                <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                   <h3 className="font-semibold text-slate-800">Credit Holders</h3>
                   <div className="relative w-full md:w-auto">
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                     <input type="text" placeholder="Search..." className="w-full md:w-64 pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"/>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Contact</th>
                        <th className="px-6 py-3 text-right">Due</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium">{c.name}</td>
                          <td className="px-6 py-4 text-slate-500">{c.phone}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700">${(c.balance || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                             <button onClick={() => { setSelectedCustomerId(c.id); setView('customer-details'); }} className="inline-flex items-center gap-1 px-3 py-1.5 border rounded text-xs hover:bg-slate-50">View <ChevronRight size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {view === 'inventory' && (
             <div className="max-w-6xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                   <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
                   <button onClick={() => setIsAddProductModalOpen(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm">
                      <Plus size={18} /> Add Product
                   </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {products.map(p => (
                      <Card key={p.id} className="p-5 flex flex-col justify-between">
                         <div className="flex justify-between items-start">
                            <div><h3 className="font-bold text-lg">{p.name}</h3><p className="text-slate-500 text-sm">${p.price?.toFixed(2)}</p></div>
                            <Package size={24} className="text-slate-300"/>
                         </div>
                         <div className="mt-4 flex justify-between items-end">
                            <div>
                               <p className="text-xs font-semibold text-slate-400 uppercase">Stock</p>
                               <p className={`text-xl font-bold ${p.stock < 10 ? 'text-red-600' : 'text-slate-700'}`}>{p.stock}</p>
                            </div>
                            <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                         </div>
                      </Card>
                   ))}
                </div>
             </div>
          )}

          {view === 'customer-details' && selectedCustomer && (
            <div className="max-w-5xl mx-auto pb-20">
               <button onClick={() => setView('dashboard')} className="mb-4 text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">&larr; Back</button>

               <div className="flex flex-col lg:flex-row gap-6 mb-8">
                  <Card className="flex-1 p-6">
                       <h1 className="text-2xl font-bold text-slate-800">{selectedCustomer.name}</h1>
                       <p className="text-slate-500">{selectedCustomer.phone}</p>
                       <div className="mt-6">
                         <p className="text-xs font-bold text-slate-400 uppercase">Total Due</p>
                         <div className={`text-4xl font-bold ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>${(selectedCustomer.balance || 0).toFixed(2)}</div>
                       </div>
                       <button onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="mt-4 text-red-500 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete Profile</button>
                  </Card>

                  <Card className="w-full lg:w-80 p-4 bg-slate-800 text-white flex flex-col justify-center gap-3">
                      <h3 className="font-semibold text-slate-200">Actions</h3>
                      <button onClick={() => { setTransType('purchase'); setIsTransactionModalOpen(true); }} className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold flex justify-center gap-2"><Plus size={18}/> Add Purchase</button>
                      <button onClick={() => { setTransType('payment'); setIsTransactionModalOpen(true); }} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold flex justify-center gap-2"><DollarSign size={18}/> Record Payment</button>
                  </Card>
               </div>

               <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b bg-slate-50/50 font-semibold text-slate-700">History</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                       <thead className="bg-slate-50 text-slate-500 border-b">
                         <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Desc</th><th className="px-6 py-3">Type</th><th className="px-6 py-3 text-right">Amt</th></tr>
                       </thead>
                       <tbody>
                          {customerTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50">
                               <td className="px-6 py-3 text-slate-500 text-xs">{t.date}</td>
                               <td className="px-6 py-3">{t.description || '-'}</td>
                               <td className="px-6 py-3"><Badge type={t.type} /></td>
                               <td className={`px-6 py-3 text-right font-bold ${t.type === 'purchase' ? 'text-red-600' : 'text-emerald-600'}`}>${t.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </Card>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS (Full Width on Mobile) --- */}
      {(isAddCustomerModalOpen || isAddProductModalOpen || isTransactionModalOpen) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              
              {/* Customer Modal */}
              {isAddCustomerModalOpen && (
                  <form onSubmit={handleAddCustomer} className="space-y-4">
                     <h3 className="text-lg font-bold">New Customer</h3>
                     <input placeholder="Name" autoFocus required className="w-full border border-slate-300 p-2 rounded" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}/>
                     <input placeholder="Phone" className="w-full border border-slate-300 p-2 rounded" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}/>
                     <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsAddCustomerModalOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button><button className="px-4 py-2 bg-blue-600 text-white rounded">Save</button></div>
                  </form>
              )}
              
              {/* Product Modal */}
              {isAddProductModalOpen && (
                  <form onSubmit={handleAddProduct} className="space-y-4">
                     <h3 className="text-lg font-bold">New Product</h3>
                     <input placeholder="Product Name" autoFocus required className="w-full border border-slate-300 p-2 rounded" value={newProductName} onChange={e => setNewProductName(e.target.value)}/>
                     <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="Stock" required className="w-full border border-slate-300 p-2 rounded" value={newProductStock} onChange={e => setNewProductStock(e.target.value)}/>
                        <input type="number" step="0.01" placeholder="Price" required className="w-full border border-slate-300 p-2 rounded" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)}/>
                     </div>
                     <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsAddProductModalOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button><button className="px-4 py-2 bg-blue-600 text-white rounded">Save</button></div>
                  </form>
              )}
              
              {/* Transaction Modal */}
              {isTransactionModalOpen && (
                  <form onSubmit={handleAddTransaction} className="space-y-4">
                     <div className="flex justify-between"><h3 className="text-lg font-bold">New Transaction</h3><Badge type={transType}/></div>
                     {transType === 'purchase' && (
                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                           <select className="w-full border border-slate-300 p-2 rounded mb-2" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                              <option value="">-- Custom Item --</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                           </select>
                           {selectedProductId && <input type="number" min="1" className="w-full border border-slate-300 p-2 rounded" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)}/>}
                        </div>
                     )}
                     <input type="number" step="0.01" placeholder="Amount" required className="w-full border border-slate-300 p-2 rounded font-bold text-lg" value={transAmount} onChange={e => setTransAmount(e.target.value)}/>
                     <input placeholder="Description" className="w-full border border-slate-300 p-2 rounded" value={transDesc} onChange={e => setTransDesc(e.target.value)}/>
                     <input type="date" required className="w-full border border-slate-300 p-2 rounded" value={transDate} onChange={e => setTransDate(e.target.value)}/>
                     <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button><button className={`px-4 py-2 text-white rounded ${transType === 'purchase' ? 'bg-red-600' : 'bg-green-600'}`}>Save</button></div>
                  </form>
              )}
           </Card>
        </div>
      )}
    </div>
  );
}