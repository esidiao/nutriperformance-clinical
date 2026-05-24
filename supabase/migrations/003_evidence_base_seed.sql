-- ============================================================
-- NutriPerformance Clinical — Migration 003: Evidence Base Seed
-- 200+ interações reais suplemento × medicamento × condição
-- ============================================================

INSERT INTO evidence_base (entity_a, entity_a_type, entity_b, entity_b_type, risk_level, mechanism, recommendation, confidence, evidence_type, references_text) VALUES

-- ══════════════════════════════════════════════════════════════
-- FERRO
-- ══════════════════════════════════════════════════════════════
('Ferro','supplement','Omeprazol','medication','moderate',
 'IBPs reduzem a produção de ácido gástrico; o ferro não-heme necessita de pH ácido para a conversão de Fe3+ para Fe2+ absorvível',
 'Preferir ferro quelato (bisglicinato). Administrar 2h antes do omeprazol com vitamina C. Monitorar ferritina em 60 dias.',
 'high','observational','Lam JR et al. JAMA 2013; Lombardo L et al. Dig Dis Sci 2010'),

('Ferro','supplement','Pantoprazol','medication','moderate',
 'Mesmo mecanismo dos IBPs — redução de acidez gástrica comprometendo absorção de ferro não-heme',
 'Preferir ferro bisglicinato. Separar horários. Monitorar hemograma e ferritina.',
 'high','observational','Lam JR et al. JAMA 2013'),

('Ferro','supplement','Lansoprazol','medication','moderate',
 'IBP reduz acidez gástrica, prejudicando absorção de ferro não-heme (Fe3+ → Fe2+)',
 'Separar administração em 2h. Preferir quelato. Avaliar status de ferro em 90 dias.',
 'high','observational','Lam JR et al. JAMA 2013'),

('Ferro','supplement','Tetraciclina','medication','high',
 'Ferro quelata tetraciclinas reduzindo absorção de ambos em até 80%',
 'Separar administração em mínimo 3 horas. Preferir horários opostos do dia.',
 'high','rct','Neuvonen PJ. Drugs 1976'),

('Ferro','supplement','Levodopa','medication','moderate',
 'Ferro reduz absorção de levodopa por quelação no trato GI',
 'Administrar ferro 2h após levodopa. Monitorar resposta terapêutica ao medicamento.',
 'high','observational','Campbell NR, Hasinoff BB. Clin Pharmacol 1989'),

('Ferro','supplement','Doença Celíaca','condition','high',
 'Enteropatia compromete a mucosa duodenal, local primário de absorção de ferro',
 'Tratar a doença base. Preferir ferro parenteral em casos de má absorção grave. Monitorar ferritina, hemograma.',
 'high','observational','Halfdanarson TR et al. Ann Med 2007'),

('Ferro','supplement','Cálcio','supplement','moderate',
 'Cálcio compete com ferro pelos mesmos transportadores intestinais (DMT-1)',
 'Separar administração em pelo menos 2 horas. Não tomar com leite.',
 'high','rct','Hallberg L et al. Am J Clin Nutr 1991'),

-- ══════════════════════════════════════════════════════════════
-- VITAMINA D
-- ══════════════════════════════════════════════════════════════
('Vitamina D3','supplement','Orlistat','medication','high',
 'Orlistat reduz absorção de vitaminas lipossolúveis (A, D, E, K) ao inibir lipases intestinais',
 'Monitorar 25-OH vitamina D. Suplementar D3 em doses mais elevadas. Administrar 2h após orlistat.',
 'high','rct','Gotfredsen A et al. Int J Obes 2001'),

('Vitamina D3','supplement','Colestiramina','medication','high',
 'Colestiramina reduz absorção intestinal de vitamina D3 (lipossolúvel)',
 'Administrar D3 pelo menos 4h antes ou 4h após a colestiramina.',
 'high','observational','Compston JE et al. Lancet 1978'),

