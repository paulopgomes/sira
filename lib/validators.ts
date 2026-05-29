/**
 * Valida um CPF brasileiro.
 * @param cpf CPF com ou sem formatação
 * @returns Objeto com o CPF formatado e booleano indicando validade
 */
export function validateCPF(cpf: string): { formatted: string; isValid: boolean } {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) {
    return {
      formatted: formatCPF(cleanCPF),
      isValid: false,
    };
  }

  let sum = 0;
  let remainder;

  // Validação do primeiro dígito
  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return {
      formatted: formatCPF(cleanCPF),
      isValid: false,
    };
  }

  // Validação do segundo dígito
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return {
      formatted: formatCPF(cleanCPF),
      isValid: false,
    };
  }

  return {
    formatted: formatCPF(cleanCPF),
    isValid: true,
  };
}

export function formatCPF(cpf: string): string {
  if (cpf.length !== 11) return cpf;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Aplica máscara de CPF enquanto o usuário digita.
 * @param value Valor bruto ou formatado
 * @returns Valor com máscara (000.000.000-00)
 */
export function maskCPF(value: string): string {
  const cleanValue = value.replace(/\D/g, '').slice(0, 11);
  
  if (cleanValue.length <= 3) return cleanValue;
  if (cleanValue.length <= 6) return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3)}`;
  if (cleanValue.length <= 9) return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6)}`;
  return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6, 9)}-${cleanValue.slice(9)}`;
}

/**
 * Valida um número de Cartão Nacional de Saúde (CNS / SUS).
 * Apenas verifica se possui 15 dígitos e retorna formatado.
 * @param cns CNS com ou sem formatação
 * @returns Objeto com o CNS formatado e booleano indicando validade
 */
export function validateCNS(cns: string): { formatted: string; isValid: boolean } {
  const cleanCNS = cns.replace(/\D/g, '');

  if (cleanCNS.length !== 15) {
    return {
      formatted: formatCNS(cleanCNS),
      isValid: false,
    };
  }

  return {
    formatted: formatCNS(cleanCNS),
    isValid: true,
  };
}

export function formatCNS(cns: string): string {
  if (cns.length !== 15) return cns;
  return cns.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
}

/**
 * Aplica máscara de Cartão SUS (CNS) enquanto o usuário digita.
 * @param value Valor bruto ou formatado
 * @returns Valor com máscara (000 0000 0000 0000)
 */
export function maskCNS(value: string): string {
  const cleanValue = value.replace(/\D/g, '').slice(0, 15);
  
  if (cleanValue.length <= 3) return cleanValue;
  if (cleanValue.length <= 7) return `${cleanValue.slice(0, 3)} ${cleanValue.slice(3)}`;
  if (cleanValue.length <= 11) return `${cleanValue.slice(0, 3)} ${cleanValue.slice(3, 7)} ${cleanValue.slice(7)}`;
  return `${cleanValue.slice(0, 3)} ${cleanValue.slice(3, 7)} ${cleanValue.slice(7, 11)} ${cleanValue.slice(11)}`;
}

/**
 * Valida um código CID-10 ou CID-11.
 * @param cid Código CID
 * @returns Objeto com o tipo identificado e validade
 */
export function validateCID(cid: string): { isValid: boolean; type: 'CID-10' | 'CID-11' | null } {
  const upperCID = cid.trim().toUpperCase();
  
  if (!upperCID) return { isValid: false, type: null };

  // CID-10: Uma letra maiúscula seguida de dois números, opcionalmente ponto + número
  const cid10Regex = /^[A-Z]\d{2}(\.\d)?$/;
  if (cid10Regex.test(upperCID)) {
    return { isValid: true, type: 'CID-10' };
  }

  // CID-11: Código alfanumérico entre 4 e 6 caracteres, deve conter pelo menos uma letra e um número
  const cid11Regex = /^(?=.*[A-Z])(?=.*\d)[A-Z\d]{4,6}$/;
  if (cid11Regex.test(upperCID)) {
    return { isValid: true, type: 'CID-11' };
  }

  return { isValid: false, type: null };
}

/**
 * Valida um CNPJ brasileiro.
 * @param cnpj CNPJ com ou sem formatação
 * @returns Objeto com o CNPJ formatado e booleano indicando validade
 */
export function validateCNPJ(cnpj: string): { formatted: string; isValid: boolean } {
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  if (cleanCNPJ.length !== 14 || /^(\d)\1+$/.test(cleanCNPJ)) {
    return {
      formatted: formatCNPJ(cleanCNPJ),
      isValid: false,
    };
  }

  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return {
      formatted: formatCNPJ(cleanCNPJ),
      isValid: false,
    };
  }

  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return {
      formatted: formatCNPJ(cleanCNPJ),
      isValid: false,
    };
  }

  return {
    formatted: formatCNPJ(cleanCNPJ),
    isValid: true,
  };
}

export function formatCNPJ(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Aplica máscara de CNPJ enquanto o usuário digita.
 * @param value Valor bruto ou formatado
 * @returns Valor com máscara (00.000.000/0000-00)
 */
export function maskCNPJ(value: string): string {
  const cleanValue = value.replace(/\D/g, '').slice(0, 14);
  
  if (cleanValue.length <= 2) return cleanValue;
  if (cleanValue.length <= 5) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2)}`;
  if (cleanValue.length <= 8) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5)}`;
  if (cleanValue.length <= 12) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8)}`;
  return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8, 12)}-${cleanValue.slice(12)}`;
}
