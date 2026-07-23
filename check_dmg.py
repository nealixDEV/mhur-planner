import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('damage_tables.json','r',encoding='utf-8') as f:
    data = json.load(f)
targets = ['mirio','kirishima','katsuki','nejire','tamaki','denki']
for c in data.get('characters', []):
    cname = c.get('name','').lower()
    if not any(t in cname for t in targets): continue
    for s in c.get('damageStyles', []):
        for sk in s.get('skills', []):
            bt = sk.get('baseTable')
            if not bt: continue
            rows = bt.get('rows', [])
            hdrs = bt.get('headers', [])
            dmgIdx = next((i for i,h in enumerate(hdrs) if h.lower()=='damage'), -1)
            if dmgIdx < 0: continue
            vals = [str(r[dmgIdx]) for r in rows]
            name = c.get('name','')
            sname = s.get('styleName','')
            skname = sk.get('name','')
            sktype = sk.get('type','')
            print(f'{name} ({sname}) {skname} [{sktype}]: {vals}')