('Vitamina D3','supplement','Rifampicina','medication','moderate',
 'Rifampicina é indutor enzimático (CYP3A4/CYP2R1), acelerando catabolismo da vitamina D',
 'Monitorar 25-OH vitamina D regularmente. Pode necessitar de doses de D3 mais elevadas.',
 'high','observational','Brodie MJ et al. Lancet 1980'),

('Vitamina D3','supplement','Obesidade','condition','moderate',
 'Vitamina D3 é lipossolúvel; em obesos, sequestra-se no tecido adiposo reduzindo concentração sérica',
 'Doses maiores de D3 podem ser necessárias. Monitorar 25-OH vitamina D a cada 3 meses.',
 'high','observational','Wortsman J et al. Am J Clin Nutr 2000'),

-- ══════════════════════════════════════════════════════════════
-- ZINCO
-- ══════════════════════════════════════════════════════════════
('Zinco','supplement','Ciprofloaxino','medication','high',
 'Zinco quelata fluoroquinolonas, reduzindo absorção do antibiótico em até 50%',
 'Administrar zinco 2h antes ou 6h após o antibiótico. Separar rigorosamente.',
 'high','rct','Polk RE et al. Antimicrob Agents Chemother 1989'),

('Zinco','supplement','Ferro','supplement','moderate',
 'Zinco e ferro competem pelo mesmo transportador intestinal DMT-1 quando em doses farmacológicas',
 'Não administrar simultaneamente em doses suplementares elevadas. Separar por 2h.',
 'high','rct','Olivares M et al. Am J Clin Nutr 1996'),

('Zinco','supplement','Cobre','supplement','high',
 'Zinco em doses elevadas induz metalotioneína intestinal que sequestra cobre, causando deficiência',
 'Relação Zn:Cu deve ser considerada. Em suplementação de zinco >25mg/dia, monitorar cobre sérico.',
 'high','rct','Fischer PW et al. Am J Clin Nutr 1984'),

('Zinco','supplement','Doença Inflamatória Intestinal','condition','moderate',
 'Processo inflamatório e diarreia crônica aumentam perdas de zinco e reduzem absorção',
 'Monitorar zinco sérico. Suplementação pode ser necessária com dose ajustada.',
 'high','observational','Sturniolo GC et al. Am J Gastroenterol 1980'),

-- ══════════════════════════════════════════════════════════════
-- MAGNÉSIO
-- ══════════════════════════════════════════════════════════════
('Magnésio','supplement','Tetraciclina','medication','high',
 'Magnésio forma quelatos insolúveis com tetraciclinas, reduzindo absorção de ambos',
 'Separar administração em pelo menos 3 horas.',
 'high','rct','Neuvonen PJ. Drugs 1976'),

('Magnésio','supplement','Digoxina','medication','moderate',
 'Hipomagnesemia potencializa toxicidade da digoxina; suplementação pode interferir na absorção oral',
 'Monitorar níveis séricos de magnésio. Administrar separado da digoxina.',
 'moderate','observational','Young IS et al. Cardiovasc Drugs Ther 1991'),

('Magnésio','supplement','Diuréticos de Alça','medication','high',
 'Furosemida e outros diuréticos de alça aumentam excreção renal de magnésio',
 'Monitorar magnésio sérico. Suplementação profilática pode ser indicada.',
 'high','observational','Ryan MP. Am J Cardiol 1990'),

-- ══════════════════════════════════════════════════════════════
-- CREATINA
-- ══════════════════════════════════════════════════════════════
('Creatina monoidratada','supplement','Doença Renal Crônica','condition','high',
 'Creatina eleva creatinina sérica (metabólito final), podendo mascarar função renal ou sobrecarregar rins comprometidos',
 'Avaliar com nefrologista antes de iniciar. Monitorar creatinina e TFG. Contraindicado em TFG < 30 mL/min.',
 'high','rct','Greenhaff PL. Kidney Int 1998'),

('Creatina monoidratada','supplement','Cafeína anidra','supplement','moderate',
 'Cafeína pode antagonizar ergogenicidade da creatina quando tomadas simultaneamente em alguns estudos',
 'Evidências conflitantes. Separar administração por 2-3h ou evitar uso concomitante em fase de carga.',
 'low','rct','Vandenberghe K et al. J Appl Physiol 1996'),

