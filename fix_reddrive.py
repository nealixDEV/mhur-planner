import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('damage_tables.json','r',encoding='utf-8') as f:
    data = json.load(f)

for c in data.get('characters', []):
    if c.get('name','') != 'Eijiro Kirishima': continue
    for s in c.get('damageStyles', []):
        if s.get('styleName','') != 'Red Drive': continue
        for sk in s.get('skills', []):
            if sk.get('name','') != 'Red Spirit' or sk.get('type','') != 'beta': continue
            bt = sk.get('baseTable')
            if not bt: continue
            rows = bt.get('rows', [])
            hdrs = bt.get('headers', [])
            dmgIdx = next((i for i,h in enumerate(hdrs) if h.lower()=='damage'), -1)
            if dmgIdx < 0: continue
            new_vals = [88, 92, 96, 100, 104, 108, 112, 116, 120]
            for i in range(min(len(rows), len(new_vals))):
                rows[i][dmgIdx] = str(new_vals[i])
            print('Fixed Red Drive beta (Red Spirit) to use Last Ground Hit values')

with open('damage_tables.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
