# Turns one month tab of the old Excel race report into SQL upserts.
# Usage: python3 scripts/import_excel_month.py report.xlsx > import.sql  (edit U = profile id and the year-month in d first)
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); ws = wb.active
U = '1b94d93b-9e47-4e22-9ceb-e59b2fb9e93d'
v = lambda c, r: ws[f'{c}{r}'].value or 0
S, A = [], []
tot = dict(chat=0, mk=0, spend=0, orders=0, enq=0)
for r in range(14, 45):
    d = f"2026-11-{int(ws[f'A{r}'].value):02d}"
    rows = [
        (1, v('B',r), v('C',r), v('J',r), v('K',r), v('Q',r), v('R',r)),
        (2, v('D',r), v('E',r), v('L',r), v('M',r), v('S',r), v('T',r)),
        (3, 0, 0, 0, 0, v('U',r), v('V',r)),
        (5, v('AD',r), 0, 0, 0, 0, 0),
        (6, v('AE',r), 0, 0, 0, 0, 0),
    ]
    for ch, *x in rows:
        if any(x):
            S.append(f"('{d}',{ch},'{U}',{x[0]},{x[1]},{int(x[2])},{int(x[3])},{int(x[4])},{int(x[5])})")
            if ch in (5, 6): tot['mk'] += x[0]
            else: tot['chat'] += x[0] + x[1]; tot['orders'] += x[2] + x[3]; tot['enq'] += x[4] + x[5]
    day = r - 13
    ap, aq = ws[f'AP{r}'].value, ws[f'AQ{r}'].value
    leads = 'null'
    if day <= 15 and aq is not None: leads = int(aq)
    elif 16 <= day <= 19: leads = int((ap or 0) + (aq or 0))
    if v('AG', r): A.append(f"('{d}',1,{v('AG',r)},{leads},'{U}')"); tot['spend'] += v('AG', r)
    if v('AH', r): A.append(f"('{d}',2,{v('AH',r)},null,'{U}')"); tot['spend'] += v('AH', r)
print("insert into public.sales_entries (entry_date,channel_id,user_id,new_sales,repeat_sales,new_orders,repeat_orders,new_enquiries,existing_enquiries) values\n" + ",\n".join(S) + "\non conflict (entry_date,channel_id,user_id) do update set new_sales=excluded.new_sales,repeat_sales=excluded.repeat_sales,new_orders=excluded.new_orders,repeat_orders=excluded.repeat_orders,new_enquiries=excluded.new_enquiries,existing_enquiries=excluded.existing_enquiries;")
print("insert into public.ad_entries (entry_date,ad_account_id,spend,platform_leads,user_id) values\n" + ",\n".join(A) + "\non conflict (entry_date,ad_account_id) do update set spend=excluded.spend,platform_leads=excluded.platform_leads;")
print("--", len(S), len(A), {k: round(x, 2) for k, x in tot.items()}, file=sys.stderr)
