import express from 'express';
import { COLOMBIAN_LOCATIONS, findLocationByDane } from '../data/colombianLocations.js';

const router = express.Router();

/**
 * GET /api/locations
 * Devuelve el listado completo de departamentos y municipios con códigos DANE
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    totalDepartments: COLOMBIAN_LOCATIONS.length,
    data: COLOMBIAN_LOCATIONS
  });
});

/**
 * GET /api/locations/find
 * Busca un municipio por su código DANE
 */
router.get('/find', (req, res) => {
  const { dane } = req.query;
  if (!dane) {
    return res.status(400).json({ success: false, message: 'Código DANE requerido' });
  }

  const found = findLocationByDane(dane);
  if (!found) {
    return res.status(404).json({ success: false, message: 'Municipio no encontrado para ese código DANE' });
  }

  res.json({ success: true, data: found });
});

export default router;
