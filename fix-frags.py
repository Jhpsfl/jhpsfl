f = r'C:\websites\jhps\git\src\lib\receipt-generator.tsx'
c = open(f, 'r', encoding='utf-8').read()
print('Fragments before:', c.count('<>'))
c = c.replace('<>', '<View>')
c = c.replace('</>', '</View>')
print('Fragments after:', c.count('<>'))
open(f, 'w', encoding='utf-8').write(c)
print('Done')
