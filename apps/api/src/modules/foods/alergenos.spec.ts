import { alergenosPara, REGRAS_ALERGENOS, ALERGENOS } from './alergenos';

const { LEITE, OVO, GLUTEN, TRIGO, SOJA, AMENDOIM, CASTANHAS, PEIXE, CRUSTACEO } = ALERGENOS;

describe('alérgenos', () => {
  describe('leite', () => {
    it.each([
      'Leite, de vaca, integral',
      'Queijo, minas, frescal',
      'Iogurte, natural',
      'Queijo, requeijão, cremoso',
      'Creme de Leite',
      'Doce, de leite, cremoso',
      'Chocolate, ao leite',
      'Pão, de queijo, assado',
    ])('marca leite em %s', (nome) => {
      expect(alergenosPara(nome)).toContain(LEITE);
    });

    it('não marca leite em leite de coco — não é de mamífero', () => {
      expect(alergenosPara('Leite, de coco')).not.toContain(LEITE);
    });

    it('não marca leite no tofu, que é queijo de soja', () => {
      const a = alergenosPara('Soja, queijo (tofu)');
      expect(a).not.toContain(LEITE);
      expect(a).toContain(SOJA);
    });

    it('não marca leite em couve manteiga — é hortaliça', () => {
      expect(alergenosPara('Couve, manteiga, refogada')).not.toContain(LEITE);
    });

    it('marca leite na manteiga de verdade', () => {
      expect(alergenosPara('Manteiga, com sal')).toContain(LEITE);
    });
  });

  describe('glúten', () => {
    it.each([
      'Pão, trigo, francês',
      'Macarrão, trigo, cru',
      'Biscoito, doce, maisena',
      'Farinha, de trigo',
      'Cerveja, pilsen 2',
      'Aveia, flocos, crua',
      'Farinha, de centeio, integral',
    ])('marca glúten em %s', (nome) => {
      expect(alergenosPara(nome)).toContain(GLUTEN);
    });

    it('não marca glúten no biscoito de polvilho', () => {
      expect(alergenosPara('Biscoito, polvilho doce')).not.toContain(GLUTEN);
    });

    it('não confunde o particípio "torrada" com torrada de pão', () => {
      // Marcar glúten na farinha de mandioca tiraria do celíaco uma das suas
      // bases seguras — errar para mais também tem custo clínico
      expect(alergenosPara('Farinha, de mandioca, torrada')).not.toContain(GLUTEN);
      expect(alergenosPara('Amêndoa, torrada, salgada')).not.toContain(GLUTEN);
      expect(alergenosPara('Castanha-de-caju, torrada, salgada')).not.toContain(GLUTEN);
      // e a torrada de pão continua marcada
      expect(alergenosPara('Torrada, pão francês')).toContain(GLUTEN);
    });

    it('não trata quibebe como quibe — é prato de abóbora', () => {
      expect(alergenosPara('Quibebe')).not.toContain(GLUTEN);
      expect(alergenosPara('Quibe, assado')).toContain(GLUTEN);
    });

    it('não marca glúten em arroz, mandioca ou milho puros', () => {
      expect(alergenosPara('Arroz, integral, cozido')).not.toContain(GLUTEN);
      expect(alergenosPara('Mandioca, cozida')).not.toContain(GLUTEN);
      expect(alergenosPara('Milho, verde, cru')).not.toContain(GLUTEN);
    });

    it('marca trigo junto do glúten quando é trigo', () => {
      const a = alergenosPara('Pão, trigo, forma, integral');
      expect(a).toContain(GLUTEN);
      expect(a).toContain(TRIGO);
    });
  });

  describe('demais alergênicos da RDC 26/2015', () => {
    it('ovo', () => {
      expect(alergenosPara('Ovo, de galinha, inteiro, cru')).toContain(OVO);
      expect(alergenosPara('Maionese, tradicional com ovos')).toContain(OVO);
    });

    it('soja', () => {
      expect(alergenosPara('Óleo, de soja')).toContain(SOJA);
      expect(alergenosPara('Soja, farinha')).toContain(SOJA);
    });

    it('amendoim', () => {
      expect(alergenosPara('Amendoim, torrado, salgado')).toContain(AMENDOIM);
      expect(alergenosPara('Paçoca, amendoim')).toContain(AMENDOIM);
      expect(alergenosPara('Pé-de-moleque, amendoim')).toContain(AMENDOIM);
    });

    it('castanhas', () => {
      expect(alergenosPara('Castanha-de-caju, torrada, salgada')).toContain(CASTANHAS);
      expect(alergenosPara('Castanha-do-Brasil, crua')).toContain(CASTANHAS);
      expect(alergenosPara('Amêndoa, torrada, salgada')).toContain(CASTANHAS);
      expect(alergenosPara('Noz, crua')).toContain(CASTANHAS);
    });

    it('peixe', () => {
      expect(alergenosPara('Sardinha, assada')).toContain(PEIXE);
      expect(alergenosPara('Atum, fresco, cru')).toContain(PEIXE);
      expect(alergenosPara('Salmão, sem pele, fresco, cru')).toContain(PEIXE);
    });

    it('crustáceo', () => {
      expect(alergenosPara('Camarão, Rio Grande, grande, cozido')).toContain(CRUSTACEO);
      expect(alergenosPara('Caranguejo, cozido')).toContain(CRUSTACEO);
    });

    it('cação é peixe, não carne', () => {
      expect(alergenosPara('Cação, posta, cozida')).toContain(PEIXE);
    });
  });

  describe('alimentos que não devem receber alérgeno', () => {
    it.each([
      'Alface, crespa, crua',
      'Banana, prata, crua',
      'Batata, inglesa, cozida',
      'Feijão, carioca, cozido',
      'Carne, bovina, patinho, sem gordura, cru',
      'Cenoura, crua',
      'Açúcar, cristal',
      'Azeite, de oliva, extra virgem',
    ])('%s fica sem alérgeno', (nome) => {
      expect(alergenosPara(nome)).toEqual([]);
    });
  });

  describe('combinações', () => {
    it('marca leite e ovo na omelete de queijo', () => {
      const a = alergenosPara('Omelete, de queijo');
      expect(a).toEqual(expect.arrayContaining([LEITE, OVO]));
    });

    it('marca ovo, glúten e trigo no empanado à milanesa', () => {
      const a = alergenosPara('Frango, filé, à milanesa');
      expect(a).toEqual(expect.arrayContaining([OVO, GLUTEN, TRIGO]));
    });

    it('marca soja, glúten e trigo no shoyu', () => {
      const a = alergenosPara('Shoyu');
      expect(a).toEqual(expect.arrayContaining([SOJA, GLUTEN, TRIGO]));
    });
  });

  describe('integridade do dicionário', () => {
    it('não devolve duplicatas', () => {
      const a = alergenosPara('Farinha, láctea, de cereais');
      expect(a.length).toBe(new Set(a).size);
    });

    it('devolve sempre na mesma ordem', () => {
      expect(alergenosPara('Omelete, de queijo')).toEqual(alergenosPara('Omelete, de queijo'));
    });

    it('toda regra tem trecho não vazio', () => {
      for (const r of REGRAS_ALERGENOS) {
        expect(r.contem.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
