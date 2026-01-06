import SignupForm from './components/SignupForm'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Flight Delay Notifier
          </h1>
          <p className="text-gray-600">
            Get real-time updates about your Schiphol Airport flight and traffic conditions
          </p>
        </div>
        
        <SignupForm />
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>We&apos;ll monitor your flight and send you email notifications about:</p>
          <ul className="mt-2 space-y-1">
            <li>✈️ Flight delays and cancellations</li>
            <li>🚗 Traffic conditions to the airport</li>
            <li>⏰ Optimal departure time from your home</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
