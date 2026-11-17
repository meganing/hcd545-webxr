#!/usr/bin/env python3
"""Build the A1 ZIP:  python3 a1-docs/make_submission.py firstname_lastname
Result: a1-docs/submission/firstname_lastname_a1.zip with project/ (index.html, package.json, package-lock.json, vite.config.js,
src/, public/) and firstname_lastname_report.pdf. Put your final PDF at a1-docs/report/firstname_lastname_report.pdf first
(the file is picked up under whatever name you pass, or the placeholder name)."""
import os, sys, zipfile, shutil
name = sys.argv[1] if len(sys.argv) > 1 else 'firstname_lastname'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
proj, out = os.path.join(root, 'a1'), os.path.join(root, 'a1-docs', 'submission')
os.makedirs(out, exist_ok=True)
pdf = next((p for p in (os.path.join(root, 'a1-docs', 'report', f'{name}_report.pdf'), os.path.join(root, 'a1-docs', 'report', 'firstname_lastname_report.pdf')) if os.path.exists(p)), None)
if not pdf: sys.exit('no report PDF found in a1-docs/report/')
zpath = os.path.join(out, f'{name}_a1.zip')
if os.path.exists(zpath): os.remove(zpath)
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ('index.html', 'package.json', 'package-lock.json', 'vite.config.js'):
        z.write(os.path.join(proj, f), f'project/{f}')
    for d in ('src', 'public'):
        for dp, dn, fn in os.walk(os.path.join(proj, d)):
            for f in fn:
                if f == '.DS_Store': continue
                full = os.path.join(dp, f); z.write(full, 'project/' + os.path.relpath(full, proj))
    z.write(pdf, f'{name}_report.pdf')
print(zpath, round(os.path.getsize(zpath) / 1e6, 2), 'MB')
