import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  LayoutDashboard, 
  FileText, 
  ChevronRight,
  DollarSign,
  Calendar,
  Trash2,
  Package,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// TODO: Replace these values with your own from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBBgp5b0RqfEV8TWB4sf-1MQvAM9GnmQQA",
  authDomain: "credit-manager-f1b07.firebaseapp.com",
  projectId: "credit-manager-f1b07",
  storageBucket: "credit-manager-f1b07.firebasestorage.app",
  messagingSenderId: "158025094034",
  appId: "1:158025094034:web:0ac703f9ce23c5f62c274b",
  measurementId: "G-HWE9THWHSH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-credit-app"; // You can keep this name

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
      {isPurchase ? 'Purchase' : 'Payment'}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard'); // dashboard, customer-details, inventory
  
  // Data State
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  
  // UI State
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

  const [transType, setTransType] = useState('purchase'); // purchase or payment
  const [transAmount, setTransAmount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Transaction Product Selection
  const [selectedProductId, setSelectedProductId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState(1);

  // --- Auth & Data Fetching ---

  useEffect(() => {
    // Simple anonymous sign-in for the manual version
    signInAnonymously(auth).catch((error) => {
        console.error("Auth Error. Did you update firebaseConfig at the top of App.jsx?", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch Customers
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'customers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    }, (error) => console.error("Error fetching customers:", error));
    return () => unsubscribe();
  }, [user]);

  // Fetch Transactions
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    }, (error) => console.error("Error fetching transactions:", error));
    return () => unsubscribe();
  }, [user]);

  // Fetch Products
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    }, (error) => console.error("Error fetching products:", error));
    return () => unsubscribe();
  }, [user]);

  // --- Logic & Actions ---

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!user || !newCustomerName) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), {
        name: newCustomerName,
        phone: newCustomerPhone,
        balance: 0,
        createdAt: serverTimestamp()
      });
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsAddCustomerModalOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!user || !newProductName) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), {
        name: newProductName,
        price: parseFloat(newProductPrice) || 0,
        stock: parseInt(newProductStock) || 0,
        createdAt: serverTimestamp()
      });
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setIsAddProductModalOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !selectedCustomerId || !transAmount) return;

    const amount = parseFloat(transAmount);
    if (isNaN(amount)) return;

    // Validation for Stock
    let finalDesc = transDesc;
    if (transType === 'purchase' && selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        if (product.stock < purchaseQty) {
          alert(`Insufficient stock! Only ${product.stock} available.`);
          return;
        }
        // Update Inventory
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', selectedProductId), {
          stock: product.stock - parseInt(purchaseQty)
        });
        finalDesc = `${product.name} (x${purchaseQty})`;
      }
    }

    try {
      // 1. Add Transaction
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        customerId: selectedCustomerId,
        type: transType,
        amount: amount,
        description: finalDesc,
        date: transDate,
        productId: selectedProductId || null,
        quantity: purchaseQty || 0,
        createdAt: serverTimestamp()
      });

      // 2. Update Customer Balance
      const customer = customers.find(c => c.id === selectedCustomerId);
      const newBalance = transType === 'purchase' 
        ? (customer.balance || 0) + amount 
        : (customer.balance || 0) - amount;

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', selectedCustomerId), {
        balance: newBalance
      });

      // Reset Form
      setTransAmount('');
      setTransDesc('');
      setSelectedProductId('');
      setPurchaseQty(1);
      setIsTransactionModalOpen(false);
    } catch (err) {
      console.error("Error adding transaction", err);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if(!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', id));
      if (selectedCustomerId === id) setView('dashboard');
    } catch(err) { console.error(err); }
  };
  
  const handleDeleteProduct = async (id) => {
    if(!confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
    } catch(err) { console.error(err); }
  };

  // --- Derived State & Helpers ---

  const totalOutstanding = useMemo(() => customers.reduce((acc, curr) => acc + (curr.balance || 0), 0), [customers]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
  const customerTransactions = useMemo(() => transactions.filter(t => t.customerId === selectedCustomerId), [transactions, selectedCustomerId]);
  
  // Auto-calculate amount when product changes
  useEffect(() => {
    if (transType === 'purchase' && selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setTransAmount((product.price * purchaseQty).toFixed(2));
      }
    }
  }, [selectedProductId, purchaseQty, products, transType]);

  // --- Render ---

  if (!user) return <div className="flex items-center justify-center h-screen text-slate-500">Connecting to database...</div>;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard size={20} className="text-blue-400"/>
            Credit<span className="text-blue-400">Ledger</span>
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <Users size={18} />
            Customers
          </button>
          
          <button 
            onClick={() => setView('inventory')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${view === 'inventory' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <Package size={18} />
            Inventory
          </button>
          
          <div className="pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">
            Total Outstanding
          </div>
          <div className="px-4">
            <div className="text-2xl font-bold text-white">
              ${totalOutstanding.toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Due from all profiles</p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors text-sm font-medium border border-slate-700"
          >
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {view.replace('-', ' ')}
          </h2>
          <div className="text-sm text-slate-500">
             {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
          
          {view === 'dashboard' && (
            <div className="max-w-6xl mx-auto">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex justify-between">
                       <div><p className="text-sm text-slate-500 font-medium">Active Customers</p><h3 className="text-3xl font-bold text-slate-800 mt-1">{customers.length}</h3></div>
                       <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Users size={24} /></div>
                    </div>
                 </Card>
                 <Card className="p-6 border-l-4 border-l-red-500">
                    <div className="flex justify-between">
                       <div><p className="text-sm text-slate-500 font-medium">Total Credit Given</p><h3 className="text-3xl font-bold text-slate-800 mt-1">${totalOutstanding.toFixed(2)}</h3></div>
                       <div className="p-3 bg-red-50 rounded-full text-red-600"><ArrowUpRight size={24} /></div>
                    </div>
                 </Card>
                 <Card className="p-6 border-l-4 border-l-purple-500">
                    <div className="flex justify-between">
                       <div><p className="text-sm text-slate-500 font-medium">Total Products</p><h3 className="text-3xl font-bold text-slate-800 mt-1">{products.length}</h3></div>
                       <div className="p-3 bg-purple-50 rounded-full text-purple-600"><Package size={24} /></div>
                    </div>
                 </Card>
              </div>

              {/* Customers Table */}
              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                   <h3 className="font-semibold text-slate-800">Credit Holders</h3>
                   <div className="relative">
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                     <input type="text" placeholder="Search customers..." className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"/>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Customer Name</th>
                        <th className="px-6 py-3">Contact</th>
                        <th className="px-6 py-3 text-right">Current Due</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map(customer => (
                        <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">{customer.name}</td>
                          <td className="px-6 py-4 text-slate-500">{customer.phone}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700">${(customer.balance || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 flex justify-center">
                             <button onClick={() => { setSelectedCustomerId(customer.id); setView('customer-details'); }} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium flex items-center gap-1 shadow-sm">View <ChevronRight size={14}/></button>
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
             <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-end mb-6">
                   <h2 className="text-2xl font-bold text-slate-800">Product Inventory</h2>
                   <button onClick={() => setIsAddProductModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                      <Plus size={18} /> Add New Product
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {products.map(product => (
                      <Card key={product.id} className="p-5 hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-start">
                            <div>
                               <h3 className="font-bold text-lg text-slate-800">{product.name}</h3>
                               <p className="text-slate-500 text-sm mt-1">Price: ${product.price?.toFixed(2)}</p>
                            </div>
                            <div className="text-slate-300"><Package size={28}/></div>
                         </div>
                         <div className="mt-6 flex justify-between items-end">
                            <div>
                               <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In Stock</p>
                               <p className={`text-2xl font-bold mt-1 ${product.stock < 10 ? 'text-red-600' : 'text-slate-700'}`}>
                                  {product.stock} <span className="text-sm font-normal text-slate-400">units</span>
                               </p>
                            </div>
                            <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                         </div>
                         {product.stock < 10 && (
                            <div className="mt-4 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-full w-fit">
                               <AlertCircle size={14}/> Low stock warning
                            </div>
                         )}
                      </Card>
                   ))}
                </div>
                
                {products.length === 0 && (
                   <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                      <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4"/>
                      <p className="text-slate-500">Your inventory is empty.</p>
                      <button onClick={() => setIsAddProductModalOpen(true)} className="mt-2 text-blue-600 font-medium hover:underline">Add your first product</button>
                   </div>
                )}
             </div>
          )}

          {view === 'customer-details' && selectedCustomer && (
            <div className="max-w-5xl mx-auto">
               <button onClick={() => setView('dashboard')} className="mb-6 text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
                 &larr; Back to Dashboard
               </button>

               <div className="flex flex-col md:flex-row gap-6 mb-8">
                  <Card className="flex-1 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={120} /></div>
                    <div className="relative z-10">
                       <h1 className="text-3xl font-bold text-slate-800">{selectedCustomer.name}</h1>
                       <p className="text-slate-500 mt-1 flex items-center gap-2">{selectedCustomer.phone}</p>
                       <div className="mt-8">
                         <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Due Amount</p>
                         <div className={`text-4xl font-bold mt-2 ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>${(selectedCustomer.balance || 0).toFixed(2)}</div>
                       </div>
                       <button onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="mt-6 text-red-500 hover:text-red-700 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete Profile</button>
                    </div>
                  </Card>

                  <Card className="w-full md:w-80 p-6 flex flex-col justify-center gap-4 bg-slate-800 text-white border-slate-700">
                      <h3 className="font-semibold text-slate-200">Quick Actions</h3>
                      <button onClick={() => { setTransType('purchase'); setIsTransactionModalOpen(true); }} className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20"><Plus size={18}/> New Purchase (Credit)</button>
                      <button onClick={() => { setTransType('payment'); setIsTransactionModalOpen(true); }} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"><DollarSign size={18}/> Record Payment</button>
                  </Card>
               </div>

               <Card>
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400"/> Transaction History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                         <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Description</th><th className="px-6 py-3">Type</th><th className="px-6 py-3 text-right">Amount</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {customerTransactions.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-400">No transactions recorded yet.</td></tr>
                          ) : customerTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                               <td className="px-6 py-3 text-slate-600 font-mono text-xs">{t.date}</td>
                               <td className="px-6 py-3 text-slate-800">{t.description || '-'}</td>
                               <td className="px-6 py-3"><Badge type={t.type} /></td>
                               <td className={`px-6 py-3 text-right font-medium ${t.type === 'purchase' ? 'text-red-600' : 'text-emerald-600'}`}>{t.type === 'purchase' ? '+' : '-'}${t.amount.toFixed(2)}</td>
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

      {/* --- Modals --- */}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Customer</h3>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input autoFocus type="text" required className="w-full border border-slate-300 rounded px-3 py-2" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}/></div>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label><input type="text" className="w-full border border-slate-300 rounded px-3 py-2" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}/></div>
                 <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsAddCustomerModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Create Profile</button></div>
              </form>
           </Card>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Inventory Item</h3>
              <form onSubmit={handleAddProduct} className="space-y-4">
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label><input autoFocus type="text" required className="w-full border border-slate-300 rounded px-3 py-2" value={newProductName} onChange={(e) => setNewProductName(e.target.value)}/></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Stock Qty</label><input type="number" required className="w-full border border-slate-300 rounded px-3 py-2" value={newProductStock} onChange={(e) => setNewProductStock(e.target.value)}/></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit Price ($)</label><input type="number" step="0.01" required className="w-full border border-slate-300 rounded px-3 py-2" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)}/></div>
                 </div>
                 <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsAddProductModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Add to Inventory</button></div>
              </form>
           </Card>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <Card className="w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-slate-800">{transType === 'purchase' ? 'Add Purchase' : 'Record Payment'}</h3>
                 <Badge type={transType} />
              </div>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                 
                 {/* Product Selection for Purchases */}
                 {transType === 'purchase' && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Select from Inventory (Optional)</label>
                       <select 
                          className="w-full border border-slate-300 rounded px-3 py-2 mb-3"
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                       >
                          <option value="">-- Custom Item / No Inventory --</option>
                          {products.map(p => (
                             <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock} | ${p.price})</option>
                          ))}
                       </select>
                       
                       {selectedProductId && (
                          <div className="flex items-center gap-3">
                             <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                                <input type="number" min="1" className="w-full border border-slate-300 rounded px-2 py-1" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)}/>
                             </div>
                             <div className="flex-1 text-right">
                                <label className="block text-xs text-slate-500 mb-1">Unit Price</label>
                                <div className="font-semibold">${products.find(p => p.id === selectedProductId)?.price}</div>
                             </div>
                          </div>
                       )}
                    </div>
                 )}

                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount ($)</label>
                   <input type="number" step="0.01" required className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg font-semibold" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                   <input type="text" placeholder={selectedProductId ? "Auto-filled from inventory" : "Description"} className="w-full border border-slate-300 rounded px-3 py-2" value={transDesc} onChange={(e) => setTransDesc(e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                   <input type="date" required className="w-full border border-slate-300 rounded px-3 py-2" value={transDate} onChange={(e) => setTransDate(e.target.value)}/>
                 </div>
                 <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                    <button type="submit" className={`px-4 py-2 text-white rounded font-medium ${transType === 'purchase' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>Confirm {transType === 'purchase' ? 'Debit' : 'Credit'}</button>
                 </div>
              </form>
           </Card>
        </div>
      )}

    </div>
  );
}