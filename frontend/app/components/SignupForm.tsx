'use client'

import { useState, FormEvent } from 'react'

interface FormData {
  name: string
  email: string
  homeAddress: string
  flightNumber: string
  departureDate: string
}

interface ApiResponse {
  message: string
  user: {
    id: string
    email: string
    name: string
    homeAddress: string
  }
  flight: {
    id: string
    flightNumber: string
    departureTime: string
    origin: string
    destination: string
    status: string
  }
  token: string
}

export default function SignupForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    homeAddress: '',
    flightNumber: '',
    departureDate: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      setSuccess(true)
      // Store token in localStorage (in production, use httpOnly cookies)
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token)
        localStorage.setItem('userId', data.user.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registration Successful!
          </h2>
          <p className="text-gray-600 mb-4">
            We&apos;re now monitoring your flight. You&apos;ll receive email notifications about any updates.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Register another flight
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="John Doe"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="john@example.com"
          />
        </div>

        {/* Home Address */}
        <div>
          <label htmlFor="homeAddress" className="block text-sm font-medium text-gray-700 mb-2">
            Home Address
          </label>
          <textarea
            id="homeAddress"
            name="homeAddress"
            required
            value={formData.homeAddress}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition resize-none"
            placeholder="123 Main Street, Amsterdam, 1012 AB"
          />
          <p className="text-xs text-gray-500 mt-1">
            We&apos;ll use this to calculate traffic time to Schiphol Airport
          </p>
        </div>

        {/* Flight Number */}
        <div>
          <label htmlFor="flightNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Flight Number
          </label>
          <input
            type="text"
            id="flightNumber"
            name="flightNumber"
            required
            value={formData.flightNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition uppercase"
            placeholder="KL1234"
            pattern="[A-Za-z0-9]{2,7}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Example: KL1234, BA456, AI155
          </p>
        </div>

        {/* Departure Date */}
        <div>
          <label htmlFor="departureDate" className="block text-sm font-medium text-gray-700 mb-2">
            Departure Date & Time
          </label>
          <input
            type="datetime-local"
            id="departureDate"
            name="departureDate"
            required
            value={formData.departureDate}
            onChange={handleChange}
            min={(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              return today.getTime()
            })()}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Registering...' : 'Start Monitoring My Flight'}
        </button>
      </form>
    </div>
  )
}
