import pandas as pd
import json

# Archivo de Excel
archivo_excel = "precios.xlsx"

# Leer la primera hoja
df = pd.read_excel(archivo_excel)

# Reemplazar valores NaN por None (null en JSON)
df = df.where(pd.notnull(df), None)

# Convertir a lista de diccionarios
datos = df.to_dict(orient="records")

# Guardar como JSON
with open("datos.json", "w", encoding="utf-8") as archivo_json:
    json.dump(datos, archivo_json, ensure_ascii=False, indent=4)

print("Archivo JSON generado correctamente.")