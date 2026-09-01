# -*- coding: utf-8 -*-
"""
Extrai a Tabela 1 da TACO 4a ed. (NEPA/UNICAMP) do PDF oficial.

Extração POR COORDENADA, não por ordem dos tokens: células vazias somem do
fluxo de texto, e contar posições desalinharia os valores — a tiamina de um
alimento viraria o RE de outro. Cada número é atribuído à coluna pelo seu
centro horizontal.

Marcadores da TACO:
  Tr = traço (abaixo do limite de quantificação) -> 0
  NA = não analisado                             -> None (fica NULO)
  *  / letras (a, b, c) = notas de rodapé        -> removidas do número
"""
import json
import re
import sys
import pdfplumber

sys.stdout.reconfigure(encoding="utf-8")

PDF = "taco.pdf"
PAG_INI, PAG_FIM = 28, 67  # Tabela 1: pares = esquerda, ímpares = direita

COLS_ESQ = ["umidade", "kcal", "kj", "proteina", "lipideos", "colesterol",
            "carboidrato", "fibra", "cinzas", "calcio", "magnesio"]
COLS_DIR = ["manganes", "fosforo", "ferro", "sodio", "potassio", "cobre", "zinco",
            "retinol", "re", "rae", "tiamina", "riboflavina", "piridoxina",
            "niacina", "vitamina_c"]


def valor(tx):
    """Converte o texto da célula em número, None (NA) ou 0 (Tr)."""
    t = tx.strip()
    if not t:
        return None
    if t.upper().startswith("NA"):
        return None
    if t.upper().startswith("TR"):
        return 0.0
    # remove nota de rodapé colada ao número: "446b" -> "446"
    t = re.sub(r"[a-zA-Z*]+$", "", t).strip()
    t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def centros_das_colunas(page, rotulos, linhas):
    """
    Descobre o x central de cada coluna a partir das PRÓPRIAS linhas de dados.

    Calibrar pelo cabeçalho não funciona: as unidades "(mg)" não ficam alinhadas
    com os números da coluna, e o desvio jogava valores para fora — a abóbora
    perdia RE e RAE, que é onde está a vitamina A dos vegetais.

    As linhas de dados repetem as mesmas posições em toda a página, então o
    agrupamento delas dá o eixo real de cada coluna.
    """
    dados = [l for l in linhas if l and re.fullmatch(r"\d{1,3}", l[0]["text"])]
    if not dados:
        return None

    centros = sorted((w["x0"] + w["x1"]) / 2 for l in dados for w in l[1:])
    grupos, atual = [], [centros[0]]
    for x in centros[1:]:
        if x - atual[-1] <= 12:
            atual.append(x)
        else:
            grupos.append(atual)
            atual = [x]
    grupos.append(atual)

    # As colunas numéricas são sempre as N mais à direita. Nas páginas com nome
    # do alimento, as palavras do nome formam grupos à esquerda que variam de
    # página para página — descartá-los por posição é estável, enquanto
    # descartar por frequência eliminaria RE e RAE, que aparecem em poucos
    # alimentos e carregam a vitamina A dos vegetais.
    if len(grupos) < len(rotulos):
        return None
    return [sum(g) / len(g) for g in grupos[-len(rotulos):]]


def linhas_da_pagina(page):
    """Agrupa palavras por linha (tolerância vertical)."""
    palavras = page.extract_words()
    linhas = {}
    for w in palavras:
        chave = round(w["top"] / 3)
        linhas.setdefault(chave, []).append(w)
    return [sorted(v, key=lambda w: w["x0"]) for _, v in sorted(linhas.items())]


def parse_pagina(page, rotulos, com_nome):
    linhas = linhas_da_pagina(page)
    centros = centros_das_colunas(page, rotulos, linhas)
    if centros is None:
        return {}, "colunas nao calibradas"

    # limite esquerdo dos dados: metade da distância até a 1ª coluna
    limite = centros[0] - (centros[1] - centros[0]) / 2

    saida = {}
    for linha in linhas:
        if not linha:
            continue
        primeiro = linha[0]["text"]
        if not re.fullmatch(r"\d{1,3}", primeiro):
            continue
        num = int(primeiro)

        nome_partes, valores = [], []
        for w in linha[1:]:
            centro = (w["x0"] + w["x1"]) / 2
            if centro < limite:
                nome_partes.append(w["text"])
            else:
                valores.append((centro, w["text"]))

        # cada valor vai para a coluna de centro mais próximo
        celulas = [None] * len(rotulos)
        for centro, txt in valores:
            i = min(range(len(centros)), key=lambda k: abs(centros[k] - centro))
            celulas[i] = txt

        reg = {r: valor(c) if c else None for r, c in zip(rotulos, celulas)}
        if com_nome:
            reg["nome"] = " ".join(nome_partes).strip()
        saida[num] = reg
    return saida, None


esquerda, direita, avisos = {}, {}, []
with pdfplumber.open(PDF) as pdf:
    for i in range(PAG_INI, PAG_FIM + 1):
        page = pdf.pages[i]
        eh_esq = i % 2 == 0
        d, err = parse_pagina(page, COLS_ESQ if eh_esq else COLS_DIR, eh_esq)
        if err:
            avisos.append(f"pag {i}: {err}")
            continue
        (esquerda if eh_esq else direita).update(d)

print(f"esquerda (nome+macros): {len(esquerda)} alimentos")
print(f"direita (minerais+vitaminas): {len(direita)} alimentos")
if avisos:
    print("avisos:")
    for a in avisos[:10]:
        print("  " + a)

# une pelas duas metades
final = {}
for num, e in esquerda.items():
    d = direita.get(num, {})
    final[num] = {**e, **d}

faltam_dir = [n for n in esquerda if n not in direita]
print(f"\nsem metade direita: {len(faltam_dir)} {faltam_dir[:10]}")

com_vit = sum(1 for v in final.values() if v.get("vitamina_c") is not None)
com_tia = sum(1 for v in final.values() if v.get("tiamina") is not None)
print(f"com vitamina C: {com_vit} | com tiamina: {com_tia}")

with open("taco-extraido.json", "w", encoding="utf-8") as f:
    json.dump(final, f, ensure_ascii=False, indent=1)
print(f"\ngravado taco-extraido.json com {len(final)} alimentos")

print("\namostra:")
for n in list(final)[:3]:
    print(f"  {n}: {json.dumps(final[n], ensure_ascii=False)[:220]}")
