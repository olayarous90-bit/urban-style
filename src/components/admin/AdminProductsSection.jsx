import React, { useState, useEffect } from 'react';
import './AdminProductsSection.css';

const DEFAULT_CATEGORIES = [
  'Camisetas',
  'Sudaderas',
  'Pantalones',
  'Chaquetas',
  'Calzado',
  'Accesorios'
];

const PRESET_SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRESET_SIZES_NUMERIC = ['28', '30', '32', '34', '36', '38', '39', '40', '41', '42'];

export const AdminProductsSection = ({ onNotification = () => {} }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Camisetas',
    price: 129900,
    stock: 50,
    sizes: ['S', 'M', 'L', 'XL'],
    color: 'Negro Profundo',
    composition: '100% Algodón Premium Heavyweight',
    description: '',
    is_active: true
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal de Eliminación
  const [deleteProductTarget, setDeleteProductTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar productos al montar y al cambiar filtros
  useEffect(() => {
    loadProducts();
  }, [categoryFilter, statusFilter]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search: searchTerm,
        category: categoryFilter,
        status: statusFilter
      });
      const res = await fetch(`/api/admin/products?${query}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.warn('Error consultando productos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'Camisetas',
      price: 129900,
      stock: 50,
      sizes: ['S', 'M', 'L', 'XL'],
      color: 'Negro Profundo',
      composition: '100% Algodón Peinado 280 gsm',
      description: '',
      is_active: true
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      category: p.category || 'Camisetas',
      price: p.price || 0,
      stock: p.stock ?? 50,
      sizes: Array.isArray(p.sizes) ? p.sizes : ['S', 'M', 'L'],
      color: p.color || 'Negro',
      composition: p.composition || '',
      description: p.description || '',
      is_active: Boolean(p.is_active ?? p.isActive)
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleSize = (size) => {
    setFormData((prev) => {
      const currentSizes = prev.sizes || [];
      if (currentSizes.includes(size)) {
        return { ...prev, sizes: currentSizes.filter((s) => s !== size) };
      } else {
        return { ...prev, sizes: [...currentSizes, size] };
      }
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    // Validaciones en cliente
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setFormError('El nombre del producto debe tener al menos 3 caracteres.');
      return;
    }
    const numPrice = Number(formData.price);
    if (isNaN(numPrice) || numPrice < 1000) {
      setFormError('El precio debe ser un número válido en COP mayor o igual a $1.000.');
      return;
    }
    const numStock = Number(formData.stock);
    if (isNaN(numStock) || numStock < 0) {
      setFormError('El inventario no puede ser negativo.');
      return;
    }
    if (!formData.color.trim()) {
      setFormError('El color principal es obligatorio.');
      return;
    }
    if (!formData.sizes || formData.sizes.length === 0) {
      setFormError('Debes seleccionar al menos una talla disponible.');
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/admin/products/${editingId}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        onNotification(
          isEdit
            ? `Producto "${formData.name}" actualizado en Neon PostgreSQL.`
            : `Producto "${formData.name}" creado en Neon PostgreSQL exitosamente.`
        );
        loadProducts();
      } else {
        setFormError(data.message || 'Error guardando producto en el servidor.');
      }
    } catch {
      setFormError('Error de conexión con el servidor al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const newStatus = !Boolean(product.is_active ?? product.isActive);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotification(`Producto "${product.name}" ${newStatus ? 'ACTIVADO' : 'DESACTIVADO'} para la tienda.`);
        loadProducts();
      } else {
        alert(data.message || 'Error modificando estado.');
      }
    } catch {
      alert('Error de red al actualizar estado.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProductTarget || isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/products/${deleteProductTarget.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteProductTarget(null);
        onNotification(data.message);
        loadProducts();
      } else {
        alert(data.message || 'Error eliminando producto.');
      }
    } catch {
      alert('Error de red al eliminar producto.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCOPPreview = (price) => {
    const num = Math.round(Number(price) || 0);
    return `$${num.toLocaleString('es-CO')} COP`;
  };

  return (
    <div className="admin-products-container">
      
      {/* BARRA DE HERRAMIENTAS, FILTROS Y BÚSQUEDA */}
      <div className="products-toolbar">
        <div className="toolbar-filters">
          <input
            type="search"
            className="product-search-input"
            placeholder="Buscar por nombre, ID, color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
          />
          <button type="button" className="btn-search" onClick={loadProducts}>
            Buscar
          </button>

          <select
            className="product-select-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Todas las Categorías</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="status-pill-group">
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Activos
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('INACTIVE')}
            >
              Inactivos
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn-create-product"
          onClick={handleOpenCreateModal}
        >
          <span>＋</span> Nuevo Producto
        </button>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio ($ COP)</th>
              <th>Tallas</th>
              <th>Color</th>
              <th>Inventario</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-4 text-muted">
                  Cargando catálogo desde Neon PostgreSQL...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-4 text-muted">
                  No se encontraron productos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isActive = Boolean(p.is_active ?? p.isActive);
                const stockNum = Number(p.stock ?? 50);

                return (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: '#888' }}>{p.id}</code>
                    </td>
                    <td>
                      <div className="product-cell-name">
                        <span className="product-title-bold">{p.name}</span>
                        {p.composition && (
                          <span className="product-sub-meta">{p.composition}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="category-tag">{p.category}</span>
                    </td>
                    <td>
                      <span className="price-text-cop">
                        {p.formatted_price || formatCOPPreview(p.price)}
                      </span>
                    </td>
                    <td>
                      <div className="sizes-badge-container">
                        {Array.isArray(p.sizes) && p.sizes.map((s) => (
                          <span key={s} className="size-chip">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>{p.color || 'Negro'}</td>
                    <td>
                      <span
                        className={`stock-badge ${
                          stockNum === 0
                            ? 'stock-out'
                            : stockNum <= 10
                            ? 'stock-low'
                            : 'stock-high'
                        }`}
                      >
                        {stockNum} u. {stockNum <= 10 ? '⚠️' : '✓'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleStatus(p)}
                        title="Haz clic para alternar activación"
                      >
                        {isActive ? '🟢 Activo' : '⚪ Inactivo'}
                      </button>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-action-edit"
                          onClick={() => handleOpenEditModal(p)}
                          title="Editar producto"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => setDeleteProductTarget(p)}
                          title="Eliminar producto"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="product-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="product-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="product-modal-header">
              <div>
                <span className="modal-badge-tag">
                  {editingId ? 'Modificar Registro' : 'Catálogo Oficial'}
                </span>
                <h3 className="modal-header-title">
                  {editingId ? `Editar: ${formData.name || 'Producto'}` : 'Crear Nuevo Producto'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="product-modal-body">
                {formError && (
                  <div className="modal-error-box" role="alert">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="product-form-grid">
                  
                  {/* NOMBRE */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Nombre de la Prenda *</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: Camiseta Oversize 'Urban Artifacts'"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  {/* CATEGORÍA */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Categoría *</label>
                    <select
                      className="modal-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* PRECIO COP */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">
                      <span>Precio ($ COP) *</span>
                      <span className="price-formatted-preview">{formatCOPPreview(formData.price)}</span>
                    </label>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      className="modal-input"
                      placeholder="129900"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>

                  {/* INVENTARIO / STOCK */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Inventario Disponible (Unidades) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="modal-input"
                      placeholder="50"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>

                  {/* COLOR */}
                  <div className="modal-field-group">
                    <label className="modal-field-label">Color Principal *</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: Negro Profundo, Blanco Hueso"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      required
                    />
                  </div>

                  {/* COMPOSICIÓN */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Composición Textil / Materiales</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Ej: 100% Algodón Peinado 280 gsm, Felpa francesa"
                      value={formData.composition}
                      onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                    />
                  </div>

                  {/* SELECTOR DE TALLAS */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">
                      <span>Tallas Disponibles *</span>
                      <span style={{ color: '#aaa', fontSize: '0.75rem' }}>
                        Seleccionadas: {formData.sizes?.join(', ') || 'Ninguna'}
                      </span>
                    </label>
                    <div className="sizes-selector-box">
                      {PRESET_SIZES_APPAREL.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-select-btn ${formData.sizes?.includes(size) ? 'selected' : ''}`}
                          onClick={() => handleToggleSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                      {PRESET_SIZES_NUMERIC.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-select-btn ${formData.sizes?.includes(size) ? 'selected' : ''}`}
                          onClick={() => handleToggleSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DESCRIPCIÓN */}
                  <div className="modal-field-group form-full-width">
                    <label className="modal-field-label">Descripción de la Prenda</label>
                    <textarea
                      className="modal-input modal-textarea"
                      placeholder="Detalles sobre el corte, caída, cuello y estética de la prenda..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {/* VISIBILIDAD */}
                  <div className="form-full-width">
                    <label className="active-toggle-container">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span>Publicar producto inmediatamente en la tienda pública</span>
                    </label>
                  </div>

                  {/* NOTA HOJA DE RUTA */}
                  <div className="modal-stage-notice form-full-width">
                    ℹ️ <strong>Hoja de ruta del proyecto:</strong> La carga de archivos multimedia/imágenes y la configuración de descuentos promocionales se integrarán en las próximas fases tras tu revisión.
                  </div>

                </div>
              </div>

              <div className="product-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando en Neon...' : editingId ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {deleteProductTarget && (
        <div className="product-modal-backdrop" onClick={() => setDeleteProductTarget(null)}>
          <div className="delete-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-warn-icon">⚠️</div>
            <h3 className="delete-card-title">¿Eliminar Producto?</h3>
            <p className="delete-card-desc">
              ¿Estás seguro de que deseas eliminar <strong>"{deleteProductTarget.name}"</strong>?
              <br />
              <small style={{ color: '#888', display: 'block', marginTop: '0.4rem' }}>
                Si el producto ya cuenta con pedidos históricos asociados, el servidor lo desactivará automáticamente para preservar la integridad transaccional.
              </small>
            </p>
            <div className="delete-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setDeleteProductTarget(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Procesando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminProductsSection;
