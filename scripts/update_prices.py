import json

with open('precios.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

updated_count = 0
prev_prices = {}
new_prices = {}

for item in data:
    subcat = item.get('Subcategoria', '').strip()
    if subcat.lower() == 'organico blanco':
        old_cf = float(item['CF'])
        new_cf = round(old_cf + 0.50, 2)
        
        prev_prices[old_cf] = prev_prices.get(old_cf, 0) + 1
        new_prices[new_cf] = new_prices.get(new_cf, 0) + 1
        
        item['CF'] = new_cf
        updated_count += 1

with open('precios.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Also update js/data.js if it exists, so offline mode matches
with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write('var localMasterData = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print(f'Successfully updated {updated_count} items in precios.json and js/data.js')
print('\n--- PRICE SUMMARY TABLE ---')
print('| Precio Anterior (Medio Par) | Nuevo Precio (Medio Par) | Par Completo Anterior | Nuevo Par Completo | Cantidad Medidas |')
print('|:---:|:---:|:---:|:---:|:---:|')
for old_cf in sorted(prev_prices.keys()):
    new_cf = round(old_cf + 0.50, 2)
    count = prev_prices[old_cf]
    print(f'| {old_cf:.2f} Bs. | {new_cf:.2f} Bs. | {(old_cf*2):.2f} Bs. | {(new_cf*2):.2f} Bs. | {count} |')
