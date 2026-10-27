# ml: asistente conversacional y modelos

Esta carpeta contiene lo necesario para entrenar y evaluar fuera de línea los modelos que usa el asistente conversacional de Safe Tour. La inferencia ocurre en el servidor Node (`server/src/services/chatbot/`), sin servicios externos ni costo adicional.

## De qué trata

El asistente responde en español sobre cuatro temas: riesgo por zona en Bogotá, rutas seguras, sitios turísticos y botón de pánico. Es un sistema híbrido: un clasificador de intención entrenado, un estimador de riesgo por zona y franja horaria, reglas de seguridad y respuestas armadas con datos reales de la base (zonas y mapa de calor). No genera texto libre: cada respuesta sale de una plantilla rellenada con información consultada en el momento.

Endpoint: `POST /api/chatbot/mensajes`. Requiere sesión, admite hasta 20 mensajes por minuto por cliente y mensajes de hasta 300 caracteres. Devuelve `respuesta`, `intencion`, `confianza`, `emergencia` y `aviso`.

## Cómo se hizo

### 1. Clasificador de intención

- Seis clases: `riesgo_zona`, `ruta_segura`, `sitios_turisticos`, `panico_ayuda`, `saludo` y `fuera_de_dominio`.
- Preprocesamiento: minúsculas, sin tildes ni signos, eliminación de palabras vacías y de tokens de una letra. Es el mismo en Python (`scripts/train.py`) y en Node (`guardrails.js` e `intent.js`).
- Representación TF-IDF con normalización L2. El IDF es ln((1 + n) / (1 + df)) + 1.
- Modelo: regresión logística multinomial (softmax), entrenada con descenso de gradiente por lotes: 500 épocas, tasa de aprendizaje 5.0 y regularización L2 de 1e-4. Solo usa la biblioteca estándar de Python.
- Salida: `models/intent.json` con vocabulario, IDF, pesos y sesgos. Node lo lee y calcula la inferencia sin dependencias adicionales.
- Respaldo: si el archivo no existe, es inválido o la confianza es menor a 0.45, se clasifica con reglas por raíces de palabras.

### 2. Estimador de riesgo por zona

- Ventana de los últimos 30 días, solo con reportes en estado confirmado o publicado, activos y con ubicación dentro del polígono de la zona.
- Características: franja horaria (madrugada, mañana, tarde, noche, en hora de Bogotá) en codificación one-hot, fin de semana, nivel de seguridad de la zona normalizado y número de reportes de la franja respecto al umbral de alto riesgo configurado.
- Si existe `models/risk.json` (pesos y sesgo de una regresión logística con esas siete características), la probabilidad resultante se traduce en nivel bajo, medio (desde 0.33) o alto (desde 0.66).
- Si no existe, el nivel sale del conteo histórico de reportes de la franja contra el umbral. La respuesta indica cuál de las dos fuentes se usó.
- `scripts/train.py` entrena únicamente el clasificador de intención. No hay script de entrenamiento del estimador de riesgo.

### 3. Reglas de seguridad

- Mensajes vacíos o de más de 300 caracteres se rechazan.
- Si el texto expresa peligro inmediato (por ejemplo, auxilio, me están robando, me persiguen), se responde de inmediato con la línea de emergencias 123 y la referencia al botón de pánico, sin pasar por el clasificador.
- Toda respuesta incluye un aviso: es una recomendación automatizada basada en reportes ciudadanos validados y no sustituye a las autoridades.

## Datos

- Los ejemplos de entrenamiento del clasificador son sintéticos, escritos a mano: 10 por intención, 60 en total. Cada quinto ejemplo de cada intención queda fuera del entrenamiento (48 para entrenar y 12 reservados). No provienen de usuarios reales. El archivo generado lo declara con `"origen": "sintetico"`.
- `scripts/evaluate.py` mide la exactitud sobre los ejemplos reservados. Por ser un conjunto pequeño y sintético, la cifra no representa el desempeño con usuarios reales.
- `scripts/export_reports.js` exporta a la salida estándar los reportes validados vigentes como JSON con tipo, estado, latitud, longitud y fecha. No incluye datos de usuarios. Está pensado para reunir los datos con los que se podría entrenar el estimador de riesgo. `data/` está excluida del control de versiones.

## Contenido

- `scripts/train.py`: entrena el clasificador de intención y escribe `models/intent.json`.
- `scripts/evaluate.py`: evalúa el modelo con los ejemplos reservados.
- `scripts/export_reports.js`: exporta reportes validados desde MongoDB.
- `models/`: pesos generados (`intent.json`, y `risk.json` si se entrena).
- `data/`: datos exportados, fuera del repositorio.