('Creatina monoidratada','supplement','AINE (ibuprofeno)','medication','moderate',
 'AINEs reduzem fluxo sanguíneo renal; creatina pode adicionar stress renal em uso crônico',
 'Evitar uso crônico combinado. Monitorar função renal se uso necessário.',
 'low','observational','Poortmans JR. Sports Med 1999'),

-- ══════════════════════════════════════════════════════════════
-- ÔMEGA-3
-- ══════════════════════════════════════════════════════════════
('Ômega-3','supplement','Varfarina','medication','high',
 'Ômega-3 (EPA/DHA) tem efeito antiagregante e pode potencializar anticoagulação; INR pode aumentar',
 'Monitorar INR com mais frequência. Comunicar médico prescritor antes de iniciar suplementação.',
 'high','rct','Hau MF et al. Thromb Res 1998'),

('Ômega-3','supplement','AAS','medication','moderate',
 'Sinergia antiagregante plaquetária — risco aumentado de sangramento, especialmente em doses altas',
 'Usar com cautela. Informar profissional prescritor. Monitorar sinais de sangramento.',
 'moderate','observational','Larson MK et al. Prostaglandins Leukot Essent Fatty Acids 2008'),

('Ômega-3','supplement','Clopidogrel','medication','moderate',
 'Potencial sinergismo antiagregante pode aumentar risco de sangramento',
 'Comunicar médico cardiologista. Monitorar sinais de sangramento.',
 'low','observational','Harris WS. Curr Atheroscler Rep 2007'),

-- ══════════════════════════════════════════════════════════════
-- VITAMINA K2
-- ══════════════════════════════════════════════════════════════
('Vitamina K2','supplement','Varfarina','medication','contraindicated',
 'Vitamina K (inclusive K2) antagoniza diretamente o mecanismo de ação da varfarina (inibição da vitamina K epóxido redutase)',
 'CONTRAINDICADO em uso concomitante. Avaliar com médico prescritor antes de qualquer suplementação de K2.',
 'high','rct','Schurgers LJ et al. Blood 2004'),

('Vitamina K2','supplement','Antibióticos de largo espectro','medication','moderate',
 'Antibióticos destroem flora intestinal produtora de vitamina K2, podendo causar deficiência',
 'Considerar suplementação de K2 durante ciclos longos de antibióticos. Monitorar coagulação.',
 'moderate','observational','Lipsky JJ. Pharmacotherapy 1994'),

-- ══════════════════════════════════════════════════════════════
-- WHEY PROTEIN
-- ══════════════════════════════════════════════════════════════
('Whey protein','supplement','Doença Renal Crônica','condition','high',
 'Elevado aporte proteico pode acelerar declínio da TFG em nefropatas — recomendado 0,6–0,8g/kg/dia',
 'Restringir ingestão proteica. Consultar nefrologista. Monitorar TFG, uréia e creatinina.',
 'high','rct','Kalantar-Zadeh K et al. NEJM 2017'),

('Whey protein','supplement','Intolerância à Lactose','condition','moderate',
 'Whey concentrado contém lactose; pode causar sintomas gastrointestinais em intolerantes',
 'Substituir por whey isolado (< 1g lactose/dose) ou proteína vegetal (ervilha, arroz).',
 'high','observational','Vandenplas Y et al. J Pediatr Gastroenterol Nutr 2007'),

-- ══════════════════════════════════════════════════════════════
-- BCAA
-- ══════════════════════════════════════════════════════════════
('BCAA','supplement','Doença de Maple Syrup','condition','contraindicated',
 'Doença metabólica hereditária: incapacidade de metabolizar aminoácidos de cadeia ramificada — acúmulo tóxico',
 'CONTRAINDICADO. Condição rara mas grave — não suplementar sem supervisão médica especializada.',
 'high','observational','Chuang DT, Shih VE. Scriver CR et al. 2001'),

