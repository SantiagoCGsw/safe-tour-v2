# ml/scripts/evaluate.py
"""Evalúa intent.json con los ejemplos sintéticos reservados por train.py."""
import json
import sys

from train import INTENCIONES, RUTA_MODELO, particionar, predecir

if not RUTA_MODELO.exists():
    sys.exit("No existe ml/models/intent.json. Ejecute train.py primero.")

modelo = json.loads(RUTA_MODELO.read_text(encoding="utf-8"))
_, prueba = particionar()

aciertos = 0
errores = []
por_clase = {i: [0, 0] for i in INTENCIONES}

for texto, esperada in prueba:
    obtenida, confianza = predecir(modelo, texto)
    por_clase[esperada][1] += 1
    if obtenida == esperada:
        aciertos += 1
        por_clase[esperada][0] += 1
    else:
        errores.append((texto, esperada, obtenida, confianza))

print(f"Ejemplos reservados: {len(prueba)} | exactitud: {aciertos / len(prueba):.2%}")
for intencion, (ok, total) in por_clase.items():
    print(f"  {intencion}: {ok}/{total}")
for texto, esperada, obtenida, confianza in errores:
    print(f"ERROR '{texto}' -> esperada {esperada}, obtenida {obtenida} ({confianza:.2f})")
print("Aviso: conjunto sintético y pequeño; la cifra no representa el desempeño con usuarios reales.")