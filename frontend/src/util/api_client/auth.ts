import { BASE_URL, getErrorMessageFromResponse, safeFetch } from './core'

export const tryLogin = async (email: string, password: string) => {
  const response = await safeFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email, password: password }),
    credentials: 'include'
  })

  if (!response.ok) {
    if (response.status === 401) return false
    throw new Error(await getErrorMessageFromResponse(response, 'Login failed'))
  }

  const json = await response.json()
  localStorage.setItem('user', JSON.stringify(json))

  return json
}

export const tryRegister = async (name: string, email: string, password: string) => {
  const response = await safeFetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password
    }),
    headers: {
      'Content-Type': 'application/json'
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Registration failed'))
  }

  return await response.json()
}