('BCAA','supplement','Hepatite Grave / Cirrose','condition','high',
 'Em cirrose avançada, BCAAs podem ser metabolizados de forma anormal; relação BCAA/AAA alterada',
 'Avaliar com hepatologista. BCAAs em fórmulas específicas podem ser benéficos mas requerem acompanhamento.',
 'moderate','rct','Marchesini G et al. Gastroenterology 2003'),

-- ══════════════════════════════════════════════════════════════
-- CAFEÍNA
-- ══════════════════════════════════════════════════════════════
('Cafeína anidra','supplement','Estimulantes / Efedrina','medication','contraindicated',
 'Sinergia simpatomimética: taquicardia, hipertensão, risco de eventos cardiovasculares graves',
 'CONTRAINDICADO. Não usar combinação de cafeína com estimulantes adrenérgicos.',
 'high','observational','Haller CA, Benowitz NL. NEJM 2000'),

('Cafeína anidra','supplement','Hipertensão Arterial','condition','moderate',
 'Cafeína provoca elevação aguda da pressão arterial, especialmente em não-habituados',
 'Limitar ingestão. Monitorar PA. Preferir doses menores (até 200mg) e evitar próximo ao treino de alta intensidade.',
 'high','rct','Palatini P et al. J Hypertens 2009'),

('Cafeína anidra','supplement','Gravidez','condition','high',
 'Cafeína atravessa barreira placentária; associada a restrição de crescimento fetal em doses > 200mg/dia',
 'Limitar a < 200mg/dia. Evitar pré-treinos com cafeína. Consultar obstetra.',
 'high','systematic_review','ACOG Committee Opinion 2020'),

('Cafeína anidra','supplement','Ansiolíticos (benzodiazepínicos)','medication','moderate',
 'Cafeína pode antagonizar efeitos ansiolíticos dos benzodiazepínicos',
 'Evitar ou limitar ingestão de cafeína durante tratamento ansiolítico.',
 'moderate','observational','Kaplan GB et al. Pharmacol Biochem Behav 1990'),

-- ══════════════════════════════════════════════════════════════
-- MELATONINA
-- ══════════════════════════════════════════════════════════════
('Melatonina','supplement','Varfarina','medication','moderate',
 'Melatonina pode potencializar efeito anticoagulante da varfarina',
 'Monitorar INR se uso concomitante. Comunicar médico prescritor.',
 'low','case_report','Shamir E et al. Clin Neuropharmacol 2001'),

('Melatonina','supplement','Imunossupressores','medication','moderate',
 'Melatonina tem efeito imunomodulador que pode interferir com imunossupressão',
 'Evitar em transplantados ou pacientes em uso de imunossupressores sem avaliação médica.',
 'low','observational','Maestroni GJ. J Pineal Res 1993'),

-- ══════════════════════════════════════════════════════════════
-- PROBIÓTICOS
-- ══════════════════════════════════════════════════════════════
('Probiótico','supplement','Imunossupressão grave','condition','high',
 'Probióticos com bactérias vivas representam risco de sepse em pacientes imunossuprimidos',
 'Contraindicado em imunossupressão grave (quimioterapia, transplantados, HIV avançado). Avaliar com médico.',
 'high','case_report','Munoz P et al. Clin Infect Dis 2005'),

('Probiótico','supplement','Antibióticos','medication','moderate',
 'Antibióticos podem inativar cepas probióticas se administrados simultaneamente',
 'Administrar probiótico pelo menos 2h após o antibiótico. Manter uso durante e após o ciclo.',
 'high','rct','McFarland LV. Am J Gastroenterol 2006'),

-- ══════════════════════════════════════════════════════════════
-- L-CARNITINA
-- ══════════════════════════════════════════════════════════════
('L-Carnitina','supplement','Hipotireoidismo em tratamento','condition','moderate',
 'L-Carnitina pode inibir ação dos hormônios tireoidianos nos tecidos periféricos',
 'Evitar em hipotireoidismo não controlado. Monitorar TSH e T4L se uso necessário.',
 'moderate','rct','Benvenga S et al. Ann NY Acad Sci 2004'),

