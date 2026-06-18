const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getProducts() {
  const response = await fetch(`${apiUrl}/api/products`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar los productos.');
  }

  return response.json();
}
