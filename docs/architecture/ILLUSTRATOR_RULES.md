# Reglas De Illustrator

Ultima actualizacion: 2026-06-22.

## Variantes

| Variante | Sufijo | Reemplazo | Plantilla |
| --- | --- | --- | --- |
| Standard | `H` / `A` | Texto | `STANDARD` |
| Indigenous Heritage | `IH` | Nombre texto; numero desde arte | `INDIGENOUS HERITAGE` |
| Throwback | `TB` | Texto | `THROWBACK` |

Throwback es una variante de texto. Nunca debe entrar al flujo de Indigenous Heritage.

## Standard Y Throwback

- Reemplazan `textFrames` exactos con normalizacion de espacios, apostrofes y mayusculas.
- Ajustan nombre por ancho maximo.
- Ajustan numero grande y chico con limites separados.
- La fuente de reglas es `js/illustrator/textRules.js` y `js/config/textFitRules.json`.

## Indigenous Heritage

- El nombre se reemplaza como texto.
- El numero se construye duplicando grupos desde `NUMEROS F` y `NUMEROS B`.
- El gap entre digitos es obligatoriamente `0.25in`.
- Si falta numero, deben ocultarse o limpiarse `N FRONT` y `N BACK`; no dejar placeholders.
- Probar numeros de 1, 2 y 3 digitos en Illustrator real.

## Guardado Y Alertas

- Batch guarda y cierra con `RMCNike_savePdfAndCloseActiveDocument(filePath)`.
- Alertas: `RMCNike_alert(message)` -> `illustratorBridge.showAlert(message)` -> coordinacion en `js/main.js`.
- `alert()` del navegador es solo fallback sin CEP/Illustrator disponible.

## Muestras Oficiales

- `Extraer muestras oficiales` pide confirmacion antes de sobrescribir `officialSwatches.json`.
- `Validar muestras` ejecuta primero una accion tipo `Add Used Colors` y despues compara.
- No limpiar muestras automaticamente sin boton dedicado y confirmacion.

Cualquier cambio de placeholders, arte IH, Throwback, guardado o muestras requiere prueba en Illustrator real.
