# Auditoría exclusiva de duplicados exactos de repuestos

Fecha base: 2026-06-12.
Fuente: salida de la auditoría general del catálogo (`reporte-catalogo.txt`) con 2217 repuestos evaluados.

## Criterio aplicado

Un grupo se considera duplicado exacto únicamente cuando se repiten simultáneamente:

- Código normalizado.
- Descripción normalizada.

No se consideran duplicados exactos los productos que solo comparten código, solo comparten descripción o son similares por marca, medidas, rodamientos, retenes u otras variantes.

## Resumen

- Total de productos auditados: 2217.
- Total de grupos duplicados exactos: 18.
- Total de productos involucrados: 36.
- Duplicados exactos eliminables: 17 grupos.
- Duplicados que requieren revisión manual: 1 grupo.
- Datos modificados: ninguno.

## Duplicados exactos eliminables

| # | IDs involucrados | Código | Descripción |
|---:|---|---|---|
| 1 | 17, 1153 | 53-0001 | ALEMITE - Cele - recto 1/4" UNF - Art 1010 |
| 2 | 43, 1155 | 54-0606 | ARANDELA - Cele - grower dorada 5/8" |
| 3 | 266, 1176 | 56-0606 | BULON - Cele - cabeza hexagonal G5 BSW natural 1" x 12" |
| 4 | 393, 1189 | 62-0007 | CILINDRO - Cele - hidráulico standard S/A Cele (401-12-301) 3" x 200 |
| 5 | 522, 1227 | C5837 | ENGANCHE - Cele - lanza grande agujero de 50 a 42 |
| 6 | 608, 1229 | 66-0003 | GATO - Cele - a engranajes Nº 4 |
| 7 | 658, 1247 | 68-0003 | LLANTA - Cele - 650 x 16" x 1/4" - ag 92 |
| 8 | 659, 1248 | 68-0004 | LLANTA - Cele - 750 x 16" x 1/4" - ag 92 |
| 9 | 718, 1264 | 81-0003 | O´RING - Cele - Sav 52329 |
| 10 | 864, 1289 | 77-0306 | RESORTE - Cele - de extensión cuerpo grano fino Activa II |
| 11 | 993, 1292 | CK0028 | SOPORTE - Cele - vastago para cuchilla abridora |
| 12 | 1101, 1316 | 82-1604 | TUERCA - Cele - castillo SAE 1 1/2" |
| 13 | 1103, 1317 | 82-1603 | TUERCA - Cele - castillo SAE 1 1/8" |
| 14 | 1116, 1321 | 82-0313 | TUERCA - Cele - hexagonal liviana BSW dorada - 7/8" |
| 15 | 1118, 1322 | 82-0307 | TUERCA - Cele - hexagonal liviana BSW dorada 3/4" |
| 16 | 1130, 1323 | 82-0106 | TUERCA - Cele - hexagonal pesada BSW dorada 5/8" |
| 17 | 2039, 2040 | 6209 2RS | BOLILLERO - 6209 2RS - Marca "ZVL" |

## Duplicados que requieren revisión manual

| # | IDs involucrados | Código | Descripción normalizada compartida | Motivo |
|---:|---|---|---|---|
| 1 | 848, 1288 | PK0139 | REJA - Cele de recambio carpicel x 59 cm | La normalización iguala ambas descripciones, pero el valor visible no es idéntico: `REJA - Cele de recambio carpicel x 59 cm` vs. `REJA - Cele - de recambio carpicel x 59 cm`. |

## Observación

Este reporte no propone eliminar registros automáticamente. La baja de productos debe decidirse después de validar stock, historial comercial, referencias externas y dependencias del sistema para cada ID involucrado.
