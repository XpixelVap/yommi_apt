import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Plus, Edit2, Trash2, Image as ImageIcon, Check, X } from 'lucide-react';
import { Toast } from './Toast';
import { clearCache } from '../utils/cache';

export function MenuManager({ restaurantId }: { restaurantId?: string }) {
  const queryParam = restaurantId ? `?restaurantId=${restaurantId}` : '';
  const { token } = useAuthStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    fetchMenu();
  }, [restaurantId]);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/menu${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch menu');
      }
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;

    try {
      const url = editingCategory ? `${import.meta.env.VITE_API_URL || ""}/api/restaurant/categories/${editingCategory.id}${queryParam}` : `${import.meta.env.VITE_API_URL || ""}/api/restaurant/categories${queryParam}`;
      const method = editingCategory ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo guardar la categoría');
      }
      
      setShowCategoryForm(false);
      setEditingCategory(null);
      clearCache('restaurants_');
      clearCache('popular_');
      fetchMenu();
    } catch (error) {
      console.error(error);
      setToast({ message: error instanceof Error ? error.message : 'No se pudo guardar la categoría', type: 'error' });
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/categories/${categoryToDelete}${queryParam}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error deleting category');
      }
      setCategoryToDelete(null);
      clearCache('restaurants_');
      clearCache('popular_');
      fetchMenu();
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al eliminar la categoría', type: 'error' });
    }
  };

  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // Handle image upload
    const file = formData.get('image') as File;
    let product_image = editingProduct?.product_image || editingProduct?.imageUrl || '';
    
    if (file && file.size > 0) {
      const uploadData = new FormData();
      uploadData.append('image', file);
      
      try {
        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/upload/menu`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: uploadData
        });
        
        if (uploadRes.ok) {
          const { imageUrl } = await uploadRes.json();
          product_image = imageUrl;
        } else {
          console.error('Failed to upload image');
        }
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }

    const payload = {
      categoryId: formData.get('categoryId'),
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price') as string),
      imageUrl: product_image,
      isAvailable: formData.get('isAvailable') === 'on'
    };

    try {
      const url = editingProduct ? `${import.meta.env.VITE_API_URL || ""}/api/restaurant/products/${editingProduct.id}${queryParam}` : `${import.meta.env.VITE_API_URL || ""}/api/restaurant/products${queryParam}`;
      const method = editingProduct ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo guardar el producto');
      }
      
      setShowProductForm(false);
      setEditingProduct(null);
      clearCache('restaurants_');
      clearCache('popular_');
      fetchMenu();
    } catch (error) {
      console.error(error);
      setToast({ message: error instanceof Error ? error.message : 'No se pudo guardar el producto', type: 'error' });
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/products/${productToDelete}${queryParam}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error deleting product');
      }
      setProductToDelete(null);
      clearCache('restaurants_');
      clearCache('popular_');
      fetchMenu();
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al eliminar el producto', type: 'error' });
    }
  };

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
  };

  const toggleProductAvailability = async (product: any) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/restaurant/products/${product.id}${queryParam}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          categoryId: product.categoryId,
          name: product.name,
          description: product.description || '',
          price: product.price,
          imageUrl: product.imageUrl || product.product_image || '',
          isAvailable: !product.isAvailable
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo cambiar la disponibilidad');
      }
      clearCache('restaurants_');
      clearCache('popular_');
      fetchMenu();
    } catch (error) {
      console.error(error);
      setToast({ message: error instanceof Error ? error.message : 'Error al cambiar disponibilidad', type: 'error' });
    }
  };

  if (loading) return <div>Cargando menú...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Menú</h2>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }}
            className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl font-medium hover:bg-orange-200 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nueva Categoría
          </button>
          <button
            onClick={() => { 
              if (categories.length === 0) return setToast({ message: 'Crea una categoría primero', type: 'info' });
              setEditingProduct(null); 
              setSelectedCategoryId(categories[0].id);
              setShowProductForm(true); 
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {categories.map(category => (
          <div key={category.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h3 className="text-xl font-bold">{category.name}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingCategory(category); setShowCategoryForm(true); }}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteCategory(category.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.products.map((product: any) => (
                <div key={product.id} className={`border rounded-xl p-4 flex gap-4 ${!product.isAvailable ? 'opacity-60 bg-gray-50' : 'border-gray-100'}`}>
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                    {product.product_image || product.imageUrl ? (
                      <img src={product.product_image || product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold truncate pr-2">{product.name}</h4>
                      <div className="flex gap-1 shrink-0">
                        <button 
                          onClick={() => { setEditingProduct(product); setSelectedCategoryId(category.id); setShowProductForm(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{product.description}</p>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="font-bold text-orange-600">${product.price.toFixed(2)}</span>
                      <button 
                        onClick={() => toggleProductAvailability(product)}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {product.isAvailable ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {category.products.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 text-sm">
                  No hay productos en esta categoría.
                </div>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-500">
            No has creado ninguna categoría aún.
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button onClick={() => setShowCategoryForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  name="name" 
                  defaultValue={editingCategory?.name} 
                  required 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-medium hover:bg-orange-700">
                Guardar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowProductForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select 
                  name="categoryId" 
                  defaultValue={editingProduct?.categoryId || selectedCategoryId}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  name="name" 
                  defaultValue={editingProduct?.name} 
                  required 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea 
                  name="description" 
                  defaultValue={editingProduct?.description} 
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($)</label>
                <input 
                  name="price" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  defaultValue={editingProduct?.price} 
                  required 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagen</label>
                {(editingProduct?.product_image || editingProduct?.imageUrl) && (
                  <img src={editingProduct.product_image || editingProduct.imageUrl} alt="Preview" className="h-20 w-20 object-cover rounded-lg mb-2" />
                )}
                <input 
                  name="image" 
                  type="file" 
                  accept="image/*"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Sube una imagen para actualizarla (opcional si ya tiene una).</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  name="isAvailable" 
                  id="isAvailable"
                  defaultChecked={editingProduct ? editingProduct.isAvailable : true}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                />
                <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700">Producto disponible</label>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-medium hover:bg-orange-700">
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar categoría?</h3>
            <p className="text-gray-500 mb-6">Se eliminarán todos los productos de esta categoría. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteCategory}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar producto?</h3>
            <p className="text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setProductToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteProduct}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
