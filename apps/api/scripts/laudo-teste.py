# Gera um PDF de laudo laboratorial realista para testar a extracao.
# Inclui de proposito os casos dificeis: virgula decimal, ponto de milhar,
# marcador fora do catalogo e um valor que so existe como texto.
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm

c = canvas.Canvas("laudo_teste.pdf", pagesize=A4)
L, y = 2*cm, 27*cm

def linha(txt, dy=0.55*cm, size=10, bold=False):
    global y
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(L, y, txt)
    y -= dy

linha("LABORATORIO CENTRAL DE ANALISES CLINICAS", size=13, bold=True)
linha("Rua das Flores, 120 - Goiania/GO", size=8)
y -= 0.3*cm
linha("Paciente: MARIA DE SOUZA          Data da coleta: 15/03/2026", bold=True)
linha("Medico solicitante: Dr. Carlos Lima", size=9)
y -= 0.4*cm

linha("HEMOGRAMA COMPLETO", bold=True)
linha("Hemoglobina .................... 11,2 g/dL        VR: 12,0 a 16,0")
linha("Hematocrito .................... 34,5 %           VR: 36 a 46")
linha("VCM ............................ 78,4 fL          VR: 80 a 100")
linha("Leucocitos ..................... 7.500 /uL        VR: 4.000 a 11.000")
linha("Plaquetas ...................... 245.000 /uL      VR: 150.000 a 450.000")
y -= 0.3*cm

linha("BIOQUIMICA", bold=True)
linha("Glicose de jejum ............... 98 mg/dL         VR: 70 a 99")
linha("Hemoglobina glicada (HbA1c) .... 5,4 %            VR: ate 5,7")
linha("Colesterol total ............... 212 mg/dL        VR: ate 190")
linha("HDL ............................ 48 mg/dL         VR: acima de 40")
linha("LDL ............................ 138 mg/dL        VR: ate 130")
linha("Triglicerideos ................. 132 mg/dL        VR: ate 150")
linha("Creatinina ..................... 0,82 mg/dL       VR: 0,50 a 1,10")
linha("TGP (ALT) ...................... 22 U/L           VR: ate 33")
y -= 0.3*cm

linha("VITAMINAS E MINERAIS", bold=True)
linha("Ferritina ...................... 12,4 ng/mL       VR: 15 a 150")
linha("Vitamina D (25-OH) ............. 21,7 ng/mL       VR: acima de 30")
linha("Vitamina B12 ................... 310 pg/mL        VR: 200 a 900")
linha("Zinco .......................... 74 ug/dL         VR: 70 a 120")
y -= 0.3*cm

linha("HORMONIOS", bold=True)
linha("TSH ............................ 4,5 uUI/mL       VR: 0,4 a 4,0")
linha("T4 livre ....................... 0,95 ng/dL       VR: 0,8 a 1,9")
y -= 0.3*cm

linha("OUTROS", bold=True)
linha("Homocisteina ................... 9,2 umol/L       VR: ate 15")
linha("Hemoglobina S .................. Ausente")

c.save()
print("laudo_teste.pdf gerado")
