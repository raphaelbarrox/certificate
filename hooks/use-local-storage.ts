"use client"

import { useState, useEffect } from "react"

// Hook para persistir o estado no localStorage do navegador
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Não executa no lado do servidor
    if (typeof window === "undefined") {
      return initialValue
    }
    try {
      // Tenta obter o valor do localStorage pela chave
      const item = window.localStorage.getItem(key)
      // Faz o parse do JSON ou retorna o valor inicial se não houver nada
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      // Se houver erro, retorna o valor inicial e loga o erro
      console.error(`Error reading localStorage key “${key}”:`, error)
      return initialValue
    }
  })

  // useEffect para atualizar o localStorage quando o estado muda
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(storedValue))
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}

export default useLocalStorage
