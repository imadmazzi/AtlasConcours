import sys

with open('frontend/src/index.css', 'rb') as f:
    content = f.read()

# Replace null bytes that were injected by UTF-16
content = content.replace(b'\x00', b'')
content_str = content.decode('utf-8', errors='ignore')

lines = content_str.split('\n')
good_lines = [l for l in lines if '[ d i r' not in l and '[dir=" rtl]' not in l]
clean_content = '\n'.join(good_lines) + '\n[dir="rtl"] .detail-main { direction: rtl; text-align: right; }\n[dir="rtl"] .page-header, [dir="rtl"] .concours-hero { text-align: right; direction: rtl; }\n[dir="rtl"] .detail-meta, [dir="rtl"] .page-header-meta, [dir="rtl"] .concours-meta-grid { flex-direction: row; text-align: right; direction: rtl; justify-content: flex-start; }\n[dir="rtl"] .breadcrumb { direction: rtl; }\n'

with open('frontend/src/index.css', 'wb') as f:
    f.write(clean_content.encode('utf-8'))
