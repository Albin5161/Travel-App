# Re-encodes the bundled place photos for the web: same size (1200 px on the long edge), normal web
# quality, progressive so they draw in as they load. Also writes small copies (480 px) of the ones
# shown only small on the first screens a new person sees (Home's prints, the intro's cards), so
# those screens don't wait on full-size photos.
# Run only for newly added photos (python3 scripts/optimize-images.py gok-new.jpg): every run
# re-encodes, and JPEG loses a little each time.
import sys
import os
from PIL import Image

PLACES = 'assets/images/places'
SMALL = os.path.join(PLACES, 'small')
SMALL_ONES = ['meg-dawki', 'kochi-mural', 'gok-om', 'meg-falls', 'gok-halfmoon', 'gok-paradise', 'gok-thali', 'meg-valley']

os.makedirs(SMALL, exist_ok=True)
before = after = 0
only = set(sys.argv[1:])
for name in sorted(os.listdir(PLACES)):
    if only and name not in only:
        continue
    if not name.endswith('.jpg'):
        continue
    path = os.path.join(PLACES, name)
    before += os.path.getsize(path)
    im = Image.open(path).convert('RGB')
    im.save(path, 'JPEG', quality=74, optimize=True, progressive=True)
    after += os.path.getsize(path)
    if name[:-4] in SMALL_ONES:
        small = im.copy()
        small.thumbnail((480, 480), Image.LANCZOS)
        small.save(os.path.join(SMALL, name), 'JPEG', quality=76, optimize=True, progressive=True)
print(f'places: {before // 1024} KB -> {after // 1024} KB')
print('small:', sorted(os.listdir(SMALL)), sum(os.path.getsize(os.path.join(SMALL, f)) for f in os.listdir(SMALL)) // 1024, 'KB')
