"""copies the person and og:image in site.json into every page (--check to only report)"""
import glob, json, re, sys

site = json.load(open('site.json', encoding='utf8'))
LD = re.compile(r'^([ \t]*)<script type="application/ld\+json">\n(.*?)\n[ \t]*</script>', re.M | re.S)
IMAGE = re.compile(r'(<meta property="og:image" content=")[^"]*(">)')


def with_person(ld):
    if ld['@type'] == 'Person':
        return {'@context': ld['@context'], **site['person']}
    for key in ('author', 'mainEntity'):
        if key in ld:
            ld[key] = site['person']
    return ld


def render(m):
    indent = m.group(1)
    body = json.dumps(with_person(json.loads(m.group(2))), indent=2, ensure_ascii=False)
    lines = ''.join(indent + line + '\n' for line in body.split('\n'))
    return f'{indent}<script type="application/ld+json">\n{lines}{indent}</script>'


stale = []
for path in glob.glob('**/*.html', recursive=True):
    raw = open(path, encoding='utf8', newline='').read()
    text = raw.replace('\r\n', '\n')
    head, rest = text.split('</head>', 1)
    head = LD.sub(render, head)
    head = IMAGE.sub(lambda m: m.group(1) + site['image'] + m.group(2), head)
    new = head + '</head>' + rest
    if new != text:
        stale.append(path)
        if '--check' not in sys.argv:
            out = new.replace('\n', '\r\n') if '\r\n' in raw else new
            open(path, 'w', encoding='utf8', newline='').write(out)

for path in stale:
    print(path)
sys.exit(1 if stale and '--check' in sys.argv else 0)