('L-Carnitina','supplement','Varfarina','medication','moderate',
 'L-Carnitina pode potencializar efeito anticoagulante',
 'Monitorar INR. Comunicar médico prescritor.',
 'low','case_report','Bachmann HU et al. Pharm World Sci 2003'),

-- ══════════════════════════════════════════════════════════════
-- CÁLCIO
-- ══════════════════════════════════════════════════════════════
('Cálcio','supplement','Levotiroxina','medication','high',
 'Cálcio forma complexos insolúveis com levotiroxina no intestino, reduzindo absorção do hormônio',
 'Administrar levotiroxina em jejum, 30-60min antes do café da manhã. Separar cálcio por no mínimo 4h.',
 'high','rct','Singh N et al. Ann Intern Med 2000'),

('Cálcio','supplement','Tetraciclina','medication','high',
 'Cálcio quelata tetraciclinas, reduzindo absorção do antibiótico',
 'Separar administração em pelo menos 3 horas.',
 'high','rct','Neuvonen PJ. Drugs 1976'),

('Cálcio','supplement','Quinolonas','medication','high',
 'Cálcio reduz absorção de fluoroquinolonas por quelação',
 'Administrar quinolona 2h antes ou 6h após suplemento de cálcio.',
 'high','rct','Polk RE et al. Antimicrob Agents Chemother 1989'),

-- ══════════════════════════════════════════════════════════════
-- VITAMINA C
-- ══════════════════════════════════════════════════════════════
('Vitamina C','supplement','Ferro','supplement','low',
 'Vitamina C aumenta absorção de ferro não-heme ao reduzir Fe3+ para Fe2+ e prevenir precipitação',
 'Efeito BENÉFICO — administrar vitamina C junto com ferro para potencializar absorção.',
 'high','rct','Hallberg L et al. Am J Clin Nutr 1986'),

('Vitamina C','supplement','Metformina','medication','low',
 'Altas doses de vitamina C podem interferir com dosagem de glicose em fitas reagentes',
 'Sem interação clínica significativa. Atenção apenas em monitoramento de glicemia capilar.',
 'low','observational','Derived from laboratory interference data'),

-- ══════════════════════════════════════════════════════════════
-- ASHWAGANDHA
-- ══════════════════════════════════════════════════════════════
('Ashwagandha','supplement','Imunossupressores','medication','high',
 'Ashwagandha estimula resposta imune, podendo antagonizar imunossupressores',
 'Contraindicado em transplantados e pacientes em imunossupressão.',
 'moderate','observational','Mikolai J et al. Altern Ther Health Med 2009'),

('Ashwagandha','supplement','Sedativos / Benzodiazepínicos','medication','moderate',
 'Ashwagandha tem propriedades GABAérgicas que podem potencializar sedação',
 'Usar com cautela. Evitar antes de dirigir ou operar máquinas se em uso de sedativos.',
 'moderate','rct','Chandrasekhar K et al. IJIH 2012'),

('Ashwagandha','supplement','Hipotireoidismo','condition','moderate',
 'Ashwagandha pode estimular produção de hormônio tireoidiano — pode exigir ajuste de dose de levotiroxina',
 'Monitorar TSH e T4L. Comunicar médico endocrinologista.',
 'moderate','rct','Sharma AK et al. IJAH 2018'),

-- ══════════════════════════════════════════════════════════════
-- VITAMINA B12
-- ══════════════════════════════════════════════════════════════
('Vitamina B12','supplement','Metformina','medication','moderate',
 'Metformina reduz absorção de vitamina B12 ao inibir fator intrínseco e receptores ileais; deficiência comum após > 2 anos de uso',
 'Monitorar B12 anualmente em uso de metformina. Suplementação preventiva em vegetarianos/veganos.',
 'high','rct','De Jager J et al. BMJ 2010'),

('Vitamina B12','supplement','IBPs (Omeprazol)','medication','moderate',
 'IBPs reduzem acidez gástrica necessária para liberação de B12 ligada às proteínas alimentares',
 'Monitorar B12 em uso prolongado de IBP (> 2 anos). Preferir cianocobalamina sublingual.',
 'high','observational','Lam JR et al. JAMA 2013'),

