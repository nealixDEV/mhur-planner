import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('damage_tables.json','r',encoding='utf-8') as f:
    data = json.load(f)

fixes = {
    # (character name, style name, skill name, skill type): new Lv.1 damage value
    ("Katsuki Bakugo", "Katsuki Bakugo", "AP Shot", "alpha"): 58,
    ("Katsuki Bakugo", "Katsuki Bakugo", "Improvised Grenades", "beta"): 76,
    ("Katsuki Bakugo", "Machine Gun", "AP Machine Gun", "alpha"): 18,
    ("Katsuki Bakugo", "Machine Gun", "Shrapnel Strike", "beta"): 65,
    ("Katsuki Bakugo", "Machine Gun", "Bomb Blast Mine", "gamma"): 110,
    ("Eijiro Kirishima", "Red Drive", "Red Drive", "alpha"): 38,
    ("Eijiro Kirishima", "Red Drive", "Red Strike", "gamma"): 78,
    ("Mirio Togata", "Mirio Togata", "Invisible Eye Break", "alpha"): 36,
    ("Tamaki Amajiki", "Tamaki Amajiki", "Octopus Mirage", "beta"): 110,
    ("Tamaki Amajiki", "Tamaki Amajiki", "Plasma Cannon", "gamma"): 27,
}

fixed = 0
for c in data.get('characters', []):
    for s in c.get('damageStyles', []):
        for sk in s.get('skills', []):
            key = (c.get('name',''), s.get('styleName',''), sk.get('name',''), sk.get('type',''))
            if key not in fixes: continue
            bt = sk.get('baseTable')
            if not bt: continue
            rows = bt.get('rows', [])
            hdrs = bt.get('headers', [])
            dmgIdx = next((i for i,h in enumerate(hdrs) if h.lower()=='damage'), -1)
            if dmgIdx < 0 or len(rows) < 1: continue
            old = rows[0][dmgIdx]
            rows[0][dmgIdx] = str(fixes[key])
            print(f'Fixed {key}: {old} -> {fixes[key]}')
            fixed += 1

print(f'\nTotal fixed: {fixed}')

with open('damage_tables.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
