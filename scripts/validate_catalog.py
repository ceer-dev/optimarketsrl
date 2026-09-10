import json
import sys

def validate():
    with open('precios.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    assert isinstance(data, list), 'Data must be a list'
    assert len(data) > 10000, f'Expected >10k items, got {len(data)}'

    # Check Organico Blanco prices
    organicos = [i for i in data if i.get('Subcategoria', '').strip().lower() == 'organico blanco']
    assert len(organicos) == 2041, f'Expected 2041 Organico Blanco items, got {len(organicos)}'
    
    # Check that minimum price for Organico Blanco is 8.50 (after +0.50 increment from 8.00)
    min_cf = min(float(i['CF']) for i in organicos)
    assert min_cf == 8.50, f'Expected min CF 8.50, found {min_cf}'

    # Verify all Organico Blanco items have valid positive prices
    for item in organicos:
        cf = float(item.get('CF', 0))
        assert cf >= 8.50, f"Organico Blanco item {item.get('medida')} has price below minimum: {cf}"

    print(f'[OK] Catalog validation successful: {len(data)} items checked, {len(organicos)} Organico Blanco items verified (min price: {min_cf:.2f} Bs).')

if __name__ == '__main__':
    validate()
