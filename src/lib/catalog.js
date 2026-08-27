// أدوات مشتركة للأصناف/المنتجات والمخزون ووحدات القياس
import { supabase } from './supabase'

// أنواع الأصناف
export const KINDS = {
  product:   { label: 'منتج',          color: 'green', icon: '🧀' },
  packaging: { label: 'مادة تعبئة',    color: 'amber', icon: '📦' },
  feed:      { label: 'علف',           color: 'green', icon: '🌾' },
  other:     { label: 'بيع بلا مخزون', color: 'blue',  icon: '🏷️' },
}

export async function loadProducts() {
  const { data } = await supabase
    .from('products')
    .select('*')
    .order('sort_order')
    .order('name')
  return data || []
}

export async function loadUnits() {
  const { data } = await supabase.from('units').select('*').order('sort_order')
  return data || []
}

// خريطة المخزون الحالي: { product_id: current_stock }
export async function loadStockMap() {
  const { data, error } = await supabase.rpc('product_stock')
  if (error) return {}
  const map = {}
  ;(data || []).forEach((r) => { map[r.product_id] = Number(r.current_stock) })
  return map
}
