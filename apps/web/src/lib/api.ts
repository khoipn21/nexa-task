const API_BASE = import.meta.env.VITE_API_URL || '/api'

type FetchOptions = RequestInit & {
  params?: Record<string, string>
}

type TokenGetter = () => Promise<string | null>

class ApiClient {
  private tokenGetter: TokenGetter | null = null

  setTokenGetter(getter: TokenGetter | null) {
    this.tokenGetter = getter
  }

  private async getToken(): Promise<string | null> {
    if (!this.tokenGetter) return null
    return this.tokenGetter()
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...init } = options
    let url = `${API_BASE}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')

    const token = await this.getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(url, { ...init, headers })
    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error?.message || 'Request failed',
        response.status,
        data.error,
      )
    }

    return data.data
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'GET', params })
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  delete<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE' })
  }

  // Upload method for multipart form data (file uploads)
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${API_BASE}${endpoint}`

    const headers = new Headers()
    // Don't set Content-Type - browser will set it with boundary for multipart
    const token = await this.getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error?.message || 'Upload failed',
        response.status,
        data.error,
      )
    }

    return data.data
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()