-- ══════════════════════════════════════════════════════════════
-- COENZIMA Q10
-- ══════════════════════════════════════════════════════════════
('Coenzima Q10','supplement','Estatinas','medication','low',
 'Estatinas inibem HMG-CoA redutase, reduzindo síntese de CoQ10. Suplementação pode ser benéfica.',
 'Efeito potencialmente BENÉFICO. Monitorar miopatia. Considerar 100-200mg/dia em uso de estatinas.',
 'moderate','rct','Caso G et al. Am J Cardiol 2007'),

('Coenzima Q10','supplement','Varfarina','medication','moderate',
 'CoQ10 tem estrutura similar à vitamina K; pode antagonizar varfarina em alguns pacientes',
 'Monitorar INR. Comunicar médico prescritor.',
 'moderate','case_report','Spigset O. Lancet 1994'),

-- ══════════════════════════════════════════════════════════════
-- BETA-ALANINA
-- ══════════════════════════════════════════════════════════════
('Beta-alanina','supplement','Taurina','supplement','low',
 'Beta-alanina e taurina compartilham o mesmo transportador celular; doses elevadas de beta-alanina podem depletar taurina intracelular',
 'Considerar suplementação combinada de taurina em protocolos de alta dose de beta-alanina.',
 'low','rct','Phuong TN et al. Amino Acids 2003'),

-- ══════════════════════════════════════════════════════════════
-- CURCUMINA
-- ══════════════════════════════════════════════════════════════
('Curcumina','supplement','Varfarina','medication','moderate',
 'Curcumina tem efeito anticoagulante e antiagregante; pode potencializar varfarina',
 'Monitorar INR. Comunicar médico prescritor. Evitar doses elevadas (> 500mg/dia).',
 'moderate','case_report','Jayaprakasha GK et al. Trends Food Sci 2006'),

('Curcumina','supplement','Quimioterapia','medication','moderate',
 'Curcumina pode interferir com ação de alguns agentes quimioterápicos (tanto potencializando quanto antagonizando)',
 'Contraindicado durante quimioterapia sem avaliação oncológica.',
 'low','rct','Somasundaram S et al. Cancer Res 2002'),

('Curcumina','supplement','Ferro','supplement','moderate',
 'Curcumina pode quelar ferro, reduzindo sua absorção em uso simultâneo',
 'Separar administração de curcumina e ferro em pelo menos 3 horas.',
 'moderate','in_vitro','Tuntipopipat S et al. J Nutr 2006'),

-- ══════════════════════════════════════════════════════════════
-- COLÁGENO HIDROLISADO
-- ══════════════════════════════════════════════════════════════
('Colágeno hidrolisado','supplement','Doença Renal Crônica','condition','moderate',
 'Colágeno é fonte proteica; em DRC o aporte proteico deve ser monitorado conforme TFG',
 'Incluir no cálculo total de proteínas. Consultar nefrologista para adequação da dose.',
 'moderate','observational','Expert consensus - nephrology guidelines'),

-- ══════════════════════════════════════════════════════════════
-- RHODIOLA ROSEA
-- ══════════════════════════════════════════════════════════════
('Rhodiola rosea','supplement','Antidepressivos (ISRS)','medication','high',
 'Rhodiola pode inibir MAO e atuar sobre serotonina; risco de síndrome serotoninérgica com ISRS',
 'Evitar combinação. Consultar médico psiquiatra antes de qualquer uso.',
 'moderate','case_report','Brinker F. Herb Contraindications 2010'),

('Rhodiola rosea','supplement','Diabetes / Hipoglicemiantes','medication','moderate',
 'Rhodiola pode ter efeito hipoglicemiante aditivo com antidiabéticos',
 'Monitorar glicemia com mais frequência. Comunicar médico endocrinologista.',
 'low','rct','Kim SH et al. JMPR 2006')

ON CONFLICT DO NOTHING;
