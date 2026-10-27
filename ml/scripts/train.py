# ml/scripts/train.py
"""Entrena el clasificador de intención: TF-IDF + regresión logística multinomial.

Los ejemplos son SINTÉTICOS, escritos a mano. No provienen de usuarios reales.
Salida: ml/models/intent.json (formato que lee server/src/services/chatbot/intent.js).
"""
import json
import math
import re
import unicodedata
from pathlib import Path

INTENCIONES = ["riesgo_zona", "ruta_segura", "sitios_turisticos", "panico_ayuda", "saludo", "fuera_de_dominio"]

PALABRAS_VACIAS = {
    "el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "o", "a", "que", "es", "por",
    "para", "con", "me", "mi", "se", "lo", "al", "hay", "esta", "este", "muy", "mas",
}

EJEMPLOS = {
    "riesgo_zona": [
        "qué tan seguro es el centro", "es peligroso caminar por la candelaria de noche",
        "hay muchos robos en esta zona", "cuál es el riesgo en el barrio chapinero",
        "es seguro el sector de usaquén", "dónde han reportado hurtos hoy",
        "qué zonas son más inseguras", "hay peligro en la zona donde estoy",
        "cómo está la seguridad en kennedy", "debo tener cuidado en este sector",
    ],
    "ruta_segura": [
        "cómo llego al museo evitando zonas peligrosas", "quiero una ruta segura para caminar",
        "cuál es el mejor camino en bicicleta", "necesito llegar a mi destino en transmilenio",
        "ruta alterna para ir en carro", "cómo calculo un recorrido seguro",
        "qué trayecto me recomiendas a pie", "quiero ir en bus sin pasar por zonas de riesgo",
        "dame un camino más seguro hasta mi destino", "cómo uso las rutas de la aplicación",
    ],
    "sitios_turisticos": [
        "qué museos puedo visitar", "lugares turísticos para conocer",
        "qué sitios culturales hay en bogotá", "quiero visitar monserrate",
        "recomienda plazas históricas para ver", "qué hay para hacer en la candelaria",
        "dónde queda la catedral primada", "qué sitios turísticos me recomiendas",
        "lugares para conocer en el centro histórico", "planes culturales para el fin de semana",
    ],
    "panico_ayuda": [
        "cómo funciona el botón de pánico", "dónde está el botón de pánico",
        "cómo registro mis contactos de emergencia", "qué pasa cuando activo la alerta",
        "a quién avisa el botón sos", "cuántas veces puedo usar el botón de pánico",
        "cómo agrego un contacto de confianza", "el botón de pánico envía mi ubicación",
        "para qué sirve la alerta de emergencia de la app", "configurar contactos para el pánico",
    ],
    "saludo": [
        "hola", "buenos días", "buenas tardes", "hola qué tal", "hey hola",
        "saludos", "buenas noches", "gracias", "muchas gracias por la ayuda", "hola asistente",
    ],
    "fuera_de_dominio": [
        "cuál es la capital de francia", "cuéntame un chiste", "quién ganó el partido ayer",
        "ayúdame con mi tarea de matemáticas", "cómo se prepara el arroz con pollo",
        "qué hora es en tokio", "recomiéndame una película", "cuánto cuesta un celular nuevo",
        "escribe un poema de amor", "cómo está el dólar hoy",
    ],
}

RUTA_MODELO = Path(__file__).resolve().parents[1] / "models" / "intent.json"


def normalizar(texto):
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")
    limpio = re.sub(r"[^a-z0-9\s]", " ", sin_tildes.lower())
    return re.sub(r"\s+", " ", limpio).strip()


def tokenizar(texto):
    return [t for t in normalizar(texto).split(" ") if len(t) > 1 and t not in PALABRAS_VACIAS]


def particionar():
    """Cada quinto ejemplo de cada intención queda fuera del entrenamiento."""
    entrenamiento, prueba = [], []
    for intencion, textos in EJEMPLOS.items():
        for n, texto in enumerate(textos):
            (prueba if n % 5 == 4 else entrenamiento).append((texto, intencion))
    return entrenamiento, prueba


def vectorizar(tokens, vocabulario):
    conteo = {}
    for t in tokens:
        if t in vocabulario:
            conteo[t] = conteo.get(t, 0) + 1
    valores = {vocabulario[t]["i"]: tf * vocabulario[t]["idf"] for t, tf in conteo.items()}
    norma = math.sqrt(sum(v * v for v in valores.values())) or 1.0
    return {i: v / norma for i, v in valores.items()}


def puntajes(x, pesos, sesgos):
    return [sesgos[k] + sum(pesos[k][i] * v for i, v in x.items()) for k in range(len(pesos))]


def softmax(z):
    m = max(z)
    e = [math.exp(v - m) for v in z]
    s = sum(e)
    return [v / s for v in e]


def entrenar(datos, epocas=500, tasa=5.0, regularizacion=1e-4):
    tokens = [(tokenizar(t), y) for t, y in datos]
    terminos = sorted({t for toks, _ in tokens for t in toks})
    n = len(tokens)
    df = {t: sum(1 for toks, _ in tokens if t in toks) for t in terminos}
    vocabulario = {t: {"i": i, "idf": round(math.log((1 + n) / (1 + df[t])) + 1, 5)} for i, t in enumerate(terminos)}

    xs = [(vectorizar(toks, vocabulario), INTENCIONES.index(y)) for toks, y in tokens]
    k, v = len(INTENCIONES), len(terminos)
    pesos = [[0.0] * v for _ in range(k)]
    sesgos = [0.0] * k

    for _ in range(epocas):
        grad_w = [[0.0] * v for _ in range(k)]
        grad_b = [0.0] * k
        for x, y in xs:
            p = softmax(puntajes(x, pesos, sesgos))
            for c in range(k):
                g = p[c] - (1.0 if c == y else 0.0)
                grad_b[c] += g
                for i, val in x.items():
                    grad_w[c][i] += g * val
        for c in range(k):
            sesgos[c] -= tasa * grad_b[c] / n
            for i in range(v):
                pesos[c][i] -= tasa * (grad_w[c][i] / n + regularizacion * pesos[c][i])

    return {
        "version": 1,
        "origen": "sintetico",
        "intenciones": INTENCIONES,
        "vocabulario": vocabulario,
        "pesos": [[round(w, 5) for w in fila] for fila in pesos],
        "sesgos": [round(b, 5) for b in sesgos],
    }


def predecir(modelo, texto):
    x = vectorizar(tokenizar(texto), modelo["vocabulario"])
    if not x:
        return None, 0.0
    p = softmax(puntajes(x, modelo["pesos"], modelo["sesgos"]))
    mejor = max(range(len(p)), key=lambda c: p[c])
    return modelo["intenciones"][mejor], p[mejor]


if __name__ == "__main__":
    entrenamiento, prueba = particionar()
    modelo = entrenar(entrenamiento)
    RUTA_MODELO.parent.mkdir(parents=True, exist_ok=True)
    RUTA_MODELO.write_text(json.dumps(modelo, ensure_ascii=False), encoding="utf-8")
    aciertos = sum(1 for t, y in entrenamiento if predecir(modelo, t)[0] == y)
    print(f"Modelo guardado en {RUTA_MODELO}")
    print(f"Ejemplos de entrenamiento: {len(entrenamiento)} | exactitud en entrenamiento: {aciertos / len(entrenamiento):.2%}")
    print("Datos sintéticos: use evaluate.py para la exactitud en los ejemplos reservados.")