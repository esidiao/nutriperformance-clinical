import { registroProfissional } from '../../../../web/lib/registro-profissional';

/**
 * Como o registro aparece no documento que chega ao paciente.
 *
 * Os casos são os SEIS registros reais da base em 29/10/2026 — não exemplos
 * inventados. Quatro deles sairiam com o acrônimo duplicado pela
 * concatenação ingênua que o PDF fazia.
 */
describe('registroProfissional', () => {
  it('não duplica o acrônimo quando o número já o traz', () => {
    // O caso mais comum na base: "CFN" + "CRN-3 12345" virava
    // "CFN CRN-3 12345". Quem registra nutricionista é o CRN.
    expect(registroProfissional('CFN', 'CRN-3 12345', 'SP')).toBe('CRN-3 12345/SP');
    expect(registroProfissional('CONFEF', 'CREF-0 000000-G/SP', 'SP'))
      .toBe('CREF-0 000000-G/SP');
  });

  it('usa o tipo quando o número NÃO traz acrônimo', () => {
    expect(registroProfissional('CRN', '12345', 'GO')).toBe('CRN 12345/GO');
  });

  it('não repete a UF que já está no número', () => {
    expect(registroProfissional('CONFEF', '054321-G/SP', 'SP')).toBe('CONFEF 054321-G/SP');
  });

  it('sem UF, não deixa barra solta', () => {
    expect(registroProfissional('CRN', '12345', null)).toBe('CRN 12345');
    expect(registroProfissional('CRN', '12345', '')).toBe('CRN 12345');
  });

  it('sem número não há registro — e null não é string vazia', () => {
    // String vazia iria para o PDF e deixaria a linha da assinatura em
    // branco, parecendo assinado sem estar.
    expect(registroProfissional('CFN', null, 'SP')).toBeNull();
    expect(registroProfissional('CFN', '   ', 'SP')).toBeNull();
  });

  it('número sem tipo ainda identifica', () => {
    expect(registroProfissional(null, 'CRN-1 9999', 'GO')).toBe('CRN-1 9999/GO');
  });

  it('os seis registros reais da base saem legíveis', () => {
    const reais: Array<[string, string, string, string]> = [
      ['CFN', 'CRN-3 12345', 'SP', 'CRN-3 12345/SP'],
      ['CONFEF', '054321-G/SP', 'SP', 'CONFEF 054321-G/SP'],
      ['CFN', 'CRN-3 EST-001', 'SP', 'CRN-3 EST-001/SP'],
      ['CFN', 'CRN-0 000000', 'SP', 'CRN-0 000000/SP'],
      ['CONFEF', 'CREF-0 000000-G/SP', 'SP', 'CREF-0 000000-G/SP'],
      ['CRN', '1234', 'GO', 'CRN 1234/GO'],
    ];
    for (const [t, n, uf, esperado] of reais) {
      expect(registroProfissional(t, n, uf)).toBe(esperado);
    }
  });
});
