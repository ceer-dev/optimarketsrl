import os
from PIL import Image

image_dir = 'images'
total_orig = 0
total_webp = 0
converted_count = 0

for root, dirs, files in os.walk(image_dir):
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg']:
            orig_path = os.path.join(root, f)
            webp_path = os.path.splitext(orig_path)[0] + '.webp'
            
            orig_size = os.path.getsize(orig_path)
            total_orig += orig_size
            
            try:
                with Image.open(orig_path) as img:
                    # Save as WebP
                    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                        img.save(webp_path, 'WEBP', quality=82, method=6)
                    else:
                        img.convert('RGB').save(webp_path, 'WEBP', quality=82, method=6)
                    
                    webp_size = os.path.getsize(webp_path)
                    total_webp += webp_size
                    converted_count += 1
            except Exception as e:
                print(f"Error converting {orig_path}: {e}")

print(f"Successfully converted {converted_count} images to WebP.")
print(f"Original size: {total_orig:,} bytes ({total_orig / (1024*1024):.2f} MB)")
print(f"WebP size:     {total_webp:,} bytes ({total_webp / (1024*1024):.2f} MB)")
reduction = (1 - total_webp / total_orig) * 100
print(f"Size reduction: {reduction:.1f}% savings!")
