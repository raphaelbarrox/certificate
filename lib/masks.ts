/**
 * Remove todos os caracteres não numéricos de uma string.
 * @param value A string para limpar.
 * @returns A string contendo apenas números.
 */
export const unmask = (value: string): string => {
  if (!value) return ""
  return value.replace(/\D/g, "")
}

/**
 * Aplica uma máscara de CPF (000.000.000-00).
 * @param value O valor numérico do CPF.
 * @returns O CPF formatado.
 */
export const applyCpfMask = (value: string): string => {
  return unmask(value)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .slice(0, 14)
}

/**
 * Aplica uma máscara de telefone ((00) 00000-0000).
 * @param value O valor numérico do telefone.
 * @returns O telefone formatado.
 */
export const applyPhoneMask = (value: string): string => {
  const unmasked = unmask(value)
  if (unmasked.length > 10) {
    return unmasked.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").slice(0, 15)
  }
  return unmasked.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3").slice(0, 14)
}

/**
 * Aplica uma máscara de CEP (00000-000).
 * @param value O valor numérico do CEP.
 * @returns O CEP formatado.
 */
export const applyCepMask = (value: string): string => {
  return unmask(value)
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 9)
}

/**
 * Aplica uma máscara de data (DD/MM/AAAA).
 * @param value O valor numérico da data.
 * @returns A data formatada.
 */
export const applyDateMask = (value: string): string => {
  return unmask(value)
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .slice(0, 10)
}

/**
 * Aplica uma máscara de CNPJ (00.000.000/0000-00).
 * @param value O valor numérico do CNPJ.
 * @returns O CNPJ formatado.
 */
export const applyCnpjMask = (value: string): string => {
  return unmask(value)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18)
}

/**
 * Identifica e aplica a máscara correta com base no nome do campo.
 * @param value O valor a ser formatado.
 * @param fieldIdentifier O nome ou label do campo (ex: "CPF", "Telefone").
 * @returns O valor formatado.
 */
export const getMaskedValue = (value: string, fieldIdentifier: string): string => {
  if (!value) return ""
  const lowerIdentifier = fieldIdentifier.toLowerCase()

  if (lowerIdentifier.includes("cpf")) return applyCpfMask(value)
  if (lowerIdentifier.includes("cnpj")) return applyCnpjMask(value)
  if (lowerIdentifier.includes("phone") || lowerIdentifier.includes("whatsapp") || lowerIdentifier.includes("telefone"))
    return applyPhoneMask(value)
  if (lowerIdentifier.includes("cep")) return applyCepMask(value)
  if (lowerIdentifier.includes("data")) return applyDateMask(value)

  return value
}
