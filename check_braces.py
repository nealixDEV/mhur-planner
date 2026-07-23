import re
with open('index.html','r',encoding='utf-8') as f:
    content = f.read()
# Find all script blocks
scripts = re.findall(r'<script>(.*?)</script>', content, re.DOTALL)
# Check first script block
script = scripts[0]
# Count braces
depth = 0
for i, c in enumerate(script):
    if c == '{': depth += 1
    elif c == '}': depth -= 1
    if depth < 0:
        # Find line number
        line = script[:i].count('\n') + 1
        print(f'NEGATIVE at char {i} line {line}: depth={depth}')
        context = script[max(0,i-50):i+50]
        print(f'Context: ...{repr(context)}...')
        break
print(f'Final depth: {depth}')
